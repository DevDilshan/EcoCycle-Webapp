using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace backend.Services;

/// <summary>Only the admin-authorized controller calls this server-side storage client.</summary>
public class RewardImageStorage(HttpClient client, string? supabaseUrl, string? serviceKey)
{
    public const int MaxBytes = 5 * 1024 * 1024;
    private const string Bucket = "reward-images";

    public static (string Mime, string Extension) Detect(byte[] bytes)
    {
        if (bytes.Length >= 12 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] {137,80,78,71,13,10,26,10}))
            return ("image/png", "png");
        if (bytes.Length >= 12 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255)
            return ("image/jpeg", "jpg");
        if (bytes.Length >= 12 && bytes.AsSpan(0,4).SequenceEqual("RIFF"u8)
            && bytes.AsSpan(8,4).SequenceEqual("WEBP"u8)) return ("image/webp", "webp");
        throw new ArgumentException("Choose a JPEG, PNG or WebP image, up to 5 MB.");
    }

    private HttpRequestMessage Request(HttpMethod method, string path)
    {
        var request = new HttpRequestMessage(method, $"{supabaseUrl!.TrimEnd('/')}/storage/v1/{path}");
        request.Headers.Add("apikey", serviceKey);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", serviceKey);
        return request;
    }

    public async Task<string> UploadAsync(byte[] bytes, CancellationToken ct)
    {
        if (bytes.Length == 0 || bytes.Length > MaxBytes)
            throw new ArgumentException("Choose an image up to 5 MB.");
        var (mime, extension) = Detect(bytes);
        if (string.IsNullOrWhiteSpace(supabaseUrl) || string.IsNullOrWhiteSpace(serviceKey))
            throw new InvalidOperationException("Image uploading is unavailable right now. Choose artwork or use an image URL.");

        using var lookup = Request(HttpMethod.Get, $"bucket/{Bucket}");
        using var bucket = await client.SendAsync(lookup, ct);
        if (!bucket.IsSuccessStatusCode)
        {
            if (bucket.StatusCode is not (HttpStatusCode.NotFound or HttpStatusCode.BadRequest))
                throw new HttpRequestException("Reward image storage is unavailable.");
            using var create = Request(HttpMethod.Post, "bucket");
            create.Content = JsonContent.Create(new { id = Bucket, name = Bucket, @public = true,
                file_size_limit = MaxBytes, allowed_mime_types = new[] { "image/png", "image/jpeg", "image/webp" } });
            using var created = await client.SendAsync(create, ct);
            // A concurrent first upload may have created the bucket already.
            if (!created.IsSuccessStatusCode && created.StatusCode is not (HttpStatusCode.Conflict or HttpStatusCode.BadRequest))
                throw new HttpRequestException("Reward image storage is unavailable.");
        }
        // Do not change an existing bucket's visibility or its policies.
        using var verify = Request(HttpMethod.Get, $"bucket/{Bucket}");
        using var checkedBucket = await client.SendAsync(verify, ct);
        checkedBucket.EnsureSuccessStatusCode();
        using var metadata = JsonDocument.Parse(await checkedBucket.Content.ReadAsStringAsync(ct));
        if (!metadata.RootElement.TryGetProperty("public", out var visibility) || !visibility.GetBoolean())
            throw new InvalidOperationException("Image uploading is unavailable right now. Choose artwork or use an image URL.");

        var path = $"catalog/{Guid.NewGuid():N}.{extension}";
        using var upload = Request(HttpMethod.Post, $"object/{Bucket}/{path}");
        upload.Content = new ByteArrayContent(bytes);
        upload.Content.Headers.ContentType = new MediaTypeHeaderValue(mime);
        upload.Headers.CacheControl = new CacheControlHeaderValue { MaxAge = TimeSpan.FromDays(365) };
        using var response = await client.SendAsync(upload, ct);
        response.EnsureSuccessStatusCode();
        return $"{supabaseUrl.TrimEnd('/')}/storage/v1/object/public/{Bucket}/{path}";
    }
}

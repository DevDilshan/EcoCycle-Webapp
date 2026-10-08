using System.Net;
using System.Net.Http.Json;
using backend.Services;

namespace backend.Tests.Services;

public class RewardImageStorageTests
{
    private static readonly byte[] Png = [137,80,78,71,13,10,26,10,0,0,0,0];

    private class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct) => send(request);
    }

    [Fact]
    public async Task Upload_uses_server_credentials_and_a_unique_public_path_with_the_detected_mime()
    {
        string? uploadedPath = null;
        using var client = new HttpClient(new Handler(async request => {
            Assert.Equal("server-test-key", request.Headers.Authorization!.Parameter);
            if (request.Method == HttpMethod.Post) {
                uploadedPath = request.RequestUri!.AbsolutePath;
                Assert.Equal("image/png", request.Content!.Headers.ContentType!.MediaType);
                Assert.Equal(Png, await request.Content.ReadAsByteArrayAsync());
                return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { }) };
            }
            return new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { @public = true }) };
        }));
        var url = await new RewardImageStorage(client, "https://storage.example.com", "server-test-key").UploadAsync(Png, default);
        Assert.StartsWith("/storage/v1/object/reward-images/catalog/", uploadedPath);
        Assert.StartsWith("https://storage.example.com/storage/v1/object/public/reward-images/catalog/", url);
        Assert.EndsWith(".png", url);
    }

    [Theory]
    [InlineData("<svg><script>alert(1)</script></svg>")]
    [InlineData("not an image")]
    public async Task Disguised_files_are_rejected_before_contacting_storage(string data)
    {
        using var client = new HttpClient(new Handler(_ => throw new Exception("Must not call storage")));
        await Assert.ThrowsAsync<ArgumentException>(() => new RewardImageStorage(client, "https://storage.example.com", "test")
            .UploadAsync(System.Text.Encoding.UTF8.GetBytes(data), default));
    }

    [Fact]
    public async Task Oversized_files_are_rejected_before_contacting_storage()
    {
        using var client = new HttpClient();
        await Assert.ThrowsAsync<ArgumentException>(() => new RewardImageStorage(client, "https://storage.example.com", "test")
            .UploadAsync(new byte[RewardImageStorage.MaxBytes + 1], default));
    }

    [Fact]
    public async Task An_existing_private_bucket_is_not_made_public()
    {
        using var client = new HttpClient(new Handler(request => {
            Assert.Equal(HttpMethod.Get, request.Method);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK) { Content = JsonContent.Create(new { @public = false }) });
        }));
        await Assert.ThrowsAsync<InvalidOperationException>(() => new RewardImageStorage(client, "https://storage.example.com", "test")
            .UploadAsync(Png, default));
    }
}

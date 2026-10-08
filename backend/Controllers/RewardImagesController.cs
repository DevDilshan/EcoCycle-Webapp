using backend.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace backend.Controllers;

[ApiController]
[Route("api/reward-items/image")]
[Authorize(Roles = "admin")]
public class RewardImagesController(RewardImageStorage storage, ILogger<RewardImagesController> logger) : ControllerBase
{
    [HttpPost]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 6 * 1024 * 1024)]
    public async Task<IActionResult> Upload([FromForm] IFormFile file, CancellationToken ct)
    {
        if (file.Length == 0 || file.Length > RewardImageStorage.MaxBytes)
            return BadRequest(new { message = "Choose a JPEG, PNG or WebP image, up to 5 MB." });
        try
        {
            using var stream = new MemoryStream();
            await file.CopyToAsync(stream, ct);
            var imageUrl = await storage.UploadAsync(stream.ToArray(), ct);
            return Ok(new { imageUrl });
        }
        catch (ArgumentException ex) { return BadRequest(new { message = ex.Message }); }
        catch (Exception ex) when (ex is HttpRequestException or InvalidOperationException or TaskCanceledException)
        {
            logger.LogWarning("Reward image upload failed: {ErrorType}", ex.GetType().Name);
            return StatusCode(503, new { message = "Image uploading is unavailable right now. Choose artwork or use an image URL." });
        }
    }
}

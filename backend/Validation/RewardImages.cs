namespace backend.Validation;

/// <summary>Bundled artwork shared by web and Flutter. Older items get an image without a data rewrite.</summary>
public static class RewardImages
{
    public static readonly string[] Keys = [
        "tote", "herb-seeds", "mobile-reload", "toothbrush", "water-bottle",
        "grocery-voucher", "compost-kit", "recycling-bins", "utility-voucher",
        "compost-bin", "tree", "solar-lights", "produce-bags", "cutlery", "notebook"
    ];

    public static string? Validate(string? value)
    {
        if (value is null) return null;
        var image = value.Trim();
        if (image.Length == 0) return ""; // Explicitly removed; legacy null still gets name-matched artwork.
        if (image.Length <= 2048 && Keys.Any(key => image == PathFor(key))) return image;
        if (image.Length <= 2048 && Uri.TryCreate(image, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps && !string.IsNullOrEmpty(uri.Host)
            && string.IsNullOrEmpty(uri.UserInfo)) return image;
        throw new ArgumentException("Choose a catalog image or enter a valid HTTPS image URL.");
    }

    public static string? ForName(string name)
    {
        var n = name.ToLowerInvariant();
        var key = n switch
        {
            _ when n.Contains("produce bag") => "produce-bags",
            _ when n.Contains("tote") => "tote",
            _ when n.Contains("seed") => "herb-seeds",
            _ when n.Contains("reload") => "mobile-reload",
            _ when n.Contains("toothbrush") => "toothbrush",
            _ when n.Contains("water bottle") => "water-bottle",
            _ when n.Contains("supermarket") || n.Contains("grocery") => "grocery-voucher",
            _ when n.Contains("compost") && (n.Contains("starter") || n.Contains("kit")) => "compost-kit",
            _ when n.Contains("compost") => "compost-bin",
            _ when n.Contains("recycling bin") => "recycling-bins",
            _ when n.Contains("utility") => "utility-voucher",
            _ when n.Contains("tree") => "tree",
            _ when n.Contains("solar") => "solar-lights",
            _ when n.Contains("cutlery") => "cutlery",
            _ when n.Contains("notebook") => "notebook",
            _ => null
        };
        return key is null ? null : PathFor(key);
    }

    private static string PathFor(string key) => $"/images/rewards/{key}.webp";
}

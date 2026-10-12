namespace CryptoToolkit.Web.Models;

// A tool page. Key is the prefix of the tool's texts in the language files
// ("tool.encrypt.name") and Icon is an SVG path on a 24×24 grid.
public record Tool(string Slug, string Key, string Algorithms, string Icon)
{
    public string Url => "/" + Slug;
}

// The tool pages, in menu order. The header menu and the home page cards are
// both drawn from this list.
public static class Tools
{
    public static readonly Tool[] All =
    [
        new("encrypt", "encrypt", "AES-256-GCM · PBKDF2",
            "M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5zM12 15v2"),
        new("rsa", "rsa", "RSA-OAEP · AES-GCM",
            "M2.6 17.4A2 2 0 0 0 2 18.8V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.2a2 2 0 0 0 1.4-.6l.8-.8a6.5 6.5 0 1 0-4-4ZM16.5 7.5h.01"),
        new("sign", "sign", "ECDSA P-256 · SHA-256",
            "M4 20h16M6 16l9.5-9.5a2.12 2.12 0 0 1 3 3L9 19H6v-3ZM14 8l3 3"),
        new("hash", "hash", "SHA-256 · SHA-512 · HMAC",
            "M9 4 7 20M17 4l-2 16M4 9h16M3 15h16"),
    ];
}

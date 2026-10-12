using System.Text.Json;
using System.Text.RegularExpressions;
using CryptoToolkit.Web.Models;

namespace CryptoToolkit.Tests;

// The language files are plain JSON, so nothing checks them at compile time.
// These tests scan the views and scripts and make sure every text they ask
// for exists, in both languages.
public class ResourceTests
{
    private static readonly string WebRoot = FindWebProject();

    private static string FindWebProject()
    {
        var dir = AppContext.BaseDirectory;
        while (!File.Exists(Path.Combine(dir, "CryptoToolkit.slnx"))) dir = Path.GetDirectoryName(dir)!;
        return Path.Combine(dir, "src", "CryptoToolkit.Web");
    }

    private static Dictionary<string, string> Load(string lang) =>
        JsonSerializer.Deserialize<Dictionary<string, string>>(
            File.ReadAllText(Path.Combine(WebRoot, "Resources", $"{lang}.json")))!;

    private static readonly Dictionary<string, string> Tr = Load("tr");
    private static readonly Dictionary<string, string> En = Load("en");

    private static IEnumerable<string> Files(string folder, string pattern) =>
        Directory.EnumerateFiles(Path.Combine(WebRoot, folder), pattern, SearchOption.AllDirectories);

    private static IEnumerable<string> Matches(IEnumerable<string> files, string pattern) =>
        files.SelectMany(f => Regex.Matches(File.ReadAllText(f), pattern).Select(m => m.Groups[1].Value)).Distinct();

    [Fact]
    public void Turkish_and_English_have_the_same_keys()
    {
        Assert.Empty(Tr.Keys.Except(En.Keys));
        Assert.Empty(En.Keys.Except(Tr.Keys));
    }

    [Fact]
    public void Every_text_is_filled_and_uses_the_same_placeholders_in_both_languages()
    {
        var placeholder = new Regex(@"\{\d\}");
        foreach (var (key, value) in Tr)
        {
            Assert.False(string.IsNullOrWhiteSpace(value), key);
            Assert.False(string.IsNullOrWhiteSpace(En[key]), key);
            var a = placeholder.Matches(value).Select(m => m.Value).Distinct().Order();
            var b = placeholder.Matches(En[key]).Select(m => m.Value).Distinct().Order();
            Assert.True(a.SequenceEqual(b), $"{key}: {value} / {En[key]}");
        }
    }

    [Fact]
    public void Every_key_used_in_a_view_exists()
    {
        var keys = Matches(Files("Views", "*.cshtml"), "T\\[\"([^\"]+)\"\\]").ToList();
        Assert.NotEmpty(keys);
        Assert.All(keys, key => Assert.True(Tr.ContainsKey(key), key));

        // Keys built from the tool list ($"tool.{key}.name").
        foreach (var tool in Tools.All)
        {
            Assert.True(Tr.ContainsKey($"tool.{tool.Key}.name"), tool.Key);
            Assert.True(Tr.ContainsKey($"tool.{tool.Key}.summary"), tool.Key);
        }
    }

    // Every error the crypto modules can throw must have a message; otherwise
    // the user would only see "An unexpected error occurred".
    [Fact]
    public void Every_error_code_thrown_by_the_scripts_has_a_message()
    {
        var codes = Matches(Files("wwwroot/js", "*.js"), "new CryptoError\\(\"(\\w+)\"\\)").ToList();
        Assert.Contains("decrypt", codes);
        Assert.All(codes, code => Assert.True(Tr.ContainsKey("js.err." + code), code));
    }

    [Fact]
    public void Every_text_requested_by_the_scripts_exists()
    {
        // Only complete keys: t("err." + code) is covered by the error code test.
        var keys = Matches(Files("wwwroot/js/ui", "*.js"), "\\bt\\(\"([\\w.]+)\"\\s*[,)]").ToList();
        Assert.NotEmpty(keys);
        Assert.All(keys, key => Assert.True(Tr.ContainsKey("js." + key), key));
    }
}

public class ModelTests
{
    [Theory]
    [InlineData(404, "error.404.title", "error.404.text")]
    [InlineData(429, "error.429.title", "error.429.text")]
    [InlineData(403, "error.403.title", "error.text")]
    [InlineData(500, "error.title", "error.text")]
    [InlineData(418, "error.title", "error.text")]
    public void Error_page_picks_its_texts_by_status_code(int code, string title, string text)
    {
        var model = new ErrorViewModel(code);
        Assert.Equal(title, model.TitleKey);
        Assert.Equal(text, model.TextKey);
    }

    [Fact]
    public void Tool_urls_are_unique_and_rooted()
    {
        Assert.Equal(Tools.All.Length, Tools.All.Select(t => t.Url).Distinct().Count());
        Assert.All(Tools.All, t => Assert.StartsWith("/", t.Url));
    }
}

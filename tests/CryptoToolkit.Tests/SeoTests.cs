using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using CryptoToolkit.Web.Infrastructure;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;

namespace CryptoToolkit.Tests;

public class SeoTests(AppFactory factory) : IClassFixture<AppFactory>
{
    private readonly HttpClient _client = factory.Https();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Theory]
    [MemberData(nameof(WebTests.Pages), MemberType = typeof(WebTests))]
    public async Task Every_page_has_its_own_title_canonical_alternates_and_json_ld(string path)
    {
        var html = await _client.GetStringAsync(path, Ct);
        var canonical = "https://crypto.miracdeprem.com" + path;
        Assert.Contains($"<link rel=\"canonical\" href=\"{canonical}\" />", html);
        Assert.Contains($"hreflang=\"en\" href=\"{canonical}?lang=en\"", html);
        Assert.Contains("property=\"og:image\"", html);
        Assert.DoesNotContain("name=\"robots\"", html);
        var json = Regex.Match(html, "<script type=\"application/ld\\+json\">(.*?)</script>", RegexOptions.Singleline).Groups[1].Value;
        Assert.Equal("WebApplication", JsonDocument.Parse(json).RootElement.GetProperty("@type").GetString());
    }

    [Fact]
    public async Task Lang_query_selects_english_and_points_canonical_to_itself()
    {
        var html = await _client.GetStringAsync("/hash?lang=en", Ct);
        Assert.Contains("<html lang=\"en\">", html);
        Assert.Contains("<link rel=\"canonical\" href=\"https://crypto.miracdeprem.com/hash?lang=en\" />", html);
        Assert.Contains("SHA-256 hash and HMAC generator", html);
    }

    [Fact]
    public async Task Error_pages_are_noindex()
    {
        var html = await (await _client.GetAsync("/no-such-page", Ct)).Content.ReadAsStringAsync(Ct);
        Assert.Contains("<meta name=\"robots\" content=\"noindex\" />", html);
    }

    [Fact]
    public async Task Sitemap_lists_every_page_in_both_languages()
    {
        var response = await _client.GetAsync("/sitemap.xml", Ct);
        Assert.Equal("application/xml", response.Content.Headers.ContentType?.MediaType);
        var doc = XDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal(10, doc.Descendants(XNamespace.Get("http://www.sitemaps.org/schemas/sitemap/0.9") + "loc").Count());
        var head = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Head, "/sitemap.xml"), Ct);
        Assert.Equal(HttpStatusCode.OK, head.StatusCode);
    }

    [Fact]
    public async Task Robots_points_to_the_sitemap()
    {
        var robots = await _client.GetStringAsync("/robots.txt", Ct);
        Assert.Contains("Sitemap: https://crypto.miracdeprem.com/sitemap.xml", robots);
    }

    // Regression from Sahaf: on an English address the language switch sent the
    // user back to "?lang=en", so switching to Turkish did nothing.
    [Fact]
    public void Language_switch_returns_without_the_lang_parameter()
    {
        var query = new QueryCollection(new Dictionary<string, StringValues> { ["lang"] = "en", ["x"] = "1" });
        Assert.Equal("/hash?x=1", Seo.WithoutLang("/hash", query));
    }

    [Fact]
    public void Json_ld_cannot_close_the_script_tag() =>
        Assert.DoesNotContain("</script>", Seo.JsonLd(new { name = "</script>" }));
}

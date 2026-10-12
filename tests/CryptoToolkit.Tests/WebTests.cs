using System.Net;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;

namespace CryptoToolkit.Tests;

// Runs the real app in memory, as in production, and checks what a browser
// would receive.
public class AppFactory : WebApplicationFactory<Program>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment("Production");

    public HttpClient Https() => CreateClient(new WebApplicationFactoryClientOptions
    {
        BaseAddress = new Uri("https://localhost"),
        AllowAutoRedirect = false,
    });
}

public class WebTests(AppFactory factory) : IClassFixture<AppFactory>
{
    private readonly HttpClient _client = factory.Https();
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static readonly TheoryData<string> Pages = ["/", "/encrypt", "/rsa", "/sign", "/hash"];

    [Theory]
    [MemberData(nameof(Pages))]
    public async Task Every_page_loads(string path)
    {
        var response = await _client.GetAsync(path, Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("text/html", response.Content.Headers.ContentType?.MediaType);
    }

    [Theory]
    [MemberData(nameof(Pages))]
    public async Task Pages_answer_head_requests(string path)
    {
        var response = await _client.SendAsync(new HttpRequestMessage(HttpMethod.Head, path), Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Health_check_answers()
    {
        var response = await _client.GetAsync("/healthz", Ct);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_page_shows_the_friendly_404()
    {
        var response = await _client.GetAsync("/no-such-page", Ct);
        var html = await response.Content.ReadAsStringAsync(Ct);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Contains("Sayfa bulunamadı", html);
    }

    [Theory]
    [InlineData("/")]
    [InlineData("/encrypt")]
    [InlineData("/no-such-page")]
    [InlineData("/css/site.css")]
    [InlineData("/js/crypto/password.js")]
    public async Task Security_headers_are_on_every_response(string path)
    {
        var response = await _client.GetAsync(path, Ct);
        var csp = response.Headers.GetValues("Content-Security-Policy").Single();
        Assert.Contains("default-src 'none'", csp);
        Assert.Contains("script-src 'self'", csp);
        Assert.Contains("connect-src 'none'", csp); // the page cannot send data anywhere
        Assert.Contains("frame-ancestors 'none'", csp);
        Assert.Contains("require-trusted-types-for 'script'", csp);
        Assert.DoesNotContain("unsafe-inline", csp);
        Assert.DoesNotContain("unsafe-eval", csp);
        Assert.Equal("DENY", response.Headers.GetValues("X-Frame-Options").Single());
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
    }

    [Fact]
    public async Task No_cross_origin_access_is_granted()
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/js/crypto/password.js");
        request.Headers.Add("Origin", "https://evil.example");
        var response = await _client.SendAsync(request, Ct);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
    }

    // The CSP forbids inline scripts; any <script> without src would be
    // blocked in the browser, so none may exist (JSON data blocks are not run).
    [Theory]
    [MemberData(nameof(Pages))]
    public async Task Pages_have_no_inline_scripts(string path)
    {
        var html = await _client.GetStringAsync(path, Ct);
        foreach (Match tag in Regex.Matches(html, "<script[^>]*>"))
        {
            Assert.True(tag.Value.Contains("src=") || tag.Value.Contains("type=\"application/json\""), tag.Value);
        }
        Assert.DoesNotMatch(" on(click|load|error|submit)=", html);
        Assert.DoesNotContain(" style=\"", html);
    }

    [Theory]
    [InlineData("/encrypt")]
    [InlineData("/rsa")]
    [InlineData("/sign")]
    [InlineData("/hash")]
    public async Task Tool_pages_hand_their_texts_to_the_scripts(string path)
    {
        var html = await _client.GetStringAsync(path, Ct);
        var json = Regex.Match(html, "<script type=\"application/json\" id=\"texts\">(.*?)</script>", RegexOptions.Singleline);
        Assert.True(json.Success);
        var texts = JsonSerializer.Deserialize<Dictionary<string, string>>(json.Groups[1].Value)!;
        Assert.Contains("err.unknown", texts.Keys);
        Assert.DoesNotContain(texts.Keys, k => k.StartsWith("js.")); // the prefix is removed
    }

    [Theory]
    [InlineData(null, "tr")]
    [InlineData("tr-TR,tr;q=0.9", "tr")]
    [InlineData("en", "en")]
    [InlineData("en-US,en;q=0.9", "en")]
    [InlineData("de-DE", "tr")]
    public async Task Language_follows_the_browser(string? acceptLanguage, string expected)
    {
        var request = new HttpRequestMessage(HttpMethod.Get, "/");
        if (acceptLanguage != null) request.Headers.Add("Accept-Language", acceptLanguage);
        var html = await (await _client.SendAsync(request, Ct)).Content.ReadAsStringAsync(Ct);
        Assert.Contains($"<html lang=\"{expected}\">", html);
    }

    [Fact]
    public async Task Language_switch_sets_a_cookie_and_returns_to_the_page()
    {
        var response = await _client.GetAsync("/lang/en?returnUrl=%2Fhash", Ct);
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/hash", response.Headers.Location?.OriginalString);
        var cookie = response.Headers.GetValues("Set-Cookie").Single();
        Assert.Contains(".AspNetCore.Culture=c%3Den%7Cuic%3Den", cookie);
        Assert.Contains("httponly", cookie, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("secure", cookie, StringComparison.OrdinalIgnoreCase);

        var request = new HttpRequestMessage(HttpMethod.Get, "/hash");
        request.Headers.Add("Cookie", cookie.Split(';')[0]);
        var html = await (await _client.SendAsync(request, Ct)).Content.ReadAsStringAsync(Ct);
        Assert.Contains("<html lang=\"en\">", html);
    }

    // An open redirect would let a phishing link start on this trusted domain.
    [Theory]
    [InlineData("https://evil.example")]
    [InlineData("//evil.example")]
    [InlineData("/\\evil.example")]
    [InlineData("javascript:alert(1)")]
    public async Task Language_switch_never_redirects_to_another_site(string returnUrl)
    {
        var response = await _client.GetAsync("/lang/tr?returnUrl=" + Uri.EscapeDataString(returnUrl), Ct);
        Assert.Equal(HttpStatusCode.Redirect, response.StatusCode);
        Assert.Equal("/", response.Headers.Location?.OriginalString);
    }

    [Fact]
    public async Task Plain_http_is_redirected_to_https_except_the_health_check()
    {
        var http = factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        var page = await http.GetAsync("/", Ct);
        Assert.Equal(HttpStatusCode.TemporaryRedirect, page.StatusCode);
        Assert.Equal("https", page.Headers.Location?.Scheme);

        var health = await http.GetAsync("/healthz", Ct);
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
    }
}

public class CacheTests(AppFactory factory) : IClassFixture<AppFactory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    // Modules import each other without a version in the URL; after a deploy
    // the browser must not mix new and old ones from its cache.
    [Theory]
    [InlineData("/js/crypto/password.js")]
    [InlineData("/js/ui/common.js")]
    public async Task Unversioned_scripts_are_revalidated(string path)
    {
        var response = await factory.Https().GetAsync(path, Ct);
        Assert.True(response.Headers.CacheControl?.NoCache);
    }

    [Fact]
    public async Task Versioned_files_are_cached_for_a_year()
    {
        var html = await factory.Https().GetStringAsync("/", Ct);
        var css = Regex.Match(html, "href=\"(/css/site\\.css\\?v=[^\"]+)\"").Groups[1].Value;
        var response = await factory.Https().GetAsync(css, Ct);
        Assert.Equal(TimeSpan.FromDays(365), response.Headers.CacheControl?.MaxAge);
        Assert.True(response.Headers.CacheControl?.Public);
    }
}

public class ClientIpTests
{
    private static HttpContext Context(string? header, string remote = "10.0.0.1")
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = System.Net.IPAddress.Parse(remote);
        if (header != null) context.Request.Headers[CryptoToolkit.Web.Infrastructure.ClientIp.CloudflareHeader] = header;
        return context;
    }

    [Fact]
    public void Cloudflare_header_wins_over_the_proxy_address() =>
        Assert.Equal("203.0.113.9", CryptoToolkit.Web.Infrastructure.ClientIp.Of(Context("203.0.113.9")));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-an-ip")]
    [InlineData("1.2.3.4, 5.6.7.8")]
    public void Without_a_valid_header_the_connection_address_is_used(string? header) =>
        Assert.Equal("10.0.0.1", CryptoToolkit.Web.Infrastructure.ClientIp.Of(Context(header)));
}

// A fresh app so the other tests do not use up the limit.
public class RateLimitTests
{
    // Behind Cloudflare every request comes from some Cloudflare server; the
    // limit must count per visitor (CF-Connecting-IP), not per proxy.
    [Fact]
    public async Task Each_visitor_behind_cloudflare_has_their_own_limit()
    {
        using var factory = new AppFactory();
        var client = factory.Https();
        var ct = TestContext.Current.CancellationToken;
        async Task<HttpStatusCode> Get(string ip)
        {
            var request = new HttpRequestMessage(HttpMethod.Get, "/");
            request.Headers.Add("CF-Connecting-IP", ip);
            return (await client.SendAsync(request, ct)).StatusCode;
        }
        for (var i = 0; i < 300; i++) Assert.Equal(HttpStatusCode.OK, await Get("198.51.100.1"));
        Assert.Equal(HttpStatusCode.TooManyRequests, await Get("198.51.100.1"));
        Assert.Equal(HttpStatusCode.OK, await Get("198.51.100.2"));
    }

    [Fact]
    public async Task Too_many_requests_get_a_friendly_429()
    {
        using var factory = new AppFactory();
        var client = factory.Https();
        var ct = TestContext.Current.CancellationToken;
        for (var i = 0; i < 300; i++)
        {
            Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/", ct)).StatusCode);
        }
        var response = await client.GetAsync("/", ct);
        Assert.Equal(HttpStatusCode.TooManyRequests, response.StatusCode);
        Assert.Contains("Çok fazla istek", await response.Content.ReadAsStringAsync(ct));
        // The health check is never limited, so Render does not mark the service down.
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/healthz", ct)).StatusCode);
    }
}

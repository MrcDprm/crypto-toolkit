using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Unicode;
using System.Threading.RateLimiting;
using CryptoToolkit.Web.Infrastructure;
using CryptoToolkit.Web.Localization;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Localization;
using Microsoft.Extensions.Localization;
using Microsoft.Extensions.WebEncoders;

var builder = WebApplication.CreateBuilder(args);

// The server only serves pages: all cryptography runs in the browser, so
// there is no database, no sign-in and no form that posts user data.

// Localization: my JSON localizer must be registered before AddLocalization.
builder.Services.AddSingleton<IStringLocalizerFactory, JsonStringLocalizerFactory>();
builder.Services.AddLocalization();
builder.Services.Configure<RequestLocalizationOptions>(options =>
{
    var cultures = new[] { new CultureInfo("tr"), new CultureInfo("en") };
    options.DefaultRequestCulture = new RequestCulture("tr");
    options.SupportedCultures = cultures;
    options.SupportedUICultures = cultures;
    options.RequestCultureProviders = [new CookieRequestCultureProvider(), new AcceptLanguageHeaderRequestCultureProvider()];
});

// Razor encodes everything outside Basic Latin by default ("ı" becomes &#x131;).
// Allowing all ranges keeps Turkish text readable; <, >, & and quotes are still encoded.
builder.Services.Configure<WebEncoderOptions>(options =>
    options.TextEncoderSettings = new TextEncoderSettings(UnicodeRanges.All));

builder.Services.AddControllersWithViews();

// One limit per IP for every request; enough for normal use, stops floods.
// Not limited: the health check (Render would mark the service down) and the
// error page re-executed for a rejected request, which would otherwise be
// rejected too and leave the user with an empty 429 page.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
        context.Request.Path.StartsWithSegments("/healthz")
        || context.Features.Get<IStatusCodeReExecuteFeature>() != null
            ? RateLimitPartition.GetNoLimiter("exempt")
            : RateLimitPartition.GetFixedWindowLimiter(
                ClientIp.Of(context),
                _ => new FixedWindowRateLimiterOptions { PermitLimit = 300, Window = TimeSpan.FromMinutes(1) }));
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    // Render terminates TLS at its proxy and forwards plain HTTP.
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Behind Render's proxy the public port is always 443.
builder.Services.AddHttpsRedirection(options => options.HttpsPort = 443);
builder.Services.AddHsts(options => options.MaxAge = TimeSpan.FromDays(365));
builder.Services.AddHealthChecks();

var app = builder.Build();

app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
    // Render's health check calls the container over plain HTTP; a redirect
    // there would mark the service as down.
    app.UseWhen(context => !context.Request.Path.StartsWithSegments("/healthz"),
        branch => branch.UseHttpsRedirection());
}
app.UseStatusCodePagesWithReExecute("/Error/{0}");
app.UseSecurityHeaders();
app.UseStaticFiles(new StaticFileOptions
{
    // Files linked with asp-append-version (?v=hash) change URL when their
    // content changes, so browsers may keep them for a year.
    OnPrepareResponse = context =>
    {
        if (context.Context.Request.Query.ContainsKey("v"))
            context.Context.Response.Headers.CacheControl = "public,max-age=31536000,immutable";
        // Modules imported by other modules have no version in their URL.
        // The browser must check them on every load, or after a deploy it
        // could mix a new page script with an old module and break the page.
        else
            context.Context.Response.Headers.CacheControl = "no-cache";
    },
});
app.UseRequestLocalization();
app.UseRouting();
app.UseRateLimiter();

app.MapHealthChecks("/healthz");
app.MapControllers();

app.Run();

// Lets the test project reach Program.
public partial class Program;

namespace CryptoToolkit.Web.Infrastructure;

public static class SecurityHeaders
{
    // Everything (scripts, styles, fonts) is served from this site, so the
    // policy allows no other origin. connect-src 'none': the page never sends
    // anything anywhere, which the browser now enforces too. Trusted Types
    // make HTML-string sinks such as innerHTML throw in supporting browsers.
    private const string Csp =
        "default-src 'none'; " +
        "script-src 'self'; " +
        "style-src 'self'; " +
        "font-src 'self'; " +
        "img-src 'self' data:; " +
        "connect-src 'none'; " +
        "manifest-src 'self'; " +
        "form-action 'self'; " +
        "frame-ancestors 'none'; base-uri 'none'; object-src 'none'; " +
        "require-trusted-types-for 'script'; trusted-types 'none'";

    public static IApplicationBuilder UseSecurityHeaders(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var headers = context.Response.Headers;
            headers.ContentSecurityPolicy = Csp;
            headers.XContentTypeOptions = "nosniff";
            headers.XFrameOptions = "DENY";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=(), usb=()";
            headers["Cross-Origin-Opener-Policy"] = "same-origin";
            headers["Cross-Origin-Resource-Policy"] = "same-origin";
            await next();
        });
}

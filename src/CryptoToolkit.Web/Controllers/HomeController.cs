using CryptoToolkit.Web.Infrastructure;
using Microsoft.AspNetCore.Localization;
using Microsoft.AspNetCore.Mvc;

namespace CryptoToolkit.Web.Controllers;

public class HomeController : Controller
{
    [HttpGet("/"), HttpHead("/")]
    public IActionResult Index() => View(Tools.All);

    [HttpGet("lang/{code}")]
    public IActionResult Language(string code, string? returnUrl)
    {
        var culture = code == "en" ? "en" : "tr";
        Response.Cookies.Append(
            CookieRequestCultureProvider.DefaultCookieName,
            CookieRequestCultureProvider.MakeCookieValue(new(culture)),
            new CookieOptions
            {
                Expires = DateTimeOffset.UtcNow.AddYears(1),
                IsEssential = true,
                SameSite = SameSiteMode.Lax,
                Secure = Request.IsHttps,
                HttpOnly = true,
            });
        // Only local paths: an open redirect would let others abuse this link.
        return LocalRedirect(Url.IsLocalUrl(returnUrl) ? returnUrl : "/");
    }
}

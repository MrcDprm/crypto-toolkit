using Microsoft.AspNetCore.Mvc;

namespace CryptoToolkit.Web.Controllers;

// The tool pages are static shells: the forms are handled by the page's own
// script in the browser and never post anything back here.
public class ToolsController : Controller
{
    [HttpGet("encrypt"), HttpHead("encrypt")]
    public IActionResult Encrypt() => View();

    [HttpGet("rsa"), HttpHead("rsa")]
    public IActionResult Rsa() => View();

    [HttpGet("sign"), HttpHead("sign")]
    public IActionResult Sign() => View();
}

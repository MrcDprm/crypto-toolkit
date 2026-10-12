using CryptoToolkit.Web.Models;
using Microsoft.AspNetCore.Mvc;

namespace CryptoToolkit.Web.Controllers;

// Friendly error pages. Details stay in the log; the user never sees a
// stack trace.
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
public class ErrorController : Controller
{
    [Route("Error/{code:int?}")]
    public IActionResult Index(int? code) =>
        View("~/Views/Shared/Error.cshtml", new ErrorViewModel(code ?? 500));
}

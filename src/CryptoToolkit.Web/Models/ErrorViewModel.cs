namespace CryptoToolkit.Web.Models;

// Data for the error page. Only a few codes have their own text; every other
// code shows the general message.
public record ErrorViewModel(int StatusCode)
{
    private bool HasOwnTitle => StatusCode is 403 or 404 or 429;
    private bool HasOwnText => StatusCode is 404 or 429;

    public string TitleKey => HasOwnTitle ? $"error.{StatusCode}.title" : "error.title";
    public string TextKey => HasOwnText ? $"error.{StatusCode}.text" : "error.text";
}

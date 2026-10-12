# Crypto Toolkit

**English** | [Türkçe](README.tr.md)

A cryptography toolkit that runs in your browser: encrypt text and files with a password, generate RSA keys and encrypt for someone else, sign and verify data, and check hashes. Every operation uses the browser's built-in Web Crypto API, so your text, files and private keys never leave your device. The server only delivers the pages, and the page's security policy stops it from sending anything back.

**Live demo:** [crypto.miracdeprem.com](https://crypto.miracdeprem.com). The site runs on a free server, so the first page can take about half a minute after a quiet period.

![Home page in the dark theme: headline, "runs locally" badge and the four tools](docs/screenshot-home.png)

It started as my final project for the *Information Security and Cryptography* course (Computer Engineering, 3rd year). That first version encrypted on the server with an AES key and IV written into the code; this one is a rewrite with modern, authenticated algorithms in the browser.

## Features

**Password encryption** (text and files)
- AES-256-GCM with a key derived from the password by PBKDF2-SHA256 (600,000 iterations)
- A fresh random salt and IV every time, so the same text never gives the same output
- One self-describing Base64 package; changing any byte of it, including the header, makes decryption fail
- Password confirmation and a strength hint when encrypting; files up to 100 MB, saved as `.enc`

**RSA and hybrid encryption**
- Generate 2048, 3072 or 4096-bit RSA-OAEP key pairs; copy or download them as PEM
- Encrypt for any public key: the data is encrypted with AES-GCM and only the AES key is wrapped with RSA
- Key fingerprints (SHA-256) to compare keys out of band

**Digital signatures**
- ECDSA P-256 key pairs; sign text or files, download the signature as `.sig`
- Verification with a clear valid / not valid result, the signed digest and the key fingerprint

**Hash and HMAC**
- SHA-256 and SHA-512 of text or files at once, and HMAC-SHA-256 / SHA-512 with a secret key
- Paste a published hash in any common notation to check a download; the comparison runs in constant time

**Everywhere**
- A "How it works" panel on every tool, with the byte layout of the packages
- Clear error messages ("the password is wrong or the package was modified") instead of exceptions
- Turkish and English interface, dark "lab bench" theme and a light theme, works on phones

## Screenshots

| | |
|---|---|
| ![Password encryption with the encrypted package and its salt, IV and iteration count](docs/screenshot-encrypt.png) | ![RSA hybrid encryption with a 2048-bit key, its fingerprint and the wrapped AES key](docs/screenshot-rsa.png) |
| ![A verified ECDSA signature with the signed SHA-256 digest](docs/screenshot-sign.png) | ![SHA-256 and SHA-512 of a text, matched against a published hash](docs/screenshot-hash.png) |
| ![The "How it works" panel with the byte layout of a package](docs/screenshot-how.png) | ![Home page in Turkish with the light theme](docs/screenshot-home-light.png) |

<p align="center"><img src="docs/screenshot-mobile.png" width="300" alt="Home page on a phone"></p>

## Tech Stack

- **Web Crypto API** (`crypto.subtle`) for AES-GCM, PBKDF2, RSA-OAEP, ECDSA, SHA-2 and HMAC
- **Plain JavaScript modules**, no framework and no build step; tested with **`node --test`**
- **C# / ASP.NET Core MVC** as the page shell: Razor views, Turkish and English texts, security headers, rate limiting
- **xUnit** with an in-memory test server
- **Docker** on **Render**

## Installation

Open [crypto.miracdeprem.com](https://crypto.miracdeprem.com), or run it locally. You need the current .NET SDK; Node.js is only needed for the JavaScript tests.

```bash
git clone https://github.com/MrcDprm/crypto-toolkit.git
cd crypto-toolkit
dotnet run --project src/CryptoToolkit.Web
```

Then open `http://localhost:5090`. No database, keys or other settings are needed.

Run the tests with:

```bash
npm test       # cryptography modules (Node.js)
dotnet test    # server: pages, headers, language, texts
```

### Project structure

```
src/CryptoToolkit.Web/
  Controllers/          Home, tool pages, error pages
  Models/               Tool list and error page model
  Infrastructure/       Security headers
  Localization/         JSON-based localizer
  Resources/            Turkish and English texts
  Views/                Razor pages
  wwwroot/js/crypto/    The cryptography: encoding, password, rsa, sign, hash
  wwwroot/js/ui/        Page scripts that connect the forms to the modules
tests/
  js/                   node --test suites for the cryptography modules
  CryptoToolkit.Tests/  xUnit tests for the server
Dockerfile              Container used on Render
render.yaml             Render service definition
```

### Package formats

Encrypted outputs are binary packages, shown as Base64 for text. All integers are big-endian.

| Package | Layout |
|---|---|
| Password (`CTK`) | `"CTK"` · version (1) · iterations (4) · salt (16) · IV (12) · ciphertext + GCM tag (16) |
| Hybrid RSA (`CTH`) | `"CTH"` · version (1) · wrapped key length (2) · wrapped AES key · IV (12) · ciphertext + GCM tag (16) |

Everything before the ciphertext is passed to AES-GCM as additional authenticated data, so the header cannot be changed either. A package's iteration count is only accepted between 100,000 and 10,000,000, so a forged package cannot freeze the page.

### Security

- All cryptography runs in the browser; the server never receives text, files or keys
- Content Security Policy: only this site's own scripts, styles and fonts; `connect-src 'none'` blocks every request the page could send; Trusted Types block HTML injection
- No inline scripts or styles, no third-party code, fonts served from the site itself
- HSTS, `X-Frame-Options: DENY`, `nosniff`, `no-referrer` and a strict Permissions Policy; no CORS
- Rate limiting per IP, a host name allow-list, and friendly error pages without stack traces
- Imported private keys are non-extractable; RSA keys below 2048 bits are refused
- This is a learning project and has not had an independent security audit

## What I Learned

- **What was wrong with my first version.** The course version encrypted on the server with an AES key and IV written in the code. Since the repository is public, anyone could decrypt everything. It used CBC with a fixed IV, so the same text always gave the same output, and nothing detected changes to the ciphertext. Fixing it taught me why a key must come from a secret, why an IV must be new every time, and why encryption needs authentication.
- **Authenticated encryption.** AES-GCM encrypts and also produces a tag that fails if anything changes. I pass the package header as additional data, so even the iteration count and salt are protected. I also learned that a wrong password and a tampered package look exactly the same to GCM, and wrote the error message to say so honestly.
- **Turning a password into a key.** A password is not a key. PBKDF2 with a random salt and many iterations makes guessing slow and makes equal passwords give different keys. Normalising the password to Unicode NFC was a detail I would have missed: "ş" can be typed in two ways that look identical.
- **Why RSA is used together with AES.** RSA can only encrypt a few hundred bytes, so real systems (HTTPS, PGP) encrypt the data with a fresh AES key and wrap only that key with RSA. Building this myself made hybrid encryption, OAEP padding and key fingerprints concrete.
- **Signatures prove origin, not secrecy.** ECDSA signs a SHA-256 digest of the data. A signed message is still readable, and a trailing space breaks the signature. I also learned that Web Crypto returns signatures as `r‖s` while OpenSSL uses DER, and checked my keys and signatures against OpenSSL.
- **Making "your data stays here" enforceable.** Instead of only promising it, the Content Security Policy forbids the page from connecting anywhere, and Trusted Types stop `innerHTML`-style injection. I tested both in a real browser.
- **Testing what the user actually gets.** Known-answer tests from NIST and RFC 4231 prove the output is correct, not just that encrypt and decrypt agree. Server tests found a real bug: when the rate limit was hit, the error page was rate-limited too and users saw an empty page.

## Future Plans

- Password generator and a stronger password strength estimate
- Ed25519 signatures and X25519 key exchange
- Password-protected private key export
- Streaming encryption for files larger than 100 MB

## Credits

- [Geist and Geist Mono](https://github.com/vercel/geist-font) fonts, under the SIL Open Font License

## License

[MIT](LICENSE)

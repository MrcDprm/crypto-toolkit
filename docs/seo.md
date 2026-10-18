# SEO: Crypto Toolkit

Site: https://crypto.miracdeprem.com (Turkish by default, English with `?lang=en`)

Every tool has its own page, so each one can rank for its own search.

## Keywords

| Page | Turkish | English |
|---|---|---|
| Home | online şifreleme araçları, kriptografi araçları, tarayıcıda şifreleme | online cryptography tools, browser encryption tools, Web Crypto API |
| `/encrypt` | AES şifreleme online, parolayla şifreleme, metin şifreleme, dosya şifreleme | AES encryption online, password encryption, encrypt text, encrypt file in browser |
| `/rsa` | RSA şifreleme online, RSA anahtar oluşturma, açık anahtarlı şifreleme | RSA encryption online, RSA key generator, public key encryption |
| `/sign` | dijital imza oluşturma, dijital imza doğrulama, ECDSA | create digital signature, verify digital signature, ECDSA online |
| `/hash` | SHA-256 hesaplama, SHA-256 hash oluşturma, HMAC hesaplama, dosya özeti | SHA-256 hash generator, SHA-512 online, HMAC generator, file checksum |

## Where they are used

- `<title>` and meta description per page (`seo.*.title`, tool summary + "runs in your browser")
- Canonical + `hreflang` (tr, en, x-default) on the five pages; error pages are `noindex`
- Open Graph and Twitter card with `/og-image.png`
- JSON-LD `WebApplication` per page (free, security application)
- `/sitemap.xml` (10 addresses) and `/robots.txt`, GET and HEAD

## Google Search Console

The `miracdeprem.com` domain property covers this subdomain. Submit `https://crypto.miracdeprem.com/sitemap.xml`. The site runs on Render's free plan; if the sitemap shows "blocked by robots.txt", request a recrawl in **Settings → robots.txt** while the site is awake.

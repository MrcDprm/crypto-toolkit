English | [Türkçe](README.tr.md)

# Crypto Toolkit

A browser-based cryptography toolkit: encrypt text and files with a password, generate RSA keys, sign and verify data, and compute hashes. Every operation runs in your browser with the Web Crypto API, so your text, files and private keys never leave your device.

> **Status:** being rewritten. This README is a draft and will be completed when v1.0 is released.

Originally my final project for the *Information Security and Cryptography* course (Computer Engineering, 3rd year, May 2025). The first version did the cryptography on the server with a hard-coded AES key and IV; this rewrite moves it into the browser and uses modern, authenticated algorithms.

## Features

Planned for v1.0:

- **Password encryption (text and files):** AES-256-GCM with a key derived from your password by PBKDF2-SHA256 (600,000 iterations). Output is a single versioned Base64 package (salt + IV + ciphertext).
- **RSA and hybrid encryption:** generate RSA-OAEP key pairs (PEM export), encrypt with a public key; large data is encrypted with AES-GCM and only the AES key is wrapped with RSA.
- **Digital signatures:** sign and verify text or files with ECDSA P-256.
- **Hashing:** SHA-256 / SHA-512 and HMAC for text and files.
- **"How it works" panel** on every tool explaining what happens step by step.
- Turkish / English interface, light and dark theme.
- Strict security headers (CSP without inline scripts), rate limiting, friendly error pages.

## Screenshots

_Coming with v1.0._

## Tech Stack

- ASP.NET Core MVC (C#) as the page shell, served from Docker on Render
- Web Crypto API (`crypto.subtle`) in plain JavaScript modules
- `node --test` for the cryptography modules, xUnit for the server

## Installation

_Coming with v1.0._

## What I Learned

_Coming with v1.0._

## Future Plans

- Password generator and strength meter
- Ed25519 signatures and X25519 key exchange

## License

[MIT](LICENSE)

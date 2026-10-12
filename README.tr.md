[English](README.md) | Türkçe

# Crypto Toolkit

Tarayıcıda çalışan bir kriptografi araç kutusu: metin ve dosyaları parolayla şifreleyin, RSA anahtarları üretin, verileri imzalayıp doğrulayın, özet (hash) hesaplayın. Bütün işlemler Web Crypto API ile tarayıcınızda yapılır; metniniz, dosyalarınız ve özel anahtarlarınız cihazınızdan çıkmaz.

> **Durum:** yeniden yazılıyor. Bu README taslaktır, v1.0 yayınlanınca tamamlanacak.

İlk sürüm, *Bilgi Güvenliği ve Kriptografi* dersinin final projemdi (Bilgisayar Mühendisliği 3. sınıf, Mayıs 2025). O sürüm şifrelemeyi sunucuda, koda gömülü sabit bir AES anahtarı ve IV ile yapıyordu; bu yeni sürüm işlemleri tarayıcıya taşıyor ve modern, kimlik doğrulamalı algoritmalar kullanıyor.

## Özellikler

v1.0 için planlananlar:

- **Parolayla şifreleme (metin ve dosya):** Parolanızdan PBKDF2-SHA256 (600.000 tur) ile türetilen anahtarla AES-256-GCM. Çıktı, sürüm bilgisi içeren tek bir Base64 paket (salt + IV + şifreli veri).
- **RSA ve hibrit şifreleme:** RSA-OAEP anahtar çifti üretme (PEM olarak dışa aktarma), açık anahtarla şifreleme; büyük veri AES-GCM ile şifrelenir, RSA ile sadece AES anahtarı sarılır.
- **Dijital imza:** Metin veya dosyayı ECDSA P-256 ile imzalama ve doğrulama.
- **Özet:** Metin ve dosya için SHA-256 / SHA-512 ve HMAC.
- Her araçta adım adım ne olduğunu anlatan **"Nasıl çalışır?" paneli**.
- Türkçe / İngilizce arayüz, açık ve koyu tema.
- Sıkı güvenlik başlıkları (satır içi script'e izin vermeyen CSP), istek sınırlama, anlaşılır hata sayfaları.

## Ekran Görüntüleri

_v1.0 ile eklenecek._

## Kullanılan Teknolojiler

- Sayfa kabuğu olarak ASP.NET Core MVC (C#), Render'da Docker ile yayında
- Sade JavaScript modüllerinde Web Crypto API (`crypto.subtle`)
- Kriptografi modülleri için `node --test`, sunucu için xUnit

## Kurulum ve Çalıştırma

_v1.0 ile eklenecek._

## Öğrendiklerim

_v1.0 ile eklenecek._

## Gelecek Planları

- Parola üretici ve parola gücü ölçer
- Ed25519 imza ve X25519 anahtar değişimi

## Lisans

[MIT](LICENSE)

# 🪒 Ömer Temel Hair Studio — Kurulum Rehberi

## Toplam süre: ~20 dakika (ücretsiz)

---

## ADIM 1: Supabase Kurulumu (Veritabanı)

1. https://supabase.com adresine git
2. "Start your project" → Google veya e-posta ile ücretsiz kayıt ol
3. "New Project" tıkla:
   - Name: `omer-berber`
   - Database Password: güçlü bir şifre yaz (bir yere not al)
   - Region: `West EU (Ireland)` seç
4. Proje oluşsun (1-2 dk bekle)
5. Sol menüden **SQL Editor** tıkla
6. `supabase-schema.sql` dosyasının içindeki SQL kodunu kopyala, yapıştır, **Run** tıkla
7. Sol menüden **Project Settings > API** tıkla:
   - `Project URL` → kopyala (VITE_SUPABASE_URL)
   - `anon public` key → kopyala (VITE_SUPABASE_ANON_KEY)

---

## ADIM 2: GitHub'a Yükle

1. https://github.com adresine git, ücretsiz hesap aç
2. "New Repository" → isim: `omer-berber` → Create
3. Bilgisayarına GitHub Desktop indir: https://desktop.github.com
4. "Clone" ile repoyu bilgisayarına çek
5. Bu klasördeki tüm dosyaları o klasöre kopyala
6. `.env.example` dosyasını `.env` olarak kopyala ve doldur:
   ```
   VITE_SUPABASE_URL=Adım 1'de kopyaladığın URL
   VITE_SUPABASE_ANON_KEY=Adım 1'de kopyaladığın key
   ```
   ⚠️ `.env` dosyasını GitHub'a yükleme! (gizli kalmalı)
7. GitHub Desktop'ta "Commit" → "Push" yap

---

## ADIM 3: Vercel'e Yayınla

1. https://vercel.com adresine git
2. "Sign up" → GitHub ile giriş yap
3. "New Project" → GitHub'daki `omer-berber` reposunu seç
4. **Environment Variables** bölümüne şunları ekle:
   - `VITE_SUPABASE_URL` = Supabase URL'in
   - `VITE_SUPABASE_ANON_KEY` = Supabase key'in
5. "Deploy" tıkla (2-3 dk bekle)
6. Vercel sana şöyle bir link verir:
   👉 `https://omer-berber.vercel.app`

---

## ADIM 4: Yayına Al!

- Bu linki WhatsApp'ta müşterilere gönder
- Instagram bio'na ekle
- https://qr-code-generator.com adresinden QR kod oluştur, dükkanına as

---

## Güncelleme Yapmak İstersen

GitHub Desktop'ta dosyayı değiştir → Commit → Push
Vercel otomatik güncellenir! ✅

---

## Sorun Olursa

- Supabase SQL'de hata → tabloları sil, SQL'i tekrar çalıştır
- Uygulama açılmıyor → Vercel'de Environment Variables doğru mu kontrol et
- Randevular görünmüyor → Supabase'de RLS policy'ler eklenmiş mi kontrol et

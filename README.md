# 🚀 XRP CVD Tracker - Vercel Deployment Rehberi

## 📦 Projeyi Hazırladık!

Bu klasör Vercel'e deploy edilmeye hazır durumda.

---

## 🎯 VERCEL'E YÜKLEME ADIMLARI

### Adım 1: GitHub Hesabı Oluşturun (Ücretsiz)
1. 🔗 https://github.com adresine gidin
2. "Sign Up" tıklayın
3. Email, kullanıcı adı, şifre ile kayıt olun
4. ✅ Email'inizi doğrulayın

---

### Adım 2: GitHub'a Projeyi Yükleyin

#### Yöntem A: GitHub Desktop ile (Kolay)
1. 🔗 https://desktop.github.com adresinden indirin
2. GitHub hesabınızla giriş yapın
3. "Create a New Repository" tıklayın
   - **Name:** xrp-cvd-tracker
   - **Local Path:** Bu klasörü seçin
4. "Publish repository" tıklayın
5. ✅ Projeniz GitHub'da!

#### Yöntem B: GitHub Web ile (Daha Kolay)
1. 🔗 https://github.com/new adresine gidin
2. Repository adı: **xrp-cvd-tracker**
3. "Create repository" tıklayın
4. "uploading an existing file" linkine tıklayın
5. Bu klasördeki **TÜM dosyaları** sürükleyip bırakın
6. "Commit changes" tıklayın
7. ✅ Projeniz GitHub'da!

---

### Adım 3: Vercel'e Deploy Edin

1. 🔗 https://vercel.com/signup adresine gidin
2. **"Continue with GitHub"** tıklayın
3. GitHub ile giriş yapın ve izin verin
4. Vercel dashboard'unda **"Add New..."** → **"Project"** tıklayın
5. **"Import Git Repository"** bölümünden **xrp-cvd-tracker** projenizi seçin
6. **"Deploy"** butonuna tıklayın
7. ⏳ 2-3 dakika bekleyin...
8. 🎉 **TEBRIKLER!** Siteniz yayında!

---

## 🌐 Sitenizin Linki

Deploy tamamlandıktan sonra size şu formatta bir link verilir:
```
https://xrp-cvd-tracker.vercel.app
```

- ✅ Bu link 7/24 çalışır
- ✅ PC kapalı olsa bile erişilebilir
- ✅ Ücretsiz SSL sertifikası (https)
- ✅ Dünya çapında hızlı CDN
- ✅ Otomatik güncellemeler (GitHub'a push'ladığınızda)

---

## 🔄 Güncelleme Nasıl Yapılır?

GitHub'daki dosyaları düzenlediğinizde Vercel otomatik olarak yeniden deploy eder!

1. GitHub'da dosyayı açın
2. Edit (✏️) butonuna tıklayın
3. Değişiklik yapın
4. "Commit changes" tıklayın
5. ✅ Vercel otomatik günceller (30 saniye içinde)

---

## 💡 İPUCU: Gerçek Veri Eklemek İsterseniz

Şu anda simüle edilmiş veriler kullanılıyor. Gerçek API entegrasyonu için:

1. CoinGecko API (Ücretsiz): https://www.coingecko.com/en/api
2. Binance API: https://binance-docs.github.io/apidocs/
3. CryptoCompare API: https://min-api.cryptocompare.com/

`src/App.js` dosyasındaki `generateRealisticCVD` fonksiyonunu gerçek API çağrıları ile değiştirin.

---

## 🆘 Sorun mu Yaşıyorsunuz?

- Vercel Dashboard'da "Deployments" sekmesinden hata loglarını kontrol edin
- Build başarısız olursa genellikle dependency sorunu vardır
- Vercel otomatik olarak `npm install` ve `npm run build` çalıştırır

---

## 📞 Destek

Herhangi bir sorun yaşarsanız:
- Vercel Docs: https://vercel.com/docs
- GitHub Issues: Repository'nizde issue açın

---

**Başarılar! 🎉**

# Metronome

Expo ve TypeScript ile yazılmış, iOS ve Android için kaymayan (drift-free) bir metronom.

- Vuruşlar JS zamanlayıcısıyla tetiklenmez; ses donanımının örnek hassasiyetindeki saatine
  (`AudioContext.currentTime`) göre önceden planlanır.
- Zamanlayıcı (scheduler), dışarıdan verilen bir saat üzerinde çalışan saf aritmetiktir;
  bu yüzden ses donanımı olmadan Node'da test edilebilir.
- 31 birim testi var; bunlar arasında 300 vuruş boyunca kayma birikmediğini ve JS iş
  parçacığı takıldığında vuruş zamanlarının değişmediğini doğrulayan testler de bulunuyor.

## Ne yapar

- 20–300 BPM aralığında tempo, tempo tekerleği ve tap tempo (dokunarak tempo belirleme)
- 2/4, 3/4, 4/4, 5/4, 6/8, 7/8, 9/8 ve 12/8 ölçüleri; bileşik ölçüler hissedilen vuruşa
  göre sayılır (6/8 = üçlük iki vuruş)
- Dörtlük, sekizlik, triole ve onaltılık bölümler; vurgulu vuruşlar
- Tempo terimleri (Largo, Andante, Allegro vb.)
- Açık/koyu tema, Türkçe ve İngilizce arayüz, titreşim geri bildirimi ve çalışırken
  ekranı açık tutma; ayarlar cihazda saklanır

## Nasıl çalışır

Klasik "lookahead scheduler" yaklaşımı kullanılır: JS tarafında her 25 ms'de bir çalışan bir
döngü, ses saatinin önündeki 100 ms'lik pencereye düşen tıklamaları hesaplar ve bunları ses
motoruna tam zamanlarıyla teslim eder. JS iş parçacığı geç uyansa bile tıklamanın çalınacağı
an ses saatinde zaten belirlenmiş olduğu için ritim kaymaz.

`MetronomeScheduler` React'e ya da native modüllere bağımlı değildir; yalnızca `currentTime`
değeri olan bir saat nesnesi alır. Testler bu saatin yerine elle ilerletilen sahte bir saat
verir.

```
app/                     expo-router ekranları (router default export gerektirir)
  _layout.tsx            Kök yerleşim
  index.tsx              Metronom
  settings.tsx           Görünüm, dil ve davranış ayarları
src/
  audio/       engine.ts — AudioContext'i ve iOS ses oturumunu yönetir
  i18n/        İngilizce ve Türkçe metinler; sözlük yapısı tip denetiminden geçer
  metronome/   patterns, scheduler, clickSynth, tempoTerms, useMetronome
  settings/    kalıcı ayar deposu
  ui/          ortak bileşenler
  theme/       renk paleti, boşluklar, yazı ölçeği
```

## Kurulum

`react-native-audio-api` native bir modül olduğu için uygulama **Expo Go'da çalışmaz**;
bir development build gerekir.

```bash
npm install
npx expo run:ios      # veya: npx expo run:android
```

`npm start` yalnızca bundler'ı başlatır; cihazda önceden kurulmuş bir development build
olmalıdır.

### Proje yolu yalnızca ASCII karakter içermeli

Yolda ASCII dışı karakter varsa `expo prebuild`, `Project file "MainApplication" does not
exist` hatasıyla başarısız olur (Android şablonunu sessizce kopyalamaz). Projeyi `C:\dev\...`
gibi bir yolda tutun; `Masaüstü` gibi Türkçe karakterli klasörlerde değil.

### Windows'ta Gradle için Unix araçları PATH'te olmalı

`react-native-audio-api` hazır derlenmiş dosyaları bir shell betiğiyle indirir. PATH'te
`mkdir`/`rm`/`unzip` yoksa indirme klasörü oluşmaz, curl `error 23` verir ve
`:react-native-audio-api:downloadPrebuiltBinaries` adımı başarısız olur. Derlemeden önce
Git'in araçlarını PATH'in başına ekleyin:

```
C:\Program Files\Git\usr\bin;C:\Program Files\Git\mingw64\bin
```

## Çalıştırma

| Komut | Ne yapar |
|---|---|
| `npm start` | Bundler'ı başlatır (`expo start`) |
| `npm run ios` / `npm run android` | Development build'i derleyip başlatır |
| `npm test` | Birim testleri (Jest) |
| `npm run typecheck` | `tsc --noEmit` |

### Emülatörde çalıştırma

Varsayılan debug derlemesi **yalnızca arm64-v8a** üretir; x86_64 emülatöre kurulur ama
açılır açılmaz `SoLoaderDSONotFoundError: couldn't find DSO to load: libreactnative.so`
hatasıyla kapanır. `android/` klasörü üretilen bir klasördür (git'te yoktur); önce
`npx expo run:android` ya da `npx expo prebuild` ile oluşturulmalıdır. Ardından iki
mimariyi birlikte derleyin:

```bash
cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a,x86_64
adb -s emulator-5554 install --abi x86_64 -r -d app/build/outputs/apk/debug/app-debug.apk
```

APK birden fazla mimari içerdiğinde `--abi x86_64` zorunludur. Sistem imajları arm kodunu
çevirebildiği için yükleyici `lib/arm64-v8a` klasörünü x86_64 emülatöre çıkarabilir ve
uygulama aynı hatayla kapanır; hata mesajındaki ABI, eksik olan değil çıkarılmış olandır.

### Windows'ta adb release APK'yı kilitli tutar

`adb install` sonrasında adb sunucusu `app-release.apk` üzerinde açık bir tutamaç bırakır.
Sonraki `assembleRelease`, `:app:packageRelease` adımında `Unable to delete directory`
hatası verir. `adb kill-server` dosyayı serbest bırakır; ancak cihaz bağlantısı düşer ve
USB hata ayıklama izni yeniden istenebilir.

### Ses çalmayı test etmek

Metronom başladığında Android'de ses odağını alır ve aynı cihazda çalan diğer sesleri
(test sinyalleri dahil) durdurur. Test sinyali ayrı bir cihazdan verilmelidir.

## Testler

```bash
npm test
```

Testler cihaz gerektirmez ve Node'da çalışır. Toplam 31 test, iki dosyada:

- `src/metronome/scheduler.test.ts` (14 test): vuruş aralığının tam olarak 60/BPM saniye
  olması, 300 vuruşta kayma birikmemesi, düzensiz ve gecikmeli JS uyanmalarında vuruş
  zamanlarının değişmemesi, 100 ms'lik planlama penceresinin aşılmaması, ölçü ve bölüm
  yapısı, vurgular, tempo ve ölçü değişiklikleri, durdurup yeniden başlatma.
- `src/metronome/patterns.test.ts` (17 test): ölçü ve bölüm tanımları, ölçü aritmetiği,
  vuruş sınıflandırma, BPM sınırlama, tap tempo (medyanla hatalı dokunuşu yok sayma) ve
  tempo terimleri.

## Lisans

MIT. Ayrıntılar için `LICENSE` dosyasına bakın.

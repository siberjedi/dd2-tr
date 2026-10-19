# Kurulum ve Derleme Rehberi

## 1. Oyuncular için (hazır paket)

### Gereksinimler
- Dragon's Dogma 2, Steam sürümü **4.1.0 (build 25920212)**
- [REFramework nightly](https://github.com/praydog/REFramework-nightly) — **01421 veya üzeri** (yeni `pak_mods` yükleme sistemi için)
- `DD2TR.pak`

### Adımlar

> Hazır paket: https://www.nexusmods.com/dragonsdogma2/mods/1988

1. REFramework zip'ini indir; içindeki `dinput8.dll` dosyasını oyunun kurulu olduğu klasöre çıkar
   (`...\steamapps\common\Dragons Dogma 2\`)
2. Aynı klasörde yoksa `pak_mods` adında bir klasör oluştur
3. `DD2TR.pak` dosyasını `pak_mods` klasörüne kopyala
4. Oyunu başlat

Oyun açılırken REFramework penceresi görünürse kapatabilirsiniz (normal).

### Kaldırma
- `pak_mods\DD2TR.pak` dosyasını silin.
- REFramework'ü de kaldırmak isterseniz `dinput8.dll` dosyasını silin.

### Notlar
- Yama yalnızca **tek oyunculu** kullanım içindir.
- Oyun güncellemesi geldiğinde metin dosyası kimlikleri değişebilir; yama etkisiz kalabilir.
- Paketteki tüm metin dosyaları (876/876) çevrildi; eski listedeki 198 yol güncel oyunda bulunmuyor.

## 2. Geliştiriciler için (sıfırdan derleme)

### Gereksinimler
| Araç | Sürüm | Kaynak |
|---|---|---|
| REtool | v0.241+ | https://fluffyquack.com/tools/REtool.rar |
| REMSG_Converter | 2.0.1 (python embedded) | https://github.com/dtlnor/REMSG_Converter/releases |
| Natives Renamer (`dd2.list`) | Ekim 2026 | https://www.nexusmods.com/dragonsdogma2/mods/1572 |
| Node.js | 20+ | https://nodejs.org |
| REFramework nightly | ≥ 01421 | https://github.com/praydog/REFramework-nightly |

### 1) Mesaj dosyalarını çıkar

```powershell
pwsh tools/extract_msg.ps1 `
  -GameDir "C:\Program Files (x86)\Steam\steamapps\common\Dragons Dogma 2" `
  -RETool  "C:\tools\REtool" `
  -FileList "C:\tools\dd2.list" `
  -OutDir  "staging"
```

Bu adım `dd2.list` içinden yalnızca `.msg.24` satırlarını seçer ve 65 GB'lık `re_chunk_000.pak` içinden sadece bu dosyaları çıkarır (yaklaşık 70 MB).

### 2) MSG -> TXT

REMSG_Converter klasöründe:

```powershell
.\python\python.exe .\src\main.py -i "C:\...\staging\re_chunk_000" -m txt -l en -x 8
```

Her `.msg.24` dosyasının yanında `*.msg.24.txt` oluşur. Satır biçimi: `<string>metin` (referanslar `<string><REF ...>`).

### 3) Çeviri

```powershell
$env:OPENCODE_API_KEY = "anahtar"
node tools/translate.mjs --input staging/re_chunk_000 --cache work/cache.jsonl --concurrency 6 --nothink
```

- Önbellek (`cache.jsonl`) sayesinde kesintiden sonra kaldığı yerden devam eder.
- `data/translations.jsonl` dosyasını `work/cache.jsonl` olarak kopyalayıp mevcut çevirileri yeniden kullanabilirsiniz.
- Hatalı satırlar `work/failed.jsonl` dosyasına yazılır; `node tools/retry_failed.mjs --input staging/re_chunk_000 --cache work/cache.jsonl` ile onarılır.

### 4) TXT -> MSG ve PAK

```powershell
pwsh tools/build_pak.ps1 `
  -NativesRoot "C:\...\staging\re_chunk_000" `
  -REMSG "C:\...\REMSG_Converter" `
  -RETool "C:\...\REtool" `
  -OutDir "."
```

Çıktı: `DD2TR.pak`. Dosyayı oyun klasöründeki `pak_mods` içine kopyalayın.

## 3. Sorun giderme

- **Oyun açılmıyor / siyah ekran:** `pak_mods` içindeki pakı geçici olarak kaldırın; sorun devam ederse REFramework sürümünü güncelleyin.
- **Metinler İngilizce:** REFramework'ün 01421+ olduğundan ve pakın `pak_mods` içinde olduğundan emin olun.
- **Tam ekran çalışmıyor:** Oyun ayarlarından `Görüntü Modu`nu Pencere -> Tam Ekran olarak iki kez değiştirin; ikinci bir ekran bağlıysa `Win+P` ile tek ekrana geçip deneyin.

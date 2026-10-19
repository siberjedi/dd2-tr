# Ekran Görüntüleri

Kareler (PNG; v1.0 çekimleri 1280x720):

| Dosya | İçerik |
|---|---|
| `01-main.png` | Ana menü (Türkçe butonlar) |
| `02-settings.png` | Seçenekler > Görüntü ekranı |
| `03-dialogue.png` | NPC diyalogu (Türkçe altyazı + "Sonraki" istemi) |

İsteğe bağlı: `04-item.png` (envanterde eşya açıklaması).

## Çekim

Repo kökünden:

```powershell
pwsh tools/screenshot.ps1 -Name 01-menu -Delay 5
```

Komutu çalıştırın, 5 saniye içinde oyuna geçin; görüntü `screenshots/` klasörüne kaydedilir.

## İpuçları

- Oyunu **tam ekran** oynatın; masaüstü öğeleri kareye girmesin
- HUD'u sade tutun; mümkünse diyalog/altyazı görünen kare seçin
- Nexus'a yüklerken aynı dosyaları kullanabilirsiniz

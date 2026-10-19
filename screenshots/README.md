# Ekran Görüntüleri

Önerilen kareler (1920x1080, PNG):

| Dosya | İçerik |
|---|---|
| `01-menu.png` | Ana menü (Türkçe butonlar: "Oyunu Başlat", "Yeni Oyun", "Seçenekler") |
| `02-options.png` | Seçenekler > Görüntü ekranı |
| `03-dialogue.png` | Oyun içi NPC diyalogu / altyazı |
| `04-item.png` | Envanterde eşya açıklaması |

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

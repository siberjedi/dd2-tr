# Çeviri Verisi

`translations.jsonl` — satır başına bir kayıt (JSONL):

```json
{"s":"Good day, ser.","d":"İyi günler, efendim."}
```

- `s`: oyundaki özgün İngilizce metin (tam eşleşme)
- `d`: Türkçe karşılığı
- Özdeş kayıtlar (`s === d`) dahil edilmemiştir
- Her satır tek satırdır; özel karakterler JSON escape'i ile yazılır
- `<lf>` oyunun satır kırma etiketidir — çeviride **sayısı korunmalıdır**
- v1.0: 39.479 kayıt

Kullanım: derleme sırasında bu dosyayı `work/cache.jsonl` olarak kopyalayın; `tools/translate.mjs` önbellek olarak okur ve yalnızca eksik dizeleri çevirir.

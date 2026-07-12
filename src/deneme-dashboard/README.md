# Deneme Dashboard

Bu klasör ana şantiye takip uygulamasından izole bir hakediş deneme ortamıdır.

- Rota: `/deneme-dashboard`
- Yerel veri anahtarı: `tugay-deneme-hakedis-v1`
- Excel kaynakları: `BİNALAR` ve `HAKEDİŞ DENEMESİ`
- `legacy/` klasörü, deneme başlamadan önceki çalışan `App`, harita, veri, tip ve stil dosyalarının salt kopyasıdır.
- Ana uygulamanın `tugay-santiye-*` yerel kayıtlarına bu uygulamadan erişilmez.

Deneme iptal edilirse `src/deneme-dashboard` klasörü ve `src/main.jsx` içindeki `/deneme-dashboard` yönlendirmesi kaldırılabilir.

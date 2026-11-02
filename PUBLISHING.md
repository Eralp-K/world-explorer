# Kendi GitHub deposunda paylaşım

BlueMap'in MIT lisansı değiştirmeye, farklı bir adla dağıtmaya ve kendi GitHub deposunda yayımlamaya izin verir. BlueMap kodu veya ikilileri dağıtılıyorsa telif ve MIT izin metni korunmalıdır. `NOTICE.md` ve `licenses/BlueMap.txt` bu ilişkiyi belgeler. README'de “Powered by BlueMap” bağlantısını korumak şeffaf bir atıftır; bu ifade MIT'nin zorunlu kıldığı özel bir reklam cümlesi değildir.

Bu sürüm BlueMap motorunu kullanan ayrı bir yerel uygulamadır. Yeni ad, arayüz ve uygulama özellikleri sana ait bir proje olarak sunulabilir; BlueMap motorunun tamamını bizim yazdığımız veya resmî BlueMap/Minecraft ürünü olduğu izlenimi verilmemelidir. Uygulamanın kendi kodu için ayrıca bir lisans seçilmelidir. Projeye henüz bir lisans atanmadı.

## Kaynak deposunu hazırlama

1. Yeni proje adını ve kendi kodunun lisansını seç; README ve package.json bilgisini güncelle.
2. `backend/`, `web/`, `scripts/`, `tests/`, başlatıcı, `package.json`, `local.config.example.json`, README, NOTICE, bu kılavuz ve `licenses/` kaynaklarını gözden geçir.
3. `cache/`, `state/`, `local.config.json`, kişisel dünya/ZIP/region dosyaları, render çıktıları, Minecraft client JAR'ı, oyun dokuları ve kişisel doğrulama raporlarını yayımlama. Yerel yedek ZIP'i GitHub yayını olarak yükleme.
4. `.gitignore`, yerel çalışma verilerini, `vendor/` ve inceleme amaçlı `upstream-web/` kopyasını hariç tutar. Daha önce takip edilmiş dosyalar varsa `.gitignore` onları otomatik olarak geçmişten kaldırmaz. Commit içeriğini ayrıca kontrol et.
5. `README.md` içindeki bu bilgisayara/dünyaya özel kurulum ve doğrulama örneklerini genel kurulum metnine dönüştür. `scripts/check-*.mjs` gibi gerçek dünya doğrulama araçlarını da kişisel yollar/isimler açısından kontrol et.
6. Kaynak dağıtımında kullanıcı resmî BlueMap 5.29 kurulumunu edinip `node scripts/setup.mjs "BLUEMAP_KLASORU"` çalıştırabilir. BlueMap JAR/web paketini ayrıca dağıtmak istersen paketlenmiş bağımlılıkların lisans ve bildirimlerini de koru; tam bağımlılık denetimi henüz yapılmadı.
7. Minecraft dosyaları, marka ve varlıkları için güncel Minecraft Usage Guidelines/EULA koşullarını ayrıca kontrol et: https://www.minecraft.net/en-us/usage-guidelines

Resmî lisans: https://github.com/BlueMap-Minecraft/BlueMap/blob/master/LICENSE

Bu hazırlık GitHub'a yükleme veya yayımlama yapmaz.

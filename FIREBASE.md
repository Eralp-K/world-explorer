# Firebase ile web sürümü

Firebase ile yayımlamak mümkün. **Mevcut yerel uygulama henüz bulutta çalışan çok kullanıcılı bir servis değildir.** Bu belge uygulama için önerilen mimaridir; Firebase projesi oluşturulmadı, faturalandırma etkinleştirilmedi veya dağıtım yapılmadı.

## İki kullanım şekli

**Hazır harita paylaşımı:** Dünya yerelde render edilir; yayımlanması seçilen geometri ve gerekli etkileşim verileri dışa aktarılır. Görüntüleyici Firebase Hosting/CDN üzerinden sunulabilir. Böylece ziyaretçinin bilgisayarında Minecraft veya Java çalışmaz. Mevcut uygulamanın `/api/world`, arama, sandık ve entity API'leri için ayrıca salt okunur bir veri servisi ya da önceden hazırlanmış veri formatı gerekir. Şu an yalnızca `web/` klasörünü Hosting'e koymak bu özellikleri çalıştırmaz.

**Herkesin kendi dünyasını yüklemesi:** Web arayüzü Firebase Hosting'de; oturumlar Firebase Authentication'da; ZIP ve render çıktıları Cloud Storage'da; iş durumu Firestore'da tutulabilir. Node API isteği doğrular, iş kaydı açar ve bir Cloud Run Job başlatır. Java/BlueMap ve indeksleyici bu işte çalışır; çıktı depoya yazılır. Görüntüleyici yalnızca yetkili olduğu dünyanın çıktılarını okur. Bu, uzun render işini tarayıcıya bağlı tek HTTP isteği içinde tutmamak için önerilen tasarımdır.

## Mevcut uygulamada değişmesi gerekenler

- Windows klasör seçicisi ve yerel dosya yolu yerine tarayıcı dosya yükleme akışı.
- Global `world`, `currentCache`, `renderer`, SQLite bağlantısı ve son dünyalar yerine kullanıcı/dünya/iş kimliğiyle ayrılmış veri ve çalışma alanları.
- Loopback Host/Origin kontrolünü kaldırmakla yetinmeden gerçek kimlik doğrulama, dünya sahipliği ve her veri/çıktı isteğinde yetkilendirme.
- ZIP doğrulama ve güvenli çıkarma kurallarını koruyarak yükleme boyutu, açılmış boyut, iş süresi ve eşzamanlı iş sınırları.
- Java/Node içeren iş imajı, kalıcı depolama, yeniden başlatılabilir iş durumu ve iptal akışı. Mevcut yerel cache bulutta kalıcı veri kaynağı sayılmamalı.
- Oyun dosyaları ve varlıklarının bulutta kullanımı/dağıtımı için Minecraft koşulları; BlueMap ve paket bağımlılıklarının bildirimleri ayrıca değerlendirilmeli.
- Hosting'de statik arayüz; API yönlendirmeleri Cloud Run servisine. Uzun süren renderlar servis isteğinden ayrı işler olmalı.

Hazır harita yayını için dışa aktarılacak dünya ve görünür veriler seçilmeli. Yükleme servisi için Firebase proje kimliği, erişim modeli ve kullanım/iş sınırları belirlenmeli. Bulut işlem, depolama ve trafik maliyeti olabilir; tamamen ücretsiz çalışma sözü verilmez.

Firebase'in resmî Hosting + Cloud Run kılavuzu, Cloud Run kullanımı için bağlı bir Cloud Billing hesabı istediğini ve Spark projesinin bu bağlantıyla Blaze planına geçtiğini belirtir. Hosting üzerinden yönlendirilen dinamik istekler için 60 saniyelik zaman aşımı vardır; renderı kısa bir iş-başlatma isteğinden ayırmak bu nedenle de gereklidir.

## Resmî kaynaklar

- Firebase Hosting: https://firebase.google.com/docs/hosting
- Hosting + Cloud Run: https://firebase.google.com/docs/hosting/cloud-run
- Cloud Run Jobs: https://docs.cloud.google.com/run/docs/create-jobs
- İş zaman aşımı: https://docs.cloud.google.com/run/docs/configuring/task-timeout

Bu yerel paketin kökünü veya yedek ZIP'ini Firebase public klasörü yapma. Yerel yollar, son dünyalar, kaynak saveler ve özel yapılandırma web içeriği değildir.

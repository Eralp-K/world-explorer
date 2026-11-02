import {LOCALES} from './app/i18n.js?v=langs11';
import {siteExtra,copiedExtra} from './site-translations-extra.js';
export const SITE_LOCALES=LOCALES;
export const siteRows={
start:['Keşfe başla','Start exploring','探索を始める','开始探索','탐험 시작','Начать исследование'],
startSub:['Dünyan kendi bilgisayarında açılır.','Your world opens on your own computer.','ワールドは自分のパソコンで開きます。','世界在你自己的电脑上打开。','월드는 내 컴퓨터에서 열립니다.','Мир открывается на вашем компьютере.'],
open:['Yerel uygulamayı aç','Open the local app','ローカルアプリを開く','打开本地应用','로컬 앱 열기','Открыть локальное приложение'],
openSub:['Kurulumunu başlattıktan sonra','After starting your local installation','ローカルアプリの起動後','先启动本地应用','로컬 앱을 실행한 후','После запуска приложения'],
download:['Kaynak ZIP’ini indir','Download source ZIP','ソースZIPをダウンロード','下载源码 ZIP','소스 ZIP 다운로드','Скачать исходники ZIP'],
explanation:['Bu GitHub Pages sayfası başlangıç noktasıdır. Dünya klasörü ve ZIP seçimi, bilgisayarında çalışan uygulamada yapılır.','This GitHub Pages site is the starting point. Select a world folder or ZIP in the app running on your computer.','このGitHub Pagesサイトは開始ページです。ワールドフォルダーやZIPはパソコン上のアプリで選択します。','此 GitHub Pages 网站是起始页面。请在电脑上运行的应用中选择世界文件夹或 ZIP。','이 GitHub Pages 사이트는 시작 페이지입니다. 월드 폴더나 ZIP은 컴퓨터에서 실행 중인 앱에서 선택하세요.','Этот сайт GitHub Pages — стартовая страница. Выбирайте папку мира или ZIP в приложении на своём компьютере.'],
address:['YEREL UYGULAMA ADRESİ','LOCAL APPLICATION ADDRESS','ローカルアプリのアドレス','本地应用地址','로컬 앱 주소','АДРЕС ЛОКАЛЬНОГО ПРИЛОЖЕНИЯ'],
localNote:['Önce START_WORLD_EXPLORER.bat dosyasını başlat. Save dosyan bu siteye yüklenmez.','Start START_WORLD_EXPLORER.bat first. Your save is not uploaded to this site.','先にSTART_WORLD_EXPLORER.batを起動してください。セーブデータはこのサイトにアップロードされません。','请先运行 START_WORLD_EXPLORER.bat。存档不会上传到此网站。','먼저 START_WORLD_EXPLORER.bat를 실행하세요. 저장 파일은 이 사이트에 업로드되지 않습니다.','Сначала запустите START_WORLD_EXPLORER.bat. Сохранение не загружается на этот сайт.'],
setup:['Yerel kurulumu hazırla','Set up the local app','ローカルアプリの準備','设置本地应用','로컬 앱 설치 준비','Настройка приложения'],
setupIntro:['İlk kullanımda Node.js 24+, uyumlu Java ve hazırlanmış BlueMap 5.29 CLI kurulumu gerekir.','First-time setup requires Node.js 24+, compatible Java and an initialized BlueMap 5.29 CLI installation.','初回はNode.js 24以降、対応するJava、初期設定済みのBlueMap 5.29 CLIが必要です。','首次设置需要 Node.js 24+、兼容的 Java 和已初始化的 BlueMap 5.29 CLI。','처음 설정할 때 Node.js 24 이상, 호환 Java, 초기화된 BlueMap 5.29 CLI가 필요합니다.','Для установки нужны Node.js 24+, совместимая Java и настроенный BlueMap 5.29 CLI.'],
step1:['ZIP’i indir ve bir klasöre çıkar.','Download the ZIP and extract it to a folder.','ZIPをダウンロードしてフォルダーに展開します。','下载 ZIP 并解压到文件夹。','ZIP을 다운로드하고 폴더에 압축을 푸세요.','Скачайте ZIP и распакуйте в папку.'],
requirements:['Gereksinimleri ve ayrıntılı kurulumu oku ↗','Read requirements and full setup instructions ↗','動作要件と詳しい手順 ↗','阅读要求和详细安装说明 ↗','요구 사항 및 자세한 설치 안내 ↗','Требования и инструкция по установке ↗'],
step2:['Uygulama klasöründe kendi BlueMap yolunla çalıştır:','In the application folder, run with your own BlueMap path:','アプリのフォルダーで、自分のBlueMapのパスを指定して実行：','在应用文件夹中，使用自己的 BlueMap 路径运行：','앱 폴더에서 내 BlueMap 경로로 실행하세요:','В папке приложения выполните команду со своим путём к BlueMap:'],
copy:['Kopyala','Copy','コピー','复制','복사','Копировать'],
step3:['START_WORLD_EXPLORER.bat dosyasını aç.','Open START_WORLD_EXPLORER.bat.','START_WORLD_EXPLORER.batを開きます。','打开 START_WORLD_EXPLORER.bat。','START_WORLD_EXPLORER.bat를 여세요.','Запустите START_WORLD_EXPLORER.bat.'],
step3Sub:['Yerel uygulamada dünya klasörünü veya ZIP yedeğini seç. Daha hızlı başlamak için 2.000 blok çap ve 8–12 chunk deneyebilirsin.','Choose a world folder or ZIP backup in the local app. For a faster start, try a 2,000-block diameter and 8–12 chunks.','ローカルアプリでワールドフォルダーかZIPを選択します。最初は直径2,000ブロック、8～12チャンクをお試しください。','在本地应用中选择世界文件夹或 ZIP 备份。建议先尝试 2,000 方块直径和 8–12 区块。','로컬 앱에서 월드 폴더나 ZIP 백업을 선택하세요. 빠른 시작을 위해 지름 2,000블록과 8~12청크를 시도하세요.','Выберите папку мира или ZIP в приложении. Для быстрого старта попробуйте диаметр 2 000 блоков и 8–12 чанков.'],
betaNote:['Bu beta bir kaynak paketidir; tek tık kurulum paketi değildir. Render her kullanıcının kendi bilgisayarında hazırlanır.','This beta is a source package, not a one-click installer. Maps are prepared on each user’s own computer.','このベータ版はソースパッケージです。ワンクリックインストーラーではありません。マップは各自のパソコンで生成します。','此测试版是源码包，并非一键安装程序。地图在每位用户自己的电脑上生成。','이 베타는 소스 패키지이며 원클릭 설치 프로그램이 아닙니다. 지도는 각 사용자의 컴퓨터에서 생성됩니다.','Это бета-пакет исходников, а не установщик в один клик. Карты создаются на компьютере пользователя.'],
recent:['Son dünyalar','Recent worlds','最近のワールド','最近的世界','최근 월드','Недавние миры'],
recentsTitle:['Dünyaların bilgisayarında','Your worlds are on your computer','ワールドはパソコンにあります','世界保存在你的电脑上','월드는 내 컴퓨터에 있습니다','Ваши миры на вашем компьютере'],
recentsSub:['Son dünyalarını görmek ve açmak için yerel uygulamaya geç.','Open the local app to see and access your recent worlds.','最近のワールドを表示するにはローカルアプリを開いてください。','打开本地应用以查看并打开最近的世界。','최근 월드를 확인하고 열려면 로컬 앱으로 이동하세요.','Откройте локальное приложение для просмотра недавних миров.'],
safe:['Dünyana yazılmaz. Render ve indeks verileri ayrı tutulur.','Your world is not modified. Maps and indexes are stored separately.','ワールドには書き込みません。マップと索引は別に保存されます。','不会修改世界。地图与索引单独保存。','월드는 수정되지 않습니다. 지도와 색인은 별도로 저장됩니다.','Мир не изменяется. Карты и индексы хранятся отдельно.'],
footer:['Bağımsız Minecraft Java aracı · Eralp-K','Independent Minecraft Java tool · Eralp-K','独立したMinecraft Javaツール · Eralp-K','独立 Minecraft Java 工具 · Eralp-K','독립 Minecraft Java 도구 · Eralp-K','Независимый инструмент Minecraft Java · Eralp-K']
};

for(const [key,values] of Object.entries(siteRows))values.push(...(siteExtra[key]||[]));
export const copyMessages=['Komut kopyalandı.','Command copied.','コピーしました。','已复制。','복사되었습니다.','Команда скопирована.',...copiedExtra];

<p align="center"><img src="web/brand/world-explorer-icon.svg" width="96" alt="World Explorer logo"></p>

# World Explorer

Explore Minecraft Java worlds locally in 3D. Powered by [BlueMap](https://github.com/BlueMap-Minecraft/BlueMap), with read-only world inspection and a multilingual interface.

**0.7.1 · Early beta · Windows first**

The GitHub Pages download/setup portal is in `docs/`. It opens the locally running application; it does not run the Java/Node backend in the cloud. Enable it in repository **Settings → Pages → Deploy from a branch → main → /docs → Save**. Its project URL is `https://eralp-k.github.io/world-explorer/` once deployment completes.

Open a world folder or ZIP backup and prepare a browsable map on your own computer. Save files remain untouched; extracted ZIPs, indexes and rendered maps are stored in a separate application cache.

## Features

- Free-flight exploration across Overworld, Nether and End.
- Prepare an area around the latest saved player position, or the whole generated world. No map mod required; spawn is the fallback.
- Search and inspect blocks, containers, signs, written books and raw NBT.
- Adjustable view distance, detail budgets and adaptive rendering settings.
- Lightweight visual profiles, custom World Explorer GLSL effects and clouds.
- Nearby saved creatures for 33 supported vanilla types, with models and textures read from your locally installed client.
- Terra interface with light/dark/system themes and Turkish, English, Japanese, Simplified Chinese, Korean, Russian, German, Spanish, French, Brazilian Portuguese and Polish options.
- Native Windows folder/ZIP selection and recent worlds.

## Requirements

- Windows 10/11. Native file selection and ZIP import use Windows .NET Framework; other platforms are not fully supported.
- [Node.js 24+](https://nodejs.org/) and Java compatible with BlueMap 5.29 and the Minecraft version being read. The included model bridge requires Java 21+; newer Minecraft versions may require newer Java.
- An initialized **BlueMap 5.29 CLI installation**, including `web/assets`, `web/lang`, `config/maps` and `data`. Get it from the [official releases](https://github.com/BlueMap-Minecraft/BlueMap/releases) and follow upstream setup instructions first.
- A WebGL2 browser with hardware acceleration.
- For creature models: the matching Minecraft Java client JAR and an installation containing `versions` and `libraries`. This feature has been validated with client 26.2; other versions and modded clients may fall back to entity markers.

## Install and start

Use **Code → Download ZIP** and extract it, or clone this repository:

```sh
git clone https://github.com/Eralp-K/world-explorer.git
cd world-explorer
node scripts/setup.mjs "C:/Path/To/BlueMap"
node backend/server.mjs
```

Setup copies BlueMap dependencies into `vendor/` and writes your machine-specific `local.config.json`. There are no npm packages to install. After setup, Windows users can launch `START_WORLD_EXPLORER.bat`.

Open **http://127.0.0.1:8101/** if the browser does not open automatically. A custom port is available with `node backend/server.mjs --port 8102`.

If Java or Minecraft is not detected, edit `local.config.json` using `local.config.example.json` as a guide. Set `minecraftInstall` to the folder containing `versions` and `libraries`. Do not share your local configuration.

Choose a folder containing `level.dat`, or open a ZIP backup. Start with a **2,000-block diameter and 8–12 chunks** on slower computers. Prepared area and camera view distance are separate settings. Initial BlueMap preparation can require Internet access to download resources.

## Controls

Click the world to capture the mouse. **W/A/S/D** move, **Space** rises, **Ctrl/C** descends, **Shift** accelerates, and scrolling adjusts flight speed. Left-click to inspect; **Esc** releases the mouse, **F1** toggles the interface and **/** opens search. See the Controls dialog for details. **Main menu** returns to world selection.

## Beta limitations

- Map preparation uses the CPU; interactive browser drawing uses the GPU. Large areas and full-detail 24/32/64-chunk views can be expensive. There is no fixed time or FPS guarantee.
- Creatures have limited idle animation. This is a saved-world viewer: creatures do not walk, spawn or run AI. Equipment, rare variants, modded entities and some version-specific model layers are incomplete.
- Shader import accepts World Explorer `.weshader.json` profiles or the function contract in `web/shaders/terra-example.glsl`. Iris, OptiFine, BSL and Complementary ZIPs are unsupported. Custom shader import still needs broader end-to-end testing.
- Minecraft/mod compatibility, clean installation and translations need wider testing. Evaluate the beta using a world backup.
- GitHub hosts the source. GitHub Pages/Firebase Hosting cannot run this Node/Java backend. A hosted frontend connected to a local companion is not implemented.

## Development

Run `node --test tests/*.test.mjs`. Asset integration checks are skipped without a configured Minecraft client; other tests run without game assets.

The independent model bridge source is `backend/ExportModels.java`. Rebuild its included helper JAR from `backend/` with a JDK:

```sh
javac --release 21 -d build ExportModels.java
jar --create --file entity-models-exporter.jar -C build .
```

Report bugs through [Issues](https://github.com/Eralp-K/world-explorer/issues), including app/Minecraft/browser versions and reproduction steps. Remove private paths and data from logs. Do not upload your world files.

## Attribution and licensing

Independent project by **Eralp-K**; not an official Minecraft, Mojang, Microsoft or BlueMap product. BlueMap is MIT licensed; its notice is retained in `licenses/BlueMap.txt`. Fonts retain their SIL Open Font License notices. See [NOTICE.md](NOTICE.md). Minecraft client code, textures and extracted model data are not included.

No license has yet been assigned to World Explorer's original application code. Public source availability does not itself grant a general redistribution license. Third-party components retain their own licenses.

## Türkçe

Minecraft Java dünyalarını kendi bilgisayarında üç boyutlu gez; sandık, tabela, kitap ve NBT verilerini incele. Klasör veya ZIP yedeği açılabilir. Save dosyalarına yazılmaz; render ve indeksler ayrı önbellekte tutulur.

Bu sürüm **0.7.1 erken beta** sürümüdür. Node.js 24+, uygun Java ve hazırlanmış BlueMap 5.29 CLI kurulumu gerekir. Yukarıdaki komutlardan sonra `START_WORLD_EXPLORER.bat` ile açabilirsin. Arayüzde Türkçe varsayılandır; dil ve tema menüden değişir.

Render her kullanıcının kendi bilgisayarında hazırlanır. Kaynak kodunu GitHub'a koymak uygulamayı çevrim içi çalışan bir siteye dönüştürmez. Düşük performansta 2.000 blok çap ve 8–12 chunk ile başla. Iris/OptiFine shader paketleri ve gerçek dünya simülasyonu desteklenmez.

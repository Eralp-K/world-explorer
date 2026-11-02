# Third-party notices

The native creature model reader uses the user's installed Minecraft client and matching libraries locally. The bundled `ExportModels.java` / `entity-models-exporter.jar` is original reflection/serialization code; Minecraft model geometry, images, client code and extracted caches are not part of the distributed archive. These game assets remain subject to their own licenses and terms.

The Terra interface bundles Literata and Nunito Sans from the Google Fonts project. Their original font files and SIL Open Font License notices are retained in `web/fonts/` and `licenses/literata-OFL.txt`, `licenses/nunitosans-OFL.txt`. Fonts are served locally; the interface does not load a font CDN.

World Explorer uses the rendering engine and web renderer from **BlueMap 5.29**.
Its local server, import workflow, spectator controls and explorer interface are separate application code.

- Upstream: https://github.com/BlueMap-Minecraft/BlueMap
- BlueMap is distributed under the MIT license.
- Copyright (c) Blue <https://www.bluecolored.de>
- Copyright (c) contributors
- The complete BlueMap license is in `licenses/BlueMap.txt` and, after setup, `vendor/LICENSE-BlueMap.txt`. Preserve these notices when distributing upstream code or binaries.
- The top-level LICENSE found in the bundled CLI JAR is Apache 2.0 text, retained separately in `licenses/BlueMap-bundled-LICENSE.txt` and `vendor/LICENSE-bundled.txt`. It is not substituted for BlueMap's own MIT license. This is not an exhaustive inventory of bundled dependencies.

This project is not an official BlueMap or Mojang/Microsoft product. Minecraft names, game files, textures and other assets have their own rights and terms; BlueMap's MIT license does not license those assets. Runtime dependencies may also have their own notices. This notice does not replace their licenses or select a license for this project's original application code.

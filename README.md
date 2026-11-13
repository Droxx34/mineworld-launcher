# Launcher MineWorld

Le launcher du serveur Minecraft **MineWorld** : il installe le jeu, Fabric et le mod MineWorld, les garde à jour,
affiche les actualités et les événements, et emmène le joueur directement sur le serveur.

- Connexion avec le **compte Microsoft** du joueur (il doit posséder Minecraft), puis **compte MineWorld lié** par un
  code donné en jeu (`/mwlien`).
- Fichiers, mod signé et actualités servis par le plugin MineWorld (port 12347).
- Mises à jour du launcher : versions publiées dans ce dépôt (GitHub Releases).

## Origine et licence

Basé sur **[Helios Launcher](https://github.com/dscalzi/HeliosLauncher)** de Daniel D. Scalzi, sous licence MIT
(voir `LICENSE.txt`, conservé tel quel). Les changements propres à MineWorld sont sous la même licence.

## Construire

```
npm ci
npm start          # lancer en développement
npm run dist:win   # fabriquer l'installateur Windows
```

La connexion Microsoft utilise l'application Azure « MineWorld Launcher » (`app/assets/js/ipcconstants.js`).

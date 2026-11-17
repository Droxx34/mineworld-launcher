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

## Politique de signature du code (Code signing policy)

Free code signing provided by [SignPath.io](https://about.signpath.io), certificate by [SignPath Foundation](https://signpath.org).

- **Auteurs et relecteurs (committers and reviewers)** : membres de l'équipe MineWorld ayant accès à ce dépôt
  ([Droxx34](https://github.com/Droxx34)).
- **Approbateurs (approvers)** : [Droxx34](https://github.com/Droxx34). Chaque version signée est approuvée à la main.
- Seul l'installateur Windows fabriqué par GitHub Actions à partir de ce dépôt est signé.

### Confidentialité (privacy policy)

Ce programme n'envoie aucune information à d'autres systèmes en réseau, sauf ce qui est nécessaire à ce que
l'utilisateur lui demande :

- **Microsoft / Xbox / Mojang** : connexion au compte Microsoft du joueur et téléchargement des fichiers du jeu.
- **Serveur MineWorld** (mineworld.me) : liste des fichiers à installer, mod MineWorld, actualités et état du serveur.
- **Modrinth, Fabric et le CDN de Simple Voice Chat** : téléchargement des mods et bibliothèques du jeu.
- **mc-heads.net** : affichage de la tête du personnage du joueur (identifiant public du compte Minecraft).
- **GitHub** : recherche et téléchargement des mises à jour du launcher.

Aucun mot de passe n'est vu ni gardé par le launcher : la connexion se fait sur la page de Microsoft. Le launcher se
désinstalle depuis les paramètres de Windows (Applications installées).

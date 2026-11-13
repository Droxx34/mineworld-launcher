/**
 * (13/11/2026) Réglages propres à MineWorld (launcher basé sur Helios Launcher).
 * ADRESSE : l'adresse que les joueurs tapent pour rejoindre le serveur (à remplir).
 * Le plugin MineWorld sert la liste des fichiers, le mod signé et les actualités sur le port 12347.
 */
exports.ADRESSE = 'A_REMPLIR'
exports.PORT_JEU = 12345
exports.PORT_LAUNCHER = 12347

exports.urlLauncher = function(chemin) {
    return `http://${exports.ADRESSE}:${exports.PORT_LAUNCHER}/launcher/${chemin}`
}

exports.DEPOT = 'Droxx34/mineworld-launcher'

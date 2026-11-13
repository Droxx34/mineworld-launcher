/**
 * (13/11/2026) Réglages propres à MineWorld (launcher basé sur Helios Launcher).
 * ADRESSE : le nom de domaine de MineWorld (il pointe vers le serveur ; à changer seulement là-bas le jour du VPS).
 * Le plugin MineWorld sert la liste des fichiers, le mod signé et les actualités sur le port 12347.
 */
exports.ADRESSE = 'mineworld.me'   // domaine acheté par Jonathan le 13/11/2026
exports.PORT_JEU = 12345
exports.PORT_LAUNCHER = 12347

exports.urlLauncher = function(chemin) {
    return `http://${exports.ADRESSE}:${exports.PORT_LAUNCHER}/launcher/${chemin}`
}

exports.DEPOT = 'Droxx34/mineworld-launcher'

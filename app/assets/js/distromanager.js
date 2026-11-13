const { DistributionAPI } = require('helios-core/common')

const ConfigManager = require('./configmanager')

// (13/11/2026) MineWorld : la liste des fichiers est servie par le plugin du serveur (port 12347)
exports.REMOTE_DISTRO_URL = require('./mineworld').urlLauncher('distribution.json')

const api = new DistributionAPI(
    ConfigManager.getLauncherDirectory(),
    null, // Injected forcefully by the preloader.
    null, // Injected forcefully by the preloader.
    exports.REMOTE_DISTRO_URL,
    false
)

exports.DistroAPI = api
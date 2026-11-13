/**
 * Script for welcome.ejs
 */
document.getElementById('welcomeButton').addEventListener('click', e => {
    // MineWorld : en mode « launcher officiel », pas de connexion ici, on va directement à l'accueil.
    if(ConfigManager.getModeLancement() === 'officiel'){
        switchView(VIEWS.welcome, VIEWS.landing)
        return
    }
    loginOptionsCancelEnabled(false) // False by default, be explicit.
    loginOptionsViewOnLoginSuccess = VIEWS.landing
    loginOptionsViewOnLoginCancel = VIEWS.loginOptions
    switchView(VIEWS.welcome, VIEWS.loginOptions)
})
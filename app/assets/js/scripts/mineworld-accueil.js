/**
 * MineWorld (13/11/2026) : accueil du launcher (maquette v1).
 *
 * - Menu de gauche : Accueil, Actualités, Événements (pages ici) et Paramètres (vue d'origine de Helios).
 * - Bannière : les actualités avec image, qui défilent toutes les 8 secondes.
 * - « Dernières mises à jour » et « À venir » : lus dans actualites.json, publié par le serveur (/mwactu en jeu).
 * - Barre du bas : version du mod lue dans etat.json.
 *
 * Sécurité : tous les textes venus du serveur sont posés avec textContent (jamais de HTML), et les images doivent
 * avoir un nom simple dans le dossier images/ du serveur du launcher.
 */
(function(){
    const MW = require('./assets/js/mineworld')
    const Officiel = require('./assets/js/mineworld-officiel')
    const gotMW = require('got')
    const cheminMW = require('path')
    const fsMW = require('fs')
    const { shell: shellMW } = require('electron')
    const journal = LoggerUtil.getLogger('MineWorld')

    const IMAGE_OK = /^images\/[A-Za-z0-9._-]{1,80}\.(png|jpg|jpeg|webp|gif)$/
    const COULEURS = ['#7DC8FF', '#F2BE4C', '#58D68D', '#E85D80', '#B79CFF']
    const FOND_PAR_DEFAUT = 'assets/images/mineworld/fond.jpg'

    let actus = []
    let majs = []
    let metiers = []
    let filtreActus = 'tout'
    let versionMod = null
    let diapos = []
    let diapo = 0
    let minuteur = null

    /* ───────────── petits outils ───────────── */

    function el(tag, classe, texte){
        const e = document.createElement(tag)
        if(classe) e.className = classe
        if(texte != null) e.textContent = String(texte)
        return e
    }

    function urlImage(x){
        return x != null && typeof x.image === 'string' && IMAGE_OK.test(x.image) ? MW.urlLauncher(x.image) : null
    }

    function texteCourt(s, max){
        s = String(s || '')
        return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s
    }

    function etiquette(x){
        if(x.type === 'evenement'){
            return 'Événement' + (x.quand ? ' · ' + x.quand : '')
        }
        if(x.type === 'police'){
            return 'Police'
        }
        if(x.type === 'maj'){
            return 'Mise à jour'
        }
        return 'Ville'
    }

    function svg(chemin){
        const NS = 'http://www.w3.org/2000/svg'
        const s = document.createElementNS(NS, 'svg')
        s.setAttribute('viewBox', '0 0 24 24')
        s.setAttribute('class', 'mwTrait')
        const p = document.createElementNS(NS, 'path')
        p.setAttribute('d', chemin)
        s.appendChild(p)
        return s
    }

    const ICONES = {
        police: 'M12 3l7 3v5c0 5-3.2 8.2-7 10-3.8-1.8-7-5-7-10V6z',
        maj: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
        info: 'M3.5 11.2L12 4l8.5 7.2M6 9.5V20h12V9.5M10 20v-5h4v5',
        evenement: 'M3.5 5.5h17v15h-17zM3.5 10h17M8 3.5v4M16 3.5v4',
        mairie: 'M4 20h16M6 20V10M18 20V10M10 20V10M14 20V10M3.5 10L12 4l8.5 6',
        transporteur: 'M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.6 1.6 0 1 0 0-.1M17 19a1.6 1.6 0 1 0 0-.1',
        commerce: 'M5 20h14M7 20V9l5-4 5 4v11M10 20v-5h4v5',
        defaut: 'M4 7h16v12H4zM9 7V5h6v2'
    }
    const TEINTES = { police: '#2F8BFF', maj: '#FF9A2E', info: '#1FB86A', evenement: '#A03CFF', mairie: '#A03CFF', transporteur: '#FF9A2E', commerce: '#FFD23F', defaut: '#2FD5FF' }

    function lire(cle){
        try { return window.localStorage.getItem(cle) } catch(e) { return null }
    }

    function ecrire(cle, val){
        try { window.localStorage.setItem(cle, val) } catch(e) { /* rien : simple confort */ }
    }

    /* ───────────── navigation ───────────── */

    function aller(page, idActu){
        for(const b of document.querySelectorAll('#mwMenu .mwNavItem[data-page]')){
            b.toggleAttribute('actif', b.getAttribute('data-page') === page)
        }
        for(const s of document.querySelectorAll('#mwContenu .mwPage')){
            s.hidden = s.id !== 'mwPage_' + page
        }
        const contenu = document.getElementById('mwContenu')
        contenu.scrollTop = 0
        if(page === 'actualites' && actus.length > 0){
            ecrire('mwDerniereActuVue', actus[0].id)
            document.getElementById('mwPastilleActus').hidden = true
        }
        if(idActu){
            const cible = document.querySelector('#mwPage_' + page + ' [data-id="' + CSS.escape(idActu) + '"]')
            if(cible){
                cible.scrollIntoView({ block: 'center' })
                cible.setAttribute('vise', '')
                setTimeout(() => cible.removeAttribute('vise'), 1600)
            }
        }
    }

    window.mwAller = (page) => {
        if(page === 'parametres') afficherParametres()
        if(typeof getCurrentView === 'function' && getCurrentView() !== VIEWS.landing){
            switchView(getCurrentView(), VIEWS.landing, 300, 300, () => aller(page))
        } else {
            aller(page)
        }
    }

    for(const b of document.querySelectorAll('#mwMenu .mwNavItem[data-page]')){
        b.addEventListener('click', () => {
            if(b.getAttribute('data-page') === 'parametres') afficherParametres()
            aller(b.getAttribute('data-page'))
        })
    }
    for(const b of document.querySelectorAll('[data-aller]')){
        b.addEventListener('click', () => aller(b.getAttribute('data-aller')))
    }

    /* ───────────── bannière ───────────── */

    function montrerDiapo(i){
        const img = document.getElementById('mwBanniereImage')
        const badge = document.getElementById('mwBanniereBadge')
        const titre = document.getElementById('mwBanniereTitre')
        const resume = document.getElementById('mwBanniereResume')
        const voir = document.getElementById('mwBanniereVoir')
        const ban = document.getElementById('mwBanniere')

        if(diapos.length === 0){
            img.src = FOND_PAR_DEFAUT
            badge.hidden = true
            titre.textContent = 'Bienvenue sur MineWorld'
            resume.textContent = 'Les événements et les nouveautés du serveur apparaîtront ici.'
            voir.hidden = true
            document.getElementById('mwBannierePoints').replaceChildren()
            return
        }
        diapo = (i + diapos.length) % diapos.length
        const x = diapos[diapo]
        ban.classList.remove('mwEntree')
        void ban.offsetWidth
        ban.classList.add('mwEntree')
        img.src = urlImage(x) || FOND_PAR_DEFAUT
        badge.hidden = false
        badge.textContent = etiquette(x)
        badge.setAttribute('genre', x.type === 'evenement' ? 'evenement' : 'info')
        titre.textContent = texteCourt(x.titre, 80)
        resume.textContent = texteCourt(x.texte, 150)
        voir.hidden = false
        voir.onclick = () => aller(x.type === 'evenement' ? 'evenements' : 'actualites', x.id)
        voir.textContent = x.type === 'evenement' ? 'Voir l\'événement' : 'Lire la suite'

        const points = document.getElementById('mwBannierePoints')
        points.replaceChildren()
        if(diapos.length > 1){
            diapos.forEach((_, k) => {
                const p = el('button', 'mwPoint')
                p.toggleAttribute('actif', k === diapo)
                p.title = 'Voir ' + (k + 1)
                p.onclick = () => { montrerDiapo(k); relancerMinuteur() }
                points.appendChild(p)
            })
        }
    }

    function relancerMinuteur(){
        if(minuteur != null) clearInterval(minuteur)
        minuteur = diapos.length > 1 ? setInterval(() => montrerDiapo(diapo + 1), 8000) : null
    }

    document.getElementById('mwBanniereImage').addEventListener('error', function(){
        if(!this.src.endsWith(FOND_PAR_DEFAUT)) this.src = FOND_PAR_DEFAUT
    })

    /* ───────────── listes ───────────── */

    function vignette(x, classe){
        const v = el('div', classe)
        const src = urlImage(x)
        if(src){
            const img = el('img')
            img.alt = ''
            img.draggable = false
            img.src = src
            img.onerror = () => { img.remove(); v.setAttribute('vide', '') }
            v.appendChild(img)
        } else {
            v.setAttribute('vide', '')
            v.style.background = 'linear-gradient(135deg,' + (TEINTES[x.type] || TEINTES.defaut) + ', #1A1036)'
            v.appendChild(svg(ICONES[x.type] || ICONES.defaut))
        }
        return v
    }

    /** Ligne de la liste des actualités (vignette, catégorie, titre, date). */
    function ligneActu(x, nouveau){
        const a = el('article', 'mwLigne')
        a.setAttribute('data-id', x.id || '')
        if(nouveau) a.setAttribute('nouveau', '')
        a.appendChild(vignette(x, 'mwVignette'))
        const t = el('div', 'mwLigneTexte')
        const tag = el('span', 'mwTag', etiquette(x).toUpperCase())
        tag.style.color = TEINTES[x.type] || TEINTES.defaut
        t.appendChild(tag)
        t.appendChild(el('span', 'mwLigneTitre', x.titre))
        t.appendChild(el('span', 'mwLigneResume', x.texte))
        const bas = [x.version, x.type === 'police' && x.quand ? 'Prime ' + x.quand : null, x.date].filter(Boolean).join(' · ')
        if(bas) t.appendChild(el('span', 'mwDate', bas))
        a.appendChild(t)
        return a
    }

    /** Grande carte « à la une » (la première actualité, avec son image ou le fond). */
    function une(x){
        const c = el('article', 'mwUneCarte')
        c.setAttribute('data-id', x.id || '')
        const img = el('img')
        img.alt = ''
        img.draggable = false
        img.src = urlImage(x) || FOND_PAR_DEFAUT
        img.onerror = () => { if(!img.src.endsWith(FOND_PAR_DEFAUT)) img.src = FOND_PAR_DEFAUT }
        c.appendChild(img)
        const t = el('div', 'mwUneTexte')
        const badge = el('span', 'mwEtiquette', etiquette(x).toUpperCase())
        badge.setAttribute('genre', x.type)
        t.appendChild(badge)
        t.appendChild(el('h3', null, x.titre))
        t.appendChild(el('p', null, x.texte))
        const bas = [x.version, x.date].filter(Boolean).join(' · ')
        if(bas) t.appendChild(el('span', 'mwDate', bas))
        c.appendChild(t)
        return c
    }

    const MOIS = { janv: 'JANV.', jan: 'JANV.', fevr: 'FÉVR.', fev: 'FÉVR.', mars: 'MARS', avr: 'AVR.', mai: 'MAI', juin: 'JUIN', juil: 'JUIL.', aout: 'AOÛT', sept: 'SEPT.', oct: 'OCT.', nov: 'NOV.', dec: 'DÉC.' }

    /** Bloc de date d'un événement : « 17 NOV. » si la date se lit dans « quand », sinon une icône de calendrier. */
    function blocDate(x){
        const d = el('div', 'mwBlocDate')
        const q = String(x.quand || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
        const m = /(\d{1,2})\s*(janv|jan|fevr|fev|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)/.exec(q)
        if(m){
            d.appendChild(el('b', null, m[1]))
            d.appendChild(el('span', null, MOIS[m[2]]))
        } else {
            d.appendChild(svg(ICONES.evenement))
        }
        return d
    }

    function carteEvenement(x, premier){
        const c = el('article', premier ? 'mwEvt mwEvtUne' : 'mwEvt')
        c.setAttribute('data-id', x.id || '')
        c.appendChild(blocDate(x))
        const t = el('div', 'mwEvtTexte')
        t.appendChild(el('span', premier ? 'mwDirect' : 'mwTag', (x.quand || 'Bientôt').toUpperCase()))
        t.appendChild(el('h3', null, x.titre))
        t.appendChild(el('p', null, x.texte))
        c.appendChild(t)
        if(premier && urlImage(x)){
            c.appendChild(vignette(x, 'mwEvtImage'))
        }
        return c
    }

    function vide(texte){
        return el('div', 'mwVide', texte)
    }

    function afficherAvis(){
        const avis = actus.find(x => x.type === 'police')
        const carte = document.getElementById('mwAvis')
        carte.hidden = avis == null
        if(avis == null) return
        document.getElementById('mwAvisTitre').textContent = texteCourt(avis.titre, 60)
        document.getElementById('mwAvisResume').textContent = texteCourt(avis.texte, 130)
        document.getElementById('mwAvisPrime').textContent = avis.quand ? texteCourt(avis.quand, 14) : ''
        carte.onclick = () => { filtreActus = 'police'; afficherActus(); aller('actualites', avis.id) }
    }

    function afficherMetiers(){
        const boite = document.getElementById('mwMetiers')
        boite.replaceChildren()
        document.getElementById('mwRecrute').hidden = metiers.length === 0
        for(const m of metiers.slice(0, 6)){
            const c = el('div', 'mwMetier')
            const ic = el('i', 'mwMetierIcone')
            ic.style.background = TEINTES[m.id] || TEINTES.defaut
            ic.appendChild(svg(ICONES[m.id] || ICONES.defaut))
            c.appendChild(ic)
            const t = el('div')
            t.appendChild(el('span', 'mwMetierNom', m.nom))
            t.appendChild(el('span', 'mwMetierSalaire', '$' + m.salaire.toLocaleString('fr-FR') + ' / h'))
            c.appendChild(t)
            boite.appendChild(c)
        }
    }

    function afficherActus(){
        for(const b of document.querySelectorAll('#mwFiltresActus .mwPuce')){
            b.toggleAttribute('actif', b.getAttribute('data-filtre') === filtreActus)
        }
        // les mises à jour et les actualités dans une seule liste, la plus récente d'abord (ordre du serveur)
        const tout = actus.filter(x => x.type !== 'evenement').concat(majs.map(x => Object.assign({}, x, { type: 'maj' })))
        const liste = filtreActus === 'tout' ? tout : tout.filter(x => x.type === filtreActus)
        const boiteUne = document.getElementById('mwUne')
        const boite = document.getElementById('mwListeActus')
        boiteUne.replaceChildren()
        boite.replaceChildren()
        if(liste.length === 0){
            boiteUne.appendChild(vide('Rien pour l\'instant dans cette catégorie.'))
            return
        }
        boiteUne.appendChild(une(liste[0]))
        const vu = lire('mwDerniereActuVue')
        let avantVu = vu != null
        liste.slice(1, 12).forEach(x => {
            if(x.id === vu) avantVu = false
            boite.appendChild(ligneActu(x, avantVu && x.id !== vu))
        })
    }

    for(const b of document.querySelectorAll('#mwFiltresActus .mwPuce')){
        b.addEventListener('click', () => { filtreActus = b.getAttribute('data-filtre'); afficherActus() })
    }

    function afficher(){
        const evenements = actus.filter(x => x.type === 'evenement')

        // bannière : les événements et les nouvelles de la ville (pas les avis de police), d'abord avec image
        const pourBanniere = actus.filter(x => x.type !== 'police')
        const avecImage = pourBanniere.filter(x => urlImage(x) != null)
        diapos = (avecImage.length > 0 ? avecImage : pourBanniere).slice(0, 5)
        montrerDiapo(0)
        relancerMinuteur()

        afficherAvis()
        afficherMetiers()
        afficherActus()

        const le = document.getElementById('mwListeEvenements')
        le.replaceChildren()
        evenements.length === 0 ? le.appendChild(vide('Aucun événement prévu pour l\'instant.')) : evenements.forEach((x, k) => le.appendChild(carteEvenement(x, k === 0)))

        // pastille sur « Actualités » quand il y a du nouveau
        document.getElementById('mwPastilleActus').hidden = !(actus.length > 0 && lire('mwDerniereActuVue') !== actus[0].id)
    }

    function propre(liste){
        if(!Array.isArray(liste)) return []
        return liste.filter(x => x != null && typeof x === 'object' && typeof x.titre === 'string' && typeof x.texte === 'string')
            .map(x => ({
                id: typeof x.id === 'string' ? x.id : '',
                type: ['evenement', 'maj', 'police'].includes(x.type) ? x.type : 'info',
                titre: x.titre,
                texte: x.texte,
                quand: typeof x.quand === 'string' ? x.quand : null,
                image: typeof x.image === 'string' ? x.image : null,
                version: typeof x.version === 'string' ? x.version : null,
                date: typeof x.date === 'string' ? x.date : null
            }))
    }

    async function chargerActualites(){
        try {
            const d = await gotMW(MW.urlLauncher('actualites.json'), { timeout: 8000, retry: 1 }).json()
            actus = propre(d.actualites).slice(0, 20)
            majs = propre(d.majs).slice(0, 10)
        } catch(err) {
            journal.warn('Actualités MineWorld introuvables pour le moment.')
            journal.debug(err)
        }
        afficher()
    }

    /* ───────────── état du mod (barre du bas) ───────────── */

    async function chargerEtat(){
        let mc = '1.21.11'
        try {
            const serv = (await DistroAPI.getDistribution()).getServerById(ConfigManager.getSelectedServer())
            if(serv != null && serv.rawServer.minecraftVersion) mc = serv.rawServer.minecraftVersion
        } catch(e) { /* la liste des fichiers n'est pas encore là */ }
        let mod = null
        try {
            const e = await gotMW(MW.urlLauncher('etat.json'), { timeout: 8000, retry: 1 }).json()
            if(typeof e.mod === 'string' && /^[0-9A-Za-z.+_-]{1,40}$/.test(e.mod)) mod = e.mod
            metiers = Array.isArray(e.metiers) ? e.metiers.filter(m => m != null && typeof m.id === 'string' && /^[a-z_-]{1,30}$/.test(m.id)
                && typeof m.nom === 'string' && Number.isFinite(m.salaire)).map(m => ({ id: m.id, nom: texteCourt(m.nom, 28), salaire: Math.round(m.salaire) })) : []
            afficherMetiers()
        } catch(err) {
            journal.debug(err)
        }
        versionMod = mod
        const fin = ConfigManager.getModeLancement() === 'officiel' ? 'lancement par le launcher officiel' : 'Minecraft ' + mc + ' · Fabric'
        document.getElementById('mwEtatDetail').textContent = (mod ? 'Mod ' + mod + ' · ' : '') + fin
    }

    /* ───────────── Paramètres (onglets : compte, jeu, launcher, à propos) ───────────── */

    function onglet(nom){
        for(const b of document.querySelectorAll('#mwSousNav [data-onglet]')){
            b.toggleAttribute('actif', b.getAttribute('data-onglet') === nom)
        }
        for(const p of document.querySelectorAll('#mwPage_parametres .mwPanneau')){
            p.hidden = p.id !== 'mwOnglet_' + nom
        }
    }
    window.mwOnglet = onglet

    for(const b of document.querySelectorAll('#mwSousNav [data-onglet]')){
        b.addEventListener('click', () => onglet(b.getAttribute('data-onglet')))
    }

    function dossierJeu(serv){
        if(ConfigManager.getModeLancement() === 'officiel' || serv == null){
            return cheminMW.join(Officiel.dossierMinecraft(), 'mineworld')
        }
        return cheminMW.join(ConfigManager.getInstanceDirectory(), serv.rawServer.id)
    }

    function afficherComptes(){
        const boite = document.getElementById('mwComptes')
        boite.replaceChildren()
        const officiel = ConfigManager.getModeLancement() === 'officiel'
        const comptes = Object.values(ConfigManager.getAuthAccounts() || {})
        const choisi = ConfigManager.getSelectedAccount()
        document.getElementById('mwAjoutCompte').hidden = officiel
        document.getElementById('mwNoteComptes').textContent = officiel
            ? 'En mode « launcher officiel », le compte se choisit dans le launcher officiel.'
            : 'Pour te déconnecter d\'un compte : onglet Launcher › Réglages avancés › Compte.'
        if(officiel) return
        if(comptes.length === 0){
            boite.appendChild(vide('Aucun compte pour l\'instant.'))
            return
        }
        for(const c of comptes){
            const actif = choisi != null && choisi.uuid === c.uuid
            const l = el('div', 'mwCpt')
            l.toggleAttribute('actif', actif)
            const tete = el('i', 'mwCptTete')
            if(c.uuid && /^[0-9a-fA-F-]{32,36}$/.test(c.uuid)){
                tete.style.backgroundImage = `url('https://mc-heads.net/avatar/${c.uuid}/64')`
            }
            l.appendChild(tete)
            const t = el('div', 'mwCptTexte')
            t.appendChild(el('span', 'mwCptNom', c.displayName || 'Compte'))
            t.appendChild(el('span', 'mwCptType', (c.type === 'microsoft' ? 'Compte Microsoft' : 'Compte hors ligne') + (actif ? ' · utilisé pour jouer' : '')))
            l.appendChild(t)
            if(actif){
                l.appendChild(el('span', 'mwPetitBadge mwVert', 'ACTIF'))
            } else {
                l.appendChild(bouton('Utiliser', 'mwBoutonGris', () => {
                    setSelectedAccount(c.uuid)
                    afficherComptes()
                }))
            }
            boite.appendChild(l)
        }
    }

    document.getElementById('mwAjoutCompte').addEventListener('click', () => {
        switchView(getCurrentView(), VIEWS.waiting, 500, 500, () => {
            ipcRenderer.send(MSFT_OPCODE.OPEN_LOGIN, VIEWS.landing, VIEWS.landing)
        })
    })

    let servCourant = null

    function afficherParametres(){
        const mode = ConfigManager.getModeLancement()
        for(const c of document.querySelectorAll('#mwPage_parametres .mwChoix')){
            c.toggleAttribute('choisi', c.getAttribute('data-mode') === mode)
        }
        afficherComptes()
        document.getElementById('mwPleinEcran').toggleAttribute('actif', ConfigManager.getFullscreen())
        document.getElementById('mwVersionsEssai').toggleAttribute('actif', ConfigManager.getAllowPrerelease())
        try {
            document.getElementById('mwVersionLauncher').textContent = 'Version ' + remote.app.getVersion()
        } catch(e) { /* rien */ }
        document.getElementById('mwCheminJeu').textContent = dossierJeu(servCourant)
        DistroAPI.getDistribution().then(d => {
            const serv = d.getServerById(ConfigManager.getSelectedServer()) || d.getMainServer()
            servCourant = serv
            document.getElementById('mwCheminJeu').textContent = dossierJeu(serv)
            // mémoire du jeu (même réglage que Réglages avancés › Java)
            const ram = serv.rawServer.javaOptions?.ram
            ConfigManager.ensureJavaConfig(serv.rawServer.id, serv.effectiveJavaOptions, ram)
            const curseur = document.getElementById('mwRam')
            const min = Math.max(2, Math.ceil(ConfigManager.getAbsoluteMinRAM(ram)))
            const max = Math.max(min, Math.floor(ConfigManager.getAbsoluteMaxRAM(ram)))
            curseur.min = min
            curseur.max = max
            const actuel = String(ConfigManager.getMaxRAM(serv.rawServer.id) || '4G')
            const go = /M$/i.test(actuel) ? Math.round(parseFloat(actuel) / 1024) : parseFloat(actuel)
            curseur.value = Math.min(max, Math.max(min, go || 4))
            majCurseur()
            const total = Math.round(require('os').totalmem() / 1073741824)
            document.getElementById('mwRamDetail').textContent = '8 Go conseillés avec les textures en haute définition · ' + total + ' Go sur ce PC'
            // crédits demandés par les licences (packs de textures CC BY, Helios en MIT)
            const boite = document.getElementById('mwCredits')
            boite.replaceChildren()
            for(const c of Officiel.credits(serv.rawServer).concat(['Launcher basé sur Helios Launcher (licence MIT).'])){
                boite.appendChild(el('div', null, c))
            }
        }).catch(() => {})
    }

    function majCurseur(){
        const c = document.getElementById('mwRam')
        const p = (c.value - c.min) / Math.max(1, c.max - c.min) * 100
        c.style.setProperty('--mw-p', p + '%')
        document.getElementById('mwRamValeur').textContent = c.value + ' Go'
    }

    document.getElementById('mwRam').addEventListener('input', majCurseur)
    document.getElementById('mwRam').addEventListener('change', () => {
        if(servCourant == null) return
        const v = document.getElementById('mwRam').value + 'G'
        ConfigManager.setMinRAM(servCourant.rawServer.id, v)
        ConfigManager.setMaxRAM(servCourant.rawServer.id, v)
        ConfigManager.save()
    })

    document.getElementById('mwPleinEcran').addEventListener('click', function(){
        ConfigManager.setFullscreen(!ConfigManager.getFullscreen())
        ConfigManager.save()
        this.toggleAttribute('actif', ConfigManager.getFullscreen())
    })

    document.getElementById('mwVersionsEssai').addEventListener('click', function(){
        const v = !ConfigManager.getAllowPrerelease()
        ConfigManager.setAllowPrerelease(v)
        ConfigManager.save()
        if(typeof changeAllowPrerelease === 'function') changeAllowPrerelease(v)
        this.toggleAttribute('actif', v)
    })

    document.getElementById('mwChercherMaj').addEventListener('click', function(){
        this.textContent = 'Recherche…'
        ipcRenderer.send('autoUpdateAction', 'checkForUpdate')
        setTimeout(() => { this.textContent = 'Chercher une mise à jour' }, 4000)
    })

    for(const c of document.querySelectorAll('#mwPage_parametres .mwChoix')){
        c.addEventListener('click', () => {
            ConfigManager.setModeLancement(c.getAttribute('data-mode'))
            ConfigManager.save()
            afficherParametres()
            if(typeof updateSelectedAccount === 'function') updateSelectedAccount(ConfigManager.getSelectedAccount())
            chargerEtat()
        })
    }

    document.getElementById('mwOuvrirDossier').addEventListener('click', async () => {
        const d = dossierJeu(servCourant)
        try {
            require('fs').mkdirSync(d, { recursive: true })
        } catch(e) { /* rien */ }
        shellMW.openPath(d)
    })

    /* ───────────── fenêtre « Dernière étape » et erreurs ───────────── */

    function fermerModale(){
        document.getElementById('mwModale').hidden = true
    }

    function bouton(texte, classe, action){
        const b = el('button', classe, texte)
        b.addEventListener('click', action)
        return b
    }

    function modale(genre, titre, sousTitre, corps, boutons, note){
        const carte = document.getElementById('mwModaleCarte')
        carte.replaceChildren()
        carte.setAttribute('genre', genre)
        const haut = el('div', 'mwModaleHaut')
        if(genre !== 'etape'){
            const ic = el('i', 'mwModaleIcone', genre === 'attente' ? 'i' : '!')
            haut.appendChild(ic)
        }
        const t = el('div', 'mwModaleTitres')
        t.appendChild(el('h2', null, titre))
        if(sousTitre) t.appendChild(el('p', null, sousTitre))
        haut.appendChild(t)
        carte.appendChild(haut)
        if(corps) carte.appendChild(corps)
        const bas = el('div', 'mwModaleBoutons')
        boutons.forEach(b => bas.appendChild(b))
        carte.appendChild(bas)
        document.getElementById('mwModaleNote').textContent = note || ''
        document.getElementById('mwModale').hidden = false
    }

    function ligneEtape(faite, titre, detail){
        const l = el('div', faite ? 'mwEtape' : 'mwEtape mwAFaire')
        const rond = el('i', 'mwEtapeRond')
        rond.innerHTML = faite
            ? '<svg viewBox="0 0 24 24" class="mwTrait"><path d="M5 12.5l4.4 4.4L19 7.4"/></svg>'
            : '<svg viewBox="0 0 24 24" class="mwTrait"><path d="M5 12h13M13 6.5l5.5 5.5-5.5 5.5"/></svg>'
        l.appendChild(rond)
        const t = el('div', 'mwEtapeTexte')
        t.appendChild(el('span', 'mwEtapeTitre', titre))
        ;(Array.isArray(detail) ? detail : [detail]).forEach(d => t.appendChild(el('span', 'mwEtapeDetail', d)))
        l.appendChild(t)
        return l
    }

    function iconeProfil(){
        try {
            return 'data:image/png;base64,' + fsMW.readFileSync(cheminMW.join(__dirname, 'assets', 'images', 'icone_profil.png')).toString('base64')
        } catch(e) {
            return null
        }
    }

    function introuvable(){
        modale('erreur', 'Launcher officiel introuvable',
            'Installe le launcher officiel de Minecraft (site minecraft.net ou boutique Microsoft), ouvre-le et connecte-toi une fois, puis reviens ici.',
            null,
            [bouton('Ouvrir minecraft.net', 'mwBoutonCyan', () => shellMW.openExternal('https://www.minecraft.net/download')),
                bouton('Réessayer', 'mwBoutonGris', () => { fermerModale(); window.mwLancerOfficiel() }),
                bouton('Fermer', 'mwBoutonLien', fermerModale)])
    }

    let enCours = false

    window.mwLancerOfficiel = async function(){
        if(enCours) return
        enCours = true
        fermerModale()
        toggleLaunchArea(true)
        setLaunchDetails('Préparation…')
        setLaunchPercentage(0)
        try {
            const mc = Officiel.dossierMinecraft()
            if((await Officiel.fichiersProfils(mc)).length === 0){
                introuvable()
                return
            }
            const distro = await DistroAPI.refreshDistributionOrFallback()
            const serv = distro.getServerById(ConfigManager.getSelectedServer()) || distro.getMainServer()
            let ram = null
            try { ram = ConfigManager.getMaxRAM(serv.rawServer.id) } catch(e) { /* réglage absent : 4G */ }
            const ouvert = await Officiel.launcherOuvert()
            const r = await Officiel.preparer(serv.rawServer, {
                ram,
                icone: iconeProfil(),
                ecrireProfil: !ouvert,
                progression: (p, texte) => { setLaunchPercentage(p); setLaunchDetails(texte) }
            })
            if(r.profil === 'a-ecrire'){
                modale('attente', 'Ferme le launcher officiel',
                    'Il faut ajouter le profil MineWorld au launcher officiel, et il est ouvert en ce moment. Ferme-le complètement, puis clique sur « Réessayer ».',
                    null,
                    [bouton('Réessayer', 'mwBoutonCyan', () => { fermerModale(); window.mwLancerOfficiel() }),
                        bouton('Annuler', 'mwBoutonLien', fermerModale)])
                return
            }
            if(!await Officiel.ouvrirLauncher()){
                introuvable()
                return
            }
            const corps = el('div', 'mwEtapes')
            corps.appendChild(ligneEtape(true, 'Mod MineWorld à jour', (versionMod ? versionMod + ' · ' : '') + 'signature vérifiée'))
            corps.appendChild(ligneEtape(true, 'Fabric et Simple Voice Chat prêts', 'Minecraft ' + serv.rawServer.minecraftVersion))
            corps.appendChild(ligneEtape(true, 'Profil « MineWorld » prêt', 'dans le launcher officiel, avec son propre dossier'))
            corps.appendChild(ligneEtape(false, 'Clique sur « Jouer » dans le launcher officiel', [
                'Vérifie que le profil « MineWorld » est choisi à côté du bouton.',
                'La connexion à ton compte Microsoft se fait là-bas. Le jeu rejoint ensuite le serveur tout seul.']))
            modale('etape', 'Dernière étape', 'Le launcher officiel de Minecraft s\'ouvre, sur le profil MineWorld.', corps,
                [bouton('Rouvrir le launcher officiel', 'mwBoutonGris', () => Officiel.ouvrirLauncher()),
                    bouton('Compris', 'mwBoutonCyan', fermerModale)],
                'Plus simple : le lancement direct depuis MineWorld (Paramètres › Lancement du jeu).')
        } catch(err) {
            journal.error('Lancement par le launcher officiel impossible.', err)
            modale('erreur', 'Lancement impossible', String(err && err.message ? err.message : err), null,
                [bouton('Réessayer', 'mwBoutonCyan', () => { fermerModale(); window.mwLancerOfficiel() }),
                    bouton('Fermer', 'mwBoutonLien', fermerModale)])
        } finally {
            remote.getCurrentWindow().setProgressBar(-1)
            toggleLaunchArea(false)
            enCours = false
        }
    }

    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape' && !document.getElementById('mwModale').hidden) fermerModale()
    })

    chargerActualites()
    chargerEtat()
    setInterval(chargerActualites, 5 * 60 * 1000)
    setInterval(chargerEtat, 5 * 60 * 1000)
})()

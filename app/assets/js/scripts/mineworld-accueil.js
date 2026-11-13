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
    const gotMW = require('got')
    const journal = LoggerUtil.getLogger('MineWorld')

    const IMAGE_OK = /^images\/[A-Za-z0-9._-]{1,80}\.(png|jpg|jpeg|webp|gif)$/
    const COULEURS = ['#7DC8FF', '#F2BE4C', '#58D68D', '#E85D80', '#B79CFF']
    const FOND_PAR_DEFAUT = 'assets/images/backgrounds/' + (document.body.getAttribute('bkid') || '0') + '.jpg'

    let actus = []
    let majs = []
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
        return 'Info' + (x.date ? ' · ' + x.date : '')
    }

    function lire(cle){
        try { return window.localStorage.getItem(cle) } catch(e) { return null }
    }

    function ecrire(cle, val){
        try { window.localStorage.setItem(cle, val) } catch(e) { /* rien : simple confort */ }
    }

    /* ───────────── navigation ───────────── */

    function aller(page, idActu){
        for(const b of document.querySelectorAll('#mwNav .mwNavItem[data-page]')){
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

    for(const b of document.querySelectorAll('#mwNav .mwNavItem[data-page]')){
        b.addEventListener('click', () => aller(b.getAttribute('data-page')))
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

    function carteMaj(x, k, complete){
        const c = el('div', 'mwMaj')
        c.setAttribute('data-id', x.id || '')
        const barre = el('i', 'mwMajCouleur')
        barre.style.background = COULEURS[k % COULEURS.length]
        const corps = el('div', 'mwMajCorps')
        const haut = el('div', 'mwMajHaut')
        haut.appendChild(el('span', 'mwMajTitre', x.titre))
        haut.appendChild(el('span', 'mwMajVersion', x.version || x.date || ''))
        corps.appendChild(haut)
        corps.appendChild(el('span', complete ? 'mwMajTexte mwComplet' : 'mwMajTexte', x.texte))
        if(complete && x.date && x.version){
            corps.appendChild(el('span', 'mwDate', x.date))
        }
        c.appendChild(barre)
        c.appendChild(corps)
        return c
    }

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
        }
        return v
    }

    function carteAvenir(x){
        const c = el('button', 'mwCarteAvenir')
        c.appendChild(vignette(x, 'mwCarteImage'))
        const t = el('div', 'mwCarteTexte')
        t.appendChild(el('span', 'mwCarteTitre', texteCourt(x.titre, 60)))
        t.appendChild(el('span', 'mwCarteQuand', x.quand || x.date || ''))
        c.appendChild(t)
        c.onclick = () => aller('evenements', x.id)
        return c
    }

    function article(x){
        const a = el('article', 'mwArticle')
        a.setAttribute('data-id', x.id || '')
        if(urlImage(x)){
            a.appendChild(vignette(x, 'mwArticleImage'))
        }
        const t = el('div', 'mwArticleTexte')
        const badge = el('span', 'mwEtiquette', etiquette(x))
        badge.setAttribute('genre', x.type === 'evenement' ? 'evenement' : 'info')
        t.appendChild(badge)
        t.appendChild(el('h3', null, x.titre))
        t.appendChild(el('p', null, x.texte))
        if(x.date) t.appendChild(el('span', 'mwDate', 'Publié le ' + x.date))
        a.appendChild(t)
        return a
    }

    function vide(texte){
        return el('div', 'mwVide', texte)
    }

    function afficher(){
        const evenements = actus.filter(x => x.type === 'evenement')

        // bannière : d'abord ce qui a une image ; sinon tout (avec le fond par défaut)
        const avecImage = actus.filter(x => urlImage(x) != null)
        diapos = (avecImage.length > 0 ? avecImage : actus).slice(0, 5)
        montrerDiapo(0)
        relancerMinuteur()

        // dernières mises à jour
        const boiteMajs = document.getElementById('mwMajs')
        boiteMajs.replaceChildren()
        if(majs.length === 0){
            boiteMajs.appendChild(vide('Aucune mise à jour annoncée pour l\'instant.'))
        } else {
            majs.slice(0, 3).forEach((x, k) => boiteMajs.appendChild(carteMaj(x, k, false)))
        }

        // à venir : les événements, sans celui qui ouvre la bannière
        const premier = diapos.length > 0 ? diapos[0].id : null
        const avenir = evenements.filter(x => x.id !== premier).slice(0, 2)
        const boiteAvenir = document.getElementById('mwAvenir')
        boiteAvenir.replaceChildren()
        if(avenir.length === 0){
            boiteAvenir.appendChild(vide(evenements.length > 0 ? 'Pas d\'autre événement prévu pour l\'instant.' : 'Aucun événement prévu pour l\'instant.'))
        } else {
            avenir.forEach(x => boiteAvenir.appendChild(carteAvenir(x)))
        }

        // pages complètes
        const la = document.getElementById('mwListeActus')
        la.replaceChildren()
        actus.length === 0 ? la.appendChild(vide('Aucune actualité pour l\'instant.')) : actus.forEach(x => la.appendChild(article(x)))
        const lm = document.getElementById('mwListeMajs')
        lm.replaceChildren()
        majs.length === 0 ? lm.appendChild(vide('Aucune mise à jour annoncée pour l\'instant.')) : majs.forEach((x, k) => lm.appendChild(carteMaj(x, k, true)))
        const le = document.getElementById('mwListeEvenements')
        le.replaceChildren()
        evenements.length === 0 ? le.appendChild(vide('Aucun événement prévu pour l\'instant.')) : evenements.forEach(x => le.appendChild(article(x)))

        // pastille sur « Actualités » quand il y a du nouveau
        document.getElementById('mwPastilleActus').hidden = !(actus.length > 0 && lire('mwDerniereActuVue') !== actus[0].id)
    }

    function propre(liste){
        if(!Array.isArray(liste)) return []
        return liste.filter(x => x != null && typeof x === 'object' && typeof x.titre === 'string' && typeof x.texte === 'string')
            .map(x => ({
                id: typeof x.id === 'string' ? x.id : '',
                type: x.type === 'evenement' ? 'evenement' : (x.type === 'maj' ? 'maj' : 'info'),
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
        } catch(err) {
            journal.debug(err)
        }
        document.getElementById('mwEtatDetail').textContent = (mod ? 'Mod ' + mod + ' · ' : '') + 'Minecraft ' + mc + ' · Fabric'
    }

    chargerActualites()
    chargerEtat()
    setInterval(chargerActualites, 5 * 60 * 1000)
    setInterval(chargerEtat, 5 * 60 * 1000)
})()

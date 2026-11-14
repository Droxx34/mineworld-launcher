/**
 * MineWorld (13/11/2026) : lancement « par le launcher officiel de Minecraft », en attendant que Microsoft valide le
 * launcher MineWorld (sans cette validation, la connexion Microsoft directe est refusée).
 *
 * Ce que fait ce module, sans jamais toucher à la connexion du joueur :
 *  1. écrit une « version » MineWorld dans .minecraft/versions (la description Fabric servie par le serveur MineWorld,
 *     avec l'option --quickPlayMultiplayer pour rejoindre le serveur dès l'ouverture du jeu) ;
 *  2. met le mod MineWorld (signature Ed25519 vérifiée) et Simple Voice Chat dans .minecraft/mineworld/mods ;
 *  3. ajoute ou met à jour le profil « MineWorld » dans launcher_profiles.json (copie de sauvegarde la première fois) ;
 *  4. ouvre le launcher officiel. Le joueur clique sur « Jouer » là-bas.
 *
 * Même principe que l'installateur officiel de Fabric (profil + version), en gardant un dossier de jeu à part.
 */
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const crypto = require('crypto')
const got = require('got')
const { spawn, execFile } = require('child_process')

const CLE_PROFIL = 'mineworld'
const FICHIERS_PROFILS = ['launcher_profiles.json', 'launcher_profiles_microsoft_store.json']
// clé publique (pas secrète) des mises à jour du mod MineWorld : la même que dans le mod
const CLE_PUBLIQUE_MOD = 'MCowBQYDK2VwAyEAW7Lym3gFiZsv+seL+pMjFUJku1e5KfZCOZMqvcq9k6U='
const ARGS_JAVA = '-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M'

/** Dossier .minecraft du launcher officiel. */
function dossierMinecraft(){
    if(process.platform === 'win32'){
        return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '.minecraft')
    }
    if(process.platform === 'darwin'){
        return path.join(os.homedir(), 'Library', 'Application Support', 'minecraft')
    }
    return path.join(os.homedir(), '.minecraft')
}

/** Fichiers de profils présents (le launcher officiel les crée à sa première ouverture). */
async function fichiersProfils(mc){
    const res = []
    for(const f of FICHIERS_PROFILS){
        if(await fs.pathExists(path.join(mc, f))) res.push(path.join(mc, f))
    }
    return res
}

function md5(buf){
    return crypto.createHash('md5').update(buf).digest('hex')
}

async function md5Fichier(p){
    // lu en flux : les packs de textures pèsent plusieurs centaines de Mo
    return new Promise((fini) => {
        const h = crypto.createHash('md5')
        const flux = require('fs').createReadStream(p)
        flux.on('error', () => fini(null))
        flux.on('data', (d) => h.update(d))
        flux.on('end', () => fini(h.digest('hex')))
    })
}

/** Télécharge un gros fichier en flux vers cible (fichier temporaire, empreinte vérifiée, puis renommage). */
function telechargerVers(url, cible, md5Attendu, avance){
    return new Promise((fini, echec) => {
        const tmp = cible + '.mw-part'
        const h = crypto.createHash('md5')
        const sortie = require('fs').createWriteStream(tmp)
        const flux = got.stream(url, { timeout: { request: 30 * 60 * 1000 }, retry: 1 })
        flux.on('downloadProgress', (p) => { if(avance && p.percent != null) avance(p.percent) })
        flux.on('data', (d) => h.update(d))
        flux.on('error', (e) => { sortie.destroy(); fs.remove(tmp).finally(() => echec(e)) })
        sortie.on('error', (e) => { flux.destroy(); echec(e) })
        sortie.on('finish', async () => {
            try {
                if(md5Attendu && h.digest('hex') !== md5Attendu){
                    await fs.remove(tmp)
                    echec(new Error('Pack de textures abîmé (empreinte).'))
                    return
                }
                await fs.move(tmp, cible, { overwrite: true })
                fini()
            } catch(e) {
                echec(e)
            }
        })
        flux.pipe(sortie)
    })
}

/**
 * Active les packs dans options.txt du profil MineWorld, une seule fois par pack : si le joueur le retire ensuite dans
 * le jeu, on ne le remet pas (liste gardée dans .mineworld-packs.json).
 */
async function activerPacks(jeu, noms){
    const marque = path.join(jeu, '.mineworld-packs.json')
    let deja = []
    try { deja = JSON.parse(await fs.readFile(marque, 'utf8')) } catch(e) { deja = [] }
    if(!Array.isArray(deja)) deja = []
    const nouveaux = noms.filter(n => !deja.includes(n))
    // packs que nous avions installés et que le serveur ne demande plus : fichier supprimé, retiré des options
    const anciens = deja.filter(n => !noms.includes(n) && /^[A-Za-z0-9._-]{1,80}\.zip$/.test(n))
    for(const n of anciens){
        await fs.remove(path.join(jeu, 'resourcepacks', n))
    }
    if(nouveaux.length === 0 && anciens.length === 0) return
    const options = path.join(jeu, 'options.txt')
    let lignes = []
    try { lignes = (await fs.readFile(options, 'utf8')).split(/\r?\n/) } catch(e) { lignes = [] }
    let i = lignes.findIndex(l => l.startsWith('resourcePacks:'))
    let liste = ['vanilla']
    if(i >= 0){
        try { liste = JSON.parse(lignes[i].slice('resourcePacks:'.length)) } catch(e) { liste = ['vanilla'] }
        if(!Array.isArray(liste)) liste = ['vanilla']
    }
    liste = liste.filter(x => !anciens.some(n => x === 'file/' + n))
    for(const n of nouveaux){
        if(!liste.includes('file/' + n)) liste.push('file/' + n)
    }
    const ligne = 'resourcePacks:' + JSON.stringify(liste)
    if(i >= 0) lignes[i] = ligne
    else lignes.unshift(ligne)
    await ecrireSiChange(options, lignes.join('\n').replace(/\n*$/, '\n'))
    await fs.writeFile(marque, JSON.stringify(deja.filter(n => !anciens.includes(n)).concat(nouveaux)))
}

async function telecharger(url){
    const r = await got(url, { responseType: 'buffer', timeout: 60000, retry: 2 })
    return r.body
}

/** Vérifie le .sig du mod MineWorld (format : version=, sha256=, signature= ; message « MineWorld-mod|v|sha256 »). */
function signatureValide(jar, texteSig){
    const champs = {}
    for(const l of String(texteSig).split(/\r?\n/)){
        const i = l.indexOf('=')
        if(i > 0) champs[l.slice(0, i).trim()] = l.slice(i + 1).trim()
    }
    if(!champs.version || !champs.sha256 || !champs.signature) return false
    const sha = crypto.createHash('sha256').update(jar).digest('hex')
    if(sha !== champs.sha256.toLowerCase()) return false
    try {
        const cle = crypto.createPublicKey({ key: Buffer.from(CLE_PUBLIQUE_MOD, 'base64'), format: 'der', type: 'spki' })
        return crypto.verify(null, Buffer.from('MineWorld-mod|' + champs.version + '|' + sha, 'utf8'), cle,
            Buffer.from(champs.signature, 'base64'))
    } catch(e) {
        return false
    }
}

function nomFichierMod(m){
    if(m.id.startsWith('fr.mineworld:mineworld-mod')) return 'MineWorld-mod.jar'
    const base = decodeURIComponent(new URL(m.artifact.url).pathname.split('/').pop() || '')
    return /^[A-Za-z0-9._+-]{1,120}\.jar$/.test(base) ? base : null
}

/** Écrit un fichier seulement s'il change (fichier temporaire puis renommage). */
async function ecrireSiChange(p, contenu){
    const avant = await fs.readFile(p).catch(() => null)
    if(avant != null && Buffer.compare(avant, Buffer.from(contenu)) === 0) return false
    await fs.ensureDir(path.dirname(p))
    await fs.writeFile(p + '.mw-tmp', contenu)
    await fs.move(p + '.mw-tmp', p, { overwrite: true })
    return true
}

function idVersion(serveur){
    return 'MineWorld-' + serveur.minecraftVersion
}

function argsJava(ram){
    return '-Xmx' + (/^\d{3,6}[MG]$/.test(String(ram)) ? ram : '4G') + ' ' + ARGS_JAVA
}

function profilVoulu(serveur, mc, ram, icone){
    const p = {
        name: 'MineWorld',
        type: 'custom',
        lastVersionId: idVersion(serveur),
        gameDir: path.join(mc, 'mineworld'),
        javaArgs: argsJava(ram)
    }
    if(icone) p.icon = icone
    return p
}

/** true si le profil MineWorld existe déjà tel qu'il doit être, dans chaque fichier de profils. */
async function profilsAJour(mc, voulu){
    for(const f of await fichiersProfils(mc)){
        let j
        try { j = JSON.parse(await fs.readFile(f, 'utf8')) } catch(e) { return false }
        const p = j && j.profiles ? j.profiles[CLE_PROFIL] : null
        if(p == null) return false
        for(const k of Object.keys(voulu)){
            if(p[k] !== voulu[k]) return false
        }
    }
    return true
}

/** Ajoute ou met à jour le profil MineWorld (lastUsed = maintenant : il passe en premier). */
async function ecrireProfils(mc, voulu){
    const maintenant = new Date().toISOString()
    for(const f of await fichiersProfils(mc)){
        const texte = await fs.readFile(f, 'utf8')
        const j = JSON.parse(texte)   // si le fichier est illisible, on n'y touche pas (erreur remontée)
        const sauvegarde = f + '.avant-mineworld'
        if(!await fs.pathExists(sauvegarde)) await fs.writeFile(sauvegarde, texte)
        if(j.profiles == null || typeof j.profiles !== 'object') j.profiles = {}
        const ancien = j.profiles[CLE_PROFIL] || {}
        j.profiles[CLE_PROFIL] = Object.assign({}, ancien, voulu, {
            created: ancien.created || maintenant,
            lastUsed: maintenant
        })
        await ecrireSiChange(f, JSON.stringify(j, null, 2))
    }
}

/**
 * Prépare tout pour le launcher officiel.
 * @param {object} serveur rawServer de la distribution MineWorld
 * @param {{ram:string, icone:string, ecrireProfil:boolean, progression:function(number, string)}} o
 * @returns {Promise<{mc:string, version:string, mods:string[], profil:'ecrit'|'a-jour'|'a-ecrire', jeu:string}>}
 */
async function preparer(serveur, o){
    const prog = o.progression || (() => {})
    const mc = dossierMinecraft()
    const jeu = path.join(mc, 'mineworld')
    const modules = Array.isArray(serveur.modules) ? serveur.modules : []

    // 1. version MineWorld = description Fabric + rejoindre le serveur
    prog(5, 'Préparation de Fabric…')
    const fabric = modules.find(m => m.type === 'Fabric')
    const manifeste = fabric && Array.isArray(fabric.subModules) ? fabric.subModules.find(s => s.type === 'VersionManifest') : null
    if(manifeste == null) throw new Error('Description de Fabric absente de la liste des fichiers.')
    const brut = await telecharger(manifeste.artifact.url)
    if(manifeste.artifact.MD5 && md5(brut) !== manifeste.artifact.MD5) throw new Error('Description de Fabric abîmée (empreinte).')
    const v = JSON.parse(brut.toString('utf8'))
    const id = idVersion(serveur)
    v.id = id
    v.inheritsFrom = serveur.minecraftVersion
    if(v.arguments == null) v.arguments = {}
    if(!Array.isArray(v.arguments.game)) v.arguments.game = []
    if(typeof serveur.address === 'string' && /^[A-Za-z0-9.-]+(:\d{1,5})?$/.test(serveur.address)){
        v.arguments.game.push('--quickPlayMultiplayer', serveur.address)
    }
    const dossierVersion = path.join(mc, 'versions', id)
    await ecrireSiChange(path.join(dossierVersion, id + '.json'), JSON.stringify(v, null, 2))
    await fs.remove(path.join(dossierVersion, id + '.jar'))   // comme Fabric : le jeu vient de la version parente

    // 2. mods
    const mods = modules.filter(m => m.type === 'FabricMod' && m.artifact && m.artifact.url)
    const dossierMods = path.join(jeu, 'mods')
    await fs.ensureDir(dossierMods)
    const gardes = []
    let n = 0
    for(const m of mods){
        const nom = nomFichierMod(m)
        if(nom == null) continue
        const cible = path.join(dossierMods, nom)
        const base = 15 + Math.round(70 * n / Math.max(1, mods.length))
        n++
        prog(base, 'Mise à jour : ' + (m.name || nom) + '…')
        const estMineWorld = nom === 'MineWorld-mod.jar'
        let ok = m.artifact.MD5 && await md5Fichier(cible) === m.artifact.MD5
        if(ok && estMineWorld){
            // déjà là : on revérifie quand même la signature (fichier modifié à la main ?)
            const sig = await telecharger(m.artifact.url + '.sig').catch(() => null)
            ok = sig != null && signatureValide(await fs.readFile(cible), sig.toString('utf8'))
        }
        if(!ok){
            const jar = await telecharger(m.artifact.url)
            if(m.artifact.MD5 && md5(jar) !== m.artifact.MD5) throw new Error((m.name || nom) + ' : fichier abîmé (empreinte).')
            if(estMineWorld){
                const sig = await telecharger(m.artifact.url + '.sig')
                if(!signatureValide(jar, sig.toString('utf8'))) throw new Error('Mod MineWorld : signature invalide, fichier refusé.')
            }
            await ecrireSiChange(cible, jar)
        }
        gardes.push(nom)
    }
    // anciennes versions de nos deux mods seulement (les autres mods du joueur ne sont pas touchés)
    for(const f of await fs.readdir(dossierMods)){
        if(gardes.includes(f)) continue
        if(/^MineWorld-mod.*\.jar$/i.test(f) || /^voicechat-fabric.*\.jar$/i.test(f)){
            await fs.remove(path.join(dossierMods, f))
        }
    }

    // 3. packs de textures (modules « File » rangés dans resourcepacks/), téléchargés une fois puis activés
    const packs = modules.filter(m => m.type === 'File' && m.artifact && typeof m.artifact.path === 'string'
        && /^resourcepacks\/[A-Za-z0-9._-]{1,80}\.zip$/.test(m.artifact.path) && /^https:\/\//.test(m.artifact.url || ''))
    const nomsPacks = []
    for(const m of packs){
        const cible = path.join(jeu, m.artifact.path)
        await fs.ensureDir(path.dirname(cible))
        if(!m.artifact.MD5 || await md5Fichier(cible) !== m.artifact.MD5){
            const taille = m.artifact.size ? ' (' + Math.round(m.artifact.size / 1048576) + ' Mo)' : ''
            prog(86, 'Textures : ' + (m.name || 'pack') + taille + '…')
            await telechargerVers(m.artifact.url, cible, m.artifact.MD5,
                (f) => prog(86, 'Textures : ' + (m.name || 'pack') + ' ' + Math.round(f * 100) + ' %'))
        }
        nomsPacks.push(path.basename(m.artifact.path))
    }
    await activerPacks(jeu, nomsPacks)

    // 4. profil
    prog(90, 'Profil MineWorld…')
    const voulu = profilVoulu(serveur, mc, o.ram, o.icone)
    let profil = 'a-jour'
    if(o.ecrireProfil){
        await ecrireProfils(mc, voulu)
        profil = 'ecrit'
    } else if(!await profilsAJour(mc, voulu)){
        profil = 'a-ecrire'
    }
    prog(100, 'Prêt.')
    return { mc, jeu, version: id, mods: gardes, profil }
}

function executer(cmd, args){
    return new Promise((fini) => {
        execFile(cmd, args, { windowsHide: true, timeout: 15000 }, (err, sortie) => fini(err ? '' : String(sortie)))
    })
}

/** Le launcher officiel est-il ouvert ? (Windows seulement ; ailleurs : on ne sait pas, donc non) */
async function launcherOuvert(){
    if(process.platform !== 'win32') return false
    const s = await executer('tasklist', ['/FO', 'CSV', '/NH'])
    return /^"(MinecraftLauncher|Minecraft)\.exe"/im.test(s)
}

/** Ouvre (ou passe devant) le launcher officiel. Renvoie false s'il est introuvable. */
async function ouvrirLauncher(){
    const lancer = (cmd, args) => {
        const p = spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: false })
        p.on('error', () => {})
        p.unref()
    }
    if(process.platform === 'win32'){
        const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
        const pf = process.env.ProgramFiles || 'C:\\Program Files'
        const candidats = [
            path.join(pf86, 'Minecraft Launcher', 'MinecraftLauncher.exe'),
            path.join(pf86, 'Minecraft', 'MinecraftLauncher.exe'),
            path.join(pf, 'Minecraft Launcher', 'MinecraftLauncher.exe')
        ]
        for(const c of candidats){
            if(await fs.pathExists(c)){
                lancer(c, [])
                return true
            }
        }
        // version installée par la boutique Microsoft ou l'application Xbox : on la retrouve dans le menu Démarrer
        const id = (await executer('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
            "Get-StartApps | Where-Object { $_.Name -match 'Minecraft' -and $_.Name -match 'Launcher' } | Select-Object -First 1 -ExpandProperty AppID"])).trim()
        if(id.length > 0 && !/[\r\n"]/.test(id)){
            lancer('explorer.exe', ['shell:AppsFolder\\' + id])
            return true
        }
        return false
    }
    if(process.platform === 'darwin'){
        if(await fs.pathExists('/Applications/Minecraft.app')){
            lancer('open', ['-a', 'Minecraft'])
            return true
        }
        return false
    }
    lancer('minecraft-launcher', [])
    return true
}

/** Crédits des packs (licence CC BY : afficher l'auteur). */
function credits(serveur){
    return (Array.isArray(serveur.modules) ? serveur.modules : []).filter(m => typeof m.credit === 'string').map(m => m.credit)
}

module.exports = { dossierMinecraft, fichiersProfils, preparer, launcherOuvert, ouvrirLauncher, signatureValide, credits, CLE_PROFIL }

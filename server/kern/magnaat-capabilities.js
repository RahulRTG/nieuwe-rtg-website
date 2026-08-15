/* Automatische Capability Graph voor Magnaat.

   Deze scanner leest uitsluitend de lokale RTG-code. Hij voert geen route uit
   en opent geen datastore. Apps, API-deuren, functieflags en kantoorkamers
   worden samengebracht tot speelbare werkproces-families. Een codescan kan zo
   nieuwe mogelijkheden signaleren zonder productie te wijzigen. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { nu: klokNu } = require('../lib/klok');

const API_RE = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;

function bestanden(map, extensie, uit = []) {
  let items = [];
  try { items = fs.readdirSync(map, { withFileTypes: true }); } catch (e) { return uit; }
  for (const item of items) {
    const bestand = path.join(map, item.name);
    if (item.isDirectory()) bestanden(bestand, extensie, uit);
    else if (!extensie || bestand.endsWith(extensie)) uit.push(bestand);
  }
  return uit;
}

function lees(bestand) {
  try { return fs.readFileSync(bestand, 'utf8'); } catch (e) { return ''; }
}

function tekst(s) {
  return String(s || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function titelVanBestand(bestand) {
  const html = lees(bestand);
  const titel = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return tekst(titel ? titel[1].split(/[·|]/)[0] : path.basename(bestand, '.html'));
}

function menselijk(s) {
  return String(s || '').replace(/^\/+|\/+$/g, '').replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

function risicoVan(route) {
  if (/bank|pay|betaal|krediet|rekening|paspoort|rtgid|auth|webauthn|verify|kluis|boardroom|techniek/i.test(route)) return 'rood';
  if (/member|staff|office|bericht|dm|chat|care|zorg|sollicit|personeel/i.test(route)) return 'geel';
  return 'groen';
}

function toegangVan(bron, einde) {
  const kop = bron.slice(einde, einde + 240).split(/=>|\{/)[0];
  if (/boardroomAuth/.test(kop)) return 'boardroom';
  if (/officeAuth/.test(kop)) return 'office';
  if (/staffAuth/.test(kop)) return 'staff';
  if (/supplierAuth/.test(kop)) return 'supplier';
  if (/auth/.test(kop)) return 'member';
  return 'publiek';
}

function rolVan(bron, methode, kantoor, risico) {
  const zwaar = methode !== 'GET' || /maak|zet|wijzig|verwijder|beslis|bevestig|annuleer|nood|herstel|modus|instelling|publiceer|blokkeer|bevries|autoriseer/i.test(bron);
  if (kantoor.id === 'boardroom') return 'Boardroom-regisseur';
  if (risico === 'rood' || zwaar) return kantoor.naam + '-coördinator';
  return kantoor.naam + '-medewerker';
}

function controleId(soort, sleutel) {
  return soort + ':' + crypto.createHash('sha256').update(soort + '|' + sleutel).digest('hex').slice(0, 18);
}

function workflowFamilie(route) {
  const delen = String(route).split('/').filter(Boolean);
  return '/' + delen.slice(0, Math.min(3, delen.length)).join('/');
}

function leesKantoren(root, functies) {
  const leeg = {};
  const ctx = {
    d: () => leeg, lijst: () => [], tel: () => 0, recent: () => 0,
    ledenGeteld: () => 0, functies: functies || { catalogus: () => [] },
    accounts: { listByVerification: () => [] }
  };
  let kamers = {};
  try {
    kamers = Object.assign(
      require(path.join(root, 'server/kern/afdelingen/register'))(ctx),
      require(path.join(root, 'server/kern/afdelingen/register2'))(ctx)
    );
  } catch (e) { kamers = {}; }
  const gewoon = Object.entries(kamers).map(([id, kamer]) => ({
    id, naam: kamer.naam, missie: kamer.missie, soort: 'afdeling', eigenApp: !!kamer.eigenApp
  }));
  const html = lees(path.join(root, 'public/apps/kantoren.html'));
  const bijzonder = [];
  const gezien = new Set(gewoon.map(k => k.id));
  const re = /data-kamer="([^"]+)"[\s\S]{0,220}?<h2>([\s\S]*?)<\/h2>/g;
  let m;
  while ((m = re.exec(html))) {
    const naam = tekst(m[2]);
    if (gezien.has(m[1]) || m[1].includes('"') || /[+'$]/.test(naam)) continue;
    gezien.add(m[1]);
    bijzonder.push({ id: m[1], naam, missie: 'Specialistische RTG-werkruimte', soort: 'controlekamer', eigenApp: true });
  }
  if (!gezien.has('ideeen') && /De Ideeënkamer/.test(html)) bijzonder.push({
    id: 'ideeen', naam: 'De Ideeënkamer', missie: 'Gedeelde werkbank voor nieuwe RTG-concepten.', soort: 'werkruimte', eigenApp: true
  });
  return gewoon.concat(bijzonder);
}

function scanApps(root) {
  return bestanden(path.join(root, 'public/apps'), '.html').map(bestand => ({
    pad: '/' + path.relative(path.join(root, 'public'), bestand).split(path.sep).join('/'),
    naam: titelVanBestand(bestand),
    bestand: path.relative(root, bestand).split(path.sep).join('/')
  })).sort((a, b) => a.pad.localeCompare(b.pad));
}

function scanEndpoints(root) {
  const uniek = new Map();
  for (const bestand of bestanden(path.join(root, 'server'), '.js')) {
    const bron = lees(bestand);
    API_RE.lastIndex = 0;
    let m;
    while ((m = API_RE.exec(bron))) {
      if (!m[3].startsWith('/api/')) continue;
      const sleutel = m[1].toUpperCase() + ' ' + m[3];
      uniek.set(sleutel, {
        sleutel, methode: m[1].toUpperCase(), route: m[3],
        bestand: path.relative(root, bestand).split(path.sep).join('/'),
        toegang: toegangVan(bron, API_RE.lastIndex)
      });
    }
  }
  return [...uniek.values()].sort((a, b) => a.sleutel.localeCompare(b.sleutel));
}

let nativeWaarschuwingGegeven = false;
function scanNative(root) {
  const bin = process.env.RTG_CAPABILITY_RUST_BIN;
  if (!bin) return null;
  const r = spawnSync(bin, ['capability-scan', root], {
    cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  try {
    if (r.error) throw r.error;
    if (r.status !== 0) throw new Error(String(r.stderr || 'native scanner stopte met status ' + r.status).trim());
    const uit = JSON.parse(r.stdout);
    if (!uit || uit.ok !== true || !Array.isArray(uit.apps) || !Array.isArray(uit.endpoints)) {
      throw new Error('native scanner gaf geen geldig inventarisantwoord');
    }
    // Houd exact dezelfde locale-volgorde als de JS-scanner. PathBuf/BTreeMap
    // sorteren bytegewijs en zetten bijvoorbeeld een map soms vóór naam.html.
    uit.apps.sort((a, b) => String(a.pad).localeCompare(String(b.pad)));
    uit.endpoints.sort((a, b) => String(a.sleutel).localeCompare(String(b.sleutel)));
    return uit;
  } catch (fout) {
    /* Een codescan mag de app nooit onbeschikbaar maken. De bewezen JS-scanner
       blijft de exacte terugval; eenmaal waarschuwen voorkomt een logstorm als
       de binary tijdens ontwikkeling tijdelijk ontbreekt. */
    if (!nativeWaarschuwingGegeven) {
      nativeWaarschuwingGegeven = true;
      console.error('[capability-rust] veilige terugval naar JS:', fout && fout.message);
    }
    return null;
  }
}

function besteApp(familie, apps) {
  const woorden = familie.split('/').filter(x => x && x !== 'api' && !['member', 'office', 'supplier', 'staff'].includes(x));
  let beste = null, score = 0;
  for (const app of apps) {
    const bron = (app.pad + ' ' + app.naam).toLowerCase();
    const s = woorden.reduce((n, w) => n + (bron.includes(w) ? 1 : 0), 0);
    if (s > score) { score = s; beste = app; }
  }
  return score ? { pad: beste.pad, naam: beste.naam } : { pad: '/apps/app.html', naam: 'RTG OS' };
}

module.exports = ({
  root = path.resolve(__dirname, '../..'), functies,
  volledigeWerkprocessen = [], werkrouteFabriek = null
}) => {
  function scan() {
    const native = scanNative(root);
    const apps = native ? native.apps : scanApps(root);
    const endpoints = native ? native.endpoints : scanEndpoints(root);
    const kantoren = leesKantoren(root, functies);
    const flags = Array.isArray(functies && functies.FUNCTIES) ? functies.FUNCTIES : [];
    const prefixen = flags.flatMap(f => (f.paden || []).map(p => ({ id: f.id, pad: p })));
    const groepen = new Map();

    for (const endpoint of endpoints) {
      const familie = workflowFamilie(endpoint.route);
      if (!groepen.has(familie)) groepen.set(familie, []);
      groepen.get(familie).push(endpoint);
    }

    /* Bouw eerst de feitelijke procesbronnen. De optionele fabriek krijgt exact
       die ontdekte bronnen en mag daar volledige synthetische werkdossiers van
       maken. Alleen structureel valide routes tellen daarna als matrixbewijs. */
    const workflowBronnen = [...groepen.entries()].map(([familie, acties]) => {
      const gekoppeld = flags.filter(f => (f.paden || []).some(p => acties.some(a => a.route.startsWith(p))));
      const kantoor = kantoorVan(familie);
      const risico = risicoVan(familie);
      const rol = rolVan(familie, acties.some(a => a.methode !== 'GET') ? 'POST' : 'GET', kantoor, risico);
      return {
        id: 'code:' + familie.replace(/^\/api\//, '').replace(/\//g, ':'),
        naam: menselijk(familie.replace(/^\/api\//, '')),
        familie, domein: familie.split('/')[2] || 'platform', kantoor, rol,
        risico, geregistreerd: gekoppeld.length > 0,
        functieIds: gekoppeld.map(f => f.id), app: besteApp(familie, apps),
        acties: acties.map(a => ({ methode: a.methode, route: a.route })),
        actieAantal: acties.length,
        spelstappen: ['Dossier aannemen', 'Brongegevens controleren', 'Actie in trainingskopie uitvoeren', 'Resultaat dubbel controleren', 'Overdracht en afsluiting vastleggen']
      };
    });
    const automatischeWerkprocessen = typeof werkrouteFabriek === 'function'
      ? werkrouteFabriek(workflowBronnen).filter(w => w && typeof w.id === 'string' &&
        Array.isArray(w.codeFamilies) && w.codeFamilies.length > 0 &&
        Array.isArray(w.stappen) && w.stappen.length >= 5 &&
        w.stappen[0] && w.stappen[0].soort === 'software' &&
        /^\/apps\/[^?#]+\.html$/.test(w.stappen[0].schermPad || ''))
      : [];
    const matrix = require('./magnaat-dekkingsmatrix')({
      root, flags, volledigeWerkprocessen: volledigeWerkprocessen.concat(automatischeWerkprocessen)
    });
    const workflows = workflowBronnen.map(w => {
      const koppeling = matrix.werkproces(
        { familie: w.familie },
        w.acties.map(a => Object.assign({ familie: w.familie }, a)),
        w.kantoor, w.rol, w.geregistreerd
      );
      return Object.assign({}, w, {
        bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        dekking: koppeling.dekking
      });
    }).sort((a, b) => b.actieAantal - a.actieAantal || a.naam.localeCompare(b.naam));

    const domeinen = {};
    for (const endpoint of endpoints) {
      const domein = endpoint.route.split('/')[2] || 'platform';
      domeinen[domein] = (domeinen[domein] || 0) + 1;
    }
    const ongedekt = endpoints.filter(e => !prefixen.some(p => e.route.startsWith(p.pad)));
    const apiPunten = endpoints.map(e => {
      const kantoor = kantoorVan(e.route);
      const risico = risicoVan(e.route);
      const rol = rolVan(e.route, e.methode, kantoor, risico);
      const familie = workflowFamilie(e.route);
      const koppeling = matrix.api(Object.assign({ familie }, e), kantoor, rol);
      return {
        id: controleId('api', e.sleutel), soort: 'api', sleutel: e.sleutel,
        naam: e.methode + ' · ' + menselijk(e.route.replace(/^\/api\//, '')),
        route: e.route, methode: e.methode, bestand: e.bestand, toegang: e.toegang,
        familie, kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const schermPunten = apps.map(a => {
      const kantoor = kantoorVan(a.pad);
      const risico = risicoVan(a.pad);
      const rol = rolVan(a.pad, 'GET', kantoor, risico);
      const koppeling = matrix.scherm({ route: a.pad, sleutel: a.pad, bestand: a.bestand }, kantoor, rol);
      return {
        id: controleId('scherm', a.pad), soort: 'scherm', sleutel: a.pad,
        naam: a.naam, route: a.pad, methode: null, bestand: a.bestand,
        toegang: /kantoor|office|boardroom|techniek|personeel/i.test(a.pad) ? 'office' : 'member',
        familie: a.pad, kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const functiePunten = flags.map(f => {
      const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ');
      const kantoor = kantoorVan(bron);
      const risico = risicoVan(bron);
      const rol = rolVan(bron, 'POST', kantoor, risico);
      const basis = { sleutel: f.id, route: (f.paden || [])[0] || null, bestand: 'server/functies.js' };
      const koppeling = matrix.functie(basis, kantoor, rol);
      return {
        id: controleId('functie', f.id), soort: 'functie', sleutel: f.id,
        naam: f.naam, route: (f.paden || [])[0] || null, methode: null,
        bestand: 'server/functies.js', toegang: 'member', familie: f.categorie,
        kantoor, rol, risico, bronstand: koppeling.bronstand,
        signalen: koppeling.signalen,
        functieIds: koppeling.functieIds, dekking: koppeling.dekking
      };
    });
    const workflowPunten = workflows.map(w => ({
      id: controleId('werkproces', w.id), soort: 'werkproces', sleutel: w.id,
      naam: w.naam, route: w.familie, methode: null, bestand: null,
      toegang: w.acties.some(a => /office/.test(a.route)) ? 'office' : 'member',
      familie: w.familie, kantoor: Object.assign({}, w.kantoor), rol: w.rol, risico: w.risico,
      bronstand: w.bronstand, signalen: Object.assign({}, w.signalen),
      functieIds: w.functieIds.slice(), dekking: w.dekking
    }));
    const controlepunten = apiPunten.concat(schermPunten, functiePunten, workflowPunten)
      .sort((a, b) => a.kantoor.naam.localeCompare(b.kantoor.naam) || a.naam.localeCompare(b.naam));
    const dekkingsmatrix = matrix.samenvat(controlepunten);
    const vingerafdruk = crypto.createHash('sha256').update(JSON.stringify({
      apps: apps.map(a => a.pad), endpoints: endpoints.map(e => e.sleutel),
      kantoren: kantoren.map(k => k.id), flags: flags.map(f => f.id)
    })).digest('hex');

    return {
      versie: 2, gescand: klokNu(), vingerafdruk,
      cijfers: {
        functieFlags: flags.length, functiePrefixen: prefixen.length,
        apps: apps.length, apiActies: endpoints.length, kantoren: kantoren.length,
        werkprocessen: workflows.length, automatischeWerkprocessen: automatischeWerkprocessen.length,
        ongedekteApiActies: ongedekt.length,
        controlepunten: controlepunten.length, volledigGekoppeld: dekkingsmatrix.volledig,
        dekkingsgaten: dekkingsmatrix.metGaten, dekkingspercentage: dekkingsmatrix.percentage
      },
      apps, endpoints, kantoren, workflows, automatischeWerkprocessen,
      controlepunten, dekkingsmatrix,
      domeinen: Object.entries(domeinen).map(([id, aantal]) => ({ id, aantal })).sort((a, b) => b.aantal - a.aantal),
      ongedekt: ongedekt.map(e => e.sleutel)
    };
  }

  return { scan };
};

/* Automatische Capability Graph voor Magnaat.

   Deze scanner leest uitsluitend de lokale RTG-code. Hij voert geen route uit
   en opent geen datastore. Apps, API-deuren, functieflags en kantoorkamers
   worden samengebracht tot speelbare werkproces-families. Een codescan kan zo
   nieuwe mogelijkheden signaleren zonder productie te wijzigen. */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

/* De volgorde is belangrijk: specialistische RTG-kamers gaan voor de brede
   afdelingen. Zo komt /api/office/hardware niet op de generieke IT-stapel en
   /api/office/redactie niet bij alle creatieve werkzaamheden terecht. */
function kantoorVan(route) {
  route = String(route || '').toLowerCase();
  const regels = [
    [/office\/boardroom|\/boardroom/, ['boardroom', 'De Boardroom']],
    [/member\/magnaat|office\/magnaat/, ['magnaat', 'Magnaat Controlekamer']],
    [/office\/(?:paniek|rampbeeld)|paniekkamer/, ['paniekkamer', 'De Paniekkamer']],
    [/office\/bank/, ['bank', 'RTG Bank']],
    [/office\/redactie|\/redactie|\/krant/, ['redactie', 'RTG Redactie']],
    [/office\/atelier(?:web)?|\/atelier/, ['atelier', 'RTG Atelier']],
    [/office\/studio|\/studio/, ['studio', 'RTG Ontwerpstudio']],
    [/office\/hardware|\/hardware|\/doos/, ['hardware', 'RTG Hardwarelab']],
    [/office\/architect|\/architect/, ['architect', 'RTG Architectenbureau']],
    [/office\/werkplaats|\/werkplaats/, ['werkplaats', 'RTG Werkplaats']],
    [/office\/ideeen|\/ideeen/, ['ideeen', 'De Ideeënkamer']],
    [/office\/stad|\/gemeente|\/overheid/, ['stad', 'RTG Stad']],
    [/\/techniek|\/wacht/, ['techniek', 'Techniek & De Wacht']],
    [/bank|pay|betaal|factuur|finance|krediet|rekening|wallet|munt|wbw/, ['financien', 'Financiën']],
    [/marketing|campagne|analytics/, ['marketing', 'Marketing']],
    [/\/pr\/|communicatie|persbericht/, ['pr', 'PR & communicatie']],
    [/\/sales|acquisitie|lead/, ['sales', 'Sales']],
    [/staff|personeel|vacature|sollicit/, ['hr', 'HR']],
    [/contract|juridisch|paspoort|machtig|privacy|avg/, ['juridisch', 'Juridisch']],
    [/supplier\/(?:inkoop|groothandel|keten|vracht)|\/inkoop/, ['inkoop', 'Inkoop']],
    [/supplier\/(?:verkoop|retail|order|menu|reserver)|\/verkoop/, ['verkoop', 'Verkoop']],
    [/ingenieur|engineering/, ['ingenieurs', 'Ingenieurs']],
    [/asset|site|auth|webauthn|rtgid|verify|sleutel/, ['intern', 'Intern & IT']],
    [/foundation|rtf|labfonds|les|school/, ['onderzoek', 'Onderzoek & data']],
    [/podium|theater|clips|flits|creatief/, ['creatief', 'Creatief']],
    [/salon|member|bericht|dm|ontmoet|vonk|care|zorg|reis|ticket|lucht|hotel|ov|rit|charter/, ['klantenservice', 'Klantenservice']],
    [/supplier|partner/, ['support', 'Support team']]
  ];
  const regel = regels.find(r => r[0].test(route));
  return regel ? { id: regel[1][0], naam: regel[1][1] } : { id: 'onderzoek', naam: 'Onderzoek & data' };
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

module.exports = ({ root = path.resolve(__dirname, '../..'), functies }) => {
  function scan() {
    const apps = scanApps(root);
    const endpoints = scanEndpoints(root);
    const kantoren = leesKantoren(root, functies);
    const flags = Array.isArray(functies && functies.FUNCTIES) ? functies.FUNCTIES : [];
    const prefixen = flags.flatMap(f => (f.paden || []).map(p => ({ id: f.id, pad: p })));
    const groepen = new Map();

    for (const endpoint of endpoints) {
      const familie = workflowFamilie(endpoint.route);
      if (!groepen.has(familie)) groepen.set(familie, []);
      groepen.get(familie).push(endpoint);
    }

    const workflows = [...groepen.entries()].map(([familie, acties]) => {
      const gekoppeld = flags.filter(f => (f.paden || []).some(p => acties.some(a => a.route.startsWith(p))));
      const kantoor = kantoorVan(familie);
      const risico = risicoVan(familie);
      return {
        id: 'code:' + familie.replace(/^\/api\//, '').replace(/\//g, ':'),
        naam: menselijk(familie.replace(/^\/api\//, '')),
        familie, domein: familie.split('/')[2] || 'platform',
        kantoor, rol: rolVan(familie, acties.some(a => a.methode !== 'GET') ? 'POST' : 'GET', kantoor, risico),
        risico, geregistreerd: gekoppeld.length > 0,
        functieIds: gekoppeld.map(f => f.id), app: besteApp(familie, apps),
        acties: acties.map(a => ({ methode: a.methode, route: a.route })),
        actieAantal: acties.length,
        spelstappen: ['Dossier aannemen', 'Brongegevens controleren', 'Actie in trainingskopie uitvoeren', 'Resultaat dubbel controleren', 'Overdracht en afsluiting vastleggen']
      };
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
      return {
        id: controleId('api', e.sleutel), soort: 'api', sleutel: e.sleutel,
        naam: e.methode + ' · ' + menselijk(e.route.replace(/^\/api\//, '')),
        route: e.route, methode: e.methode, bestand: e.bestand, toegang: e.toegang,
        familie: workflowFamilie(e.route), kantoor,
        rol: rolVan(e.route, e.methode, kantoor, risico), risico
      };
    });
    const schermPunten = apps.map(a => {
      const kantoor = kantoorVan(a.pad);
      const risico = risicoVan(a.pad);
      return {
        id: controleId('scherm', a.pad), soort: 'scherm', sleutel: a.pad,
        naam: a.naam, route: a.pad, methode: null, bestand: a.bestand,
        toegang: /kantoor|office|boardroom|techniek|personeel/i.test(a.pad) ? 'office' : 'member',
        familie: a.pad, kantoor, rol: rolVan(a.pad, 'GET', kantoor, risico), risico
      };
    });
    const functiePunten = flags.map(f => {
      const bron = [f.id, f.naam, f.categorie, ...(f.paden || [])].join(' ');
      const kantoor = kantoorVan(bron);
      const risico = risicoVan(bron);
      return {
        id: controleId('functie', f.id), soort: 'functie', sleutel: f.id,
        naam: f.naam, route: (f.paden || [])[0] || null, methode: null,
        bestand: 'server/functies.js', toegang: 'member', familie: f.categorie,
        kantoor, rol: rolVan(bron, 'POST', kantoor, risico), risico
      };
    });
    const workflowPunten = workflows.map(w => ({
      id: controleId('werkproces', w.id), soort: 'werkproces', sleutel: w.id,
      naam: w.naam, route: w.familie, methode: null, bestand: null,
      toegang: w.acties.some(a => /office/.test(a.route)) ? 'office' : 'member',
      familie: w.familie, kantoor: Object.assign({}, w.kantoor), rol: w.rol, risico: w.risico
    }));
    const controlepunten = apiPunten.concat(schermPunten, functiePunten, workflowPunten)
      .sort((a, b) => a.kantoor.naam.localeCompare(b.kantoor.naam) || a.naam.localeCompare(b.naam));
    const vingerafdruk = crypto.createHash('sha256').update(JSON.stringify({
      apps: apps.map(a => a.pad), endpoints: endpoints.map(e => e.sleutel),
      kantoren: kantoren.map(k => k.id), flags: flags.map(f => f.id)
    })).digest('hex');

    return {
      versie: 2, gescand: Date.now(), vingerafdruk,
      cijfers: {
        functieFlags: flags.length, functiePrefixen: prefixen.length,
        apps: apps.length, apiActies: endpoints.length, kantoren: kantoren.length,
        werkprocessen: workflows.length, ongedekteApiActies: ongedekt.length,
        controlepunten: controlepunten.length
      },
      apps, endpoints, kantoren, workflows, controlepunten,
      domeinen: Object.entries(domeinen).map(([id, aantal]) => ({ id, aantal })).sort((a, b) => b.aantal - a.aantal),
      ongedekt: ongedekt.map(e => e.sleutel)
    };
  }

  return { scan };
};

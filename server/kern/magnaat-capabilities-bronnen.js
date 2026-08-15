/* Afgeschermde broninventaris voor de Magnaat Capability Graph.

   JavaScript blijft de bewezen terugval. De Rust-scanner kan eerst in
   schaduw, daarna op een deterministische canary en pas ten slotte volledig
   autoritatief draaien. RTG_RUST_ALLES_UIT=1 wint altijd: zo kan een beheerder
   tijdens een incident alle gemigreerde appfuncties met één vlag terugzetten. */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');

const API_RE = /\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*(['"`])([^'"`]+)\2/g;
const waarschuwingen = new Set();

function waarschuwEenmaal(sleutel, boodschap) {
  if (waarschuwingen.has(sleutel)) return;
  waarschuwingen.add(sleutel);
  console.error('[capability-rust] ' + boodschap);
}

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

function toegangVan(bron, einde) {
  const kop = bron.slice(einde, einde + 240).split(/=>|\{/)[0];
  if (/boardroomAuth/.test(kop)) return 'boardroom';
  if (/officeAuth/.test(kop)) return 'office';
  if (/staffAuth/.test(kop)) return 'staff';
  if (/supplierAuth/.test(kop)) return 'supplier';
  if (/auth/.test(kop)) return 'member';
  return 'publiek';
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

function scanNative(root, bin) {
  const r = spawnSync(bin, ['capability-scan', root], {
    cwd: root, encoding: 'utf8', timeout: 15000, maxBuffer: 32 * 1024 * 1024,
    windowsHide: true
  });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(String(r.stderr || 'native scanner stopte met status ' + r.status).trim());
  const uit = JSON.parse(r.stdout);
  if (!uit || uit.ok !== true || !Array.isArray(uit.apps) || !Array.isArray(uit.endpoints))
    throw new Error('native scanner gaf geen geldig inventarisantwoord');
  uit.apps.sort((a, b) => String(a.pad).localeCompare(String(b.pad)));
  uit.endpoints.sort((a, b) => String(a.sleutel).localeCompare(String(b.sleutel)));
  return { apps: uit.apps, endpoints: uit.endpoints };
}

function canaryGekozen(root, env, percentage) {
  const sleutel = String(env.RTG_CAPABILITY_RUST_CANARY_KEY || root);
  const vak = Number.parseInt(crypto.createHash('sha256').update(sleutel).digest('hex').slice(0, 8), 16) % 10000;
  return vak < Math.round(percentage * 100);
}

function jsScan(root) { return { apps: scanApps(root), endpoints: scanEndpoints(root) }; }
function gelijk(a, b) { return isDeepStrictEqual(a, b); }

function scan(root, env = process.env) {
  const gevraagd = String(env.RTG_CAPABILITY_RUST_MODE || (env.RTG_CAPABILITY_RUST_BIN ? 'motor' : 'uit')).toLowerCase();
  const stand = gevraagd === 'shadow' ? 'schaduw' : gevraagd;
  const globaleNoodstop = env.RTG_RUST_ALLES_UIT === '1';
  const ruwePct = Number(env.RTG_CAPABILITY_RUST_CANARY_PCT === undefined ? 10 : env.RTG_CAPABILITY_RUST_CANARY_PCT);
  const canaryPercentage = Number.isFinite(ruwePct) ? Math.max(0, Math.min(100, ruwePct)) : 0;
  const basis = { gevraagd, stand: globaleNoodstop ? 'uit' : stand, bron: 'javascript', rustActief: false,
    terugval: false, reden: null, pariteit: null, canaryPercentage,
    canaryGekozen: false, globaleNoodstop };
  if (globaleNoodstop) return Object.assign(jsScan(root), { motor: Object.assign(basis, { reden: 'globale-noodstop' }) });
  if (stand === 'uit') return Object.assign(jsScan(root), { motor: Object.assign(basis, { reden: 'uitgeschakeld' }) });
  if (!['schaduw', 'canary', 'motor'].includes(stand)) {
    waarschuwEenmaal('stand:' + stand, 'onbekende stand; veilige terugval naar JS.');
    return Object.assign(jsScan(root), { motor: Object.assign(basis, { terugval: true, reden: 'onbekende-stand' }) });
  }
  if (!env.RTG_CAPABILITY_RUST_BIN) {
    waarschuwEenmaal('bin-ontbreekt', 'binary ontbreekt; veilige terugval naar JS.');
    return Object.assign(jsScan(root), { motor: Object.assign(basis, { terugval: true, reden: 'binary-ontbreekt' }) });
  }
  let rust;
  try { rust = scanNative(root, env.RTG_CAPABILITY_RUST_BIN); }
  catch (fout) {
    waarschuwEenmaal('native-fout', 'veilige terugval naar JS: ' + String(fout && fout.message || fout));
    return Object.assign(jsScan(root), { motor: Object.assign(basis, { terugval: true, reden: 'native-fout' }) });
  }
  if (stand === 'motor') return Object.assign(rust, { motor: Object.assign(basis, { bron: 'rust', rustActief: true }) });

  const javascript = jsScan(root);
  const pariteit = gelijk(rust, javascript);
  if (!pariteit) {
    waarschuwEenmaal('drift', 'pariteitsdrift gevonden; JavaScript blijft autoritatief.');
    return Object.assign(javascript, { motor: Object.assign(basis, { terugval: true, reden: 'pariteitsdrift', pariteit: false }) });
  }
  if (stand === 'schaduw') return Object.assign(javascript, { motor: Object.assign(basis, { reden: 'schaduw', pariteit: true }) });
  const gekozen = canaryGekozen(root, env, canaryPercentage);
  if (!gekozen) return Object.assign(javascript, { motor: Object.assign(basis, { reden: 'canary-niet-gekozen', pariteit: true }) });
  return Object.assign(rust, { motor: Object.assign(basis, {
    bron: 'rust', rustActief: true, reden: 'canary-gekozen', pariteit: true, canaryGekozen: true
  }) });
}

module.exports = { scan, leesKantoren, scanApps, scanEndpoints };

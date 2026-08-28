#!/usr/bin/env node
/* ============================================================================
   DE KEURLOPER -- hij rendert wat er in de wachtrij staat, en noteert de uitslag.

   WAAROM HIJ BESTAAT. Sinds 27 augustus 2026 houdt de toegankelijkheidskeuring
   een versie tegen: publiceren kan pas nadat zij is gedraaid en geslaagd
   (kern/appstore/toegankelijk.js). Zonder deze loper zou die poort betekenen dat
   er nooit meer iets live gaat -- een besluit dat de winkel dichtzet.

   WAAROM HIJ EEN EIGEN PROCES IS EN GEEN ROUTE. De keuring RENDERT de app: in de
   cel, met dezelfde CSP, op telefoonformaat. Daar is een browser voor nodig, en
   de server heeft er geen. `keur()` is bovendien synchroon. Dus draait dit naast
   de server, op een machine waar wél een browser staat.

   TWEE GRENZEN DIE HIJ NIET OVERSCHRIJDT.

   1. HIJ KEURT NIET GOED. Hij noteert een uitslag; een mens van RTG tekent nog
      steeds af (APPSTORE.md grens 2). `in-orde` haalt alleen de blokkade weg.
   2. HIJ NEEMT NIETS AAN VAN DE UITGEVER. De uitslag komt van een meting op de
      bundel die op schijf ligt, niet uit iets wat is meegestuurd -- een
      ingediend stuk is geen bewijs (CLAUDE.md).

   EN 'NIET VAST TE STELLEN' IS GEEN JA. Draait de browser niet, of gaat de
   bundel niet open, dan noteert hij dat als zodanig en gaat de poort dicht --
   dezelfde regel als de virusscanner in de machinepoort.

   Draai: node scripts/appstore-a11y.js --server http://localhost:3000 --code RTG-OFFICE
          node scripts/appstore-a11y.js --lijst          (alleen tonen wat wacht)
   ========================================================================== */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const rtg = require('./rtg');
const a11y = require('./rtg-a11y');

const arg = (naam, standaard) => {
  const i = process.argv.indexOf('--' + naam);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : standaard;
};

const SERVER = arg('server', process.env.RTG_SERVER || 'http://localhost:3000');
const CODE = arg('code', process.env.RTG_OFFICE_CODE || 'RTG-OFFICE');
const DATA = arg('data', process.env.RTG_DATA_DIR || path.join(WORTEL, 'server', 'data'));

async function api(pad, body, token) {
  const koppen = { 'Content-Type': 'application/json' };
  if (token) koppen.Authorization = 'Bearer ' + token;
  const r = await fetch(SERVER + pad, { method: 'POST', headers: koppen, body: JSON.stringify(body || {}) });
  const d = await r.json().catch(() => ({}));
  return { status: r.status, body: d };
}

/* De bundel van schijf naar een map die `rtg a11y` kent. De opslag legt een
   versie neer als <data>/appstore/<sleutel>/<hash>/ met een bundel.json ernaast;
   de keuring wil een map met een manifest.json erin. Deze functie is de
   vertaling, en verder niets: er wordt niets aan de bundel veranderd. */
function schrijfWerkmap(sleutel, hash, manifest) {
  const van = path.join(DATA, 'appstore', sleutel, hash);
  if (!fs.existsSync(van)) return { error: 'de bundel ligt niet op ' + van };
  const naar = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-keur-'));
  let index;
  try { index = JSON.parse(fs.readFileSync(path.join(van, 'bundel.json'), 'utf8')); }
  catch (e) { return { error: 'bundel.json is niet te lezen: ' + e.message }; }

  for (const pad of Object.keys(index.bestanden || {})) {
    const bron = path.join(van, pad);
    if (!fs.existsSync(bron)) continue;         // een .gz-buurman zonder origineel
    const doel = path.join(naar, pad);
    fs.mkdirSync(path.dirname(doel), { recursive: true });
    fs.copyFileSync(bron, doel);
  }
  fs.writeFileSync(path.join(naar, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return { map: naar };
}

/* De uitvoer van `rtg a11y` opvangen: die schrijft naar het scherm en geeft een
   uitgangscode. 0 = vorm in orde, 1 = fouten, 3 = geen browser. Die drie zijn
   precies de drie standen van de poort, en dat is geen toeval -- ze komen uit
   dezelfde afweging (een controle die niet draaide is geen ja). */
async function keur(map) {
  const regels = [];
  const oudLog = console.log, oudFout = console.error;
  console.log = (...a) => regels.push(a.join(' '));
  console.error = (...a) => regels.push(a.join(' '));
  let code;
  try { code = await a11y([map], { leesBundel: rtg.leesBundel, kleur: false }); }
  finally { console.log = oudLog; console.error = oudFout; }
  const tekst = regels.join('\n').replace(/\x1b\[[0-9;]*m/g, '');
  const stand = code === 0 ? 'in-orde' : code === 1 ? 'blokkeert' : 'niet-vast-te-stellen';
  /* De bevindingen uit de uitvoer halen. Ze staan er als drie regels per stuk:
     "fout  bestand", de beschrijving, en de uitweg. */
  const bevindingen = [];
  const rr = tekst.split('\n');
  for (let i = 0; i < rr.length; i++) {
    const m = /^\s{2}(fout|let op)\s{2}(\S+)\s*$/.exec(rr[i]);
    if (!m) continue;
    bevindingen.push({ ernst: m[1] === 'fout' ? 'fout' : 'let-op', bestand: m[2],
      wat: (rr[i + 1] || '').trim(), hoe: (rr[i + 2] || '').trim() });
  }
  return { stand, fouten: bevindingen.filter(b => b.ernst === 'fout').length, bevindingen, tekst };
}

async function hoofd() {
  const inlog = await api('/api/office/login', { code: CODE });
  if (inlog.status !== 200 || !inlog.body.token) {
    console.error('  Inloggen als kantoor lukte niet (' + inlog.status + '). Draait de server op ' + SERVER + '?');
    return 2;
  }
  const token = inlog.body.token;

  const wacht = await api('/api/appstore/kantoor/toegankelijk/wachtrij', {}, token);
  const lijst = (wacht.body && wacht.body.lijst) || [];
  if (!lijst.length) { console.log('\n  Niets te keuren: geen inzending wacht op een toegankelijkheidsuitslag.\n'); return 0; }

  console.log('\n  ' + lijst.length + ' inzending(en) te keuren\n');
  if (process.argv.includes('--lijst')) {
    for (const v of lijst) console.log('    ' + v.sleutel + '  ' + v.versie + '  ' + v.hash.slice(0, 12));
    console.log('');
    return 0;
  }

  let geblokkeerd = 0;
  for (const v of lijst) {
    /* Het manifest komt van de server en niet van schijf: daar ligt de bundel,
       niet wat de uitgever erover heeft gezegd. */
    const w = schrijfWerkmap(v.sleutel, v.hash, { sleutel: v.sleutel, naam: v.sleutel, versie: v.versie,
      uitleg: 'Bundel uit de wachtrij van de App Store, alleen om te keuren.', categorie: 'leven', start: v.start });
    if (w.error) {
      console.error('    ' + v.sleutel + ' ' + v.versie + ': ' + w.error);
      await api('/api/appstore/kantoor/toegankelijk',
        { versieId: v.id, stand: 'niet-vast-te-stellen', fouten: 0, bevindingen: [{ ernst: 'fout', bestand: '(de bundel)', wat: w.error, hoe: 'Controleer of de datamap klopt (--data).' }] }, token);
      continue;
    }
    const uit = await keur(w.map);
    fs.rmSync(w.map, { recursive: true, force: true });

    const r = await api('/api/appstore/kantoor/toegankelijk',
      { versieId: v.id, stand: uit.stand, fouten: uit.fouten, bevindingen: uit.bevindingen }, token);
    const merk = uit.stand === 'in-orde' ? 'in orde' : uit.stand === 'blokkeert' ? uit.fouten + ' fout(en)' : 'niet vast te stellen';
    console.log('    ' + v.sleutel + ' ' + v.versie + '  ' + merk + (r.status === 200 ? '' : '  (noteren mislukte: ' + r.status + ')'));
    if (uit.stand !== 'in-orde') geblokkeerd++;
  }
  console.log('\n  ' + (geblokkeerd ? geblokkeerd + ' inzending(en) gaan zo niet live.' : 'Alles wat wachtte, is geslaagd.'));
  console.log('  ' + 'Een uitslag haalt alleen de blokkade weg; een mens van RTG tekent nog steeds af.\n');
  return 0;
}

module.exports = { schrijfWerkmap, keur };

if (require.main === module) {
  hoofd().then((c) => { if (c) process.exit(c); }, (e) => { console.error(e && e.stack || e); process.exit(2); });
}

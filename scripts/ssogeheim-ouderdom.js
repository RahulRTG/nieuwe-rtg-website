/* Uitrollijst voor B27: welke organisaties hebben een SSO-clientgeheim dat op de
   uitroldatum ouder is dan 90 dagen, en dus door de afkapping van B22 METEEN
   verloopt? Die organisaties roteren eerst, anders gaat hun inlog bij de uitrol
   dicht (503 SSO_GEHEIM_VERLOPEN).

   Draai (op de productiehost, tegen dezelfde RTG_DATA_DIR als de app):
     npm run ssogeheim:ouderdom                     uitroldatum = vandaag
     npm run ssogeheim:ouderdom -- --op 2026-10-15  een andere uitroldatum

   WAAR HET GEHEIM WOONT. De koppelingen staan in de tabel sso_koppelingen van de
   SQLite-kluis van de accountlaag (server/sso/koppelingen.js), ook met
   DATABASE_URL: die tabel heeft geen JSON- of PostgreSQL-kopie. Dit script leest
   dus dat bestand, en ALLEEN-LEZEN: geen accounts.init() (die migreert en maakt
   sleutels aan), geen migreer() en niets ontsleuteld. Het neemt van elk slot
   alleen de metadata (gezet, vervalt, gemigreerd) die naast het versleutelde
   blob staat; het blob zelf (`c`) en de vingerafdruk worden nooit getoond. De
   afkapping komt uit clientgeheim.vervaltOp(), dezelfde regel als de inlog.

   Het is een LIJST en geen poort: exitcode 0, ook met treffers. Alleen een
   onleesbare opslag of een ongeldige --op geeft 2. */
'use strict';
const fs = require('fs');
const path = require('path');
const cg = require('../server/sso/clientgeheim');

function argOp(argv) {
  const i = argv.indexOf('--op');
  if (i < 0) return { t: Date.now(), bron: 'vandaag' };
  const w = argv[i + 1];
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(String(w)) ? w + 'T00:00:00Z' : String(w));
  if (!Number.isFinite(t)) return { fout: 'geef --op als datum, bv. --op 2026-10-15 (gekregen: ' + w + ')' };
  return { t, bron: '--op' };
}

const dbBestand = (env) => path.join(env.RTG_DATA_DIR || path.join(__dirname, '..', 'server', 'data'), 'rtg.db');

/* De rijen, alleen-lezen. Ontbreekt het bestand of de tabel, dan is er niets te
   melden -- en dat staat er dan MET de reden, niet als stille lege lijst. */
function leesRijen(bestand) {
  if (!fs.existsSync(bestand)) return { rijen: [], reden: 'geen accountdatabase op ' + bestand };
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(bestand, { readOnly: true });
  try {
    const t = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'sso_koppelingen'").get();
    if (!t) return { rijen: [], reden: 'er is nog geen tabel sso_koppelingen' };
    return { rijen: db.prepare('SELECT org, naam, enc_client_secret FROM sso_koppelingen ORDER BY org').all(), reden: null };
  } finally { db.close(); }
}

const iso = t => (Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : '-');

/* De stand van een koppeling op moment `op`. Alleen het eerste slot telt: dat is
   het geheim dat de tokenruil eerst probeert. Een overlapslot vervalt mee. */
function beoordeel(rij, op) {
  const basis = { org: rij.org, naam: rij.naam, gezet: null, vervaltNaAfkapping: null };
  const l = cg.lees(rij.enc_client_secret);
  if (l.soort === 'leeg') return { ...basis, stand: 'geen-geheim', treffer: false };
  if (l.soort === 'oud') return { ...basis, stand: 'oude-opslag', treffer: false,
    toelichting: 'wordt bij het eerste laden herzegeld met ' + cg.GRENS.gemigreerdDagen + ' dagen vanaf dat moment' };
  if (l.soort !== 'v2' || !l.sloten.length) return { ...basis, stand: 'onleesbaar', treffer: false };
  const kop = l.sloten[0];
  const gezet = kop.gezet ? Date.parse(kop.gezet) : NaN;
  const eigen = Date.parse(kop.vervalt);
  const echt = cg.vervaltOp(kop);
  const uit = { ...basis, gezet: Number.isFinite(gezet) ? kop.gezet : null, vervaltNaAfkapping: new Date(echt).toISOString() };
  if (kop.gemigreerd && !Number.isFinite(gezet))
    return { ...uit, stand: echt > op ? 'gemigreerd' : 'al-verlopen', treffer: false };
  if (eigen <= op) return { ...uit, stand: 'al-verlopen', treffer: false };
  if (echt <= op) return { ...uit, stand: 'verloopt-bij-uitrol', treffer: true };
  if (echt < eigen) return { ...uit, stand: 'afgekapt', treffer: false };
  return { ...uit, stand: 'in-orde', treffer: false };
}

function lijst(env, op) {
  const { rijen, reden } = leesRijen(dbBestand(env));
  return { reden, koppelingen: rijen.map(r => beoordeel(r, op)) };
}

function toon(uit, op, bron) {
  const r = [];
  r.push('SSO-clientgeheimen op de uitroldatum ' + iso(op) + ' (' + bron + '), afkapping ' + cg.GRENS.maxDagen +
    ' dagen na uitgifte (B22)');
  if (uit.reden) r.push('  niets te melden: ' + uit.reden);
  const kol = (a, n) => String(a == null ? '-' : a).padEnd(n);
  if (uit.koppelingen.length) {
    r.push('  ' + kol('org', 20) + kol('naam', 24) + kol('gezet', 12) + kol('vervalt', 12) + 'stand');
    for (const k of uit.koppelingen)
      r.push('  ' + kol(k.org, 20) + kol(k.naam, 24) + kol(k.gezet ? k.gezet.slice(0, 10) : '-', 12) +
        kol(k.vervaltNaAfkapping ? k.vervaltNaAfkapping.slice(0, 10) : '-', 12) + k.stand +
        (k.toelichting ? ' (' + k.toelichting + ')' : ''));
  }
  const t = uit.koppelingen.filter(k => k.treffer);
  r.push('');
  r.push(t.length
    ? t.length + ' organisatie(s) verlopen bij de uitrol: ' + t.map(k => k.org).join(', ') +
      '. Laat de eigenaar daar VOOR de uitrol roteren (met zijn passkey).'
    : 'Geen organisatie waarvan het geheim bij de uitrol door de afkapping verloopt.');
  return r.join('\n');
}

if (require.main === module) {
  const op = argOp(process.argv.slice(2));
  if (op.fout) { console.error(op.fout); process.exit(2); }
  let uit;
  try { uit = lijst(process.env, op.t); }
  catch (e) { console.error('De opslag is niet te lezen: ' + (e && e.message)); process.exit(2); }
  if (process.argv.includes('--json')) console.log(JSON.stringify({ op: new Date(op.t).toISOString(), ...uit }, null, 2));
  else console.log(toon(uit, op.t, op.bron));
  process.exit(0);
}

module.exports = { beoordeel, lijst, argOp };

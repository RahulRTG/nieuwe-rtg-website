'use strict';
/* HET BEWIJSBOEK -- welk bewijs mag meeverhuizen, en welk niet?

   DE ENIGE ZIN DIE ERTOE DOET (PROOF-INCREMENTAL.md par. 0):
     snelheid mag alleen voortkomen uit bewezen irrelevantie, nooit uit
     overgeslagen zekerheid.

   Een bewijs is hier niet "de toets is een keer groen geweest" maar: DEZE toets,
   over DEZE invoer, onder DEZE omgeving, met DIT resultaat. Verandert een van
   die drie, dan is het bewijs weg -- niet verdacht, weg.

   DE OMGEVING IS HET LASTIGSTE STUK, en het is ook waar dit soort systemen
   stilletjes onbetrouwbaar wordt. Een bewijs dat is opgebouwd onder Node 22 zegt
   niets over Node 26; een schermtoets die groen was in een oudere browser zegt
   niets over de nieuwe. Wie de omgeving niet in de vingerafdruk stopt, bouwt een
   cache die op de verkeerde dag liegt.

   EN WIJ KUNNEN DE OMGEVING NIET VOLLEDIG METEN. Dat is geen tekortkoming om
   weg te schrijven maar het feit waar de rest omheen is gebouwd: de
   browserversie van de vloot, de databasemotor achter een productieadres en de
   staat van een externe dienst staan hier niet in en kunnen hier niet in. Par.
   7.3 geeft daar drie verdedigingslagen voor, en alle drie staan hieronder:

     VERVAL      een bewijs is niet eeuwig geldig. Hoe meer onderdelen van de
                 omgeving ONGEMETEN zijn, hoe korter het meegaat. Dat is de
                 fail-closed-vorm: onwetendheid maakt de houdbaarheid korter en
                 nooit langer.
     STEEKPROEF  een vast deel van de overgeerfde bewijzen draait tóch, elke
                 ronde, ook als alles zegt dat het niet hoeft. Dat is de enige
                 manier om te merken dat de erfenis zelf kapot is -- een cache
                 die nooit wordt tegengesproken, wordt vanzelf een verhaal.
     FAIL-CLOSED wat niet te beoordelen is, vervalt. Een onbekende toets, een
                 onleesbaar boek, een bestand buiten de index: allemaal "draaien".

   WAT DIT NIET IS. Geen vervanging van de suite en geen reden om iets uit te
   zetten. Het boek zegt alleen welk bewijs er AL is; wie het niet vertrouwt,
   draait alles -- en dat moet altijd kunnen blijven.
   ========================================================================== */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const WORTEL = path.join(__dirname, '..', '..');
const BOEK = path.join(WORTEL, 'BEWIJSBOEK.json');

const kort = (t) => crypto.createHash('sha256').update(t).digest('hex').slice(0, 16);

function stil(cmd, args) {
  try { return execFileSync(cmd, args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch (e) { return null; }
}

function bestandsHash(rel) {
  try { return kort(fs.readFileSync(path.join(WORTEL, rel), 'utf8')); } catch (e) { return null; }
}

/* ------------------------------------------------------------- de omgeving */
/* ELK ONDERDEEL STAAT ER, OOK ALS WE HET NIET KUNNEN METEN. Een lijst die
   alleen het meetbare noemt, leest als volledigheid -- en dat is precies de
   leugen waar par. 7.1 tegen waarschuwt. `gemeten: false` is hier dus geen
   ontbrekend werk maar een gedragen feit: het verkort de houdbaarheid. */
function omgeving() {
  const pkg = (() => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'package.json'), 'utf8')); } catch (e) { return {}; } })();
  const lock = (() => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, 'package-lock.json'), 'utf8')); } catch (e) { return {}; } })();
  const playwright = lock.packages && (lock.packages['node_modules/playwright-core'] || lock.packages['node_modules/playwright']);
  const vlaggen = Object.keys(process.env).filter((naam) => /^RTG_/.test(naam)).sort()
    .map((naam) => naam + '=' + process.env[naam]);

  const delen = [
    { naam: 'node', waarde: process.version, bron: 'process.version' },
    { naam: 'nvmrc', waarde: bestandsHash('.nvmrc'), bron: '.nvmrc' },
    { naam: 'os', waarde: process.platform + '/' + process.arch, bron: 'process' },
    { naam: 'os-versie', waarde: os.release(), bron: 'os.release()' },
    { naam: 'tijdzone', waarde: Intl.DateTimeFormat().resolvedOptions().timeZone, bron: 'Intl' },
    { naam: 'taal', waarde: process.env.LANG || process.env.LC_ALL || 'onbepaald', bron: 'env' },
    { naam: 'afhankelijkheden', waarde: bestandsHash('package-lock.json'), bron: 'package-lock.json' },
    { naam: 'scripts', waarde: kort(JSON.stringify(pkg.scripts || {})), bron: 'package.json' },
    { naam: 'werkstromen', waarde: mapHash('.github/workflows'), bron: '.github/workflows' },
    { naam: 'keuringen', waarde: mapHash('scripts'), bron: 'scripts/' },
    { naam: 'bewijsmachine', waarde: kort([
      'scripts/plan.js', 'scripts/evidence.js', 'scripts/lib/bewijsboek.js',
      'scripts/lib/evidence-dag.js', 'scripts/lib/repository-snapshot.js',
      'scripts/lib/werkelijkheid.js', 'scripts/lib/risico.js', 'scripts/lib/semdiff.js'
    ].map((f) => f + ':' + bestandsHash(f)).join('|')), bron: 'de code die bewijs selecteert' },
    { naam: 'ratels', waarde: kort(['NORM.json', 'BEREIK.json', 'IDEMSCHULD.json', 'BEWIJSSCHULD.json',
      'KLOKWACHT.json', 'KLOK.json', 'BEDRADING.json'].map((f) => f + ':' + bestandsHash(f)).join('|')),
    bron: 'de ratelregisters' },
    /* De browsermetadata staat in dezelfde lockfile als de runner. De binary
       wordt door browserinstall.js uit exact deze versie gehaald. */
    { naam: 'browser', waarde: playwright && playwright.version || null,
      bron: 'package-lock.json: playwright(-core)' },
    { naam: 'databasemotor', waarde: process.versions.sqlite || null,
      bron: 'process.versions.sqlite (PostgreSQL wordt per bewijsprofiel apart onbekend gehouden)' },
    { naam: 'vlaggen', waarde: kort(vlaggen.join('\n')), bron: 'hash van namen en waarden van RTG_-omgevingsvariabelen' },
    { naam: 'externe diensten', waarde: null, bron: 'AI, betaaldienst en post: hun gedrag verandert zonder onze commit' }
  ];

  const gemeten = delen.filter((d) => d.waarde != null);
  const ongemeten = delen.filter((d) => d.waarde == null);
  return {
    delen, ongemeten: ongemeten.map((d) => d.naam),
    hash: kort(gemeten.map((d) => d.naam + '=' + d.waarde).join('\n')),
    dekking: Math.round((gemeten.length / delen.length) * 100)
  };
}

/* Niet iedere toets hangt van iedere omgevingsdimensie af. Een pure parsertoets
   vervalt niet omdat Chromium wijzigde; een schermtoets juist wel. Het profiel
   mag uitsluitend dimensies WEGHALEN als de toetsvorm die dependency uitsluit.
   Onbekende namen krijgen daarom het brede profiel. */
function omgevingVoor(toets, volledig) {
  const basis = volledig || omgeving();
  const naam = String(toets || '').toLowerCase();
  const browser = /(?:\.e2e\.js$|a11y|browser|scherm|playwright)/.test(naam);
  const postgres = /(?:postgres|\bpg\b|database|opslag|migratie)/.test(naam);
  const extern = /(?:extern|webhook|stripe|twilio|openai|provider)/.test(naam);
  const altijd = new Set(['node', 'nvmrc', 'os', 'os-versie', 'tijdzone', 'taal',
    'afhankelijkheden', 'bewijsmachine']);
  if (browser) altijd.add('browser');
  if (postgres) altijd.add('databasemotor');
  if (extern) altijd.add('externe diensten');
  const delen = basis.delen.filter((d) => altijd.has(d.naam)).map((d) => {
    /* De lokaal gemeten SQLite-versie is geen bewijs over PostgreSQL. Alleen
       een expliciet door de databasejob gemeten motorcontract mag een
       databasebewijs verlengen; zonder die meting blijft dit fail-closed. */
    if (postgres && d.naam === 'databasemotor') return { ...d,
      waarde: process.env.RTG_DB_ENGINE_VERSION || null,
      bron: 'RTG_DB_ENGINE_VERSION uit de databasejob (anders onbekend)' };
    return d;
  });
  const gemeten = delen.filter((d) => d.waarde != null);
  const ongemeten = delen.filter((d) => d.waarde == null);
  return { profiel: browser ? 'browser' : postgres ? 'database' : extern ? 'extern' : 'unit',
    delen, ongemeten: ongemeten.map((d) => d.naam),
    hash: kort(gemeten.map((d) => d.naam + '=' + d.waarde).join('\n')),
    dekking: Math.round((gemeten.length / Math.max(1, delen.length)) * 100) };
}

function mapHash(rel) {
  const uit = [];
  const loop = (m) => {
    let rij;
    try { rij = fs.readdirSync(m, { withFileTypes: true }); } catch (e) { return; }
    for (const n of rij.sort((a, b) => a.name.localeCompare(b.name))) {
      const p = path.join(m, n.name);
      if (n.isDirectory()) loop(p);
      else uit.push(path.relative(WORTEL, p) + ':' + bestandsHash(path.relative(WORTEL, p)));
    }
  };
  loop(path.join(WORTEL, rel));
  return uit.length ? kort(uit.join('|')) : null;
}

/* ----------------------------------------------------------- de invoerkant */
/* WAT EEN TOETS LEEST, IS ZIJN VOORWAARTSE SLUITING. Niet de bestanden die hij
   noemt, maar alles wat daar weer onder hangt -- want een toets die groen was
   omdat een module drie lagen dieper het goede deed, is niet meer bewezen zodra
   die module verandert.

   BENADERDE EN ONOPGELOSTE KANTEN MAKEN DE SLUITING RUIMER EN NOOIT KRAPPER.
   Een benaderde kant voegt al zijn kandidaten toe; een onopgeloste kant maakt de
   sluiting ONBEGRENSD, en dan is er niets te erven. Dat laatste staat er met
   opzet zo hard in: een toets die door een maplader heen leest, kan niet
   bewijzen wat hij niet leest. */
function sluiting(ix, start) {
  const gezien = new Set();
  const rij = [...start];
  let onbegrensd = null;
  for (let i = 0; i < rij.length; i++) {
    const p = rij[i];
    if (gezien.has(p)) continue;
    gezien.add(p);
    const b = ix.bestanden.get(p);
    if (!b) continue;
    for (const d of b.kanten.opgelost) if (!gezien.has(d)) rij.push(d);
    for (const ben of b.kanten.benaderd) for (const k of ben.kandidaten) if (!gezien.has(k)) rij.push(k);
    if (b.kanten.onbekend.length && !onbegrensd) {
      onbegrensd = p + ':' + b.kanten.onbekend[0].lijn + ' (' + b.kanten.onbekend[0].vorm + ')';
    }
  }
  return { paden: [...gezien].sort(), onbegrensd };
}

/* De vingerafdruk van EEN bewijs: wie er is getoetst, waarover, en waaronder. */
function stempel(ix, toetsPaden, omg) {
  const s = sluiting(ix, toetsPaden);
  const stukken = [];
  for (const p of s.paden) {
    const b = ix.bestanden.get(p);
    stukken.push(p + ':' + (b ? b.hash : bestandsHash(p) || 'weg'));
  }
  return { hash: kort(stukken.join('\n') + '\n@' + (omg || omgeving()).hash),
    aantal: s.paden.length, onbegrensd: s.onbegrensd, paden: s.paden };
}

/* --------------------------------------------------------------- het boek */

function lees() {
  try {
    const boek = JSON.parse(fs.readFileSync(BOEK, 'utf8'));
    if (boek.versie >= 2 && boek.integriteit && boek.integriteit !== boekHash(boek)) {
      return { versie: 2, bewijzen: {}, ongeldig: 'integriteit van het bewijsboek klopt niet' };
    }
    return boek;
  } catch (e) { return nieuwBoek(); }
}

function schrijf(boek) {
  const uit = { ...boek, versie: 2 };
  uit.integriteit = boekHash(uit);
  const tijdelijk = BOEK + '.tmp-' + process.pid;
  fs.writeFileSync(tijdelijk, JSON.stringify(uit, null, 2) + '\n', { mode: 0o600 });
  fs.renameSync(tijdelijk, BOEK);
}

function nieuwBoek() {
  return { versie: 2, formaat: 'rtg-content-addressed-evidence-v2', bewijzen: {},
    gemaakt: new Date(0).toISOString(), integriteit: null };
}

function boekHash(boek) {
  const schoon = { ...boek };
  delete schoon.integriteit;
  return kort(JSON.stringify(schoon));
}

function bewijsSleutel(toets, stempelHash, omgevingHash) {
  return kort(['rtg-proof-v2', toets, stempelHash, omgevingHash].join('\n'));
}

function bewijsRecord(toets, st, omg, uitkomst, provenance, tijdstip) {
  const sleutel = bewijsSleutel(toets, st.hash, omg.hash);
  return {
    sleutel, toets, stempel: st.hash, invoerHash: st.invoerHash || st.hash,
    uitkomst: uitkomst || 'groen', tijdstip: tijdstip || Date.now(),
    leest: st.aantal, omgeving: omg.hash, profiel: omg.profiel || 'breed',
    onbegrensd: st.onbegrensd || null,
    provenance: { vertrouwd: Boolean(provenance && provenance.vertrouwd),
      commit: provenance && provenance.commit || null,
      run: provenance && provenance.run || null,
      bron: provenance && provenance.bron || 'onbekend' }
  };
}

/* HOELANG GAAT EEN BEWIJS MEE? Basis dertig dagen, en voor elk ONGEMETEN
   onderdeel van de omgeving wordt dat gehalveerd. Vier ongemeten onderdelen
   (browser, databasemotor, vlaggen, externe diensten) maakt van dertig dagen
   dus bijna twee. Dat is geen straf maar de eerlijke uitkomst: hoe minder we van
   de grond weten, hoe korter we mogen aannemen dat hij stil ligt. */
const BASISDAGEN = 30;

function houdbaarheid(omg) {
  const dagen = BASISDAGEN / Math.pow(2, (omg.ongemeten || []).length);
  return Math.max(1, Math.round(dagen * 24)) * 3600 * 1000;      // minimaal een uur
}

/* DE STEEKPROEF. Een vast deel van de erfenis draait tóch. Deterministisch per
   dag en per bewijs, zodat twee draaiingen op dezelfde dag hetzelfde besluiten
   en de keuze niet van een dobbelsteen afhangt -- maar wel elke dag rouleert, en
   dus op den duur alles raakt. */
const STEEKPROEFDEEL = 20;                                        // een op de twintig

function inSteekproef(hash, dagnummer, deel) {
  const n = parseInt(kort(hash + '#' + dagnummer).slice(0, 8), 16);
  return n % (deel || STEEKPROEFDEEL) === 0;
}

/* Mag dit bewijs meeverhuizen? Acht mogelijke antwoorden en "ja" is er maar
   een van -- en elk "nee" draagt zijn reden, want een overgeslagen toets zonder
   uitleg is niet te betwisten. */
function geldig(boek, sleutel, stempelHash, omg, nu) {
  if (boek.ongeldig) return { erven: false, status: 'UNKNOWN', reden: boek.ongeldig };
  const b = boek.bewijzen[sleutel];
  if (!b) return { erven: false, status: 'REPROVE', reden: 'geen bewijs in het boek' };
  if (boek.versie >= 2 && (!b.provenance || !b.provenance.vertrouwd)) {
    return { erven: false, status: 'UNKNOWN', reden: 'bewijs heeft geen vertrouwde clean-room-herkomst' };
  }
  if (b.uitkomst !== 'groen') return { erven: false, reden: 'het laatste bewijs was ' + b.uitkomst };
  if (b.stempel !== stempelHash) return { erven: false, reden: 'invoer of omgeving is veranderd' };
  if (b.onbegrensd) return { erven: false, reden: 'de invoer is onbegrensd: ' + b.onbegrensd };
  const leeftijd = nu - (b.tijdstip || 0);
  const max = houdbaarheid(omg);
  if (leeftijd > max) {
    return { erven: false, reden: 'verlopen (' + Math.round(leeftijd / 3600000) + 'u oud, houdbaar ' +
      Math.round(max / 3600000) + 'u bij ' + omg.ongemeten.length + ' ongemeten omgevingsdelen)' };
  }
  const dag = Math.floor(nu / 86400000);
  if (inSteekproef(stempelHash, dag)) {
    return { erven: false, reden: 'steekproef: een op de ' + STEEKPROEFDEEL + ' draait tóch, om de erfenis zelf te betrappen' };
  }
  return { erven: true, status: 'REUSED', reden: 'zelfde invoer, zelfde omgeving, ' + Math.round(leeftijd / 3600000) + 'u oud' };
}

module.exports = { omgeving, sluiting, stempel, lees, schrijf, geldig, houdbaarheid,
  omgevingVoor, nieuwBoek, boekHash, bewijsSleutel, bewijsRecord,
  inSteekproef, BOEK, BASISDAGEN, STEEKPROEFDEEL, kort };

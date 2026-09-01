#!/usr/bin/env node
/* ============================================================================
   IS HET GEWICHTREGISTER NOG EEN BESCHRIJVING VAN DE WERKELIJKHEID?

   WAAROM DIT ER IS

   Op 1 september 2026 draaide de keten een verdeling die op zijn eigen
   projectie 1,00x scoorde en in werkelijkheid 1348s tegen 526s uitliep. Er was
   niets rood. Er was ook niets te zien: TOETSDUUR.json was lokaal gemeten,
   zonder dekking, en de keten draait op een runner met dekking. Het register
   droeg dat feit gewoon in zijn stempel (`waar: lokaal`) en niemand las het.

   Een signaal dat niemand leest is geen signaal. Dit script maakt er een
   contract van: het legt het GECOMMITTE register naast een VERSE meting en zegt
   met hoeveel het ernaast zit -- en wat dat betekent voor het vertrouwen dat de
   verdeler eraan mag ontlenen.

   DRIE MATEN, EN ZE ZEGGEN ELK IETS ANDERS

     totale kosten      de suite als geheel duurder of goedkoper. Een andere
                        machine schaalt alles mee; op zichzelf niet erg, want
                        de verdeler weegt verhoudingen.
     max bestand        het ergste losse verschil. Dit is de maat die
                        ast-grens.test.js zou hebben gevangen: 430s zonder
                        dekking tegen ruim 1500s met.
     projectiefout      DE BESLISSENDE. Verdeel met de OUDE gewichten, reken de
                        last van die scherven met de NIEUWE. Wat je dan ziet is
                        precies wat de runner zou doen. Alleen deze maat vertaalt
                        drift naar wachttijd; de andere twee verklaren hem.

   WAAROM DE PROJECTIEFOUT APART STAAT. Een register kan er per bestand flink
   naast zitten en toch prima verdelen (als alles even hard meeschaalt), en het
   kan er gemiddeld dichtbij zitten en toch een scherf laten uitlopen (als juist
   het zwaarste bestand verschoven is). Wie op het gemiddelde stuurt, stuurt op
   de verkeerde grootheid.

   DE BANDEN, EN WAT ZE DOEN

     ACTUEEL      projectiefout < 10%   melden, verder niets
     VEROUDERD    projectiefout < 25%   CI stelt een nieuw register voor (PR)
     ONGELDIG     daarboven, of een andere MODUS, of geen meting
                  -> de gewogen verdeling is hier geen bewijs meer

   DIT IS GEEN POORT. Een toets die trager wordt is geen fout maar een ander
   gewicht; daar is NORM.json voor. Dit script zakt alleen als je hem dat
   expliciet vraagt (--poort), en dan nog uitsluitend op ONGELDIG -- want dat is
   geen trage toets maar een register dat niet over deze keten gaat.

   DRAAIEN

     node scripts/gewichtdrift.js --meting .toetsduur
     node scripts/gewichtdrift.js --meting a --meting b --json
     node scripts/gewichtdrift.js --meting .toetsduur --poort
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const REGISTER = path.join(WORTEL, 'TOETSDUUR.json');

const GRENS = { verouderd: 0.10, ongeldig: 0.25 };

/* De verdeling die de keten draait: de niet-geisoleerde toetsbestanden, zonder
   de ijkingen. Dezelfde verzameling als scripts/toetsduur.js gebruikt -- een
   andere verzameling geeft een ander getal met dezelfde naam. */
function ketenBestanden() {
  const { isGeisoleerd } = require('./lib/geisoleerd');
  return fs.readdirSync(path.join(WORTEL, 'test'))
    .filter((n) => n.endsWith('.test.js'))
    .filter((n) => !isGeisoleerd(n)).sort();
}

/* Verdeel met de OUDE gewichten, weeg met de NIEUWE. Dat is wat de runner doet
   als niemand het register bijwerkt, en dus wat de gebruiker voelt. */
/* De lijst is een ARGUMENT en geen verborgen aanroep naar de schijf. Zo is deze
   som te beproeven op een gecontroleerd geval; haalt hij zijn bestanden zelf
   op, dan toetst elke bewering erover in werkelijkheid de inhoud van test/. */
function projectiefout(oud, nieuw, totaal, lijst) {
  const { indeling, zetDuren } = require('./lib/delen');
  const alle = lijst || ketenBestanden();
  let bakken;
  try { zetDuren(oud); bakken = indeling(alle, totaal); } finally { zetDuren(null); }

  const bekend = Object.values(nieuw).filter((v) => v > 0);
  const zwaarste = bekend.length ? Math.max(...bekend) : 0;
  const kost = (n) => (nieuw[n] === undefined ? zwaarste : nieuw[n]);
  const lasten = bakken.map((b) => b.reduce((s, n) => s + kost(n), 0));
  const ideaal = lasten.reduce((a, b) => a + b, 0) / totaal;
  /* De fout is hoeveel de TRAAGSTE scherf boven het ideaal uitkomt -- die is
     het kritieke pad. Het gemiddelde van de vier zegt hier niets: drie snelle
     scherven maken een uitloper niet goedkoper. */
  return { fout: ideaal ? (Math.max(...lasten) - ideaal) / ideaal : 0, lasten, ideaal, bakken };
}

function vergelijk(oudModus, verseDuur) {
  const oud = (oudModus && oudModus.duur) || {};
  const gedeeld = Object.keys(verseDuur).filter((n) => oud[n] > 0);

  const somOud = gedeeld.reduce((s, n) => s + oud[n], 0);
  const somNieuw = gedeeld.reduce((s, n) => s + verseDuur[n], 0);
  const totaleKosten = somOud ? (somNieuw - somOud) / somOud : null;

  let maxBestand = null, maxNaam = null;
  for (const n of gedeeld) {
    const v = (verseDuur[n] - oud[n]) / oud[n];
    if (maxBestand === null || Math.abs(v) > Math.abs(maxBestand)) { maxBestand = v; maxNaam = n; }
  }
  return { gedeeld: gedeeld.length, totaleKosten, maxBestand, maxNaam };
}

function beoordeel({ zelfdeModus, gedeeld, fout }) {
  if (!zelfdeModus) return { status: 'ONGELDIG', waarom: 'het register gaat over een andere modus dan deze meting' };
  if (!gedeeld) return { status: 'ONGELDIG', waarom: 'geen enkel bestand komt in allebei voor' };
  if (fout === null) return { status: 'ONGELDIG', waarom: 'geen projectie mogelijk' };
  if (fout >= GRENS.ongeldig) return { status: 'ONGELDIG', waarom: 'de projectiefout is te groot om de weging nog te vertrouwen' };
  if (fout >= GRENS.verouderd) return { status: 'VEROUDERD', waarom: 'het register loopt materieel achter' };
  return { status: 'ACTUEEL', waarom: 'het register beschrijft deze keten nog' };
}

const pct = (v) => (v === null || v === undefined ? '-'
  : (v >= 0 ? '+' : '') + (v * 100).toFixed(0) + '%');

function meet(paden) {
  const { lees } = require('./toetsduur');
  const { mediaan } = require('./toetsduur');
  const { perModus } = lees(paden);

  let register = null;
  try { register = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { /* geen register */ }
  const modi = register && (register.modi ||
    (register.duur ? { onbekend: { duur: register.duur, stempel: register.stempel } } : {}));

  const uit = [];
  for (const [modus, per] of perModus) {
    const verseDuur = {};
    for (const [naam, w] of per) verseDuur[naam] = mediaan(w.map((x) => x.ms));

    const oudModus = (modi || {})[modus] || null;
    const v = vergelijk(oudModus, verseDuur);
    let fout = null, lasten = null;
    if (oudModus && v.gedeeld) {
      const p = projectiefout(oudModus.duur, verseDuur, 4);
      fout = p.fout; lasten = p.lasten;
    }
    const oordeel = beoordeel({ zelfdeModus: !!oudModus, gedeeld: v.gedeeld, fout });
    uit.push(Object.assign({ modus, fout, lasten, verse: Object.keys(verseDuur).length,
      stempel: (oudModus || {}).stempel || null }, v, oordeel));
  }
  return uit;
}

function toon(rijen) {
  for (const r of rijen) {
    console.log('\ngewichtregister  (modus ' + r.modus + ')');
    const st = r.stempel || {};
    console.log('  bron                  ' + (st.waar || 'geen register voor deze modus'));
    console.log('  runtime               ' + (st.node || '-'));
    console.log('  gemeten op            ' + (st.op ? String(st.op).slice(0, 10) : '-') +
      (st.commit ? '  (' + st.commit + ')' : ''));
    console.log('  in het register       ' + (r.gedeeld + ' bestanden ook vers gemeten'));
    console.log('  vers gemeten          ' + r.verse);
    console.log('  drift:');
    console.log('    totale kosten       ' + pct(r.totaleKosten));
    console.log('    max bestand         ' + pct(r.maxBestand) + (r.maxNaam ? '   (' + r.maxNaam + ')' : ''));
    console.log('    shard projectiefout ' + (r.fout === null ? '-' : (r.fout * 100).toFixed(0) + '%'));
    if (r.lasten) console.log('    scherven zouden     ' +
      r.lasten.map((l) => (l / 1000).toFixed(0) + 's').join(' / '));
    console.log('  status                ' + r.status + '   -- ' + r.waarom);
    console.log('  gevolg                ' + ({
      ACTUEEL: 'gewogen verdeling, geen actie',
      VEROUDERD: 'gewogen verdeling; CI hoort een nieuw register voor te stellen',
      ONGELDIG: 'de gewogen verdeling is hier geen bewijs -- de verdeler valt terug op zijn marge'
    })[r.status]);
  }
}

function main() {
  const paden = [];
  let poort = false, json = false;
  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--meting') paden.push(path.resolve(WORTEL, process.argv[++i]));
    else if (process.argv[i] === '--poort') poort = true;
    else if (process.argv[i] === '--json') json = true;
  }
  if (!paden.length) paden.push(path.join(WORTEL, '.toetsduur'));

  const aanwezig = paden.filter((p) => fs.existsSync(p));
  if (!aanwezig.length) {
    /* GEEN METING IS GEEN GOEDKEURING. Wie hier 0 teruggeeft, laat een keten
       die niets gemeten heeft groen langskomen -- precies de faalvorm die dit
       script moest wegnemen. */
    console.error('\n  Geen meting gevonden (' + paden.join(', ') + ').' +
      '\n  Zonder verse meting is over drift NIETS vast te stellen.\n');
    return poort ? 1 : 2;
  }

  const rijen = meet(aanwezig);
  if (json) console.log(JSON.stringify(rijen, null, 1));
  else toon(rijen);

  if (!rijen.length) {
    console.error('\n  De meting bevat geen enkele bruikbare waarneming.\n');
    return poort ? 1 : 2;
  }
  const slecht = rijen.filter((r) => r.status === 'ONGELDIG');
  if (poort && slecht.length) {
    console.error('\n  ONGELDIG voor: ' + slecht.map((r) => r.modus).join(', ') +
      '\n  Het register beschrijft deze keten niet. Werk hem bij voordat je' +
      '\n  de gewogen verdeling nog als winst opschrijft.\n');
    return 1;
  }
  return 0;
}

if (require.main === module) process.exit(main());
module.exports = { vergelijk, beoordeel, projectiefout, GRENS };

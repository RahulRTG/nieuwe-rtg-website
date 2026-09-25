/* ============================================================================
   HET HERHAALPAKKET -- bouwsteen 3 van BEWIJSLUS.md (par. 5), in de testwereld.

   Een fout wordt een herhaalbaar object: wat er nodig is om hem op elk artefact
   opnieuw te laten gebeuren, en niets meer. De vorm is die van de
   reproductiecapsule van het Living Lab (server/kern/livinglab/capsule.js), en de
   regels daarvan zijn overgenomen en niet opnieuw bedacht:

     AFGELEID, NIET DICHTGEKLAPT  het pakket komt uit een uitslag van de zoeker
                                  en draagt de commit waarop het is gemaakt; wie
                                  wil weten of het nog klopt, speelt het na.
     GEEN ALIASSEN                codenamen worden ROLLEN (speler-1, speler-2,
                                  ...). Een pakket dat codenamen draagt, maakt de
                                  scheiding ongedaan zodra iemand het doorstuurt.
                                  maakPakket() WEIGERT als er toch een doorheen
                                  komt -- een grendel, geen belofte.
     DE OPZET, NIET DE GEGEVENS   de begintoestand is een LEGE wereld plus de
                                  stappen die hem vullen. Er gaat geen database
                                  in, en dus ook niets wat van iemand is.

   DE EIS: hetzelfde pakket op hetzelfde artefact geeft dezelfde logische
   uitkomst, voor zover het subsysteem deterministisch te maken is -- en waar dat
   niet kan, staat het in het pakket (`voorbehoud`). De klok is NIET vastgezet:
   kern/pay leest de systeemklok voor tijdstempels, en geen van de drie wetten
   hangt ervan af. Dat staat erin in plaats van dat er stil een klok wordt
   nagebootst.

   NAAMGEVING: `replay` is in dit huis IDEMPOTENTIE (37 plekken) en `capsule` is
   van het Living Lab (BEWIJSLUS.md par. 2); `herhaalpakket` was vrij.

   Alleen de testwereld. Wat er van een PRODUCTIEfout in een pakket mag, en met
   welke bewaartermijn, is besluit 2 van BEWIJSLUS.md par. 13 en staat nog open.
   ========================================================================== */
'use strict';

const cp = require('child_process');
const tv = require('./tegenvoorbeeld');
const dv = require('./divergentie');

const VERSIE = 1;
const ROL_ONBEKEND = 'onbekend';

/* ------------------------------------------------------------ rollen */
function naarRol(spelers, naam) {
  if (naam == null) return naam;
  if (naam === tv.ONBEKEND) return ROL_ONBEKEND;
  const i = spelers.indexOf(naam);
  if (i < 0) throw new Error('onbekende deelnemer in het pakket; die kan geen rol krijgen');
  return 'speler-' + (i + 1);
}
function vanRol(spelers, rol) {
  if (rol == null) return rol;
  if (rol === ROL_ONBEKEND) return tv.ONBEKEND;
  const m = /^speler-(\d+)$/.exec(rol);
  if (!m || !spelers[Number(m[1]) - 1]) throw new Error('rol ' + rol + ' bestaat niet in deze wereld');
  return spelers[Number(m[1]) - 1];
}
const VELDEN = ['wie', 'van', 'aan'];
const omzetten = (stappen, f) => stappen.map(s => ({ ops: s.ops.map(op => {
  const n = Object.assign({}, op);
  for (const v of VELDEN) if (v in n) n[v] = f(n[v]);
  return n;
}) }));

/* ------------------------------------------------------------ het artefact */
function artefact(wortel) {
  const git = (...a) => {
    const r = cp.spawnSync('git', a, { cwd: wortel, encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
  };
  const vuil = git('status', '--porcelain', '--untracked-files=no');
  return { commit: git('rev-parse', 'HEAD'), boomSchoon: vuil == null ? null : vuil === '', node: process.version };
}

/* ------------------------------------------------------------ maken */
async function maakPakket(u, { wortel, zaad, reeksen, lengte }) {
  if (!u || !u.gevonden) throw new Error('er is geen tegenvoorbeeld om te verpakken');
  const w = tv.maakWereld({ wortel });
  const o = await dv.ontleed(u.stappen, () => tv.maakWereld({ wortel }));
  const pakket = {
    soort: 'herhaalpakket', versie: VERSIE,
    herkomst: {
      artefact: artefact(wortel || process.cwd()),
      configuratie: { simulatiebank: true, opstelling: 'server/kern/spellen/magnaat/rtg-keten.js',
        motor: 'scripts/lib/tegenvoorbeeld.js' },
      gevonden: { zaad, reeks: u.reeks, reeksen, lengte, verkleindIn: u.pogingen }
    },
    begintoestand: { soort: 'leeg', uitleg: 'een verse kern/pay zonder saldi, boekingen of verzoeken; alles wat er staat komt uit de stappen' },
    rollen: w.spelers.length,
    stappen: omzetten(u.stappen, (n) => naarRol(w.spelers, n)),
    afhankelijkheden: { betaalbank: 'server/betaal/synthetisch.js: de afloop van een oplading volgt uit de idem-sleutel, en die staat in de stappen' },
    wetten: Object.values(tv.WETTEN),
    verwacht: {
      schending: { wet: u.schending.wet, stap: u.stappen.length - 1 },
      divergentie: o.gevonden ? { van: o.divergentie.van, naar: o.divergentie.naar } : null
    },
    voorbehoud: [
      'de klok is niet vastgezet: kern/pay stempelt met de systeemklok, en geen wet hangt ervan af',
      'de volgorde binnen een gelijktijdige stap is deterministisch zolang het werk nergens op echte I/O wacht; met de Rust-motor of een echte provider is dat niet zo (BEWIJSLUS.md par. 3a)'
    ],
    bevatNiet: {
      aliassen: 'Er staan geen codenamen in, alleen rollen. Een pakket met codenamen maakt de scheiding ongedaan zodra iemand het doorstuurt.',
      ruweGegevens: 'Er zit geen database in. De begintoestand is leeg en de stappen vullen hem.',
      productie: 'Dit pakket komt uit de testwereld. Wat er van een productiefout in mag, is nog niet besloten (BEWIJSLUS.md par. 13, besluit 2).'
    }
  };
  /* DE GRENDEL: komt er toch een codenaam door, dan is er geen pakket. */
  const tekst = JSON.stringify(pakket);
  for (const naam of w.spelers.concat(tv.ONBEKEND)) {
    if (tekst.includes(naam)) throw new Error('het pakket draagt een codenaam; het wordt niet gemaakt');
  }
  return pakket;
}

/* ------------------------------------------------------------ naspelen
   Uitkomsten: `breekt` (dezelfde wet), `breekt-anders` (een andere wet --
   dat is een ander tegenvoorbeeld en geen herhaling), `houdt` (geen wet brak). */
async function speelNa(pakket, { wortel, sabotage } = {}) {   // sabotage: alleen voor de zelfijking
  if (!pakket || pakket.soort !== 'herhaalpakket') throw new Error('dit is geen herhaalpakket');
  if (pakket.versie !== VERSIE) throw new Error('herhaalpakket versie ' + pakket.versie + ' wordt hier niet gelezen (verwacht ' + VERSIE + ')');
  const maak = () => tv.maakWereld({ wortel, sabotage });
  const spelers = maak().spelers;
  if (spelers.length < pakket.rollen) throw new Error('deze wereld heeft ' + spelers.length + ' spelers en het pakket ' + pakket.rollen + ' rollen');
  const stappen = omzetten(pakket.stappen, (r) => vanRol(spelers, r));
  const u = await tv.voerUit(stappen, maak);
  const o = await dv.ontleed(stappen, maak);
  const wet = u.schending ? u.schending.wet : null;
  return {
    uitkomst: !wet ? 'houdt' : wet === pakket.verwacht.schending.wet ? 'breekt' : 'breekt-anders',
    schending: u.schending ? { wet, stap: u.stap } : null,
    divergentie: o.gevonden ? { van: o.divergentie.van, naar: o.divergentie.naar } : null,
    artefact: artefact(wortel || process.cwd())
  };
}

module.exports = { VERSIE, maakPakket, speelNa, naarRol, vanRol };

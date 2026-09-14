#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE ONDERNEMERSLUS -- draagt de lus EEN onderwerp, of is hij een reis langs
   losse deuren?

   DE VRAAG KOMT UIT ONDERNEMEN.md. Daar staat de aantrekkelijkste belofte van
   de hele ondernemerskant:

     "intake, kans, simulatie, stress, plan, rechtsvorm, oprichting, fase,
      eerste klant, dagbeeld, kas, belasting, pijplijn, capaciteit, werving,
      payroll, staff, agent, voorspelling en concern zijn geen losse producten
      meer -- het worden stations van dezelfde lus, en RTG draagt de context
      door alle fases heen."

   Ze KUNNEN stations van een lus zijn. De vraag is of ze het ZIJN, en dit huis
   heeft die vraag al vier keer gesteld en vier keer een streng antwoord
   gekregen: `Asset` (OBJECTMODEL.json), `Koopbaar` (COMMERCE.json), `Career`
   (CARRIEREVORM.json), `Moment` (STAGEVORM.json). Elke keer bleek het gedeelde
   ding een VERKLARING en geen object.

   MAAR DIT IS EEN ANDERE VRAAG DAN DIE VIER, EN DAAROM EEN ANDERE METER.

   Die vier vroegen: delen deze domeinen een VORM (dezelfde velden)? Deze vraagt:
   draagt deze keten een ONDERWERP (hetzelfde bedrijf)? Een lus kan prima uit
   stations met totaal verschillende velden bestaan -- een intake lijkt niet op
   een salarisrun en dat hoeft ook niet. Wat een lus tot lus maakt is dat station
   11 nog weet over welk bedrijf station 2 het had.

   Een vormmeter kan dat niet zien. Vandaar dit bestand; en vandaar dat het GEEN
   objectmodel.js leent, want dat zou de verkeerde vraag nauwkeurig beantwoorden.

   DRIE ASSEN, EN ZE WORDEN NOOIT OPGETELD.

     DEUR       welke sessie opent dit station? Afgeleid uit IDEMPROEF.json, dat
                per route vastlegt met welke rol hij werkelijk is aangeroepen.
                Graad `gemeten` -- maar alleen voor de routes die de proef heeft
                BEREIKT. Waar `rol` null is, betekent dat "de proef kwam er met
                geen enkele rol langs", en dat is ONBEPAALD en niet "geen deur".
                Die twee door elkaar halen verzint deuren die er niet zijn.

     ONDERWERP  wie kent het ondernemingsobject? Lexicaal gemeten: welke
                bestanden noemen de collectie waarin kern/onderneming zijn
                waarheid bewaart, OF roepen een toegang aan die dat object
                teruggeeft. Graad `vermoed`, want een naam is geen verwijzing --
                maar de uitslag is een ONDERgrens, en dat is hier de veilige
                kant: een bestand dat geen van beide noemt, kent het object
                zeker niet.

                DIE TWEEDE HELFT ONTBRAK, EN DAT WAS EEN FOUT IN DEZE METER.
                De eerste versie telde alleen de COLLECTIENAAM, en dat is een
                proxy die precies de goede architectuur niet ziet: een route
                hoort het object via kern/onderneming op te vragen
                (`ondernemingVanZaak`) en de collectie juist NIET zelf aan te
                raken. De meter zou dus 0 zijn blijven melden terwijl de brug
                er lag -- een register dat liegt in de richting van "er is een
                gat". De lijst met toegangen wordt AFGELEID uit de module zelf,
                zodat hij niet achterloopt zodra iemand er een toevoegt.

     PROEF      is dit station ooit als KETEN gelopen? Gelezen uit
                ONDERNEMERBEWIJS.json, dat die vraag al per keten beantwoordt.
                Niet nagebouwd; dat register is de bron en blijft dat.

   HET KOPGETAL IS `zaakZietOnderneming`, EN DAT IS MET OPZET.

   De lus breekt niet waar de velden verschillen maar waar de VERWIJZING
   ontbreekt. kern/onderneming kent de zaak (hij heeft `vanZaak` en `koppel`);
   de vraag is of het omgekeerde ook waar is. Staat dat getal op nul, dan is de
   lus eenrichtingsverkeer: het bedrijfsobject kan naar de werkvloer kijken en de
   werkvloer weet niet dat hij een bedrijfsobject heeft. Dat is precies de vorm
   die scripts/ritmigratie.js in de twee ritwerelden vond, en de reparatie daar
   (kern/mobiliteit/appbrug.js) is hier het model.

   Dat getal mag alleen OMHOOG. `stationsZonderRoute` en `ketensZonderProef`
   mogen alleen omlaag. Drie ratels die verschillende kanten op staan, want een
   schuld die daalt doordat het instrument blind wordt, is de gevaarlijkste vorm
   van vooruitgang (STILSPOOR.md-regel, hier op een andere meter).

   WAT DEZE METER MET OPZET NIET DOET: zeggen of de lus KLOPT. Hij telt deuren,
   verwijzingen en proeven. Of een student van achttien werkelijk bij zijn eerste
   klant uitkomt, is de vraag van een ketenproef en niet van een teller; zie
   `ketensZonderProef` voor hoeveel van die proeven vandaag ontbreken.

   Draaien: npm run ondernemerslus  (vastleggen: npm run ondernemerslus:vast)
   ========================================================================== */

const fs = require('fs');
const path = require('path');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'ONDERNEMERSLUS.json');

/* DE STATIONS. De lijst staat HIER en niet in ONDERNEMEN.md, want een lijst in
   een document loopt achter op de code zodra iemand een route hernoemt.

   De volgorde is de lus zelf en die volgorde DOET iets: `deurwissels` telt hoe
   vaak twee opeenvolgende stations een andere sessie vragen. Wie de volgorde
   verandert, verandert dat getal -- dat is geen bug maar de betekenis ervan.

   Een station zonder enkele route valt NIET stil weg; hij komt in
   `stationsZonderRoute` mét de reden. Een leeg station verzwijgen zou van een
   gat een gladde lus maken, en juist dat gat is hier de vondst. */
const STATIONS = [
  { id: 'ontdekken', naam: 'Ontdekken en leren',
    routes: /^\/api\/(leerstof|beroepenbieb|onderwijs|bijles|knelpunt)/,
    keten: null,
    wat: 'wat kan ik worden, en wat blokkeert dat' },
  { id: 'proberen', naam: 'Proberen zonder bedrijf',
    routes: /^\/api\/(experiment|proefverkoop|marktproef)/,
    keten: null,
    wat: 'een idee toetsen bij echte mensen voordat er iets wordt opgericht' },
  { id: 'starten', naam: 'Starten',
    routes: /^\/api\/onderneming\/(nieuw|intake|verkenning|rechtsvorm|plan|oprichting|aanvraag|ingeschreven)/,
    keten: 'idee-inschrijving',
    wat: 'van idee naar ingeschreven onderneming' },
  { id: 'toelating', naam: 'Toelating tot RTG',
    routes: /^\/api\/(partner\/applications|aanmeld)/,
    keten: 'toelating',
    wat: 'mag deze zaak meedoen, en is het bewijs gezien' },
  { id: 'eersteklant', naam: 'Eerste klant',
    routes: /^\/api\/onderneming\/(eersteklant|pijplijn|relaties|klussen)/,
    keten: 'offerte-factuur',
    wat: 'er moet iemand kopen' },
  { id: 'bedienen', naam: 'Bedienen',
    routes: /^\/api\/supplier\//,
    keten: 'zaak-live',
    wat: 'de dagelijkse uitvoering op de werkvloer' },
  { id: 'geld', naam: 'Geld op orde',
    routes: /^\/api\/onderneming\/(kas|belasting|debiteuren|crediteuren|voorraad|contracten)/,
    keten: 'bestelling-boekhouding',
    wat: 'wat komt binnen, wat moet eruit, wat is niet van u' },
  { id: 'werkgever', naam: 'Werkgever worden',
    routes: /^\/api\/staff\//,
    keten: 'medewerker-dienst',
    wat: 'mensen in dienst, en wat zij van hun werkgever mogen verwachten' },
  { id: 'groeien', naam: 'Structureren en groeien',
    routes: /^\/api\/concern\//,
    keten: 'tweede-vestiging',
    wat: 'entiteit, vestiging, merk, registratie' },
  { id: 'delegeren', naam: 'Delegeren',
    routes: /^\/api\/vertegenwoordiging/,
    keten: null,
    wat: 'iemand anders mag onder voorwaarden namens mij handelen' },
  { id: 'besturen', naam: 'Besturen',
    routes: /^\/api\/command\//,
    keten: null,
    wat: 'de cockpit: zien wat afwijkt en besluiten nemen' },
  { id: 'overdragen', naam: 'Overdragen',
    routes: /^\/api\/concern\/(overname|fusie)/,
    keten: null,
    wat: 'het bedrijf verkopen, fuseren of doorgeven' }
];

/* DE COLLECTIE WAARIN HET ONDERNEMINGSOBJECT WOONT. Wordt niet overgetypt maar
   GELEZEN uit de module die hem bezit: kern/onderneming/index.js declareert hem
   via kern/eigencollectie.

   EN ER STAAT EEN BESTURINGSPROEF NAAST, want de eerste versie hiervan had de
   faalvorm die dit bestand zelf beschrijft. Bij een niet-herkend patroon gooide
   hij netjes -- maar bij een HERNOEMDE collectie matcht het patroon gewoon, leest
   hij de nieuwe naam, en vindt hij nul kenners. Met een mutatie nagetrokken:
   `ondernemingen` -> `ondernemingenX` gaf geen fout maar `kennersTotaal: 0`, en
   dat leest als de duurste bevinding die deze meter kan doen ("niemand kent de
   onderneming meer") terwijl er niets aan de hand was.

   Een instrument dat niet kan uitslaan is geen instrument, en een instrument dat
   ZIJN EIGEN BLINDHEID als uitslag rapporteert is erger. Vandaar de ijking: de
   route-laag van het ondernemingsobject MOET de collectie noemen -- die leest
   hem per definitie. Vindt de meter hem daar niet, dan is niet het huis kapot
   maar de naam verouderd, en dan gooit hij alsnog. */
const IJKBESTAND = 'server/routes/member/onderneming.js';

/* DE TOEGANGEN DIE HET OBJECT ZELF TERUGGEVEN, afgeleid uit de module die ze
   exporteert. De referentietabellen vallen er met opzet BUITEN: wie
   `ondernemingRechtsvormenVanLand` aanroept vraagt een lijst rechtsvormen op en
   weet daarmee niets over een concrete onderneming. Die uitsluiting is een
   OORDEEL en staat daarom hier, zichtbaar, in plaats van in een regex. */
const GEEN_TOEGANG = /^onderneming(Rechtsvorm|RECHTSVORM)/;

function toegangen() {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/onderneming/index.js'), 'utf8');
  const namen = new Set();
  for (const m of bron.matchAll(/\bonderneming[A-Z][A-Za-z0-9_]*/g))
    if (!GEEN_TOEGANG.test(m[0])) namen.add(m[0]);
  if (!namen.size) throw new Error('ondernemerslus: geen enkele toegang gevonden in kern/onderneming/index.js; ' +
    'zonder die lijst meet de onderwerp-as alleen nog de collectienaam en meldt hij een te laag getal.');
  return [...namen].sort();
}

function collectieNaam() {
  const bron = fs.readFileSync(path.join(WORTEL, 'server/kern/onderneming/index.js'), 'utf8');
  const m = bron.match(/bezit:\s*\{\s*([A-Za-z0-9_]+)\s*:/);
  if (!m) throw new Error('ondernemerslus: de collectienaam is niet uit kern/onderneming/index.js te lezen; ' +
    'zonder onderwerp meet deze meter niets en een nul zou als bevinding gelezen worden.');
  const naam = m[1];
  const ijk = fs.readFileSync(path.join(WORTEL, IJKBESTAND), 'utf8');
  if (!new RegExp('\\b' + naam + '\\b').test(ijk))
    throw new Error('ondernemerslus: de collectie "' + naam + '" komt niet voor in ' + IJKBESTAND +
      ', terwijl juist die laag hem leest. Waarschijnlijk is de collectie hernoemd en loopt deze meter ' +
      'achter; hij zou dan 0 kenners melden en dat leest als een bevinding in plaats van als blindheid.');
  return naam;
}

/* Alle .js-bestanden onder server/, zonder de map die het onderwerp zelf bezit.
   De vraag is immers wie hem van BUITEN kent. */
function bestanden(map, uit = []) {
  for (const naam of fs.readdirSync(map)) {
    const vol = path.join(map, naam);
    const st = fs.statSync(vol);
    if (st.isDirectory()) {
      if (naam === 'node_modules' || naam === 'data') continue;
      bestanden(vol, uit);
    } else if (naam.endsWith('.js')) uit.push(path.relative(WORTEL, vol));
  }
  return uit;
}

function meet() {
  const idem = JSON.parse(fs.readFileSync(path.join(WORTEL, 'IDEMPROEF.json'), 'utf8'));
  const bewijs = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ONDERNEMERBEWIJS.json'), 'utf8'));
  const collectie = collectieNaam();

  /* ---- as 1: de deur ---- */
  const perStation = STATIONS.map((s) => {
    const rijen = idem.perRoute.filter((r) => s.routes.test(r.pad));
    const rollen = {};
    let onbepaald = 0;
    for (const r of rijen) {
      if (r.rol === null || r.rol === undefined) { onbepaald++; continue; }
      rollen[r.rol] = (rollen[r.rol] || 0) + 1;
    }
    const keten = s.keten ? (bewijs.ketens.lijst.find((k) => k.id === s.keten) || null) : null;
    return {
      id: s.id, naam: s.naam, wat: s.wat,
      routes: rijen.length,
      rollen,
      /* De DRAGENDE rol is de rol die de meeste routes van dit station opent.
         Bij gelijkspel is er geen dragende rol en staat er null -- een winnaar
         op alfabet zou een deur verzinnen. */
      dragendeRol: (() => {
        const op = Object.entries(rollen).sort((a, b) => b[1] - a[1]);
        if (!op.length) return null;
        if (op.length > 1 && op[0][1] === op[1][1]) return null;
        return op[0][0];
      })(),
      rolOnbepaald: onbepaald,
      keten: s.keten,
      ketenDekt: keten ? keten.dekt : (s.keten ? 'onbekend' : 'geen-keten-verklaard'),
      ketenMist: keten ? (keten.mist || null) : null
    };
  });

  const zonderRoute = perStation.filter((s) => s.routes === 0)
    .map((s) => ({ station: s.id, reden: 'geen enkele route matcht ' + String(STATIONS.find((x) => x.id === s.id).routes) }));

  /* De deurwissels: hoe vaak vraagt het volgende station een andere sessie dan
     het vorige. Stations zonder route slaan we over -- een station dat niet
     bestaat, is geen wissel maar een gat, en dat staat al in zonderRoute. */
  const keten = perStation.filter((s) => s.routes > 0 && s.dragendeRol);
  const wissels = [];
  for (let i = 1; i < keten.length; i++)
    if (keten[i].dragendeRol !== keten[i - 1].dragendeRol)
      wissels.push({ van: keten[i - 1].id, naar: keten[i].id,
        vanRol: keten[i - 1].dragendeRol, naarRol: keten[i].dragendeRol });

  /* ---- as 2: het onderwerp ---- */
  const toeg = toegangen();
  const woorden = new RegExp('\\b(' + [collectie].concat(toeg).join('|') + ')\\b');
  const alle = bestanden(path.join(WORTEL, 'server'));
  const noemt = alle.filter((f) => !f.startsWith('server/kern/onderneming/'))
    .filter((f) => {
      try { return woorden.test(fs.readFileSync(path.join(WORTEL, f), 'utf8')); }
      catch { return false; }
    });
  const kant = (f) => f.startsWith('server/routes/supplier/') || f.startsWith('server/routes/staff/') ? 'zaak'
    : f.startsWith('server/routes/office/') || f.startsWith('server/routes/command/') ? 'kantoor'
      : f.startsWith('server/routes/') ? 'lid' : 'kern';
  const perKant = { lid: [], zaak: [], kantoor: [], kern: [] };
  for (const f of noemt) perKant[kant(f)].push(f);

  /* ---- as 3: de proeven ---- */
  const ketensVanDeLus = STATIONS.filter((s) => s.keten).map((s) => s.keten);
  const zonderProef = ketensVanDeLus.filter((id) => {
    const k = bewijs.ketens.lijst.find((x) => x.id === id);
    return !k || k.dekt === 'geen';
  });

  return {
    stempel: stempel(),
    soort: 'projectie',
    uitleg: 'Draagt de ondernemerslus EEN onderwerp? Per station: welke sessie opent hem (uit ' +
      'IDEMPROEF.json), kent hij het ondernemingsobject (lexicaal), en is hij ooit als keten gelopen ' +
      '(uit ONDERNEMERBEWIJS.json). Dit is NIET de vormvraag van OBJECTMODEL.json -- stations mogen ' +
      'best verschillende velden hebben; een lus is een lus doordat het onderwerp meereist.',
    grens: 'Drie assen, drie graden, en ze worden nooit opgeteld. De deur is GEMETEN maar alleen voor ' +
      'de routes die de idempotentieproef heeft bereikt -- `rolOnbepaald` telt de routes waar geen ' +
      'enkele rol langskwam, en dat is onbepaald en niet "geen deur". Het onderwerp is VERMOED: een ' +
      'naam is geen verwijzing, dus dit is een ONDERgrens (wie de collectie niet noemt, kent haar ' +
      'zeker niet). De proef is overgenomen uit ONDERNEMERBEWIJS.json en hier niet nagebouwd. En deze ' +
      'meter zegt NIET of de lus klopt: dat is de vraag van een ketenproef, en `ketensZonderProef` ' +
      'telt hoeveel daarvan ontbreken.',
    onderwerp: {
      collectie,
      toegangen: toeg,
      bron: 'server/kern/onderneming/index.js',
      let: 'zowel de collectienaam als de lijst toegangen wordt uit de bezittende module GELEZEN en niet ' +
        'overgetypt; lukt dat niet, dan gooit de meter in plaats van nul te meten. Een bestand telt mee ' +
        'zodra het de collectie OF een toegang noemt -- het tweede is de architectuurvorm die de eerste ' +
        'versie van deze meter niet zag'
    },
    stations: perStation,
    stationsZonderRoute: zonderRoute,
    deurwissels: wissels,
    kenners: {
      totaal: noemt.length,
      perKant: Object.fromEntries(Object.entries(perKant).map(([k, v]) => [k, { aantal: v.length, bestanden: v.sort() }]))
    },
    ketensZonderProefLijst: zonderProef,
    ratels: {
      zaakZietOnderneming: { waarde: perKant.zaak.length, richting: 'omhoog',
        wat: 'bestanden onder routes/supplier of routes/staff die het ondernemingsobject kennen. ' +
          'Staat dit op nul, dan is de lus eenrichtingsverkeer: het bedrijfsobject ziet de werkvloer ' +
          'en de werkvloer ziet hem niet.' },
      stationsZonderRoute: { waarde: zonderRoute.length, richting: 'omlaag',
        wat: 'stations van de lus waarvoor geen enkele route bestaat' },
      ketensZonderProef: { waarde: zonderProef.length, richting: 'omlaag',
        wat: 'ketens van de lus die nooit als keten zijn gelopen (bron: ONDERNEMERBEWIJS.json)' },
      deurwissels: { waarde: wissels.length, richting: 'geen',
        wat: 'hoe vaak de lus van sessie wisselt. GEEN ratel: een wissel is niet per se een gebrek ' +
          '-- een kantoorbesluit HOORT een andere deur te hebben dan een ledenscherm. Het getal ' +
          'stuurt het ontwerp en beoordeelt het niet.' }
    },
    telling: {
      stations: STATIONS.length,
      stationsMetRoute: perStation.filter((s) => s.routes > 0).length,
      routesTotaal: perStation.reduce((n, s) => n + s.routes, 0),
      rollenInDeLus: [...new Set(perStation.map((s) => s.dragendeRol).filter(Boolean))].sort(),
      deurwissels: wissels.length,
      kennersTotaal: noemt.length,
      zaakZietOnderneming: perKant.zaak.length,
      ketensVanDeLus: ketensVanDeLus.length,
      ketensZonderProef: zonderProef.length
    }
  };
}

function druk(u) {
  console.log('\nDE ONDERNEMERSLUS -- draagt de lus EEN onderwerp?\n');
  console.log('  station'.padEnd(16) + 'routes'.padStart(7) + '  dragende deur'.padEnd(20) + 'keten');
  for (const s of u.stations) {
    const k = s.ketenDekt === 'geen' ? '\x1b[33mgeen proef\x1b[0m'
      : s.ketenDekt === 'sluit' ? '\x1b[32msluit\x1b[0m'
        : s.ketenDekt === 'deels' ? 'deels' : '-';
    console.log('  ' + s.id.padEnd(14) + String(s.routes).padStart(7) + '  ' +
      String(s.dragendeRol || '\x1b[33m(geen)\x1b[0m').padEnd(s.dragendeRol ? 18 : 27) + k);
  }
  console.log('\n  rollen in de lus      ' + u.telling.rollenInDeLus.join(', '));
  console.log('  deurwissels          ' + u.telling.deurwissels +
    (u.deurwissels.length ? '   (' + u.deurwissels.map((w) => w.van + '->' + w.naar).join(', ') + ')' : ''));
  console.log('  kent de onderneming  ' + u.telling.kennersTotaal + ' bestanden buiten de eigen map');
  for (const [k, v] of Object.entries(u.kenners.perKant)) console.log('    ' + k.padEnd(9) + String(v.aantal).padStart(3));
  console.log('\n  ' + (u.telling.zaakZietOnderneming === 0 ? '\x1b[33m' : '\x1b[32m') +
    'zaakZietOnderneming = ' + u.telling.zaakZietOnderneming + '\x1b[0m' +
    (u.telling.zaakZietOnderneming === 0
      ? '  -- de lus loopt EEN kant op: het bedrijfsobject kent de zaak, de zaak kent hem niet'
      : ''));
  console.log('  ketensZonderProef   = ' + u.telling.ketensZonderProef + ' van ' + u.telling.ketensVanDeLus +
    (u.ketensZonderProefLijst.length ? '  (' + u.ketensZonderProefLijst.join(', ') + ')' : ''));
  for (const z of u.stationsZonderRoute) console.log('\n  \x1b[33mstation zonder route: ' + z.station + '\x1b[0m -- ' + z.reden);
}

module.exports = { meet, DOEL, STATIONS };

if (require.main === module) {
  const u = meet();
  /* Geen process.exit() na een grote uitvoer: naar een bestand schrijft node
     synchroon, naar een pipe niet. Zie de pipe-regel in scripts/meetkeuring.js. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); return; }
  druk(u);
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: ONDERNEMERSLUS.json');
  }
}

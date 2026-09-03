#!/usr/bin/env node
'use strict';
/* ============================================================================
   DE RITMIGRATIE -- welke lezer van db.data.rides kan naar de opdrachtwereld?

   WAAR DIT UIT KOMT. De eigenaar heeft besloten dat de OPDRACHT de waarheid is
   (MAATSTAF.md par. 7.5) en kern/mobiliteit/appbrug.js legt de brug. Wat er
   daarna volgt is de migratie: `db.data.rides` hoort een PROJECTIE te worden in
   plaats van een zelfstandige lijst. Er zijn 34 plekken die haar lezen.

   DIE MIGRATIE WORDT NIET GERADEN. Dat is de les van `Asset` en van `Koopbaar`:
   wie eerst verklaart en dan verbouwt, komt halverwege een domein tegen dat niet
   past. Dit script telt daarom per lezer WAT hij uit een rit haalt, en of de
   opdrachtwereld dat kan leveren -- vóór er een regel wordt verplaatst.

   DRIE SOORTEN LEZER, en het onderscheid bepaalt de VOLGORDE van het werk --
   niet of het al kan:

     stand     leest de LOPENDE rit (status, chauffeur, voertuig). De
               opdrachtwereld draagt dat rijker; deze zijn na het besluit het
               eenvoudigst.
     historie  telt af over afgeronde ritten (omzet, fooi, fiscale grondslag).
               Riskanter: een teller die stil lager wordt, valt niemand op.
     schrijver maakt of wijzigt een rit. Die verdwijnen niet: zij worden de
               plek waar de projectie ontstaat.

   DE EERSTE VERSIE VAN DEZE KAART ZEI "ZEVEN KUNNEN NU OM", EN DAT WAS FOUT.
   De redenering was dat een stand-lezer alleen de lopende rit toont en de
   opdracht die rijker draagt. Wat daarbij over het hoofd werd gezien is dat een
   rit ZONDER opdracht dan uit die weergave valt -- en dan ziet een lid met een
   bestemmingsloze rit zijn eigen taxi niet meer staan in /api/live/state. Dat
   is geen migratie maar een regressie.

   De eerlijke uitkomst is dus dat GEEN ENKELE lezer om kan zolang niet elke rit
   een opdracht heeft. Dat is precies waar deze kaart voor is: hij hoort de
   migratie te stoppen voordat zij verkeerd begint, en niet achteraf te
   verklaren waarom een teller zakte.

   DE BLOKKADE IS OPGEHEVEN (3 september 2026, besluit van de eigenaar). Zij
   was: niet elke rit KAN een opdracht krijgen, want de ledenapp stuurt `toCode`
   alleen als het lid een bestemming koos en zonder bestemming loste
   kern/mobiliteit/plekken.js geen plek op.

   Het besluit maakt er een keuze van de VERVOERDER van: hij kiest zelf of hij
   ritten met een bestemming vooraf aanneemt, ritten waarbij de gast het
   onderweg zegt, of allebei (ZAAK_OPTIES in kern/leverancier.js, twee
   booleans). Neemt hij de tweede soort aan, dan krijgt zo'n rit een opdracht
   met een bestemming die expliciet `onbekend` heet -- geen afstand, geen vaste
   prijs, wel een plek op het dispatchbord. Neemt hij hem niet aan, dan bestaat
   die rit bij hem niet: kern/lidacties/ritten.js weigert hem met de reden en de
   weg eromheen. Zo of zo heeft elke rit die BESTAAT voortaan een opdracht.

   WAT ER OVERBLIJFT IS GEEN BLOKKADE MAAR EEN GEVAL PER GEVAL. `opdrachtMaak`
   kan nog steeds weigeren -- een module die in dat gebied uitstaat, een
   vertrekpunt dat niet op te lossen is -- en dan draagt de rit `opdrachtReden`.
   Dat is zichtbaar en telbaar, en het is precies het soort ding dat een lezer
   bij het omzetten moet afvangen. Het staat in de uitslag onder `restrisico`.

   Draaien:  npm run ritmigratie            (print)
             npm run ritmigratie:vast       (schrijft RITMIGRATIE.json)
   ============================================================================ */
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const DOEL = path.join(WORTEL, 'RITMIGRATIE.json');

/* Wat een lezer uit een rit haalt, en wat de opdrachtwereld daarvoor heeft.
   Handgeschreven en niet afgeleid: welk VELD een regel leest is te zien, maar
   of de opdracht hetzelfde BETEKENT is een oordeel. Elke regel draagt daarom
   een reden, en scripts/ritmigratie.js controleert alleen dat de plek nog
   bestaat -- niet dat het oordeel klopt. */
const LEZERS = {
  'server/kern/lidacties/ritten.js': { soort: 'schrijver',
    wat: 'maakt de rit (unshift) en zoekt hem terug om te betalen',
    naOmzetting: 'wordt de plek waar de projectie ontstaat: de opdracht eerst, de rit-rij als afgeleide' },
  'server/routes/member/kopen/tickets.js': { soort: 'schrijver',
    wat: 'maakt een transferrit bij een ticket, en weigert een tweede op dezelfde ticketRef',
    naOmzetting: 'idem; let op de ticketRef-controle, die kent de opdrachtwereld niet' },

  'server/kern/live.js': { soort: 'stand',
    wat: 'de lopende rit van een lid: status, chauffeur, voertuig, betaald',
    naOmzetting: 'na het besluit: de opdracht draagt dit rijker (tien standen, uitzonderingen). Nu niet -- een lid met een bestemmingsloze rit zou zijn taxi niet meer zien staan' },
  'server/kern/vervoer.js': { soort: 'stand',
    wat: 'de actieve ritten van een vervoerder, op vier standen',
    naOmzetting: 'na het besluit; let op de standvertaling in kern/mobiliteit/appbrug.js' },
  'server/routes/supplier/vervoer.js': { soort: 'stand',
    wat: 'status zetten, toewijzen, voorstellen, en de historie van een vervoerder',
    naOmzetting: 'de drie schrijfroutes zetten nu al door naar de opdracht; de leesroutes na het besluit' },
  'server/kern/ghost.js': { soort: 'stand',
    wat: 'ritten in de ghost-weergave (de chauffeurskant zonder eigen account)',
    naOmzetting: 'na het besluit; deze leest alleen en heeft geen eigen standenlogica' },
  'server/kern/ervaring/leden/annuleren.js': { soort: 'stand',
    wat: 'zoekt een rit van dit lid om te annuleren',
    naOmzetting: 'na het besluit -- en dan met winst: opdrachtAnnuleer kent een annuleringsvoorwaarde die BIJ DE BOEKING is vastgelegd' },
  'server/kern/ervaring/leden/waardering.js': { soort: 'stand',
    wat: 'zoekt een rit op ref om er een waardering aan te hangen',
    naOmzetting: 'na het besluit; de opdracht draagt dezelfde stabiele ref, dus de koppeling blijft' },
  'server/kern/leverancier/state.js': { soort: 'stand',
    wat: 'alle ritten van een zaak, behalve wacht-op-betaling',
    naOmzetting: 'na het besluit; opdrachtenVanVervoerder levert dezelfde verzameling' },

  'server/kern/fiscaal/index.js': { soort: 'historie',
    wat: 'ritomzet als fiscale grondslag',
    naOmzetting: 'PAS als elke rit een opdracht heeft -- anders vallen bestemmingsloze ritten uit de aangifte' },
  'server/kern/kantoor/index.js': { soort: 'historie',
    wat: 'betaalde ritten en de ritlijst voor het kantoorbeeld',
    naOmzetting: 'na het besluit. Een lager getal zonder reden is erger dan een ouder getal: het kantoorbeeld is waar iemand ziet of het goed gaat' },
  'server/kern/kantoor/metrics.js': { soort: 'historie',
    wat: 'lopende en afgeronde ritten in de kantoormeters',
    naOmzetting: 'na het besluit. Deze meters voeden een ratel; een stille daling leest daar als een verbetering van de belasting' },
  'server/kern/leverancier/zaak.js': { soort: 'historie',
    wat: 'fooien per dag van een zaak',
    naOmzetting: 'na het besluit. Fooi is geld van een mens: een rit die uit de telling valt, kost een chauffeur zijn deel' },
  'server/routes/supplier/backoffice.js': { soort: 'historie',
    wat: 'betaalde ritten in de backoffice van een zaak',
    naOmzetting: 'na het besluit. Dit is de omzet waarop een ondernemer zijn eigen boekhouding naleest' },
  'server/routes/member/zakelijk.js': { soort: 'historie',
    wat: 'de vervoersuitgaven van een lid',
    naOmzetting: 'na het besluit. Een lid dat zijn zakelijke kosten declareert, mist anders een rit zonder het te merken' },
  'server/routes/office/werk.js': { soort: 'historie',
    wat: 'ritten in de werklijst van het kantoor',
    naOmzetting: 'na het besluit. Een werklijst die een rit mist, laat werk liggen dat niemand meer ziet' },
  'server/routes/office/toegang.js': { soort: 'historie',
    wat: 'ritten in het toegangs- en inzagebeeld van het kantoor',
    naOmzetting: 'na het besluit, en hier telt het het zwaarst: een inzagebeeld dat een rit mist, is een onvolledig antwoord op een AVG-verzoek' },
  'server/kern/ervaring/leden/spaarpot.js': { soort: 'historie',
    wat: 'ritten die punten of spaargeld opleverden',
    naOmzetting: 'na het besluit. Punten die verdwijnen zijn een belofte die het huis terugneemt zonder het te zeggen' }
};

/* Plekken die de naam noemen zonder hem te lezen: commentaar en registers.
   Ze staan hier zodat de telling klopt en niemand ze aanziet voor werk. */
const GEEN_LEZER = {
  'server/kern/mobiliteit/appbrug.js': 'noemt de twee lijsten in zijn kop; leest ze niet',
  'server/kern/wereld/koppel.js': 'legt in commentaar uit dat rides de oudere rij is en de verwijzing naar de opdracht gaat',
  'server/lib/mutatiecontracten-uitvoer.js': 'commentaar bij een contract: de sortering raakt een kopie en nooit db.data.rides'
};

function tel() {
  const gevonden = new Map();
  function loop(map) {
    for (const naam of fs.readdirSync(map)) {
      const p = path.join(map, naam);
      const st = fs.statSync(p);
      if (st.isDirectory()) { if (naam !== 'node_modules' && naam !== 'data') loop(p); continue; }
      if (!naam.endsWith('.js')) continue;
      const rel = path.relative(WORTEL, p).replace(/\\/g, '/');
      const bron = fs.readFileSync(p, 'utf8');
      const n = (bron.match(/db\.data\.rides/g) || []).length;
      if (n) gevonden.set(rel, n);
    }
  }
  loop(path.join(WORTEL, 'server'));
  return gevonden;
}

function meet() {
  const gevonden = tel();
  const perSoort = { schrijver: [], stand: [], historie: [] };
  const onbekend = [];
  const verdwenen = [];

  for (const [rel, n] of gevonden) {
    if (GEEN_LEZER[rel]) continue;
    const l = LEZERS[rel];
    if (!l) { onbekend.push({ bestand: rel, treffers: n }); continue; }
    perSoort[l.soort].push({ bestand: rel, treffers: n, wat: l.wat, naOmzetting: l.naOmzetting });
  }
  for (const rel of Object.keys(LEZERS)) if (!gevonden.has(rel)) verdwenen.push(rel);
  for (const rel of Object.keys(GEEN_LEZER)) if (!gevonden.has(rel)) verdwenen.push(rel + ' (stond als geen-lezer)');

  const treffers = [...gevonden.values()].reduce((a, b) => a + b, 0);
  return {
    stempel: new Date().toISOString().slice(0, 10),
    uitleg: 'Per lezer van db.data.rides: wat hij eruit haalt en of de opdrachtwereld dat kan leveren. Geschreven vóór de migratie, zodat die niet wordt geraden. Zie MAATSTAF.md par. 7.5.',
    blokkade: {
      stand: 'opgeheven',
      wat: 'Was: niet elke rit kan een opdracht krijgen, want zonder bestemming loste kern/mobiliteit/plekken.js geen plek op.',
      besluit: 'De vervoerder kiest zelf welke soort ritten hij aanneemt (ZAAK_OPTIES.rittenMetDoel en .rittenZonderDoel, twee booleans). Een rit zonder bestemming krijgt een opdracht met een bestemming die expliciet `onbekend` heet; neemt de vervoerder die soort niet aan, dan wordt de rit geweigerd met de reden. Elke rit die bestaat, heeft dus een opdracht.',
      op: '2026-09-03'
    },
    restrisico: {
      wat: 'opdrachtMaak kan nog steeds per geval weigeren: een vervoersmodule die in dat gebied uitstaat, of een vertrekpunt dat niet op te lossen is. De rit draagt dan `opdrachtReden`.',
      bijOmzetting: 'elke lezer die naar de opdrachtwereld gaat, moet zo\'n rit afvangen -- zichtbaar, met de reden erbij, en nooit door hem stil uit de lijst te laten vallen.'
    },
    telling: {
      bestanden: gevonden.size,
      treffers,
      schrijver: perSoort.schrijver.length,
      stand: perSoort.stand.length,
      historie: perSoort.historie.length,
      geenLezer: Object.keys(GEEN_LEZER).length,
      onbekend: onbekend.length,
      /* De blokkade is opgeheven, dus de stand-lezers kunnen. De historie-lezers
         blijven riskanter (een teller die stil zakt valt niemand op) en gaan als
         tweede; de schrijvers als laatste, want zij worden de plek waar de
         projectie ontstaat. */
      kanNu: perSoort.stand.length,
      wachtOpBesluit: 0,
      daarna: perSoort.historie.length + perSoort.schrijver.length
    },
    perSoort, onbekend, verdwenen
  };
}

function druk(u) {
  const t = u.telling;
  console.log('ritmigratie: ' + t.bestanden + ' bestanden noemen db.data.rides (' + t.treffers + ' treffers) -- ' +
    t.stand + ' stand, ' + t.historie + ' historie, ' + t.schrijver + ' schrijver, ' +
    t.geenLezer + ' alleen commentaar, ' + t.onbekend + ' niet ingedeeld.');
  for (const soort of ['stand', 'historie', 'schrijver']) {
    console.log('\n  ' + soort.toUpperCase());
    for (const x of u.perSoort[soort]) console.log('    ' + x.bestand + '\n      ' + x.wat + '\n      -> ' + x.naOmzetting);
  }
  if (u.onbekend.length) {
    console.log('\n  NIET INGEDEELD (deel ze in, in scripts/ritmigratie.js):');
    for (const x of u.onbekend) console.log('    ' + x.bestand + ' (' + x.treffers + 'x)');
  }
  if (u.verdwenen.length) {
    console.log('\n  VERDWENEN (staan in de lijst maar noemen db.data.rides niet meer):');
    for (const x of u.verdwenen) console.log('    ' + x);
  }
  console.log('\n  BLOKKADE: ' + u.blokkade.stand + ' -- ' + u.blokkade.besluit);
  console.log('  RESTRISICO: ' + u.restrisico.wat);
  console.log('\n  ' + t.kanNu + ' lezers kunnen nu om (de stand-lezers); daarna ' + t.daarna +
    ' (' + t.historie + ' historie, ' + t.schrijver + ' schrijvers, in die volgorde).');
}

module.exports = { meet, LEZERS, GEEN_LEZER, DOEL };

if (require.main === module) {
  const u = meet();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(u)); process.exit(0); }
  druk(u);
  /* Zakt op een lezer die niemand heeft ingedeeld, en op een die uit de lijst
     is verdwenen: allebei betekenen ze dat deze kaart niet meer klopt met de
     code, en een migratiekaart die achterloopt stuurt het werk verkeerd. */
  if (u.onbekend.length || u.verdwenen.length) {
    console.error('\nde migratiekaart loopt niet gelijk met de code');
    process.exit(1);
  }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(DOEL, JSON.stringify(u, null, 2) + '\n');
    console.log('\ngeschreven: RITMIGRATIE.json');
  }
}

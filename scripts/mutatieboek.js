#!/usr/bin/env node
/* ============================================================================
   HET MUTATIEBOEK -- een route, een bak, en de optelling moet kloppen.

   HET PROBLEEM DAT DIT OPLOST. Over de schrijfroutes van dit huis lopen vier
   tellers rond die alle vier iets anders tellen en alle vier "routes" heten:

     IDEMSCHULD.json      schrijfroutes        (API, niet-GET)
     IDEMPROEF.json       routesGevonden       (idem, minus schakels en :params)
     IDEMPROEF.json       routesMetRol         (idem, minus wat geen rol heeft)
     HANDELINGPROEF.json  routesMetRol         (weer een andere selectie)

   Zolang die verschillen niet zijn UITGELEGD, is elk percentage erover
   onbruikbaar: je weet niet of "845 van 3092" een prestatie of een
   selectie-effect is. Erger nog: een route kan uit alle vier de tellingen
   vallen en dan nergens rood maken. Dat is geen groen, dat is een blinde vlek
   die als groen leest.

   WAT DIT BOEK DOET. Het begint bij EEN lijst (scripts/lib/routes.js,
   alleRoutes(), uit de router en niet uit de bron) en laat er stap voor stap
   routes uit vallen -- elke stap met een naam en een reden. Elke route valt in
   precies EEN bak. Aan het eind moet de optelling van alle bakken exact gelijk
   zijn aan de beginstand.

   DAT IS DE HELE TOETS, en hij is met opzet geen getal maar een IDENTITEIT.
   Getallen bewegen mee met elke route die erbij komt; een identiteit niet. Wie
   morgen een filter toevoegt dat routes laat verdwijnen, breekt de optelling en
   niet een drempel die iemand ooit heeft gekozen.

   WAT DIT BOEK NIET DOET. Het beoordeelt geen enkele route. Er staat hier
   nergens dat iets goed of fout is; er staat waar hij thuishoort en waarom hij
   niet verder komt in de keten. Het oordeel woont in de proeven zelf.

   DE KETEN, EN WAAROM JUIST DEZE VOLGORDE

     alles wat de router aanbiedt
       -> muteert het iets?              (anders: lezen is al idempotent)
         -> valt het te beproeven?       (schakelpaden en :params kunnen niet)
           -> is er een rol voor?        (zonder sleutel geen geldige proef)
             -> is er een besluit over?  (idemsleutels.js)

   Elke stap is een VOORWAARDE voor de volgende. Een route zonder rol kun je
   niet beproeven, dus is het zinloos hem te tellen als "onbewezen": hij is
   onbereikbaar voor dit instrument, en dat is een ander woord.

   Draai: node scripts/mutatieboek.js            (leesbaar)
          node scripts/mutatieboek.js --json
          npm run mutatieboek:vast               (schrijft MUTATIEBOEK.json)
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');

const WORTEL = path.join(__dirname, '..');
const UITSLAG = path.join(WORTEL, 'MUTATIEBOEK.json');

const { alleRoutes, isSchakel, verdeelOpRol } = require('./lib/routes');
/* Een register zonder stempel is niet na te lopen: verouderd ziet er identiek
   uit aan vers (scripts/versheid.js). Dit boek bestaat juist om afwijkingen te
   kunnen duiden, dus het zou raar zijn als hij zijn eigen ouderdom verzweeg. */
const { stempel } = require('./lib/stempel');
const { SLEUTELS } = require('../server/lib/idemsleutels');

/* De rollen die de proeven kunnen aannemen. Uit ./lib/proefsleutels.js en niet
   als eigen lijst: het boek zou anders een andere waarheid over hetzelfde
   vertellen dan de instrumenten die het beschrijft -- en dat is exact het
   probleem dat dit boek bestaat om op te lossen.

   LET OP HET VERSCHIL MET DE PROEVEN ZELF. Dit boek start geen server en weet
   dus niet of een inlog vandaag LUKT; het rekent met de rollen waarvoor een
   sleutel BESTAAT. Een proef rekent met de sleutels die hij werkelijk in handen
   heeft. Lukt de eigenaarslogin niet, dan telt het boek 156 routes als
   beproefbaar die de proef die dag overslaat -- met de reden erbij in zijn eigen
   uitslag. Dat verschil is echt en hoort hier te staan in plaats van gladgestreken. */
const { ROLLEN: ROLLEN_MET_TOKEN } = require('./lib/proefsleutels');

const sleutelVan = (r) => r.methode.toUpperCase() + ' ' + r.pad;

/* DE BAKKEN. Elke route valt in precies een van deze, en de volgorde hierbeneden
   is de volgorde waarin ze eruit vallen. `eind: true` betekent: hier eindigt de
   keten voor deze route, en dat is geen tekort maar een vaststelling. */
function boek() {
  const alles = alleRoutes();
  const bakken = [];
  const zet = (id, uitleg, routes, eind) =>
    bakken.push({ id, uitleg, aantal: routes.length, eind: !!eind,
      voorbeelden: routes.slice(0, 3).map(sleutelVan) });

  let rest = alles;

  const geenApi = rest.filter(r => !r.pad.startsWith('/api/'));
  rest = rest.filter(r => r.pad.startsWith('/api/'));
  zet('geen-api', 'Geen API-pad: een pagina, een bestand of een omleiding. Er valt geen mutatiecontract op te hangen.', geenApi, true);

  const leest = rest.filter(r => r.methode === 'GET');
  rest = rest.filter(r => r.methode !== 'GET');
  zet('leest', 'GET: leest en muteert niet. Idempotentie is hier geen vraag maar een gegeven.', leest, true);

  /* Vanaf hier is het het MUTATIEBOEK: dit zijn de routes waar een contract
     over hoort te bestaan. Alles hieronder verklaart waarom een route niet
     verder komt in de keten -- nooit dat hij goed of fout is. */
  const mutaties = rest.slice();

  const schakels = rest.filter(r => isSchakel(r.pad));
  rest = rest.filter(r => !isSchakel(r.pad));
  zet('schakelpad', 'Een schakelpad (de techniek- of functiekast). Een proef die hieraan draait, zet het huis onderuit terwijl hij meet.', schakels, true);

  const params = rest.filter(r => r.pad.includes(':'));
  rest = rest.filter(r => !r.pad.includes(':'));
  zet('padparameter', 'Het pad draagt een :parameter. Zonder een bestaand object is er niets om aan te roepen; dit vraagt een fixture en geen filter.', params, true);

  const verdeling = verdeelOpRol(rest, ROLLEN_MET_TOKEN);
  const metRol = verdeling.metRol;
  const zonderRol = verdeling.zonderRol;
  /* De redenen komen uit scripts/lib/bewakers.js en niet uit dit bestand: welke
     soort deur een bewaker is, hoort op een plek te staan (LAT.md regel 4). */
  /* DE REDENEN KOMEN UIT verdeelOpRol ZELF, en niet uit een tweede berekening.

     De eerste versie riep hier bewakerskaart.beoordeel() nog een keer aan op de
     al verdeelde routes, en kreeg voor alle 1006 dezelfde generieke zin terug:
     "de router kon geen bewakers noemen". Dat is precies de informatie die
     ertoe doet weggegooid -- de verdeling weet wel degelijk dat er 522 zonder
     bewakerslaag zijn, 62 achter huisAuth, 55 achter een boardroom-rol -- en
     die drie vragen om drie verschillende reparaties. Een tweede berekening van
     dezelfde waarheid liep hier binnen tien regels code al uit de pas (LAT.md
     regel 4). */
  const perReden = {};
  for (const r of zonderRol) {
    const reden = r.reden || 'geen reden opgegeven';
    (perReden[reden] = perReden[reden] || []).push(r.methode.toUpperCase() + ' ' + r.pad);
  }
  zet('geen-rol-met-token', 'Er is geen proefsleutel voor de rol achter deze deur. Aanroepen zonder sleutel geeft 401, en dat bewijst niets. De onderverdeling staat in zonderRolPerReden -- daar zitten drie verschillende reparaties in.', zonderRol, true);

  const verklaard = metRol.filter(r => SLEUTELS[sleutelVan(r)]);
  const schuld = metRol.filter(r => !SLEUTELS[sleutelVan(r)]);
  zet('beproefbaar-verklaard', 'Beproefbaar EN er staat een besluit over duplicaatgedrag in server/lib/idemsleutels.js.', verklaard, true);
  zet('beproefbaar-onverklaard', 'Beproefbaar, maar er is nog geen besluit over wat "hetzelfde verzoek" hier betekent. Dit is de enige bak die naar nul hoort.', schuld, true);

  /* ---------------------------------------------------------------------
     DE FORMELE STATUS PER MUTATIE.

     WAAROM DIT EEN AFLEIDING IS EN GEEN NIEUW VELD. De vraag "welke formele
     status heeft deze schrijfroute" is de goede vraag, en de verleiding is om
     er een register naast te leggen waarin een mens per route een status
     typt. Dat is precies de vorm die BEWIJSMACHINE.md aanwijst als de volgende
     botsing: een register dat naast de code leeft, loopt eruit -- en dan zijn
     er twee waarheden over dezelfde route, waarvan er een liegt.

     De status is er al. Hij zit in twee dingen die allebei al bestaan en
     allebei al bewaakt worden: de VERKLARING in server/lib/idemsleutels.js
     (wat betekent "hetzelfde verzoek" hier) en de BAK hierboven (waarom komt
     deze route niet verder in de keten). Hieronder worden die twee tot een
     status gecombineerd. Verandert de verklaring, dan verandert de status
     mee -- vanzelf, want er is niets om bij te werken.

     DE ZES STATUSSEN, en waar ze vandaan komen:

       BESCHERMD                een verklaring die zegt hoe een herhaling wordt
                                herkend (zelfdeVerzoek of velden)
       BEWUST NIET IDEMPOTENT   nietIdempotent, met een verplichte reden
       NIET VAN TOEPASSING      leest: true -- een POST die niets verandert
       NIET BEPROEFBAAR         er is geen proefsleutel voor deze deur, met de
                                reden uit de bewakerskaart
       WACHT OP EEN FIXTURE     te beproeven, maar niet met twee kale oproepen:
                                een :parameter of een objectpoort vraagt eerst
                                een levensloop (maak, geef rechten, muteer)
       NOG NIET GECLASSIFICEERD er is geen besluit. DIT IS DE ENIGE BAK DIE NAAR
                                NUL HOORT.

     Let op het onderscheid dat deze indeling maakt en een percentage niet: een
     route met status BEWUST NIET IDEMPOTENT is KLAAR. Hij telt niet mee als
     tekort, want er is over nagedacht en het staat er met een reden bij. Wie
     alles idempotent wil maken, vervormt de architectuur om een getal mooi te
     maken -- een dobbelworp die twee keer hetzelfde geeft, is stuk. */
  const statusVan = (r, bakId) => {
    const v = SLEUTELS[sleutelVan(r)];
    if (v && v.nietIdempotent) return 'BEWUST_NIET_IDEMPOTENT';
    if (v && v.leest) return 'NIET_VAN_TOEPASSING';
    if (v && (v.zelfdeVerzoek || v.velden)) return 'BESCHERMD';
    if (bakId === 'padparameter') return 'WACHT_OP_FIXTURE';
    if (bakId === 'schakelpad') return 'NIET_BEPROEFBAAR';
    if (bakId === 'geen-rol-met-token') {
      /* Twee soorten binnen een bak, en het verschil bepaalt de reparatie: een
         objectpoort of een lichaamssleutel VRAAGT een fixture (die is te
         bouwen), een ontbrekend token voor een eigen rol is een tekort van het
         instrument. Ze op een hoop gooien zou de ene laten wachten op de
         oplossing van de andere. */
      const reden = String(r.reden || '');
      if (/objectpoort|lichaamssleutel/.test(reden)) return 'WACHT_OP_FIXTURE';
      return 'NIET_BEPROEFBAAR';
    }
    return 'NOG_NIET_GECLASSIFICEERD';
  };

  const STATUSUITLEG = {
    BESCHERMD: 'Er staat verklaard hoe een herhaling wordt herkend. De idemproef kan hierop meten.',
    BEWUST_NIET_IDEMPOTENT: 'Een herhaling is een echte tweede handeling, met een verplichte reden erbij. Dit is klaar en geen tekort.',
    NIET_VAN_TOEPASSING: 'Een POST die niets verandert. Er valt niets te dedupliceren.',
    NIET_BEPROEFBAAR: 'Dit instrument heeft geen sleutel voor deze deur. De reden staat erbij; zonder sleutel aankloppen bewijst niets.',
    WACHT_OP_FIXTURE: 'Te beproeven, maar niet met twee kale oproepen: er moet eerst een levensloop worden opgebouwd (maak, geef rechten, muteer, herhaal).',
    NOG_NIET_GECLASSIFICEERD: 'Er is geen besluit over duplicaatgedrag. De enige bak die naar nul hoort.'
  };

  const perStatus = {};
  const bakVan = new Map();
  for (const b of [['schakelpad', schakels], ['padparameter', params],
    ['geen-rol-met-token', zonderRol], ['beproefbaar-verklaard', verklaard],
    ['beproefbaar-onverklaard', schuld]]) for (const r of b[1]) bakVan.set(r, b[0]);
  for (const [r, bakId] of bakVan) {
    const st = statusVan(r, bakId);
    (perStatus[st] = perStatus[st] || []).push(sleutelVan(r));
  }
  const statussen = Object.keys(STATUSUITLEG).map(id => ({
    id, uitleg: STATUSUITLEG[id], aantal: (perStatus[id] || []).length,
    moetNaarNul: id === 'NOG_NIET_GECLASSIFICEERD',
    /* TWEE ASSEN, EN ZE ZIJN NIET DEZELFDE VRAAG.

       `semantiek: true` betekent dat deze status iets zegt over het
       DUPLICAATGEDRAG van de route: wat betekent hetzelfde verzoek hier.
       `semantiek: false` zegt alleen iets over BEPROEFBAARHEID: of dit
       instrument erbij kan.

       Dat onderscheid staat hier omdat het anders vervaagt, en juist daar
       ontstaat schijnzekerheid: "4661 mutaties, 4661 met een status" leest als
       "alles verklaard", terwijl van 984 daarvan alleen bekend is dat de proef
       er niet bij kan. Dat is eerlijk over het instrument en zegt niets over de
       route. Het getal dat telt voor de belofte "elke mutatie heeft een bekende
       semantiek" staat apart, als zonderBesluitOverDuplicaat. */
    semantiek: ['BESCHERMD', 'BEWUST_NIET_IDEMPOTENT', 'NIET_VAN_TOEPASSING'].includes(id),
    voorbeelden: (perStatus[id] || []).slice(0, 3)
  }));

  /* Over hoeveel mutaties is er GEEN besluit over duplicaatgedrag, ongeacht of
     ze te beproeven zijn? Dit is hetzelfde getal dat IDEMSCHULD.json bewaakt,
     en het hoort naast de statustabel te staan zodat niemand de ene voor de
     andere aanziet. */
  const metSemantiek = statussen.filter(st => st.semantiek).reduce((n, st) => n + st.aantal, 0);

  /* DE IDENTITEIT. Alles wat de router aanbiedt zit in precies een bak. */
  const som = bakken.reduce((n, b) => n + b.aantal, 0);

  /* De verklaringen over het HELE mutatieboek, dus ook over routes die verderop
     uit de keten vallen. Een route met een :parameter kan prima een besluit
     dragen; hij is alleen niet met twee HTTP-oproepen te beproeven. Dit getal
     is daarom groter dan dat van de beproefbare bak, en dat verschil is precies
     het onderscheid dat de opzet vraagt: geclassificeerd is iets anders dan
     bewezen. */
  const mutatiesVerklaard = mutaties.filter(r => SLEUTELS[sleutelVan(r)]).length;

  return {
    stempel: stempel(),
    uitleg: 'Elke route van de router valt in precies een bak, met de reden waarom hij niet verder komt in de ' +
      'keten. De optelling van de bakken is gelijk aan het totaal; dat is de toets, en niet een van de getallen. ' +
      'Zie de kop van scripts/mutatieboek.js. Dit boek beoordeelt geen enkele route.',
    vastgelegd: new Date().toISOString().slice(0, 10),
    gemeten: {
      routesTotaal: alles.length,
      mutaties: mutaties.length,
      mutatiesVerklaard,
      mutatiesOnverklaard: mutaties.length - mutatiesVerklaard,
      beproefbaar: metRol.length,
      beproefbaarVerklaard: verklaard.length,
      bakken: bakken.length,
      statusSom: statussen.reduce((n, x) => n + x.aantal, 0),
      statusSluit: statussen.reduce((n, x) => n + x.aantal, 0) === mutaties.length,
      nogNietGeclassificeerd: (perStatus.NOG_NIET_GECLASSIFICEERD || []).length,
      metBesluitOverDuplicaat: metSemantiek,
      zonderBesluitOverDuplicaat: mutaties.length - metSemantiek,
      somVanDeBakken: som,
      sluit: som === alles.length
    },
    bakken,
    statussen,
    zonderRolPerReden: Object.entries(perReden)
      .map(([reden, lijst]) => ({ reden, aantal: lijst.length, voorbeelden: lijst.slice(0, 3) }))
      .sort((a, b) => b.aantal - a.aantal)
  };
}

/* DE VERZOENING MET DE BESTAANDE TELLERS. Niet om ze te vervangen maar om te
   laten zien dat ze hetzelfde huis beschrijven -- en om te merken wanneer een
   vastgelegd bestand achterloopt. Een afwijking is hier een BEVINDING en geen
   storing: de vastlegging is een momentopname, dit boek rekent nu. */
function verzoen(u) {
  const lees = (naam) => { try { return JSON.parse(fs.readFileSync(path.join(WORTEL, naam), 'utf8')); } catch (e) { return null; } };
  const schuld = lees('IDEMSCHULD.json'), proef = lees('IDEMPROEF.json');
  /* WANNEER IS DIT VASTGELEGD? Zonder dat is een afwijking niet te duiden: hij
     kan betekenen dat het bestand oud is, of dat de twee tellers iets anders
     tellen, en dat zijn tegengestelde conclusies. IDEMPROEF.json draagt een
     `stempel` met datum en commit; IDEMSCHULD.json draagt niets, en dan is het
     eerlijke antwoord dat de ouderdom niet vast te stellen is -- niet een
     aanname die toevallig goed uitkomt. */
  const stempelVan = (j) => (j && j.stempel && j.stempel.op) ? j.stempel.op.slice(0, 10) : null;
  const rijen = [];
  if (schuld) rijen.push({ bron: 'IDEMSCHULD.json', veld: 'schrijfroutes',
    vastgelegd: schuld.gemeten.schrijfroutes, nu: u.gemeten.mutaties,
    vastgelegdOp: stempelVan(schuld),
    zelfdeVraag: 'API-paden die niet GET zijn' });
  if (proef) {
    rijen.push({ bron: 'IDEMPROEF.json', veld: 'routesGevonden',
      vastgelegd: proef.routesGevonden, vastgelegdOp: stempelVan(proef),
      nu: u.gemeten.mutaties - bak(u, 'schakelpad') - bak(u, 'padparameter'),
      zelfdeVraag: 'mutaties zonder schakelpad en zonder :parameter' });
    rijen.push({ bron: 'IDEMPROEF.json', veld: 'routesMetRol',
      vastgelegd: proef.gemeten.routesMetRol, nu: u.gemeten.beproefbaar, vastgelegdOp: stempelVan(proef),
      zelfdeVraag: 'daarvan: de routes waarvoor een proefsleutel bestaat' });
  }
  for (const r of rijen) {
    r.verschil = r.nu - r.vastgelegd;
    r.gelijk = r.verschil === 0;
    r.duiding = r.gelijk ? 'gelijk'
      : (r.vastgelegdOp ? 'de vastlegging is van ' + r.vastgelegdOp + '; sindsdien zijn er routes bijgekomen'
                        : 'het bestand draagt geen stempel, dus de ouderdom is niet vast te stellen');
  }
  return rijen;
}
const bak = (u, id) => (u.bakken.find(b => b.id === id) || { aantal: 0 }).aantal;

function toon(u) {
  const g = u.gemeten;
  console.log('\n=== HET MUTATIEBOEK ===\n');
  console.log('  routes van de router   : ' + g.routesTotaal);
  console.log('  daarvan mutaties       : ' + g.mutaties);
  console.log('  met een besluit        : ' + g.mutatiesVerklaard + '   (onverklaard: ' + g.mutatiesOnverklaard + ')');
  console.log('  beproefbaar            : ' + g.beproefbaar + '   (waarvan verklaard: ' + g.beproefbaarVerklaard + ')');
  console.log('\n  DE BAKKEN');
  for (const b of u.bakken) console.log('    ' + String(b.aantal).padStart(5) + '  ' + b.id.padEnd(24) + b.uitleg.slice(0, 76));
  console.log('    ' + String(g.somVanDeBakken).padStart(5) + '  ' + 'SOM'.padEnd(24) +
    (g.sluit ? 'gelijk aan het totaal -- de boekhouding sluit' : 'WIJKT AF VAN HET TOTAAL (' + g.routesTotaal + ')'));
  console.log('\n  DE FORMELE STATUS VAN ELKE MUTATIE');
  for (const st of u.statussen) {
    console.log('    ' + String(st.aantal).padStart(5) + '  ' + st.id.padEnd(26) +
      (st.moetNaarNul ? '<- de enige die naar nul hoort' : st.uitleg.slice(0, 62)));
  }
  console.log('    ' + String(g.statusSom).padStart(5) + '  ' + 'SOM'.padEnd(26) +
    (g.statusSluit ? 'gelijk aan het aantal mutaties -- elke mutatie heeft een status'
                   : 'WIJKT AF VAN HET AANTAL MUTATIES (' + g.mutaties + ')'));
  console.log('\n    En dat is iets anders dan verklaard zijn: ' + g.metBesluitOverDuplicaat +
    ' van de ' + g.mutaties + ' dragen een besluit over duplicaatgedrag,');
  console.log('    ' + g.zonderBesluitOverDuplicaat + ' niet. Bij ' +
    (g.zonderBesluitOverDuplicaat - g.nogNietGeclassificeerd) +
    ' daarvan is alleen bekend dat de proef er niet bij kan.');

  console.log('\n  WAAROM ER GEEN PROEFSLEUTEL IS');
  for (const r of u.zonderRolPerReden.slice(0, 8)) console.log('    ' + String(r.aantal).padStart(5) + '  ' + r.reden.slice(0, 84));
  const v = verzoen(u);
  if (v.length) {
    console.log('\n  VERZOENING MET DE VASTGELEGDE TELLERS');
    for (const r of v) {
      console.log('    ' + (r.gelijk ? 'gelijk ' : 'afwijk ') +
        (r.bron + ' ' + r.veld).padEnd(34) + 'vastgelegd ' + String(r.vastgelegd).padStart(5) +
        '   nu ' + String(r.nu).padStart(5) + (r.gelijk ? '' : '   (' + (r.verschil > 0 ? '+' : '') + r.verschil + ')'));
      if (!r.gelijk) console.log('            ' + r.duiding);
    }
  }
  console.log('');
  return (g.sluit && g.statusSluit) ? 0 : 1;
}

function meet() { const u = boek(); u.verzoening = verzoen(u); return u; }

function main() {
  const argv = process.argv.slice(2);
  const u = meet();
  if (argv.includes('--json')) { console.log(JSON.stringify(u, null, 1)); return u.gemeten.sluit ? 0 : 1; }
  const code = toon(u);
  if (argv.includes('--vastleggen')) {
    if (!u.gemeten.sluit || !u.gemeten.statusSluit) {
      console.log('  NIET vastgelegd: een boek dat niet sluit, legt niets vast.\n'); return 1; }
    fs.writeFileSync(UITSLAG, JSON.stringify(u, null, 1) + '\n');
    console.log('  vastgelegd in MUTATIEBOEK.json\n');
  }
  return code;
}

module.exports = { meet, boek, verzoen, UITSLAG, ROLLEN_MET_TOKEN };
if (require.main === module) process.exit(main());

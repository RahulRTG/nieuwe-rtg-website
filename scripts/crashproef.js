#!/usr/bin/env node
/* ============================================================================
   DE CRASHPROEF -- wat er van een GELDROUTE overblijft als het proces sterft.

   scripts/crashas.js CLASSIFICEERT: bestaat deze crashgrens op deze route, en
   is hij te beproeven? Dat leverde 90 grenzen die bestaan EN te beproeven zijn,
   en 1 die werkelijk gemeten was. Dit script meet de andere 89.

   HET VERSCHIL MET crashgrenzen.js. Dat script stelt EEN vraag over de
   modi zelf -- raakt elke verraadsmodus een ANDER moment? -- op een enkel
   geldpad. Dit script neemt die modi als gegeven en loopt er de hele lijst
   geldroutes mee af. Zonder crashgrenzen.js zou dit script 90 metingen kunnen
   opleveren die alle drie hetzelfde moment raken.

   DE VRAAG IS ECONOMISCH EN NIET TECHNISCH, en dat bepaalt wat er gemeten
   wordt. Een route mag netjes 500 geven terwijl drie van de vijf collecties al
   tweemaal zijn aangepast. Daarom kijkt deze proef niet naar het ANTWOORD --
   dat is er bij een crash per definitie niet -- maar naar de INHOUD van de
   opslag na de herstart, via scripts/droogloop.js. Er komt geen tweede lezer
   van de opslag bij, en geen tweede wereldbouwer: de wereld en de lijven komen
   uit scripts/lib/idemwereld.js, dezelfde die de idempotentieproef gebruikt.

   DE HERSTARTRUIS WORDT EERST GEMETEN EN DAARNA AFGETROKKEN. Een server die
   opstart schrijft zelf: sessies, migraties, een spoorregel. Zonder die ruis
   apart te meten zou elke ronde "er is iets veranderd" zeggen en zou ATOMIC
   nergens te halen zijn. De ruisronde draait EEN keer, zonder verraad, en doet
   verder exact hetzelfde: opstellen, snapshot, doden, herstarten, snapshot.

   WAT EEN UITSLAG BETEKENT -- en `PROVEN` is er maar een van:

     PROVEN            de grens is geraakt en de belofte gehouden
     PROVEN_PARTIAL    de herstart lukte, maar de dubbeling is NIET beoordeeld:
                       deze route hoort bij een tweede oproep werk te doen, dus
                       "er kwam iets bij" is hier geen fout
     FAILED            de grens is geraakt en er staat iets wat er niet hoort
     GEEN_DUURZAME_WEG de modus stond scherp, de route deed zijn werk en stierf
                       NIET. Dan heeft hij `bijeen()` noch `saveDuurzaam()`
                       aangeroepen: hij schrijft via de gewone write-behind
                       save(). Deze twee grenzen BESTAAN dus niet op zijn pad --
                       en dat is geen geruststelling, want wat hem wel bedreigt
                       is een VERLOREN schrijfactie, en dat is `schrijf-verloren`
                       en niet deze proef
     BLOCKED_BODY      de route keurde het VERZOEK af (400/422) en raakt
                       `req.body`. Werk: een lijf in idemwereld.js
     BLOCKED_WORLD     het verzoek kwam door de controle en strandde op de
                       TOESTAND (402/404/409/423/429). Werk: een voorziening
     BLOCKED_FEATURE   de DIENST weigerde (503). Hier staat een schakelaar of
                       een afhankelijkheid, en daar helpt geen lijf en geen
                       fixture aan -- niet de proefwereld gaan uitbreiden
     BLOCKED_ROLE      de deur ging niet open (401/403). Werk: de juiste rol
     BLOCKED_ONBEPAALD niet in te delen zonder te kijken -- bijvoorbeeld een
                       route die 400 geeft terwijl hij `req.body` niet aanraakt
     WERELD_ONTBREEKT  deze route heeft een onderwerp nodig dat de wereld niet
                       klaarzette -- met erbij WAT er zou moeten bestaan
     BLOCKED           de opstelling zelf kwam niet rond

   Draaien:  npm run crashproef
             npm run crashproef -- --pad=/api/pay/saldo
             npm run crashproef -- --routes=5 --json
   ========================================================================== */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const W = require('./lib/wegwerpserver.js');
const { inhoudsBeeld, verschil, isSpoor } = require('./droogloop.js');
const { haalSleutels } = require('./lib/proefsleutels.js');
const verraad = require('../server/lib/verraad.js');
const { sleutelVoor } = require('../server/lib/idemsleutels.js');

const WORTEL = path.join(__dirname, '..');

/* Elke wegwerpserver hangt een opruimhaak aan `process.exit`, en deze proef
   start er vier per ronde. Boven de tien waarschuwt node over een lek dat er
   niet is: de haken horen bij servers die nog kunnen draaien, en ze verdwijnen
   met het proces. De waarschuwing zou hier wel elke ronde de uitslag
   vertroebelen. */
process.setMaxListeners(0);
const argv = process.argv.slice(2);
const jsonUit = argv.includes('--json');
const vastleggen = argv.includes('--vastleggen');
const alleenPad = (argv.find(a => a.startsWith('--pad=')) || '').slice(6) || null;
const maxRoutes = Number((argv.find(a => a.startsWith('--routes=')) || '').slice(9)) || 0;

/* ============================================================================
   DRIE ONAFHANKELIJKE FEITEN, EN PAS DAARNA EEN CONCLUSIE.

   De eerste indeling keek naar EEN ding: heeft idemwereld.js een lijf voor dit
   pad? Zo nee, dan heette het BLOCKED_BODY. Dat is een NEGATIEF signaal over de
   proef, gebruikt als uitspraak over de route -- en het ging meteen mis op
   /api/supplier/oog/overzicht: die route leest de body helemaal niet
   (`res.json(oogOverzicht(req.supplier))`) en gaf 503. Een lijf schrijven zou
   daar nooit iets deblokkeren. Dat was een METERfout en geen routeprobleem.

   Daarom nu drie feiten die los van elkaar worden vastgesteld:

     leestBody   raakt de route `req.body`? Gelezen uit de BRON op de regel die
                 ROUTEBRON.json aanwijst. Lexicaal, dus graad `vermoed`.
     status      wat de server antwoordde. Hard.
     bereiktTot  hoe VER de proef kwam, afgeleid uit die status.

   Pas daaruit volgt waar hij blokkeert. Een route die geen body leest, kan
   nooit op de body stranden -- hoe verleidelijk het ontbrekende lijf ook is.

   BEREIKTTOT IS ZELF DE WINST, los van de blokkade. "De route is aangeroepen"
   betekent niet dat de duurzame commitgrens is gehaald; deze trede zegt tot
   hoever de proef werkelijk is gekomen, en dat is precies wat de crash-as nodig
   heeft om te weten of een grens uberhaupt in zicht was. */
const TREDEN = Object.freeze({
  CRASHGRENS: 'het proces stierf: de injectie is geraakt, de crashgrens is gehaald',
  HANDLER_VOLTOOID: 'de handler liep af en gaf een 2xx',
  ROLPOORT: 'de deur ging niet open -- de proef kwam niet voorbij de rol',
  DIENSTPOORT: 'de dienst zelf weigerde (503): een schakelaar of afhankelijkheid, niet het verzoek',
  VERZOEKCONTROLE: 'de route keurde het verzoek af voordat hij aan het werk ging',
  DOMEINVOORWAARDE: 'het verzoek klopte, maar de toestand die de route nodig heeft ontbrak',
  ONBEPAALD: 'de status past in geen van de treden'
});

function tredeVan(status) {
  if (status === 0) return 'CRASHGRENS';
  if (status >= 200 && status < 300) return 'HANDLER_VOLTOOID';
  if (status === 401 || status === 403) return 'ROLPOORT';
  if (status === 503) return 'DIENSTPOORT';
  if (status === 400 || status === 422) return 'VERZOEKCONTROLE';
  if ([402, 404, 409, 423, 429, 412].includes(status)) return 'DOMEINVOORWAARDE';
  return 'ONBEPAALD';
}

/* Waar blokkeert hij, en waarop moet iemand dus werken? De drie soorten vragen
   totaal verschillende reparaties, en dat is de hele reden dat ze uit elkaar
   staan: een LIJF schrijf je in idemwereld.js, een WERELD bouw je als
   voorziening, en een FEATURE los je niet op met een fixture -- daar staat een
   schakelaar. Wie die drie op een hoop gooit, breidt de proefwereld uit om een
   getal groen te krijgen. */
function weegBlokkade({ status, leestBody, voorziening }) {
  const trede = tredeVan(status);
  /* HET VIERDE FEIT, EN HET IS EEN FEIT OVER DE PROEF ZELF. Viel de voorziening
     om, dan is de blokkade niet aantoonbaar van de route: het onderwerp dat zij
     moest klaarzetten is er nooit gekomen. De stand blijft staan -- wij weten
     niet waar hij zou stranden met een heel onderwerp -- maar de reden wijst
     naar de proef en niet naar de wereld. Zonder dit stuurde een kapotte haak
     zes routes de verkeerde kant op. */
  const haakStuk = voorziening && voorziening.stand === 'mislukt'
    ? ' LET OP: de voorziening voor dit pad viel om (' + voorziening.reden + '), dus dit ' +
      'onderwerp is nooit klaargezet -- kijk daar eerst, want deze blokkade kan van de PROEF zijn'
    : '';
  if (trede === 'CRASHGRENS' || trede === 'HANDLER_VOLTOOID')
    return { bereiktTot: trede, blokkeertOp: null };
  if (trede === 'ROLPOORT') return { bereiktTot: trede, blokkeertOp: 'ROL',
    reden: 'de proef kwam niet voorbij de deur (' + status + '); dat is een rol of een sleutel ' +
      'en geen lijf' };
  if (trede === 'DIENSTPOORT') return { bereiktTot: trede, blokkeertOp: 'FEATURE',
    reden: 'de DIENST weigerde (503), niet het verzoek -- hier staat een schakelaar of een ' +
      'afhankelijkheid, en daar helpt geen lijf en geen fixture aan' };
  if (trede === 'VERZOEKCONTROLE') {
    if (leestBody === false) return { bereiktTot: trede, blokkeertOp: 'ONBEPAALD',
      reden: 'de route wees het verzoek af (' + status + ') terwijl hij `req.body` niet aanraakt; ' +
        'dan is het lijf niet de oorzaak en moet iemand kijken wat hij dan wel afkeurt' };
    return { bereiktTot: trede, blokkeertOp: 'LIJF',
      reden: 'de route keurde het verzoek af (' + status + ') voordat hij aan het werk ging: ' +
        'het lijf dekt niet wat hij vraagt' + haakStuk };
  }
  if (trede === 'DOMEINVOORWAARDE') return { bereiktTot: trede, blokkeertOp: 'WERELD',
    reden: 'het verzoek kwam door de controle heen en strandde op de TOESTAND (' + status + '): ' +
      'de wereld mist een voorwerp of een stand die deze route nodig heeft' + haakStuk };
  return { bereiktTot: 'ONBEPAALD', blokkeertOp: 'ONBEPAALD',
    reden: 'status ' + status + ' past in geen van de treden; niet indelen zonder te kijken' };
}

const STAND_VAN_BLOKKADE = Object.freeze({
  LIJF: 'BLOCKED_BODY', WERELD: 'BLOCKED_WORLD', FEATURE: 'BLOCKED_FEATURE',
  ROL: 'BLOCKED_ROLE', ONBEPAALD: 'BLOCKED_ONBEPAALD'
});

/* LEEST DEZE ROUTE DE BODY? Uit de bron, op de regel die ROUTEBRON.json
   aanwijst. Het venster loopt tot de volgende route-registratie of veertig
   regels -- een handler die langer is dan dat en zijn body pas daarna aanraakt,
   leest hier dus `false`. Lexicaal en dus graad `vermoed`; hij staat als EIGEN
   veld in de uitslag zodat een lezer hem kan wantrouwen. */
const ROUTEBRON = (() => {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(WORTEL, 'ROUTEBRON.json'), 'utf8'));
    const op = new Map();
    for (const r of Object.values(j.perRoute || {})) op.set(r.route, r);
    return op;
  } catch (e) { return new Map(); }
})();

function leestBodyVan(methode, pad) {
  const b = ROUTEBRON.get(methode + ' ' + pad);
  if (!b || !b.bestand) return { leest: null, grond: 'ROUTEBRON.json wijst voor dit pad geen bron aan' };
  let regels;
  try { regels = fs.readFileSync(path.join(WORTEL, b.bestand), 'utf8').split('\n'); }
  catch (e) { return { leest: null, grond: 'de bron ' + b.bestand + ' is niet te lezen' }; }

  /* HET REGELNUMMER IS EEN AANWIJZING EN GEEN ADRES, en die twee door elkaar
     halen kostte hier een verkeerde uitslag. Twee oorzaken, allebei echt:

       1. ROUTEBRON.json wees voor /api/supplier/giftcard/sell naar regel 27
          terwijl de `app.post` op 29 staat. Het venster begon dus VOOR de
          registratie, en de bewaking "stop bij de volgende route" sloeg aan op
          de EIGEN registratieregel -- twee regels later, ruim voor de
          `req.body` op regel 32. Uitslag: leestBody false, terwijl die route
          zijn body wel degelijk leest.
       2. ROUTEBRON.json is een REGISTER en kan achterlopen op de bron. Vier
          bankroutes schoven op doordat ik kantoren/bank.js heb bewerkt; het
          register was daarvoor gemeten.

     Daarom wordt het pad nu ZELF opgezocht in een venster rond de aanwijzing,
     en begint de handler daar. Wordt het pad niet gevonden, dan is het antwoord
     `null` -- onbekend -- en nadrukkelijk niet `false`: een verouderd register
     mag geen zelfverzekerd verkeerd antwoord opleveren. */
  const hint = Math.max(0, (b.regel || 1) - 1);
  let begin = -1;
  for (let i = Math.max(0, hint - 5); i < Math.min(regels.length, hint + 15); i++)
    if (regels[i].includes("'" + pad + "'") || regels[i].includes('"' + pad + '"')) { begin = i; break; }
  if (begin < 0) return { leest: null,
    grond: b.bestand + ' noemt ' + pad + ' niet rond regel ' + (b.regel || 1) +
      ' -- ROUTEBRON.json loopt hier achter op de bron' };

  const eind = Math.min(regels.length, begin + 40);
  for (let i = begin; i < eind; i++) {
    if (i > begin && /\bapp\.(post|get|put|delete|patch)\s*\(/.test(regels[i])) break;
    if (/req\.body/.test(regels[i]))
      return { leest: true, grond: b.bestand + ':' + (i + 1) + ' raakt req.body' };
  }
  return { leest: false, grond: b.bestand + ':' + (begin + 1) + ' raakt `req.body` niet binnen de handler' };
}

/* De twee grenzen die een injectiepunt HEBBEN. `in-de-opslag` staat er met
   opzet niet bij: crashgrenzen.js heeft gemeten dat hij op een transactionele
   opslag geen eigen moment heeft, en scripts/crashas.js draagt dat als een
   gemeten `nee`. Een proef die hem toch zou draaien, meet sterf-na-commit nog
   een keer en noemt dat dekking. */
const GRENZEN = [
  { grens: 'voor-eerste-mutatie', modus: 'sterf-voor-mutatie',
    belofte: 'er hoort geen spoor te zijn -- de collecties van deze route staan onaangeroerd' },
  { grens: 'na-commit-voor-antwoord', modus: 'sterf-na-commit',
    belofte: 'de uitkomst staat vast, en een herhaling na de herstart legt er niets bovenop' },
  /* DE DERDE GRENS, sinds 13 september. CRASHAS.json had `na-commit-voor-bericht`
     op 45 van de 45 routes `onbekend` -- meer dan de helft van alle 89 open
     vragen -- en niet uit onwetendheid maar omdat er geen moment was om in te
     sterven. Dat moment bestaat nu (server/opzet/meldaan.js).

     DE BELOFTE IS HIER ANDERS DAN BIJ DE TWEE HIERBOVEN, en dat is het punt van
     een eigen grens: die gaan over de UITKOMST, deze over de MENS. Een route mag
     atomair en herstelbaar zijn en de betrokkene alsnog nooit iets laten horen. */
  /* DE BELOFTE IS SMALLER DAN DE GRENS, met opzet en met de reden erbij.

     Hier stond eerst "de uitkomst staat vast, EN DE BETROKKENE HOORT ER ALSNOG
     VAN". Dat tweede deel toetst geen van de vier beweringen van het
     overlevingscontract, en een belofte die niets handhaaft is precies wat dit
     huis elders weigert. Om hem WEL te toetsen zou de proef moeten weten of
     deze route iemand HOORT te berichten, en dat staat nergens: GELDDEKKING.json
     verklaart per route zijn geldcollecties en geen meldplicht.

     Wat er wel kan, staat in de rij als FEIT en niet als oordeel: `meldingBewoog`
     zegt of er na de crash een meldingsbak is bewogen. Een `false` daar is geen
     gezakte belofte -- de meeste geldroutes berichten niemand -- maar het is het
     signaal waarmee een mens kan besluiten of hier een meldplicht hoort. */
  { grens: 'na-commit-voor-bericht', modus: 'sterf-voor-bericht',
    belofte: 'de uitkomst staat vast na een dood op het meldmoment; OF de betrokkene bericht ' +
      'hoorde te krijgen staat niet in enig register en wordt hier dus niet beoordeeld' }
];

const OFFICE = 'RTG-OFFICE-PROEF';
const SERVEROMGEVING = { RTG_DEMO: '1', RTG_MAGNAAT_TEST: '1', OFFICE_CODE: OFFICE };

async function post(basis, pad, lijf, tok) {
  try {
    const r = await fetch(basis + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
      body: JSON.stringify(lijf || {}) });
    const tekst = await r.text();
    let data; try { data = JSON.parse(tekst); } catch (e) { data = tekst; }
    return { status: r.status, data };
  } catch (e) { return { status: 0, data: String(e.message) }; }
}

/* De opstelling: een verse server, de sleutelbos, en de geldwereld van
   idemwereld.js. Geeft ook het LIJF van deze route terug -- dat is waarom die
   module bestaat: een plausibel lijf kent de IBAN's van DEZE database niet, en
   dan strandt de oproep op "deed geen werk" in plaats van op de crash. */
async function stelOp(datamap) {
  const srv = await W.start({ naam: 'crashproef', datamap, env: SERVEROMGEVING });
  const p = (pad, lijf, tok) => post(srv.basis, pad, lijf, tok);
  const bos = await haalSleutels({ post: p });
  const { zetWereldKlaar, voorzieningVoor } = require('./lib/idemwereld');
  const w = await zetWereldKlaar({ post: p, tokens: bos.tokens, datamap });
  const { gedeeldLijf } = require('./lib/idemwereld');
  return { srv, p, bos, wereld: w.wereld, lijven: w.perRoute || {},
    gedeeld: gedeeldLijf(w.wereld), voorzieningVoor };
}

/* De ruis van een herstart: wat schrijft de server uit zichzelf? Een keer
   gemeten, want dit hangt aan de server en niet aan de route. Zonder deze
   aftrek zou geen enkele route ooit ATOMIC halen. */
async function meetHerstartruis() {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashruis-'));
  let srv = null;
  try {
    const a = await stelOp(map);
    srv = a.srv;
    /* Exact dezelfde vorm als ronde(): beide momentopnamen terwijl een verse
       schone server draait, en er even veel starts tussen. Een ruisronde die
       anders meet dan de ronde die hem gebruikt, trekt het verkeerde af. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const voor = inhoudsBeeld(map);
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const na = inhoudsBeeld(map);
    return (verschil(voor, na) || []).filter(k => !isSpoor(k));
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

/* Raakt deze sleutel uit het opslagbeeld een collectie die DEZE route
   declareert? De sleutels heten `boek:collectie`, dus het laatste deel telt. */
const vanRoute = (route) => (sleutel) => route.collecties.includes(String(sleutel).split(':').pop());

/* ============================================================================
   HET OVERLEVINGSCONTRACT -- vier beweringen, en de strengste wint.

   "Het proces stierf en kwam terug" is geen crashbewijs. Een route kan netjes
   sterven, netjes herstarten, en ondertussen de helft van zijn uitkomst hebben
   laten staan. Daarom declareert elke proef vooraf wat er NA de herstart waar
   moet zijn, en worden er vier dingen apart bewezen:

     toestand    de toestand na herstart is wat DEZE grens belooft
     geenHalf    er staat geen half resultaat -- niet een deel van de collecties
     geenVals    de aanroeper kreeg geen vals succes en geen vals falen
     geenDubbel  opnieuw aanbieden veroorzaakt geen tweede effect

   DIE LAATSTE IS DE HELFT VAN HET GEHEEL. Crashveiligheid zonder retry-proef is
   maar de helft van crashveiligheid: een route die na een crash-voor-de-mutatie
   niets heeft achtergelaten, is pas veilig als je hem OPNIEUW mag aanbieden en
   er dan precies een effect ontstaat. Vandaar dat ook de ATOMIC-grens een
   retry-proef draagt, en niet alleen de grens na de commit.

   De vier staan APART en worden nooit opgeteld. De stand van een rij is de
   STRENGSTE van zijn beweringen -- dezelfde regel als in BETROUWBAARHEID.md --
   en een bewering die niet beproefd kon worden heet NIET_BEPROEFD met de reden,
   nooit stilzwijgend PROVEN. Een bewijs dat je weglaat, leest als een bewijs dat
   je haalt. */
const CLAIMS = Object.freeze({
  toestand: 'de toestand na herstart is wat deze crashgrens belooft',
  geenHalf: 'er staat geen half resultaat: niet een deel van de collecties van deze route',
  geenVals: 'de aanroeper kreeg geen vals succes en geen vals falen',
  geenDubbel: 'opnieuw aanbieden veroorzaakt geen tweede effect'
});

const STRENGSTE = ['FAILED', 'NIET_BEPROEFD', 'PROVEN'];
const strengste = (standen) => STRENGSTE.find(s => standen.includes(s)) || 'NIET_BEPROEFD';

/* DE WEGING VAN EEN HERHALING NA DE HERSTART.

   HIER STOND EEN VERKEERDE AUTORITEIT, en dat is een correctie die verder reikt
   dan deze functie. De regel las `idempotentie` uit GELDDEKKING.json (dus uit
   IDEMPROEF.json) en velde FAILED zodra een route die `beschermd` heet bij de
   herhaling opnieuw werk deed. Dat label is echter gemeten onder omstandigheden
   die een crash-retry NIET kan reproduceren:

     - IDEMPROEF meet met een EXPLICIETE sleutel (K1, K1 opnieuw, K2 vers);
     - en de kale variant leunt op server/lib/idemsleutels.js, waarvan het
       venster VIJF SECONDEN is (VENSTER_MS).

   Een crash met een herstart duurt langer dan vijf seconden. De idem-poort kan
   een herhaling na een crash dus STRUCTUREEL niet herkennen -- niet omdat er
   iets stuk is, maar omdat het venster verlopen is tegen de tijd dat de klant
   het opnieuw probeert. Bescherming die een herstart overleeft, moet daarom uit
   de TOESTAND komen en niet uit de poort. /api/pay/saldo laat zien hoe dat
   eruitziet: de herhaling krijgt 409 omdat de factuur al betaald IS.

   De juiste autoriteit voor "is een tweede effect een defect of de bedoeling"
   is de VERKLARING per route in idemsleutels.js -- die zegt precies dat, en
   niet een meting onder andere omstandigheden. Staat er geen verklaring, dan is
   het onbeslisbaar en heet het NIET_BEPROEFD. Twee routes stonden op FAILED die
   daar niet horen: /api/office/bank/draai betekent letterlijk "de knop een slag
   verder", en dan IS een tweede oproep een tweede handeling.

   Wat geen verklaring nodig heeft, is de goede afloop: legde de herhaling niets
   bovenop, dan is de belofte gehouden -- dat is een positief feit.

   Deze functie staat apart en wordt geexporteerd omdat test/crashproef.test.js
   hem narekent. Een toets die de regel OVERSCHRIJFT in plaats van aanroept,
   blijft groen als de regel verandert. */
function weegHerhaling(bijgekomen, verklaring) {
  if (bijgekomen === 0) return { stand: 'PROVEN',
    reden: 'de herhaling na de herstart legde niets bovenop de uitkomst -- en dat is een ' +
      'toestandsbescherming, want de idem-poort is na een herstart uit beeld (venster 5s)' };
  if (verklaring && (verklaring.zelfdeVerzoek || verklaring.velden)) return { stand: 'FAILED',
    reden: 'idemsleutels.js verklaart een woordelijk gelijk verzoek hier als een HERHALING, maar ' +
      'na de herstart deed hij opnieuw werk in ' + bijgekomen + ' collectie(s). De poort dekt dit ' +
      'niet af: haar venster is 5 seconden en een herstart duurt langer, dus deze bescherming ' +
      'moet uit de toestand komen' };
  return { stand: 'NIET_BEPROEFD',
    reden: 'de herhaling deed werk in ' + bijgekomen + ' collectie(s), maar idemsleutels.js ' +
      'verklaart voor dit pad niet of een woordelijk gelijk verzoek een herhaling is of een ' +
      'tweede handeling. Zonder die verklaring is een tweede effect niet te beoordelen -- ' +
      '"de knop een slag verder" hoort twee keer te draaien' };
}

/* Weegt de vier beweringen uit de gemeten grootheden. Alle invoer is GEMETEN;
   deze functie redeneert alleen. Zij staat apart zodat de toets haar aanroept.

   `verwachtLeeg` zegt of DEZE grens belooft dat er niets veranderd is (dat is de
   ATOMIC-grens) of juist dat de uitkomst er hoort te staan (na de commit). */
function weegContract({ verwachtLeeg, geraakt, aantalCollecties, status, gestorven,
  herhaalStatus, bijgekomen, verklaring, grens, berichtAan, meldingBewoog }) {
  const c = {};

  /* 1. TOESTAND. Voor de grens voor de mutatie: er hoort niets te staan. Voor de
        grens na de commit: de uitkomst hoort er juist WEL te staan -- een lege
        uitkomst betekent daar dat de commit niet duurzaam was. */
  if (verwachtLeeg) c.toestand = geraakt === 0
    ? { stand: 'PROVEN', reden: 'geen enkele collectie van deze route veranderde' }
    : { stand: 'FAILED', reden: geraakt + ' collectie(s) veranderden terwijl er niets gemuteerd mocht zijn' };
  else c.toestand = geraakt > 0
    ? { stand: 'PROVEN', reden: 'de uitkomst staat na de herstart in ' + geraakt + ' collectie(s)' }
    : { stand: 'FAILED', reden: 'na de commit hoort de uitkomst er te staan, maar geen enkele ' +
        'collectie van deze route veranderde -- de commit overleefde de herstart niet' };

  /* 2. GEEN HALF RESULTAAT. Alleen te vellen als de route MEER dan een collectie
        schrijft: bij een enkele collectie bestaat "half" niet, en dan is dit
        geen bewijs maar een tautologie. */
  if (aantalCollecties < 2) c.geenHalf = { stand: 'NIET_BEPROEFD',
    reden: 'deze route schrijft een collectie, dus "half" bestaat hier niet als toestand' };
  else if (geraakt === 0 || geraakt === aantalCollecties) c.geenHalf = { stand: 'PROVEN',
    reden: geraakt === 0 ? 'er staat niets, dus zeker niets half'
      : 'alle ' + aantalCollecties + ' collecties bewogen samen' };
  else c.geenHalf = { stand: 'FAILED',
    reden: geraakt + ' van de ' + aantalCollecties + ' collecties veranderden -- dit is precies ' +
      'het halve resultaat dat het ATOMIC-contract uitsluit' };

  /* 3. GEEN VALS SUCCES EN GEEN VALS FALEN. Een crash geeft GEEN antwoord, en
        dat is eerlijk: de aanroeper weet dat hij het niet weet. Het wordt pas
        vals als er wel een antwoord kwam en dat antwoord niet klopt met wat er
        is blijven staan. */
  if (gestorven) c.geenVals = { stand: 'PROVEN',
    reden: 'de verbinding brak zonder antwoord -- de aanroeper krijgt geen bewering, dus ook geen valse' };
  else if (status >= 200 && status < 300 && geraakt === 0 && !verwachtLeeg) c.geenVals =
    { stand: 'FAILED', reden: 'de aanroeper kreeg ' + status + ' maar er bleef niets staan: vals succes' };
  else if (status >= 500 && geraakt > 0) c.geenVals =
    { stand: 'FAILED', reden: 'de aanroeper kreeg ' + status + ' terwijl er wel degelijk ' + geraakt +
      ' collectie(s) veranderden: vals falen' };
  else c.geenVals = { stand: 'PROVEN',
    reden: 'het antwoord (' + status + ') komt overeen met wat er is blijven staan' };

  /* 5. IS DE BETROKKENE BERICHT? ALLEEN OP DE MELDGRENS, en alleen als iemand
        heeft VERKLAARD dat hier bericht hoort te gaan.

        Deze bewering bestaat omdat de belofte van die grens anders niets
        handhaaft: de proef kan zien dat er geen melding ontstond, maar niet of
        dat erg is. Dat staat in MELDBESLUIT.json, en dat register is met opzet
        leeg tot de eigenaar het invult -- dus zolang niemand iets verklaarde,
        zegt deze bewering NIET_BEPROEFD en nooit stil PROVEN.

        Let op de asymmetrie, die uit het register zelf komt: een gemeten `false`
        bewijst NIET dat er geen meldplicht is. Daarom is de ontbrekende
        verklaring UNKNOWN en niet GEEN_BERICHT. */
  if (grens === 'na-commit-voor-bericht') {
    if (berichtAan === 'BERICHT_VEREIST') c.berichtGeland = meldingBewoog
      ? { stand: 'PROVEN', reden: 'er is bericht ontstaan ondanks de dood op het meldmoment' }
      : { stand: 'FAILED', reden: 'MELDBESLUIT.json verklaart dat hier iemand bericht hoort te ' +
          'krijgen, en na deze dood bestaat er geen melding -- de uitkomst staat vast en de ' +
          'betrokkene hoort er nooit van' };
    else if (berichtAan === 'GEEN_BERICHT') c.berichtGeland = { stand: 'PROVEN',
      reden: 'deze route bericht met opzet niemand (MELDBESLUIT.json), dus er valt hier niets te verliezen' };
    else c.berichtGeland = { stand: 'NIET_BEPROEFD',
      reden: 'niemand heeft verklaard of hier iemand bericht hoort te krijgen (MELDBESLUIT.json ' +
        'staat op UNKNOWN voor dit pad); gemeten is alleen dat er ' +
        (meldingBewoog ? 'wel' : 'geen') + ' melding ontstond' };
  }

  /* 4. GEEN DUBBEL EFFECT. De helft van crashveiligheid. */
  if (herhaalStatus === null || herhaalStatus === undefined) c.geenDubbel =
    { stand: 'NIET_BEPROEFD', reden: 'de herhaling is niet uitgevoerd' };
  else c.geenDubbel = weegHerhaling(bijgekomen, verklaring);

  return { claims: c, stand: strengste(Object.values(c).map(x => x.stand)) };
}

/* DE AANROEP VAN DE VOORZIENING, OP EEN PLEK. Zij stond inline in ronde() en
   ging daar op vier punten tegelijk mis; een inline aanroep is bovendien niet
   te beproeven zonder een hele crashronde te draaien, en dat is precies waarom
   de fout zo lang kon blijven staan. Hij mutéért `lijf` met opzet -- de
   identificerende velden van een vers onderwerp horen in het lijf van DEZE
   route -- en geeft terug wat er is gebeurd, nooit niets. */
async function draaiVoorziening({ maak, post, tokenVoor, rol, w, lijf }) {
  if (!maak) return null;
  try {
    const v = await maak({ post, tokenVoor, rol, w: w || {} });
    if (v && v.fout) return { stand: 'mislukt', reden: String(v.fout) };
    if (v && typeof v === 'object') {
      Object.assign(lijf, v);
      return { stand: 'gelukt', velden: Object.keys(v) };
    }
    return { stand: 'mislukt', reden: 'de voorziening gaf niets terug' };
  } catch (e) { return { stand: 'mislukt', reden: 'de voorziening viel om: ' + e.message }; }
}

async function ronde(route, grens, ruis) {
  const map = fs.mkdtempSync(path.join(os.tmpdir(), 'rtg-crashproef-'));
  let srv = null;
  const schoon = (lijst) => (lijst || []).filter(k => !isSpoor(k) && !ruis.includes(k));
  try {
    const a = await stelOp(map);
    srv = a.srv;
    const tok = a.bos.tokenVoor ? a.bos.tokenVoor(route.rol) : a.bos.tokens[route.rol];
    if (!tok && route.rol) return { stand: 'BLOCKED', reden: 'geen sleutel voor rol ' + route.rol };
    /* HET LIJF, MET EEN TERUGVAL -- want zonder terugval viel tweederde weg.

       idemwereld.js kent een eigen lijf voor een stuk of vijftien geldroutes;
       de eerste ronde meldde de andere dertig als WERELD_ONTBREEKT en meette ze
       niet. Dat is te streng: het GEDEELDE lijf (de echte IBAN en codenamen uit
       deze database) brengt een deel van die routes gewoon aan het werk, en een
       route die er niets mee kan, meldt zich daarna met zijn TREDE en zijn
       status -- wat meer zegt dan "geen lijf". WERELD_ONTBREEKT blijft over
       voor het geval dat de wereld helemaal niets opleverde. */
    /* EEN EIGEN KOPIE, want de voorziening schrijft er hieronder in. `a.gedeeld`
       is EEN object dat alle routes van deze ronde delen; er rechtstreeks in
       schrijven zou het onderwerp van deze route meegeven aan de volgende. */
    const lijf = { ...(a.lijven[route.pad] || a.gedeeld) };
    if (!lijf || !Object.keys(lijf).length) return { stand: 'WERELD_ONTBREEKT',
      reden: 'idemwereld.js levert geen lijf voor dit pad en de gedeelde wereld is leeg; ' +
        'zonder de echte IBAN/codenaam van DEZE database strandt de oproep op "deed geen werk" ' +
        'in plaats van op de crash' };
    const eigenLijf = !!a.lijven[route.pad];

    /* DE VOORZIENING, MET HET CONTRACT DAT ZIJ WERKELIJK HEEFT.

       Hier stond een aanroep die op alle vier de punten verkeerd was, en die
       vier punten werden verborgen door een lege `catch`. Nagemeten op 13
       september: ELKE voorziening in idemwereld.js gooit onder de oude aanroep
       ("tokenVoor is not a function", "Cannot read properties of undefined
       (reading 'iban')"). Zes routes meldden zich daardoor als BLOCKED_WORLD of
       BLOCKED_BODY terwijl de wereld prima te bouwen was -- de haak van de proef
       was stuk, niet de route. Dat is de duurste soort meetfout die dit huis
       kent: hij wijst het werk naar de verkeerde plek.

       Vier dingen, en scripts/lib/idemproef.js deed ze alle vier al goed:

         1. `tokenVoor` en niet `tokens` -- een voorziening heeft soms MEER dan
            een rol nodig (de zaak ontvangt geld van een LID), dus zij kiest
            zelf en krijgt geen rol opgelegd;
         2. de WERELD mee, want een voorziening leunt op de echte IBAN en
            codenamen van DEZE database;
         3. wat zij teruggeeft gaat IN het lijf -- zonder dat maakt zij wel een
            vers onderwerp, maar noemt de route het oude id nooit;
         4. haar uitkomst komt in de RIJ. Een voorziening die stil omvalt, laat
            de rij zeggen "de wereld ontbreekt" terwijl er iets anders aan de
            hand is. */
    const voorziening = await draaiVoorziening({ maak: a.voorzieningVoor(route.pad),
      post: a.p, tokenVoor: a.bos.tokenVoor, rol: route.rol, w: a.wereld, lijf });

    /* DE TWEE MOMENTOPNAMEN WORDEN OP DEZELFDE MANIER GEMAAKT, EN DAT IS DE
       HELE REPARATIE: allebei terwijl een VERS OPGESTARTE, SCHONE server draait.

       Twee dingen zijn hier achter elkaar misgegaan en ze wezen allebei op
       hetzelfde. Eerst stond de voormeting voor de kill en de nameting na een
       herstart. Toen zette ik de voormeting NA de kill -- en dat was erger, want
       toen las hij minder.

       De oorzaak is de WAL van sqlite. Een momentopname vlak na een SIGKILL
       opent de .db-bestanden alleen-lezen en kan de WAL niet terugdraaien; wat
       daar nog in staat, ziet hij dus niet. De eerstvolgende start herstelt de
       WAL, en dan verschijnt die inhoud alsnog -- wat er als "veranderd door de
       gemeten oproep" uitziet. Gemeten, zonder ook maar een oproep te doen:
       vlak-na-de-kill tegen draaiend gaf drie verschillen, draaiend tegen
       draaiend gaf er een.

       Die ene is echt: `schaduwregels` beweegt bij ELKE start, en die hoort de
       ruisronde eruit te halen. De andere twee (`rijkVoertuigen`, `suppliers`)
       waren nooit ruis maar een leesfout, en zolang ze als ruis werden
       afgetrokken, dekte de proef echte veranderingen in die collecties mee af.

       Symmetrie is hier dus geen netheid maar de meting zelf: twee
       momentopnamen die op verschillende manieren zijn gemaakt, verschillen
       altijd. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const voor = inhoudsBeeld(map);

    /* Het verraad gaat pas AAN bij de volgende start. De opstelling schrijft
       zelf duurzaam, dus met de modus vanaf het begin scherp sterft de server
       tijdens het inloggen en meet de ronde de opstelling in plaats van de
       geldroute. */
    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, magSterven: true, wachtMs: 30000,
      env: { ...SERVEROMGEVING, RTG_VERRAAD: grens.modus, RTG_VERRAAD_SEED: '20260913' } });
    if (srv.dood) return { stand: 'BLOCKED', voorziening,
      reden: 'de server stierf al tijdens het opstarten onder ' + grens.modus };

    const r = await post(srv.basis, route.pad, lijf, tok);
    const gestorven = r.status === 0;

    try { srv.kind.kill('SIGKILL'); } catch (e) {}
    srv = await W.start({ datamap: map, env: SERVEROMGEVING });
    const na = inhoudsBeeld(map);
    const geraakt = schoon(verschil(voor, na));
    const binnen = geraakt.filter(vanRoute(route));
    const buiten = geraakt.filter(k => !vanRoute(route)(k));
    /* EEN FEIT EN GEEN OORDEEL -- zie de leeswijzer bij GRENZEN hierboven. De
       twee schrijvers van een melding schrijven allebei naar `notifications`;
       bewoog die bak niet, dan is er na deze dood geen bericht ontstaan. Of dat
       erg is, weet deze proef niet. */
    const meldingBewoog = geraakt.some(k => /notif|meld/i.test(k));

    /* NIET GESTORVEN -- EN DAT IS TWEE VERSCHILLENDE DINGEN.

       De eerste ronde noemde allebei `BLINDE_INJECTIE`, en dat was een vals
       alarm op acht routes. Een blinde injectie hoort te betekenen: de modus
       stond scherp, de route liep LANGS het injectiepunt, en er gebeurde niets.
       Wat hier werkelijk aan de hand was, is iets anders: de route KOMT er niet
       langs. /api/bank/pas/bevries en zeven broers schrijven met de gewone
       write-behind save() -- nagelezen in server/kern/bank/passen.js -- en
       raken dus `bijeen()` noch `saveDuurzaam()`.

       Dat maakt het geen bevinding OVER de route maar een uitspraak over zijn
       schrijfweg, en die is scherp: deze twee grenzen bestaan daar niet, want
       een write-behind save heeft geen moment waarop iets half duurzaam is. Wat
       hem WEL bedreigt is een schrijfactie die beloofd en niet bewaard wordt,
       en dat is `schrijf-verloren` -- een andere modus, die deze proef niet
       draait.

       Een 200 bewijst dat de route zijn werk afmaakte, dus was hij niet in de
       bundel: daar zou hij gestorven zijn. Voor sterf-na-commit zit er een rand
       aan: die vuurt alleen als de duurzame schrijfactie ook BEVESTIGD werd,
       dus een route die saveDuurzaam roept op een opslag die niet kan
       bevestigen, komt hier ook terecht. Op sqlite bevestigt hij. */
    if (!gestorven) {
      const deedWerk = r.status >= 200 && r.status < 300;
      /* NIET GESTORVEN. Drie feiten, dan pas een conclusie -- zie weegBlokkade.
         De eerste versie leunde op EEN negatief signaal (geen eigen lijf) en
         noemde dat BLOCKED_BODY; daar strandde /api/supplier/oog/overzicht op,
         een route die de body niet eens leest. `eigenLijf` blijft in de rij
         staan als FEIT, maar beslist niets meer. */
      const lb = leestBodyVan(route.methode, route.pad);
      const bl = weegBlokkade({ status: r.status, leestBody: lb.leest, voorziening });
      if (!bl.blokkeertOp) return { stand: 'GEEN_DUURZAME_WEG', statusVanDeAanroep: r.status,
        bereiktTot: bl.bereiktTot, blokkeertOp: null, leestBody: lb.leest, leestBodyGrond: lb.grond,
        reden: 'de route gaf ' + r.status + ' en het proces leefde door, dus hij liep niet langs ' +
          'het injectiepunt van ' + grens.modus + ': hij schrijft via de gewone write-behind ' +
          'save(). Deze grens bestaat niet op zijn pad -- wat hem wel bedreigt is een ' +
          'VERLOREN schrijfactie (`schrijf-verloren`), en die draait deze proef niet',
        geraakt: binnen, buitenDeRoute: buiten, eigenLijf, voorziening, meldingBewoog };
      return { stand: STAND_VAN_BLOKKADE[bl.blokkeertOp], statusVanDeAanroep: r.status,
        bereiktTot: bl.bereiktTot, blokkeertOp: bl.blokkeertOp,
        leestBody: lb.leest, leestBodyGrond: lb.grond,
        reden: bl.reden, geraakt: binnen, buitenDeRoute: buiten, eigenLijf, voorziening, meldingBewoog };
    }

    /* DE RETRY-PROEF HOORT BIJ ALLEBEI DE GRENZEN, en dat ontbrak.

       Voor de grens na de commit was hij er al: de uitkomst staat vast, dus de
       vraag is of een tweede poging er iets bovenop legt. Maar voor de grens
       VOOR de mutatie is hij even belangrijk en het spiegelbeeld ervan: er is
       niets gebeurd, dus de belofte is dat je het OPNIEUW MAG AANBIEDEN en er
       dan precies een effect ontstaat. Crashveiligheid zonder retry-proef is
       maar de helft van crashveiligheid.

       Daarom hieronder een keer aanbieden (dat hoort te lukken en werk te doen)
       en daarna nog een keer (dat hoort er niets bovenop te leggen). De tweede
       meting is wat `geenDubbel` weegt; de eerste is wat na de ATOMIC-grens
       bewijst dat de route niet stuk is achtergebleven. */
    const voorHerhaling = inhoudsBeeld(map);
    const herhaal = await post(srv.basis, route.pad, lijf, tok);
    const naHerhaling = inhoudsBeeld(map);
    const herhaalDeed = schoon(verschil(voorHerhaling, naHerhaling)).filter(vanRoute(route));

    const tweede = await post(srv.basis, route.pad, lijf, tok);
    const naTweede = inhoudsBeeld(map);
    const bijgekomen = schoon(verschil(naHerhaling, naTweede)).filter(vanRoute(route));

    const verwachtLeeg = grens.grens === 'voor-eerste-mutatie';
    const c = weegContract({ verwachtLeeg, geraakt: binnen.length,
      aantalCollecties: route.collecties.length, status: r.status, gestorven,
      herhaalStatus: herhaal.status, bijgekomen: bijgekomen.length,
      verklaring: sleutelVoor(route.pad),
      grens: grens.grens, berichtAan: route.berichtAan, meldingBewoog });

    return { stand: c.stand, claims: c.claims, statusVanDeAanroep: 0,
      reden: Object.entries(c.claims).filter(([, v]) => v.stand !== 'PROVEN')
        .map(([k, v]) => k + ': ' + v.reden).join(' | ') ||
        'alle vier de beweringen van het overlevingscontract zijn bewezen',
      geraakt: binnen, buitenDeRoute: buiten, eigenLijf, voorziening, meldingBewoog,
      herhaling: { status: herhaal.status, deed: herhaalDeed,
        tweedeStatus: tweede.status, bijgekomen } };
  } catch (e) {
    return { stand: 'BLOCKED', reden: 'de ronde brak af: ' + String(e.message).slice(0, 140) };
  } finally {
    try { if (srv && srv.kind) srv.kind.kill('SIGKILL'); } catch (e) {}
    fs.rmSync(map, { recursive: true, force: true });
  }
}

function geldroutes() {
  const g = JSON.parse(fs.readFileSync(path.join(WORTEL, 'GELDDEKKING.json'), 'utf8'));
  let r = (g.rijen || []).filter(x => (x.collecties || []).length);
  if (alleenPad) r = r.filter(x => x.pad === alleenPad);
  if (maxRoutes) r = r.slice(0, maxRoutes);
  return r;
}

async function meet() {
  const routes = geldroutes();
  if (!jsonUit) console.log('\n\x1b[1mDE CRASHPROEF OVER DE GELDROUTES\x1b[0m \x1b[2m(' +
    routes.length + ' route(s) x ' + GRENZEN.length + ' grens)\x1b[0m\n');

  const ongebouwd = GRENZEN.filter(g => !verraad.CATALOGUS.some(v => v.naam === g.modus && v.waar));
  if (ongebouwd.length) throw new Error('geen injectiepunt voor: ' +
    ongebouwd.map(g => g.modus).join(', ') + ' -- deze proef zou dan niets meten');

  if (!jsonUit) process.stdout.write('  herstartruis meten ... ');
  const ruis = await meetHerstartruis();
  if (!jsonUit) console.log(ruis.length + ' collectie(s) die de server uit zichzelf schrijft\n');

  const per = [];
  for (const route of routes) {
    for (const g of GRENZEN) {
      const uit = await ronde(route, g, ruis);
      per.push({ methode: route.methode, pad: route.pad, rol: route.rol, grens: g.grens,
        modus: g.modus, belofte: g.belofte, collecties: route.collecties,
        idempotentie: route.idempotentie, ...uit });
      if (!jsonUit) console.log('  ' + uit.stand.padEnd(17) + route.pad.padEnd(34) +
        '\x1b[2m' + g.grens + '\x1b[0m');
    }
  }

  const telling = {};
  for (const r of per) telling[r.stand] = (telling[r.stand] || 0) + 1;
  return { per, telling, ruis, routes: routes.length, grenzen: GRENZEN.length };
}

/* Het register. De stempel komt uit ./lib/stempel.js -- dezelfde als elk ander
   register, zodat `boomVuil` ook hier betekent wat het overal betekent: deze
   uitslag is gemeten terwijl er ongecommitte code lag, en dan hoort hij niet
   ingecheckt te worden. */
function schrijf(u) {
  const { stempel } = require('./lib/stempel.js');
  const reg = Object.assign({
    soort: 'meting',
    uitleg: 'per geldroute en per crashgrens: wat er van de uitkomst overblijft als het ' +
      'proces op dat moment sterft. De vraag is economisch -- wat staat er in de opslag na ' +
      'de herstart -- en niet wat de route antwoordde, want bij een crash antwoordt hij niet.',
    grens: 'drie dingen die deze proef NIET zegt. (1) Wat een aanbieder buiten de deur al had ' +
      'gecommit ziet hij niet -- dat is EXTERNALLY_RECONCILABLE en dat wacht op een echte ' +
      'aanbieder. (2) Het OORDEEL hangt aan de collecties die GELDDEKKING.json per route ' +
      'declareert; een halve schrijfactie in een collectie die daar niet staat, komt terug in ' +
      '`buitenDeRoute` maar laat de uitslag niet zakken. Die lijst is dus de bovengrens van wat ' +
      'hier te vinden is. (3) Een PROVEN geldt voor DIT lijf op DEZE wereld -- een andere invoer ' +
      'kan een ander pad door de route nemen.',
    stempel: stempel({ instrument: 'scripts/crashproef.js' })
  }, u);
  fs.writeFileSync(path.join(WORTEL, 'CRASHPROEF.json'), JSON.stringify(reg, null, 2) + '\n');
}

if (require.main === module) {
  meet().then(u => {
    if (vastleggen) schrijf(u);
    if (jsonUit) { console.log(JSON.stringify(u, null, 2)); return; }
    if (vastleggen) console.log('\n  CRASHPROEF.json geschreven.');
    console.log('\n  \x1b[1muitslag\x1b[0m');
    for (const [k, v] of Object.entries(u.telling).sort((a, b) => b[1] - a[1]))
      console.log('    ' + k.padEnd(18) + String(v).padStart(4));
    /* ALLEEN FAILED IS EEN BEVINDING. `BLINDE_INJECTIE` stond hier eerst naast,
       en die stand is bewust verdwenen: van buiten is een blinde injectie niet
       te onderscheiden van een route die het injectiepunt niet raakt, want in
       allebei de gevallen komt er een 200 terug. Een stand die nooit eerlijk
       kan worden toegekend, hoort niet in de lijst -- dat is dekking die er
       niet is. Wat overblijft heet GEEN_DUURZAME_WEG en zegt wat er gemeten IS:
       deze route liep niet langs de bundel. */
    const hard = u.telling.FAILED || 0;
    if (hard) { console.log('\n  \x1b[31m' + hard + ' bevinding(en).\x1b[0m'); process.exitCode = 1; }
    else console.log('\n  \x1b[32mGeen bevindingen.\x1b[0m');
  }).catch(e => { console.error(e); process.exitCode = 2; });
}

module.exports = { meet, ronde, meetHerstartruis, draaiVoorziening, weegHerhaling, weegContract, weegBlokkade,
  tredeVan, leestBodyVan, CLAIMS, GRENZEN, TREDEN, STAND_VAN_BLOKKADE };

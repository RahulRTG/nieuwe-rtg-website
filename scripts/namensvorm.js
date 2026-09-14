#!/usr/bin/env node
/* ============================================================================
   DE NAMENSVORM -- delen de manieren waarop iemand namens een ander handelt
   werkelijk een machine?

   DE VRAAG KOMT UIT REPRESENTATIE.md par. 0, en het is de dragende bewering van
   het hele voorstel voor een Representation & Execution Layer:

     "Bouw geen TalentManagerEngine. Bouw een Representation Engine. Dan kan
      dezelfde kern later werken voor ouder -> kind, accountant -> ondernemer,
      advocaat -> client, reisadviseur -> reiziger, medewerker -> werkgever,
      manager -> artiest, zaakwaarnemer -> voetballer, mantelzorger ->
      familielid, assistent -> directeur. Andere policies. Dezelfde machine."

   Dat KAN waar zijn. Of het waar IS, is een meting -- en dit huis heeft die
   vraag al vier keer gesteld en vier keer een streng antwoord gekregen.
   `Asset` sneuvelde in OBJECTMODEL.json, de carrierelus in CARRIEREVORM.json
   (0 van 162 velden in alle domeinen), `Moment` in STAGEVORM.json (0 van 136),
   en `Manier` in AANVOERVORM.json (0 van 5 terreinen). Elke keer klonk de
   bewering vanzelfsprekend tot iemand telde.

   DAAROM DEZELFDE METHODE EN NIET EEN TWEEDE. Dit bestand leest niet zelf; het
   hergebruikt `lees()` uit scripts/objectmodel.js en de envelop uit
   OBJECTMODEL.json. Twee meters met elk een eigen parser geven binnen een maand
   twee getallen over hetzelfde (LAT.md regel 4), en dan is de vergelijking met
   de vier metingen hierboven waardeloos -- terwijl juist die vergelijking de
   conclusie draagt.

   ---------------------------------------------------------------------------
   DE EENHEID IS HIER HET MECHANISME EN NIET HET DOMEIN, en dat is de enige
   plek waar deze meter van zijn vier zusters afwijkt. Die groeperen op de map
   onder server/ (`om.domeinVan`), en dat kan hier niet: `kern/service/
   machtiging*.js` is EEN mechanisme binnen een domein dat veel meer doet, en
   `kern/command/bijstand*.js` net zo. Op domein gemeten zou de servicemachtiging
   samenvallen met de zaaktijdlijn en de bijstand met de incidentlaag, en dan
   meet je de bestandsindeling in plaats van het mechanisme.

   DE PRIJS DAARVAN STAAT IN DE UITSLAG: de PERCENTAGES van deze meter zijn niet
   uitwisselbaar met die van CARRIEREVORM.json en STAGEVORM.json, want die tellen
   per domein. Wat wel vergelijkbaar is, is de VORM van het antwoord -- staat er
   iets in alle, in de helft, in precies een. Wie de 88,2% van de carrierevorm
   naast een getal hier legt, vergelijkt twee noemers.

   ---------------------------------------------------------------------------
   TWEE LIJSTEN, EN DAT IS NIET DUBBELOP. `scripts/carrierevorm.js` sloeg op een
   versmalling om van 0 naar 8 gedeelde velden; een uitslag die op de lijst
   drijft, is geen uitslag. Vandaar dezelfde vorm als scripts/aanvoervorm.js:

     SMAL   iemand HANDELT namens een ander (zeven mechanismen)
     RUIM   SMAL plus iemand WEET iets namens of over een ander (elf)

   Die tweede helft hoort erbij omdat het voorstel hem noemt: selectieve
   openbaarmaking (punt 12) en doelgebonden toegang (punt 44) gaan over kennen
   en niet over doen. Valt de uitslag in beide lijsten hetzelfde uit, dan is hij
   geen artefact van wie de lijst opschreef.

   ---------------------------------------------------------------------------
   EN ER WORDT EEN TWEEDE DING GEMETEN: DE WOORDENSCHAT. Dit huis is vier keer
   gestruikeld over een naam die al bezet was -- `envelop` (AFSPRAAK.md),
   `moment` (STAGE.md), `manier` (MAATSTAF.md), `doel` en `Pulse` (KANTOOR.md).
   Het voorstel introduceert er ruim twintig. Een naam die in dit huis al een
   andere betekenis draagt, is geen stijlkwestie: het is de `VERMOGENS`-botsing
   op de centrale naam van een hele laag. Dus wordt er geteld voordat er iets
   heet.

   WAT DIE TELLING NIET IS: een verbod. Hij zegt hoeveel bestanden en domeinen
   het woord vandaag gebruiken, niet of die betekenissen botsen -- dat leest een
   mens. `vrij` is hard (nul treffers); `bezet` is een WAARSCHUWING met een adres.

   Draai: node scripts/namensvorm.js            (leesbaar)
          node scripts/namensvorm.js --json     (voor de ratel)
          npm run namensvorm:vast               (schrijft NAMENSVORM.json)
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const om = require('./objectmodel.js');
const { stempel } = require('./lib/stempel');

const WORTEL = path.join(__dirname, '..');

/* ---------------------------------------------------------------------------
   DE MECHANISMEN. Elk draagt een GROND -- wie handelt hier namens wie -- zodat
   wie de lijst wijzigt ziet wat hij verandert. De lijst staat hier en niet in
   REPRESENTATIE.md: een lijst in een document loopt achter op de code zodra
   iemand een bestand hernoemt, en dan meet de meter iets anders dan het
   document beweert.

   `bestanden` is een regex op het PAD zoals om.lees() hem teruggeeft
   (`server/kern/...`), niet op de naam. --------------------------------------- */
const HANDELEN = Object.freeze([
  { naam: 'vertegenwoordiging', wie: 'een mens namens een mens',
    bestanden: /^server\/kern\/vertegenwoordiging\// },
  { naam: 'bijstand', wie: 'RTG namens een zakelijke klant, op uitnodiging',
    bestanden: /^server\/kern\/command\/bijstand/ },
  { naam: 'servicemachtiging', wie: 'een medewerker in het dossier van een melder',
    bestanden: /^server\/kern\/service\/machtiging/ },
  { naam: 'ai-mandaat', wie: 'een agent namens de mens die hem aanstuurt',
    bestanden: /^server\/kern\/stuur\/mandaat\.js$/ },
  { naam: 'fiscaal-mandaat', wie: 'RTG namens een ondernemer, richting de Belastingdienst',
    bestanden: /^server\/kern\/fiscaal\/gateway\/mandaat\.js$/ },
  { naam: 'sepa-machtiging', wie: 'een incassant namens een rekeninghouder',
    bestanden: /^server\/(kern|school)\/machtiging\.js$/ },
  /* DE SCOPE IS BREDER DAN machtigingen.js, EN DAT IS EEN CORRECTIE OP DE
     EERSTE VERSIE. Die las alleen de LIJST met machtigingen, en meldde toen
     0 van de 7 werkwoorden -- terwijl `verleen` in ./winkel.js staat,
     `intrekkenKaal` in ./besluit.js en `geef` in ./context.js. Een mechanisme
     op een bestand scopen in plaats van op zijn levenscyclus, meet de
     bestandsindeling; dezelfde fout die om.domeinVan() bij gast/ en
     levensgraaf/ maakte en die in de kop van scripts/objectmodel.js staat. */
  { naam: 'app-machtiging', wie: 'een app van derden namens een lid',
    bestanden: /^server\/kern\/appstore\/(machtigingen|winkel|besluit|naad|context)\.js$/ }
]);

/* De kennen-helft. Geen van deze laat iemand iets DOEN namens een ander; ze
   laten iemand iets WETEN. Het voorstel behandelt die twee als een laag, dus
   worden ze ook samen gemeten -- en apart, zodat te zien is of dat klopt. */
const KENNEN = Object.freeze([
  { naam: 'levensband', wie: 'een naaste ziet wat de ander zelf heeft vrijgegeven',
    bestanden: /^server\/kern\/levensband\// },
  { naam: 'consent-center', wie: 'welke lagen toestemming dragen',
    bestanden: /^server\/kern\/consent/ },
  { naam: 'rtgid-claims', wie: 'een lid deelt een losse eigenschap in plaats van zijn dossier',
    bestanden: /^server\/kern\/rtgid-(claims|bewijs)\.js$/ },
  { naam: 'ledenbalie-inzage', wie: 'het kantoor kijkt in een dossier, met reden en journaal',
    bestanden: /^server\/kern\/ledenbalie-inzage\.js$/ }
]);

const RUIM = Object.freeze(HANDELEN.concat(KENNEN));

/* ---------------------------------------------------------------------------
   DE WERKWOORDEN, EN DIT IS DE AS DIE ERTOE DOET.

   De vorm-as hierboven telt bewaarde VELDEN, en die steekproef is dun: deze
   mechanismen slaan weinig op en beslissen veel. Een nul op negen vormen is
   bijna gratis, en een conclusie erop bouwen is precies de fout uit
   BEWIJSMACHINE.md par. 6a -- een geldige uitslag van het verkeerde experiment.

   Dus wordt er een tweede keer gemeten, langs de as waar COMMERCE.md hetzelfde
   probleem al eens oploste: `Koopbaar` werd daar geen interface van verplichte
   methodes maar een VERKLARING VAN WERKWOORDEN, omdat 0 van de 437 koopbare
   vormen alle acht werkwoorden uitvoerde. Dezelfde vraag hier: heeft elk
   mechanisme een werkwoord voor elk van de zeven stappen die een machtiging
   doorloopt?

   DE ZEVEN ZIJN NIET VERZONNEN. Ze zijn afgelezen aan het enige mechanisme dat
   ze aantoonbaar alle zeven heeft (kern/vertegenwoordiging/), en dat is met
   opzet: een grammatica die uit het voorstel komt in plaats van uit de code,
   meet het voorstel en niet het huis.

   EN HET INSTRUMENT MOET KUNNEN ZAKKEN. Een patroon dat overal raakt, is geen
   patroon: `mag`, `stand` en `tot` zitten in half dit huis. Daarom haakt elk
   werkwoord aan het BEGIN van een gedeclareerde identifier en niet ergens in
   de tekst, en staan er in test/namensvorm.test.js twee besturingsproeven --
   een mechanisme dat een werkwoord aantoonbaar mist, moet als missend
   uitkomen.

   ---------------------------------------------------------------------------
   TWEE PATRONEN PER WERKWOORD, EN HET VERSCHIL ERTUSSEN IS DE EIGENLIJKE
   UITSLAG. Dit is de belangrijkste correctie op de eerste versie, en hij komt
   uit een fout die de meter zelf maakte: met alleen de vertegenwoordigings-
   woordenschat meldde `bijstand` 2 van de 7, terwijl `stelVoor`, `besluit`,
   `betreed` en `duurVan` gewoon in bijstand-klant.js staan. Een gemiste NAAM
   las daar als een ontbrekende STAP, en dat zijn twee verschillende
   beweringen:

     opNaam       voert dit mechanisme het werkwoord onder de naam die
                  kern/vertegenwoordiging/ eraan geeft? Dit is de
                  VOCABULAIREvraag, en hij is lexicaal hard te meten.
     opSynoniem   voert het de stap onder EEN van de namen die dit huis er
                  vandaag voor gebruikt? Ruimer, en nog steeds lexicaal -- dus
                  nog steeds een ONDERgrens en geen semantisch oordeel.

   Ze worden NOOIT opgeteld en nooit tot een cijfer samengeknepen. De eerste
   meet verstrooiing van namen, de tweede dekking van stappen, en een meter die
   ze middelt verbergt precies waar het aan ligt. Of een treffer werkelijk
   HETZELFDE doet, staat in geen van beide: `verleen` in het fiscale mandaat en
   `voorstel` in de vertegenwoordiging heten allebei verlenen en hebben een
   andere partij ervoor. De meter wijst aan waar gekeken moet worden; het
   oordeel staat in REPRESENTATIE.md par. 1 en is met de hand geveld. --------- */
const WERKWOORDEN = Object.freeze([
  { naam: 'verlenen', wat: 'iemand geeft de bevoegdheid uit',
    patroon: /^(verleen|voorstel|uitgifte|verstrek|maakMandaat|maakMachtiging)/i,
    synoniem: /^(verleen|voorstel|stelVoor|uitgifte|verstrek|geef|vraag|maakMandaat|maakMachtiging)/i },
  { naam: 'aanvaarden', wat: 'de ander zegt ja, en niemand anders',
    patroon: /^(aanvaard|accepteer|akkoord|tekent|bevestigMachtiging)/i,
    synoniem: /^(aanvaard|accepteer|akkoord|tekent|besluit|keur|bevestigMachtiging)/i },
  { naam: 'versmallen', wat: 'de speelruimte kan alleen kleiner worden',
    patroon: /^(versmal|speelruimte|doorsnede|grensZet|beperk)/i,
    synoniem: /^(versmal|speelruimte|doorsnede|grens|beperk|ruimteVan|bereik|plafond)/i },
  { naam: 'intrekken', wat: 'terugnemen, waarbij de toekomst stopt en het verleden blijft',
    patroon: /^(intrek|trekIn|trekRegelIn|herroep|beeindig)/i,
    synoniem: /^(intrek|trekIn|trekRegelIn|herroep|beeindig|sluit|stop|vervang)/i },
  { naam: 'verlopen', wat: 'verval is een BEREKENDE toestand en geen veld',
    patroon: /^(verval|verloop|verlopen|geldt|geldig|mandaatGeldig|dagenTot)/i,
    synoniem: /^(verval|verloop|verlopen|geldt|geldig|mandaatGeldig|dagenTot|duurVan|actief|stand)/i },
  { naam: 'handelen', wat: 'onder de bevoegdheid werkelijk iets doen',
    patroon: /^(handel|magHandelen|magZelfstandig|magNamens|magNu|gebruikMachtiging)/i,
    synoniem: /^(handel|mag[A-Z]|betreed|voerUit|installeer|gebruikMachtiging)/ },
  { naam: 'spoor', wat: 'wat er namens iemand gebeurde, blijft staan',
    patroon: /^(spoor|noteer|journaal|auditregel)/i,
    synoniem: /^(spoor|noteer|journaal|auditregel|log|meld)/i }
]);

/* ---------------------------------------------------------------------------
   DE VOORGESTELDE WOORDENSCHAT. Uit REPRESENTATIE.md par. 2 -- de begrippen die
   het voorstel introduceert of hergebruikt. Nederlandse EN Engelse vorm, want
   dit huis codeert in het Nederlands en het voorstel is in het Engels
   geschreven; een naam die in de ene taal vrij is en in de andere bezet, is
   bezet. --------------------------------------------------------------------- */
const WOORDEN = Object.freeze([
  'principal', 'mandaat', 'machtiging', 'capability', 'vermogen', 'bevoegdheid',
  'intent', 'intentie', 'doel', 'purpose', 'opportunity', 'kans',
  'deal', 'contract', 'obligation', 'verplichting', 'gevolg', 'consequence',
  'assurance', 'zekerheid', 'risico', 'hoedanigheid', 'envelop', 'outbox',
  'saga', 'reconciliatie', 'reconciliation', 'settlement', 'projectie',
  'mechanism', 'authority', 'commitment', 'claim'
]);

/* ---------------------------------------------------------------------------
   DE VORM-METING ------------------------------------------------------------- */

function envelopLees() {
  return new Set(JSON.parse(fs.readFileSync(path.join(WORTEL, 'OBJECTMODEL.json'), 'utf8')).envelop);
}

/* Krijgt de vormen mee in plaats van ze te lezen, en de lijst mechanismen ook.
   Zonder die twee is de zelfijking niet te doen: een meter die alleen op de
   echte boom draait, is een meter die je nooit hebt zien uitslaan (LAT-regel
   10). */
function vorm(vormen, envelop, mechanismen) {
  const perMech = new Map();
  let geteld = 0;
  for (const v of vormen) {
    const m = mechanismen.find(x => x.bestanden.test(v.module));
    if (!m) continue;
    geteld++;
    if (!perMech.has(m.naam)) perMech.set(m.naam, new Set());
    for (const f of v.velden) if (!envelop.has(f)) perMech.get(m.naam).add(f);
  }

  /* EEN MECHANISME ZONDER VORMEN TELT NIET ALS MECHANISME, en dat is geen
     opsmuk. Een mechanisme dat nul velden bijdraagt kan per definitie nooit in
     `inAlleMechanismen` staan, dus zou het toevoegen van een regelbestand
     zonder opslag (kern/stuur/mandaat.js kent er geen) de uitslag op nul
     vastzetten zonder dat er iets over verwantschap is gezegd. Welke er
     afvallen staat in de uitvoer -- weglaten zonder het te melden zou de
     noemer stil verkleinen. */
  const leeg = mechanismen.filter(m => !perMech.has(m.naam)).map(m => m.naam).sort();
  const namen = [...perMech.keys()].sort();

  const veldIn = new Map();
  for (const n of namen) {
    for (const f of perMech.get(n)) {
      if (!veldIn.has(f)) veldIn.set(f, []);
      veldIn.get(f).push(n);
    }
  }

  const n = namen.length;
  const helft = Math.ceil(n / 2);
  const lijst = [...veldIn.entries()]
    .map(([veld, waar]) => ({ veld, mechanismen: waar.length, waar }))
    .sort((a, b) => b.mechanismen - a.mechanismen || a.veld.localeCompare(b.veld));
  const eigen = lijst.filter(x => x.mechanismen === 1).length;

  return {
    vormen: geteld,
    mechanismen: n,
    zonderVormen: leeg,
    velden: lijst.length,
    inAlleMechanismen: n ? lijst.filter(x => x.mechanismen === n).length : 0,
    inMinstensDeHelft: n ? lijst.filter(x => x.mechanismen >= helft).length : 0,
    helftDrempel: helft,
    veldenMechanismeEigen: eigen,
    eigenPct: lijst.length ? Math.round((eigen / lijst.length) * 1000) / 10 : 0,
    perMechanisme: namen.map(x => ({ mechanisme: x, velden: perMech.get(x).size })),
    gedeeld: lijst.filter(x => x.mechanismen >= 2).slice(0, 25)
  };
}

/* ---------------------------------------------------------------------------
   DE WERKWOORD-METING

   Leest de GEDECLAREERDE namen van een mechanisme: `function x(` en
   `const x = (`, plus `const x = async (`. Dat is grof en het is de goede kant
   om grof te zijn -- een gemiste naam laat een werkwoord ten onrechte ontbreken
   (de meter is dan te streng over gedeeldheid), een verzonnen naam zou er een
   verwantschap bij liegen.

   De bron gaat eerst door om.wring(): zonder dat telt een werkwoord dat alleen
   in een uitleg wordt genoemd mee, en deze bestanden bestaan voor de helft uit
   uitleg.

   LET OP HET WOORD `async` IN DIT PATROON. Het stond er eerst niet, en de meter
   meldde toen dat kern/vertegenwoordiging/ geen `verlenen`, `aanvaarden` en
   `intrekken` had -- terwijl `async function voorstel(`, `async function
   aanvaard(` en `async function intrek(` er letterlijk staan. De uitslag was
   geldig, netjes opgemaakt en onwaar, en niets eraan zag er verkeerd uit. Dat
   is de klasse uit BEWIJSMACHINE.md par. 6a: een proef draagt niet alleen zijn
   uitslag maar ook zijn INDELING, en die is zelf aantoonbaar of hij is niet
   waar. test/namensvorm.test.js houdt daarom vast dat deze drie gevonden
   blijven worden -- niet omdat ze bijzonder zijn, maar omdat ze de vorm zijn
   waarop dit patroon eerder brak. --------------------------------------------- */
const NAAM_UIT_BRON = /(?:^|\n)\s*(?:(?:async\s+)?function\s+|const\s+)([A-Za-z_$][A-Za-z0-9_$]*)\s*(?:\(|=\s*(?:async\s*)?\()/g;

function namenVan(bron) {
  const s = om.wring(bron);
  return [...new Set([...s.matchAll(NAAM_UIT_BRON)].map(m => m[1]))];
}

function werkwoorden(paden, mechanismen, lijst) {
  const perMech = new Map(mechanismen.map(m => [m.naam, { namen: [], bestanden: 0 }]));
  for (const p of paden) {
    const m = mechanismen.find(x => x.bestanden.test(p));
    if (!m) continue;
    const t = perMech.get(m.naam);
    t.bestanden++;
    t.namen.push(...namenVan(fs.readFileSync(path.join(WORTEL, p), 'utf8')));
  }

  const rijen = mechanismen.map(m => {
    const t = perMech.get(m.naam);
    const namen = [...new Set(t.namen)];
    const heeft = lijst.map(w => {
      const opNaam = namen.filter(n => w.patroon.test(n));
      const opSynoniem = namen.filter(n => (w.synoniem || w.patroon).test(n));
      return { werkwoord: w.naam, opNaam: opNaam.length > 0, opSynoniem: opSynoniem.length > 0,
        treffers: opSynoniem.sort().slice(0, 4) };
    });
    return {
      mechanisme: m.naam, wie: m.wie, bestanden: t.bestanden, namen: namen.length,
      opNaam: heeft.filter(h => h.opNaam).map(h => h.werkwoord),
      opSynoniem: heeft.filter(h => h.opSynoniem).map(h => h.werkwoord),
      mist: heeft.filter(h => !h.opSynoniem).map(h => h.werkwoord),
      treffers: Object.fromEntries(heeft.filter(h => h.opSynoniem).map(h => [h.werkwoord, h.treffers]))
    };
  });

  const n = rijen.length;
  const perWerkwoord = lijst.map(w => {
    const opNaam = rijen.filter(r => r.opNaam.includes(w.naam)).map(r => r.mechanisme);
    const opSynoniem = rijen.filter(r => r.opSynoniem.includes(w.naam)).map(r => r.mechanisme);
    return { werkwoord: w.naam, wat: w.wat, opNaam: opNaam.length, opSynoniem: opSynoniem.length,
      waarOpNaam: opNaam, waarOpSynoniem: opSynoniem };
  }).sort((a, b) => b.opSynoniem - a.opSynoniem || b.opNaam - a.opNaam);

  const som = (k) => rijen.reduce((a, r) => a + r[k].length, 0);
  return {
    mechanismen: n,
    werkwoorden: lijst.length,
    /* DRIE GETALLEN, EN GEEN ERVAN IS EEN SAMENVATTING VAN DE ANDERE TWEE.
       `volledig` vraagt of er EEN mechanisme is dat de hele grammatica voert
       (dan is er een machine om van te generaliseren); `inAlleMechanismen` of
       er EEN werkwoord is dat overal staat (dan is er een gedeelde kern); en
       het verschil tussen naam en synoniem zegt hoe ver de woordenschat uit
       elkaar ligt. LAT-regel 11: ze worden niet tot een cijfer geknepen. */
    volledigOpSynoniem: rijen.filter(r => r.mist.length === 0).map(r => r.mechanisme),
    volledigOpNaam: rijen.filter(r => r.opNaam.length === lijst.length).map(r => r.mechanisme),
    inAlleMechanismenOpNaam: perWerkwoord.filter(w => w.opNaam === n).map(w => w.werkwoord),
    inAlleMechanismenOpSynoniem: perWerkwoord.filter(w => w.opSynoniem === n).map(w => w.werkwoord),
    gemiddeldOpNaam: n ? Math.round((som('opNaam') / n) * 10) / 10 : 0,
    gemiddeldOpSynoniem: n ? Math.round((som('opSynoniem') / n) * 10) / 10 : 0,
    perWerkwoord,
    perMechanisme: rijen
  };
}

/* ---------------------------------------------------------------------------
   DE WOORDENSCHAT-METING

   Leest de hele bronboom van om.lees() opnieuw, maar dan als TEKST. Commentaar
   en tekenreeksen gaan er via om.wring() eerst uit: een woord dat alleen in een
   uitleg staat, is niet bezet -- en juist deze bestanden staan vol uitleg, dus
   zonder de wringer is elk woord bezet.

   TWEE ASSEN, EN DE TWEEDE IS ER OMDAT DE EERSTE ALLEEN EEN MATERIEEL FOUT
   ANTWOORD GAF. De eerste versie telde alleen KALE identifiers (`\bwoord\b`),
   met als verklaring: "een samenstelling is een ANDERE naam, en dat is de goede
   kant om te missen". Dat klopt voor een naamBOTSING en is onwaar voor de vraag
   die een bouwer stelt. `obligation` kwam op nul terwijl
   kern/economie/runtime/intent.js een veld `obligationIds` draagt, en
   `principal` leek vrij naast `principalRef` en `actingRef` in datzelfde
   bestand. Dit huis STELT namen SAMEN; wie alleen het kale woord telt, meldt
   "vrij" over een begrip dat al een motor heeft.

   Dus:
     kaal          de identifier IS het woord -- dit is de naamBOTSING
     samengesteld  het woord zit IN een langere identifier (principalRef,
                   obligationIds, intentsVoorPrincipal) -- dit is het BEGRIP

   Ze worden nooit opgeteld en de stand is drieledig: `vrij` (geen van beide),
   `bezet` (kaal, eventueel ook samengesteld), en `bezet-samengesteld` -- de
   naam is vrij maar het BEGRIP is bezet, en dat is precies de stand waarin je
   een tweede motor bouwt naast een bestaande zonder het te merken.

   De vergelijking blijft eerlijk: `doel` in `doelgroep` komt in de tweede bak
   en niet in de eerste, dus de botsingstelling is niet opgeblazen. ---------- */
const IDENTIFIER = /[A-Za-z_$][A-Za-z0-9_$]*/g;

function woordenschat(paden, woorden) {
  const tel = new Map(woorden.map(w => [w, {
    kaal: new Set(), kaalDom: new Set(), samen: new Set(), samenDom: new Set(), vormen: new Set()
  }]));
  for (const p of paden) {
    const bron = om.wring(fs.readFileSync(path.join(WORTEL, p), 'utf8'));
    const dom = om.domeinVan(p);
    /* Eén keer alle identifiers uit het bestand halen en daarna per woord
       kijken. Per woord opnieuw over de bron lopen is hetzelfde antwoord tegen
       vierendertig keer de tijd. */
    const ids = new Set();
    for (const m of bron.matchAll(IDENTIFIER)) ids.add(m[0]);
    for (const id of ids) {
      const laag = id.toLowerCase();
      for (const w of woorden) {
        if (!laag.includes(w)) continue;
        const t = tel.get(w);
        if (laag === w) { t.kaal.add(p); t.kaalDom.add(dom); }
        else { t.samen.add(p); t.samenDom.add(dom); t.vormen.add(id); }
      }
    }
  }
  return woorden.map(w => {
    const t = tel.get(w);
    const kaal = t.kaal.size, samen = t.samen.size;
    return {
      woord: w,
      bestanden: kaal,                 // de kale as; de naam blijft zoals hij was
      domeinen: t.kaalDom.size,
      samengesteld: samen,
      samengesteldDomeinen: t.samenDom.size,
      stand: kaal > 0 ? 'bezet' : (samen > 0 ? 'bezet-samengesteld' : 'vrij'),
      waar: [...t.kaalDom].sort().slice(0, 5),
      /* De concrete samenstellingen staan erbij, want "het begrip is bezet"
         zonder te zeggen HOE is een bewering die niemand kan natrekken. */
      vormen: [...t.vormen].sort().slice(0, 6)
    };
  }).sort((a, b) => (b.bestanden + b.samengesteld) - (a.bestanden + a.samengesteld) ||
    a.woord.localeCompare(b.woord));
}

/* --------------------------------------------------------------------------- */

function meet(opties) {
  const O = Object.assign({ handelen: HANDELEN, ruim: RUIM, woorden: WOORDEN, werkwoorden: WERKWOORDEN },
    opties || {});
  const g = om.lees();
  const envelop = envelopLees();
  /* DE HELE BOOM EN NIET ALLEEN DE BESTANDEN MET EEN VORM. om.lees() geeft
     vormen terug, en een mechanisme dat niets opslaat komt daar niet in voor --
     terwijl het wel werkwoorden heeft (kern/stuur/mandaat.js is precies dat).
     De werkwoord-as op die lijst meten zou het sterkste mechanisme van de
     grammatica onzichtbaar maken. */
  const alle = om.BRONNEN.reduce((a, m) => om.bestanden(m, a), []);
  return {
    gemeten: {
      smal: vorm(g.vormen, envelop, O.handelen),
      ruim: vorm(g.vormen, envelop, O.ruim),
      werkwoord: werkwoorden(alle, O.handelen, O.werkwoorden),
      envelopVelden: envelop.size
    },
    woordenschat: woordenschat(alle, O.woorden)
  };
}

module.exports = { meet, vorm, werkwoorden, woordenschat, namenVan,
  HANDELEN, KENNEN, RUIM, WOORDEN, WERKWOORDEN, envelopLees };

if (require.main === module) {
  const r = meet();
  const s = r.gemeten.smal, u = r.gemeten.ruim;
  /* GEEN process.exit() NA GROTE UITVOER -- Node sluit dan af terwijl de pipe
     nog leegloopt: geldige tekst, kapotte JSON, exitcode 0. Dat is een van de
     vier fouten waar scripts/meetkeuring.js voor bestaat. */
  if (process.argv.includes('--json')) { console.log(JSON.stringify(r)); process.exitCode = 0; return; }
  if (process.argv.includes('--vastleggen')) {
    fs.writeFileSync(path.join(WORTEL, 'NAMENSVORM.json'), JSON.stringify(Object.assign({
      stempel: stempel({ instrument: 'scripts/namensvorm.js' }),
      uitleg: 'Gemeten met scripts/namensvorm.js, op de lezer van scripts/objectmodel.js. De vraag staat in REPRESENTATIE.md par. 0: delen de bestaande manieren waarop iemand namens een ander handelt werkelijk een machine? Twee lijsten (smal = handelen, ruim = handelen plus kennen), zodat de uitslag niet op de lijst drijft.',
      grens: 'De eenheid is het MECHANISME en niet het domein, omdat kern/service/machtiging*.js en kern/command/bijstand*.js elk een mechanisme BINNEN een groter domein zijn. Daardoor zijn de percentages hier NIET uitwisselbaar met CARRIEREVORM.json of STAGEVORM.json, die per domein tellen; alleen de VORM van het antwoord is vergelijkbaar. Verder meet dit bewaarde VORMEN (velden van objectliteralen) en geen werkwoorden, volgorde of uitkomst: een nul zegt dat er geen gedeeld OBJECT is, niet dat er geen gedeeld PROCES is -- die tweede vraag beantwoordt een ketenproef. Een mechanisme zonder opgeslagen vormen (een regelbestand zonder db) valt uit de noemer en staat in `zonderVormen`. De woordenschat telt IDENTIFIERS na aftrek van commentaar en tekenreeksen: `bezet` is een waarschuwing met een adres en geen verbod, en samenstellingen tellen niet mee omdat een samenstelling een andere naam is.',
      vastgelegd: new Date().toISOString().slice(0, 10)
    }, r), null, 2) + '\n');
    console.log('NAMENSVORM.json geschreven.');
  }
  const blok = (t, x) => {
    console.log('  ' + t);
    console.log('  ' + x.vormen + ' bewaarde vormen in ' + x.mechanismen + ' mechanismen, samen ' + x.velden + ' velden (envelop eraf).');
    if (x.zonderVormen.length) console.log('  Zonder opgeslagen vorm, dus buiten de noemer: ' + x.zonderVormen.join(', ') + '.');
    console.log('    In ALLE ' + x.mechanismen + ':               ' + x.inAlleMechanismen + ' velden');
    console.log('    In minstens ' + x.helftDrempel + ' van de ' + x.mechanismen + ':       ' + x.inMinstensDeHelft + ' velden');
    console.log('    In precies EEN mechanisme:   ' + x.veldenMechanismeEigen + ' velden (' + x.eigenPct + '%)');
    console.log('');
  };
  console.log('\n  DE NAMENSVORM -- delen de manieren van namens-iemand-handelen een machine?\n');
  blok('SMAL (handelen namens)', s);
  blok('RUIM (handelen plus kennen)', u);
  if (s.gedeeld.length) {
    console.log('  WAT ER WEL GEDEELD WORDT (smal, velden)\n');
    for (const x of s.gedeeld.slice(0, 12)) {
      console.log('    ' + x.veld.padEnd(20) + x.mechanismen + '/' + s.mechanismen + '   ' + x.waar.join(', '));
    }
    console.log('');
  }
  const w = r.gemeten.werkwoord;
  console.log('  DE WERKWOORDEN -- voert elk mechanisme de hele grammatica?');
  console.log('  (naam = onder de woordenschat van kern/vertegenwoordiging; syn = onder EEN van de');
  console.log('   namen die dit huis ervoor gebruikt. Twee beweringen, nooit opgeteld.)\n');
  console.log('    ' + 'mechanisme'.padEnd(20) + 'naam   syn   mist (ook op synoniem)');
  for (const rij of w.perMechanisme) {
    console.log('    ' + rij.mechanisme.padEnd(20) +
      (rij.opNaam.length + '/' + w.werkwoorden).padEnd(7) +
      (rij.opSynoniem.length + '/' + w.werkwoorden).padEnd(6) +
      (rij.mist.length ? rij.mist.join(' ') : '-'));
  }
  console.log('');
  console.log('    Volledig op NAAM:          ' + (w.volledigOpNaam.length ? w.volledigOpNaam.join(', ') : 'geen'));
  console.log('    Volledig op SYNONIEM:      ' + (w.volledigOpSynoniem.length ? w.volledigOpSynoniem.join(', ') : 'geen'));
  console.log('    In ALLE ' + w.mechanismen + ', op naam:       ' + (w.inAlleMechanismenOpNaam.length ? w.inAlleMechanismenOpNaam.join(', ') : 'geen werkwoord'));
  console.log('    In ALLE ' + w.mechanismen + ', op synoniem:   ' + (w.inAlleMechanismenOpSynoniem.length ? w.inAlleMechanismenOpSynoniem.join(', ') : 'geen werkwoord'));
  console.log('    Gemiddeld:                 ' + w.gemiddeldOpNaam + ' op naam, ' + w.gemiddeldOpSynoniem + ' op synoniem (van ' + w.werkwoorden + ')');
  console.log('');
  console.log('  PER WERKWOORD (naam / synoniem)\n');
  for (const x of w.perWerkwoord) {
    console.log('    ' + x.werkwoord.padEnd(14) + (x.opNaam + '/' + x.opSynoniem).padEnd(8) +
      x.waarOpSynoniem.join(', '));
  }
  console.log('');
  const vrij = r.woordenschat.filter(w => w.stand === 'vrij');
  const begrip = r.woordenschat.filter(w => w.stand === 'bezet-samengesteld');
  console.log('  DE VOORGESTELDE WOORDENSCHAT');
  console.log('  (kaal = de identifier IS het woord, een naamBOTSING. samen = het woord zit IN een');
  console.log('   langere identifier, dus het BEGRIP is bezet. Twee assen, nooit opgeteld.)\n');
  console.log('    ' + 'woord'.padEnd(16) + 'kaal   samen   stand               waar');
  for (const w of r.woordenschat.slice(0, 14)) {
    console.log('    ' + w.woord.padEnd(16) + String(w.bestanden).padStart(4) + '  ' +
      String(w.samengesteld).padStart(5) + '   ' + w.stand.padEnd(19) +
      (w.waar.slice(0, 2).join(', ') || w.vormen.slice(0, 2).join(', ')));
  }
  console.log('');
  console.log('  VRIJ (kaal noch samengesteld): ' + (vrij.length ? vrij.map(w => w.woord).join(' ') : 'geen van de ' + r.woordenschat.length));
  if (begrip.length) {
    console.log('');
    console.log('  NAAM VRIJ, BEGRIP BEZET -- hier bouw je een tweede motor naast een bestaande:');
    for (const w of begrip) console.log('    ' + w.woord.padEnd(16) + w.vormen.slice(0, 5).join(' '));
  }
  console.log('');
  console.log('  Lees deze uitkomst met REPRESENTATIE.md par. 0 ernaast: een nul hier zegt');
  console.log('  dat de representatielus geen OBJECT is, niet dat hij niet bestaat.\n');
}

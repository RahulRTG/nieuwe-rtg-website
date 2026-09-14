/* ============================================================================
   CAR-05 -- ER KOMT GEEN CIJFER OP EEN MENS.

   Deze grens staat in VIER documenten en stond in NUL toetsen:

     KANTOORMACHT.md  een score op een mens draagt altijd zijn opbouw, en wordt
                      nooit een sorteersleutel -- niet op klanten, niet op
                      medewerkers.
     HDI.md           de meeteenheid is nooit de mens; een voortgangsmaat mag
                      over een cohort en nooit per persoon, OOK NIET INTERN als
                      sorteersleutel.
     ONTMOETEN.md     er komt geen cijfer op een mens.
     LIFE.md par. 4   een relatie is geen trechter.

   CARRIERE.md par. 4.1 zegt erbij wanneer hij gebouwd hoort te worden: *als
   toets VOOR de eerste carrieremeter, niet erna*. Vandaar dit bestand, en
   vandaar dat het een GEDEELDE grens is en geen derde kopie van een regexp.

   WAAROM GEDEELD EN NIET PER LAAG. De eerste handhaver stond inline in
   test/vertegenwoordiging.test.js en dekte precies een map. Toen kern/rugdekking
   erbij kwam gold de grens daar even hard en hield hem niets tegen. Drie kopieen
   van een woordenlijst zijn binnen een maand drie verschillende woordenlijsten
   (LAT.md regel 4) -- en dan is de strengste lijst de enige die iets zegt,
   terwijl niemand weet welke dat is.

   WAT HIJ MEET: tokens in CODE. Commentaar gaat eraf, want dit bestand en de
   lagen zelf MOETEN de woorden kunnen noemen om uit te leggen waarom ze er niet
   zijn. Dezelfde vorm als keuringsregel 53.

   WAT HIJ NIET MEET, en waarvoor elke laag zijn eigen toets houdt: of de laag
   in zijn ANTWOORD een getal op een mens plakt. Dat is gedrag en geen tekst --
   een veld `gewicht: 0.87` op een mens heet geen `score` en komt hier dus
   ongezien langs. De lexicale helft is een ONDERgrens; `mensVrij()` hieronder
   is de gedragshelft, en beide horen te draaien.

   DE GRAAD IS DUS `vermoed` EN NIET `gemeten`, en dat is met opzet niet
   weggepoetst: wie deze scan groen ziet en denkt dat de grens bewezen is, leest
   hem verkeerd.
   ========================================================================== */
'use strict';

const fs = require('fs');
const path = require('path');
const { zonderCommentaar } = require('./bron');

/* Elk woord met de reden waarom het hier staat. Een lijst zonder redenen groeit
   met woorden die iemand ooit verdacht vond, en krimpt bij de eerste valse
   treffer -- want dan is er niets om tegen af te wegen. */
const WOORDEN = [
  ['score', 'het samengestelde cijfer zelf'],
  ['rating', 'hetzelfde in het Engels; komt binnen via een bibliotheek of een schermnaam'],
  ['ranking', 'een cijfer waarvan de ORDE het product is'],
  ['ranglijst', 'de Nederlandse vorm daarvan; RUGDEKKING.md verbiedt hem expliciet voor jeugd'],
  ['puntenaantal', 'een score die zich voordoet als een telling'],
  ['beoordelingscijfer', 'een oordeel dat zich voordoet als een meting'],
  ['reputatiecijfer', 'CARRIERE.md punt 30 noemt reputatie als kapitaal -- als VOORRAAD met opbouw, nooit als getal'],
  ['betrouwbaarheidsscore', 'kern/betrouwbaarheid.js kent NIVEAUS met een grond; een score ernaast zou die opbouw wegvegen']
];

const PATROON = new RegExp('\\b(' + WOORDEN.map(([w]) => w).join('|') + ')\\b', 'i');
const PATROON_ALLE = new RegExp(PATROON.source, 'gi');

/* EEN ONTKENNING IS GEEN SCORE, en dat is geen versoepeling maar het uitvoeren
   van wat de kop hierboven al belooft: *de lagen zelf MOETEN de woorden kunnen
   noemen om uit te leggen waarom ze er niet zijn*. Dat werkte alleen in
   COMMENTAAR, en precies daar hoort die uitleg NIET te staan -- een lid leest
   geen commentaar. Twee schoolmodules schrijven hem daarom in het antwoord:

     analyse-signalen.js  'Er is bewust geen score en geen volgorde op zwaarte.'
     hr-verlof.js         'Er staat bewust geen cijfer of ranglijst in.'

   Allebei werden ze GEMELD. De scan bestrafte dus de twee modules die hun eigen
   grens het duidelijkst nakomen, en dat is de gevaarlijkste vorm van een valse
   treffer: hij leert je de uitleg weg te laten.

   DE ONTKENNING LOOPT OVER EEN LIJSTJE, en daarom staat er geen vast rijtje
   woorden tussen: "geen cijfer of ranglijst" ontkent allebei, en wie alleen
   `geen\s+$` accepteert vangt de eerste wel en de tweede niet.

   DE GRENS IS TWEE WOORDEN, en dat is geen afgeronde smaak maar het verschil
   tussen een NAAMWOORDGROEP en een BIJZIN. Een ontkenning regeert een kort
   rijtje zelfstandige naamwoorden ("geen cijfer of ranglijst"); zodra er een
   bijzin achter komt, gaat zij niet meer over het laatste woord. Een venster op
   TEKENS in plaats van woorden viel daarop om: `geen aparte weging maar wel een
   echte score` is 33 tekens en dus binnen elk redelijk tekenvenster, terwijl
   het een score AANKONDIGT. Met twee woorden blijft dat een treffer.

   Leestekens tellen niet als woord, dus `{ uitleg: 'geen oordeel', score: 9 }`
   blijft ook een treffer: tussen de ontkenning en `score` staat `',` en dat is
   geen `[\w-]+`. */
const ONTKEND = /\b(geen|zonder|nooit)\b(\s+[\w-]+){0,2}\s+$/i;

/* ============================================================================
   DE BENOEMDE UITZONDERINGEN -- en waarom dit geen toegeeflijkheid is.

   `server/kern/rtfos` en `server/kern/command` stonden buiten de grens met de
   meting ernaast: 1 en 9 treffers, alle tien op een DING. Ze eruit laten is
   goedkoper en het is de slechtste van de twee: een map die niemand bewaakt is
   ONZICHTBAAR, terwijl een map met een benoemde uitzondering bij elke wijziging
   opnieuw wordt gelezen. Dit huis zegt overal *wat er niet is, staat er met de
   reden* -- dat geldt ook voor de grens zelf.

   DRIE EIGENSCHAPPEN MAKEN HET VERSCHIL MET EEN ALLOWLIST.

   1. HET ONDERWERP IS VERPLICHT EN MAG NOOIT EEN MENS ZIJN. Een uitzondering
      verklaart niet "dit woord mag hier" maar "dit getal gaat over X", en X
      wordt getoetst tegen VERBODEN_ONDERWERP. Daarmee kan dit mechanisme
      structureel niet worden gebruikt om een score op een mens door te laten --
      wie het probeert, krijgt een fout in plaats van een vinkje.

   2. EEN UITZONDERING DRAAGT ZIJN EIGEN BEWIJS. `bewijs.bevat` is een letterlijk
      fragment dat in de bron moet staan en dat LAAT ZIEN waarover het getal
      gaat (`kans * impact`, `weeg(waarde, term)`). Verandert de constructie van
      onderwerp, dan verdwijnt dat fragment en vervalt de uitzondering vanzelf.
      Een uitzondering die zijn eigen voorwaarde niet meer waarmaakt, is er geen.

   3. EEN ONBENUTTE UITZONDERING IS EEN FOUT EN GEEN RESTJE. Dekt hij nul
      treffers, dan spreekt hij over een verleden dat niet meer bestaat -- en een
      dode uitzondering is een gat dat eruitziet als beleid. Zelfde les als *een
      register dat niet is hergedraaid, is een bewering over het verleden*.

   WAT HIJ NIET DOET, en dat hoort er even hard bij: hij dekt een BESTAND en niet
   een regel. Komt er in `command/zoek.js` een tweede getal bij dat wel over een
   mens gaat, dan valt dat onder dezelfde uitzondering en ziet deze scan het
   niet. De lexicale helft blijft een ONDERgrens; `mensVrij()` is de gedragshelft
   en die kijkt naar het antwoord in plaats van naar de tekst.
   ========================================================================== */
const VERBODEN_ONDERWERP = ['mens', 'mensen', 'persoon', 'personen', 'lid', 'leden', 'medewerker',
  'klant', 'gebruiker', 'kandidaat', 'leerling', 'sporter', 'talent'];

const UITZONDERINGEN = [
  {
    id: 'rtfos-risicoweging',
    onderwerp: 'een geregistreerd risico van de stichting',
    woorden: ['score'],
    bestanden: ['server/kern/rtfos/risico.js'],
    bewijs: { bestand: 'server/kern/rtfos/risico.js', bevat: '(Number(r.kans) || 0) * (Number(r.impact) || 0)' },
    reden: 'kans maal impact op een GEREGISTREERD RISICO. Het getal hangt uitsluitend aan de twee velden ' +
      'van dat risico en aan niets van een mens; de sortering ordent risicos en geen personen.'
  },
  {
    id: 'command-handelingsrisico',
    onderwerp: 'een handeling van de machine',
    woorden: ['score'],
    bestanden: ['server/kern/command/beleid.js', 'server/kern/command/index.js',
      'server/kern/command/operator.js', 'server/kern/command/puls.js',
      'server/kern/command/runbooks-historie.js', 'server/kern/command/runbooks.js',
      'server/kern/command/simulatie.js', 'server/kern/command/werkbesparing.js'],
    bewijs: { bestand: 'server/kern/frictie/motor.js', bevat: 'return { actie: naam, score, niveau, waarom, vierOgen, opbouw,' },
    reden: 'elk van deze acht draagt dezelfde score, en dat is beoordeel(actie, ctx).score uit ' +
      'kern/frictie/motor.js: de weging van een HANDELING (een runbook, een massamutatie) die bepaalt of ' +
      'de machine hem zelf mag doen. KANTOORMACHT.md eist bij een score de opbouw, en die reist mee als ' +
      'opbouw. Het onderwerp is de handeling; wie hem uitvoert of ondergaat komt er niet in voor.'
  },
  {
    id: 'command-zoekrelevantie',
    onderwerp: 'de overeenkomst tussen een zoekterm en een veldwaarde',
    woorden: ['score'],
    bestanden: ['server/kern/command/zoek.js'],
    bewijs: { bestand: 'server/kern/command/zoek.js', bevat: 'function weeg(waarde, term)' },
    reden: 'de scherpste van de drie, want de gesorteerde rijen KUNNEN mensen zijn. Toch is dit geen cijfer ' +
      'op een mens: weeg(waarde, term) neemt alleen de ingetypte term en de veldwaarde, dus twee rijen met ' +
      'dezelfde tekst krijgen hetzelfde getal ongeacht wie erachter zit. De sortering ordent de MATCH en ' +
      'niet de persoon. Gaat weeg() ooit een eigenschap van het onderwerp lezen, dan verdwijnt het ' +
      'bewijsfragment en vervalt deze uitzondering vanzelf.'
  }
];

/* Keurt de VERKLARING, los van welke code er ligt: dit is de poort van
   eigenschap 1 en 2. Geeft een lijst bezwaren; leeg is goed. */
function keurUitzonderingen(lijst, wortel) {
  const bezwaren = [];
  const gezien = new Set();
  for (const u of lijst || []) {
    const id = String((u && u.id) || '').trim();
    if (!id) { bezwaren.push('een uitzondering zonder id is niet te bespreken'); continue; }
    if (gezien.has(id)) bezwaren.push(id + ': twee uitzonderingen met dezelfde naam');
    gezien.add(id);

    const onderwerp = String(u.onderwerp || '').trim().toLowerCase();
    if (!onderwerp) bezwaren.push(id + ': geen onderwerp -- een uitzondering zegt WAAROVER het getal gaat');
    for (const woord of VERBODEN_ONDERWERP) {
      if (new RegExp('\\b' + woord + '\\b').test(onderwerp)) {
        bezwaren.push(id + ': het onderwerp noemt "' + woord + '". CAR-05 kent geen uitzondering voor een ' +
          'cijfer op een mens -- dat IS de regel en niet een geval ervan.');
      }
    }
    if (String(u.reden || '').trim().length < 40) {
      bezwaren.push(id + ': de reden is te kort om een besluit te dragen');
    }
    if (!Array.isArray(u.bestanden) || !u.bestanden.length) bezwaren.push(id + ': dekt geen enkel bestand');

    const bewijs = u.bewijs || {};
    if (!bewijs.bestand || !bewijs.bevat) { bezwaren.push(id + ': geen bewijsfragment'); continue; }
    let bron = null;
    try { bron = fs.readFileSync(path.join(wortel, bewijs.bestand), 'utf8'); } catch (e) { /* hieronder gemeld */ }
    if (bron == null) bezwaren.push(id + ': het bewijsbestand ' + bewijs.bestand + ' bestaat niet (meer)');
    else if (!bron.includes(bewijs.bevat)) {
      bezwaren.push(id + ': het bewijsfragment staat niet meer in ' + bewijs.bestand + '. De constructie ' +
        'waarover deze uitzondering gaat is veranderd, dus de uitzondering geldt niet meer.');
    }
  }
  return bezwaren;
}

/* De lexicale helft. Geeft een lijst treffers als 'bestand: woord'; leeg is
   goed. Een map die niet bestaat geeft leeg terug EN meldt dat -- een grens die
   over een verdwenen map zwijgt, staat groen zonder iets te bewaken.

   MET `opties.uitzonderingen` gaan de benoemde uitzonderingen mee. Zonder is
   het gedrag exact als hiervoor: geen enkele aanroeper krijgt er stilzwijgend
   soepelheid bij.

   DE UITZONDERING WORDT TOEGEPAST OP DE TREFFER EN NIET OP HET BESTAND, en dat
   verschil is het hele punt. De oude lus stopte na de eerste treffer per
   bestand; zou een uitgezonderde treffer die `break` opsouperen, dan verbergt
   een toegestane score op regel 11 een verboden score op regel 40. Daarom loopt
   hij nu door tot hij een treffer vindt die NIET is uitgezonderd. */
function grensScan(mappen, opties) {
  const lijst = Array.isArray(mappen) ? mappen : [mappen];
  const wortel = (opties && opties.wortel) || path.join(__dirname, '..', '..');
  const uitz = (opties && opties.uitzonderingen) || [];
  const gevonden = [];
  const ontbreekt = [];
  const uitgezonderd = [];
  const benut = new Set();

  const bezwaren = uitz.length ? keurUitzonderingen(uitz, wortel) : [];
  /* Een verklaring die niet door haar eigen keuring komt, dekt NIETS. Anders
     zou een uitzondering met een verboden onderwerp wel een bezwaar opleveren
     en ondertussen gewoon treffers wegpoetsen -- een grens die klaagt terwijl
     hij toegeeft, is geen grens. */
  const geldig = bezwaren.length ? [] : uitz;

  for (const map of lijst) {
    if (!fs.existsSync(map)) { ontbreekt.push(map); continue; }
    for (const naam of fs.readdirSync(map).filter(n => n.endsWith('.js'))) {
      const pad = path.join(map, naam);
      const relatief = path.relative(wortel, pad).split(path.sep).join('/');
      const code = zonderCommentaar(fs.readFileSync(pad, 'utf8'));
      for (const m of code.matchAll(PATROON_ALLE)) {
        if (ONTKEND.test(code.slice(Math.max(0, m.index - 24), m.index))) continue;
        const woord = m[0].toLowerCase();
        const dekt = geldig.find(u => (u.bestanden || []).includes(relatief) &&
          (u.woorden || []).map(w => String(w).toLowerCase()).includes(woord));
        if (dekt) {
          benut.add(dekt.id);
          uitgezonderd.push(relatief + ': ' + m[0] + '  <- ' + dekt.id);
          continue;
        }
        gevonden.push(path.basename(map) + '/' + naam + ': ' + m[0]);
        break;                                   // een melding per bestand is genoeg om te gaan kijken
      }
    }
  }

  /* Eigenschap 3: wie niets meer dekt, hoort weg. Een dode uitzondering is een
     gat dat eruitziet als beleid. */
  const onbenut = geldig.filter(u => !benut.has(u.id)).map(u => u.id);
  return { gevonden, ontbreekt, uitgezonderd, onbenut, bezwaren };
}

/* De gedragshelft: staat er in dit antwoord een GETAL op een mens?

   `uitgezonderd` is geen ontsnapping maar een verklaring: een bedrag, een
   plafond of een jaartal is een getal over GELD of TIJD en niet over een mens.
   Wie hier iets toevoegt, schrijft erbij waarom het geen maat op een mens is.
   Een lege naam accepteren we niet -- dan is de uitzondering onbenoembaar. */
function mensVrij(rijen, uitgezonderd) {
  const vrij = new Set(Object.keys(uitgezonderd || {}));
  for (const naam of vrij) {
    if (!String((uitgezonderd || {})[naam] || '').trim()) {
      throw new Error('de uitzondering ' + naam + ' draagt geen reden; CAR-05 kent geen naamloze uitzondering');
    }
  }
  const fout = [];
  for (const rij of [].concat(rijen || [])) {
    for (const [veld, waarde] of Object.entries(rij || {})) {
      if (vrij.has(veld)) continue;
      if (typeof waarde === 'number') fout.push(veld + ' = ' + waarde);
    }
  }
  return fout;
}

module.exports = { WOORDEN, PATROON, VERBODEN_ONDERWERP, UITZONDERINGEN, keurUitzonderingen, grensScan, mensVrij };

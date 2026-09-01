'use strict';

/* DE VERDELING OVER DELEN -- een regel, op een plek.

   De unit-suite en de schermtoetsen worden allebei over vier runners verdeeld.
   Twee kopieen van diezelfde verdeling lopen vroeg of laat uiteen (LAT.md regel
   4), en de manier waarop ze uiteenlopen is de gevaarlijkste die er is: een
   bestand dat in geen enkel deel valt wordt stil niet getoetst, en alle delen
   melden groen.

   Daarom staat de regel hier, en toetst test/delen.test.js precies dat: de vier
   delen samen zijn de hele lijst, en ze overlappen nergens.

   ---- WAAROM DIT SINDS 1 SEPTEMBER 2026 OP DUUR WEEGT ----

   Hier stond: om en om over de gesorteerde lijst (bestand i hoort bij deel
   i % 4). Dat spreidt naamburen -- in deze suite staan varianten van dezelfde
   zware toets vaak naast elkaar -- maar het weet niets van TIJD, en de traagste
   scherf bepaalt de klok van de hele keten.

   Gemeten in CI-run 33404735353 (main, 31 augustus 2026): de vier scherven
   deden 1336, 548, 501 en 577 seconden. Samen 2962, dus een gelijke verdeling
   is ~740 per scherf: de traagste stond op 1,8x het ideaal en was in zijn
   eentje het kritieke pad.

   ERGER NOG IS DAT HET VERSCHUIFT. Bij een verdeling op VOLGORDE schuift ieder
   bestand na een nieuwe toets een deel op. Toen er op deze tak een enkel
   toetsbestand bijkwam (attributie.test.js, positie 60), verhuisden 299 van de
   314 bestanden van deel 2, en daarmee de zware staart van scherf 1 naar scherf
   2: run 33454187817 gaf 419, 1122, 626 en 549. Dezelfde scheefheid, andere
   scherf, niemand die het zag aankomen.

   De verdeling weegt daarom op de GEMETEN duur uit TOETSDUUR.json.

   ---- LPT: het zwaarste eerst, naar het lichtste deel ----

   Zwaarste bestanden eerst, elk naar het deel dat op dat moment het minst
   draagt. Dat is de klassieke greedy (longest processing time first); hij is
   deterministisch, hij heeft geen geschiedenis nodig, en hij zit bewijsbaar
   binnen 4/3 van het optimum. Voor deze suite is dat ruim genoeg -- het
   verschil tussen 1,8x en 1,05x is de hele winst.

   ---- WAT ER GEBEURT MET EEN BESTAND ZONDER METING ----

   Dit is de plek waar deze wijziging fout kon gaan, dus staat hij hier hardop.
   Een nieuw toetsbestand staat nog in geen enkel register, en hij mag NOOIT uit
   de verdeling vallen -- dat is precies de faalvorm waar dit bestand voor is
   gebouwd.

   Hij krijgt daarom het ZWAARSTE bekende gewicht. Niet nul en niet het
   gemiddelde: dat zijn allebei gokken die de keten SNELLER laten lijken dan hij
   is, en die gok kost een scherf die als laatste nog een half uur bezig is.
   Onbekend telt hier als duur, en dat is de hoofdregel van KEURING.md in een
   regel code -- onzekerheid mag nooit snelheid afdwingen. De prijs is wat
   evenwicht als de gok te hoog was, en dat is de goedkope kant.

   Deze regel komt uit scripts/scherf.js, dat tot 28 augustus 2026 in ci.yml
   stond en toen door `npm run test:deel` is vervangen. Bij die verhuizing is de
   WEGING blijven liggen -- de verdeling ging terug naar om en om -- en dit
   bestand maakt dat af. Het oude script en zijn eigen register zijn opgeruimd:
   twee plekken die hetzelfde verdelen is LAT.md regel 4, en dat is de fout die
   deze hele laag juist moet voorkomen.

   Staat het register er helemaal niet, dan is ALLES ongemeten en dus even
   zwaar. Dan valt de greedy hieronder samen met om en om (i % totaal): gelijke
   gewichten, oplopend op naam, elk naar het laagst geladen deel. De verdeling
   gedraagt zich dan exact zoals vroeger -- een ontbrekende meting maakt de
   keten trager, nooit stiller. */

const fs = require('fs');
const path = require('path');

const REGISTER = path.join(__dirname, '..', '..', 'TOETSDUUR.json');

function ontleedDeel(waarde) {
  const m = /^(\d+)\/(\d+)$/.exec(String(waarde || ''));
  if (!m) return null;
  const nr = Number(m[1]), totaal = Number(m[2]);
  if (nr < 1 || totaal < 1 || nr > totaal) return null;
  return { nr, totaal };
}

/* Het register wordt EEN keer gelezen en daarna onthouden: verdeel() wordt per
   proces een paar keer aangeroepen (gewone bestanden, geisoleerde bestanden) en
   moet dan hetzelfde antwoord geven. */
let onthouden = null;

/* ---- WELK KOSTENMODEL, EN HOEVEEL IS DAT WAARD? ----

   EEN TOETS HEEFT NIET EEN DUUR MAAR EEN DUUR PER MODUS. Met dekking aan is
   ast-grens.test.js meer dan drie keer zo duur als zonder; dat is geen ruis
   maar een ander kostenmodel. Het register houdt ze daarom apart, en hier
   wordt gevraagd naar de modus waarin DEZE ronde draait -- de loper zet hem,
   want die weet als enige of er dekking aan staat.

   EN DE UITKOMST DRAAGT EEN VERTROUWEN, want dat is de fout die dit huis een
   keer heeft gemaakt: een register dat lokaal ZONDER dekking was gemeten voedde
   een keten die op een runner MET dekking draait. De verdeler deed het goed --
   1,00x op zijn eigen projectie -- en de werkelijkheid was 1348s tegen 526s.
   Een verdeling die zich op het verkeerde model baseert ziet er van binnen
   perfect uit. Daarom kan hij dat hier niet meer stil doen:

     geldig         de gevraagde modus staat in het register -> gewoon wegen
     twijfelachtig  alleen een ANDERE modus is bekend -> wegen, maar met een
                    marge: geen scherf krijgt meer bestanden dan zijn deel.
                    Zit het gewicht ernaast, dan is de schade begrensd.
     ongeldig       niets bekend -> alles even zwaar, oftewel om en om

   De marge bij `twijfelachtig` is met opzet een TELLING en geen tijd: als de
   gewichten verdacht zijn, is het enige wat je nog zeker weet hoeveel
   bestanden er zijn. */
const MODI = ['normaal', 'dekking'];

function gevraagdeModus() {
  const m = process.env.RTG_TOETSMODUS;
  return MODI.includes(m) ? m : 'normaal';
}

function duren() {
  if (onthouden) return onthouden;
  const gevraagd = gevraagdeModus();
  let reg = null;
  try { reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8')); } catch (e) { reg = null; }

  const uit = (kaart, vertrouwen, modus) =>
    ({ gewicht: new Map(Object.entries(kaart || {})), vertrouwen, modus, gevraagd });

  if (!reg) return (onthouden = uit(null, 'ongeldig', null));

  /* Een register van voor de modi (versie 1) draagt zijn duur in de top. Die
     metingen zijn ECHT, maar van welke modus weet niemand meer -- dus tellen ze
     als een andere modus: bruikbaar, niet vertrouwd. */
  const modi = reg.modi || (reg.duur ? { onbekend: { duur: reg.duur } } : {});
  const eigen = modi[gevraagd] && modi[gevraagd].duur;
  if (eigen && Object.keys(eigen).length) return (onthouden = uit(eigen, 'geldig', gevraagd));

  for (const naam of [...MODI, 'onbekend']) {
    const ander = modi[naam] && modi[naam].duur;
    if (ander && Object.keys(ander).length) return (onthouden = uit(ander, 'twijfelachtig', naam));
  }
  return (onthouden = uit(null, 'ongeldig', null));
}

/* Alleen voor de toetsen: een eigen weging opleggen zonder een bestand op
   schijf te zetten. Met null valt hij terug op het register. */
function zetDuren(kaart, vertrouwen) {
  onthouden = kaart === null ? null
    : { gewicht: new Map(Object.entries(kaart)), vertrouwen: vertrouwen || 'geldig',
        modus: 'opgelegd', gevraagd: 'opgelegd' };
}

/* Wat de verdeler op dit moment onder zich heeft. De wachter leest dit, en een
   scherm dat over de verdeling iets beweert hoort het erbij te zetten. */
function weging() {
  const d = duren();
  return { vertrouwen: d.vertrouwen, modus: d.modus, gevraagd: d.gevraagd, bestanden: d.gewicht.size };
}

/* De volledige indeling: een array van `totaal` lijsten. Deterministisch --
   dezelfde invoer geeft altijd dezelfde uitkomst, ook op een andere machine,
   want er zit geen tijd, toeval of bestandsvolgorde-van-de-schijf in. */
function indeling(lijst, totaal) {
  const bakken = Array.from({ length: totaal }, () => []);
  const last = new Array(totaal).fill(0);
  const { gewicht, vertrouwen } = duren();

  /* De marge uit de kop: bij twijfel mag geen scherf meer dan zijn deel aan
     BESTANDEN krijgen. Bij `geldig` staat hij uit, want dan zou hij een goede
     weging tegenwerken -- een terecht zware scherf hoort minder bestanden te
     hebben, en dat is precies wat de CI-meting liet zien (258 tegen 331). */
  const plafond = vertrouwen === 'twijfelachtig'
    ? Math.ceil(lijst.length / totaal) : Infinity;

  /* Het zwaarste bekende gewicht is wat een ONGEMETEN bestand krijgt. Is er
     niets bekend, dan is elk bestand even zwaar en valt de greedy samen met de
     oude om-en-om-verdeling; de waarde zelf doet er dan niet toe. */
  const bekend = [...gewicht.values()].filter((v) => v > 0);
  const zwaarste = bekend.length ? Math.max(...bekend) : 1;
  const kost = (naam) => gewicht.get(naam) || zwaarste;

  /* Zwaarste eerst; bij een gelijk gewicht op naam, zodat de uitkomst niet van
     de volgorde van de invoer afhangt maar alleen van de lijst zelf. */
  for (const naam of [...lijst].sort((a, b) =>
    (kost(b) - kost(a)) || (a < b ? -1 : a > b ? 1 : 0))) {
    let k = -1;
    for (let i = 0; i < totaal; i++) {
      if (bakken[i].length >= plafond) continue;
      if (k < 0 || last[i] < last[k]) k = i;
    }
    /* Zit alles aan het plafond, dan wint het plafond het niet van de
       volledigheid: geen enkel bestand valt uit de verdeling. Met het plafond
       hierboven is deze tak ONBEREIKBAAR -- ceil(N/k) x k is altijd minstens N
       -- en hij staat er voor wie die formule ooit aanpast. Nagemeten dat hij
       dan echt werkt: met floor(N/k) blijft de verdeling volledig, en zonder
       deze regel vallen er bestanden weg (drie beweringen zakken). */
    if (k < 0) { k = 0; for (let i = 1; i < totaal; i++) if (last[i] < last[k]) k = i; }
    bakken[k].push(naam);
    last[k] += kost(naam);
  }

  return bakken;
}

function verdeel(lijst, deel) {
  if (!deel) return lijst.slice();
  return indeling(lijst, deel.totaal)[deel.nr - 1];
}

module.exports = { ontleedDeel, verdeel, indeling, zetDuren, weging, MODI, REGISTER };

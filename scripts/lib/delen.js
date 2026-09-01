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
   Een nieuw toetsbestand staat nog in geen enkel register. Hij mag daarom NOOIT
   uit de verdeling vallen -- dat is precies de faalvorm waar dit bestand voor
   is gebouwd. Ongemeten bestanden worden na de gewogen ronde om en om over de
   delen gelegd, in dezelfde volgorde als vroeger. Ze krijgen dus geen verzonnen
   gewicht (dat zou de weging vervuilen met een gok) maar ze worden wel
   evenwichtig verdeeld, en ze zitten gegarandeerd in precies een deel.

   Staat het register er helemaal niet, dan is ALLES ongemeten en gedraagt deze
   functie zich exact zoals hij zich altijd heeft gedragen. Een ontbrekende
   meting maakt de keten trager, nooit stiller. */

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
function duren() {
  if (onthouden) return onthouden;
  try {
    const reg = JSON.parse(fs.readFileSync(REGISTER, 'utf8'));
    onthouden = new Map(Object.entries(reg.duur || {}));
  } catch (e) {
    onthouden = new Map();   // geen register: alles ongemeten, zie de kop
  }
  return onthouden;
}

/* Alleen voor de toetsen: een eigen weging opleggen zonder een bestand op
   schijf te zetten. Met null valt hij terug op het register. */
function zetDuren(kaart) {
  onthouden = kaart === null ? null : new Map(Object.entries(kaart));
}

/* De volledige indeling: een array van `totaal` lijsten. Deterministisch --
   dezelfde invoer geeft altijd dezelfde uitkomst, ook op een andere machine,
   want er zit geen tijd, toeval of bestandsvolgorde-van-de-schijf in. */
function indeling(lijst, totaal) {
  const bakken = Array.from({ length: totaal }, () => []);
  const last = new Array(totaal).fill(0);
  const gewicht = duren();

  const gemeten = [];
  const ongemeten = [];
  for (const naam of lijst) {
    if (gewicht.has(naam)) gemeten.push(naam); else ongemeten.push(naam);
  }

  /* Zwaarste eerst; bij een gelijk gewicht op naam, zodat de uitkomst niet van
     de volgorde van de invoer afhangt. */
  gemeten.sort((a, b) => (gewicht.get(b) - gewicht.get(a)) || (a < b ? -1 : a > b ? 1 : 0));
  for (const naam of gemeten) {
    let k = 0;
    for (let i = 1; i < totaal; i++) if (last[i] < last[k]) k = i;
    bakken[k].push(naam);
    last[k] += gewicht.get(naam);
  }

  /* En de ongemeten bestanden om en om, precies zoals de oude verdeling het
     deed: i % totaal. Zo blijft het aantal per deel in evenwicht en valt er
     nooit een buiten de boot. */
  ongemeten.forEach((naam, i) => bakken[i % totaal].push(naam));

  return bakken;
}

function verdeel(lijst, deel) {
  if (!deel) return lijst.slice();
  return indeling(lijst, deel.totaal)[deel.nr - 1];
}

module.exports = { ontleedDeel, verdeel, indeling, zetDuren, REGISTER };

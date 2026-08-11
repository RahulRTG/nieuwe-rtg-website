/* Magnaat: ONDERZOEK -- de boom, en wat een uitvinding werkelijk doet.

   GEEN NIVEAULADDER MAAR EEN BOOM, en dat is het besluit waar deze hele laag om
   draait. Een ladder (niveau 1 -> 2 -> 3) maakt elk bedrijf hetzelfde, alleen
   verder; een boom met vertakkingen maakt bedrijven ANDERS. Een budgethotel dat
   op energie en automatisering inzet, komt ergens anders uit dan een luxeconcern
   dat op beleving en opbrengststuring gaat. Dat is het verschil tussen groeien
   en je onderscheiden.

   EEN EFFECT IS EEN GEMETEN PRODUCTIVITEITSWINST EN GEEN BONUS. Elk knooppunt
   grijpt aan op een getal dat de motor al gebruikt -- hoeveel eenheden een
   medewerker aankan, wat de vaste lasten per eenheid zijn, welk deel van de
   omzet naar inkoop gaat, wat bouwen kost. Er is geen "+5% winst"-knop, en dat
   is met opzet: een bonus op de uitkomst is niet te controleren, een lagere
   inkoopfractie wel. Zie de reden in scripts/magnaat-pomp.js -- alleen zo is
   scheppende waarde te onderscheiden van gedrukte waarde.

   DRIE KOSTEN EN GEEN EEN. Onderzoek doen kost geld per maand (`kosten`), duurt
   tijd (`duur`), en het RESULTAAT moet daarna nog per vestiging worden
   uitgerold (`implementatie`). Dat laatste is de post die in de meeste spellen
   ontbreekt en die de keuze pas echt maakt: een uitvinding hebben is niet
   hetzelfde als hem gebruiken, en met tien vestigingen is uitrollen duurder dan
   uitvinden.

   DE UITROL IS EEN DEEL VAN DE BOUWSOM EN GEEN VAST BEDRAG, en dat is een
   correctie die uit een meting kwam. Met een vast bedrag hangt de
   terugverdientijd aan de MAAT van de zaak: het toernooi rolde nul keer iets
   uit, want de zaken die spelers in een campagne werkelijk bouwen zijn een
   fractie van de modelvestiging waar de tabel op geijkt was, en op zo'n zaak
   duurde dezelfde uitrol 27 tot 127 maanden in plaats van 10. Dan is onderzoek
   geen keuze maar een voorrecht van wie toevallig groot is. Als deel van
   `gebouwdVoor` -- dezelfde grondslag die de verzekering voor pandschade
   gebruikt -- valt die afhankelijkheid weg: een uitvinding kost wat de zaak
   waard is en levert op wat de zaak omzet.

   DE VOORTGANG IS DETERMINISTISCH MET SPREIDING. Onderzoek is geen weddenschap
   met een muntje maar een pad met meevallers en tegenvallers: elke maand levert
   je budget voortgang op, met een afwijking die uit dezelfde hash komt als de
   risico's (./risico.js). Tien maanden in een keer geeft daardoor dezelfde
   uitkomst als tien maanden los -- de eis onder GAMEHALL.md 12.4. */
const { trek } = require('./risico');

const klem = (n, a, b) => Math.max(a, Math.min(b, n));

/* WAAR EEN UITVINDING OP AANGRIJPT. Vier velden die de motor al kent, plus de
   prijsstand-lat. Elk is een VERMENIGVULDIGER op iets bestaands; een effect dat
   niet op deze lijst staat, bestaat niet. */
const VELDEN = ['perMedewerker', 'vast', 'inkoop', 'bouw', 'markt'];

/* De boom. `vereist` maakt hem een boom en geen lijst: een tak is pas open als
   zijn stam er staat. `takken` zijn met opzet drie: wie alles wil, is nergens
   de beste -- de capaciteit en de looptijd zorgen daarvoor. */
const BOOM = {
  /* ---- de stam: meten voordat je verbetert ---- */
  meten: {
    naam: 'Meten en sturen', tak: 'stam', vereist: [], kosten: 2500, duur: 3, implementatie: 0.017,
    uitleg: 'Weten waar je geld heen gaat, is de voorwaarde voor de rest.',
    effect: { inkoop: 0.97, vast: 0.94 }
  },

  /* ---- tak 1: efficientie -- minder kosten per eenheid ---- */
  energie: {
    naam: 'Slim energiebeheer', tak: 'efficientie', vereist: ['meten'], kosten: 4000, duur: 5, implementatie: 0.030,
    uitleg: 'Lagere vaste lasten en goedkopere brandstof, maar het pand moet ervoor om.',
    effect: { vast: 0.72, inkoop: 0.96 }
  },
  automatisering: {
    naam: 'Automatisering', tak: 'efficientie', vereist: ['energie'], kosten: 7000, duur: 7, implementatie: 0.064,
    uitleg: 'Een medewerker kan meer aan. Wie hierop inzet, wordt een ander bedrijf.',
    effect: { perMedewerker: 1.35 }
  },
  bouwmethode: {
    naam: 'Nieuwe bouwmethodes', tak: 'efficientie', vereist: ['meten'], kosten: 5000, duur: 5, implementatie: 0.030,
    uitleg: 'Uitbreiden en openen wordt goedkoper -- werkt alleen op wat je NOG gaat bouwen.',
    effect: { bouw: 0.82 }
  },

  /* ---- tak 2: opbrengst -- meer halen uit dezelfde plek ---- */
  inkoopkracht: {
    naam: 'Inkoopkracht', tak: 'opbrengst', vereist: ['meten'], kosten: 4500, duur: 4, implementatie: 0.057,
    uitleg: 'Een kleiner deel van de omzet gaat naar inkoop.',
    effect: { inkoop: 0.88 }
  },
  opbrengststuring: {
    naam: 'Opbrengststuring', tak: 'opbrengst', vereist: ['inkoopkracht'], kosten: 7500, duur: 6, implementatie: 0.049,
    uitleg: 'Beter inspelen op wie er wanneer komt: meer vraag op dezelfde plek.',
    effect: { markt: 1.18 }
  },
  beleving: {
    naam: 'Serviceconcept', tak: 'opbrengst', vereist: ['inkoopkracht'], kosten: 6500, duur: 7, implementatie: 0.021,
    uitleg: 'Meer vraag EN duurdere inkoop: dit is de weg omhoog, niet omlaag.',
    effect: { markt: 1.14, inkoop: 1.03 }
  }
};
const KNOPEN = Object.keys(BOOM);

/* WAT UITROLLEN OP DEZE VESTIGING KOST: een deel van wat er staat. Hier en niet
   in ./onderzoek-acties.js, want de meters rekenen hem ook uit en twee
   berekeningen van hetzelfde lopen uiteen. */
const uitrolkosten = (v, sleutel) => Math.round((v.gebouwdVoor || 0) * BOOM[sleutel].implementatie);
const TAKKEN = [...new Set(KNOPEN.map(k => BOOM[k].tak))];

/* Hoeveel onderzoeken er tegelijk mogen lopen. Twee, want dat is wat een keuze
   maakt: met vier loopt iedereen dezelfde boom af en is de vertakking
   decoratie. */
const TEGELIJK = 2;

/* Staat dit knooppunt open? Alles wat het vereist moet AF zijn -- niet in
   onderzoek, maar klaar.

   Hij heet `staatOpen` en niet `open`, en dat is geen smaak: `open` is in deze
   map al de naam van de GROTE actie waarmee je een vestiging opent
   (./acties.js). Twee zusterbestanden met dezelfde kale naam voor twee heel
   verschillende dingen is precies waar scripts/kruisscan.js voor bestaat, en die
   sloeg hier ook aan. */
const staatOpen = (sleutel, klaar) => BOOM[sleutel].vereist.every(v => klaar.includes(v));

/* De voortgang van een maand. Je budget gedeeld door wat het knooppunt per maand
   vraagt, maal een meevaller of tegenvaller uit de hash.

   HAASTEN KAN, MAAR HET KOST MEER DAN HET OPLEVERT. Boven het normale tempo
   loopt de winst terug met een wortel: twee keer betalen levert ongeveer
   anderhalf keer de snelheid. Zonder die kromming is de budgetknop geen keuze
   maar een no-brainer -- hij halveerde de looptijd voor dezelfde TOTAALprijs, en
   dan is er geen enkele reden om hem niet altijd open te draaien. Nu koop je
   tijd met geld, en dat is een afweging: eerder klaar zijn is wat waard, maar de
   euro's die erin gaan kun je ook in een pand steken.

   De looptijd blijft daarnaast een bodem: hoogstens twee keer het normale tempo,
   want sommige dingen kosten gewoon tijd. */
const SPREIDING = 0.35;
const HAAST = 0.7;
function voortgang(partijId, maand, sleutel, budget) {
  const k = BOOM[sleutel];
  const deel = Math.max(0, budget / k.kosten);
  const basis = klem(deel <= 1 ? deel : 1 + Math.sqrt(deel - 1) * HAAST, 0, 2);
  const afwijking = 1 + (trek(partijId + '|rnd|' + maand + '|' + sleutel) - 0.5) * 2 * SPREIDING;
  // per maand hoogstens twee keer het normale tempo: geld alleen wint niet
  return klem(basis * afwijking, 0, 2) / k.duur;
}

/* DE VERMENIGVULDIGER VOOR EEN VELD, gegeven wat er op deze vestiging is
   uitgerold. Meerdere uitvindingen op hetzelfde veld stapelen door
   vermenigvuldiging -- niet door optelling, want dan kan een veld negatief
   worden en is de motor stuk. */
function factor(uitgerold, veld) {
  let f = 1;
  for (const sleutel of uitgerold || []) {
    const e = (BOOM[sleutel] || {}).effect || {};
    if (e[veld]) f *= e[veld];
  }
  return f;
}

/* Wat een uitvinding een vestiging OPLEVERT, in euro's per maand, gegeven de
   huidige cijfers. Dit is geen versiering maar de kern van de belofte in
   scripts/magnaat-pomp.js: waarde mag alleen ontstaan via een MEETBARE
   productiviteitswinst, en dit is de meting. */
function opbrengstVan(sleutel, cijfers) {
  const e = BOOM[sleutel].effect;
  let winst = 0;
  if (e.vast) winst += (cijfers.vast || 0) * (1 - e.vast);
  if (e.inkoop) winst += (cijfers.inkoop || 0) * (1 - e.inkoop);
  if (e.perMedewerker) winst += (cijfers.lonen || 0) * (1 - 1 / e.perMedewerker);
  if (e.markt) winst += (cijfers.marge || 0) * (e.markt - 1);
  return winst;
}

module.exports = { BOOM, KNOPEN, TAKKEN, VELDEN, TEGELIJK, SPREIDING, HAAST, uitrolkosten,
  staatOpen, voortgang, factor, opbrengstVan };

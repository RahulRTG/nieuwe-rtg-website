/* Magnaat: DE RTFOUNDATION ALS ECONOMISCHE ACTOR.

   Dit is het stuk dat Magnaat iets anders maakt dan een tycoon-spel met een
   logo erop. In de spelwereld gaat een deel van de omzet naar de Foundation --
   20% lokaal, 10% centraal, precies de verdeling die RTG buiten het spel ook
   hanteert -- en dat geld wordt ZICHTBAAR besteed aan projecten die de
   simulatie meetbaar veranderen.

   MEETBAAR IS HET WOORD. Een sporthal die alleen in het nieuws staat is
   decoratie; deze projecten verschuiven de eigenschappen van een zone, en dat
   zie je terug in je omzet. Een speler die nooit naar de Foundation kijkt merkt
   dus alsnog dat de buurt verandert -- en dat is de bedoeling, want zo werkt
   het buiten het spel ook.

   WAT ER NIET GEBEURT: de Foundation is geen speler en heeft geen strategie. Ze
   krijgt geld en besteedt het aan het eerstvolgende project dat past. Een
   Foundation die slim zou investeren om ergens winst te maken is precies wat ze
   niet is.

   DE AFDRACHT KOMT UIT DE OMZET VAN DE HELE WERELD, spelers en AI-bedrijven
   samen. Dat is een spelmechaniek en geen weergave van een echte geldstroom:
   buiten het spel komt de bijdrage uit lidmaatschappen, niet uit de omzet van
   ondernemers. Het staat hier zo omdat een spelwereld zonder abonnementen wel
   een economie heeft, en de VERHOUDING is wat je wilt laten zien. */

const DEEL_LOKAAL = 0.20;
const DEEL_CENTRAAL = 0.10;
/* Op welk deel van de omzet die afdracht rust. Bewust laag: dit is niet
   "30% van je omzet gaat weg", het is 30% van een fictieve bijdrage die met de
   economie meebeweegt. Zou het over de volle omzet gaan, dan is de Foundation
   de grootste kostenpost van elk bedrijf en gaat het spel daarover. */
const BIJDRAGE = 0.012;

/* De projecten, per zone-karakter. Elk project zegt wat het KOST en wat het
   VERANDERT -- en dat tweede is een verschuiving op de eigenschappen van de
   zone, dus in dezelfde eenheden waar de vraag mee rekent. */
const PROJECTEN = [
  { id: 'speeltuin', naam: 'Speeltuin en buurtplein', kosten: 90000,
    tekst: 'Een plein waar kinderen kunnen spelen; de buurt loopt er weer langs.',
    effect: { passanten: 6, huur: 2 } },
  { id: 'sporthal', naam: 'Sporthal', kosten: 260000,
    tekst: 'Een sporthal trekt clubs, toernooien en publiek naar de wijk.',
    effect: { passanten: 10, toerisme: 4, huur: 4 } },
  { id: 'bibliotheek', naam: 'Bibliotheek en leerplek', kosten: 180000,
    tekst: 'Een plek om te leren en te werken; op termijn beter opgeleid personeel.',
    effect: { passanten: 5, zakelijk: 6 }, arbeid: 0.04 },
  { id: 'park', naam: 'Stadspark', kosten: 220000,
    tekst: 'Groen in de wijk maakt wonen en verblijven er aantrekkelijker.',
    effect: { passanten: 7, toerisme: 5, geluid: -8, huur: 6 } },
  { id: 'halte', naam: 'Betere OV-verbinding', kosten: 340000,
    tekst: 'Een snellere verbinding; meer mensen bereiken deze plek zonder auto.',
    effect: { ov: 18, passanten: 8, huur: 5 } },
  { id: 'cultuur', naam: 'Cultuurhuis', kosten: 300000,
    tekst: 'Voorstellingen en exposities brengen avondpubliek naar de wijk.',
    effect: { passanten: 8, toerisme: 9, huur: 3 } }
];

function nieuw() {
  return { lokaal: 0, centraal: 0, gedaan: [], volgend: 0 };
}

/* De afdracht over een maand omzet. Geeft terug wat er is afgedragen, zodat de
   speler het als regel op zijn maandoverzicht ziet in plaats van als verschil. */
function draagAf(f, omzet) {
  const bijdrage = omzet * BIJDRAGE;
  const lokaal = bijdrage * DEEL_LOKAAL, centraal = bijdrage * DEEL_CENTRAAL;
  f.lokaal += lokaal;
  f.centraal += centraal;
  return { bijdrage: Math.round(bijdrage), lokaal: Math.round(lokaal), centraal: Math.round(centraal) };
}

/* Is er genoeg voor het volgende project? Zo ja: voer het uit en verschuif de
   zone. De volgorde ligt vast (en niet op toeval), want een campagne moet na
   een herstart hetzelfde verlopen -- zie de kop van ./stap.js. */
function bouw(f, kaart, perZone) {
  const klaar = [];
  while (f.volgend < PROJECTEN.length && f.lokaal >= PROJECTEN[f.volgend].kosten) {
    const p = PROJECTEN[f.volgend];
    f.lokaal -= p.kosten;
    /* Het project landt in de zone met de MEESTE bedrijvigheid: daar komt het
       geld vandaan en daar zijn de mensen die het gebruiken. Bij gelijke stand
       wint de zone die in de stadsdata het eerst staat -- vast en niet
       willekeurig, want een campagne moet na een herstart hetzelfde verlopen. */
    let zone = kaart.zones[0].id, meeste = -1;
    for (const z of kaart.zones) {
      const n = (perZone || {})[z.id] || 0;
      if (n > meeste) { meeste = n; zone = z.id; }
    }
    f.gedaan.push({ id: p.id, zone });
    f.volgend++;
    klaar.push({ id: p.id, naam: p.naam, tekst: p.tekst, zone });
  }
  return klaar;
}

/* Wat de gedane projecten met een kavel doen. Een verschuiving op de
   eigenschappen, opgeteld over alles wat in die zone is gebouwd. */
function effectOp(f, kavel) {
  const uit = {};
  for (const g of f.gedaan) {
    if (g.zone !== kavel.zone) continue;
    const p = PROJECTEN.find(x => x.id === g.id);
    if (!p) continue;
    for (const [veld, delta] of Object.entries(p.effect)) uit[veld] = (uit[veld] || 0) + delta;
  }
  return uit;
}

// hoeveel beter het arbeidspotentieel is geworden (bibliotheek, school)
const arbeidBonus = (f) => f.gedaan.reduce((n, g) =>
  n + ((PROJECTEN.find(x => x.id === g.id) || {}).arbeid || 0), 0);

module.exports = { nieuw, draagAf, bouw, effectOp, arbeidBonus, PROJECTEN, BIJDRAGE, DEEL_LOKAAL, DEEL_CENTRAAL };

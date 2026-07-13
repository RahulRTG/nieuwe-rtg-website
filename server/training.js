/* Training & tips in de PDA: micro-learning voor het personeel, zodat elke zaak
   uitblinkt in gastvrijheid (5-sterren-hotel, Michelin-restaurant). De tips zijn
   rol-bewust (per functie), er is een tip van de dag, en de zaak kan eigen tips
   toevoegen. Een AI-coach beantwoordt vragen; zonder AI valt hij terug op deze
   bibliotheek. Zuiver en testbaar: geen database of netwerk. */

// Rol-gebonden tips (Nederlands, praktisch, gericht op uitblinken).
const TIPS = {
  Bediening: [
    { t: 'Begroet binnen 30 seconden', s: 'Maak oogcontact en groet elke gast binnen een halve minuut, ook in de drukte. Een korte "ik ben zo bij u" doet wonderen.' },
    { t: 'Ken je kaart', s: 'Kun je elk gerecht in een zin beschrijven en de allergenen benoemen? Gasten voelen deskundigheid meteen.' },
    { t: 'Lees de tafel', s: 'Verdiept in gesprek? Kom minder vaak. Kijken ze rond? Loop er langs. Timing is de helft van gastvrijheid.' },
    { t: 'Nooit met lege handen', s: 'Loop je naar de keuken of bar, neem altijd iets mee terug of breng iets weg. Vlot en efficient.' },
    { t: 'De rekening zonder wachten', s: 'Zodra een gast om de rekening vraagt is het gevoel "klaar". Breng hem binnen twee minuten.' }
  ],
  Keuken: [
    { t: 'Mise en place is rust', s: 'Alles op zijn plek voor de dienst begint. Een opgeruimde werkplek is een snelle werkplek.' },
    { t: 'Bevestig elke bon', s: 'Roep de bon terug zodat de hele linie weet wat er aankomt. Geen verrassingen op de pass.' },
    { t: 'Allergie is stop', s: 'Bij een allergiemelding: aparte bereiding, schoon gerei, en laat een tweede persoon meekijken.' },
    { t: 'Proef voor het uitgaat', s: 'Elk bord dat de pass verlaat is jouw handtekening. Proef, veeg de rand, controleer de temperatuur.' }
  ],
  Bar: [
    { t: 'Consistente maat', s: 'Meet je shots, ook in de drukte. Gasten proeven het verschil tussen gisteren en vandaag.' },
    { t: 'Schoon werkvlak', s: 'Veeg tussendoor en spoel je shaker. Een schone bar verkoopt meer.' },
    { t: 'Nooit onder de grens', s: 'Twijfel je over de leeftijd? Vraag ernaar. De app toont dat de leeftijd geverifieerd is.' }
  ],
  Receptie: [
    { t: 'Onthoud de naam', s: 'Gebruik de naam van de gast minstens een keer bij het inchecken. Het is de goedkoopste luxe die er is.' },
    { t: 'Anticipeer', s: 'Late vlucht? Bied aan de kamer klaar te houden. Verjaardag in het systeem? Verras met een attentie.' },
    { t: 'Nooit "dat weet ik niet"', s: 'Zeg "ik zoek het meteen voor u uit" en kom terug met het antwoord.' }
  ],
  Housekeeping: [
    { t: 'De laatste blik', s: 'Loop na het schoonmaken de kamer nog een keer rond met de ogen van de gast. Dat ene haartje valt op.' },
    { t: 'Meld defecten meteen', s: 'Een druppelende kraan of losse haak: meld het als klus, wacht niet tot de gast klaagt.' }
  ],
  Chauffeur: [
    { t: 'Eerder dan afgesproken', s: 'Sta vijf minuten voor tijd klaar. Wachten hoort bij de service, niet bij de gast.' },
    { t: 'Rustig en schoon', s: 'Rijd voorspelbaar, water koud in de auto, muziek zacht tenzij gevraagd. De rit is deel van de reis.' }
  ],
  Piloot: [
    { t: 'Veiligheid eerst, altijd', s: 'Weer, gewicht en helipad-gereedheid: bevestig alles voor het opstijgen. Nooit onder druk van de klok.' },
    { t: 'Rustige briefing', s: 'Leg de gast kort de vlucht en de veiligheid uit. Vertrouwen begint op de grond.' }
  ],
  Gids: [
    { t: 'Vertel een verhaal', s: 'Feiten vergeet men, verhalen blijven. Koppel elke plek aan een klein verhaal.' },
    { t: 'Houd de groep bij elkaar', s: 'Tel je gasten bij elk vertrekpunt. Niemand raakt kwijt op jouw tour.' }
  ],
  Balie: [
    { t: 'Leg de staat samen vast', s: 'Loop bij uitgifte samen met de huurder rond de auto en leg de fotos vast. Duidelijkheid voorkomt discussie.' }
  ],
  Makelaar: [
    { t: 'Luister eerst', s: 'Vraag wat de koper zoekt voor je een pand toont. Een gericht aanbod verkoopt sneller dan tien opties.' }
  ],
  Beheer: [
    { t: 'Coach op de vloer', s: 'De beste training is een goed voorbeeld tijdens de dienst. Vier wat goed gaat, corrigeer rustig en direct.' },
    { t: 'Brief voor de dienst', s: 'Start elke dienst met een korte briefing: verwachtingen, bijzonderheden en een servicedoel voor vandaag.' }
  ]
};

// Voor iedereen, ongeacht functie: de basis van uitblinken.
const ALGEMEEN = [
  { t: 'Uitblinken zit in details', s: 'Onthoud een voorkeur, anticipeer op een wens, los een probleem op voordat de gast het merkt.' },
  { t: 'Een probleem is een kans', s: 'Ging er iets mis? Erken het, los het snel op en doe er iets kleins bovenop. Zo maak je een fan.' },
  { t: 'Verzorgd en aanwezig', s: 'Rechte houding, schone kleding, een glimlach. Je bent het visitekaartje van de zaak.' }
];

// functie-tekst -> tip-sleutel (synoniemen meegenomen)
const FUNC_KEY = [
  ['keuken', 'Keuken'], ['afwas', 'Keuken'], ['chef', 'Keuken'],
  ['bediening', 'Bediening'], ['gastheer', 'Bediening'], ['gastvrouw', 'Bediening'], ['roomservice', 'Bediening'], ['ober', 'Bediening'],
  ['bar', 'Bar'],
  ['recept', 'Receptie'], ['front', 'Receptie'],
  ['housekeep', 'Housekeeping'], ['schoonmaak', 'Housekeeping'], ['onderhoud', 'Housekeeping'],
  ['chauffeur', 'Chauffeur'], ['taxi', 'Chauffeur'],
  ['piloot', 'Piloot'], ['pilot', 'Piloot'], ['crew', 'Piloot'],
  ['gids', 'Gids'], ['ticket', 'Gids'],
  ['balie', 'Balie'], ['monteur', 'Balie'],
  ['makelaar', 'Makelaar'], ['bezichtig', 'Makelaar'],
  ['operations', 'Beheer'], ['beheer', 'Beheer'], ['manager', 'Beheer'], ['security', 'Beheer']
];
function keyVoor(func) {
  const f = String(func || '').toLowerCase();
  const m = FUNC_KEY.find(([w]) => f.includes(w));
  return m ? m[1] : null;
}

// De relevante tips voor deze functie/rol: eerst de eigen functie, dan (voor een
// manager) beheer-tips, en altijd de algemene basis. Zonder dubbelingen.
function tipsVoor(func, role) {
  const uit = [];
  const key = keyVoor(func);
  if (key && TIPS[key]) uit.push(...TIPS[key]);
  if (role === 'manager' && key !== 'Beheer') uit.push(...TIPS.Beheer);
  uit.push(...ALGEMEEN);
  const gezien = new Set();
  return uit.filter(t => (gezien.has(t.t) ? false : gezien.add(t.t)));
}

// Een tip van de dag: elke dag dezelfde voor iedereen met deze functie.
function tipVanDeDag(func, role) {
  const alle = tipsVoor(func, role);
  if (!alle.length) return null;
  return alle[Math.floor(Date.now() / 86400000) % alle.length];
}

// Terugval-coach zonder AI: kies de meest passende tip bij de vraag.
function coachTip(vraag, func, role) {
  const q = String(vraag || '').toLowerCase();
  const alle = tipsVoor(func, role);
  if (!alle.length) return null;
  const woorden = q.split(/\W+/).filter(w => w.length > 3);
  let beste = null, besteScore = 0;
  for (const t of alle) {
    const tekst = (t.t + ' ' + t.s).toLowerCase();
    const score = woorden.reduce((n, w) => n + (tekst.includes(w) ? 1 : 0), 0);
    if (score > besteScore) { besteScore = score; beste = t; }
  }
  return beste || alle[Math.floor(Date.now() / 3600000) % alle.length];
}

module.exports = { TIPS, ALGEMEEN, keyVoor, tipsVoor, tipVanDeDag, coachTip };

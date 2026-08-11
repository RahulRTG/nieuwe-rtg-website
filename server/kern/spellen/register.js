/* Spellen (deelmodule): het register. Een spel beschrijft ZICHZELF in een
   `spel`-descriptor in zijn eigen module, en dit bestand bouwt daar de
   dispatch-tabellen uit (SPEL, SOORTEN, INITS, ZETTEN, ZICHT, STATISCH).

   Er zijn TWEE vormen, en het verschil is niet cosmetisch:

   vorm: 'potje' (de standaard) -- twee tot zes spelers, beurten, een stand die
   de server bewaakt. Een zet is server-authoritatief.
     sleutel      MOET de bestandsnaam zijn (zonder .js)
     naam         zoals het spel in de lobby heet
     max / min    spelersaantal; min dwingt af dat 30 Seconden met vier begint
     wereld       welke app een potje mag STARTEN ('rtg' of 'rtf'); meespelen
                  op uitnodiging kan altijd over en weer
     volwassen    de 18+-poort (Proost), op elk toetredingsmoment afgedwongen
     buitenBeurt  acties die niet op je beurt hoeven (Magnaat bouwen; de duels)
     teams        'altijd' (30 Seconden) of 'keuze' (2-tegen-2 bij een vol potje)
     perTaal      eigen wachtrij per taal (Woordduel heeft een letterzak per taal)
     zicht        WIE ZIET WAT: `speler` (verplicht), `kijker` (weglaten =
                  niet te bekijken) en `publiek` (weglaten = niet op een
                  gedeeld scherm). Drie lagen in plaats van de oude vlag
                  `kijken`, en de reden staat in ./zicht.js: die vlag was een
                  bewering die bij drie spellen niet klopte
     varianten    wat er aan dit spel te KIEZEN valt zonder dat de regels
                  veranderen (Quizduel: waar de vragen vandaan komen), als
                  gesloten lijst per veld; `variantFout` doet de vraag over de
                  velden heen. Zie ./variant.js
     init/zet     de regels zelf; statisch: data die nooit verandert
                  (het Magnaat-bord) en dus niet elke poll mee hoeft

   vorm: 'arcade' -- in je eentje, geen beurt, geen tegenstander. De regels
   draaien in de CLIENT; de server bewaart alleen de hoogste score per speler.
   Een arcadescore is dus niet server-authoritatief zoals een zet dat wel is.
     werelden     lijst van apps waar het spel staat (mag er twee zijn -- Sneek
                  en Tetris staan aan beide kanten; `wereld` enkelvoud hoort bij
                  een potje en betekent daar iets anders: wie mag STARTEN)
     maxPunten    bovengrens waarop de server een ingestuurde score afkapt
     serverScore  de score wordt door de SERVER berekend (Sudoku): de algemene
                  arcade-ingang weigert een ingestuurde score voor dit spel
     dagelijks    dit spel heeft een dagopgave (Sudoku), met `dagOpgave` en
                  `dagKeur` erbij. VEREIST serverScore, en dat is de enige harde
                  koppeling in dit register -- zie de reden in ./keur.js

   Waarom: hiervoor stond een nieuw spel op negen plekken in zes bestanden (de
   SPEL-tabel, drie ctx-opsommingen in spellen.js, de INITS in lobby.js, de
   ZETTEN en de weergaven in partij.js, plus de client), en stonden er vijf losse
   "is dit spel X?"-uitzonderingen in de platformlaag. Vergat je er een, dan
   faalde dat pas in het potje zelf. Nu is een spel toevoegen: een bestand
   neerzetten dat een `spel` teruggeeft. Er is geen tweede plek meer om te
   vergeten, en in lobby.js/partij.js/spellen.js staat geen spelnaam meer.

   De scan is expliciet luid: een module hier die geen geldige descriptor
   teruggeeft laat de server NIET opstarten. Stil overslaan zou betekenen dat
   een spel spoorloos uit de lobby verdwijnt, en dat is precies de klasse fout
   die dit register moet uitsluiten. */
const fs = require('fs'), path = require('path');
const { ZONDER_SPELER } = require('./zicht');
const { bouw: bouwZicht } = require('./zicht');
/* Wat een descriptor MOET zijn staat in ./keur.js en met opzet niet hier: dat
   vocabulaire groeit mee met elk veld dat een spel over zichzelf kan zeggen,
   en deze boekhouding hoeft daar niets van te weten. */
const { keurAlgemeen, keurArcade, keurPotje, keurZicht, keurVariant } = require('./keur');

/* Deelmodules die geen spel zijn maar wel in deze map wonen. Bewust een
   expliciete lijst: een helper die je hier neerzet en vergeet toe te voegen
   valt op bij het opstarten, in plaats van stil mee te scannen. */
const GEEN_SPEL = new Set(['register.js', 'lobby.js', 'partij.js', 'rahul.js', 'klas.js', 'quiz-data.js', 'quiz-school.js',
  'presence.js', 'uitslagen.js', 'prestaties.js', 'toernooi.js', 'zetten.js', 'praat.js', 'telling.js', 'teams.js', 'kring.js', 'arcade.js', 'opruimen.js', 'toernooi-schema.js', 'gedeeld.js', 'grens.js', 'zicht.js', 'klok.js', 'beleid.js', 'nabespreking.js', 'naspelen.js', 'keur.js', 'uitnodigen.js', 'rondom.js', 'projectie.js', 'dag.js', 'variant.js', 'wachtrij.js']);

/* De map is een parameter zodat de toets het register op fixtures kan draaien
   (een module zonder descriptor, een sleutel die niet bij zijn bestand hoort)
   zonder daarvoor bestanden in de echte spellenmap te hoeven zetten. In
   productie roept spellen.js hem zonder tweede argument aan. */
/* Een helper in deze map die zelf het register aanroept (rondom.js doet dat via
   naspelen.js) zou hem oneindig opnieuw laten scannen: de scan vindt het
   bestand, laadt het, en dat laadt de scan. Dat eindigt in een stack overflow
   ver van de oorzaak. Deze vlag maakt er de melding van die er hoort te staan:
   zet het bestand in GEEN_SPEL. */
let bezig = false;

module.exports = (spelCtx, mapOverride) => {
  if (bezig) throw new Error('spellen/register: het register roept zichzelf aan. ' +
    'Een bestand in spellen/ dat ./register vraagt hoort in GEEN_SPEL te staan.');
  const map = mapOverride || __dirname;
  const bestanden = fs.readdirSync(map, { withFileTypes: true })
    .filter(d => (d.isDirectory() || d.name.endsWith('.js')) && !GEEN_SPEL.has(d.name))
    .map(d => d.name)
    .sort();

  /* De sentinel reist mee in de context en niet via een require in elk spel:
     het register is de eigenaar van het descriptor-vocabulaire, dus het deelt
     ook het woord uit dat daarin gebruikt mag worden. */
  const ctx = Object.assign({ ZONDER_SPELER }, spelCtx);

  bezig = true;
  try {
  const SPEL = {}, INITS = {}, ZETTEN = {}, ZICHT = {}, STATISCH = {}, ARCADE = {}, DAG = {}, VARIANT = {}, ruw = {};
  for (const naam of bestanden) {
    const mod = require(path.join(map, naam))(ctx);
    const s = mod && mod.spel;
    if (!s) throw new Error(`spellen/register: ${naam} geeft geen \`spel\`-descriptor terug. ` +
      'Voeg er een toe, of zet het bestand in GEEN_SPEL als het geen spel is.');
    const vorm = keurAlgemeen(naam, s);
    // een sleutel mag maar EEN ding zijn: een potje of een arcadespel, nooit
    // allebei -- anders is "/spel/zet met soort=sneek" een open vraag
    if (SPEL[s.sleutel] || ARCADE[s.sleutel]) throw new Error(`spellen/register: '${s.sleutel}' staat er twee keer in.`);

    /* De losse benoemde exports blijven bereikbaar, en dat gebeurt HIER --
       vóór de splitsing per vorm. Stond dit in de potje-tak, dan sloeg de
       `continue` van een arcadespel het over: Sudoku levert zijn puzzelmotor
       zo mee, en die was daardoor onvindbaar. De descriptor zelf gaat er niet
       in; die zou bij elk volgend spel over de vorige heen schrijven. */
    for (const [k, v] of Object.entries(mod)) if (k !== 'spel') ruw[k] = v;

    if (vorm === 'arcade') {
      ARCADE[s.sleutel] = keurArcade(naam, s);
      /* De twee haken van een dagopgave staan APART en niet in ARCADE: die tabel
         is data (hij reist mee naar de toetsen en wordt vergeleken met een
         gouden lijst), en functies horen daar niet in. `keurArcade` heeft ze al
         nagelopen; hier worden ze alleen neergezet. */
      if (ARCADE[s.sleutel].dagelijks) DAG[s.sleutel] = { opgave: s.dagOpgave, keur: s.dagKeur };
      continue;
    }

    SPEL[s.sleutel] = keurPotje(naam, s);
    /* De varianten: de LIJSTEN naar SPEL (die reizen naar de lobby, die er een
       keuzerij van tekent), de keurfunctie van het spel naar VARIANT. Een pas,
       twee bestemmingen -- ze kunnen dus niet uiteenlopen. */
    const varianten = keurVariant(naam, s);
    if (varianten) { SPEL[s.sleutel].varianten = varianten.velden; VARIANT[s.sleutel] = varianten; }
    INITS[s.sleutel] = s.init;
    ZETTEN[s.sleutel] = s.zet;
    ZICHT[s.sleutel] = bouwZicht(s.sleutel, keurZicht(naam, s));
    if (s.statisch) STATISCH[s.sleutel] = s.statisch;
  }
  const SOORTEN = Object.fromEntries(Object.entries(SPEL).map(([k, v]) => [k, v.naam]));
  return { SPEL, SOORTEN, INITS, ZETTEN, ZICHT, STATISCH, ARCADE, DAG, VARIANT, ruw };
  } finally { bezig = false; }   // ook als de keuring terecht gooit
};

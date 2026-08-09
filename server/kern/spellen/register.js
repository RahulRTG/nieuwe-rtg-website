/* Spellen (deelmodule): het register. Een spel beschrijft ZICHZELF in een
   `spel`-descriptor in zijn eigen module, en dit bestand bouwt daar de
   dispatch-tabellen uit (SPEL, SOORTEN, INITS, ZETTEN, VIEWS, STATISCH).

   Wat een descriptor zegt:
     sleutel      MOET de bestandsnaam zijn (zonder .js)
     naam         zoals het spel in de lobby heet
     max / min    spelersaantal; min dwingt af dat 30 Seconden met vier begint
     wereld       welke app een potje mag STARTEN ('rtg' of 'rtf'); meespelen
                  op uitnodiging kan altijd over en weer
     volwassen    de 18+-poort (Proost), op elk toetredingsmoment afgedwongen
     buitenBeurt  acties die niet op je beurt hoeven (Magnaat bouwen; de duels)
     eigenBeurt   het spel houdt zelf bij wie aan zet is (schaken)
     teams        'altijd' (30 Seconden) of 'keuze' (2-tegen-2 bij een vol potje)
     perTaal      eigen wachtrij per taal (Woordduel heeft een letterzak per taal)
     init/zet/view  de regels zelf; statisch: data die nooit verandert
                  (het Magnaat-bord) en dus niet elke poll mee hoeft

   Waarom: hiervoor stond een nieuw spel op negen plekken in zes bestanden (de
   SPEL-tabel, drie ctx-opsommingen in spellen.js, de INITS in lobby.js, de
   ZETTEN en VIEWS in partij.js, plus de client), en stonden er vijf losse
   "is dit spel X?"-uitzonderingen in de platformlaag. Vergat je er een, dan
   faalde dat pas in het potje zelf. Nu is een spel toevoegen: een bestand
   neerzetten dat een `spel` teruggeeft. Er is geen tweede plek meer om te
   vergeten, en in lobby.js/partij.js/spellen.js staat geen spelnaam meer.

   De scan is expliciet luid: een module hier die geen geldige descriptor
   teruggeeft laat de server NIET opstarten. Stil overslaan zou betekenen dat
   een spel spoorloos uit de lobby verdwijnt, en dat is precies de klasse fout
   die dit register moet uitsluiten. */
const fs = require('fs'), path = require('path');

/* Deelmodules die geen spel zijn maar wel in deze map wonen. Bewust een
   expliciete lijst: een helper die je hier neerzet en vergeet toe te voegen
   valt op bij het opstarten, in plaats van stil mee te scannen. */
const GEEN_SPEL = new Set(['register.js', 'lobby.js', 'partij.js', 'rahul.js', 'klas.js', 'quiz-data.js']);

// wat een descriptor MOET hebben; ontbreekt er iets, dan noemen we het bestand
const VERPLICHT = ['sleutel', 'naam', 'max', 'wereld', 'init', 'zet', 'view'];

/* De map is een parameter zodat de toets het register op fixtures kan draaien
   (een module zonder descriptor, een sleutel die niet bij zijn bestand hoort)
   zonder daarvoor bestanden in de echte spellenmap te hoeven zetten. In
   productie roept spellen.js hem zonder tweede argument aan. */
module.exports = (spelCtx, mapOverride) => {
  const map = mapOverride || __dirname;
  const bestanden = fs.readdirSync(map, { withFileTypes: true })
    .filter(d => (d.isDirectory() || d.name.endsWith('.js')) && !GEEN_SPEL.has(d.name))
    .map(d => d.name)
    .sort();

  const SPEL = {}, INITS = {}, ZETTEN = {}, VIEWS = {}, STATISCH = {}, ruw = {};
  for (const naam of bestanden) {
    const mod = require(path.join(map, naam))(spelCtx);
    const s = mod && mod.spel;
    if (!s) throw new Error(`spellen/register: ${naam} geeft geen \`spel\`-descriptor terug. ` +
      'Voeg er een toe, of zet het bestand in GEEN_SPEL als het geen spel is.');
    const mist = VERPLICHT.filter(k => s[k] === undefined || s[k] === null);
    if (mist.length) throw new Error(`spellen/register: ${naam} mist in \`spel\`: ${mist.join(', ')}.`);
    // de sleutel MOET de bestandsnaam zijn: anders lopen de map en de tabel
    // uiteen en zoek je een spel dat er wel is en toch niet start
    const verwacht = naam.replace(/\.js$/, '');
    if (s.sleutel !== verwacht) throw new Error(`spellen/register: ${naam} noemt zich '${s.sleutel}'; verwacht '${verwacht}'.`);
    if (s.wereld !== 'rtg' && s.wereld !== 'rtf') throw new Error(`spellen/register: ${naam} heeft wereld '${s.wereld}'; alleen 'rtg' of 'rtf'.`);
    if (SPEL[s.sleutel]) throw new Error(`spellen/register: '${s.sleutel}' staat er twee keer in.`);

    SPEL[s.sleutel] = { naam: s.naam, max: s.max, wereld: s.wereld };
    if (s.min) SPEL[s.sleutel].min = s.min;
    if (s.volwassen) SPEL[s.sleutel].volwassen = true;
    if (s.eigenBeurt) SPEL[s.sleutel].eigenBeurt = true;
    if (s.buitenBeurt) SPEL[s.sleutel].buitenBeurt = s.buitenBeurt;
    if (s.perTaal) SPEL[s.sleutel].perTaal = true;
    if (s.teams) {
      if (s.teams !== 'altijd' && s.teams !== 'keuze')
        throw new Error(`spellen/register: ${naam} heeft teams '${s.teams}'; alleen 'altijd' of 'keuze'.`);
      SPEL[s.sleutel].teams = s.teams;
    }
    INITS[s.sleutel] = s.init;
    ZETTEN[s.sleutel] = s.zet;
    VIEWS[s.sleutel] = s.view;
    if (s.statisch) STATISCH[s.sleutel] = s.statisch;
    /* De losse benoemde exports blijven bereikbaar: de drift-toets vergelijkt
       een paar spelregels (rummiSet, W_PREMIE) met de kopie in de client. De
       descriptor zelf gaat er niet in -- die zou bij elk volgend spel over de
       vorige heen schrijven en dan lijkt `ruw.spel` iets te betekenen. */
    for (const [k, v] of Object.entries(mod)) if (k !== 'spel') ruw[k] = v;
  }
  const SOORTEN = Object.fromEntries(Object.entries(SPEL).map(([k, v]) => [k, v.naam]));
  return { SPEL, SOORTEN, INITS, ZETTEN, VIEWS, STATISCH, ruw };
};

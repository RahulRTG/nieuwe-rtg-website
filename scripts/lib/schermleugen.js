/* ============================================================================
   MAG DIT SCHERM DIT ZEGGEN? -- de drie detectoren achter test/liegend-scherm.e2e.js.

   WAAROM ZE HIER STAAN EN NIET IN DE TOETS. Een schermtoets heeft een browser
   nodig, en een browser is er niet altijd -- op een kale CI slaat hij zichzelf
   over. Dan slaat hij ook zijn eigen oordeelslogica over, en die logica is nu
   juist het stuk waar een fout onopgemerkt in kan blijven zitten. Een regexp die
   nooit aanslaat geeft een groene toets over zes schermen.

   Los hier is de logica puur: tekst erin, klachten eruit. Zo is ze te toetsen
   zonder browser (test/schermleugen.test.js) en kan de mutatiemotor eraan komen.
   Dat verschil is niet theoretisch -- de eerste ronde van de schermtoets stond
   meteen groen, en dan wil je kunnen bewijzen dat de meter niet blind is.
   ========================================================================== */
'use strict';

/* ROMMEL: wat nooit een bewuste keuze is. Met scheidingstekens eromheen, want
   "undefined" middenin een woord of in een uitleg over programmeren is geen
   kapot scherm. Een lid ziet het verschil niet, een regexp wel. */
const ROMMEL = [
  { naam: 'undefined', re: /(^|[\s>(\[:,€])undefined([\s<)\],.]|$)/ },
  { naam: 'NaN', re: /(^|[\s>(\[:,€])NaN([\s<)\],.]|$)/ },
  { naam: '[object Object]', re: /\[object Object\]/ },
  { naam: 'null', re: /(^|[\s>(\[:,€])null([\s<)\],.]|$)/ }
];

/* ZEKERHEID: een VOLTOOID feit over geld, opslag of een afspraak.

   Alleen voltooide vormen, en dat is de hele lijst. "Opslaan" op een knop is een
   voornemen en volkomen in orde; "Opgeslagen" is een bewering over de
   werkelijkheid. "Betalen" mag; "Betaald" is een uitspraak over een grootboek
   waar dit scherm niets van weet zodra de backend leeg antwoordt. */
const ZEKERHEID = ['Betaald', 'Bevestigd', 'Opgeslagen', 'Verzonden', 'Voltooid',
  'Geboekt', 'Geactiveerd', 'Goedgekeurd', 'Afgerond', 'Gelukt'];

/* Een heel woord, hoofdletterongevoelig aan de randen maar niet in het woord
   zelf: "onbetaald" bevat "betaald" en betekent het tegenovergestelde. */
function heelWoord(woord, tekst) {
  return new RegExp('(^|[^a-zA-Z])' + woord + '([^a-zA-Z]|$)').test(tekst);
}

/* DE DRIE KLACHTEN.

   `tekst` is wat een lid ZIET nadat de JS heeft gedraaid op een leeg antwoord.
   `statisch` is het .html-bestand zonder dat er JS aan te pas kwam: de ijklijn.

   De zekerheidsvraag vergelijkt die twee, en dat is met opzet. Een
   zekerheidswoord mag gerust in een scherm staan -- in een uitleg, in een
   legenda, in een verborgen sjabloon. De vraag is of het scherm het ZELF is
   gaan zeggen terwijl er niets binnenkwam. Zo hoeft er geen woordenlijst per
   pagina te worden bijgehouden: elk scherm ijkt zichzelf. */
function vindKlachten({ tekst, statisch, fouten }) {
  const klachten = [];
  for (const f of (fouten || [])) klachten.push('JS-fout: ' + String(f).slice(0, 120));
  for (const r of ROMMEL) if (r.re.test(tekst || '')) klachten.push('rommel in beeld: ' + r.naam);
  for (const w of ZEKERHEID) {
    if (heelWoord(w, tekst || '') && !heelWoord(w, statisch || '')) {
      klachten.push('zekerheid zonder gegevens: "' + w + '"');
    }
  }
  return klachten;
}

/* DE RATEL. Nieuw ten opzichte van de opgeschreven schuld is een fout; minder is
   winst en hoort te worden vastgelegd.

   DAT TWEEDE IS GEEN NETHEID. Een schuldregel die blijft staan terwijl het gat
   dicht is, beschermt niets meer en verbergt dat het scherm opnieuw kapot kan
   gaan zonder dat de poort dichtgaat -- de regel dekt de klacht dan immers af.
   Daarom telt een opgeloste regel die nog in de lijst staat hier als fout. */
function vergelijk(gevonden, bekend) {
  const nieuw = [], opgelost = [];
  for (const [scherm, klachten] of Object.entries(gevonden || {})) {
    for (const k of klachten) if (!((bekend || {})[scherm] || []).includes(k)) nieuw.push(scherm + ' -> ' + k);
  }
  for (const [scherm, klachten] of Object.entries(bekend || {})) {
    for (const k of klachten) if (!((gevonden || {})[scherm] || []).includes(k)) opgelost.push(scherm + ' -> ' + k);
  }
  return { nieuw, opgelost };
}

module.exports = { ROMMEL, ZEKERHEID, heelWoord, vindKlachten, vergelijk };

/* ============================================================================
   DUURZAAM VASTLEGGEN -- een mutatie die pas telt als de opslag hem BEVESTIGT.

   WAAROM DIT BESTAAT. De gewone save() is write-behind: hij plant een
   schrijfactie en keert meteen terug. Voor afgeleide toestand (caches, tellers,
   indexen) is dat precies goed. Voor werk van een lid niet, en de ketenronde
   weerlegde de belofte die eronder lag: een notitie werd met 200 bevestigd en
   was na een herstart weg (KETENS.json, verraad `schrijf-verloren` -- STIL
   VERLIES). Een bevestiging die de opslag nog niet heeft gedaan is een leugen,
   ook als het om een boodschappenlijstje gaat.

   WAAROM HIER EN NIET IN ELKE APP. De reikwijdte in GELDLAT.md is "geld en
   alles wat een lid zelf maakt": notities, agenda, bestanden, berichten. Vier
   apps met elk hun eigen kopie van deze zes regels is vier plekken die een
   waarheid vasthouden (LAT.md, regel 4), en de eerste die uit de pas loopt doet
   dat stil. Dus een plek, en de apps bedraden hem.

   WAT HIJ NIET IS. Geen "veilige save" die je overal neerzet. De aanroepplekken
   staan met een reden per regel op de lijst van `npm run check` regel 47, en die
   regel kijkt ook naar de naam van dit bestand -- zonder dat zou een app hem
   kunnen requiren zonder dat de poort iets zegt.

   BEVESTIGBAAR EN DUURZAAM ZIJN TWEE DINGEN. Een opslag die niet kan tellen
   (geheugen) mag geen mutatie laten mislukken -- dat brak eerder vier
   geldtoetsen -- maar mag evenmin doorgaan voor bewijs. Dat verschil zit in
   db/saveDuurzaam(); hier gooit de bundel alleen waar bevestigen mogelijk is.
   ========================================================================== */
'use strict';

/* ---------------------------------------------------------------------------
   DE MEETSCHAKELAAR -- en waarom hij ondanks alles mag bestaan.

   GELDLAT.md stap 6 vraagt om een getal: wat kost de duurzame commit aan
   latentie? Dat getal is alleen eerlijk als je DEZELFDE machine, DEZELFDE opslag
   en DEZELFDE belasting twee keer meet -- een keer met en een keer zonder
   (LAT.md regel 10: 144 ms op vier kernen is geen betere 144 ms dan op zestien).
   Zonder schakelaar bestaat die tweede meting niet.

   EN WAAROM HIJ GEVAARLIJK IS. Dit is letterlijk een knop die de belofte uitzet
   waar deze hele reeks over ging. Hij krijgt daarom dezelfde behandeling als
   RTG_VERRAAD in server/lib/verraad.js:

     - hij weigert in productie, hard, bij het opstarten;
     - hij schreeuwt in het log zodra hij aanstaat, elke start opnieuw;
     - hij heet naar wat hij DOET (duurzaamheid uit), niet naar wat hij oplost.

   Een stille vlag die "even sneller" betekent, staat binnen een half jaar in een
   productie-omgeving. Deze niet. */
const DUURZAAM_UIT = String(process.env.RTG_DUURZAAM || '').toLowerCase() === 'uit';
if (DUURZAAM_UIT) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('RTG_DUURZAAM=uit staat aan in productie. Dat zet de belofte uit dat ' +
      'bevestigd werk ook is vastgelegd. Zet hem uit.');
  }
  console.warn('[duurzaam] LET OP: RTG_DUURZAAM=uit -- werk van een lid wordt bevestigd ' +
    'ZONDER dat de opslag het heeft vastgelegd. Alleen voor de kostenmeting.');
}

/* `bron` is de app-naam voor het log. `bijeen` en `save` komen uit db/index.js.

   Geeft een functie terug die een SYNCHRONE mutatie aanneemt en `null` teruggeeft
   als het is vastgelegd, of een foutantwoord ({status, error}) als de opslag het
   niet kon bevestigen. Die vorm is met opzet: de aanroeper kan hem rechtstreeks
   teruggeven en kan hem niet per ongeluk negeren zoals een boolean. */
module.exports = function maakVastleggen({ bijeen, save, inBundel, bron }) {
  /* Zonder de bundel zou een app terugvallen op de gewone write-behind save() en
     weer 200 zeggen over iets wat de opslag nog niet heeft gedaan. Een
     ontbrekende afhankelijkheid hoort hier luid te zijn: dit is opstarttijd. */
  if (typeof bijeen !== 'function' || typeof save !== 'function') {
    throw new Error('duurzaam vastleggen heeft db.bijeen en db.save nodig (zie GELDLAT.md).');
  }
  const naam = bron || 'app';
  /* `mutatie` mag WEGGELATEN worden, en dat is geen slordigheid maar een tweede
     vorm met een eigen betekenis: "leg vast wat er hierboven al in het geheugen
     is veranderd". Sommige handlers muteren over tientallen regels heen, met
     seintjes en kopieën ertussen; die in een callback persen zou de code
     onleesbaarder maken dan de winst waard is. Het is veilig zolang er tussen de
     mutatie en deze aanroep geen `await` staat -- dan kan geen ander verzoek de
     halve toestand zien of wegschrijven. */
  const niets = () => {};
  return async function vastleggen(mutatie = niets) {
    /* AL IN EEN BUNDEL? DAN MEEDOEN, NIET ZELF COMMITTEN.

       Een notitie met een datum maakt een agenda-afspraak, en allebei die lagen
       leggen duurzaam vast. Zou de binnenste zijn eigen commit doen, dan staat
       de afspraak vast voordat de notitie dat is -- twee commits met een gat
       ertussen, precies wat bijeen() moest wegnemen. De buitenste bundel neemt
       deze mutatie mee; faalt die, dan faalt alles samen.

       Een worp gaat hier BEWUST omhoog in plaats van als 503 terug: de
       buitenste laag heeft zijn eigen antwoord al bedacht, en twee antwoorden
       op een verzoek is er een te veel. */
    if ((typeof inBundel === 'function' && inBundel()) || DUURZAAM_UIT) {
      await mutatie();
      save();
      return null;
    }
    try {
      await bijeen(async () => { await mutatie(); save(); }, { duurzaam: true });
    } catch (e) {
      /* Niet stil (LAT.md, regel 5): het lid krijgt een nee, en waarom de opslag
         niet bevestigde hoort in het log -- anders is een app die 503'en
         uitdeelt niet te onderscheiden van een app die het druk heeft. */
      console.warn('[' + naam + '] de duurzame commit is niet vastgelegd:', e && e.message);
      return { status: 503, error: 'Dit is niet vastgelegd; probeer het zo nog een keer.' };
    }
    return null;
  };
};

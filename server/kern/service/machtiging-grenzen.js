/* ============================================================================
   DE GRENZEN VAN EEN SERVICEMACHTIGING -- wie mag wat vragen.

   Pure tabel en twee voorspellingen, zonder state. Apart van ./machtiging.js
   omdat dat bestand er over de omvangsgrens van keuringsregel 13 mee ging, en
   omdat een grens die je op één plek kunt aanwijzen makkelijker overeind blijft
   dan een die tussen de levensloop door staat.
   ========================================================================== */
'use strict';

/* Capabilities die niet met een enkele handtekening opengaan. De lijst is kort
   met opzet: elke regel hier maakt een handeling duurder, en een lijst die
   alles bevat wordt door iedereen omzeild. */
const ZWAAR = {
  'identiteit.openen': 'De echte naam achter een codenaam.',
  'bank.gegevens': 'Rekeninggegevens van een lid of zaak.',
  'geld.compensatie': 'Geld toekennen buiten de gewone weg om.',
  'gegevens.uitvoer': 'Een export van iemands gegevens.'
};

/* EEN AI IS EEN AANROEPER MET EEN EIGEN VOORVOEGSEL, en dat is geen etiket maar
   een grens. Een sessie levert de sleutel van een MENS; niemand kan zichzelf
   `ai:` noemen, dus wat dit voorvoegsel draagt is aantoonbaar een machine.

   Twee dingen volgen eruit, en ze staan hier omdat ze anders in drie bestanden
   opnieuw zouden worden bedacht:
     - een AI kan nooit de TWEEDE HANDTEKENING zijn. Die eis bestaat om een mens
       naast een mens te zetten; een machine ernaast zetten haalt hem leeg.
     - een AI krijgt NOOIT zwaar werk, ook niet met een bevestiging van het lid.
       Zwaar werk vraagt al een tweede mens, en de vorige regel maakt dat voor
       een AI onbereikbaar -- dat expliciet weigeren is eerlijker dan hem laten
       vastlopen op een handtekening die nooit komt. */
const AI_VOOR = 'ai:';
const isAi = (wie) => String(wie || '').startsWith(AI_VOOR);

module.exports = { ZWAAR, AI_VOOR, isAi };

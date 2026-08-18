/* De RTG-klok: EEN klok voor het hele besturingssysteem. Elke app die tijd
   toont gebruikt dit onderdeel, zodat de klok overal exact hetzelfde is:
   uren en minuten in Bodoni (het display-gezicht van het huis), seconden
   kleiner in hetzelfde gezicht, milliseconden als fijn goudaccent. De
   cijfers zijn tabulair (geen dansende breedtes) en lopen vloeiend mee op
   requestAnimationFrame; in een achtergrond-tabblad pauzeert dat vanzelf,
   en wie minder beweging wil (prefers-reduced-motion) ziet de
   milliseconden niet.

   De ring (data-rtg-klok="ring") is een verfijnde, ingetogen wijzerplaat in
   de taal van een klassiek chique horloge: slanke, gepolijste wijzers met
   een lume-kanaal, een fijne lollipop-secondewijzer, toegepaste indexen met
   lume-punten en een licht verdiepte plaat. Het GOUD staat vast (het
   huisgoud, altijd goud); de SFEER -- de fijne sunray en de accent-flens --
   ademt mee met de levende dagkleur van het palet. De weekdag (in de taal
   van de gebruiker) en de datum staan in identieke gouden kastjes: een
   kloppend geheel.

   Gebruik: geef een element het attribuut data-rtg-klok (de klok) of
   data-rtg-datum (de lange datum in de taal van de pagina); dit script
   vindt ze zelf. Bestaande id's blijven werken; alleen de vulling komt
   voortaan van hier. */
(() => {
  if (window.RTGKlok) return;

  const stijl = document.createElement('style');
  stijl.id = 'rtg-klok-stijl';
  stijl.textContent =
    '.rtg-klok{display:inline-flex;align-items:baseline;font-variant-numeric:tabular-nums;white-space:nowrap;}' +
    ".rtg-klok .ku{font-family:'Bodoni Moda',serif;font-weight:400;letter-spacing:0.02em;}" +
    ".rtg-klok .ks{font-family:'Bodoni Moda',serif;font-weight:400;font-size:0.5em;opacity:0.85;margin-left:0.1em;}" +
    '.rtg-klok .km{font-family:Inter,system-ui,sans-serif;font-weight:400;font-size:0.26em;letter-spacing:0.08em;' +
      'color:var(--klok-goud,var(--gold,#C9A24B));margin-left:0.22em;min-width:3.6ch;text-align:left;align-self:center;}' +
    '@media (prefers-reduced-motion: reduce){.rtg-klok .km{display:none;}}' +
    // Twee sleutelkleuren: --klok-goud = het HUISGOUD (staat VAST), --klok-sfeer
    // = de levende dagkleur van het palet (hierin ademt de fijne sunray + flens).
    /* DE MAAT VAN DE KLOK STAAT OP EEN PLEK. Wie de klok ergens schaalt, moet
       weten hoe groot hij onder die schaal wordt -- anders reserveert de
       indeling de ONgeschaalde maat en schuift wat eronder staat er dwars
       doorheen. Dat gebeurde op de poort: de lippen landden midden op de
       wijzerplaat zodra de klok op een breed scherm 1,5x ging.
       Een tweede keer "16rem" opschrijven bij die schaal zou twee plekken
       geven die dezelfde waarheid bewaren (LAT.md regel 4); daarom staat de
       maat hier als token en rekent de poort ermee. */
    ':root{--rtg-klok-maat:min(16rem,74vw);}' +
    '.rtg-ring{position:relative;display:inline-flex;align-items:center;justify-content:center;' +
      'width:var(--rtg-klok-maat);height:var(--rtg-klok-maat);' +
      '--klok-goud:var(--gold,#C9A24B);' +
      '--klok-sfeer:var(--dag-kleur,var(--s-accent-hel,var(--s-accent,#7F1634)));}' +
    // De klok hangt niet lós voor de achtergrond: een korte contactschaduw
    // geeft de kast gewicht, een zachte gerichte schaduw zet hem in de ruimte.
    // Die twee wijken naar rechtsonder met dezelfde verhouding (x = 0.82 * y)
    // als de wijzerschaduwen: één lichtbron voor kast én wijzers.
    //
    // Hier stond ook een brede zwarte halo (4.5rem, 0.55) en stonden beide
    // schaduwen op halve dekking. Op een zwarte achtergrond viel dat weg, maar
    // het beginscherm ademt tegenwoordig in de dagkleur (warm bordeaux) -- en
    // daarop smolten die drie samen tot een groot donker ei rond de klok. Een
    // schaduw hoort de achtergrond te verdiepen, niet te vervangen: dus de
    // halo weg, de dekking terug naar wat een echt horloge op een tafel doet.
    // Het zit op een pseudo-element (één keer berekend), niet op een filter.
    //
    // LET OP, en dit was de echte oorzaak van het ei: border-radius:50% maakt
    // hier alleen een CIRKEL zolang het vak van .rtg-ring vierkant is. Wordt
    // dat vak uitgerekt, dan wordt deze schaduw een ellips die ver boven en
    // onder de wijzerplaat uitloopt -- en de wijzerplaat verraadt dat niet,
    // want de SVG houdt zijn eigen verhouding en blijft rond. Wie de klok
    // ergens een maat geeft: houd breedte en hoogte gelijk. (Het voorbeeld hier
    // was .os-klokvak op het beginscherm van apps/app.html, met twee gelijke
    // bovengrenzen; die klok is weg -- zie WERELD.md -- maar de val niet.)
    '.rtg-ring::before{content:"";position:absolute;inset:1.5%;border-radius:50%;pointer-events:none;' +
      'box-shadow:0.18rem 0.22rem 0.7rem rgba(0,0,0,0.34), 0.7rem 0.85rem 2.2rem rgba(0,0,0,0.22);}' +

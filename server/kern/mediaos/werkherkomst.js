/* ============================================================================
   WERKHERKOMST -- van wie is dit werk? Vastgelegd waar het wordt BEWEERD.

   DE AANLEIDING. kern/connect/ wil bij de trede "gebruikt" een regel schrijven
   in het dossier van de MAKER van een stuk werk. De eerste versie liet de
   aanroeper zeggen wie dat was, en dat was een lek: iedereen kon een regel met
   bewijskracht in het dossier van een willekeurig ander zetten. De reparatie
   daar was `makerVan` -- een OPZOEKING. Dit bestand is wat er opgezocht wordt.

   WAAROM HIJ HIER WOONT EN NIET IN kern/connect/. Besluit van de eigenaar,
   15 september 2026, en de zin eronder stuurt het hele ontwerp:

     Connect mag auteurschap CONSUMEREN, niet zelf uitvinden.

   `nieuwWerk(makerKey, soort, titel)` in ./wekken.js is de plek waar vijf
   domeinen -- Klankwerk, Theater, Clips, Podium, de aanwezigheden -- zelf
   vertellen dat DEZE maker DIT heeft gemaakt. Die bewering is vertrouwd omdat
   het domein hem doet, met een echte ledensleutel, op het moment dat het werk
   er werkelijk is. Een laag erboven die dat feit opnieuw zou vaststellen, raadt
   het; een laag die het van de client aanneemt, wordt voorgelogen. Dus wordt
   het vastgelegd waar het wordt beweerd, en leest Connect het alleen.

   DE AANROEPPLEK -- eerst vastleggen, dan wekken. Dezelfde volgorde en dezelfde
   reden als bij `nieuwMoment` hiernaast: dat dit werk bestaat staat los van de
   vraag of er iemand gewekt kon worden. Een maker zonder volgers maakt evengoed
   iets, en een register dat pas na de eerste volger begint, mist precies de
   makers die deze laag het hardst nodig heeft.

   De aanroep in ./wekken.js staat in een try, en dat is geen slordigheid: een
   register dat omvalt mag een PUBLICATIE niet tegenhouden. Wat er dan niet
   gebeurt is stil, en dat is hier uitzonderlijk de goede kant op -- zonder
   herkomst ontstaat er later geen dossierregel, en geen regel is beter dan een
   geraden regel. Dat is de omgekeerde afweging van het inzagejournaal
   (MENSNETWERK.md par. 0.6a: geen aantoonbaar spoor, geen inzage), en het
   verschil zit hem in wie de schade draagt: daar verliest de betrokkene zijn
   bewijs OVER toegang, hier verliest de maker hooguit een aanspraak die hij
   nooit heeft geclaimd.

   WAT HIER STAAT EN WAT NIET. Hier staat een GEBEURTENIS: dat op dit tijdstip
   deze maker dit soort werk heeft voortgebracht, met de titel die er TOEN bij
   hoorde. Wat er NIET staat is alles wat leeft -- geen codenaam (die komt bij
   het lezen uit de gids, zodat een hernoeming overal meteen goed staat), geen
   bereik, geen stand van de bron. Wie dat toevoegt bouwt de tweede waarheid
   waar STAGE.md par. 2 voor waarschuwt.

   DE SLEUTEL IS DE LEDENSLEUTEL EN GEEN CODENAAM, en dat is met opzet andersom
   dan op elk scherm: dit register wordt GELEZEN door een laag die er een
   dossierregel mee schrijft, en een dossier hangt aan de sleutel. De codenaam
   is de weergave; de sleutel is de identiteit.

   BEGRENSD, EN HET ZEGT HET ALS HIJ BIJT. Zelfde regel als bij het
   momentregister en bij kern/connect/leerdossier.js: `MAX` is een noodrem en
   geen bewaartermijn, en wat hij wegsnijdt wordt geteld en gemeld. Verjaren en
   afgekapt worden gaan nooit op een hoop (MENSNETWERK.md par. 0.6a).
   ========================================================================== */
'use strict';

const MAX = 20000;

function maakWerkherkomst({ opslag }) {
  /* PAKKEN en PEILEN staan in ./opslag.js, de enige deur van dit domein naar
     db.data. Peilen maakt niets aan: een lezer die zijn eigen bak aanlegt, laat
     de opslag groeien door ernaar te kijken. */
  const lijst = () => opslag.werken();
  const peil = () => opslag.peilWerken();

  /* VASTLEGGEN. Alleen aan te roepen vanuit ./wekken.js, met een sleutel die
     het DOMEIN heeft aangeleverd. Geeft het vastgelegde werk terug, of null als
     er niets vast te leggen viel -- en nooit een uitzondering, want een register
     dat omvalt mag een publicatie niet tegenhouden. */
  function legWerk(makerKey, soort, titel) {
    /* EERST KEUREN, DAN DE BAK AANLEGGEN. Hier stond `lijst()` bovenaan, en die
       maakt de array aan -- dus een aanmelding zonder maker werd netjes
       geweigerd en liet toch een lege bak in db.data achter. Dezelfde faalvorm
       als de lezers die hun rij aanmaakten: de opslag groeit door aanroepen die
       niets mochten, en niets klaagt. Gevonden door test/werkherkomst.test.js 5. */
    const sleutel = String(makerKey || '');
    if (!sleutel || !String(soort || '')) return null;
    const rij = lijst();
    if (!rij) return null;
    const werk = {
      id: 'wk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      maker: sleutel,
      soort: String(soort),
      titel: titel == null ? null : String(titel).slice(0, 120),
      at: new Date().toISOString()
    };
    rij.push(werk);
    const afgekapt = opslag.begrensWerken(MAX);
    opslag.bewaar();
    return afgekapt ? Object.assign({ afgekapt }, werk) : werk;
  }

  /* OPZOEKEN -- de enige functie die kern/connect/ gebruikt, en met opzet
     read-only. Geeft `{ sleutel, onderwerp, titel }` of null.

     `onderwerp` is de SOORT en niet de titel. Een dossierregel hoort bij een
     onderwerp waar meer dan een ding onder kan vallen ("video", "muziek");
     zou de titel het onderwerp zijn, dan krijgt elke maker evenveel onderwerpen
     als werken en zegt `hoogste()` per onderwerp niets meer. */
  function makerVanWerk(werkId) {
    const id = String(werkId || '');
    if (!id) return null;
    const w = peil().find(x => x && x.id === id);
    return w ? { sleutel: w.maker, onderwerp: w.soort, titel: w.titel } : null;
  }

  /* De werken van EEN maker, nieuwste eerst. Voor de Connect-bron, en met een
     harde bovengrens: dit is een lijst van iemands eigen werk en geen zoekweg
     over makers heen. Er is met opzet geen functie die alle werken van
     IEDEREEN teruggeeft -- dat zou een publieke makerslijst zijn. */
  function werkenVan(makerKey, max) {
    const sleutel = String(makerKey || '');
    if (!sleutel) return [];
    return peil().filter(w => w && w.maker === sleutel).slice().reverse()
      .slice(0, Math.max(1, Math.min(Number(max) || 20, 100)));
  }

  return { legWerk, makerVanWerk, werkenVan, MAX };
}

module.exports = { maakWerkherkomst, MAX };

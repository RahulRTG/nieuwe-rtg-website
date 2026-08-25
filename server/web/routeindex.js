/* web, deel "routeindex": de dispatch-index van de router.
   ============================================================================
   DE LINEAIRE SCAN WAS DE STAART. De router liep bij ELK verzoek de hele
   lagenlijst af tot er iets matchte. Met 8.004 lagen op de bovenste stapel
   (7.939 daarvan een vast pad, gemeten 24 augustus 2026) is dat gemiddeld
   vierduizend keer een methodevergelijking, een padNaar() en een stringgelijkheid
   -- per verzoek, synchroon, op de enige event-loop die er is. Gemeten kostte
   dat 0,18 ms voor een route in het midden en 0,33 ms voor een route achteraan.
   Dat is geen traagheid van een route maar een vaste heffing op ALLE verkeer, en
   omdat de lus niet onderbreekt, telt hij bij de wachttijd van elk ander verzoek
   op. Precies de vorm die p99 optilt zonder dat p50 iets verraadt.

   De index draait dat om. 99,2% van de lagen is een vast pad met een vaste
   methode; die gaan in een Map op "METHODE\0pad". Alles wat NIET één vast pad
   is -- mounts, middleware, :param-routes, RegExp-paden, .all() -- blijft
   altijd kandidaat en staat in één oplopende lijst. Een verzoek voegt die twee
   samen en loopt alleen dat af: in de praktijk de ~65 algemene lagen plus de
   ene route die echt past, in plaats van vierduizend.

   DRIE DINGEN DIE HIER MIS KUNNEN GAAN, en waarom ze dat niet doen:

   1. DE VOLGORDE. Een router is volgordegevoelig: middleware op plek 600 hoort
      ná een route op plek 500 te draaien. De index bewaart daarom globale
      indexen en voegt de twee gesorteerde lijsten samen tot één oplopende --
      dezelfde volgorde als de scan, alleen zonder de gaten ertussen.

   2. EEN HERSCHREVEN URL. server/middleware/voordeur.js en routes/werving.js
      zetten req.url middenin de keten om. De oude lus las req.url elke ronde
      opnieuw en pikte dat vanzelf op. De index hoort bij één url, dus zodra
      req.url verandert wordt de lijst opnieuw gemaakt en met een binaire zoek
      teruggezet op de eerstvolgende laag ná de huidige -- niet op het begin,
      want dan zou de keten zich herhalen.

   3. DE CACHE ALS TARPIT. De samengevoegde lijst per pad wordt bewaard, maar
      ALLEEN voor paden die echt een route raken. Een scanner die duizend
      niet-bestaande adressen probeert, krijgt de algemene lijst terug en laat
      niets achter -- dezelfde redenering als waarom de meting op het patroon
      telt en niet op het pad. De cache is daarmee begrensd door de routekaart,
      en niet door het verkeer; CACHE_MAX is het vangnet daaronder. */
const CACHE_MAX = 20000;

// Twee oplopende lijsten samenvoegen tot één oplopende. Geen dubbelen mogelijk:
// een laag staat in precies één emmer, of in de algemene lijst.
function samenvoegen(a, b) {
  if (!a || !a.length) return b;
  if (!b.length) return a;
  const uit = new Array(a.length + b.length);
  let i = 0, j = 0, n = 0;
  while (i < a.length && j < b.length) uit[n++] = a[i] < b[j] ? a[i++] : b[j++];
  while (i < a.length) uit[n++] = a[i++];
  while (j < b.length) uit[n++] = b[j++];
  return uit;
}
// Eerste positie in de (oplopende) lijst met een waarde groter dan `na`.
function eersteNa(lijst, na) {
  if (na < 0) return 0;
  let lo = 0, hi = lijst.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (lijst[m] > na) hi = m; else lo = m + 1; }
  return lo;
}


/* De index hoort bij EEN lagenlijst en wordt bij het EERSTE verzoek gebouwd,
   niet bij het registreren: op dat moment staat de routekaart vast. Elke
   registratie erna gooit hem weg (dynamisch bijhangen mag, het kost dan een
   herbouw). */
function maakDispatchIndex(lagen) {
  let index = null;
  const cache = new Map();
  function weg() { index = null; cache.clear(); }

  function bouw() {
    const exact = new Map();
    const algemeen = [];
    for (let i = 0; i < lagen.length; i++) {
      const l = lagen[i];
      // Alles wat niet EEN vast pad met EEN methode is, blijft altijd kandidaat.
      if (l.mount || !l.method || l.str == null) { algemeen.push(i); continue; }
      const k = l.method + '\0' + l.str;
      const a = exact.get(k);
      if (a) a.push(i); else exact.set(k, [i]);
    }
    index = { exact, algemeen };
    return index;
  }

  /* De lagen die voor dit verzoek uberhaupt kunnen matchen, op oplopende index. */
  function kandidaten(methode, pn) {
    const ix = index || bouw();
    const ck = methode + '\0' + pn;
    const uitCache = cache.get(ck);
    if (uitCache) return uitCache;
    let lijst = ix.algemeen;
    let raak = false;
    /* padMatch() laat een vast pad ook matchen MET afsluitende slash, en de
       router laat HEAD op een GET-route vallen. Allebei zijn het dus extra
       sleutels om op te zoeken -- niet iets wat de index mag missen. */
    const paden = pn.length > 1 && pn.charCodeAt(pn.length - 1) === 47 ? [pn, pn.slice(0, -1)] : [pn];
    const methodes = methode === 'HEAD' ? ['HEAD', 'GET'] : [methode];
    for (const m of methodes) for (const p of paden) {
      const a = ix.exact.get(m + '\0' + p);
      if (a) { lijst = samenvoegen(a, lijst); raak = true; }
    }
    // Alleen paden die echt een route raken komen in de cache: zie punt 3 hierboven.
    if (raak && cache.size < CACHE_MAX) cache.set(ck, lijst);
    return lijst;
  }

  return { kandidaten, weg, eersteNa };
}

module.exports = { maakDispatchIndex, samenvoegen, eersteNa, CACHE_MAX };

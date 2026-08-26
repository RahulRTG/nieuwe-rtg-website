/* ============================================================================
   KLEEFROUTERING -- welk proces hoort bij dit lid.

   WAAROM DIT ER IS. Zodra er meer dan een serverproces verkeer aanneemt, breekt
   read-your-writes: een lid bewaart een notitie op proces A en ziet hem op
   proces B pas na de kruisprocespoll. Gemeten (zie docs/meerkernig.md): mediaan
   733 ms op SQLite, 139-141 ms op Postgres, en in beide gevallen 0 van de 10
   meteen zichtbaar. Postgres maakt het venster vijf keer kleiner maar niet nul,
   want de write-behind-cache blijft in het geheugen van het schrijvende proces.

   Er is dus maar een manier om dat gat echt te sluiten: zorgen dat hetzelfde
   lid steeds hetzelfde proces krijgt. Dan valt de vraag "ziet B wat A schreef?"
   gewoon weg, in plaats van dat we hem sneller proberen te beantwoorden.

   DRIE KEUZES DIE ERTOE DOEN

   1. DE SLEUTEL IS HET TOKEN, niet het IP-adres en niet een eigen cookie.
      Een IP-adres deelt een heel kantoor of een hele mobiele mast, en een
      cookie zou een vierde identiteitsbegrip toevoegen aan een huis dat er al
      genoeg heeft. Het token is wat het lid toch al meestuurt, precies zolang
      als zijn sessie duurt, en per apparaat verschillend -- dat is exact de
      korrel waarop read-your-writes speelt.

   2. HET TOKEN VERLAAT DEZE MODULE NOOIT. ruweSleutel() staat bewust NIET in
      de exports: naar buiten gaat alleen merkVan(), en dat is een getal. Een
      poortwachter die een tokenwaarde in handen krijgt, is een poortwachter die
      hem een keer logt. Toetsen kunnen alles wat ze moeten kunnen met dat getal
      (zelfde token -> zelfde merk, ander token -> ander merk).

   3. RENDEZVOUS-HASHING, geen modulo. Bij `merk % aantal` verhuist bijna
      IEDEREEN zodra er een server bij komt of wegvalt -- en verhuizen is precies
      het moment waarop read-your-writes alsnog breekt. Rendezvous kiest per
      sleutel de server met het hoogste gewicht; valt die weg, dan verhuizen
      alleen de leden VAN die server en blijft de rest staan waar hij stond.

   WAT DIT NIET IS. Dit is een verdeelbeslissing, geen beveiligingsbeslissing.
   De hash hoeft dus niet cryptografisch te zijn en is dat ook niet. Er wordt
   hier ook niets VERLEEND: het token gaat de hash in en er komt een servernummer
   uit, en de gekozen server draait de volledige stapel en verifieert zelf. Een
   verzonnen Bearer levert daar dus gewoon een 401 op. Daarom staat deze plek met
   die reden op de uitzonderingslijst van keuringsregel 29 (LAT.md regel 8).

   WAT HET WEL KOST, en dat hoort erbij te staan: omdat de hash openligt, kan
   iemand die onbeperkt tokens mag verzinnen ze net zo lang uitproberen tot ze
   allemaal op hetzelfde proces uitkomen, en zo zijn last op een van de drie
   concentreren. Dat maakt van een aanval geen grotere aanval -- wie zoveel
   verzoeken kan sturen, kan het trio als geheel ook belasten -- maar het laat
   hem wel KIEZEN welke server hij raakt. Wat dat zou wegnemen is een HMAC met
   een sleutel die alleen de poortwachter kent. Die staat er niet, om een reden
   die net zo goed opgeschreven moet worden: de trio-sleutel wordt bij elke start
   opnieuw getrokken, dus dan zou elke herstart van de poortwachter ELK lid laten
   verhuizen -- precies het gat dat deze module dicht moet houden. Een vaste,
   bewaarde sleutel lost dat op en is de weg vooruit zodra dit ooit meer is dan
   een theoretische keuze.
   ========================================================================== */
'use strict';

/* Zoveel tekens van het token gaan de hash in. Een token is server-uitgegeven
   en willekeurig, dus 128 tekens is ruim meer entropie dan er servers zijn;
   de kap houdt de kosten vast ook als er ooit een kop van 16 kB binnenkomt.
   De LENGTE gaat apart mee, zodat afkappen geen twee sleutels gelijkmaakt. */
const KAP = 128;

/* De eindmenger van murmur3. Nodig omdat FNV-1a zijn bits slecht spreidt in de
   hoge helft, en rendezvous juist de hoge bits vergelijkt. */
function meng(h) {
  h = (h ^ (h >>> 16)) >>> 0;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
}

/* Het zaad per serverplek. Afgeleid van de INDEX en niet van een toevalsgetal
   bij het starten: de poortwachter mag herstarten zonder dat elk lid een ander
   proces krijgt. */
const zaden = [];
function zaad(i) {
  for (let n = zaden.length; n <= i; n++) zaden[n] = meng(Math.imul(n + 1, 0x9e3779b1) >>> 0);
  return zaden[i];
}

/* Het token uit het verzoek. Twee plekken, want zo stuurt de client het:
   - Authorization: Bearer <token> voor alles wat via fetch gaat;
   - ?token=<token> voor EventSource, dat geen kop kan meesturen.
   Een token in de BODY (sommige aanroepen zetten hem er ook in) lezen we
   bewust niet: dan zou de poortwachter JSON moeten ontleden op het hete pad,
   en elke aanroeper die dat doet stuurt de kop ook mee. */
function ruweSleutel(req) {
  const kop = (req && req.headers && req.headers.authorization) || '';
  const m = /^Bearer\s+(\S+)/i.exec(kop);
  if (m) return m[1];
  const url = (req && req.url) || '';
  const vraag = url.indexOf('?');
  if (vraag < 0) return null;
  const q = /(?:[?&])token=([^&#]+)/.exec(url.slice(vraag));
  if (!q) return null;
  /* Decoderen, en niet uit netheid: base64-tokens bevatten + en /, en die komen
     in een query wel en in een kop niet ge-escaped binnen. Zonder deze regel
     krijgt hetzelfde lid een ander proces voor zijn SSE-stroom dan voor zijn
     gewone verzoeken -- precies het gat dat deze module dicht moet houden. */
  try { return decodeURIComponent(q[1]); } catch (e) { return q[1]; }
}

/* Het merk: een getal dat het lid aanduidt en het token niet prijsgeeft. */
function merkVan(req) {
  const s = ruweSleutel(req);
  if (!s) return null;
  const n = s.length;
  const eind = n > KAP ? KAP : n;
  let h = 0x811c9dc5;                                  // FNV-1a offsetbasis
  for (let i = 0; i < eind; i++) { h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; }
  return meng((h ^ n) >>> 0);
}

/* Rendezvous: van alle kandidaten wint de hoogste combinatie van merk en zaad.
   Bij gelijk gewicht wint de laagste index, zodat de uitkomst niet afhangt van
   de volgorde waarin de kandidaten binnenkomen. */
function kiesUit(merk, kandidaten) {
  if (merk == null || !kandidaten || !kandidaten.length) return -1;
  let beste = -1, besteGewicht = -1;
  for (let k = 0; k < kandidaten.length; k++) {
    const i = kandidaten[k];
    const g = meng((merk ^ zaad(i)) >>> 0);
    if (g > besteGewicht || (g === besteGewicht && (beste < 0 || i < beste))) { besteGewicht = g; beste = i; }
  }
  return beste;
}

/* De hele beslissing in een aanroep. -1 betekent "geen sleutel in dit verzoek";
   de aanroeper kiest dan zelf, en dat is goed: een inlogpoging, een plaatje en
   een statuscheck hebben geen lid om aan te kleven. */
function kleefIndex(req, kandidaten) {
  return kiesUit(merkVan(req), kandidaten);
}

module.exports = { merkVan, kiesUit, kleefIndex };

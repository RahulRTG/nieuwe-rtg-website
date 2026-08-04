/* ============================================================================
   HET ROUTEJOURNAAL -- welke endpoints zijn tijdens een testrun ECHT geraakt.

   WAAROM DIT ER IS

   De dekkingsmeting in scripts/keuring.js zoekt de naam van een route op in de
   tekst van de tests. Dat is een benadering, en hij liegt twee kanten op:

     - te laag: een test die een hulpje gebruikt (`rh('cellier')` met daarboven
       `BASE + '/api/member/rechterhand/' + pad`) roept de route wel degelijk
       aan, maar de letterlijke naam staat nergens. De hele Rechterhand-suite
       telde zo als ongetest terwijl er 300 regels test voor staan.
     - te hoog: een pad in een commentaarregel telt mee. Het cijfer is dus met
       een zoek-en-vervang op te poetsen zonder een enkele test te schrijven.

   Een cijfer dat je kunt opschrijven zonder iets te bewijzen, is geen cijfer.
   Daarom deze module: de server schrijft zelf op welk ROUTEPATROON hij heeft
   afgehandeld. Wat hier in staat is aangeroepen; wat er niet in staat is dat
   niet. Er valt niets aan te praten.

   HOE

   Opt-in via RTG_ROUTELOG=<bestandspad>. Zonder die variabele doet deze module
   niets en kost hij niets -- hij hoort in de testrun, niet in productie.

   Elk NIEUW patroon wordt meteen weggeschreven (append), niet pas bij het
   afsluiten. Dat is met opzet: de tests stoppen hun kindservers met SIGKILL, en
   een afsluit-hook draait dan niet. Zo raken we niets kwijt. Het zijn hooguit
   een paar duizend kleine appends over een hele suite, eenmaal per patroon per
   proces.

   WANNEER we noteren: op het moment dat de ROUTE MATCHT (de haak in
   web/routing.js), niet bij 'finish' van het antwoord. Dat scheelt een
   wedloop die echt bestond: fetch() geeft zijn Response zodra de KOPPEN
   binnen zijn, dus een test kan al verder zijn -- en zijn server met SIGKILL
   stoppen -- voordat de server 'finish' heeft uitgezonden. Dan was het
   patroon nooit weggeschreven en miste het journaal een route die wel
   degelijk is aangeroepen. Onder belasting werd dat venster groot genoeg om
   de toets af en toe te laten omvallen.

   Op matchmoment noteren is bovendien niet alleen stabieler maar ook JUISTER:
   de vraag is "is dit endpoint aangeraakt". Een verzoek waarvan de verbinding
   halverwege wegvalt, heeft het endpoint even goed aangeraakt.

   Meerdere serverprocessen schrijven in hetzelfde bestand. Dat mag: O_APPEND
   zet elke schrijfactie aan het eind, en de regels zijn kort. Een enkele
   verminkte regel bij extreme gelijktijdigheid zou een patroon missen -- een
   onderschatting, en dat is de goede kant om te missen.
   ========================================================================== */
'use strict';
const fs = require('fs');

const gezien = new Set();
let bestand = null;
let stuk = false;

function schrijf(regel) {
  if (stuk) return;
  try { fs.appendFileSync(bestand, regel + '\n'); }
  catch (e) { stuk = true; }   // een kapot journaal mag nooit de server raken
}

function noteer(methode, patroon) {
  if (!bestand || !patroon) return;
  const k = (methode || 'GET') + ' ' + patroon;
  if (gezien.has(k)) return;
  gezien.add(k);
  schrijf(k);
}

/* Een scherm is geen route: een pagina komt langs de statische laag en niet
   bij de routematcher, dus stond er in dit journaal nooit iets over. Daardoor
   was "deze app is af" een bewering die niemand kon natrekken -- de vraag "heeft
   een toets dit scherm ooit geopend" had geen bron. Nu wel, met dezelfde
   ontdubbeling en hetzelfde bestand. De regel krijgt SCHERM als methode zodat
   scripts/dekking.js (die op "METHODE patroon" leest) er geen endpoint in ziet. */
function noteerScherm(url, req) {
  /* De naam van de toets erachter. Die komt uit RTG_TOETS, gezet door
     test/helper.js bij het starten van deze server. Hij hoort erbij omdat
     "geopend" op zichzelf niets zegt: test/leven.e2e.js tikt ALLE schermen
     even aan, dus zonder deze naam staat de schermmeter na een veegronde op
     nul en zegt hij voorgoed "in orde". Met de naam erbij is te zien welke
     app alleen door een veegtoets is aangeraakt en door geen enkele toets die
     zijn eigen weg aflegt. */
  noteer('SCHERM', url + ' ' + (process.env.RTG_TOETS || 'onbekend') + ' ' + soortVan(req));
}

/* WAS DIT EEN BEZOEK, OF HAALDE ER IETS VOOROP?

   Een service worker haalt bij zijn install zijn hele schil op (cache.addAll).
   Dat zijn echte GET-verzoeken op echte .html-paden, en ze kwamen hier binnen
   alsof de toets die pagina's had geopend. Gemeten: een browser die eenmaal
   /apps/foundation/rust.html bezoekt levert 45 SCHERM-regels op, alle 45 op
   naam van dezelfde toets, terwijl die over 44 ervan niets beweert. Een meter
   die je met een voorophaling kunt opblazen telt niet wat hij belooft.

   De browser zegt zelf wat voor verzoek het is: een navigatie draagt
   Sec-Fetch-Mode: navigate, een fetch uit een service worker draagt cors of
   no-cors. Alleen die eerste telt hier als een bezoek, en de omkering is met
   opzet streng: niet "alles behalve een voorophaling", maar "alleen wat zegt
   dat het een navigatie is".

   Dat raakt ook de fetch() uit een toets, die in Node altijd cors meestuurt en
   dat niet laat overschrijven. Terecht: de twee die er in deze suite staan
   (test/deur.e2e.js) halen een pagina op om te zien of hij 200 geeft. Dat is
   een goede bewering over de LINK die ernaartoe wijst, maar het is niet de weg
   van die app afleggen, en precies zulke gratis punten moet deze meter niet
   uitdelen.

   Het onderscheid staat hier en niet in de twee haken, zodat er een plek is
   waar het antwoord op "was dit een bezoek" vandaan komt. */
function soortVan(req) {
  const modus = req && req.headers ? req.headers['sec-fetch-mode'] : null;
  return modus === 'navigate' ? 'navigatie' : 'nevenverzoek';
}

/* Een 4xx of 5xx telt ook mee. De vraag die dit journaal beantwoordt is "is dit
   endpoint aangeraakt", niet "ging het goed" -- een test die bewijst dat een
   vreemde er 403 krijgt, heeft dat endpoint wel degelijk beproefd. Dat gaat
   vanzelf: de auth-middleware van een route is in onze router een eigen laag
   met datzelfde pad en dezelfde methode, dus de match (en dus de notitie) is
   al gebeurd voordat hij 401 teruggeeft.

   Er is geen middleware meer. Die hing op 'finish' en moest dus wachten tot
   het antwoord de deur uit was; de haak in web/routing.js noteert op het
   moment dat de route matcht. Dat scheelt een laag op elk verzoek. */

/* Aanzetten gebeurt bij het laden, uit de omgeving. Als losse functie zodat de
   test hem kan aansturen zonder een serverproces te starten. */
function begin(pad) {
  bestand = pad ? String(pad) : null;
  gezien.clear();
  stuk = false;
  // aan de router hangen we onszelf alleen als er echt een journaal is: staat
  // het uit, dan is er geen haak en kost dit de router helemaal niets
  try { require('./web/routing').opPatroon(bestand ? noteer : null); } catch (e) { /* zonder router ook goed */ }
  try { require('./web/bestanden').opBestand(bestand ? noteerScherm : null); } catch (e) { /* zonder statische laag ook goed */ }
  try { require('./middleware/voordeur').opPagina(bestand ? noteerScherm : null); } catch (e) { /* zonder nonce-laag ook goed */ }
  return !!bestand;
}
begin(process.env.RTG_ROUTELOG);

/* Het journaal teruglezen: alle regels, ontdubbeld. Gebruikt door
   scripts/dekking.js. Een lege of ontbrekende file geeft een lege set. */
function lees(pad) {
  let tekst = '';
  try { tekst = fs.readFileSync(pad, 'utf8'); } catch (e) { return new Set(); }
  const uit = new Set();
  for (const regel of tekst.split('\n')) {
    const r = regel.trim();
    if (r && r.indexOf(' ') > 0) uit.add(r);
  }
  return uit;
}

module.exports = { noteer, noteerScherm, begin, lees, aan: () => !!bestand };

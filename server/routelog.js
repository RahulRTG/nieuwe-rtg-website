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

/* ---- WELKE TOETS RAAKTE WELKE ROUTE ----

   Een TWEEDE regelsoort naast de gewone, en met opzet niet een uitbreiding van
   de bestaande. `METHODE /pad` wordt gelezen door scripts/dekking.js, door
   kern/routedekking.js en door het routedossier in het kantoor; daar een veld
   aan toevoegen zou drie afnemers tegelijk raken voor een vraag die zij niet
   stellen. Deze regel begint daarom met TOETS en valt bij die drie vanzelf weg
   (ze lezen "METHODE patroon", en TOETS is geen methode -- net als SCHERM).

   WAAROM. De OUTPUT-as vraagt of iemand naar de INHOUD van een antwoord kijkt.
   De mutatiemotor meet dat al met de liegpoort, maar per TOETSBESTAND, en de
   matrix vraagt het per ROUTE. Die vertaling ontbrak.

   Ontdubbeld per route EN per toets: een route die zes toetsen raakt levert zes
   regels op. Het journaal groeit daardoor van ongeveer 11k naar 40k regels, en
   dat is de prijs voor een vraag die anders onbeantwoordbaar blijft. */
function noteerToets(methode, patroon) {
  if (!bestand || !patroon) return;
  noteer('TOETS', (methode || 'GET') + ' ' + patroon + ' ' +
    (process.env.RTG_TOETS || 'onbekend'));
}

/* ---- LIET DEZE ROUTE EEN SPOOR NA? ----

   De AUDIT-as vraagt of er een spoor achterblijft. Er is geen doorgang waar
   auditregels ontstaan, dus dit wordt van buiten gemeten (server/opzet/
   auditmeting.js). Zo levert de gewone suite dit bewijs gratis mee.

   `AUDIT METHODE /pad spoor|geen`, ontdubbeld op de hele regel. Een route die de
   ene keer wel en de andere keer geen spoor nalaat levert dus beide regels op,
   en dat is juist: dan hangt het ergens van af. */
function noteerAudit(methode, patroon, sporen, status) {
  if (!bestand || !patroon) return;
  /* Uitkomstklasse (2xx/4xx/5xx): zonder wist niemand of een 'geen' bij een
     weigering hoorde (92 routes 'wisselend'). Oude vorm blijft leesbaar. */
  const klasse = Number.isFinite(status)
    ? (status < 300 ? '2xx' : status >= 500 ? '5xx' : '4xx') + ' '
    : '';
  noteer('AUDIT', (methode || 'GET') + ' ' + patroon + ' ' + klasse +
    (sporen && sporen.length ? sporen.join(',') : 'geen'));
}

/* Het schermjournaal staat ernaast, in ./routelog-scherm.js -- zie de kop
   daar voor de naad. */
const noteerScherm = require('./routelog-scherm').maakScherm(
  (m, p) => noteer(m, p));

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
/* EEN AAN-WAARDE IS GEEN PAD. `RTG_ROUTELOG=1` is wat iemand typt, want bijna
   elke andere vlag hier is een boolean -- en dat gaf een bestand dat letterlijk
   `1` heet EN een .routejournaal dat bleef staan, dus dekkingsmetingen die op
   een oud journaal rekenden. De hele afweging staat in test/routelog.test.js. */
const AAN_WOORDEN = new Set(['1', 'true', 'ja', 'yes', 'on', 'aan']);
const STANDAARD = '.routejournaal';

function begin(pad) {
  if (pad && AAN_WOORDEN.has(String(pad).trim().toLowerCase())) {
    console.log('[routelog] RTG_ROUTELOG="' + pad + '" is geen pad maar "aan"; ' +
      'het journaal gaat naar ' + STANDAARD + '.');
    pad = STANDAARD;
  }
  bestand = pad ? String(pad) : null;
  gezien.clear();
  stuk = false;
  // aan de router hangen we onszelf alleen als er echt een journaal is: staat
  // het uit, dan is er geen haak en kost dit de router helemaal niets
  /* EEN haak, TWEE regels: de gewone (welke route is geraakt) en de
     toets-gekoppelde (door WIE). Beide ontdubbelen zichzelf, dus dit kost per
     nieuw paar een append en verder niets. */
  const beide = (m, p) => { noteer(m, p); noteerToets(m, p); };
  try { require('./web/routing').opPatroon(bestand ? beide : null); } catch (e) { /* zonder router ook goed */ }
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

module.exports = { noteer, noteerToets, noteerAudit, noteerScherm, begin, lees, aan: () => !!bestand };

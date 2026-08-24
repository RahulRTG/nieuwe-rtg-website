/* Opslag, deel "voorcheck": de goedkope veranderingsdetectie op GROTE collecties.

   Verandering opsporen kostte een JSON.stringify per collectie, bij ELKE save.
   Gemeten op de echte store: 164 collecties, 1,0 MB JSON, waarvan `sessions`
   alleen al 780 KB -- en 140 collecties kleiner dan 1 KB. Onder last was dat
   42% van alle CPU van de server: we serialiseerden de hele wereld om te zien
   wat er veranderd was. De Postgres-kant had hier al een voorcheck voor; de
   sqlite-kant (de standaardopslag!) niet.

   De regel: is een collectie GROOT en is het AANTAL items gelijk, dan slaan we
   de dure stringify over -- maar hooguit GROOT_MS, daarna kijken we hem toch
   volledig na. Waarom dat veilig is:

   - Toevoegen en verwijderen veranderen het aantal, dus die worden ALTIJD
     meteen gezien. Een nieuwe sessie en een uitgelogde sessie landen dus direct
     op schijf; alleen een wijziging-op-zijn-plaats (bijv. "laatst gezien") kan
     tot GROOT_MS wachten. Dat is precies het onschuldige deel.
   - Geld gaat hier nooit door: de collecties waar centen in staan worden elke
     save volledig nagekeken. Dat gaat niet alleen op een vaste namenlijst maar
     ook op de NAAM zelf (GELD_NAAM), zodat een collectie die er later bijkomt
     automatisch onder de strenge regel valt in plaats van stil mee te liften.
     De duurzaamheidstoets (test/duurzaamheid-kill.test.js) eist dat een
     bevestigde tik een SIGKILL overleeft; die garantie blijft exact zoals hij was.
   - force = true (afsluiten) kijkt alles na, zonder uitzondering.
   - Niets blijft hangen: is er iets overgeslagen, dan plant de opslag een
     naronde na het venster, ook als er geen enkel verzoek meer komt.

   In de echte store van vandaag komt precies één collectie boven de grens uit:
   `sessions` (780 KB van de 1027 KB). Daar valt de winst dus te halen, en juist
   daar is een halve seconde vertraging op "laatst gezien" niets. Gemeten op een
   gemengde last: 5,9 -> 1,2 ms per save.

   Deze module houdt alleen maten bij; hij schrijft zelf nooit. */
const GROOT_BYTES = Number(process.env.RTG_SQLITE_GROOT_BYTES || 512 * 1024);
const GROOT_MS = Number(process.env.RTG_SQLITE_GROOT_MS || 2000);
const ALTIJD_EXACT = new Set(['paySaldi', 'saldi', 'payTikken', 'muntOntvangsten', 'directBetalingen',
  'giftcards', 'orders', 'boekingen', 'posSales', 'invoices', 'facturen', 'bank', 'bankBoekingen',
  'winkelBestellingen', 'assets', 'assetTickets', 'fonds',
  /* Deze twee ontbraken, en het gat is precies de vorm waar de voorcheck blind
     voor is. Zie de uitleg bij GELD_NAAM hieronder. */
  'directOntvangsten', 'wallet']);
/* Vangnet op de naam: alles wat naar centen ruikt, wordt altijd exact nagekeken.

   Let op de valkuil van zo'n regel: hij mag niet BREDER zijn dan geld. `\bpos`
   stond hier voor de kassa (posSales), maar dat ving ook `posts` -- De Salon,
   waar geen cent in staat. Die collectie werd daardoor bij elke save volledig
   geserialiseerd, precies het werk dat de voorcheck wil vermijden. posSales
   staat gewoon op de lijst hierboven, dus de regel kan weg.

   MAAR HIJ WAS OOK TE SMAL, en dat is de gevaarlijke kant. De belofte bovenaan
   dit bestand luidt: "Geld gaat hier nooit door ... en dat gaat niet alleen op
   een vaste namenlijst maar ook op de NAAM zelf, zodat een collectie die er
   later bijkomt automatisch onder de strenge regel valt." Twee collecties met
   geld erin vielen door beide mazen:

     directOntvangsten  de payout-teller per leverancier ({ som, aantal,
                        uitbetaald }); dpOntvangsten leest daar `saldo` uit.
     wallet             per lid onder meer feestmunten MET EEN SALDO.

   En let op WAAROM juist die twee gevaarlijk zijn -- daar zit de eigenlijke
   les. De overslaan-regel kijkt naar de LENGTE van een collectie. Een nieuwe
   order verandert die lengte en wordt dus altijd opgepikt. Maar `L.som += cent`
   op een leverancier die er al in staat verandert de lengte NIET: het bedrag
   groeit, het aantal sleutels blijft gelijk, en de dure vergelijking wordt
   overgeslagen. Een wijziging-op-zijn-plaats in een grote collectie is de enige
   vorm die hier echt verloren kan gaan, en geld is nou juist wat op zijn plaats
   verandert. Een collectie waar centen in staan hoort daarom nooit op de
   lengte te worden beoordeeld -- ongeacht hoe hij heet. */
const GELD_NAAM = /sald|cent|bedrag|betaal|betaling|\bpay|munt|factu|invoice|order|boeking|bank|kas\b|gift|tegoed|uitbetaal|payout|ontvangst|grootboek|ledger|fonds|asset|winkel|abonnement|tik(ken)?$/i;
const exactNodig = k => ALTIJD_EXACT.has(k) || GELD_NAAM.test(k);

const laatsteGrootte = new Map(); // collectie -> bytes van de laatst gemeten JSON
const laatsteLengte = new Map();  // collectie -> aantal items bij die meting
const laatsteCheck = new Map();   // collectie -> wanneer we hem volledig nakeken

// "Aantal items": bij een array de lengte, bij een object het aantal sleutels.
const lengteVan = v => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : 0);

/* DE LOGBOEKEN: collecties waar een GEGROEIDE lengte normaal is.

   De regel hieronder slaat een dure collectie alleen over als het AANTAL items
   gelijk bleef. Voor gewone toestand klopt dat: een item erbij of eraf is een
   echte wijziging die je meteen wilt vastleggen. Voor een LOGBOEK is groeien
   juist de normale toestand -- er komt per verzoek een regel bij -- en dus
   greep de overslaan-regel daar nooit.

   Gemeten op 24 augustus 2026 onder last: `doorgeefjournaal` groeit naar zijn
   plafond van 20.000 regels (3,6 MB JSON), en saveSqlite kostte daardoor
   gemiddeld 32,9 ms en piekte op 101,1 ms -- synchroon, op de event-loop. Over
   een ronde van 25 seconden stond de lus 3,98 seconden stil in deze ene functie:
   16% van de wandkloktijd. De gemeten event-loop-piek van 111 ms viel er vrijwel
   samen mee.

   Waarom overslaan hier veilig is en bij gewone toestand niet: het journaal
   regelt zijn eigen duurzaamheid al. kern/doorgeefjournaal.js zegt met zoveel
   woorden "NIET bij elke regel save()" en plant zijn eigen spoeling met een rem
   van een seconde. Dat andere schrijfacties het journaal onderweg meenamen was
   toeval, geen belofte. Wat hier verandert is dus niet de garantie maar het
   meeliften: het journaal wordt nog steeds binnen zijn eigen venster geschreven,
   en planNaronde() zorgt dat een overgeslagen ronde altijd wordt ingehaald --
   ook als er daarna geen enkel verzoek meer komt.

   Wat er NIET in mag: alles waar een verloren regel geld of toegang kost. Die
   vallen sowieso al af op exactNodig() hierboven, dat vóór deze regel wordt
   gesteld -- maar de lijst blijft met opzet met de hand geschreven en kort. Een
   collectie hoort hier alleen in als haar EIGEN module haar duurzaamheid al
   regelt en dat ook opschrijft. */
const LOGBOEK = new Set(['doorgeefjournaal']);

/* Mag de dure stringify van deze collectie worden overgeslagen? */
function magOverslaan(k, waarde, force, nu) {
  if (force || exactNodig(k)) return false;
  if ((laatsteGrootte.get(k) || 0) <= GROOT_BYTES) return false;
  if (!LOGBOEK.has(k) && lengteVan(waarde) !== laatsteLengte.get(k)) return false;
  return nu - (laatsteCheck.get(k) || 0) < GROOT_MS;
}

/* Onthoud de maten van een collectie die WEL volledig is nagekeken. */
function onthoud(k, jsonBytes, waarde, nu) {
  laatsteCheck.set(k, nu || Date.now());
  laatsteGrootte.set(k, jsonBytes);
  laatsteLengte.set(k, lengteVan(waarde));
}

/* Vergeet wat we van een collectie wisten. Nodig zodra de inhoud van BUITEN
   verandert (de kruisproces-poll neemt data van een ander proces over of voegt
   samen): de eerstvolgende save moet die collectie dan weer exact nakijken in
   plaats van op verouderde maten te vertrouwen. */
function vergeet(k) { laatsteGrootte.delete(k); laatsteLengte.delete(k); laatsteCheck.delete(k); }

/* Eén naronde plannen voor wat is overgeslagen. De aanroeper geeft zijn eigen
   save-functie mee; deze module weet niet hoe er geschreven wordt. */
let naTimer = null;
function planNaronde(save) {
  if (naTimer) return;
  naTimer = setTimeout(() => { naTimer = null; try { save(); } catch (e) {} }, GROOT_MS + 50);
  if (naTimer.unref) naTimer.unref();
}

module.exports = { magOverslaan, onthoud, vergeet, planNaronde, lengteVan, exactNodig, LOGBOEK, GROOT_BYTES, GROOT_MS };

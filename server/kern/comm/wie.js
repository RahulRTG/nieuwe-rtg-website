/* =============== WIE ER AAN TAFEL ZIT: het actormodel ===============

   De kern (./index.js) kent maar een soort deelnemer: een SLEUTEL in de lijst
   `deelnemers`, en wie daar niet in staat leest niet mee. Dat model is precies
   goed en verandert hier niet. Wat hier bij komt, is dat zo'n sleutel niet
   langer per se een lid is.

   WAAROM DAT MOEST. Zolang alleen leden een sleutel hadden, kon een zaak geen
   deelnemer zijn -- en dus bleef het gastcontact met een restaurant in
   guestChats staan, de collega-DM in collegaChats en de sollicitatie in
   applyChats. Dat waren de laatste voorraden die de kern juist moest opheffen.
   Ze bleven niet staan omdat ze anders waren, maar omdat de andere kant van
   het gesprek geen naam had in dit model.

   VIER SOORTEN, EN DE VORM IS DE HELE BEVEILIGING:

       lid       user-12          de kale ledensleutel, ongewijzigd
       zaak      zaak:AB12        de zaak als geheel; het team deelt hem
       mens      mens:AB12:7      een persoon binnen die zaak, op staffId
       kantoor   kantoor          de backoffice van RTG

   Een lid houdt zijn KALE sleutel, en dat is geen slordigheid maar de reden
   dat deze verbouwing zonder migratie kon: zo staan de bestaande gesprekken,
   de leesstanden en de SSE-routering er al in. Een naamruimte voor leden
   erbij had elke bestaande rij moeten herschrijven, en een herschrijfronde
   over gebruikersdata is het duurste soort risico voor het goedkoopste soort
   netheid.

   DE PRIJS DAARVAN staat in lid(): omdat een lid geen voorvoegsel draagt, is
   "geen dubbele punt" het enige wat hem van een actor onderscheidt. Zou een
   ledensleutel ooit de vorm 'zaak:...' kunnen aannemen, dan zou ontleed() hem
   als zaak lezen en zat er iemand anders aan tafel. Vandaar dat lid() daarop
   GOOIT. Vandaag kan het niet (sleutels zijn 'user-<id>', 'guest-<hex>' of de
   pasnaam), maar "kan vandaag niet" is geen bewaking.

   EN DE REGEL DIE ALLES DRAAGT: EEN SLEUTEL WORDT AFGELEID, NOOIT AANGELEVERD.
   vanZaak() maakt hem uit de sessie die supplierAuth al heeft gecontroleerd.
   Er is met opzet geen functie die een sleutel uit een verzoek accepteert --
   dat zou betekenen dat een leverancier zelf mag opgeven wie hij is, en dan is
   de deelnemerslijst geen poort meer maar een suggestie. */
'use strict';

const RUIMTES = ['zaak', 'mens', 'kantoor'];

const codeVan = (c) => String(c || '').trim().toUpperCase();

/* Een lid draagt zijn kale sleutel. De controle hieronder is de enige plek
   waar de scheiding tussen leden en actoren wordt afgedwongen; zie de kop. */
function lid(key) {
  const s = String(key || '');
  if (s.includes(':')) {
    throw new Error('Een ledensleutel met een dubbele punt erin kan niet: die vorm is van de actoren (' + s + ').');
  }
  return s;
}
const zaak = (code) => 'zaak:' + codeVan(code);
const mens = (code, staffId) => 'mens:' + codeVan(code) + ':' + Number(staffId);
const KANTOOR = 'kantoor';

/* Terug naar de onderdelen. Een onbekende ruimte levert NULL en geen half
   ingevulde actor: alles wat hierop leunt hoort dan te weigeren en niet te
   gokken wat er bedoeld werd. */
function ontleed(sleutel) {
  const s = String(sleutel == null ? '' : sleutel);
  if (!s) return null;
  if (s === KANTOOR) return { soort: 'kantoor', sleutel: s, code: null, staffId: null };
  const i = s.indexOf(':');
  if (i < 0) return { soort: 'lid', sleutel: s, code: null, staffId: null };
  const ruimte = s.slice(0, i);
  if (!RUIMTES.includes(ruimte)) return null;
  const rest = s.slice(i + 1).split(':');
  if (ruimte === 'zaak') {
    return rest.length === 1 && rest[0] ? { soort: 'zaak', sleutel: s, code: rest[0], staffId: null } : null;
  }
  if (ruimte === 'mens') {
    const id = Number(rest[1]);
    if (rest.length !== 2 || !rest[0] || !Number.isFinite(id)) return null;
    return { soort: 'mens', sleutel: s, code: rest[0], staffId: id };
  }
  return null;
}

const isLid = (sleutel) => { const a = ontleed(sleutel); return !!a && a.soort === 'lid'; };

/* Horen twee sleutels bij dezelfde zaak? Gebruikt om te bepalen of iemand de
   naam van een medewerker mag zien (zie ./index.js, toonBericht): binnen het
   team wel, daarbuiten nooit. Twee leden horen bij GEEN zaak -- dus false, en
   niet "allebei null dus gelijk", wat de vergelijking stil zou omkeren. */
function zelfdeZaak(a, b) {
  const x = ontleed(a), y = ontleed(b);
  if (!x || !y || !x.code || !y.code) return false;
  return x.code === y.code;
}

/* ------------------------------------------------ uit de sessie, niet uit het verzoek

   Het verzoek dat supplierAuth heeft gezien: req.supplier is de zaak die bij
   de sessiecode hoort, req.actor is wie er aan het werk is. Beide zijn door de
   auth gezet en niet door de client. Deze functie kopieert dat naar de twee
   sleutels waarmee die sessie aan een gesprek mag deelnemen:

     - de zaak, altijd: een bestelling is van het bedrijf en niet van wie er
       die dag staat. Wie inlogt bij de zaak, hoort de klant te kunnen helpen.
     - de persoon, alleen bij een persoonlijke login: dat is de sleutel van de
       collega-gesprekken, en die deelt het team juist NIET.

   `alle` is de lijst waarmee een route zoekt welke van beide in een gesprek
   zit. Dat het er twee zijn en niet een, is precies het verschil tussen de
   gedeelde zaakinbox en de eigen berichten van een medewerker. */
function vanZaak(req) {
  const code = req && req.supplier ? codeVan(req.supplier.code) : '';
  if (!code) return null;
  const staffId = req.actor && req.actor.staffId != null ? Number(req.actor.staffId) : null;
  const eigen = Number.isFinite(staffId) ? mens(code, staffId) : null;
  return { code, zaak: zaak(code), mens: eigen, alle: eigen ? [zaak(code), eigen] : [zaak(code)] };
}

/* ----------------------------------------------------------- de naam

   De kern toont nooit een sleutel maar een naam, en tot nu toe was dat altijd
   een codenaam. Een zaak heeft geen codenaam: de naam van een restaurant is
   openbaar en juist wat de klant moet zien. Een medewerker heeft er ook geen,
   en die naam is wel gevoelig -- daarom komt hij hier wel uit de bron, maar
   beslist ./index.js of hij getoond wordt (alleen binnen dezelfde zaak).

   De opzoekers komen van buiten (kernlaag4), zodat dit bestand niets weet van
   db, accounts of de leverancierskast. */
function maakNaam({ codenaamVan, zaakNaam, mensNaam }) {
  return function naamVan(sleutel) {
    const a = ontleed(sleutel);
    if (!a) return null;
    if (a.soort === 'lid') return codenaamVan ? codenaamVan(a.sleutel) : null;
    if (a.soort === 'zaak') return (zaakNaam ? zaakNaam(a.code) : null) || 'Een zaak';
    if (a.soort === 'mens') return (mensNaam ? mensNaam(a.code, a.staffId) : null) || 'Een collega';
    return 'RTG';
  };
}

/* ------------------------------------------------------- het sein

   seinNaarDeRest() in de kern stuurde alles naar sseToCustomer -- de stroom
   van de ledenapp. Voor een zaak komt dat nooit aan: die luistert op
   sseToSupplier. Zonder deze wissel zou een zakelijk gesprek gewoon werken en
   alleen niet bijwerken, en dat is het soort defect dat maanden blijft staan
   omdat "even verversen" het verbergt. */
function maakSein({ sseToCustomer, sseToSupplier, sseToOffice }) {
  return function sein(sleutel, event, data) {
    const a = ontleed(sleutel);
    if (!a) return;
    if (a.soort === 'lid') return sseToCustomer && sseToCustomer(a.sleutel, event, data);
    if (a.soort === 'kantoor') return sseToOffice && sseToOffice(event, data);
    /* Zaak en mens luisteren allebei op de stroom van hun zaak; de app aan die
       kant kijkt zelf of het bericht voor het team of voor hem is. */
    return sseToSupplier && sseToSupplier(a.code, event, data);
  };
}

module.exports = { RUIMTES, KANTOOR, lid, zaak, mens, ontleed, isLid, zelfdeZaak, vanZaak, maakNaam, maakSein };

/* ============================================================================
   DE MACHTIGINGEN VAN DE APP STORE -- wat een app van derden mag VRAGEN, en
   wat hij daarmee wel en niet krijgt.

   WAAROM DIT EEN EIGEN BESTAND IS, EN WAAROM HET ZO KORT IS.

   De verleiding bij een App Store is een lange lijst rechten: agenda, contacten,
   locatie, bestanden, betalen, meldingen. Die lijst is in een middag te typen en
   in geen enkele middag waar te maken. Elk recht dat hier staat maar nergens
   wordt afgedwongen, is de duurste vorm van LAT-regel 6: elk scherm dat hem
   leest gaat zich ernaar gedragen, en de derde die hem aanvraagt denkt dat hij
   hem krijgt.

   Daarom staan er DRIE machtigingen in deze lijst, en die drie worden alle drie
   uitgevoerd in ./brug.js. Wat er niet is, staat hieronder in NIET_GEBOUWD met
   de reden -- niet als lege lijst en niet als toekomstig veld.

   DE MACHTIGING IS NIET WAT HET MANIFEST VRAAGT. Een manifest VRAAGT; een lid
   VERLEENT. Die twee zijn met opzet verschillende woorden en verschillende
   opslag: kern/appstore/index.js bewaart per lid per app wat er werkelijk is
   verleend, en ./brug.js kijkt alleen daarnaar. Een app die drie machtigingen
   vroeg en er een kreeg, werkt met een.
   ========================================================================== */
'use strict';

const M = (id, label, geeft, nooit, risico, doelen) => ({ id, label, geeft, nooit, risico, doelen: doelen || [] });

/* ----------------------------------------------------------------------------
   DE DOELEN, EN WAAROM HET EEN GESLOTEN LIJST IS.

   Een machtiging zegt WAT een app krijgt. Een doel zegt WAARVOOR. Dat tweede is
   waar een lid werkelijk op beslist: "deze app mag onthouden wat je doet" is
   geen vraag, "deze app mag onthouden waar je gebleven was" wel.

   Het is een gesloten lijst en geen vrij tekstveld, en dat is het hele punt.
   Vrije tekst levert "om u beter van dienst te zijn" op -- niet te vergelijken,
   niet te doorzoeken, niet te toetsen, en niet te diffen bij een update. Met
   een vaste lijst kan een lid twee apps naast elkaar leggen, kan het kantoor
   zoeken op wie er voor een bepaald doel leest, en kan de vergunningsdiff
   hieronder zien dat een update hetzelfde vraagt VOOR IETS ANDERS.

   Een doel erbij is een besluit, geen invulveld: het hoort hier te staan met een
   uitleg die een lid begrijpt zonder dit bestand te openen. */

/* De drie. Elk van hen heeft een uitvoering in ./brug.js; test/appstore.test.js
   zakt op een machtiging die hier staat en daar niet. */
const DOELEN = {
  'voortgang-onthouden': 'onthouden waar je gebleven was',
  'voorkeuren-onthouden': 'je instellingen in deze app onthouden',
  'werk-bewaren': 'bewaren wat je in deze app hebt gemaakt',
  'aanspreken': 'je aanspreken met de juiste naam en in de juiste taal',
  'taal-kiezen': 'de app in jouw taal tonen',
  'pas-tonen': 'tonen wat er bij jouw pas hoort',
  'herinneren': 'je herinneren aan iets wat jij zelf hebt gezet',
  'klaar-melden': 'melden dat iets waar je op wachtte klaar is',
  'meedoen-arena': 'je score bewaren en je plaats tonen in de arena van deze app'
};

const MACHTIGINGEN = [
  M('profiel.basis',
    'Wie je bent, op codenaam',
    'je codenaam, je taal en welke pas je hebt',
    'je echte naam, je e-mailadres, je telefoonnummer, je adres of je geboortedatum',
    'laag',
    ['aanspreken', 'taal-kiezen', 'pas-tonen']),
  M('opslag.eigen',
    'Onthouden wat jij in deze app doet',
    'een eigen kladblok van deze app, alleen voor jou en alleen voor deze app',
    'inzage in wat je in een andere app hebt staan, of in de rest van je RTG-gegevens',
    'laag',
    ['voortgang-onthouden', 'voorkeuren-onthouden', 'werk-bewaren']),
  /* DE VIERDE, EN DE ENIGE WAARBIJ EEN ANDER LID IETS VAN JOU ZIET. Daarom
     staat het risico op hoog en staat er in `nooit` met zoveel woorden wat er
     NIET op het bord komt. De 18+-poort erachter is dezelfde als die van de
     spellen van het huis (kern/spellen/grens.js): onder die grens speelt het
     spel gewoon door en wordt er alleen niets bewaard. */
  M('arena.meedoen',
    'Meedoen aan de ranglijst van deze app',
    'je score in de arena van DEZE app, met je codenaam ernaast',
    'een plek in de ranglijsten van RTG zelf, en niets over leden die deze app niet spelen',
    'hoog',
    ['meedoen-arena']),
  M('bericht.klaarzetten',
    'Een bericht voor je klaarzetten in de App Store',
    'hooguit een handvol berichten per dag, die je zelf ophaalt in de App Store',
    'een pushbericht, een e-mail, een sms, of iets dat je onderbreekt',
    'midden',
    ['herinneren', 'klaar-melden'])
];

const OP_ID = new Map(MACHTIGINGEN.map(m => [m.id, m]));
const machtiging = (id) => OP_ID.get(String(id == null ? '' : id)) || null;
const isMachtiging = (id) => OP_ID.has(String(id == null ? '' : id));

/* Wat een app NIET kan vragen, met de reden. Dit is geen wensenlijst en geen
   routekaart: het is het antwoord dat een uitgever krijgt wanneer hij het toch
   in zijn manifest zet, zodat hij niet hoeft te raden waarom zijn inzending
   werd afgekeurd. Een regel hier verdwijnt pas als de brug hem uitvoert. */
const NIET_GEBOUWD = {
  'betalen': 'Een app van derden kan geen betaling starten. Geld verlaat het huis nooit vanzelf (GELD.md par. 3), en er is nog geen weg waarlangs een lid een betaling van een derde bevestigt in RTG Pay.',
  'agenda': 'Er is geen leesweg naar de agenda die een codenaam niet terugvoert op een mens: een afspraaktitel bevat namen. Wel te bouwen, nog niet gebouwd.',
  'bestanden': 'De bestandenlaag kent delen per persoon en per zaak, niet per app. Een vierde deelmodel erbij zou de vraag "wie mag hierbij" op twee plekken beantwoordbaar maken (LAT-regel 4).',
  'locatie': 'De locatie van een lid is de gevoeligste waarde in dit huis. Zolang er geen intrekbare, zichtbare en tijdgebonden vorm van staat, komt er geen ruwe vorm van.',
  'contacten': 'Het adresboek van een lid is dat van andere mensen. Die hebben deze app niet geinstalleerd en niets verleend.',
  'push': 'Push onderbreekt. Een derde krijgt geen kanaal dat een telefoon laat trillen; bericht.klaarzetten legt het bericht neer en het lid haalt het op.'
};

/* De risico's in oplopende volgorde. De poort gebruikt dit om te bepalen wat
   een mens van RTG met eigen ogen moet zien; niet om iets tegen te houden. */
const RISICO = ['laag', 'midden', 'hoog'];

const doelUitleg = (d) => (Object.prototype.hasOwnProperty.call(DOELEN, String(d || '')) ? DOELEN[String(d)] : null);
const doelMag = (id, doel) => { const m = machtiging(id); return !!(m && m.doelen.includes(String(doel || ''))); };

/* Wat een lid krijgt te zien bij het installeren. Alles staat er, ook wat de
   app NIET krijgt -- een toestemmingsscherm dat alleen zegt wat er wel gebeurt,
   is een verkooppraatje. En het DOEL staat erbij, want dat is waar een lid
   werkelijk op beslist.

   `doelen` is een map van machtiging naar doel; ontbreekt hij, dan staat er
   `waarvoor: null` en niet een verzonnen reden. */
function toonbaar(ids, doelen) {
  const uit = [];
  for (const id of (Array.isArray(ids) ? ids : [])) {
    const m = machtiging(id);
    if (!m) continue;
    const d = doelen && Object.prototype.hasOwnProperty.call(doelen, id) ? doelen[id] : null;
    uit.push({ id: m.id, label: m.label, geeft: m.geeft, nooit: m.nooit, risico: m.risico,
      doel: d || null, waarvoor: doelUitleg(d) });
  }
  return uit;
}

module.exports = { MACHTIGINGEN, DOELEN, machtiging, isMachtiging, toonbaar, doelUitleg, doelMag, NIET_GEBOUWD, RISICO };

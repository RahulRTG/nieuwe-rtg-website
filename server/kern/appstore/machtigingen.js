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

const M = (id, label, geeft, nooit, risico) => ({ id, label, geeft, nooit, risico });

/* De drie. Elk van hen heeft een uitvoering in ./brug.js; test/appstore.test.js
   zakt op een machtiging die hier staat en daar niet. */
const MACHTIGINGEN = [
  M('profiel.basis',
    'Wie je bent, op codenaam',
    'je codenaam, je taal en welke pas je hebt',
    'je echte naam, je e-mailadres, je telefoonnummer, je adres of je geboortedatum',
    'laag'),
  M('opslag.eigen',
    'Onthouden wat jij in deze app doet',
    'een eigen kladblok van deze app, alleen voor jou en alleen voor deze app',
    'inzage in wat je in een andere app hebt staan, of in de rest van je RTG-gegevens',
    'laag'),
  M('bericht.klaarzetten',
    'Een bericht voor je klaarzetten in de App Store',
    'hooguit een handvol berichten per dag, die je zelf ophaalt in de App Store',
    'een pushbericht, een e-mail, een sms, of iets dat je onderbreekt',
    'midden')
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

/* Wat een lid krijgt te zien bij het installeren. Alles staat er, ook wat de
   app NIET krijgt -- een toestemmingsscherm dat alleen zegt wat er wel gebeurt,
   is een verkooppraatje. */
function toonbaar(ids) {
  const uit = [];
  for (const id of (Array.isArray(ids) ? ids : [])) {
    const m = machtiging(id);
    if (m) uit.push({ id: m.id, label: m.label, geeft: m.geeft, nooit: m.nooit, risico: m.risico });
  }
  return uit;
}

module.exports = { MACHTIGINGEN, machtiging, isMachtiging, toonbaar, NIET_GEBOUWD, RISICO };

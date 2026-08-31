/* HET REGISTER VAN HET CONSENT CENTER: welke lagen toestemming dragen, en
   waar de lijst ophoudt.

   Afgesplitst uit ./consent.js toen dat door de 10 KB van keuringsregel 13
   ging -- en de naad lag hier voor de hand, om dezelfde reden als bij
   server/bedrijf/rollen-register.js: wie een laag bijzet, wil de tabel in een
   blik zien, en in het werkende bestand zou hij de werking overwoekeren.

   HET GEVAARLIJKSTE AAN DIT SCHERM IS ONVOLLEDIGHEID. Een overzicht dat "wie
   ziet wat" heet en er drie vergeet, is erger dan geen overzicht: het geeft
   zekerheid die er niet is. Daarom staat hieronder een REGISTER van elke laag
   die toestemming draagt, met per stuk of hij hier staat. Wat niet gedekt is,
   staat er MET reden bij en gaat als zodanig naar het scherm.

   EN ER LET IETS OP. test/consent-dekking.test.js zoekt in server/kern/ naar de
   vorm van een toestemming (een rij met een `key` en een `status: 'actief'`) en
   eist dat elke module die hem heeft, hier staat of daar een reden krijgt. Een
   nieuwe laag zakt dus met naam en toenaam. Wat die scan NIET vindt is een
   andere vorm -- RTG iD gebruikt een `ingetrokken`-vlag en de paspoortlaag een
   `status: 'goedgekeurd'`; die twee staan hier omdat een mens ze erin zette.
   Het gat is kleiner, niet weg, en het scherm zegt dat.

   IDENTITEIT KOMT UIT VIER LAGEN, en dat is de reden dat hier lang maar een van
   de vier stond. RTG iD (kern/rtgid.js) deelt attributen met een dienst, de
   paspoortlaag (kern/paspoort.js) opent het identiteitsbewijs zelf, het Zegel
   (public/shared/zegelcheck.js) bewijst een feit aan de balie, en payroll
   (kern/payroll/identiteit.js) laat een werkgever opvragen wat de
   loonadministratie eist. Alleen de eerste twee zetten iets OPEN dat blijft
   staan tot iemand het sluit; die horen op dit scherm. De andere twee zijn
   eenmalig: daar valt niets in te trekken, want er staat niets open. Ze horen
   bij de andere vraag -- "wie heeft er in mijn gegevens gekeken" -- en dat is
   een journaal (server/inzagelog.js), geen toestemming. Ze staan daarom
   hieronder bij het niet-gedekte, met die reden erbij. */

'use strict';

/* Het register. Per laag: waar het over gaat, of het LEZEN of SCHRIJVEN is, en
   welke kern-functies hem lezen en stoppen. De volgorde is de volgorde op het
   scherm: het zwaarste bovenaan. */
const LAGEN = [
  { id: 'care-intake', naam: 'Medische context bij een zorgaanbieder', richting: 'ziet', gedekt: true },
  { id: 'care-vastlegging', naam: 'Zorgaanbieders die iets in uw dossier mogen vastleggen', richting: 'schrijft', gedekt: true },
  { id: 'paspoort-inzage', naam: 'Partners die uw identiteitsbewijs mogen inzien', richting: 'ziet', gedekt: true },
  { id: 'rtgid-sessie', naam: 'Diensten die met RTG iD uw gegevens ophalen', richting: 'ziet', gedekt: true },
  { id: 'rtgid-machtiging', naam: 'Mensen die namens u mogen inloggen', richting: 'doet', gedekt: true },
  /* GEVONDEN OP 31 AUGUSTUS 2026, en het was precies de fout waar de kop van dit
     bestand voor waarschuwt: een zaak die uw ECHTE NAAM mag opvragen
     (kern/metier/bewijs.js) stond hier niet, en ook niet bij het niet-gedekte.
     Hij had zijn eigen scherm binnen /api/metier/ik en bleef daardoor buiten het
     overzicht dat "wie ziet wat" heet -- terwijl het een lopende toestemming is
     met een doel en een intrekknop, dus precies de vorm die hier hoort. Hij viel
     buiten de dekkingstoets omdat zijn rij `ingetrokken: null` gebruikt in
     plaats van `status: 'actief'`. */
  { id: 'metier-naam', naam: 'Zaken die uw echte naam mogen opvragen', richting: 'ziet', gedekt: true },
  /* Commerciele post is ook een toestemming, en hij hoort hier omdat een lid
     niet hoort te moeten weten dat "wie mag mij benaderen" ergens anders woont
     dan "wie mag iets van mij zien". Hij verschilt wel van alle andere: hier
     verstuurt RTG ZELF, dus de partij is dit huis en niet een derde. */
  { id: 'commercieel', naam: 'Post van RTG waarvoor u toestemming gaf', richting: 'seint', gedekt: true },
  { id: 'locatie', naam: 'Zaken die live met u meekijken', richting: 'ziet', gedekt: true },
  { id: 'zorgprofiel', naam: 'Uw zorgprofiel dat meereist met bestellingen', richting: 'ziet', gedekt: true },
  { id: 'toestel', naam: 'Toestellen die metingen wegschrijven', richting: 'schrijft', gedekt: true },
  { id: 'wachtlijst', naam: 'Zorgaanbieders die u mogen seinen als er iets vrijkomt', richting: 'seint', gedekt: true }
];

/* Wat dit scherm NIET dekt, met reden. Deze regels gaan mee naar het scherm,
   want een lezer hoort te weten waar de lijst ophoudt. */
const NIET_GEDEKT = [
  { naam: 'Wat u in De Salon of een genootschap plaatst',
    reden: 'Dat is publiceren en geen toestemming: u haalt het weg bij de post zelf.' },
  { naam: 'Uw veiligheidskring (Thuiswacht, Codewoord, Vitaal)',
    reden: 'Die kring krijgt pas iets te zien als er een alarm afgaat; u beheert hem in de veiligheidsapps.' },
  { naam: 'Uw noodkaart',
    reden: 'Die toont u zelf op uw scherm. Er is geen route waarmee een zaak, een kantoor of een hulpverlener hem opvraagt, dus er valt ook niets in te trekken.' },
  { naam: 'Uw medicatieschema',
    reden: 'Dat is uw eigen lijst. Niemand anders kan hem opvragen of aanpassen -- ook een behandelaar niet, want die schrijft voor in zijn eigen systeem.' },
  { naam: 'Uw dagcheck-in en wat u daarbij opschreef',
    reden: 'Daar valt niets te delen: die notities verlaten uw account niet, en er is geen knop die dat wel zou doen.' },
  { naam: 'Uw gedachtenboek',
    reden: 'Daar leest niemand in mee, ook geen model: er bestaat geen route die die tekst ergens anders heen stuurt, dus er valt niets in te trekken.' },
  { naam: 'Een ID-/leeftijdscheck met het Zegel',
    reden: 'Dat toont u zelf: de zaak scant uw Zegel en leert alleen het bewezen feit (18-plus, welke pas), nooit uw naam. Er blijft niets openstaan, dus er valt ook niets in te trekken.' },
  { naam: 'Wat uw werkgever voor de loonadministratie opvraagt',
    reden: 'Dat is een wettelijke plicht en geen toestemming die u geeft. U krijgt van elke opvraging bericht, en ze staat met reden in het inzagejournaal.' },
  { naam: 'Wat een zaak van een boeking weet',
    reden: 'Dat hoort bij de boeking en verdwijnt met de boeking; het is geen losse toestemming.' }
];

module.exports = { LAGEN, NIET_GEDEKT };

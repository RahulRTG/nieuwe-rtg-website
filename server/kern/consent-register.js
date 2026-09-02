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
   scherm: het zwaarste bovenaan.

   TWEE VELDEN ZIJN ER LATER BIJ GEKOMEN, en allebei omdat het scherm er zonder
   iets zou beweren dat het niet weet (HDI.md par. 7 regel 6):

   `doel` -- WAARVOOR dit venster bestaat. Het bestond nog niet: elke rij zei wel
   WAT er wordt gedeeld ("allergenen, dieet") maar nergens waarvoor. Doelbinding
   is de kern van toestemming, en een lijst zonder doel is een inventaris. Let op
   wat dit veld NIET is: het is het doel dat de LAAG dient, niet iets wat het lid
   heeft onderhandeld. Dat staat ook zo op het scherm, want anders leest het als
   een afspraak die niemand heeft gemaakt.

   `termijn` -- hoe dit venster afloopt. Vijf van de negen lagen gaven hier `tot:
   null`, en dat betekende twee verschillende dingen die op een scherm identiek
   lezen: "loopt door tot u hem stopt" en "deze laag houdt geen einddatum bij".
   Dat is precies wat KOSTEN.md verbiedt (nooit een getal waar er geen is) en wat
   rapport.js oplost met `gemeten: false` in plaats van nette nullen. Twee
   standen dus, met een uitleg per stuk:

     venster            er staat een einddatum, en die wordt hier getoond
     zolang-het-staat   loopt door tot u hem stopt; dat is met opzet en de reden
                        staat erbij

   Er is met opzet GEEN derde stand "onbekend". Alle negen lagen zijn nagelopen
   en van alle negen is vastgesteld welke van de twee het is; een restpost zou
   binnen een jaar de plek zijn waar een nieuwe laag stil in verdwijnt. */
const LAGEN = [
  { id: 'care-intake', naam: 'Medische context bij een zorgaanbieder', richting: 'ziet', gedekt: true,
    doel: 'Zodat deze zorgaanbieder u kan behandelen zonder dat u uw verhaal opnieuw hoeft te doen.',
    termijn: 'venster' },
  { id: 'care-vastlegging', naam: 'Zorgaanbieders die iets in uw dossier mogen vastleggen', richting: 'schrijft', gedekt: true,
    doel: 'Zodat wat er bij een behandeling gebeurt in uw eigen dossier terechtkomt en niet alleen bij hen.',
    termijn: 'zolang-het-staat',
    termijnUitleg: 'Een behandelrelatie heeft geen vaste einddatum. U stopt hem zelf als u daar klaar mee bent.' },
  { id: 'paspoort-inzage', naam: 'Partners die uw identiteitsbewijs mogen inzien', richting: 'ziet', gedekt: true,
    doel: 'Zodat deze partner een keer kan vaststellen dat u bent wie u zegt.',
    termijn: 'venster' },
  { id: 'rtgid-sessie', naam: 'Diensten die met RTG iD uw gegevens ophalen', richting: 'ziet', gedekt: true,
    doel: 'Zodat u bij deze dienst kunt inloggen zonder daar een apart account te maken.',
    termijn: 'venster' },
  { id: 'rtgid-machtiging', naam: 'Mensen die namens u mogen inloggen', richting: 'doet', gedekt: true,
    doel: 'Zodat iemand die u vertrouwt iets voor u kan regelen als u dat zelf niet kunt.',
    termijn: 'venster' },
  { id: 'locatie', naam: 'Zaken die live met u meekijken', richting: 'ziet', gedekt: true,
    doel: 'Zodat een zaak weet wanneer u aankomt, of u onderweg kan vinden.',
    termijn: 'zolang-het-staat',
    termijnUitleg: 'Dit venster loopt zolang het meekijken aanstaat. Zet u het uit, dan is het meteen dicht.' },
  { id: 'zorgprofiel', naam: 'Uw zorgprofiel dat meereist met bestellingen', richting: 'ziet', gedekt: true,
    doel: 'Zodat een keuken weet waar u niet tegen kunt, zonder dat u het elke keer moet zeggen.',
    termijn: 'zolang-het-staat',
    termijnUitleg: 'Dit reist mee met elke bestelling zolang delen aanstaat. Er zit geen einddatum op; u zet het zelf uit.' },
  { id: 'toestel', naam: 'Toestellen die metingen wegschrijven', richting: 'schrijft', gedekt: true,
    doel: 'Zodat uw eigen metingen in uw dossier komen in plaats van alleen in de app van de fabrikant.',
    termijn: 'zolang-het-staat',
    termijnUitleg: 'Een toestel blijft schrijven tot u het loskoppelt. Dat is de bedoeling van een toestel.' },
  { id: 'wachtlijst', naam: 'Zorgaanbieders die u mogen seinen als er iets vrijkomt', richting: 'seint', gedekt: true,
    doel: 'Zodat u bericht krijgt als er een plek vrijkomt, zonder dat u zelf hoeft te blijven bellen.',
    termijn: 'zolang-het-staat',
    termijnUitleg: 'Een wachtlijst loopt tot u eraf gaat of tot er een plek is. Er staat geen datum op.' }
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

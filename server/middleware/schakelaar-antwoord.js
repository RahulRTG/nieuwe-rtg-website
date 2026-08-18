/* WAT EEN BELLER TE HOREN KRIJGT ALS IETS DICHT STAAT.

   Los van functieschakelaars.js, want dat zijn twee vragen: die laag beslist OF
   een verzoek erdoor mag, deze beslist WAT de beller daarover te weten komt.

   TWEE ASSEN, EN ZE ZIJN BEWUST NIET GELIJK. Dat verschil is hier onderzocht en
   het antwoord is niet wat ik verwachtte, dus het staat er met bewijs bij.

   DE BEVOEGDHEIDS-AS ZWIJGT TEGEN EEN VREEMDE. Die vertelt welk VERMOGEN RTG
   mist, met welke reden en wat er nodig is -- vergunningsgegevens, geen
   productinformatie. functieschakelaars.js had die les al opgeschreven ("MAAR
   HIJ ANTWOORDT NOOIT VOOR DE DEUR", nadat /api/bank/krediet 503 gaf aan
   iedereen, met als reden: "het vertelde aan een willekeurige beller welke
   vermogens dicht staan en waarom"). Alleen deed de code het maar half: de
   alinea belooft ook te zwijgen tegen wie "niemand is", en doelgroepVanVerzoek()
   leidt de doelgroep OOK uit het pad af -- /api/supplier, /api/staff,
   /api/office en /api/foundation leveren er een op zonder gebruiker. Een
   anonieme beller op zo'n pad kreeg dus het volledige oordeel. Dat is een
   belofte in tekst die geen belofte in code was (LAT.md regel 6), en die is
   hier een belofte in code geworden.

   DE SCHAKELAAR-AS LEGT ZICH WEL UIT, OOK ZONDER INLOG, EN DAT IS EEN BESLUIT.
   Ik heb dat eerst dichtgezet -- een anonieme POST op /api/site/domein gaf
   `functie: dom-eigendomein` met naam en reden, terwijl de buurroute met
   dezelfde auth-deur 401 gaf, en wie dat over alle paden herhaalt tekent de
   schakelkast na. Twee bestaande toetsen spraken dat tegen, met zoveel woorden:
   test/boardroom.test.js eist 503 met `functie: 'charter'` "ook zonder inlog",
   en test/techniek-functies.test.js hetzelfde voor het schoolkanaal. Charter
   heeft doelgroepen LEDEN -- precies als dom-eigendomein -- dus er is geen
   regel in de gegevens die het ene geval van het andere scheidt.

   Dat maakt het een keuze en geen bug, en die keuze is niet aan deze laag om
   stilletjes te herzien. Wat resteert staat als open punt genoteerd: een
   uitgeschakelde LEDEN-functie legt zich uit aan wie niet ingelogd is. Wie dat
   wil sluiten, sluit het bewust en past die twee toetsen aan.

   Bewaakt door test/schakelaar-zwijgt.test.js, die beide kanten vasthoudt --
   inclusief de kant die WEL vertelt, zodat een volgende reparatie niet opnieuw
   het verkeerde half dichtzet. */
'use strict';

const ZIN = {
  globaal: 'Deze functie is tijdelijk uitgeschakeld door de beheerder.',
  pas: 'Deze functie is voor jouw pas uitgeschakeld door de beheerder.',
  land: 'Deze functie is in jouw land uitgeschakeld door de beheerder.',
  plaats: 'Deze functie is in jouw woonplaats uitgeschakeld door de beheerder.',
  persoon: 'Deze functie is voor jouw account uitgeschakeld door de beheerder.',
  genre: 'Deze functie is voor dit genre zaken uitgeschakeld door RTG.',
  /* De canary is geen storing en geen straf: de functie wordt uitgerold en is
     nog niet aan iedereen toe. Dat hoort er ook zo te staan -- "uitgeschakeld
     door de beheerder" zou een supportvraag opleveren die nergens over gaat. */
  canary: 'Deze functie wordt stap voor stap uitgerold en staat nog niet voor iedereen open.'
};

/* Heeft deze beller zich bekendgemaakt? Een geldig accounttoken telt, en een
   sessie telt (een gast op de gratis app of een demo-pas is ook iemand). Een
   verzonnen of verlopen token levert geen van beide op en telt dus niet -- ging
   deze vraag over "is er een token meegestuurd", dan stond het lek met een
   willekeurige hex-string weer open. */
function bekendeBeller(gebruiker, sessieOfTier) { return !!(gebruiker || sessieOfTier); }

/* "Hiervoor is een vergunning nodig" is geen antwoord op een verkeerd token. */
function bevoegdheid(bekend, f, oordeel) {
  if (!bekend) return { error: ZIN.globaal };
  return { error: oordeel.uitleg, functie: f.id, naam: f.naam,
    reden: 'bevoegdheid', vermogen: oordeel.vermogen, bevoegdheidReden: oordeel.reden,
    nodig: oordeel.nodig || undefined };
}

/* En de schakelaar zelf. Voor een onbekende beller ook de NEUTRALE zin en niet
   die van de reden: "in jouw land uitgeschakeld" verklapt dat we iets over hem
   hebben opgezocht. */
function dicht(bekend, geblokkeerd, doelgroep) {
  return { error: ZIN[geblokkeerd.reden] || ZIN.globaal,
    functie: geblokkeerd.id, naam: geblokkeerd.naam, reden: geblokkeerd.reden,
    doelgroep: doelgroep || undefined };
}

module.exports = { ZIN, bekendeBeller, bevoegdheid, dicht };

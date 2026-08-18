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

   DE SCHAKELAAR-AS ZWIJGT NU OOK, EN DAT IS EEN BESLUIT VAN 18 AUGUSTUS 2026.

   Hij deed dat eerst niet. Een anonieme POST op /api/site/domein gaf
   `functie: dom-eigendomein` met naam en reden, terwijl de buurroute met
   dezelfde auth-deur 401 gaf -- en wie dat over alle paden herhaalt, tekent de
   schakelkast na zonder account: welke functies bestaan, hoe ze heten, welke
   uitstaan. Ik heb dat eerst dichtgezet en meteen weer teruggedraaid, want twee
   bestaande toetsen eisten het tegendeel met zoveel woorden ("ook zonder
   inlog"): test/boardroom.test.js (503 met `functie: 'charter'`) en
   test/techniek-functies.test.js (het schoolkanaal). Charter heeft doelgroepen
   LEDEN, precies als dom-eigendomein, dus geen enkele regel in de gegevens
   scheidt het ene geval van het andere. Dat maakte het een KEUZE en geen bug,
   en die is toen als open punt blijven staan (TAKEN.md 4.13).

   De keuze is nu gemaakt: de catalogus van functies is geen publieke
   informatie. Wie zich niet heeft bekendgemaakt, krijgt alleen de neutrale zin
   -- dezelfde vorm als de bevoegdheids-as hierboven. Dat de twee assen
   verschilden was zelf de helft van de verwarring.

   WAT DE KEUZE KOST, want dat hoort erbij te staan. Een anonieme beller ziet
   nog steeds een 503 en weet dus DAT er iets op dit pad uitstaat; hij weet
   alleen niet meer wat, waarom of voor wie. Dat verschil is met opzet blijven
   staan: deze laag weet niet of de route erachter een deur heeft, en een 401
   verzinnen op een werkelijk publieke route die uitstaat zou de beller een
   onwaarheid vertellen -- inloggen helpt daar niet. De naam van de functie is
   het gevoelige deel, niet het bestaan van een storing.

   DE TWEE TOETSEN ZIJN AANGEPAST EN NIET GESLOOPT. Wat zij werkelijk moesten
   bewijzen -- "uitzetten blokkeert ook echt" -- bewijzen ze nu met een INGELOGD
   lid, wat een strengere eis is dan met een vreemde: het blokkeert de mens voor
   wie de functie bedoeld was. Daar is per toets de anonieme kant bij gezet, die
   nu eist dat er niets uitlekt.

   Bewaakt door test/schakelaar-zwijgt.test.js, dat beide assen vasthoudt --
   inclusief wat een BEKENDE beller wel hoort te lezen, zodat een volgende
   reparatie niet het verkeerde half dichtzet. */
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

/* En de schakelaar zelf. Voor een onbekende beller de NEUTRALE zin en verder
   niets: geen id, geen naam, geen reden en geen doelgroep. Twee dingen tegelijk
   -- de catalogus blijft binnen ("welke functies bestaan en hoe heten ze"), en
   de reden verklapt niet dat we iets over hem hebben opgezocht ("in jouw land
   uitgeschakeld" zegt dat we zijn land kennen).

   Deze parameter stond hier al voordat hij iets deed. Het commentaar beloofde de
   neutrale zin voor een vreemde, de code gaf hem die van de reden: een belofte
   in tekst die geen belofte in code was (LAT.md regel 6), en het derde geval van
   die vorm in deze twee bestanden. */
function dicht(bekend, geblokkeerd, doelgroep) {
  if (!bekend) return { error: ZIN.globaal };
  return { error: ZIN[geblokkeerd.reden] || ZIN.globaal,
    functie: geblokkeerd.id, naam: geblokkeerd.naam, reden: geblokkeerd.reden,
    doelgroep: doelgroep || undefined };
}

module.exports = { ZIN, bekendeBeller, bevoegdheid, dicht };

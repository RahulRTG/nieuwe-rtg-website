/* Magnaat: DE PRIJSSTAND -- de drie standen, en wat elke stand werkelijk doet.

   Afgesplitst van ./sectoren.js op een naad die er inhoudelijk al lag. Die
   tabel zegt WAT een bedrijf van dit soort is (hoeveel het verkoopt, wat het
   kost om te bouwen, wie er komt); dit bestand zegt wat er verandert als je
   je anders POSITIONEERT. Dat is een ander onderwerp, en het is het onderwerp
   waar twee van de zeven ijkingen over gingen.

   DRIE GETALLENREEKSEN, EN ZE HOREN BIJ ELKAAR. Wie er een verstelt zonder naar
   de andere twee te kijken, maakt precies de fout die hier twee keer is
   gemaakt: een stand die het altijd wint.

     VRAAGFACTOR   hoeveel mensen er komen
     LATFACTOR     hoe hoog de lat voor je reputatie ligt
     KOSTENSTAND   wat het kost om die belofte waar te maken

   `test/spelmagnaat.test.js` meet het samenspel: geen stand mag structureel
   beter uitkomen, en welke stand het beste uitkomt hoort per sector te
   verschillen. */
const { SECTOREN } = require('./sectoren');

/* De prijsstanden die een speler kan kiezen. Drie en niet een schuifbalk: een
   getal invoeren nodigt uit tot micro-optimaliseren, en dat is precies het
   soort bezigheid dat een spel in een spreadsheet verandert. */
const PRIJSSTANDEN = ['laag', 'midden', 'hoog'];
const prijsVan = (sector, stand) => SECTOREN[sector].prijs[Math.max(0, PRIJSSTANDEN.indexOf(stand))];

/* Wat een prijsstand met de VRAAG doet. Goedkoper trekt meer mensen, duurder
   minder.

   DEZE TWEE GETALLEN ZIJN GEIJKT EN NIET GEKOZEN, en dat is de zesde ijking.
   Eerst stonden ze op 1,32 en 0,68, en toen was prijs GEEN KEUZE: de omzetindex
   (vraag maal prijs) liep in elke sector netjes op van 0,83 via 1,00 naar 1,20.
   Duur was dus altijd beter en goedkoop altijd slechter, ongeacht je situatie.
   Dat was in het toernooi meteen te zien -- het profiel dat op prijs en
   marketing speelde won NUL procent van zijn duels en het profiel dat knijpt op
   personeel en prijs dertien procent, terwijl de stijl die hoog prijst
   bovenaan meedeed.

   Nu ligt de omzetindex op alle drie de standen rond de 1,0. Wat overblijft is
   een ECHTE afweging, en hij gaat over capaciteit in plaats van over geld:
   goedkoop vult je zaak (goed als je te klein bouwde, slecht voor de kwaliteit
   -- zie de bezettingsdruk in ./stap.js), duur laat plekken leeg (slecht als je
   te groot bouwde) maar houdt de zaak rustig, terwijl LATFACTOR hieronder de
   lat voor je reputatie meteen hoger legt. Er is dus geen stand die het altijd
   wint; er is een stand die bij JOUW pand hoort. */
const VRAAGFACTOR = { laag: 1.68, midden: 1.0, hoog: 0.55 };
/* En met de VERWACHTING. Wie de hoofdprijs vraagt en matige kwaliteit levert,
   zakt harder in reputatie dan wie goedkoop is en matig levert. */
const LATFACTOR = { laag: 0.82, midden: 1.0, hoog: 1.22 };

/* WAT DUUR ZIJN KOST OM TE LEVEREN, en dit is de zevende ijking -- de enige die
   niet over een getal ging maar over een ONTBREKENDE post.

   Ook nadat de omzetindex op alle drie de standen rond de 1,0 lag, won `hoog`
   nog steeds elk duel, en met een factor twee. De reden bleek geen balans maar
   een gat in het model: bij een hoge prijs haal je dezelfde omzet uit een
   KLEINER pand -- 55% van de gasten tegen 1,8 keer de prijs -- en alles wat met
   de omvang meeschaalt (lonen, vaste lasten, huur) werd dus 45% goedkoper voor
   hetzelfde geld. Duur zijn was gratis.

   In het echt is het omgekeerde waar: een restaurant met witte tafellakens
   heeft MEER personeel per gast en een duurder pand per stoel dan een kantine.
   Die post ontbrak, en dit is hem. Bij `hoog` kan een medewerker minder
   eenheden aan en zijn de vaste lasten per eenheid hoger; bij `laag` andersom.

   HIJ COMPENSEERT MET OPZET NIET VOLLEDIG (ongeveer 85% van wat nodig is om
   prijs winstneutraal te maken). Volledig zou betekenen dat de prijsstand geen
   enkel verschil maakt en dan is het geen keuze maar een knop. Wat overblijft
   is een echte afweging: duur is iets winstgevender per euro, maar je zaak moet
   er wel op gebouwd zijn EN je moet de lat halen (LATFACTOR hierboven). */
const KOSTENSTAND = { laag: 0.55, midden: 1.0, hoog: 1.8 };

module.exports = { PRIJSSTANDEN, prijsVan, VRAAGFACTOR, LATFACTOR, KOSTENSTAND };

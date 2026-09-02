/* De eigenaarsregels van het RTG Controleregister: DE HDI-LAAG (2 september 2026).

   Drie routefamilies uit HDI.md par. 7 die in het stille vangnet vielen. Dat
   vangnet is met opzet rood -- onbekend werk hoort niet ongemerkt bij Onderzoek
   te belanden -- dus ze krijgen hier een expliciete regel, en elk bij de kamer
   waar zijn buren al staan.

   WAAROM EEN EIGEN BESTAND. Ze stonden onderaan ./tabel.js, en dat bestand ging
   daarmee over de 10 kB-grens van keuringsregel 13. Die grens is een dakpan:
   eroverheen betekent dat er een tweede onderwerp in zit. Dat was hier ook zo --
   deze vier regels dragen elk drie alinea's uitleg over EEN laag, terwijl de
   tabel ernaast het hele huis afloopt. Dezelfde knip als ./tabel-breed.js.

   DE VOLGORDE BLIJFT GEDRAG. Deze lijst wordt in ./tabel.js geplakt NA de
   specialistische regels en VOOR de brede domeinen. Dat is de veiligste plek:
   de patronen hier zijn smal, dus ze kunnen niets afpakken van een regel die er
   al was. Nagemeten over alle routes: precies deze families verschuiven, en
   verder niets.

   LET OP DE ANKERING. Een controlepunt voor een FUNCTIE voert geen kaal pad in
   maar een samengestelde tekst (id, naam, categorie en paden aan elkaar
   geplakt). Een patroon dat op `^` ankert, mist die punten dus stil -- wat hier
   ook gebeurde: de routes werden geraakt en de functies niet. Vandaar
   `(?:^|\s)`: begin van de tekst OF na een spatie.
   ========================================================================== */
'use strict';

module.exports = [
  /* De voordeur van de beschermzaak gaat naar dezelfde kamer als de kantoorkant
     ervan (/api/rtfos/bescherming valt onder de brede rtf-regel en komt bij
     Onderzoek uit). Twee helften van hetzelfde dossier horen niet in twee
     kamers: wie de zaak behandelt en wie de deur beheert, is hier dezelfde. */
  [/(?:^|\/)bescherming\/deur/, 'onderzoek', 'Onderzoek & data'],
  /* De ouderkant van de kinderopvang, bij zijn buurman /api/verzorging. LET OP
     het onderscheid met de regel `office/opvang` in ./tabel.js: dat is de
     ASIELketen en een heel ander domein dat toevallig hetzelfde woord draagt.
     Die regel staat eerder en houdt hem dus al; dit patroon is bovendien
     geankerd op /api/ zodat het ook zonder die volgorde niet mis kan gaan. */
  [/(?:^|\s)\/api\/opvang(?:\/|\s|$)/, 'klantenservice', 'Klantenservice'],
  /* De knelpuntmotor, bij zijn buurman /api/doelen: allebei gereedschap waarmee
     een lid naar een eigen doel kijkt. */
  [/(?:^|\s)\/api\/knelpunt(?:\/|\s|$)/, 'klantenservice', 'Klantenservice'],
  /* De bewijsmap gaat naar Juridisch, bij /apps/toestemming.html. Dat is geen
     ordening maar dezelfde vraag: daar staat wie iets van u mag ZIEN, hier wat u
     kunt AANTONEN, en de twee schermen verwijzen naar elkaar. Wie ze in twee
     kamers legt, laat twee mensen los antwoorden op een vraag over dezelfde
     gegevens. */
  [/(?:^|\s)\/apps\/bewijsmap\.html/, 'juridisch', 'Juridisch']
];

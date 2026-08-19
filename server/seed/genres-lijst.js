/* HET GENRE-REGISTER, deel data: de 73 bedrijfssoorten met hun sector, caps en
   toegangsstand. Pure data; de mechaniek (zetRegister, zetGenre, genresVan,
   genreToegang) staat in ./genres.js en de uitleg waarom dit register bestaat
   ook. Afgesplitst omdat een productbestand niet over de 12 KB hoort
   (keuringsregel), net als deel9-zaken.js en deel10-zaken.js dat doen.

   DE `status` IS DE ENIGE WAARHEID OVER WIE DIT GENRE MAG AANVRAGEN. De vijf
   standen staan met hun betekenis in ./genres.js (TOEGANG); wie er een
   toevoegt doet dat daar, want genreToegang() moet hem kennen. De vlag
   `besloten: true` op defensie en special forces is hierin opgegaan als status
   'uitnodiging'. Waarom dit veld er is -- en wat de tweede lijst kostte die het
   vervangt -- staat in CONCERN.md.

   Emoji staan als \u{...}: keuringsregel 3b verbiedt emoji-tekens in server/. */
/* DE LIJST STAAT IN TWEE HELFTEN, en dit bestand is het enige invoerpunt.

   Het geheel liep over de 10 kB van keuringsregel 13. De snede loopt langs een
   sectiegrens (bij Overheid) en niet op de byte, zodat je aan de naam van het
   deel kunt zien waar je moet zijn. Object.assign houdt de volgorde aan: eerst
   a, dan b -- dezelfde volgorde als toen het een bestand was, want er zijn
   lezers die over dit register itereren.

   Wie een genre toevoegt zet hem in de helft waar zijn sector hoort; wie een
   nieuwe SECTOR toevoegt, kiest de helft die dan nog onder de grens blijft. */
'use strict';

module.exports = Object.assign({}, require('./genres-lijst-a'), require('./genres-lijst-b'));

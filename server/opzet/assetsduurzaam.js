/* RTG SHARED ASSETS AANSLUITEN, MET DE DUURZAME BUNDEL ERBIJ.

   WAAROM DIT EEN EIGEN BESTAND IS. Dezelfde twee redenen als
   ./inzagespoor.js. Ten eerste bewaakt `npm run check` regel 47 op
   BESTANDSNAAM wie besluit dat er duurzaam wordt geschreven, en dan hoort dat
   besluit in een bestand te staan waar de reden ook op past -- kernlaag3.js
   bedraadt achttien modules en zou hier met een regel over een komen te staan.
   Ten tweede zat kernlaag3.js op EEN BYTE van de 10 KB uit keuringsregel 13:
   een bedrading erbij duwde hem eroverheen, en dan verhuist een reparatie aan
   de assets zich als een opknipbeurt van een bedradingsbestand.

   WAT HIER WORDT BESLOTEN. Dat de servicefee-ronde zijn merkteken duurzaam
   wegschrijft. De betaling was dat al (kern/pay); `feeJaar` en de poolkas niet,
   en dat is de gevaarlijke helft -- zie de kop bij assetFeesInnen() in
   ../kern/assets/kantoor.js. */
'use strict';

/* Hij krijgt de hele `hulp` en de `kern` in plaats van acht losse namen: de
   aanroepregel in kernlaag3.js zat op EEN BYTE van keuringsregel 13, en acht
   namen overtypen zou hem eroverheen duwen. Wat hij eruit haalt staat hier, op
   een plek waar het te lezen is. */
module.exports = (hulp, kern) => require('../kern/assets')({
  db: hulp.db, save: hulp.save, bijeen: hulp.bijeen, inBundel: hulp.inBundel,
  crypto: hulp.crypto, schoon: hulp.schoon, notify: hulp.notify, pay: kern.pay });

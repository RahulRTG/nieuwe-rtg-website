/* HET TWEEDE DEEL VAN HET COLLECTIEREGISTER -- bereiken en andermans gegevens.

   Afgesplitst van ./effectcollecties.js, dat over de tienduizend bytes ging. De
   snede loopt langs een echte naad: hierboven staan de effecten die aan het HUIS
   raken (geld, identiteit, rechten, koppelingen, de beveiliging zelf) en hier de
   twee die aan ANDERE MENSEN raken -- iemand bereiken, en in iemands gegevens
   schrijven. Dat is ook de volgorde waarin ze bij een incident tellen.

   De uitleg over de graden en over wat er NIET in staat, hoort bij het eerste
   deel en wordt hier niet herhaald. */
'use strict';

const PER_COLLECTIE_B = Object.freeze({
  mailQ:            ['EXTERN_BEREIKEN', 'wat hierin gaat, verlaat het huis'],
  mailIn:           ['EXTERN_BEREIKEN', 'inkomende post van buiten'],
  mailBijlagen:     ['ONVERTROUWDE_BYTES', 'bytes die niemand van ons heeft geschreven'],
  notifications:    ['EXTERN_BEREIKEN', 'een melding die op een toestel landt'],
  rtmailSchrijf:    ['EXTERN_BEREIKEN', 'een bericht aan iemand anders'],
  posts:            ['EXTERN_BEREIKEN', 'LIFE.md: publiceren bereikt een tweede persoon'],
  salon:            ['EXTERN_BEREIKEN', 'zelfde reden, in het besloten netwerk'],
  campagnes:        ['EXTERN_BEREIKEN', 'een campagne gaat naar buiten'],
  creatorOproepen:  ['EXTERN_BEREIKEN', 'een oproep aan anderen'],
  rendezvous:       ['EXTERN_BEREIKEN', 'ONTMOETEN.md: alles wat een tweede mens bereikt'],
  vonk:             ['EXTERN_BEREIKEN', 'zelfde reden'],

  /* ---- gegevens van iemand anders ---- */
  suppliers:        ['SCHRIJVEN_ANDERMANS', 'de gegevens van een leverancier'],
  supplierNotifications:['SCHRIJVEN_ANDERMANS', 'zelfde reden'],
  werkplekMensen:   ['SCHRIJVEN_ANDERMANS', 'CONCERN.md: het personeelsdossier van een ander'],
  payrollRegels:    ['SCHRIJVEN_ANDERMANS', 'wat iemand anders krijgt uitbetaald'],
  payrollComponenten:['SCHRIJVEN_ANDERMANS', 'zelfde reden'],
  payrollRegelJournaal:['SCHRIJVEN_ANDERMANS', 'zelfde reden'],
  zorgProfielen:    ['SCHRIJVEN_ANDERMANS', 'het zorgdossier van een ander mens'],
  careAanbieders:   ['SCHRIJVEN_ANDERMANS', 'de gegevens van een zorgaanbieder']
});

module.exports = { PER_COLLECTIE_B };

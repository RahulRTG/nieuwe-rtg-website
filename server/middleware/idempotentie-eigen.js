/* Routes met een rijker, domeineigen idempotentiecontract. De centrale
   antwoordkas mag hun toestand-afhankelijke herhaalantwoord niet overstemmen.
   test/idempotentie.test.js houdt beide richtingen van deze lijst tegen de
   routebron: geen zelfdoener ontbreekt en geen uitzondering is betekenisloos. */
'use strict';

const EIGEN = [
  '/api/pay/',
  '/api/bank/',
  '/api/wbw/',
  '/api/pakket/',
  '/api/gast/',
  '/api/podium/',
  '/api/ov/',
  '/api/betaal/',
  '/api/supplier/pay/',
  '/api/supplier/pos/',
  '/api/supplier/giftcard/',
  '/api/supplier/ticket/',
  '/api/supplier/staff/invite',
  '/api/supplier/vracht/',
  '/api/rtgid/annuleer',
  '/api/salon/deal/claim',
  // een reactie in De Salon draagt haar eigen sleutel (routes/member/salon.js)
  '/api/comment',
  // een snap draagt zijn eigen sleutel (kern/sociaal/snaps.js)
  '/api/member/snap/send',
  // proefrit en koop in de autoshowroom dragen hun sleutel bij de deal (kern/autoverkoop/deal.js)
  '/api/verkoop/proefrit',
  '/api/verkoop/koop',
  // een huur draagt zijn sleutel bij de boeking (routes/member/voertuigen/huur.js)
  '/api/huur/boek',
  '/api/supplier/salon/deal/redeem',
  '/api/office/bank/mislukking',
  '/api/office/bank/rekening/open',
  '/api/festival/verkoop/rond',
  // de pascode en de horecabon/polsband beslissen zelf over een herhaling (B9, B11)
  '/api/festival/pas',
  '/api/supplier/horeca/betaal',
  '/api/supplier/horeca/bon/maak',
  '/api/supplier/horeca/bon/roteer',
  '/api/supplier/horeca/club/band',
  '/api/giftcard/buy',
  '/api/giftcard/roteer',
  '/api/supplier/betaalverzoek',
  '/api/appstore/koop',
  '/api/appstore/kantoor/teruggave',
  // de horecateruggave leest haar eigen sleutel en beslist zelf over een herhaling
  '/api/supplier/horeca/teruggave',
  /* de kantooruitnodiging bindt haar sleutel aan de uitgifte (kern/kantoor/uitnodiging.js)
     en geeft bij een herhaling 409 zonder code; een bewaard antwoord zou de code heronthullen */
  '/api/office/kantoor/uitnodiging',
  /* WorkOS (19 oktober 2026): deze routes lezen hun eigen sleutel, onthouden hem
     BIJ het object (zodat hij een crash overleeft) en geven bij een ANDER
     verzoek met dezelfde sleutel 409; een bewaard eerste antwoord zou die 409
     overstemmen. RTG One en Decision Room (kern/rtgone-idem.js), een
     onderneming (kern/onderneming/levensloop.js), een document in elke drive
     (kern/office/herhaling.js), een regel op een horecarekening (een tik is een
     regel) en het formulier van een RTG-site (kern/comm/bericht.js). */
  '/api/rtgone/intentie',
  '/api/rtgone/belofte',
  '/api/rtgone/frictie',
  '/api/rtgone/overdracht',
  '/api/rtgone/goedkeuring',
  '/api/rtgone/automatisering/voorbereid',
  '/api/onderneming/nieuw',
  '/api/kantoorpakket/maak',
  '/api/office/kantoorpakket/maak',
  '/api/supplier/kantoorpakket/maak',
  '/api/rtf/kantoorpakket/maak',
  '/api/werkplek/kantoorpakket/maak',
  '/api/supplier/horeca/rekening/regel',
  '/api/browser/bericht',
  // een teamkamer: de sleutel op de kamer, de toegangscode maar een keer (kern/magnaat-trainingslobby-regie.js)
  '/api/member/magnaat/teamkamer/maak',
  // een foto in de eigen bibliotheek (kern/webmaker-fotos.js, fotoHerhaling)
  '/api/site/foto',
  // een bericht draagt zijn herhaalsleutel zelf, ook na een herstart (kern/comm/bericht.js)
  '/api/comm/stuur',
  // dezelfde kern voor een gezins-DM: de sleutel staat op het bericht (kern/sociaal/vrienden/contact.js)
  '/api/rtf/social/dm/send',
  // een signaal in Connect onthoudt zijn sleutel per tik bij de horizon (kern/connect/horizon.js)
  '/api/connect/signaal',
  '/api/rtf/connect/signaal',
  // een buurtvraag in het Living Lab draagt haar sleutel zelf (kern/livinglab/themas.js)
  '/api/lab2/bewoner/thema',
  // een buurtruilaanbod en een voorstel voor een meerjarig plan dragen hun sleutel zelf
  '/api/rtfos/ruil/plaats',
  '/api/rtfos/gift/plan/voorstel',
  // een pot onthoudt zijn reserveringssleutels en geeft 409 bij een ander bedrag (kern/geldbeleid/potten.js)
  '/api/geld/pot/reserveer',
  /* het OV-kaartje, het abonnement en de Flits-melding bewaren hun sleutel bij
     het object; dezelfde sleutel met een ander verzoek is daar een 409 */
  '/api/mob/kaart/koop',
  '/api/mob/abo/koop',
  '/api/flits/meld',
  // de stadsmelding bewaart haar sleutel op de waarneming (kern/stadsweefsel/herhaal.js)
  '/api/stad/melding',
  // de OV-lijn, het meubel en de charteraanvraag bewaren hun sleutel bij het object
  '/api/staff/ov/lijn/zet',
  '/api/residentie/meubel/zet',
  '/api/member/vluchten/charter',
  // een nieuwe pot onthoudt zijn sleutel en geeft 409 voor een andere pot (kern/geldbeleid/potten.js)
  '/api/geld/pot/zet',
  // een toezegging en een voorstel onthouden hun sleutel per lid, aan beide deuren (kern/labfonds.js)
  '/api/labfonds/doneer',
  '/api/labfonds/voorstel/maak',
  '/api/rtf/labfonds/doneer',
  '/api/rtf/labfonds/voorstel/maak',
  '/api/vonk/bericht',
  '/api/connection/vonk/text',
  '/api/theater/reactie',
  '/api/thuis/huis',
  '/api/rtf/bericht',
  '/api/groothandel/bestel',
  // een chatbericht van Vonk draagt zijn eigen sleutel (kern/connection-communication.js)
  // een chatbericht van Rendezvous draagt dezelfde sleutel (kern/connection-communication.js)
  '/api/connection/rendezvous/text',
  // "Nodig uit en start" onthoudt zijn sleutel op het potje (kern/spellen/dubbeltik.js)
  '/api/member/spel/nieuw',
  // en de gezinsingang van dezelfde knop, met dezelfde sleutel
  '/api/rtf/spel/nieuw',
  '/api/asset/koop',
  '/api/asset/aanvraag/betaal'
];

const doetHetZelf = pad => EIGEN.some(p => pad.startsWith(p));
module.exports = { EIGEN, doetHetZelf };

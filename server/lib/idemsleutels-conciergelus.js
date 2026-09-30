/* DE CONCIERGE-LUS (CONCIERGE.md, kern/bureau/lus*.js) EN DE TAFELUITZONDERING
   (kern/ervaring/tafeluitzondering.js) -- wat is hier "hetzelfde verzoek"?

   DRIE LEZEN. Het beeld van het lid, de werklijst van het kantoor en de
   opdrachten van een zaak zijn POST omdat dit huis geen GET met een sessie
   kent; herhalen hoort het antwoord van NU te geven.

   DRIE KRIJGEN GEEN DEDUPLICATIE, en om drie verschillende redenen: een tweede
   toelichting is een tweede bericht van het lid; de verrassing is een
   schakelaar (aan-uit-aan binnen het venster zou de derde opslokken, de fout
   uit ./idemsleutels-stage.js); en het lijf van beslis noemt het voorstel
   niet, dus een ja op het volgende voorstel lijkt woordelijk op een ja op het
   vorige. De twee laatste zijn zelf veilig te herhalen: de ene zet een stand,
   de andere weigert zonder open voorstel.

   DE REST IS `zelfdeVerzoek`, en de routes zijn daar ZELF ook tegen bestand:
   de handlers herkennen een herhaling (neem, weigering, aanbod, onderdeel,
   bevestig, vertraging, kapot, doorzetten) of weigeren hem op de toestand
   (kies, verstuur, het antwoord op een tegenvoorstel). Binnen
   het venster krijgt een woordelijk gelijke herhaling dus het eerste antwoord
   terug (200, `herhaald: true`); daarbuiten, of met een ander lijf, draait de
   handler en komt hij op zijn eigen herkenning of op de 409 uit. Die twee
   deuren bewaren dezelfde invariant -- de case na twee aanroepen is die na een
   -- en test/conciergelus-dubbel.test.js telt dat na, niet de statuscode. */
'use strict';
const ZELFDE = { zelfdeVerzoek: true };
const SLEUTELS = {
  'POST /api/member/bureau/lus/zaak': { leest: true },
  'POST /api/office/bureau/lus': { leest: true },
  'POST /api/supplier/concierge/opdrachten': { leest: true },
  'POST /api/member/bureau/lus/toelichting': { nietIdempotent: true,
    waarom: 'Een tweede toelichting is een tweede bericht van het lid, en de toets telt er twee. De poort zou een gelijk tweede bericht binnen het venster als herhaling opslokken.' },
  'POST /api/member/bureau/lus/intake': ZELFDE,
  'POST /api/member/bureau/lus/verrassing': { nietIdempotent: true,
    waarom: 'Een SCHAKELAAR: aan, uit en weer aan binnen vijf seconden zou de derde als herhaling van de eerste opslokken, en dan staat de verrassing uit terwijl de API aan zegt. De handler is zelf idempotent (hij zet een stand), dus de poort voegt niets toe.' },
  'POST /api/member/bureau/lus/beslis': { nietIdempotent: true,
    waarom: 'Het lijf noemt het voorstel niet ({ id, akkoord }), dus een ja op het VOLGENDE voorstel is woordelijk gelijk aan een ja op het vorige. De poort zou die tweede beslissing opslokken -- test/conciergelus.test.js vond dat. Een echte herhaling stuit in de handler op de toestand: er ligt dan geen voorstel meer (400).' },
  'POST /api/office/bureau/lus/neem': ZELFDE,
  'POST /api/office/bureau/lus/weigering': ZELFDE,
  'POST /api/office/bureau/lus/aanbod': ZELFDE,
  'POST /api/office/bureau/lus/kies': ZELFDE,
  'POST /api/office/bureau/lus/onderdeel': ZELFDE,
  'POST /api/office/bureau/lus/bevestig': ZELFDE,
  'POST /api/office/bureau/lus/vertraging': ZELFDE,
  'POST /api/office/bureau/lus/verstuur': ZELFDE,
  'POST /api/office/bureau/lus/kapot': ZELFDE,
  'POST /api/supplier/reservering/tegenvoorstel': ZELFDE,
  'POST /api/supplier/reservering/doorzetten': ZELFDE,
  'POST /api/reservering/tegenvoorstel': ZELFDE
};
module.exports = { SLEUTELS };

/* MUTATIECONTRACTEN voor de zware poort (kern/zwaarbewijs.js): de vijf loketten
   waar een passkey-ceremonie voor een zware handeling wordt gestart.

   ALLE VIJF `nietHerhaalbaar`, EN DAT IS GEEN SLORDIGHEID MAAR HET PUNT. Elke
   aanroep munt een verse WebAuthn-uitdaging en legt hem onder een nieuwe
   ceremoniesleutel weg. Een herhaling die de vorige uitdaging teruggaf, zou die
   uitdaging herbruikbaar maken -- en dan is de binding waarvoor deze routes
   bestaan precies weg. Zelfde redenering, en met opzet dezelfde woorden, als
   ./mutatiecontracten-isolatie.js bij `POST /api/techniek/isolatie/bevestig`.

   Een idem-verklaring is hier dus gevaarlijker dan geen: wie deze vijf
   `idempotent` noemt, laat een tweede aanroep een bewaard antwoord teruggeven,
   en dat bewaarde antwoord bevat een challenge die dan twee keer geldig is.
   De toetsvraag van MUTATIECONTRACT.md -- krijgt een herhaling een ander
   antwoord? -- is hier met opzet JA.

   `AUTHENTICATED` en niet `CAPABILITY_GATED`, om de reden die in
   ./mutatiecontracten-isolatie.js staat uitgeschreven: het register kent geen
   eigenaar-bevoegdheid, want `eigenaarAlleen` is een vaste rolcontrole en geen
   vermogen dat iemand kan hebben. De strengere deur staat als `deur` ernaast. */
'use strict';

const BEWIJS = { gemeten: 'niet gemeten: de uitkomst is per ontwerp verschillend', op: '2026-09-03' };
const AFGETEKEND = { door: 'Claude (Opus 5), handler per route gelezen op 3 september 2026; de idem-vraag per route apart beantwoord, niet door een mens nagelezen', op: '2026-09-03' };

const CONTRACTEN = {
  'POST /api/techniek/bevestig/opties': {
    mutatieId: 'zwaar.opties.techniek',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'techAuth + eigenaarAlleen' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'elke aanroep munt een nieuwe WebAuthn-uitdaging voor een benoemde zware handeling; ' +
      'een herhaling die de oude teruggaf zou die uitdaging herbruikbaar maken en de binding ' +
      'aan actie en sessie opheffen. De route verandert zelf niets aan het platform: hij zet ' +
      'alleen een ceremonie klaar die pas telt als de handeling zelf hem inlevert.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/office/boardroom/bevestig/opties': {
    mutatieId: 'zwaar.opties.boardroom',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'boardroomAuth' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'zelfde ceremonie als het techniek-loket, andere deur. Een verse uitdaging per aanroep ' +
      'is de reden dat een assertie niet van de ene handeling naar de andere te verplaatsen is.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  },
  'POST /api/office/bank/incasso/opties': {
    mutatieId: 'zwaar.opties.incasso',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de ceremonie voor de incassoronde, gebonden aan de grens van die ronde; zonder dit ' +
      'loket kon een medewerker met passkey de ronde niet starten. Een verse uitdaging per aanroep, ' +
      'om dezelfde reden als de andere loketten.',
    bewijs: { gemeten: 'test/kantoordeur-passkey.test.js: de hele baan met een softwarepasskey; een ' +
      'ceremonie voor een andere grens wordt geweigerd', op: '2026-09-25' },
    afgetekend: { door: 'Claude, handler en toets gelezen op 25 september 2026; niet door een mens nagelezen',
      op: '2026-09-25' }
  },
  'POST /api/office/bank/handtekening/opties': {
    mutatieId: 'zwaar.opties.handtekening',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'kluisAuth' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de ceremonie voor de TWEEDE handtekening onder een geldhandeling, gebonden aan die ene ' +
      'aanvraag (besluit eigenaar 25-09-2026). Een verse uitdaging per aanroep, om dezelfde reden als ' +
      'de andere loketten; een aanvraag die geen geld raakt krijgt geen ceremonie.',
    bewijs: { gemeten: 'test/kantoordeur-passkey.test.js: zonder ceremonie 401, de ceremonie van de ' +
      'aanvrager wordt geweigerd, die van de tweede mens verplaatst het geld', op: '2026-09-25' },
    afgetekend: { door: 'Claude, handler en toets gelezen op 25 september 2026; niet door een mens nagelezen',
      op: '2026-09-25' }
  },
  'POST /api/webauthn/bevestig/opties': {
    mutatieId: 'zwaar.opties.passkey',
    herkomst: 'mens',
    semantiek: { klasse: 'nietHerhaalbaar' },
    toegang: { klasse: 'AUTHENTICATED', deur: 'auth + eigen account' },
    stand: 'INTENTIONALLY_NON_IDEMPOTENT',
    waarom: 'de ceremonie waarmee een lid het weghalen van een eigen passkey bevestigt. Ook hier ' +
      'is een verse uitdaging per aanroep het hele mechanisme; herhaalbaar maken zou betekenen ' +
      'dat een onderschepte bevestiging een tweede sleutel kan verwijderen.',
    bewijs: BEWIJS,
    afgetekend: AFGETEKEND
  }
};

module.exports = { CONTRACTEN };

/* MUTATIECONTRACTEN voor de zware poort (kern/zwaarbewijs.js): de drie loketten
   waar een passkey-ceremonie voor een zware handeling wordt gestart.

   ALLE DRIE `nietHerhaalbaar`, EN DAT IS GEEN SLORDIGHEID MAAR HET PUNT. Elke
   aanroep munt een verse WebAuthn-uitdaging en legt hem onder een nieuwe
   ceremoniesleutel weg. Een herhaling die de vorige uitdaging teruggaf, zou die
   uitdaging herbruikbaar maken -- en dan is de binding waarvoor deze routes
   bestaan precies weg. Zelfde redenering, en met opzet dezelfde woorden, als
   ./mutatiecontracten-isolatie.js bij `POST /api/techniek/isolatie/bevestig`.

   Een idem-verklaring is hier dus gevaarlijker dan geen: wie deze drie
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
const AFGETEKEND = { door: 'RTG', op: '2026-09-03' };

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

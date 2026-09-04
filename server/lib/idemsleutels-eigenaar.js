/* IDEM-VERKLARINGEN voor de zware poort en het eigenaarsherstel (EIGENAAR.md).

   Tien routes, en negen ervan zijn `nietIdempotent`. Dat is geen luiheid maar de
   uitkomst van de toetsvraag die dit register stelt: KRIJGT EEN HERHALING EEN
   ANDER ANTWOORD? Hier is dat negen keer ja, en de reden verschilt per route.

   WAAROM EEN FOUTE VERKLARING HIER DUURDER IS DAN GEEN. `zelfdeVerzoek` laat de
   idem-poort een tweede, woordelijk gelijk verzoek beantwoorden met het BEWAARDE
   antwoord. Op deze routes zou dat betekenen:

     - een challenge die twee keer geldig is (elk `.../bevestig/opties`), en dan
       is de binding aan actie en sessie waarvoor die ceremonie bestaat precies
       weg;
     - drie herstel-delen die van een OUDER quorum zijn (`herstel/inrichten`),
       terwijl de mens denkt dat hij de geldige set voor zich heeft;
     - een mislukte quorumpoging die niet meetelt (`herstel/start`), en dan remt
       de teller van vijf pogingen niets meer.

   Alle drie zijn stil: het scherm ziet een 200 en niemand merkt dat er niets is
   gebeurd. Vandaar per route een uitgeschreven `waarom` en niet een gedeelde
   zin -- een reden die op tien plekken past, is geen reden. */
'use strict';

const SLEUTELS = {
  /* Een leesroute. Apart van "geen verklaring": dit is een besluit. */
  'POST /api/techniek/herstel/stand': { leest: true },

  /* De drie loketten die een verse WebAuthn-uitdaging munten. */
  'POST /api/techniek/bevestig/opties': { nietIdempotent: true,
    waarom: 'munt een verse uitdaging voor een benoemde zware handeling; een bewaard antwoord ' +
      'zou dezelfde challenge twee keer geldig maken en de binding opheffen' },
  'POST /api/office/boardroom/bevestig/opties': { nietIdempotent: true,
    waarom: 'zelfde ceremonie achter de boardroomdeur, en om dezelfde reden: een herhaalde ' +
      'challenge is een herbruikbare challenge' },
  'POST /api/webauthn/bevestig/opties': { nietIdempotent: true,
    waarom: 'de ceremonie waarmee een lid het weghalen van een passkey bevestigt; herhaalbaar ' +
      'maken zou een onderschepte bevestiging een tweede sleutel laten verwijderen' },

  /* Het herstelquorum. */
  'POST /api/techniek/herstel/inrichten': { nietIdempotent: true,
    waarom: 'elke aanroep munt DRIE NIEUWE delen en maakt de vorige set ongeldig; een bewaard ' +
      'antwoord toont de delen van een quorum dat niet meer bestaat' },
  'POST /api/techniek/herstel/afbreken': { zelfdeVerzoek: true },   // tweede keer: 404, niets verandert
  'POST /api/herstel/eigenaar/start': { nietIdempotent: true,
    waarom: 'een geldige herhaling verandert niets, maar een ONGELDIGE telt een poging en kan het ' +
      'slot dichtzetten -- en juist die helft moet het raden remmen' },
  'POST /api/herstel/eigenaar/voltooien': { nietIdempotent: true,
    waarom: 'de eerste geslaagde aanroep sluit het lopende herstel, opent het venster en snijdt de ' +
      'sessies door; de tweede vindt geen lopend herstel meer' },
  'POST /api/herstel/eigenaar/passkey/opties': { nietIdempotent: true,
    waarom: 'verse registratie-uitdaging binnen het herstelvenster' },
  'POST /api/herstel/eigenaar/passkey': { nietIdempotent: true,
    waarom: 'zet de passkey en SLUIT het venster; herhaalbaar maken zou van een geslaagd herstel ' +
      'een kwartier lang een open deur maken' }
};

module.exports = { SLEUTELS };

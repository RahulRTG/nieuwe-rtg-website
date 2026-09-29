/* HET IDEM-REGISTER, deel "aankomst" (NAVIGATIE.md N13) -- zelfde register,
   eigen bestand, naast ./mutatiecontracten-aankomst.js.

   Twee routes: het lid bevestigt dat het er is, en de zaak die de bestemming
   is bevestigt dat de gast er is. Beide zetten een STAND (`arrived` op de
   lopende reis) via kern.bevestigAankomst, en een tweede bevestiging zet niets
   en stuurt geen tweede bericht (`r.al`). De bescherming zit dus in de stand,
   zoals bij ./idemsleutels-reisherkomst.js, en niet in een sleutel.

   Waarom de poort er toch af blijft: het antwoord is geen bevestiging van de
   handeling maar de LEVENDE stand (het live-beeld van het lid, de gastenlijst
   van de zaak), met daarin `aankomstDoor` -- wie het eerst bevestigde. Een
   teruggespeeld antwoord zou een momentopname van seconden eerder zijn, terwijl
   positie, ETA en de lijst intussen verder liepen. */
'use strict';

const WAAROM = 'de route beschermt zichzelf op de STAND van de reis (`arrived`): een tweede ' +
  'bevestiging zet niets en meldt niets opnieuw. Het antwoord is de levende stand (live-beeld of ' +
  'gastenlijst, met `aankomstDoor`), en een teruggespeeld antwoord zou een verouderde ' +
  'momentopname zijn';

const SLEUTELS = {
  'POST /api/live/aangekomen': { nietIdempotent: true, waarom: WAAROM },
  'POST /api/supplier/guest/aangekomen': { nietIdempotent: true, waarom: WAAROM }
};

module.exports = { SLEUTELS };

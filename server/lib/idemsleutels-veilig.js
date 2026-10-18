/* HET IDEM-REGISTER, deel "veilig" -- RTG Veilig (routes/veiligheid.js).

   GEVONDEN DOOR DE TESTWERELD (18 oktober 2026). De voltooiproef van RTG Veilig
   (scripts/lib/voltooi/veilig.js) tikte twee keer tegelijk op de alarmknop, en
   de kring kreeg TWEE alarmen voor een noodgeval. Geen van deze routes had een
   verklaring.

   DE EERSTE REPARATIE WAS FOUT, en dat staat hier omdat hij zich anders
   herhaalt. `zelfdeVerzoek` op het alarm liet de idem-poort een eerder
   antwoord terugspelen -- en test/veiligheid.test.js toets 11 zakte: een
   proefalarm kort na het legen van de kring kreeg "200, verstuurd" terug,
   terwijl er niemand meer was om te waarschuwen. Een antwoord dat van de STAND
   afhangt, mag de poort niet herhalen. De ontdubbeling woont daarom in de kern
   (kern/veiligheid/alarm.js: een open, gelijk alarm van een paar tellen oud is
   dezelfde handeling), NA de controle op een lege kring.

   Elke regel is op de handler nagelezen (kern/veiligheid/kring.js, alarm.js,
   plek.js). De wacht, het codewoord, de rust en de Live Circle staan er niet:
   die zijn niet gelezen, en het codewoord (dat STIL alarm slaat) verdient een
   eigen besluit.

     leest           het beeld en de kring;
     nietIdempotent  elke route hieronder, met de reden: de kern beantwoordt een
                     herhaling zelf uit de stand, en een teruggespeeld antwoord
                     zou een stand melden die er niet meer is. */
'use strict';

const STAND = 'de kern beantwoordt een herhaling zelf uit de actuele stand; een teruggespeeld antwoord van de idem-poort zou een kring of alarm melden die intussen veranderd kan zijn';

const SLEUTELS = {
  'POST /api/veiligheid': { leest: true },
  'POST /api/veiligheid/kring': { leest: true },
  'POST /api/veiligheid/alarm': { nietIdempotent: true,
    waarom: 'kern/veiligheid/alarm.js ontdubbelt zelf op een open, gelijk alarm van een paar tellen oud, en pas NA de controle op een lege kring; de poort zou "verstuurd" terugspelen voor een kring die intussen leeg is' },
  'POST /api/veiligheid/alarm/afsluiten': { nietIdempotent: true,
    waarom: 'een al afgesloten alarm geeft de kern zelf ok terug zonder de kring opnieuw te melden; ' + STAND },
  'POST /api/veiligheid/kring/toevoegen': { nietIdempotent: true,
    waarom: 'een tweede keer dezelfde codenaam is een 409 van de kern ("staat al in je kring"); ' + STAND },
  'POST /api/veiligheid/kring/aanpassen': { nietIdempotent: true,
    waarom: 'zet de plek-keuze uit de body; herhalen zet dezelfde stand, en ' + STAND },
  'POST /api/veiligheid/kring/verwijderen': { nietIdempotent: true,
    waarom: 'weghalen wat er niet staat is voor de kern een lege handeling; ' + STAND },
  'POST /api/veiligheid/kring/mail': { nietIdempotent: true,
    waarom: 'een adres dat er al staat is een 409 van de kern; ' + STAND },
  'POST /api/veiligheid/plek': { nietIdempotent: true,
    waarom: 'elke plekmelding is een nieuwe meting; of hij bewaard wordt hangt af van een wacht of alarm dat intussen kan zijn begonnen (test/kringronde.test.js toets 6)' }
};

module.exports = { SLEUTELS };

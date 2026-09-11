/* DE CARRIERELAAG bij ./idemsleutels-nooit-routes.js -- elf routes die het ZELF
   al weten, en dat is precies de grond uit de kop van ./idemsleutels-nooit.js:
   deze laag is er voor routes die NIET weten dat ze het al gedaan hebben.

   Ze staan apart omdat de hoofdlijst anders over de 10 kB gaat (keuringsregel
   13), en de naad is hier geen byte maar een onderwerp: dit zijn de elf
   schrijfwegen van RTG Vertegenwoordiging, het jeugdbestuur en RTG Rugdekking.

   ZE STONDEN EERST MET `zelfdeVerzoek: true` IN ./idemsleutels-carriere.js, en
   dat was fout op twee manieren tegelijk. Het INSTALLEERDE een duplicaatlaag op
   routes die er geen nodig hadden -- een tweede identiek verzoek kreeg het
   AFGESPEELDE antwoord van de eerste, dus de eigen dubbelklikcontrole van
   `rugdekking/stel` vuurde nooit meer -- en het sprak de mutatiecontracten
   tegen, die bij elk van deze routes zeggen: een TOESTANDSCONTROLE en geen
   duplicaatlaag (MUTATIECONTRACT.md par. 5o). De stand PROTECTED staat dit
   uitdrukkelijk toe: "een duplicaatregel in lib/idemsleutels.js OF een eigen
   afhandeling in de route".

   De redenen hieronder zijn met opzet niet gelijk: bij `stel` verbergt een
   afgespeeld succes de dubbelklikmelding, bij `beurs` bevriest het `standDoor`
   op de eerste bevestiger, en bij `voogdij/besluit` maakt het van twee
   standafhankelijke redenen een. */
'use strict';

module.exports = Object.freeze({
  'POST /api/vertegenwoordiging/voorstel':
    'weigert een tweede voorstel van dezelfde vertegenwoordiger met 409 en de reden; een afgespeeld ' +
    'succes zou de client laten denken dat er een tweede machtiging klaarstaat',
  'POST /api/vertegenwoordiging/aanvaard':
    'weigert met 409 zodra de machtiging actief is; aanvaarden is de handeling van de client zelf en ' +
    'een afgespeeld antwoord verbergt dat hij al getekend had',
  'POST /api/vertegenwoordiging/intrek':
    'weigert met 409 als hij al is ingetrokken; wie intrekt hoort te weten of hij de eerste was',
  'POST /api/vertegenwoordiging/grens':
    'ZET de eigen grens van het lid (een toewijzing) en antwoordt altijd met de grens die er nu staat; ' +
    'een afgespeeld antwoord zou een oudere grens tonen dan wat er werkelijk geldt',
  'POST /api/vertegenwoordiging/voogd/vraag':
    'keert bij dezelfde voogd vroeg terug zonder te schrijven; iemand ANDERS aanwijzen is wel een tweede ' +
    'handeling, en die mag een duplicaatlaag niet opslikken',
  'POST /api/vertegenwoordiging/voogd/rol':
    'weigert met 409 als het verzoek al is aanvaard',
  'POST /api/vertegenwoordiging/voogd/tekent':
    'weigert met 409 als de voogd al heeft getekend, en kent standafhankelijke redenen (de jongere moet ' +
    'eerst); een afgespeeld antwoord maakt van die twee gevallen een',
  'POST /api/office/voogdij/besluit':
    'weigert met 409 en zegt per stand WAAROM -- "al besloten" en "de volwassene moet nog aanvaarden" ' +
    'vragen van een medewerker iets heel anders, en een afgespeeld succes zegt geen van beide',

  'POST /api/office/rugdekking/stel':
    'heeft een EIGEN dubbelklikcontrole die moet vuren: een tweede identiek programma verdubbelt stil wat ' +
    'RTG een mens heeft beloofd, en de route zegt dat met zoveel woorden. Een afgespeeld succes van de ' +
    'eerste oproep verbergt precies de melding waarvoor die controle bestaat',
  'POST /api/office/rugdekking/stop':
    'weigert met 409 als het programma al gestopt is; een afgespeeld succes laat een medewerker denken ' +
    'dat HIJ het heeft gestopt',
  'POST /api/office/rugdekking/beurs':
    'ZET de stand, en `standDoor` en `standAt` horen bij elke bevestiging mee te bewegen: wie de ' +
    'juridische positie van dit huis als laatste heeft bevestigd, is precies wat je bij een geschil wilt ' +
    'weten. Een afgespeeld antwoord bevriest die naam op de eerste'
});

/* De levenspas op het ledenscherm (LEVEN.md par. 2.8): de LEDENKANT van een
   component die twee werelden bedient.

   Het scherm zelf staat in /shared/levenspas.js, want aan de andere kant van
   elke band staat een gezinsprofiel dat exact hetzelfde moet zien -- twee
   schermen die dezelfde afspraak anders tonen, zijn twee afspraken geworden.
   Dit bestand levert alleen wat per wereld verschilt: HOE er gevraagd wordt,
   en de aanspreekvorm.

   ELK PAD STAAT HIER VOLUIT. Dat is dezelfde afspraak als aan de serverkant
   (scripts/check.js regel 45): een pad dat in elkaar geplakt wordt, is een pad
   dat niemand meer kan terugvinden -- ook niet wie over een jaar zoekt waar
   /api/leven/deel/zet nu eigenlijk vandaan wordt aangeroepen. */
(function (w, d) {
  'use strict';

  var PADEN = {
    kring: '/api/leven/kring',
    vraag: '/api/leven/band/vraag',
    bevestig: '/api/leven/band/bevestig',
    verbreek: '/api/leven/band/verbreek',
    deel: '/api/leven/deel/zet',
    in: '/api/leven/deel/in'
  };

  /* De ledenkant reist op het Bearer-token uit leven.js (LV.api), dat het
     token in de KOP zet en nooit in de url. */
  function post(naam, body) {
    return w.LV.api(PADEN[naam], body).catch(function (e) {
      if (e.status === 401) e.message = e.message + ' Log eerst in via de leden-app.';
      throw e;
    });
  }

  d.addEventListener('DOMContentLoaded', function () {
    w.Levenspas.start({
      post: post,
      vak: d.getElementById('krVak'),
      fout: d.getElementById('krFout'),
      vorm: d.getElementById('krVorm'),
      naamIn: d.getElementById('krNaam'),
      soortIn: d.getElementById('krSoort'),
      totIn: d.getElementById('krTot'),
      /* De u-vorm: dit scherm hangt onder Mijn leven, en dat spreekt het lid
         aan zoals de Lifestyle- en Business-toon dat doen (CLAUDE.md). Aan de
         gezinskant staat hetzelfde in de je-vorm, want daar kan een kind zitten. */
      tekst: {
        intrekken: 'Intrekken', bevestig: 'Bevestigen', weiger: 'Weigeren',
        trekVerzoekIn: 'Verzoek intrekken', verbreek: 'Band verbreken',
        geven: 'Geven', ikGeef: 'U geeft', ikZie: 'U ziet',
        watGeef: 'Wat geeft u vrij', totWanneer: 'Tot wanneer',
        wacht: 'de ander is aan zet', aanZet: 'wacht op u',
        zelfGevraagd: 'U heeft dit verzoek gestuurd. Een band ontstaat pas als de ander hem bevestigt.',
        vraagtBand: 'Deze mens vraagt een band met u.',
        geeftNiets: 'Nog niets. Zolang hier niets staat, ziet deze mens niets van u.',
        zietNiets: 'Niets. Wat u ziet, geeft de ander zelf -- er is geen pakket dat bij een band hoort.',
        eenWacht: '1 mens wacht op uw antwoord.',
        velenWachten: '{n} mensen wachten op uw antwoord.',
        geenBanden: 'U heeft nog geen banden. Een band ontstaat pas als u er een vraagt en de ander hem bevestigt -- van beide kanten dus.',
        nooit: 'Wat nooit gedeeld wordt, ook niet als u het zou willen:'
      }
    });
  });
})(window, document);

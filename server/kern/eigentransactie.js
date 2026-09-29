/* EEN KLEINE SCHRIJVER DIE BIJ ELK VERZOEK KAN AFGAAN, zonder dat twee
   verzoeken over elkaar vallen.

   Waarom dit bestaat: de pasgeschiedenis (bij elke registratie) en de
   aanwezigheid (bij het eerste bezoek van de dag) schrijven in een GEDEELDE
   collectie vanuit gewone verzoeken. In de PostgreSQL-stand met meer instanties
   commit een verzoek zijn gewijzigde collecties optimistisch tegen de stand
   waarmee het begon; twee verzoeken die dezelfde collectie tegelijk aanvullen,
   botsen dan -- en de verliezer krijgt 409 op zijn REGISTRATIE, terwijl de botsing
   over een bijzaak ging. Gezien in pgtoetsen (grand-integratie en sloophamer).

   De weg eromheen is die van de kostenmeter (kern/kosten/meter.js): de wijziging
   gaat door bewerkCollectie, een eigen transactie met een rijslot, en valt
   daardoor buiten de requestcommit. Binnen een verzoek hangt hij als haak VOOR
   die commit (dus vóór het antwoord, net als het auditspoor); buiten een verzoek
   loopt hij meteen.

   Wat hij NIET doet: het verzoek laten vallen als deze bijzaak faalt. Een
   registratie mag niet mislukken omdat een meetbron niet kon schrijven. Hij
   slikt de fout ook niet stil: elke mislukte schrijfactie telt (`stand()`), en
   de meting die erop leunt kan zeggen dat zij iets mist.

   De collectie is een KAART: bewerkCollectie begint een verse collectie als
   kaart, en een lijst kan daar niet van maken. */
'use strict';

const verzoekcontext = require('../db/verzoekcontext');

module.exports = ({ naam, eigen, save, bewerkCollectie }) => {
  let fouten = 0, laatsteFout = null;
  function mis(e) {
    fouten += 1; laatsteFout = String((e && e.message) || e).slice(0, 200);
    console.error('[' + naam + '] schrijven mislukt:', laatsteFout);
  }
  const alsKaart = (w) => {
    if (!w || typeof w !== 'object' || Array.isArray(w)) throw new Error(naam + ' hoort een kaart te zijn');
    return w;
  };

  function schrijf(werk) {
    if (typeof bewerkCollectie !== 'function') {
      werk(alsKaart(eigen.bak(naam))); save();
      return;
    }
    const doe = () => {
      try {
        const uit = bewerkCollectie(naam, w => { werk(alsKaart(w)); });
        if (uit && typeof uit.then === 'function') return Promise.resolve(uit).catch(mis);
      } catch (e) { mis(e); }
      return undefined;
    };
    if (!verzoekcontext.haakVoorCommit(doe)) doe();
  }

  schrijf.stand = () => ({ fouten, laatsteFout });
  return schrijf;
};

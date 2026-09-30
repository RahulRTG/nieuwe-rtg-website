/* DE KANTOORLAAG MET DE BELEIDSMOTOR ERNAAST (AUTHORITY.md fase 1).

   Hier en niet in server.js: dat bestand staat al over de 10 kB-grens en mag
   alleen krimpen. De kantoorlaag (kern/kantoor) levert de vier poorten; de
   beleidsmotor (kern/beleidsmotor) wikkelt ze, velt ernaast een eigen besluit en
   telt eens/oneens (A1), en zijn meelezer hangt VOOR de kantoorroutes om te
   tellen wat zonder bekende poort afloopt (A3). Hij houdt niets tegen.

   `kern` komt als functie binnen, want de kern bestaat nog niet op het moment
   dat dit draait; de baliezetels worden pas bij een verzoek gelezen. */
'use strict';

const { maakKantoor } = require('../kern/kantoor');

module.exports = function kantoordeur(app, kern, deps) {
  const rauw = maakKantoor(deps);
  const beleidsmotor = require('../kern/beleidsmotor').maakBeleidsmotor({
    db: deps.db, save: deps.save, bewerkCollectie: deps.bewerkCollectie, sessionFor: deps.sessionFor,
    accounts: deps.accounts, eigenaar: deps.eigenaar, boardroomWie: rauw.boardroomWie,
    magBoardroom: rauw.magBoardroom, boardroomBaas: rauw.boardroomBaas, balieBron: () => kern().magBalie,
    kamersVan: (key) => kern().vrijheid.rtgZetel.kamersVan(key) });
  app.use('/api/office', beleidsmotor.meelezer);
  /* Besluit B1 van het leerhuis (ACADEMY.md par. 5): een echte handeling leest
     de geschiktheid mee, in de schaduw en zonder iemand tegen te houden. Zie de
     kop van kern/leerhuis/schaduw.js voor waarom dit (nog) naast de motor staat. */
  app.use('/api/office/pay/factuurcorrectie', require('../kern/leerhuis/schaduw')
    .maakLeerhuisSchaduw({ db: deps.db, save: deps.save, sessionFor: deps.sessionFor }).meelezer);
  /* Fase 8: de toegangsreview leest de drie zetelbronnen. De balie en de
     codenamen bestaan pas bij een verzoek, vandaar de functies. */
  /* B1 (PERSONEEL.md): welke entiteit is RTG, en werkt deze houder daar? */
  const huis = require('../kern/kantoor/huis').maakHuis({ db: deps.db, save: deps.save });
  beleidsmotor.huis = huis;
  /* Aanwijzen doet alleen de eigenaar zelf, en de sleutel komt uit de sessie. */
  beleidsmotor.huisZet = (req, entiteitId) => {
    const wie = rauw.boardroomWie(req);
    if (!wie || !rauw.boardroomBaas(wie)) return { status: 403, error: 'Alleen de eigenaar wijst aan welke entiteit RTG is.' };
    return huis.wijsAan(entiteitId, wie, (id) => !!(kern().entiteitVind && kern().entiteitVind(id)));
  };
  beleidsmotor.review = require('../kern/beleidsmotor/review').maakReview({ kantoorHouders: () => kern().kantoorHouders(),
    werkverband: (k) => huis.werkverband(k, { codenaamVan: (x) => kern().codenaamVan(x),
      employmentVanPersoon: (p, oud) => kern().employmentVanPersoon(p, oud) }),
    huis: () => huis.aanwijzing(),
    boardroomLijst: rauw.boardroomLijst, magBoardroom: rauw.magBoardroom, boardroomBaas: rauw.boardroomBaas,
    magBalie: (k) => kern().magBalie(k), balieZetels: () => kern().balieZetels(),
    codenaamVan: (k) => kern().codenaamVan(k), laatstGebruikt: beleidsmotor.laatstGebruikt });
  beleidsmotor.simuleer = beleidsmotor.review.simuleer;
  beleidsmotor.review = beleidsmotor.review.review;
  return Object.assign({}, rauw, {
    beleidsmotor,
    officeAuth: beleidsmotor.bewaak('kantoor', rauw.officeAuth),
    kluisAuth: beleidsmotor.bewaak('op-naam', rauw.kluisAuth),
    naamAuth: beleidsmotor.bewaak('op-naam', rauw.naamAuth),
    boardroomAuth: beleidsmotor.bewaak('boardroom', rauw.boardroomAuth)
  });
};

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
    magBoardroom: rauw.magBoardroom, balieBron: () => kern().magBalie });
  app.use('/api/office', beleidsmotor.meelezer);
  return Object.assign({}, rauw, {
    beleidsmotor,
    officeAuth: beleidsmotor.bewaak('kantoor', rauw.officeAuth),
    kluisAuth: beleidsmotor.bewaak('op-naam', rauw.kluisAuth),
    naamAuth: beleidsmotor.bewaak('op-naam', rauw.naamAuth),
    boardroomAuth: beleidsmotor.bewaak('boardroom', rauw.boardroomAuth)
  });
};

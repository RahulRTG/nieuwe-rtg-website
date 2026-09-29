/* De vijf Democratie-afhankelijkheden staan expliciet op de routenaad. */
'use strict';

module.exports = function hangDemocratieRouterOp(grens) {
  const d = grens('democratie');
  require('../routes/democratie')(d.app, d.auth, d.officeAuth, d.boardroomWie, d.democratie);
};

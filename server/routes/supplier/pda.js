/* Domein "supplier" (deelmodule): pda. Draait op de gedeelde kern. */
const training = require('../../training');
module.exports = (kern) => {
  const { accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak } = kern;

  /* De netwerk-, posities- en vloerlaag draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; de netwerklaag
     gaat eerst de context in omdat de positieslaag netState gebruikt. */
  const kctx = { accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak };
  const deelNet = require('./pda/netwerk')(kctx);
  Object.assign(kctx, deelNet);
  require('./pda/posities')(kctx);
  require('./pda/vloer')(kctx);
};

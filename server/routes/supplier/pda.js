/* Domein "supplier" (deelmodule): pda. Draait op de gedeelde kern. */
const training = require('../../training');
module.exports = (kern) => {
  const { DEMO, accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak } = kern;

  /* GEEN ZAAK, WEL KANTOOR. De personeelsinlog (/api/supplier/mijn/login)
     zocht alleen naar een rooster, dus wie met zijn eigen account voor RTG zelf
     werkt -- de eigenaar voorop -- las "vraag uw werkgever om een kassacode"
     terwijl zijn wachtwoord klopte en de kantoorsleutel al aan zijn bos hing.
     Een doodlopende weg. Deze vraag leest de ene sleutelbos (kern/eenaccount.js,
     afgeleid of gekoppeld) en herhaalt de regel niet; pas bij het verzoek, want
     bij het bedraden staat hij mogelijk nog niet in de kern. De inlog munt er
     GEEN kantoorsessie mee: dat blijft /api/account/start, na de gewone
     accountinlog met zijn tweede factor en de algemene pin. Een fout in de
     sleutelbos is "weet ik niet", en dan blijft alles zoals het was. */
  function heeftKantoor(lidId) {
    try {
      const r = typeof kern.accRollen === 'function' ? kern.accRollen('user-' + lidId) : null;
      return !!(r && (r.rollen || []).some(x => x.rol === 'kantoor'));
    } catch (e) { return false; }
  }
  /* De netwerk-, posities- en vloerlaag draaien als submodules op een
     gedeelde context, een keer opgebouwd bij het opstarten; de netwerklaag
     gaat eerst de context in omdat de positieslaag netState gebruikt. */
  const kctx = { DEMO, accounts, anthropic, app, crypto, db, findSupplier, logActivity, loginFails, managerOnly, noteFailedTry, notifySupplier, rememberSession, save, schoon, sseToSupplier, supplierAuth, supplierState, tooManyTries, orderMetRef, ordersVanZaak,
    heeftKantoor };
  const deelNet = require('./pda/netwerk')(kctx);
  Object.assign(kctx, deelNet);
  require('./pda/posities')(kctx);
  require('./pda/vloer')(kctx);
};

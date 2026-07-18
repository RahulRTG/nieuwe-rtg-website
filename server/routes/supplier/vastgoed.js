/* Domein "supplier" (deelmodule): vastgoed. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, express, facturatie, logActivity, keyVanCodenaam, managerOnly, media, notify, salonNaarVolgers, save, schoon, sseToCustomer, sseToSupplier, supplierAuth } = kern;

/* ================== vastgoed: het makelaarskantoor ==================
   Panden aanbieden (gericht aan gekozen leden of publiek), biedingen,
   bezichtigingen met keyless toegang, en snelle contracten. */
function isVastgoed(s, res) {
  if (s.type !== 'vastgoed') { res.status(409).json({ error: 'Dit is geen makelaarskantoor.' }); return false; }
  return true;
}
function pandVan(s, id) { return (s.panden || []).find(p => p.id === id); }
function keylessCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[crypto.randomInt(A.length)]; return c; }
  /* De portefeuille- en dealslaag draaien als submodules op een gedeelde
     context, een keer opgebouwd bij het opstarten. */
  const vctx = { app, crypto, db, express, facturatie, logActivity, keyVanCodenaam, managerOnly, media, notify, salonNaarVolgers, save, schoon, sseToCustomer, sseToSupplier, supplierAuth,
    isVastgoed, pandVan, keylessCode };
  require('./vastgoed/portefeuille')(vctx);
  require('./vastgoed/deals')(vctx);
};

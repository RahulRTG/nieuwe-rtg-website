/* Domein "supplier" (deelmodule): verhuur. Draait op de gedeelde kern. */
module.exports = (kern) => {
  const { app, crypto, db, express, facturatie, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth } = kern;

/* ================== autoverhuur: de zaak-kant ==================
   Vloot met vaste dagprijs, en de veiligheidsregels die schimmig verhuren
   onmogelijk maken: uitgeven kan pas MET voor-foto's, afronden pas MET
   na-foto's, en alles blijft vastgelegd met RTG als scheidsrechter. */
function isVerhuur(s, res) {
  // auto's en tweewielers (scooters, motoren, quads) delen dezelfde veilige verhuurmotor
  if (s.type !== 'verhuur' && s.type !== 'tweewielers') { res.status(409).json({ error: 'Dit is geen verhuurzaak.' }); return false; }
  return true;
}
function huurVan(s, ref) {
  const b = kern.boekingMetRef(String(ref || ''));
  return b && b.kind === 'huur' && b.supplierCode === s.code ? b : undefined;
}
function fotosVan(ref) { return db.data.huurFotos[ref] = db.data.huurFotos[ref] || { voor: [], na: [] }; }
  /* De vloot- en ritlaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. */
  const vctx = { app, crypto, db, express, facturatie, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    isVerhuur, huurVan, fotosVan };
  require('./verhuur/vloot')(vctx);
  require('./verhuur/rit')(vctx);
};

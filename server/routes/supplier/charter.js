/* Domein "supplier" (deelmodule): charter, oftewel boten en jachten verhuren.
   Draait op de gedeelde kern. Zelfde eerlijke mechaniek als autoverhuur: de prijs
   staat vast en wordt vooraf betaald, de staat van het vaartuig wordt met foto's
   vastgelegd VOOR het uitvaren en NA de teruggave (door beide partijen, met RTG
   als scheidsrechter), er is een SOS-knop op het water en de gast deelt vrijwillig
   zijn positie. Aangevuld met vaartuig-specifieke zaken: motoruren en brandstof in
   plaats van km/tank, de ligplaats, en bemand (met schipper) of bareboat varen. */
module.exports = (kern) => {
  const { app, crypto, db, express, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth } = kern;

  const BOOT_TYPES = ['Motorjacht', 'Zeiljacht', 'Catamaran', 'RIB', 'Sloep'];
  function isCharter(s, res) {
    if (s.type !== 'charter') { res.status(409).json({ error: 'Dit is geen charterbedrijf.' }); return false; }
    return true;
  }
  function charterVan(s, ref) {
    const b = kern.boekingMetRef(String(ref || ''));
    return b && b.kind === 'charter' && b.supplierCode === s.code ? b : undefined;
  }
  function fotosVan(ref) { return db.data.charterFotos[ref] = db.data.charterFotos[ref] || { voor: [], na: [] }; }
  const getal = (v, min, max, standaard) => { const n = Number(v); return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : standaard; };
  /* De vloot- en reislaag draaien als submodules op een gedeelde context,
     een keer opgebouwd bij het opstarten. */
  const cctx = { app, crypto, db, express, logActivity, managerOnly, media, notify, save, schoon, sseToCustomer, sseToOffice, sseToSupplier, supplierAuth,
    BOOT_TYPES, isCharter, charterVan, fotosVan, getal };
  require('./charter/vloot')(cctx);
  require('./charter/reis')(cctx);
};

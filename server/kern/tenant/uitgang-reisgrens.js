/* De werkruimtelevensloop bezit geen vernietigingscontract voor federatieve
   reisdata. Alleen blokkeren: geen nieuwe bewaartermijn, verwijdering of inzage. */
'use strict';
const { object } = require('./uitgang-validatie');
module.exports = (db, tenant) => {
  const onzeker = () => ({ status: 503, code: 'REISKETEN_VERNIETIGING_ONZEKER',
    error: 'De dekking van de reishistorie kon niet veilig worden vastgesteld. Er is niets vernietigd.' });
  try {
    const bron = db.data.reisAanvragen;
    if (bron === undefined) return null; // bestaande opslag vóór de reiscollectie
    if (!Array.isArray(bron)) return onzeker();
    const zaken = new Set(tenant.zaken || []);
    const eigen = p => p.org === tenant.org || zaken.has(p.supplierCode);
    for (const a of bron) {
      if (!object(a)) return onzeker();
      if (!Object.prototype.hasOwnProperty.call(a, 'keten')) continue;
      const k = a.keten;
      if (!object(k) || !object(k.verkoper) || typeof k.verkoper.org !== 'string' || !k.verkoper.org ||
          (k.leveringen != null && !Array.isArray(k.leveringen)) ||
          (k.offerteVersies != null && !Array.isArray(k.offerteVersies))) return onzeker();
      const partijen = [k.verkoper, ...(k.leveringen || [])];
      for (const o of [...(k.offerteVersies || []), ...(k.offerte != null ? [k.offerte] : [])]) {
        if (!object(o) || !Array.isArray(o.onderdelen)) return onzeker();
        partijen.push(...o.onderdelen);
      }
      if (partijen.some(p => !object(p) || typeof p.org !== 'string' || !p.org)) return onzeker();
      if (partijen.some(eigen)) return { status: 409, code: 'REISKETEN_VERNIETIGING_ONGEKWALIFICEERD',
        error: 'Deze tenant is betrokken bij federatieve reishistorie buiten het werkruimtevernietigingscontract. Er is niets vernietigd; eerst is een bevoegd afwikkelings- en bewaarbeleid nodig.' };
    }
    return null;
  } catch { return onzeker(); }
};

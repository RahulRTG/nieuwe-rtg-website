'use strict';

// De gewone ingang bewaart ook bestaande impliciete callerwrites. Alleen een
// caller die zijn domein al heeft bewaard gebruikt de eigen meldingsingang.
// De collectie komt van de leverancierpoort, die haar al bezit: zo blijft er
// een deur naar db.data en niet twee.
module.exports = ({ meldingen, save, crypto, rtgKlok, sseToSupplier }) => {
  function meld(code, note, bewaar) {
    const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: rtgKlok.datum().toISOString(), ...note };
    const alle = meldingen();
    alle[code] = [n, ...(alle[code] || [])].slice(0, 40);
    bewaar();
    sseToSupplier(code, 'notify', n);
    return n;
  }
  const notifySupplier = (code, note) => meld(code, note, save);
  notifySupplier.naOpslag = (code, note) => meld(code, note,
    () => typeof save.sleutels === 'function' ? save.sleutels(['supplierNotifications']) : save());
  return notifySupplier;
};

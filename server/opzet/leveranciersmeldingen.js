'use strict';

// De gewone ingang bewaart ook bestaande impliciete callerwrites. Alleen een
// caller die zijn domein al heeft bewaard gebruikt de eigen meldingsingang.
module.exports = ({ db, save, crypto, rtgKlok, sseToSupplier }) => {
  function meld(code, note, bewaar) {
    const n = { id: crypto.randomBytes(4).toString('hex'), read: false, at: rtgKlok.datum().toISOString(), ...note };
    db.data.supplierNotifications[code] = (db.data.supplierNotifications[code] || []);
    db.data.supplierNotifications[code].unshift(n);
    db.data.supplierNotifications[code] = db.data.supplierNotifications[code].slice(0, 40);
    bewaar();
    sseToSupplier(code, 'notify', n);
    return n;
  }
  const notifySupplier = (code, note) => meld(code, note, save);
  notifySupplier.naOpslag = (code, note) => meld(code, note,
    () => typeof save.sleutels === 'function' ? save.sleutels(['supplierNotifications']) : save());
  return notifySupplier;
};

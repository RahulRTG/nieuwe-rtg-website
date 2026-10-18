/* RTG Werk OS (deellaag): de herhaalsleutel van een nieuwe taak. Hoort bij
   ./taak.js. Een taak kan uit een mobiele dubbele tik of een herhaald
   netwerkverzoek komen. De werkruimte bewaart daarom uitsluitend een afdruk van
   de herhaalsleutel naast het taak-id. De sleutel zelf en het lid-token komen
   niet in de opslag of in het antwoord. Zonder sleutel blijft het bestaande
   contract werken; de actuele WorkOS-bediening stuurt hem altijd mee. */
'use strict';

module.exports = (crypto) => ({
  afdruk(g, req) {
    const idem = String((req.body || {}).idem || '');
    if (!idem) return { afdruk: null };
    if (!/^[\w-]{16,100}$/.test(idem)) return { fout: 'Een geldige herhaalsleutel is nodig.' };
    return { afdruk: crypto.createHash('sha256')
      .update('werkos|taak|' + (g.l.id || 'beheer') + '|' + idem).digest('hex') };
  },
  eerder(g, afdruk) {
    const boek = g.w.idempotentie && g.w.idempotentie.taken;
    return (afdruk && boek && boek[afdruk]) || null;
  },
  boek(g, afdruk, id) {
    if (!afdruk) return;
    g.w.idempotentie = g.w.idempotentie || {};
    g.w.idempotentie.taken = g.w.idempotentie.taken || {};
    g.w.idempotentie.taken[afdruk] = id;
  }
});

/* CONNECTION OS -- een blokkade geldt over productgrenzen heen.

   Vonk en Rendez-vous houden hun bestaande opslag voorlopig aan: die hoort bij
   de baseline en oude gegevens moeten blijven werken. Deze kleine gedeelde laag
   voegt daar een productoverschrijdende waarheid aan toe. Lezen maakt geen
   opslag; pas blokkeren schrijft. De productspecifieke blokkades blijven tijdens
   de migratie eveneens geschreven en gelezen. */
'use strict';

module.exports = ({ db, save, nu }) => {
  const listeners = new Set();
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();
  const lees = () => (db.data.connectionBlocks && typeof db.data.connectionBlocks === 'object')
    ? db.data.connectionBlocks : null;
  const pak = () => {
    if (!db.data.connectionBlocks || typeof db.data.connectionBlocks !== 'object') db.data.connectionBlocks = {};
    return db.data.connectionBlocks;
  };
  const richting = (a, b) => {
    const r = lees();
    return !!(r && r[a] && r[a][b]);
  };
  function isGeblokkeerd(a, b) {
    const x = String(a || ''), y = String(b || '');
    return !!(x && y && (richting(x, y) || richting(y, x)));
  }
  function blokkeer(van, naar, product) {
    const a = String(van || ''), b = String(naar || '');
    if (!a || !b || a === b) return { ok: false, error: 'Ongeldige blokkade.' };
    const r = pak();
    if (!r[a] || typeof r[a] !== 'object') r[a] = {};
    if (!r[a][b]) r[a][b] = { at: klok(), product: String(product || 'connection') };
    save();
    for (const fn of listeners) { try { fn(a, b, product); } catch (e) {} }
    return { ok: true };
  }
  return { isGeblokkeerd, blokkeer, onBlock(fn) { if (typeof fn === 'function') listeners.add(fn); return () => listeners.delete(fn); } };
};

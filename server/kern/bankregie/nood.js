/* Bankregie, deel "nood": de nood-fallback. Valt de eigen bank uit -- handmatig
   (noodstop) of automatisch na te veel mislukte clearings -- dan zet dit de nood-
   vlag, en clearet de bank vanaf dat moment weer via de kaart-rails (zie de
   effectieve clearing in ./index). Zo valt betalen nooit stil. Herstel wist de
   vlag en de teller. Krijgt de gedeelde ctx van kern/bankregie/index.js. */
module.exports = (ctx) => {
  const { d, save, clearing, NOOD_DREMPEL } = ctx;

  function noodMeld({ reden, wie }) {
    const b = d();
    b.nood = { actief: true, sinds: Date.now(), reden: String(reden || 'Handmatige noodstop').slice(0, 200), door: wie || 'boardroom' };
    save();
    return { ok: true, nood: { ...b.nood }, clearing: clearing() };
  }
  function noodHerstel({ wie }) {
    const b = d();
    b.nood = { actief: false, sinds: null, reden: '', door: '' };
    b.mislukt = 0;
    save();
    return { ok: true, nood: { ...b.nood }, clearing: clearing(), wie: wie || 'boardroom' };
  }
  // door de bank/monitoring aangeroepen als een eigen-clearing faalt; trip nood
  // automatisch zodra de drempel bereikt is.
  function clearingMislukt(reden) {
    const b = d();
    b.mislukt = (b.mislukt || 0) + 1;
    let getript = false;
    if (b.mislukt >= NOOD_DREMPEL && !b.nood.actief) {
      b.nood = { actief: true, sinds: Date.now(), reden: 'Automatisch na ' + b.mislukt + ' mislukte clearings' + (reden ? ' (' + String(reden).slice(0, 80) + ')' : ''), door: 'auto' };
      getript = true;
    }
    save();
    return { nood: b.nood.actief, getript, mislukt: b.mislukt };
  }
  function clearingGelukt() { const b = d(); if (b.mislukt) { b.mislukt = 0; save(); } }

  return { noodMeld, noodHerstel, clearingMislukt, clearingGelukt };
};

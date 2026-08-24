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
  /* `sleutel` hoort bij de MISLUKTE CLEARING, niet bij de oproep. Deze teller
     trekt bij NOOD_DREMPEL automatisch de noodstop -- clearing valt dan terug
     op de kaart-rails -- dus dezelfde mislukking twee keer melden kan de bank
     onterecht in nood zetten. Er is nog geen aanroeper; juist daarom ligt het
     contract nu vast, voor er een is (TAKEN.md 4.56). Zonder sleutel telt elke
     oproep gewoon op: dat blijft mogelijk, maar dan is het een keuze. */
  function clearingMislukt(reden, sleutel) {
    const b = d();
    if (sleutel) {
      const k = String(sleutel).slice(0, 80);
      if (!Array.isArray(b.mislukking)) b.mislukking = [];
      if (b.mislukking.includes(k)) return { nood: b.nood.actief, getript: false, mislukt: b.mislukt || 0, herhaald: true };
      b.mislukking.push(k);
      if (b.mislukking.length > 200) b.mislukking.splice(0, b.mislukking.length - 200);
    }
    b.mislukt = (b.mislukt || 0) + 1;
    let getript = false;
    if (b.mislukt >= NOOD_DREMPEL && !b.nood.actief) {
      b.nood = { actief: true, sinds: Date.now(), reden: 'Automatisch na ' + b.mislukt + ' mislukte clearings' + (reden ? ' (' + String(reden).slice(0, 80) + ')' : ''), door: 'auto' };
      getript = true;
    }
    save();
    return { nood: b.nood.actief, getript, mislukt: b.mislukt };
  }
  /* Met de teller gaan ook de gemelde sleutels weg. Zou dat niet gebeuren, dan
     hield een sleutel van voor het herstel een LATERE echte mislukking tegen --
     dan telt de bank te weinig in plaats van te veel, en dat is de gevaarlijke
     kant op. De sleutel geldt dus binnen een reeks mislukkingen, niet eeuwig. */
  function clearingGelukt() {
    const b = d();
    if (b.mislukt || (b.mislukking && b.mislukking.length)) { b.mislukt = 0; b.mislukking = []; save(); }
  }

  return { noodMeld, noodHerstel, clearingMislukt, clearingGelukt };
};

  // ---- charter: boten en jachten ----
  let charters = null;
  async function laadCharters(){
    if (!has('charter') || !API.live) return;
    try { charters = (await API.call('/supplier/charter/overzicht')).charters; } catch(e){ charters = []; }
    renderCharter();
  }
  const CHARTER_ST = { 'aangevraagd': 'geboekt, klaar om uit te varen', 'lopend': 'onderweg op zee', 'afgerond': 'afgerond' };
  const BOOT_TYPES = ['Motorjacht','Zeiljacht','Catamaran','RIB','Sloep'];

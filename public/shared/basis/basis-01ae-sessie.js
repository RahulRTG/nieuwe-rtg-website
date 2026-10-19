/* De sessie van dit scherm, voor de app-gids (eigenaarsbesluit 19 oktober
   2026: gebruiken vraagt een account; server/kern/elkesessie.js). Elk soort
   scherm draagt zijn eigen token -- lid, zaak, kantoor of PDA -- en een
   Foundation-scherm een gezinsprofiel. Wat er is, reist mee; de server
   beslist. */
  function gidsSessie() {
    var L = window.localStorage, t = '', g = {};
    try {
      t = L.getItem('rtg_member_token') || L.getItem('rtg_sup_token') || L.getItem('rtg_office_token') || L.getItem('rtg_pda_token') || '';
      g = JSON.parse(L.getItem('rtf_sessie') || 'null') || {};
    } catch (e) { /* privévenster: zonder sessie */ }
    return { kop: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t }, code: g.code, token: g.token };
  }

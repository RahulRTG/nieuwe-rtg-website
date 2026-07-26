/* RTG Defensie: het commando- en logistiekscherm. Inloggen op naam met PIN,
   daarna het bord: paraatheid, eenheden, materieel en onderhoud,
   bevoorrading, oefeningen en de staf-AI. Logistiek en organisatie; geen
   wapensysteem. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = '';
  try { token = sessionStorage.getItem('rtg_def_token') || ''; } catch (e) {}

  async function api(pad, body) {
    const r = await fetch('/api/supplier/' + pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      body: JSON.stringify(body || {})
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
    return d;
  }

  $('#lZoek').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('roster', { code: $('#lCode').value.trim().toUpperCase() });
      $('#lWie').innerHTML = d.staff.map(m => '<option value="' + m.id + '">' + esc(m.name) + ' (' + esc(m.func || m.role) + ')</option>').join('');
      $('#lWieRij').hidden = false;
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lIn').addEventListener('click', async () => {
    $('#lFout').textContent = '';
    try {
      const d = await api('login', { code: $('#lCode').value.trim().toUpperCase(), staffId: Number($('#lWie').value), pin: $('#lPin').value });
      token = d.token;
      try { sessionStorage.setItem('rtg_def_token', token); } catch (e) {}
      start();
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lIn').click(); });

  const PARAAT_PILL = { gevechtsgereed: 'g', beperkt: 'b', 'in-onderhoud': 'b', 'niet-inzetbaar': 'r' };
  const MAT_PILL = { inzetbaar: 'g', 'in-onderhoud': 'b', defect: 'r' };
  const PARAAT_OPTS = ['gevechtsgereed', 'beperkt', 'in-onderhoud', 'niet-inzetbaar'];
  const MAT_OPTS = ['inzetbaar', 'in-onderhoud', 'defect'];
  const BEV_OPTS = ['aangevraagd', 'goedgekeurd', 'onderweg', 'geleverd', 'afgewezen'];


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

  async function laad() {
    const d = await api('def/overzicht');
    $('#titel').textContent = '🎖️ ' + d.naam;
    const p = d.paraatheid;
    $('#paraatheid').innerHTML =
      '<div class="kpi"><b style="color:var(--groen);">' + p.gevechtsgereed + '</b><span>gevechtsgereed</span></div>' +
      '<div class="kpi"><b style="color:var(--gold);">' + p.beperkt + '</b><span>beperkt</span></div>' +
      '<div class="kpi"><b style="color:var(--gold);">' + p.inOnderhoud + '</b><span>in onderhoud</span></div>' +
      '<div class="kpi"><b style="color:var(--rood);">' + p.nietInzetbaar + '</b><span>niet inzetbaar</span></div>' +
      '<div class="kpi"><b>' + d.materieelDefect + '</b><span>materieel defect</span></div>';
    $('#eenheden').innerHTML = d.eenheden.length ? d.eenheden.map(e =>
      '<div class="item"><b>' + esc(e.naam) + '</b> · ' + esc(e.soort) + (e.sterkte ? ' · ' + e.sterkte + ' man' : '') +
      ' <span class="pill ' + (PARAAT_PILL[e.paraat] || '') + '">' + esc(e.paraat) + '</span>' + (e.reden ? ' <span class="stil">' + esc(e.reden) + '</span>' : '') +
      '<div class="rij"><select data-par="' + e.id + '">' + PARAAT_OPTS.map(o => '<option value="' + o + '"' + (o === e.paraat ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
      '<input class="veld" data-parr="' + e.id + '" placeholder="reden" maxlength="200" style="max-width:11rem;"><button class="knop klein" data-parzet="' + e.id + '" type="button">Meld</button></div></div>').join('')
      : '<p class="stil">Nog geen eenheden op het bord.</p>';
    $('#materieel').innerHTML = d.materieel.length ? d.materieel.map(m =>
      '<div class="item"><b>' + esc(m.naam) + '</b> · ' + esc(m.soort) + ' <span class="pill ' + (MAT_PILL[m.staat] || '') + '">' + esc(m.staat) + '</span>' + (m.notitie ? ' <span class="stil">' + esc(m.notitie) + '</span>' : '') +
      '<div class="rij"><select data-mat="' + m.id + '">' + MAT_OPTS.map(o => '<option value="' + o + '"' + (o === m.staat ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
      '<input class="veld" data-matn="' + m.id + '" placeholder="notitie" maxlength="200" style="max-width:11rem;"><button class="knop klein" data-matzet="' + m.id + '" type="button">Zet</button></div></div>').join('')
      : '<p class="stil">Nog geen materieel in het park.</p>';
    $('#bevoorrading').innerHTML = d.bevoorrading.length ? d.bevoorrading.map(v =>
      '<div class="item"><span class="pill ' + (v.prioriteit === 'hoog' ? 'r' : v.prioriteit === 'laag' ? 'g' : 'b') + '">' + esc(v.prioriteit) + '</span> <b>' + esc(v.wat) + '</b>' +
      (v.aantal ? ' · ' + esc(v.aantal) : '') + ' · ' + esc(v.soort) + ' · ' + esc(v.status) +
      '<div class="rij">' + BEV_OPTS.map(o => '<button class="knop klein" data-bevzet="' + v.id + '" data-bevst="' + o + '" type="button">' + o + '</button>').join('') + '</div></div>').join('')
      : '<p class="stil">Geen open bevoorradingsverzoeken.</p>';
    const TRIAGE_KLEUR = { rood: 'var(--rood)', oranje: '#E08A3C', geel: 'var(--gold)', groen: 'var(--groen)', blauw: '#6FA8DC' };
    const zkOpts = (d.ziekenhuizen || []).map(z => '<option value="' + z.code + '">' + esc(z.naam) + '</option>').join('');
    $('#gewonden').innerHTML = d.gewonden.length ? d.gewonden.map(g =>
      '<div class="item"><span class="pill" style="color:' + TRIAGE_KLEUR[g.triage] + ';border-color:' + TRIAGE_KLEUR[g.triage] + ';">' + esc(g.triage) + '</span> <b>' + esc(g.aanduiding) + '</b> · ' + esc(g.klacht) + ' · ' + esc(g.status) +
      '<div class="rij"><button class="knop klein" data-gz="in-behandeling" data-g="' + g.id + '" type="button">Behandel</button>' +
      '<button class="knop klein" data-gz="stabiel" data-g="' + g.id + '" type="button">Stabiel</button>' +
      (zkOpts ? '<select data-gevzk="' + g.id + '">' + zkOpts + '</select><button class="knop klein" data-gev="' + g.id + '" type="button">Evacueer</button>' : '') +
      '<button class="knop klein" data-gz="ontslagen" data-g="' + g.id + '" type="button">Ontsla</button></div></div>').join('')
      : '<p class="stil">Geen gewonden op het bord.</p>';
    $('#verplaatsingen').innerHTML = d.verplaatsingen.length ? d.verplaatsingen.map(v =>
      '<div class="item"><b>' + esc(v.van) + ' → ' + esc(v.naar) + '</b> · ' + ({ land: '🚚', water: '🚢', lucht: '✈️' }[v.soort] || '') + ' ' + esc(v.soort) + ' · ' + esc(v.lading) + (v.wanneer ? ' · ' + esc(v.wanneer) : '') + ' · ' + esc(v.status) +
      '<div class="rij"><button class="knop klein" data-vpz="onderweg" data-vp="' + v.id + '" type="button">Onderweg</button>' +
      '<button class="knop klein" data-vpz="aangekomen" data-vp="' + v.id + '" type="button">Aangekomen</button>' +
      '<button class="knop klein" data-vpz="afgelast" data-vp="' + v.id + '" type="button">Afgelast</button></div></div>').join('')
      : '<p class="stil">Geen verplaatsingen gepland.</p>';
    $('#oefeningen').innerHTML = d.oefeningen.length ? d.oefeningen.map(o =>
      '<div class="item"><b>' + esc(o.naam) + '</b>' + (o.wanneer ? ' · ' + esc(o.wanneer) : '') + (o.locatie ? ' · ' + esc(o.locatie) : '') + ' · ' + esc(o.status) +
      '<div class="rij"><button class="knop klein" data-oefzet="' + o.id + '" data-oefst="bezig" type="button">Bezig</button>' +
      '<button class="knop klein" data-oefzet="' + o.id + '" data-oefst="afgerond" type="button">Afgerond</button>' +
      '<button class="knop klein" data-oefzet="' + o.id + '" data-oefst="afgelast" type="button">Afgelast</button></div></div>').join('')
      : '<p class="stil">Geen oefeningen gepland.</p>';
    bind();
  }
  function bind() {
    document.querySelectorAll('[data-parzet]').forEach(b => b.addEventListener('click', () => doe('def/paraat',
      { id: b.dataset.parzet, paraat: (document.querySelector('[data-par="' + b.dataset.parzet + '"]') || {}).value, reden: (document.querySelector('[data-parr="' + b.dataset.parzet + '"]') || {}).value })));
    document.querySelectorAll('[data-matzet]').forEach(b => b.addEventListener('click', () => doe('def/materieel/zet',
      { id: b.dataset.matzet, staat: (document.querySelector('[data-mat="' + b.dataset.matzet + '"]') || {}).value, notitie: (document.querySelector('[data-matn="' + b.dataset.matzet + '"]') || {}).value })));
    document.querySelectorAll('[data-bevzet]').forEach(b => b.addEventListener('click', () => doe('def/bevoorrading/zet', { id: b.dataset.bevzet, status: b.dataset.bevst })));
    document.querySelectorAll('[data-oefzet]').forEach(b => b.addEventListener('click', () => doe('def/oefening/zet', { id: b.dataset.oefzet, status: b.dataset.oefst })));
    document.querySelectorAll('[data-gz]').forEach(b => b.addEventListener('click', () => doe('def/gewonde/zet', { id: b.dataset.g, status: b.dataset.gz })));
    document.querySelectorAll('[data-gev]').forEach(b => b.addEventListener('click', () => doe('def/gewonde/evacueer',
      { id: b.dataset.gev, ziekenhuis: (document.querySelector('[data-gevzk="' + b.dataset.gev + '"]') || {}).value })));
    document.querySelectorAll('[data-vpz]').forEach(b => b.addEventListener('click', () => doe('def/verplaatsing/zet', { id: b.dataset.vp, status: b.dataset.vpz })));
  }
  async function doe(pad, body) { try { await api(pad, body); laad(); } catch (e) { alert(e.message); } }

  $('#eMaak').addEventListener('click', () => {
    if (!$('#eNaam').value.trim()) return;
    doe('def/eenheid/maak', { naam: $('#eNaam').value, soort: $('#eSoort').value, sterkte: Number($('#eSterkte').value) });
    $('#eNaam').value = ''; $('#eSoort').value = ''; $('#eSterkte').value = '';
  });
  $('#mMaak').addEventListener('click', () => {
    if (!$('#mNaam').value.trim()) return;
    doe('def/materieel/maak', { naam: $('#mNaam').value, soort: $('#mSoort').value });
    $('#mNaam').value = '';
  });
  $('#bMaak').addEventListener('click', () => {
    if (!$('#bWat').value.trim()) return;
    doe('def/bevoorrading/maak', { soort: $('#bSoort').value, wat: $('#bWat').value, aantal: $('#bAantal').value, prioriteit: $('#bPrio').value });
    $('#bWat').value = ''; $('#bAantal').value = '';
  });
  $('#oMaak').addEventListener('click', () => {
    if (!$('#oNaam').value.trim()) return;
    doe('def/oefening/maak', { naam: $('#oNaam').value, wanneer: $('#oWanneer').value, locatie: $('#oLocatie').value });
    $('#oNaam').value = ''; $('#oWanneer').value = ''; $('#oLocatie').value = '';
  });
  $('#gMaak').addEventListener('click', () => {
    if (!$('#gKlacht').value.trim()) return;
    doe('def/gewonde/maak', { aanduiding: $('#gAand').value, klacht: $('#gKlacht').value, triage: $('#gTriage').value });
    $('#gAand').value = ''; $('#gKlacht').value = '';
  });
  $('#vpMaak').addEventListener('click', () => {
    if (!$('#vpVan').value.trim() || !$('#vpNaar').value.trim()) return;
    doe('def/verplaatsing/maak', { van: $('#vpVan').value, naar: $('#vpNaar').value, soort: $('#vpSoort').value, lading: $('#vpLading').value, wanneer: $('#vpWanneer').value });
    $('#vpVan').value = ''; $('#vpNaar').value = ''; $('#vpWanneer').value = '';
  });
  $('#aiStuur').addEventListener('click', async () => {
    const q = $('#aiVraag').value.trim();
    if (!q) return;
    $('#aiVraag').value = '';
    const chat = $('#aiChat');
    chat.insertAdjacentHTML('beforeend', '<div class="bb ik">' + esc(q) + '</div>');
    try {
      const r = await api('def/ai', { q });
      chat.insertAdjacentHTML('beforeend', '<div class="bb">' + esc(r.antwoord) + '</div>');
    } catch (e) { chat.insertAdjacentHTML('beforeend', '<div class="bb">' + esc(e.message) + '</div>'); }
    chat.scrollTop = chat.scrollHeight;
  });
  $('#aiVraag').addEventListener('keydown', e => { if (e.key === 'Enter') $('#aiStuur').click(); });

  function start() {
    $('#vLogin').hidden = true;
    $('#vBord').hidden = false;
    laad().catch(e => { $('#vLogin').hidden = false; $('#vBord').hidden = true; $('#lFout').textContent = e.message; token = ''; });
  }
  setInterval(() => { if (!$('#vBord').hidden && !document.hidden) laad().catch(() => {}); }, 25000);
  if (token) start();
})();

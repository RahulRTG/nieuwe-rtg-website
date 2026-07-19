/* RTG Meldkamer: het werkscherm van de zes hulpdienst-korpsen. Inloggen op
   naam met PIN (personeelslogin van de zaak), daarna het bord: meldingen
   aannemen en toewijzen, eenheden over land, water en door de lucht,
   bijstand, het beddenbord van het ziekenhuis, de consulten van de
   huisarts, en de meldkamer-AI. */
(() => {
  const $ = s => document.querySelector(s);
  const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let token = '';
  try { token = sessionStorage.getItem('rtg_meldkamer_token') || ''; } catch (e) {}
  let korps = null;

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

  /* ---------- aanmelden ---------- */
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
      try { sessionStorage.setItem('rtg_meldkamer_token', token); } catch (e) {}
      start();
    } catch (e) { $('#lFout').textContent = e.message; }
  });
  $('#lPin').addEventListener('keydown', e => { if (e.key === 'Enter') $('#lIn').click(); });

  /* ---------- het bord ---------- */
  async function laad() {
    const d = await api('hulp/overzicht');
    korps = d;
    $('#titel').textContent = '🚨 ' + d.korps.naam;
    $('#wie').textContent = d.korps.label;
    // special forces nemen zelf niets aan; hun werk komt via bijstand binnen
    $('#rNieuw').hidden = ['specials', 'ziekenhuis', 'huisarts'].includes(d.korps.soort);
    const alle = [...(d.bijstand || []).map(m => ({ ...m, viaBijstand: true })), ...(d.meldingen || [])];
    $('#meldingen').innerHTML = alle.length ? alle.map(m => {
      const vrij = (d.eenheden || []).filter(e => e.status === 'vrij');
      const kanWijzen = m.status !== 'afgerond';
      return '<div class="melding"><span class="prio p' + m.prio + '">P' + m.prio + '</span><b>' + esc(m.tekst) + '</b>' +
        (m.plek ? ' · ' + esc(m.plek) : '') + ' · ' + esc(m.status) + (m.viaBijstand ? ' · <span style="color:var(--gold);">bijstandsverzoek</span>' : '') +
        '<div class="rij">' +
        (kanWijzen && vrij.length ? '<select data-wijs-e="' + m.id + '">' + vrij.map(e => '<option value="' + e.id + '">' + esc(e.naam) + ' (' + e.soort + ')</option>').join('') + '</select>' +
          '<button class="knop klein" data-wijs="' + m.id + '" type="button">Stuur</button>' : '') +
        (kanWijzen ? '<button class="knop klein" data-status="ter-plaatse" data-m="' + m.id + '" type="button">Ter plaatse</button>' +
          '<button class="knop klein" data-status="afgerond" data-m="' + m.id + '" type="button">Rond af</button>' : '') +
        (!m.viaBijstand && kanWijzen && (d.korpsen || []).length ? '<select data-bij-k="' + m.id + '">' + d.korpsen.map(k => '<option value="' + k.code + '">' + esc(k.naam) + '</option>').join('') + '</select>' +
          '<button class="knop klein" data-bij="' + m.id + '" type="button">Vraag bijstand</button>' : '') +
        '</div>' +
        '<div class="log">' + (m.logboek || []).slice(-3).map(l => esc(l.wat)).join(' · ') + '</div></div>';
    }).join('') : '<p class="stil">Geen meldingen op het bord.</p>';
    $('#eenheden').innerHTML = (d.eenheden || []).map(e =>
      '<span class="eenheid ' + e.status + '">' + esc(e.naam) + ' · ' + e.soort + ' · ' + e.status +
      (e.status === 'vrij' ? ' <button class="knop klein" data-ezet="buiten-dienst" data-e="' + e.id + '" type="button">buiten dienst</button>'
        : e.status === 'buiten-dienst' ? ' <button class="knop klein" data-ezet="vrij" data-e="' + e.id + '" type="button">weer vrij</button>' : '') +
      '</span>').join('') || '<span class="stil">Nog geen eenheden; zet ze hieronder op het bord.</span>';
    // de kaarten per soort korps
    $('#kZiekenhuis').hidden = d.korps.soort !== 'ziekenhuis';
    if (d.bedden) {
      $('#bedden').textContent = 'Bedden: ' + d.bedden.bezet + ' bezet van ' + d.bedden.totaal + '.';
      $('#opnames').innerHTML = (d.opnames || []).map(o =>
        '<div class="melding">' + esc(o.triage) + ' · van ' + esc(o.van) + ' · ' + esc(o.status) +
        (o.status === 'aangekondigd' ? '<div class="rij"><button class="knop klein" data-op="opgenomen" data-o="' + o.id + '" type="button">Neem op</button>' +
          '<button class="knop klein" data-op="geweigerd" data-o="' + o.id + '" type="button">Weiger</button></div>' :
          o.status === 'opgenomen' ? '<div class="rij"><button class="knop klein" data-op="ontslagen" data-o="' + o.id + '" type="button">Ontsla</button></div>' : '') +
        '</div>').join('') || '<p class="stil">Geen opnames aangekondigd.</p>';
    }
    $('#kOverdracht').hidden = !(d.ziekenhuizen && d.ziekenhuizen.length);
    if (d.ziekenhuizen) $('#oZiekenhuis').innerHTML = d.ziekenhuizen.map(z =>
      '<option value="' + z.code + '">' + esc(z.naam) + ' (' + z.bedden.bezet + '/' + z.bedden.totaal + ' bezet)</option>').join('');
    $('#kConsulten').hidden = d.korps.soort !== 'huisarts';
    if (d.consulten) $('#consulten').innerHTML = d.consulten.map(c =>
      '<div class="melding">' + esc(c.klacht) + ' · ' + esc(c.urgentie) + (c.wanneer ? ' · ' + esc(c.wanneer) : '') + ' · ' + esc(c.status) +
      (c.status === 'gepland' ? '<div class="rij"><button class="knop klein" data-cz="afgerond" data-c="' + c.id + '" type="button">Rond af</button>' +
        '<button class="knop klein" data-cz="verwezen" data-c="' + c.id + '" type="button">Verwijs door</button></div>' : '') +
      '</div>').join('') || '<p class="stil">Geen consulten gepland.</p>';
    bind();
  }
  function bind() {
    document.querySelectorAll('[data-wijs]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/melding/wijs', { melding: b.dataset.wijs, eenheid: (document.querySelector('[data-wijs-e="' + b.dataset.wijs + '"]') || {}).value })));
    document.querySelectorAll('[data-status]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/melding/status', { melding: b.dataset.m, status: b.dataset.status })));
    document.querySelectorAll('[data-bij]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/bijstand', { melding: b.dataset.bij, korps: (document.querySelector('[data-bij-k="' + b.dataset.bij + '"]') || {}).value })));
    document.querySelectorAll('[data-ezet]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/eenheid/zet', { id: b.dataset.e, status: b.dataset.ezet })));
    document.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/opname/zet', { id: b.dataset.o, status: b.dataset.op })));
    document.querySelectorAll('[data-cz]').forEach(b => b.addEventListener('click', () =>
      doe('hulp/consult/zet', { id: b.dataset.c, status: b.dataset.cz })));
  }
  async function doe(pad, body) {
    try { await api(pad, body); laad(); } catch (e) { alert(e.message); }
  }
  $('#mMaak').addEventListener('click', () => {
    const tekst = $('#mTekst').value.trim();
    if (!tekst) return;
    doe('hulp/melding/maak', { tekst, plek: $('#mPlek').value, prio: Number($('#mPrio').value) });
    $('#mTekst').value = ''; $('#mPlek').value = '';
  });
  $('#eMaak').addEventListener('click', () => {
    const naam = $('#eNaam').value.trim();
    if (!naam) return;
    doe('hulp/eenheid/maak', { naam, soort: $('#eSoort').value });
    $('#eNaam').value = '';
  });
  $('#bZet').addEventListener('click', () => doe('hulp/bedden', { totaal: Number($('#bTotaal').value) }));
  $('#oMaak').addEventListener('click', async () => {
    try {
      const r = await api('hulp/overdracht', { ziekenhuis: $('#oZiekenhuis').value, triage: $('#oTriage').value });
      $('#oUit').textContent = 'Aangekondigd bij het ziekenhuis.' + (r.waarschuwing ? ' ' + r.waarschuwing : '');
      $('#oTriage').value = '';
    } catch (e) { $('#oUit').textContent = e.message; }
  });
  $('#cMaak').addEventListener('click', () => {
    const klacht = $('#cKlacht').value.trim();
    if (!klacht) return;
    doe('hulp/consult/maak', { klacht, urgentie: $('#cUrgentie').value, wanneer: $('#cWanneer').value });
    $('#cKlacht').value = '';
  });
  $('#aiStuur').addEventListener('click', async () => {
    const q = $('#aiVraag').value.trim();
    if (!q) return;
    $('#aiVraag').value = '';
    const chat = $('#aiChat');
    chat.insertAdjacentHTML('beforeend', '<div class="b ik">' + esc(q) + '</div>');
    try {
      const r = await api('hulp/ai', { q });
      chat.insertAdjacentHTML('beforeend', '<div class="b">' + esc(r.antwoord) + '</div>');
    } catch (e) { chat.insertAdjacentHTML('beforeend', '<div class="b">' + esc(e.message) + '</div>'); }
    chat.scrollTop = chat.scrollHeight;
  });
  $('#aiVraag').addEventListener('keydown', e => { if (e.key === 'Enter') $('#aiStuur').click(); });

  function start() {
    $('#vLogin').hidden = true;
    $('#vBord').hidden = false;
    laad().catch(e => { $('#vLogin').hidden = false; $('#vBord').hidden = true; $('#lFout').textContent = e.message; token = ''; });
  }
  setInterval(() => { if (!$('#vBord').hidden && !document.hidden) laad().catch(() => {}); }, 20000);
  if (token) start();
})();

(function (w, d) {
  'use strict';
  var root = d.getElementById('projectRoom'), laag = d.getElementById('prBewijsLaag'), bewijsForm = d.getElementById('prBewijsForm');
  if (!root) return;
  var params = new URLSearchParams(w.location.search), huis = ['rtg', 'rtf', 'gedeeld'].indexOf(params.get('huis')) >= 0 ? params.get('huis') : 'rtg';
  var scherm = ['uitvoering', 'dossier', 'oplevering'].indexOf(params.get('view')) >= 0 ? params.get('view') : 'uitvoering';
  var gekozenId = params.get('project') || '', staat = null, token = null;
  try { token = localStorage.getItem('rtg_office_token'); } catch (e) {}
  function veilig(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function initialen(v) { return String(v || 'PR').trim().split(/\s+/).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase(); }
  w.ProjectRoomUtil = Object.freeze({ veilig: veilig, initialen: initialen });
  function alle(q) { return Array.prototype.slice.call(root.querySelectorAll(q)); }
  function gekozen() { return staat && (staat.projecten || []).find(function (x) { return String(x.id) === String(gekozenId); }); }
  function melding(tekst) { var el = d.getElementById('prMelding'); el.textContent = tekst; el.hidden = false; w.clearTimeout(melding.timer); melding.timer = w.setTimeout(function () { el.hidden = true; }, 3600); }
  async function persoonlijkToken() {
    var member = null; try { member = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!member) return false;
    try {
      var r = await fetch('/api/account/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + member }, body: JSON.stringify({ rol: 'kantoor' }) });
      var body = await r.json().catch(function () { return {}; }); if (!r.ok || !body.token) return false;
      token = body.token; try { localStorage.setItem('rtg_office_token', token); } catch (e) {} return true;
    } catch (e) { return false; }
  }
  async function api(pad, body) {
    var r = await fetch('/api/rtgone/' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
    var uit = await r.json().catch(function () { return {}; }); if (!r.ok) { var fout = new Error(uit.error || 'Project Room kon de handeling niet verwerken.'); fout.status = r.status; throw fout; } return uit;
  }
  function vervang(project) { staat.projecten = (staat.projecten || []).map(function (x) { return x.id === project.id ? project : x; }); }
  function teken() {
    if (!staat) return;
    if (scherm === 'uitvoering') gekozenId = w.ProjectRoomUitvoering.teken(root, staat, gekozenId) || gekozenId;
    if (scherm === 'dossier') w.ProjectRoomDossier.teken(root, staat, gekozen());
    if (scherm === 'oplevering') w.ProjectRoomOplevering.teken(root, staat, gekozen());
  }
  function open(naam) {
    scherm = ['uitvoering', 'dossier', 'oplevering'].indexOf(naam) >= 0 ? naam : 'uitvoering'; d.body.setAttribute('data-pr-scherm', scherm);
    alle('[data-pr-paneel]').forEach(function (el) { el.hidden = el.dataset.prPaneel !== scherm; });
    alle('.pr-nav [data-pr-open]').forEach(function (el) { if (el.dataset.prOpen === scherm) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    teken(); w.scrollTo(0, 0);
  }
  async function laad() {
    if (!token && !(await persoonlijkToken())) { w.location.href = '/apps/rtgkantoor.html'; return; }
    try {
      staat = await api('state', { huis: huis }); alle('[data-pr-huis]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.prHuis === huis)); });
      if (gekozenId && !gekozen()) gekozenId = ''; if (!gekozenId && (staat.projecten || []).length) gekozenId = staat.projecten[0].id; open(scherm);
    } catch (e) {
      if (e.status === 401) { try { localStorage.removeItem('rtg_office_token'); } catch (f) {} token = null; if (await persoonlijkToken()) return laad(); }
      root.querySelector('#prUitvoering').innerHTML = '<div class="pr-leeg"><h2>Project Room kon niet laden.</h2><p>' + veilig(e.message) + '</p></div>';
    }
  }
  function openBewijs() { if (!gekozen()) return melding('Kies eerst een project.'); bewijsForm.reset(); laag.hidden = false; d.body.style.overflow = 'hidden'; w.setTimeout(function () { bewijsForm.elements.titel.focus(); }, 30); }
  function sluitBewijs() { laag.hidden = true; d.body.style.overflow = ''; }
  root.addEventListener('click', async function (e) {
    var knop = e.target.closest('[data-pr-open],[data-pr-kies],[data-pr-huis],[data-pr-taak],[data-pr-bewijs]'); if (!knop) return;
    if (knop.dataset.prHuis) { huis = knop.dataset.prHuis; gekozenId = ''; await laad(); }
    else if (knop.dataset.prKies) { gekozenId = knop.dataset.prKies; teken(); w.scrollTo(0, 0); }
    else if (knop.dataset.prTaak) {
      var p = gekozen(); if (!p) return; knop.disabled = true;
      try { var uit = await api('project/taak', { id: p.id, taakId: knop.dataset.prTaak, af: knop.dataset.prAf !== 'false' }); vervang(uit.project); teken(); melding(knop.dataset.prAf === 'false' ? 'De uitvoeringstaak is heropend.' : 'De uitvoeringstaak is afgerond. De volgende stap staat klaar.'); }
      catch (fout) { melding(fout.message); } finally { knop.disabled = false; }
    } else if (knop.dataset.prBewijs !== undefined) openBewijs();
    else if (knop.dataset.prOpen) open(knop.dataset.prOpen);
  });
  laag.addEventListener('click', function (e) { if (e.target === laag || e.target.closest('[data-pr-sluit]')) sluitBewijs(); });
  bewijsForm.addEventListener('submit', async function (e) {
    e.preventDefault(); var p = gekozen(), knop = e.submitter, fd = new FormData(bewijsForm), body = { projectId: p && p.id };
    fd.forEach(function (v, k) { body[k] = v; }); knop.disabled = true;
    try { var uit = await api('project/bewijs', body); vervang(uit.project); sluitBewijs(); teken(); melding('Het bewijs en de herkomst zijn aan het projectdossier toegevoegd.'); }
    catch (fout) { melding(fout.message); } finally { knop.disabled = false; }
  });
  root.addEventListener('submit', async function (e) {
    if (e.target.id !== 'prOpleverForm') return; e.preventDefault(); var p = gekozen(), knop = e.submitter, fd = new FormData(e.target); knop.disabled = true;
    try { var uit = await api('project/oplever', { projectId: p && p.id, uitkomst: fd.get('uitkomst'), leren: fd.get('leren') }); vervang(uit.project); teken(); melding('Het project is menselijk opgeleverd. Resultaat en leerregel blijven bewaard.'); }
    catch (fout) { melding(fout.message); } finally { knop.disabled = false; }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !laag.hidden) sluitBewijs(); });
  open(scherm); laad();
}(window, document));

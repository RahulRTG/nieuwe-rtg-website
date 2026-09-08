(function (w, d) {
  'use strict';
  var root = d.getElementById('decisionRoom'), laag = d.getElementById('drIntake'), intake = d.getElementById('drIntakeForm');
  if (!root) return;
  var params = new URLSearchParams(w.location.search), huis = ['rtg', 'rtf', 'gedeeld'].indexOf(params.get('huis')) >= 0 ? params.get('huis') : 'rtg';
  var staat = null, gekozenId = params.get('id') || '', scherm = 'agenda', token = null, intakeEenmaal = false;
  try { token = localStorage.getItem('rtg_office_token'); } catch (e) {}
  function veilig(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  w.DecisionRoomUtil = Object.freeze({ veilig: veilig });
  function alle(q) { return Array.prototype.slice.call(root.querySelectorAll(q)); }
  function gekozen() { return staat && (staat.goedkeuringen || []).find(function (x) { return String(x.id) === String(gekozenId); }); }
  function melding(tekst) {
    var el = d.getElementById('drMelding'); el.textContent = tekst; el.hidden = false;
    w.clearTimeout(melding.timer); melding.timer = w.setTimeout(function () { el.hidden = true; }, 3600);
  }
  async function persoonlijkToken() {
    var member = null; try { member = localStorage.getItem('rtg_member_token'); } catch (e) {}
    if (!member) return false;
    try {
      var r = await fetch('/api/account/start', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + member }, body: JSON.stringify({ rol: 'kantoor' }) });
      var body = await r.json().catch(function () { return {}; });
      if (!r.ok || !body.token) return false;
      token = body.token; try { localStorage.setItem('rtg_office_token', token); } catch (e) {} return true;
    } catch (e) { return false; }
  }
  async function api(pad, body) {
    var r = await fetch('/api/rtgone/' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') }, body: JSON.stringify(body || {}) });
    var uit = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(uit.error || 'Decision Room kon de handeling niet verwerken.');
    return uit;
  }
  function open(naam) {
    scherm = ['agenda', 'afweging', 'besluit', 'archief'].indexOf(naam) >= 0 ? naam : 'agenda';
    d.body.setAttribute('data-dr-scherm', scherm);
    alle('[data-dr-paneel]').forEach(function (el) { el.hidden = el.dataset.drPaneel !== scherm; });
    alle('.dr-nav [data-dr-open]').forEach(function (el) { if (el.dataset.drOpen === scherm) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    teken(); w.scrollTo(0, 0);
  }
  function datum(v) { var x = new Date(v), t = x.getTime(); return Number.isFinite(t) ? x.toLocaleString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'tijd onbekend'; }
  function archief() {
    var doel = root.querySelector('#drArchief'), lijst = (staat && staat.goedkeuringen || []).filter(function (x) { return x.status !== 'wacht'; });
    if (!lijst.length) { doel.innerHTML = '<div class="dr-leeg"><h2>Nog geen gesloten besluiten.</h2><p>Na een menselijke bevestiging verschijnt de keuze hier met reden, rol en tijdstip.</p></div>'; return; }
    doel.innerHTML = '<div class="dr-archief">' + lijst.map(function (x) {
      var b = x.besluit || {}, reden = b.reden || x.reden || 'Geen afzonderlijke beslisreden vastgelegd.';
      return '<button class="dr-archiefkaart" type="button" data-dr-kies="' + veilig(x.id) + '"><span><span class="dr-ey">' + veilig(x.type || 'operations') + ' · ' + veilig(b.label || x.aanvragerLabel || 'menselijke beoordeling') + '</span><h2>' + veilig(x.titel) + '</h2><p>' + veilig(reden) + ' · ' + veilig(datum(x.beslotenAt || b.at || x.at)) + '</p></span><span class="dr-status ' + veilig(x.status) + '">' + veilig(x.status) + '</span></button>';
    }).join('') + '</div>';
  }
  function teken() {
    if (!staat) return;
    if (scherm === 'agenda') gekozenId = w.DecisionRoomAgenda.teken(root, staat, gekozenId) || gekozenId;
    if (scherm === 'afweging') w.DecisionRoomAfweging.teken(root, gekozen(), staat);
    if (scherm === 'besluit') w.DecisionRoomBesluit.teken(root, gekozen(), staat);
    if (scherm === 'archief') archief();
  }
  async function laad() {
    if (!token && !(await persoonlijkToken())) { w.location.href = '/apps/rtgkantoor.html'; return; }
    try {
      staat = await api('state', { huis: huis });
      alle('[data-dr-huis]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.drHuis === huis)); });
      if (gekozenId && !gekozen()) gekozenId = '';
      teken();
      if (!intakeEenmaal && params.get('document')) { intakeEenmaal = true; openIntake(); }
    } catch (e) { root.querySelector('#drAgenda').innerHTML = '<div class="dr-leeg"><h2>Decision Room kon niet laden.</h2><p>' + veilig(e.message) + '</p></div>'; }
  }
  function openIntake() {
    intake.reset();
    intake.elements.titel.value = params.get('titel') || '';
    intake.elements.documentId.value = params.get('document') || '';
    intake.elements.documentTitel.value = params.get('titel') || '';
    intake.elements.projectId.value = params.get('project') || '';
    intake.elements.bronMailId.value = params.get('mail') || '';
    laag.hidden = false; d.body.style.overflow = 'hidden';
    w.setTimeout(function () { intake.elements.titel.focus(); }, 30);
  }
  function sluitIntake() { laag.hidden = true; d.body.style.overflow = ''; }
  root.addEventListener('click', function (e) {
    var knop = e.target.closest('[data-dr-open],[data-dr-kies],[data-dr-nieuw],[data-dr-huis]'); if (!knop) return;
    if (knop.dataset.drNieuw !== undefined) openIntake();
    else if (knop.dataset.drHuis) { huis = knop.dataset.drHuis; gekozenId = ''; laad(); }
    else if (knop.dataset.drKies) { gekozenId = knop.dataset.drKies; open((gekozen() && gekozen().status === 'wacht') ? 'afweging' : 'besluit'); }
    else if (knop.dataset.drOpen) open(knop.dataset.drOpen);
  });
  laag.addEventListener('click', function (e) { if (e.target === laag || e.target.closest('[data-dr-sluit]')) sluitIntake(); });
  intake.addEventListener('submit', async function (e) {
    e.preventDefault(); var knop = e.submitter, fd = new FormData(intake), body = { huis: huis };
    fd.forEach(function (v, k) { body[k] = v; }); body.omkeerbaar = intake.elements.omkeerbaar.checked;
    knop.disabled = true;
    try { var uit = await api('goedkeuring', body); gekozenId = uit.goedkeuring.id; sluitIntake(); await laad(); open('afweging'); melding('Het voorstel staat controleerbaar klaar voor menselijke afweging.'); }
    catch (fout) { melding(fout.message); } finally { knop.disabled = false; }
  });
  root.addEventListener('submit', async function (e) {
    if (e.target.id !== 'drBesluitForm') return; e.preventDefault();
    var fd = new FormData(e.target), reden = String(fd.get('reden') || '').trim();
    if (!reden) { melding('Leg kort vast waarom u deze keuze maakt.'); e.target.elements.reden.focus(); return; }
    var knop = e.submitter; knop.disabled = true;
    try { var uit = await api('goedkeuring/beslis', { id: gekozenId, besluit: fd.get('besluit'), reden: reden, voorwaarde: fd.get('voorwaarde') }); staat.goedkeuringen = staat.goedkeuringen.map(function (x) { return x.id === uit.goedkeuring.id ? uit.goedkeuring : x; }); open('besluit'); melding(uit.goedkeuring.status === 'wacht' ? 'Uw beoordeling staat vast. De volgende bevoegde beoordelaar is nu aan zet.' : 'Het menselijke besluit en de reden zijn vastgelegd.'); }
    catch (fout) { melding(fout.message); } finally { knop.disabled = false; }
  });
  d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !laag.hidden) sluitIntake(); });
  laad();
}(window, document));

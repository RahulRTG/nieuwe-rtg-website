/* HET VOORUITZICHT -- de cockpit van LivingOS.

   Dit scherm begint bewust leeg. Een reis, bedrag, datum, rustscore of
   providerstatus verschijnt pas wanneer een echte bron die informatie geeft.
   Een scenario is herkenbaar als scenario en verandert geen operationele
   status. Bij een netwerkfout blijft lokale invoer staan, maar wordt zij nooit
   als opgeslagen of bevestigd gepresenteerd. */
(function () {
  'use strict';

  var $ = function (s) { return document.querySelector(s); };
  var view = window.RTGLivingView;
  var u = { version: 0, intent: '', state: 'draft', world: 'likely', providers: {}, events: [] };

  function token() {
    try { return localStorage.getItem('rtg_member_token'); } catch (e) { return ''; }
  }

  async function api(pad, body) {
    var r = await fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') },
      body: JSON.stringify(body || {})
    });
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) {
      var fout = new Error(data.error || (r.status === 401 ? 'Log in om dit vooruitzicht te openen.' : 'Deze bron antwoordde niet.'));
      fout.status = r.status;
      fout.data = data;
      throw fout;
    }
    return data;
  }

  function render(x) {
    if (x) u = Object.assign({}, u, x);
    view.render(u);
  }

  async function stuur(type, extra) {
    $('#loSync').textContent = 'Opslaan…';
    try {
      var r = await api('/api/instant-reality/event', Object.assign({
        type: type,
        version: u.version,
        key: type + '-' + Date.now()
      }, extra || {}));
      render(r.universe);
      $('#loSync').textContent = 'Bron bijgewerkt';
      return r.universe;
    } catch (e) {
      if (e.status === 409 && e.data && e.data.universe) render(e.data.universe);
      $('#loSync').textContent = e.status === 401 ? 'Inloggen vereist' : 'Niet opgeslagen · probeer opnieuw';
      return null;
    }
  }

  function action(a) {
    if (a === 'why') $('#loWhy').hidden = !$('#loWhy').hidden;
    else if (a === 'approve' && view.isOpgeslagen()) $('#loDialog').showModal();
    else if (a === 'focus') document.body.classList.toggle('lo-focus');
    else if (a === 'compare') document.body.classList.toggle('lo-compare');
    else if (a === 'edit') $('#loIntent').focus();
  }

  document.querySelectorAll('[data-world]').forEach(function (b) {
    b.onclick = async function () {
      var vorige = u.world || 'likely';
      view.setWorld(b.dataset.world, u);
      var r = await stuur('world.selected', { value: b.dataset.world });
      if (!r) view.setWorld(vorige, u);
    };
  });
  document.querySelectorAll('[data-act]').forEach(function (b) { b.onclick = function () { action(b.dataset.act); }; });
  document.querySelectorAll('[data-link]').forEach(function (b) { b.onclick = function () { location.href = b.dataset.link; }; });
  document.querySelectorAll('.lo-policies button').forEach(function (b) {
    b.onclick = function () {
      var aan = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(aan));
      b.classList.toggle('aan', aan);
      $('#loContext').textContent = 'Conceptregel lokaal gewijzigd. Deze regel is nog niet opgeslagen of toegepast.';
    };
  });

  document.querySelectorAll('.lo-rail nav button').forEach(function (b) {
    b.onclick = function () {
      var v = b.dataset.view;
      document.querySelectorAll('.lo-rail nav button').forEach(function (x) { x.classList.toggle('actief', x === b); });
      document.body.setAttribute('data-view', v);
      document.body.classList.toggle('lo-replay', v === 'evidence');
      var paneel = v === 'intent' ? '.lo-intent' : v === 'decisions' || v === 'evidence' ? '.lo-decisions' : '.lo-worlds';
      if (v === 'evidence') $('#loContext').textContent = (u.events || []).length + ' brongebeurtenis' + ((u.events || []).length === 1 ? '' : 'sen') + ' beschikbaar; ontbrekende gegevens worden niet aangevuld.';
      if (innerWidth > 760) { var el = $(paneel); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }); }
    };
  });

  var timer;
  $('#loIntent').oninput = function (e) {
    clearTimeout(timer);
    view.lokaleWijziging(u);
    timer = setTimeout(async function () {
      var r = await stuur('intent.delta', { value: e.target.value });
      if (!r) view.zetBeschikbaarheid(u, true);
    }, 450);
  };

  async function vrijgeven() {
    var r = await stuur('preparation.authorized');
    if (!r) return;
    $('#loApprove').disabled = true;
    $('#loApprove').textContent = 'Voorbereiding vrijgegeven';
    $('#loContext').textContent = 'Voorbereiding vrijgegeven in de bron. Boeken en betalen blijven geblokkeerd.';
  }
  $('#loApprove').onclick = function () { if (view.isOpgeslagen()) $('#loDialog').showModal(); };
  $('#loDialog').addEventListener('close', function () { if (this.returnValue === 'ok') vrijgeven(); });

  async function vertraag() {
    var r = await stuur('world.selected', { value: 'disruption' });
    if (!r) return;
    view.setWorld('disruption', u);
    document.body.classList.add('lo-disruption');
    $('#loEvent').textContent = 'HYPOTHETISCH SCENARIO';
    $('#loMessage').textContent = 'Een latere aankomst wordt alleen verkend. Er is geen echte reis, boeking of providerstatus gewijzigd.';
  }
  $('#loDelay').onclick = vertraag;

  function ask() {
    var q = $('#loInput').value.trim().toLowerCase();
    if (!q) return;
    $('#loInput').value = '';
    if (/verstoring|vertraging|later|mis/.test(q)) vertraag();
    else if (/ideaal|beste/.test(q)) stuur('world.selected', { value: 'ideal' }).then(function (r) { if (r) view.setWorld('ideal', u); });
    else if (/waarschijnlijk|normaal/.test(q)) stuur('world.selected', { value: 'likely' }).then(function (r) { if (r) view.setWorld('likely', u); });
    else if (/waarom|uitleg/.test(q)) { $('#loWhy').hidden = false; $('#loContext').textContent = 'RTG toont alleen opgeslagen intentie, bronstatus en expliciete scenario’s.'; }
    else if (/terug|spoel|replay/.test(q)) { document.body.classList.add('lo-replay'); $('#loContext').textContent = (u.events || []).length + ' brongebeurtenissen beschikbaar; er is niets bij verzonnen.'; }
    else if (/akkoord|voorbereid|toestemming/.test(q) && view.isOpgeslagen()) $('#loApprove').click();
    else $('#loContext').textContent = 'Deze vraag is niet uitgevoerd. Gebruik een routekeuze of leg eerst uw intentie vast.';
  }
  $('#loSend').onclick = ask;
  $('#loInput').onkeydown = function (e) { if (e.key === 'Enter') ask(); };
  $('#loMouth').onclick = function () { $('#loInput').focus(); };
  if (window.RTGMond) RTGMond.fab($('#loMouth'), 20);

  render(u);
  api('/api/instant-reality').then(function (data) {
    render(data);
    $('#loSync').textContent = 'Bron verbonden';
  }).catch(function (e) {
    $('#loSync').textContent = e.status === 401 ? 'Inloggen vereist' : 'Bron niet bereikbaar';
    $('#loContext').textContent = e.message + ' Lokale invoer wordt niet als opgeslagen getoond.';
  });

  if (window.RTGLivingData) {
    RTGLivingData.laad().then(function (d) {
      if (!d.ingelogd) return;
      var ok = (d.bronnen || []).filter(function (b) { return b.ok; }).length;
      var totaal = (d.bronnen || []).length;
      if (totaal) $('#loContext').textContent = ok + ' van ' + totaal + ' operationele bronnen bereikbaar. Ontbrekende bronnen blijven onbekend.';
    }).catch(function () {});
  }
})();

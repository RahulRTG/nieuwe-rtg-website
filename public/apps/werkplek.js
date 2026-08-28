/* De werkplekcontroller: sessie, huisdeur en API. De zichtbare buitendeur en
   campus wonen in hun eigen bladen, zodat deze laag alleen de waarheid van de
   sessie en het gekozen huis hoeft te bewaken. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  }); };
  var token = null, TAKEN = [], HUISNAAM = '';
  try { token = localStorage.getItem('rtg_office_token') || localStorage.getItem('rtg_member_token'); } catch (e) {}

  function api(pad, body) {
    return fetch('/api/werkplek/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || '') },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (d) {
      if (!r.ok) throw new Error(d.error || 'Er ging iets mis.');
      return d;
    }); });
  }

  function gewenst(naam) {
    try { return new URL(location.href).searchParams.get(naam) || ''; } catch (e) { return ''; }
  }

  function toonDeur(tekst) {
    $('#huis').hidden = true;
    $('#kiezer').hidden = false;
    $('#kiezer').innerHTML = '<section class="campus-landing"><div class="campus-door"><div class="campus-wordmark">' +
      '<span class="campus-seal">RTG</span><div><p>Secure enterprise workspace</p><b>Rahul Group Campus</b></div></div>' +
      '<header><div><span class="campus-kicker">Beveiligde deur</span><h1>Deze campus is gesloten.</h1></div><p>' +
      esc(tekst) + ' Log in via de personeelsingang; daarna keert u terug naar deze kantoorwereld.</p></header>' +
      '<p style="margin-top:1.4rem"><a class="knop" href="/apps/personeel.html?kantoor=1&amp;terug=%2Fapps%2Fwerkplek.html">Naar de personeelsingang</a></p></div></section>';
  }

  function toonKiezer() {
    api('mijn', {}).then(function (d) {
      var lijst = d.bedrijven || [];
      if (!lijst.length) {
        toonDeur('Uw account heeft nog geen sleutel voor RTG of de RTFoundation. Vraag de eigenaar om toegang.');
        return;
      }
      var bedrijf = gewenst('bedrijf');
      if (bedrijf && lijst.some(function (b) { return b.code === bedrijf; })) { openHuis(bedrijf); return; }
      RTGWerkplekLanding.toon(lijst, openHuis);
    }).catch(function (e) { toonDeur(e.message); });
  }

  function openHuis(code) {
    $('#kiezer').innerHTML = '<div class="campus-laden">Campus wordt geopend&hellip;</div>';
    api('overzicht', { bedrijf: code }).then(function (d) {
      TAKEN = d.taken || [];
      HUISNAAM = d.naam || code;
      document.title = d.kort + ' Enterprise Campus';
      RTGWerkplekCampus.open(d, {
        api: api,
        anderHuis: function () {
          try { history.replaceState(null, '', location.pathname); } catch (e) {}
          toonKiezer();
        },
        veranderd: function (model) { TAKEN = model.taken || []; }
      }, gewenst('kantoor'));
    }).catch(function (e) { toonDeur(e.message); });
  }

  var dag = function (w) {
    var d = new Date(w); return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!TAKEN.length) return null;
    return { naam: 'taken-' + (HUISNAAM || 'werkplek').toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      kolommen: ['datum', 'afdeling', 'taak', 'status'],
      rijen: TAKEN.map(function (t) { return [dag(t.at), t.afdeling || 'operations', t.tekst, t.af ? 'af' : 'open']; }) };
  });

  toonKiezer();
})();

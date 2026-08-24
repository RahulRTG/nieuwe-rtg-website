/* RTG Social Control Plane data
   Verbindt de gedeelde systeemlaag met de bestaande sociale graaf, het
   versmallende beleid, de gegronde Rahul en het append-only actielog. */
(function () {
  'use strict';
  var loaded = false;
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var q = function (selector) { return document.querySelector(selector); };
  var esc = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function api(path, body) {
    return fetch(path, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token
    }, body: JSON.stringify(body || {}) }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        if (!response.ok) throw new Error(data.error || 'De sociale laag reageert niet.');
        return data;
      });
    });
  }
  function state(message, error) {
    var el = q('#rtgIntelSystemState');
    if (!el) return;
    el.classList.toggle('is-error', !!error);
    el.innerHTML = '<i></i>' + esc(message);
  }
  function panel(name, focus) {
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-intel-panel]'));
    buttons.forEach(function (button) {
      var active = button.dataset.intelPanel === name;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      var target = q('#' + button.getAttribute('aria-controls'));
      if (target) target.hidden = !active;
      if (active && focus) button.focus();
    });
  }
  function bindTabs() {
    var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-intel-panel]'));
    tabs.forEach(function (button, index) {
      button.addEventListener('click', function () { panel(button.dataset.intelPanel); });
      button.addEventListener('keydown', function (event) {
        if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(event.key) === -1) return;
        event.preventDefault();
        var next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
          (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        panel(tabs[next].dataset.intelPanel, true);
      });
    });
  }
  function renderGraph(data) {
    var count = data.telling || {};
    var values = {
      rtgGraphMoments: count.momenten || 0, rtgGraphMine: count.wachtOpMij || 0,
      rtgGraphToday: count.vandaag || 0, rtgGraphOther: count.wachtOpAnder || 0,
      rtgGraphLate: count.achterstallig || 0, rtgGraphClubs: count.clubs || 0,
      rtgGraphSources: (data.bronnen || []).length
    };
    Object.keys(values).forEach(function (id) { var el = q('#' + id); if (el) el.textContent = values[id]; });
    var missing = data.stil || [];
    var status = q('#rtgGraphState');
    if (status) status.textContent = missing.length ?
      'Onvolledig beeld · niet opgehaald: ' + missing.join(', ') : 'Alle beschikbare sociale bronnen zijn gelezen.';
    var sources = q('#rtgGraphSourceList');
    if (sources) sources.innerHTML = (data.bronnen || []).map(function (source) {
      var down = missing.indexOf(source) !== -1;
      return '<span class="' + (down ? 'is-silent' : '') + '"><i></i>' + esc(source) + '</span>';
    }).join('') || '<span>Geen bronnen beschikbaar.</span>';
  }
  function policySwitch(item, kind) {
    var key = kind === 'knop' ? item.knop : item.soort;
    return '<article class="rtg-policy-row"><div><b>' + esc(item.naam || item.soort) + '</b>' +
      (item.uitleg ? '<p>' + esc(item.uitleg) + '</p>' : '') + '</div><button type="button" role="switch" aria-checked="' +
      String(!!item.aan) + '" data-policy-kind="' + kind + '" data-policy-key="' + esc(key) + '"><i></i><span>' +
      (item.aan ? 'AAN' : 'UIT') + '</span></button></article>';
  }
  function renderPolicy(data) {
    var host = q('#rtgPanelPolicy');
    if (!host) return;
    var bounds = data.horizonGrens || { min: 1, max: 365 };
    host.innerHTML = '<span class="rtg-panel-code">HUMAN AUTHORITY PROTOCOL</span><h3>Bepaal wat in beeld mag komen.</h3>' +
      '<p>Deze regels kunnen de assistentie alleen versmallen. Geen enkele stand laat RTG namens u naar een ander mens handelen.</p>' +
      '<div class="rtg-policy-auto"><i></i><div><b>Automatische verzending bestaat niet</b><span>Voor iedere sociale handeling blijft uw bevestiging verplicht.</span></div></div>' +
      '<div class="rtg-policy-horizon"><label for="rtgPolicyHorizon">Voorstelhorizon <output id="rtgPolicyHorizonValue">' +
      esc(data.horizon) + ' dagen</output></label><input id="rtgPolicyHorizon" type="range" min="' + esc(bounds.min) +
      '" max="' + esc(bounds.max) + '" value="' + esc(data.horizon) + '"><small>Alleen gebeurtenissen binnen dit venster kunnen als voorstel verschijnen.</small></div>' +
      '<div class="rtg-policy-list">' + (data.knoppen || []).map(function (x) { return policySwitch(x, 'knop'); }).join('') +
      (data.soorten || []).map(function (x) { return policySwitch(x, 'soort'); }).join('') + '</div>';
  }
  function renderLog(data) {
    var host = q('#rtgPanelLog');
    if (!host) return;
    var rows = data.log || [];
    host.innerHTML = '<span class="rtg-panel-code">APPEND-ONLY REGISTER</span><h3>Menselijk besluit, aantoonbare reden.</h3>' +
      '<p>Nieuwste eerst. Het register toont wie handelde, waarom en op welke gegevens het besluit rustte.</p><div class="rtg-log-list">' +
      (rows.length ? rows.map(function (row) {
        var date = row.tijd ? new Date(row.tijd).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }) : '';
        return '<article><div><span>' + esc(row.wie === 'lid' ? 'U' : 'RAHUL') + '</span><time>' + esc(date) +
          '</time></div><b>' + esc(row.wat || 'Sociale handeling') + '</b><p>' + esc(row.waarom || 'Geen reden vastgelegd.') +
          '</p>' + ((row.gegevens || []).length ? '<details><summary>Gebruikte gegevens</summary><ul>' + row.gegevens.map(function (x) {
            return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>' : '') + '</article>';
      }).join('') : '<div class="rtg-panel-empty">Nog geen handelingen. Kijken alleen schrijft niets in dit register.</div>') + '</div>';
  }
  function load() {
    if (loaded) return;
    loaded = true;
    if (!token) {
      state('AANMELDEN VEREIST', true);
      var status = q('#rtgGraphState');
      if (status) status.textContent = 'Meld u aan om uw persoonlijke sociale graaf te openen.';
      ['rtgPanelPolicy', 'rtgPanelLog'].forEach(function (id) {
        var el = q('#' + id); if (el) el.innerHTML = '<div class="rtg-panel-empty">Deze persoonlijke laag opent na het aanmelden.</div>';
      });
      return;
    }
    state('SYNCHRONISEREN');
    Promise.all([
      api('/api/sociaal/graaf').then(renderGraph),
      api('/api/sociaal/beleid').then(renderPolicy),
      api('/api/sociaal/actielog').then(renderLog)
    ]).then(function () { state('GROUNDED · HUMAN CONTROL'); })
      .catch(function (error) { state(error.message, true); });
  }
  function bindPolicy() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-policy-kind]');
      if (!button) return;
      button.disabled = true;
      var body = { aan: button.getAttribute('aria-checked') !== 'true' };
      body[button.dataset.policyKind] = button.dataset.policyKey;
      api('/api/sociaal/beleid/zet', body).then(function (data) {
        renderPolicy(data.beleid); state(data.gewijzigd ? 'BELEID VASTGELEGD' : 'BELEID ONGEWIJZIGD');
        return api('/api/sociaal/actielog').then(renderLog);
      }).catch(function (error) { state(error.message, true); button.disabled = false; });
    });
    document.addEventListener('input', function (event) {
      if (event.target.id !== 'rtgPolicyHorizon') return;
      var out = q('#rtgPolicyHorizonValue'); if (out) out.textContent = event.target.value + ' dagen';
    });
    document.addEventListener('change', function (event) {
      if (event.target.id !== 'rtgPolicyHorizon') return;
      api('/api/sociaal/beleid/zet', { horizon: Number(event.target.value) }).then(function (data) {
        renderPolicy(data.beleid); state(data.gewijzigd ? 'HORIZON VASTGELEGD' : 'HORIZON ONGEWIJZIGD');
        return api('/api/sociaal/actielog').then(renderLog);
      }).catch(function (error) { state(error.message, true); });
    });
  }
  function bindRahul() {
    var form = q('#rtgSocialRahulForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var input = q('#rtgSocialRahulQuestion');
      var answer = q('#rtgSocialRahulAnswer');
      var question = input.value.trim();
      if (!token) { answer.hidden = false; answer.textContent = 'Meld u eerst aan.'; return; }
      answer.hidden = false; answer.innerHTML = '<span class="rtg-thinking">SOCIAL GRAPH WORDT GEANALYSEERD…</span>';
      form.querySelector('button').disabled = true;
      api('/api/sociaal/rahul', { vraag: question }).then(function (data) {
        answer.innerHTML = '<b>Rahul</b><p>' + esc(data.antwoord) + '</p><details open><summary>Waarop dit antwoord rust</summary><ul>' +
          (data.gegevens || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></details>';
        state('ANTWOORD GEGROUD');
      }).catch(function (error) { answer.textContent = error.message; state(error.message, true); })
        .finally(function () { form.querySelector('button').disabled = false; });
    });
  }
  function run() {
    if (!q('#rtgIntelDeck')) return;
    bindTabs(); bindPolicy(); bindRahul();
    document.addEventListener('rtg:intel-open', load);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
  else run();
})();

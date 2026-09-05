/* Browserclient van het RTG Experience Kernel. Geen businesslogica: hij toont
   serverprojecties en stuurt actions altijd via preview + Action Broker. */
(function (w, d) {
  'use strict';
  if (w.RTGExperience) return;
  if (d.body && d.body.getAttribute('data-rtg-experience') === 'off') return;
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var world = d.body && d.body.getAttribute('data-rtg-world');

  function api(pad, body) {
    if (!token) return Promise.reject(new Error('Niet ingelogd'));
    return fetch('/api/experience/' + pad, { method: 'POST', headers: {
      'Content-Type': 'application/json', Authorization: 'Bearer ' + token
    }, body: JSON.stringify(body || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'Er ging iets mis.'); return j;
      });
    });
  }
  function element(tag, cls, tekst) {
    var e = d.createElement(tag); if (cls) e.className = cls;
    if (tekst != null) e.textContent = tekst; return e;
  }
  function idem() {
    return w.RTGId('xp');
  }

  var state = { bootstrap: null, actionEvidence: null, dialog: null, trigger: null,
    pending: null, flash: null };
  function statusTekst(p) {
    if (p.completeness.status !== 'COMPLETE') return { text: 'Beeld gedeeltelijk', mobile: '!', level: 'action' };
    if (p.attentionSummary.actionRequired) return { text: p.attentionSummary.actionRequired + ' vraagt actie', mobile: String(p.attentionSummary.actionRequired), level: 'action' };
    if (p.attentionSummary.open) return { text: p.attentionSummary.open + ' voor vandaag', mobile: String(p.attentionSummary.open), level: 'attention' };
    return { text: 'Actueel', mobile: '✓', level: 'quiet' };
  }
  function werkTriggerBij() {
    if (!state.trigger || !state.bootstrap) return;
    var s = statusTekst(state.bootstrap.projection);
    state.trigger.textContent = s.text; state.trigger.dataset.level = s.level;
    state.trigger.dataset.mobile = s.mobile;
    state.trigger.setAttribute('aria-label', s.text + ' · open context en aandacht');
  }
  function bouwDialog() {
    var dlg = element('dialog', 'xp-dialog'); dlg.setAttribute('aria-label', 'Context en aandacht');
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    d.body.appendChild(dlg); state.dialog = dlg; return dlg;
  }
  function tekenDialog() {
    var b = state.bootstrap, p = b.projection, dlg = state.dialog || bouwDialog();
    dlg.replaceChildren();
    var head = element('div', 'xp-head'), kop = element('div');
    kop.appendChild(element('small', '', b.manifests[b.currentWorld].name.toUpperCase()));
    kop.appendChild(element('h2', '', 'Wat nu aandacht vraagt'));
    head.appendChild(kop);
    var sluit = element('button', 'xp-close', '×'); sluit.type = 'button'; sluit.setAttribute('aria-label', 'Sluiten');
    sluit.addEventListener('click', function () { dlg.close(); }); head.appendChild(sluit); dlg.appendChild(head);

    var context = element('div', 'xp-context'); context.appendChild(element('label', '', 'Context'));
    var keuze = element('select');
    b.contexts.forEach(function (c) { var o = element('option', '', c.label); o.value = c.id;
      o.selected = c.id === b.currentContext.id; keuze.appendChild(o); });
    keuze.disabled = b.contexts.length < 2;
    keuze.addEventListener('change', function () { laad(keuze.value).then(function () { tekenDialog(); }); });
    context.appendChild(keuze); dlg.appendChild(context);
    if (state.flash) { var flash = element('p', 'xp-flash', state.flash); flash.setAttribute('role', 'status');
      dlg.appendChild(flash); state.flash = null; }

    var lijst = element('div', 'xp-list');
    /* ACKNOWLEDGED blijft als bewijs in de projectie bestaan, maar is geen
       open aandacht meer. Het paneel is een werkvoorraad, geen auditlog. */
    var openAandacht = p.attention.filter(function (a) { return a.lifecycle !== 'ACKNOWLEDGED'; });
    if (!openAandacht.length) lijst.appendChild(element('p', 'xp-empty', 'Er vraagt op dit moment niets om uw aandacht.'));
    openAandacht.forEach(function (a) {
      var rij = element('article', 'xp-item'), tekst = element('div');
      tekst.appendChild(element('div', 'xp-severity', a.severity === 'ACTION_REQUIRED' ? 'Actie nodig' : 'Voor vandaag'));
      tekst.appendChild(element('b', '', a.title));
      if (a.explanation) tekst.appendChild(element('p', '', a.explanation));
      rij.appendChild(tekst);
      var knop = element('button', 'xp-action', 'Gezien');
      knop.type = 'button';
      knop.addEventListener('click', function () { bevestig(a, knop); });
      rij.appendChild(knop); lijst.appendChild(rij);
    });
    dlg.appendChild(lijst);
    if (w.RTGExperienceActions) w.RTGExperienceActions.render(dlg, {
      bootstrap: b, actionEvidence: state.actionEvidence, api: api, idem: idem,
      done: function (message) { state.flash = message; state.pending = null;
        laad(state.bootstrap.currentContext.id).then(tekenDialog); }
    });
    var meta = element('div', 'xp-meta');
    meta.dataset.partial = p.completeness.status === 'COMPLETE' ? '0' : '1';
    meta.textContent = p.completeness.status === 'COMPLETE'
      ? 'Live samengesteld uit ' + p.provenance.sources.length + ' domeinbronnen · RTG bezit hier geen tweede kopie.'
      : 'Onvolledig beeld · bron niet beschikbaar: ' + p.completeness.missingSources.join(', ');
    dlg.appendChild(meta);
  }
  function bevestig(a, knop) {
    if (!state.pending || state.pending.attentionId !== a.id) {
      knop.disabled = true;
      api('intent/preview', { intent: 'attention.acknowledge', version: 1,
        contextId: state.bootstrap.currentContext.id,
        parameters: { world: state.bootstrap.currentWorld, attentionId: a.id }
      }).then(function (r) {
        state.pending = { attentionId: a.id, previewId: r.preview.id, idem: idem() };
        knop.disabled = false; knop.dataset.confirm = '1'; knop.textContent = 'Bevestig gezien';
      }).catch(function (e) { knop.disabled = false; knop.textContent = e.message; });
      return;
    }
    knop.disabled = true; knop.textContent = 'Vastleggen…';
    api('intent/execute', { previewId: state.pending.previewId,
      idempotencyKey: state.pending.idem, confirmed: true }).then(function () {
      state.pending = null; return laad(state.bootstrap.currentContext.id);
    }).then(function () { tekenDialog(); }).catch(function (e) { knop.disabled = false; knop.textContent = e.message; });
  }
  function bewaarResume() {
    if (!state.bootstrap) return;
    api('resume', { world: state.bootstrap.currentWorld, contextId: state.bootstrap.currentContext.id,
      surface: location.pathname + location.search }).catch(function () {});
  }
  function laad(contextId) {
    return api('bootstrap', { world: world, contextId: contextId }).then(function (b) {
      state.bootstrap = b; werkTriggerBij();
      return api('evidence', { limit: 5 }).then(function (e) { state.actionEvidence = e; return b; },
        function () { state.actionEvidence = null; return b; });
    });
  }
  function start() {
    if (!token || !world) return;
    var links = d.querySelector('.os-switcher__links'), actief = links && links.querySelector('[aria-current="page"]');
    /* Op een telefoon blijft de huidige wereld volledig in beeld; de andere
       werelden blijven horizontaal bereikbaar. */
    if (links && actief && w.matchMedia && w.matchMedia('(max-width:760px)').matches) {
      var ankerWereld = function () {
        var vak = links.getBoundingClientRect(), plek = actief.getBoundingClientRect();
        if (plek.right > vak.right) links.scrollLeft += plek.right - vak.right;
        else if (plek.left < vak.left) links.scrollLeft -= vak.left - plek.left;
      };
      w.requestAnimationFrame(ankerWereld);
      w.addEventListener('load', ankerWereld, { once: true });
    }
    var oud = d.querySelector('.os-switcher__state');
    if (oud) {
      var knop = element('button', oud.className + ' xp-trigger', 'Verbinden…'); knop.type = 'button';
      knop.addEventListener('click', function () { tekenDialog();
        if (state.dialog.showModal) state.dialog.showModal(); else state.dialog.setAttribute('open', ''); });
      oud.replaceWith(knop); state.trigger = knop;
    }
    laad().catch(function () { if (state.trigger) state.trigger.textContent = 'Niet verbonden'; });
    w.addEventListener('pagehide', bewaarResume);
  }

  w.RTGExperience = { api: api, bootstrap: function () { return state.bootstrap; },
    reload: laad, preview: function (x) { return api('intent/preview', x); },
    execute: function (x) { return api('intent/execute', x); } };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})(window, document);

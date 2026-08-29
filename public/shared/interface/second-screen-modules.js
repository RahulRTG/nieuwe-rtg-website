/* De inhoud van RTG Second Screen. Alleen echte bronnen of een eerlijke lege
   stand: profiel, berichten, levende context en bestaande RTG-deuren. De
   toestandsmachine en persoonlijke ordening staan in second-screen.js. */
(function (w, d) {
  'use strict';
  var IDS = ['profile', 'context', 'messages', 'navigation', 'doors'];

  function el(tag, cls, text) {
    var n = d.createElement(tag); if (cls) n.className = cls;
    if (text != null) n.textContent = text; return n;
  }
  function button(text, cls, action) {
    var n = el('button', cls, text); n.type = 'button';
    if (action) n.dataset.ssAction = action; return n;
  }
  function post(url, signal) {
    var token = '';
    try { token = w.localStorage.getItem('rtg_member_token') || ''; } catch (e) {}
    if (!token) return Promise.reject(new Error('signed-out'));
    return w.fetch(url, { method: 'POST', credentials: 'same-origin', signal: signal,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: '{}' })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'request-failed'); return j;
      }); });
  }
  function maakModule(id, title) {
    var vak = el('section', 'rtg-ss-module'); vak.dataset.ssModule = id;
    var kop = el('div', 'rtg-ss-module-head'); kop.appendChild(el('h3', '', title));
    var regie = el('div', 'rtg-ss-module-controls');
    [['Omhoog','up'],['Omlaag','down'],['Verberg','hide']].forEach(function (x) {
      var b = button(x[0], '', x[1]); b.setAttribute('aria-label', title + ' ' + x[0].toLowerCase()); regie.appendChild(b);
    });
    kop.appendChild(regie); vak.appendChild(kop); return vak;
  }
  function initialen(u) {
    var t = u.full || u.name || u.codename || u.email || '';
    return t.split(/\s+/).filter(Boolean).slice(0, 2).map(function (x) { return x.charAt(0); }).join('').toUpperCase() || 'RTG';
  }
  function tijd(at) {
    if (!at) return '';
    try { return new Date(at).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; }
  }

  w.RTGInterfaceSecondScreenModules = function (o) {
    var dead = false, stop = typeof AbortController === 'function' ? new AbortController() : null, afContext = null;
    var profile = maakModule('profile', 'Profiel'), profileBody = el('div', 'rtg-ss-profile');
    profileBody.appendChild(el('p', 'rtg-ss-quiet', 'Profiel laden…')); profile.appendChild(profileBody);
    var context = maakModule('context', 'Nu relevant'), contextBody = el('div', 'rtg-ss-context');
    contextBody.appendChild(el('p', 'rtg-ss-quiet', 'Context wordt bepaald…')); context.appendChild(contextBody);
    var messages = maakModule('messages', 'Berichten'), messagesBody = el('div', 'rtg-ss-messages');
    messagesBody.appendChild(el('p', 'rtg-ss-quiet', 'Berichten laden…')); messages.appendChild(messagesBody);
    var navigation = maakModule('navigation', 'Werelden');
    navigation.appendChild(o.nav || el('p', 'rtg-ss-quiet', 'Navigatie niet beschikbaar.'));
    var doors = maakModule('doors', 'Direct openen'), grid = el('div', 'rtg-ss-doors');
    [['Contacten','/apps/comm.html'],['Dashboard','/apps/pulse.html'],
      ['Reizen','/apps/reizen.html#reizen'],['RTG Veilig','/apps/veilig.html']].forEach(function (x) {
      var b = button(x[0], 'rtg-ss-door'); b.dataset.ssUrl = x[1]; grid.appendChild(b);
    });
    doors.appendChild(grid);
    var byId = { profile: profile, context: context, messages: messages, navigation: navigation, doors: doors };

    function profiel() {
      post('/api/auth/me', stop && stop.signal).then(function (j) {
        if (dead || !j.user) return; var u = j.user; profileBody.textContent = '';
        profileBody.appendChild(el('span', 'rtg-ss-avatar', initialen(u)));
        var tekst = el('div', 'rtg-ss-profile-copy');
        tekst.appendChild(el('strong', '', u.full || u.name || u.codename || 'RTG-lid'));
        var sub = [u.codename, u.tier].filter(Boolean).join(' · '); if (sub) tekst.appendChild(el('span', '', sub));
        if (u.emailVerified === true) tekst.appendChild(el('span', 'rtg-ss-ok', 'Profiel geverifieerd'));
        profileBody.appendChild(tekst);
      }).catch(function (e) { if (!dead && e.name !== 'AbortError') { profileBody.textContent = ''; profileBody.appendChild(el('p', 'rtg-ss-quiet', 'Profielstatus niet beschikbaar.')); } });
    }
    function inbox() {
      post('/api/comm/inbox', stop && stop.signal).then(function (j) {
        if (dead) return; var lijst = Array.isArray(j.gesprekken) ? j.gesprekken.slice(0, 3) : [];
        messagesBody.textContent = '';
        if (!lijst.length) messagesBody.appendChild(el('p', 'rtg-ss-quiet', 'Nog geen gesprekken.'));
        lijst.forEach(function (x) {
          var b = button('', 'rtg-ss-message'); b.dataset.ssUrl = x.link || '/apps/comm.html';
          b.appendChild(el('strong', '', x.titel || 'Gesprek'));
          if (x.laatste) b.appendChild(el('span', '', x.laatste));
          var meta = [tijd(x.at), x.ongelezen ? x.ongelezen + ' ongelezen' : ''].filter(Boolean).join(' · ');
          if (meta) b.appendChild(el('small', '', meta)); messagesBody.appendChild(b);
        });
        var alles = button('Alle berichten', 'rtg-ss-more'); alles.dataset.ssUrl = '/apps/comm.html'; messagesBody.appendChild(alles);
      }).catch(function (e) { if (!dead && e.name !== 'AbortError') { messagesBody.textContent = ''; messagesBody.appendChild(el('p', 'rtg-ss-quiet', 'Berichten niet beschikbaar.')); } });
    }
    function contextNu(ctx) {
      if (dead) return; contextBody.textContent = '';
      if (ctx && ctx.titel) contextBody.appendChild(el('strong', '', ctx.titel));
      var A = w.RTGAdaptief, items = A && A.voorNu ? A.voorNu() : [];
      (Array.isArray(items) ? items : []).slice(0, 4).forEach(function (x) {
        if (!x || !(x.label || x.naam)) return;
        var b = button(x.label || x.naam, 'rtg-ss-context-action'); b.dataset.ssContextId = x.id; contextBody.appendChild(b);
      });
      if (!contextBody.childNodes.length) contextBody.appendChild(el('p', 'rtg-ss-quiet', 'Geen actuele context.'));
    }
    function handel(target) {
      var url = target && target.dataset && target.dataset.ssUrl;
      if (url) { o.open(url, (target.querySelector('strong') || target).textContent.trim()); return true; }
      var id = target && target.dataset && target.dataset.ssContextId, A = w.RTGAdaptief;
      if (id && A && A.doe) { A.doe(id); return true; } return false;
    }
    function laad() { profiel(); inbox(); contextNu(w.RTGAdaptief && w.RTGAdaptief.context()); }
    laad(); if (w.RTGAdaptief && w.RTGAdaptief.opContext) afContext = w.RTGAdaptief.opContext(contextNu);
    return { ids: IDS.slice(), byId: byId, handel: handel, refresh: laad,
      destroy: function () { dead = true; if (stop) stop.abort(); if (afContext) afContext(); } };
  };
})(window, document);

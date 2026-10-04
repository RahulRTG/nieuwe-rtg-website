/* Editorial projection only. Domain screens retain their requests, rights and
   actions. No sample trips, appointments, people or independent navigation. */
(function (w, d) {
  'use strict';
  var C = w.RTGWorldHomeCopy, text = C.text, value = C.value, put = C.put, date = C.date;
  var travelState = null, workState = null;
  function travel(reizen, state) {
    travelState = [reizen, state];
    var first = state === 'ready' && reizen && reizen[0], title = d.getElementById('worldTravelTitle');
    if (!title) return;
    d.body.dataset.worldHomeState = state;
    put('worldTravelTitle', 'travelTitle');
    put('worldTravelMessage', first ? 'travelReady' : state === 'loading' ? 'loading' : state === 'guest' ? 'travelGuest' : state === 'error' ? 'travelError' : 'travelEmpty');
    var detail = d.getElementById('worldTravelDetail');
    detail.hidden = !first;
    // A picture never supplies a destination, date, traveller count or status.
    detail.textContent = '';
    if (first) {
      var name = d.createElement('strong'); name.setAttribute('translate', 'no'); name.textContent = first.bestemming || ''; detail.appendChild(name);
      var period = first.venster || {}, dates = [date(period.van), period.tot !== period.van ? date(period.tot) : ''].filter(Boolean).join(' - ');
      var when = d.createElement('span'); when.setAttribute('translate', 'no'); when.textContent = dates; detail.appendChild(when);
    }
    var action = d.getElementById('worldTravelAction');
    action.href = state === 'guest' ? '/apps/app.html' : first ? '#reizen' : '/apps/reisbureau.html';
    action.innerHTML = text(state === 'guest' ? 'signIn' : first ? 'openTrip' : 'planTrip') + '<span aria-hidden="true">↗</span>';
  }
  function work(data, state) {
    workState = [data, state];
    var hour = new Date().getHours(); put('worldWorkGreeting', hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening');
    var host = d.getElementById('worldWorkState'); if (!host) return;
    var rows = data && data.regels || [], partial = !!(data && data.stil && data.stil.length);
    d.body.dataset.worldHomeState = state;
    host.hidden = state === 'ready' && rows.length > 0 && !partial;
    host.innerHTML = text(state === 'guest' ? 'workGuest' : state === 'error' ? 'workError' : state === 'loading' ? 'loading' : partial ? 'workPartial' : 'workEmpty');
    var login = d.getElementById('worldWorkLogin'); if (login) login.hidden = state !== 'guest';
  }
  function foundation(host) {
    host.innerHTML = '<div class="wh-foundation-hero wh-photo"><img src="/images/world-homes/foundation.webp" alt="" width="1408" height="1056" fetchpriority="high">'
      + '<div class="wh-foundation-label"><p class="wh-eyebrow">' + text('foundationEyebrow') + '</p><p class="wh-free">' + text('free') + '</p></div><div class="wh-photo-copy"><h1>' + text('grow') + '</h1><p>' + text('foundationIntro') + '</p></div><span class="wh-caption">' + text('atmosphere') + '</span></div>'
      + '<section class="wh-discover" aria-label="FoundationOS"><div class="wh-pair">'
      + '<a class="wh-card wh-paper-card" href="/apps/foundation/leren.html"><span class="wh-card-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 5v15M12 5C8 2 4 3 2 4v15c3-1 7-1 10 1 3-2 7-2 10-1V4c-2-1-6-2-10 1Z"/></svg></span><div><h3>' + text('learn') + '</h3><p>' + text('learnIntro') + '</p></div><span class="wh-card-arrow" aria-hidden="true">›</span></a>'
      + '<a class="wh-card wh-paper-card" href="/apps/foundation/vrienden.html"><span class="wh-card-symbol" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M16 4a3 3 0 0 1 0 6m2 3a5 5 0 0 1 4 5v3"/></svg></span><div><h3>' + text('circle') + '</h3><p>' + text('circleIntro') + '</p></div><span class="wh-card-arrow" aria-hidden="true">›</span></a></div></section>'
      + '<a class="wh-support wh-support-compact" href="/apps/foundation/hulpwijzer.html"><span>' + text('possibilities') + '</span><span aria-hidden="true">›</span></a>';
  }
  function openFragment() {
    var el = d.getElementById(location.hash.slice(1));
    var details = el && el.closest('details');
    if (details) details.open = true;
  }
  w.addEventListener('hashchange', openFragment);
  function start() {
    openFragment();
    d.querySelectorAll('[data-wh-copy]').forEach(function (el) { el.innerHTML = text(el.dataset.whCopy); });
    d.querySelectorAll('[data-wh-foundation]').forEach(foundation);
    if (d.body.dataset.worldHome === 'travel' && !travelState) travel([], 'loading');
    if (d.body.dataset.worldHome === 'work' && !workState) work(null, 'loading');
  }
  // Language changes only reproject text; no form, session or request is reset.
  w.addEventListener('rtglang', function () {
    if (travelState) travel.apply(null, travelState);
    if (workState) work.apply(null, workState);
  });
  w.RTGWorldHome = { travel: travel, work: work, text: text, value: value, date: date };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})(window, document);

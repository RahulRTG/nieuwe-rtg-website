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
      + '<p class="wh-free">' + text('free') + '</p><div class="wh-photo-copy"><h1>' + text('grow') + '</h1><p>' + text('foundationIntro') + '</p></div><span class="wh-caption">' + text('atmosphere') + '</span></div>'
      + '<section class="wh-discover"><h2>' + text('discover') + '</h2><p>' + text('choose') + '</p><div class="wh-pair">'
      + '<a class="wh-card" href="/apps/foundation/leren.html"><img src="/images/world-homes/foundation.webp" width="1408" height="1056" alt="" loading="lazy"><div><h3>' + text('learn') + '</h3><p>' + text('learnIntro') + '</p><span aria-hidden="true">↗</span></div></a>'
      + '<a class="wh-card" href="/apps/foundation/meedoen-ontdekken.html"><img src="/images/worlds/heritage/foundation-meedoen-atelier-v1.jpg" width="1024" height="1024" alt="" loading="lazy"><div><h3>' + text('talent') + '</h3><p>' + text('talentIntro') + '</p><span aria-hidden="true">↗</span></div></a></div></section>'
      + '<a class="wh-support" href="/apps/foundation/hulpwijzer.html"><div><h2>' + text('support') + '</h2><p>' + text('supportIntro') + '</p><span class="wh-link">' + text('possibilities') + ' <span aria-hidden="true">↗</span></span></div></a>';
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

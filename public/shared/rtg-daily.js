/* A room's presentation follows the owner's confirmed state. No sample data,
   storage, model calls or independent navigation lives in this layer. */
(function (w, d) {
  'use strict';
  var C = w.RTGDailyCopy, last = '', retry;
  var targets = { pulse: 'dailyCompose', agenda: 'nieuwBtn', bestanden: 'kies', notities: 'nieuwNotitie' };
  function button(key, target, secondary) {
    return '<button type="button" class="daily-action' + (secondary ? ' daily-secondary ds-dag-secundair' : '') + ' ds-knop ds-dag-actie" data-daily-target="' + target + '">'
      + C.text(key) + (secondary ? '' : '<span aria-hidden="true">→</span>') + '</button>';
  }
  function render(kind, state, options) {
    options = options || {}; retry = options.retry || retry;
    var host = d.getElementById('dailyIntro'); if (!host) return;
    d.body.dataset.dailyState = state;
    if (state === 'guest') d.querySelectorAll('[data-rtg-edge-bar]').forEach(function (bar) {
      (bar.matches('button') ? [bar] : bar.querySelectorAll('button')).forEach(function (b) { b.disabled = true; });
    });
    var signature = [kind, state, options.title || '', d.documentElement.lang].join('|');
    if (last === signature) return; last = signature;
    var empty = state === 'empty' || state === 'guest', label = kind + 'Label';
    if (!empty && kind === 'bestanden') label = 'archiveLabel';
    if (!empty && kind === 'notities') label = 'notebook';
    var title = options.title ? '<span translate="no">' + C.esc(options.title) + '</span>' : C.text(kind + (empty ? 'Title' : 'Ready'));
    var photo = empty ? '<img class="daily-photo ds-dag-daily-photo" src="' + ('/images/daily/' + kind + '.webp') + '" width="1088" height="1456" alt="" fetchpriority="high">' : '';
    host.innerHTML = '<div class="daily-hero ds-dag-daily-hero">' + photo + '<div class="daily-heading ds-dag-daily-heading"><p class="daily-eyebrow ds-dag-daily-eyebrow">' + C.text(label)
      + '</p><h1>' + title + '</h1></div>' + (photo ? '<p class="daily-caption ds-dag-daily-caption">' + C.text('atmosphere') + '</p>' : '') + '</div>';
    if (state === 'loading') host.innerHTML += '<p class="daily-message ds-dag-daily-message" role="status">' + C.text('loading') + '</p>';
    else if (state === 'error') host.innerHTML += '<div class="daily-copy ds-dag-daily-copy" role="status"><p>' + C.text('failed') + '</p>' + button('retry', 'retry') + '</div>';
    else if (empty) {
      var h = '<div class="daily-copy ds-dag-daily-copy"><p class="daily-intro ds-dag-daily-intro">' + C.text(state === 'guest' ? 'guest' : kind + 'Intro') + '</p>';
      if (state === 'guest') h += '<a class="daily-action ds-knop ds-dag-actie" href="/apps/app.html">' + C.text('login') + '<span aria-hidden="true">→</span></a>';
      else {
        h += button(kind + 'Action', targets[kind]);
        if (kind === 'pulse') h += button('discover', 'dailyDiscover', true);
        if (kind === 'bestanden') h += button('folder', 'nieuwMap', true);
        h += '<p class="daily-note ds-dag-daily-note">' + C.text(kind + 'Note') + '</p>';
      }
      host.innerHTML += h + '</div>';
    }
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-daily-target]'); if (!b) return;
    if (b.dataset.dailyTarget === 'retry') { if (retry) retry(); return; }
    var target = d.getElementById(b.dataset.dailyTarget);
    if (target && !target.disabled) target.click();
  });
  d.addEventListener('DOMContentLoaded', function () {
    if (!w.RTGUitvoer) return;
    var host = d.createElement('div'); host.id = 'dailyExport';
    host.setAttribute('data-rtg-edge-bar', ''); d.body.appendChild(host);
    w.RTGUitvoer.mount(host, null);
  }, { once: true });
  w.RTGDaily = { render: render, action: button };
  render(d.body.dataset.rtgDaily, 'loading');
})(window, document);

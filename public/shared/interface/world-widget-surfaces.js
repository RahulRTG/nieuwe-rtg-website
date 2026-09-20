/* Native compact surfaces. Each visual is driven by its domain's records;
   no decorative chart is presented as a personal measurement. */
(function (w, d) {
  'use strict';
  w.RTGWidgetSurfaces = function (app, root, o) {
    var U = w.RTGDesktopUI, T = w.RTGWidgetCopy;
    function text(tag, cls, value) { var n = U.el(tag, cls, value); n.dataset.userContent = ''; return n; }
    function copy(tag, cls, key) { var n = U.el(tag, cls, T(key)); n.dataset.i18n = 'widget.' + key; return n; }
    function button(key, fn, cls) { var b = copy('button', cls || 'wd-primary', key); b.type = 'button'; b.onclick = fn; return b; }
    function open(key) { return button(key || 'open', o.open); }
    function date(value, opt) { var x = new Date(String(value).length === 10 ? value + 'T12:00:00' : value);
      return Number.isNaN(x.getTime()) ? '' : new Intl.DateTimeFormat(d.documentElement.lang || 'nl', opt || { day: 'numeric', month: 'short' }).format(x); }
    function row(title, sub, glyph) { var n = U.el('div', 'wd-data-row'); n.appendChild(U.icon(glyph || app.icon));
      var body = U.el('div'); body.appendChild(text('strong', '', title)); if (sub) body.appendChild(text('span', 'wd-muted', sub)); n.appendChild(body); root.appendChild(n); return n; }
    function photo(url) { var f = U.el('figure', 'wd-widget-photo'), im = U.el('img'); im.src = url; im.alt = ''; im.loading = 'lazy';
      f.appendChild(im); f.appendChild(copy('figcaption', '', 'atmosphere')); root.appendChild(f); }
    function empty(key) { root.appendChild(copy('p', 'wd-widget-empty', key || 'empty')); }
    function array(j, key) { if (!Array.isArray(j[key])) throw new Error('invalid-widget-data'); return j[key]; }
    function calendar(j) {
      var items = array(j, 'items').concat(j.ecosysteem || []).slice().sort(function (a, b) {
        return String(a.datum + (a.tijd || '')).localeCompare(String(b.datum + (b.tijd || ''))); });
      var first = items[0];
      if (first) { var hero = U.el('div', 'wd-date-hero'), tile = U.el('time', 'wd-date-tile'); tile.dateTime = first.datum;
        tile.appendChild(text('b', '', date(first.datum, { day: 'numeric' }))); tile.appendChild(text('span', '', date(first.datum, { month: 'short' })));
        hero.appendChild(tile); var info = U.el('div'); info.appendChild(text('strong', '', first.tijd || date(first.datum, { weekday: 'long' })));
        info.appendChild(text('p', '', first.titel)); if (first.locatie) info.appendChild(text('small', '', first.locatie)); hero.appendChild(info); root.appendChild(hero);
        items.slice(1, 3).forEach(function (x) { row(x.titel, [date(x.datum), x.tijd].filter(Boolean).join(' · '), 'calendar'); });
      } else empty('calendarEmpty');
      var nav = U.el('div', 'wd-date-nav'); var prev = button('previous', function () { o.offset(-7); }, 'wd-text-button'); prev.disabled = o.days() === 0;
      nav.appendChild(prev); var next = button('next', function () { o.offset(7); }, 'wd-text-button'); next.disabled = o.days() >= 28; nav.appendChild(next);
      root.appendChild(nav); root.appendChild(open('calendar'));
    }
    function notes(j) {
      var notes = array(j, 'eigen').concat(j.gedeeld || []).filter(function (n) { return !n.archief; }), count = 0;
      notes.forEach(function (n) { if (count >= 3) return;
        if (n.soort !== 'lijst') { row(n.titel, String(n.tekst || '').slice(0, 90), 'doc'); count++; return; }
        (n.items || []).forEach(function (item, index) { if (count++ >= 3) return;
          var label = U.el('label', 'wd-task'), input = U.el('input'); input.type = 'checkbox'; input.checked = item.af === true;
          input.dataset.taskId = n.id; input.dataset.taskIndex = String(index);
          label.appendChild(input); label.appendChild(text('span', '', item.t)); root.appendChild(label);
          input.onchange = function () {
            var desired = input.checked; input.checked = !desired; input.disabled = true;
            o.run('desktop.task.check', { id: n.id, index: index, af: desired }).then(function () {
              input.checked = desired; o.changed('notities');
            }).catch(function () { var warning = copy('p', 'wd-widget-warning', 'taskError'); warning.setAttribute('role', 'alert'); root.appendChild(warning); })
              .finally(function () { input.disabled = false; });
          };
        });
      });
      if (!notes.length) empty('notesEmpty'); root.appendChild(button('newTask', function () { o.open('newList'); }));
    }
    function travel(j) {
      var trips = array(j, 'reizen'); photo('/images/world-homes/travel.webp');
      if (trips.length) { var x = trips[0], dates = x.venster || x; row(x.bestemming || x.titel || x.naam,
        dates.van ? [date(dates.van), date(dates.tot)].filter(Boolean).join(' - ') : '', 'plane'); }
      else empty('tripEmpty'); root.appendChild(open('trip'));
    }
    function people(j) {
      var people = app.id === 'comm' ? array(j, 'gesprekken') : array(j, 'relaties');
      people.slice(0, 2).forEach(function (p) { var r = row(p.naam || p.titel, p.band || p.laatste || '', 'people');
        var avatar = U.el('span', 'wd-avatar', String(p.naam || p.titel || '').slice(0, 1)); r.replaceChild(avatar, r.firstChild); });
      if (!people.length) empty(); root.appendChild(open());
    }
    function money(j) {
      if (!Number.isFinite(j.saldo)) throw new Error('invalid-balance');
      var n = U.el('div', 'wd-money'); n.appendChild(copy('span', 'wd-muted', 'balance'));
      var amount = text('strong', '', '••••'); amount.translate = false; n.appendChild(amount); root.appendChild(n);
      var shown = false, toggle = button('show', function () { shown = !shown;
        amount.textContent = shown ? new Intl.NumberFormat(d.documentElement.lang || 'nl', { style: 'currency', currency: 'EUR' }).format(j.saldo / 100) : '••••';
        toggle.textContent = T(shown ? 'hide' : 'show'); toggle.setAttribute('aria-pressed', String(shown)); }, 'wd-text-button');
      toggle.setAttribute('aria-pressed', 'false'); root.appendChild(toggle); root.appendChild(open());
    }
    function documents(j) { var files = array(j, 'items').filter(function (x) { return !x.weg && !x.verwijderd; });
      files.slice(0, 3).forEach(function (x) { row(x.naam, x.gewijzigd ? date(x.gewijzigd) : '', 'doc'); });
      if (!files.length) { root.appendChild(U.icon('doc')); empty('filesEmpty'); } root.appendChild(open('documents')); }
    function render(j) {
      root.textContent = '';
      if (app.id === 'agenda' || app.id === 'foundation-agenda') calendar(j);
      else if (app.id === 'notities') notes(j);
      else if (app.id === 'reizen' || app.id === 'reisboek') travel(j);
      else if (app.id === 'attenties' || app.id === 'comm') people(j);
      else if (app.id === 'geld') money(j);
      else if (app.id === 'mijn-isolatie') {
        var stand = j.effectief;
        if (!stand || !['normaal', 'waakzaam', 'beperkt', 'isolatie'].includes(stand.trede)) throw new Error('invalid-protection');
        var emblem = U.el('div', 'wd-security'); emblem.appendChild(U.icon('shield')); root.appendChild(emblem);
        root.appendChild(copy('p', '', 'protection.' + (stand.beschermd && stand.trede === 'normaal' ? 'beschermd' : stand.trede)));
        if (stand.beschermd && stand.trede !== 'normaal') root.appendChild(copy('p', '', 'protection.beschermd'));
        root.appendChild(open('account'));
      }
      else if (app.id === 'bestanden') documents(j);
      else if (app.id === 'verificatie') { if (!j.user) throw new Error('invalid-profile');
        var shield = U.el('div', 'wd-security'); shield.appendChild(U.icon('shield')); root.appendChild(shield);
        root.appendChild(copy('p', '', j.user.emailVerified === true ? 'verified' : 'unverified')); root.appendChild(open('account')); }
      else if (app.id === 'foodcourt' || app.id === 'table') { photo('/images/world-homes/living.webp');
        var list = array(j, app.id === 'table' ? 'events' : 'restaurants');
        list.slice(0, 2).forEach(function (x) { row(x.naam, [x.stad || x.locatie, x.keuken || x.datum].filter(Boolean).join(' · ')); });
        if (!list.length) empty(); root.appendChild(open('restaurants')); }
      else if (app.id === 'training') { root.appendChild(copy('p', 'wd-muted', 'health'));
        var today = array(j, 'vandaagOpSchema'); today.slice(0, 3).forEach(function (x) { row(x.naam, x.duurMin ? x.duurMin + ' min' : '', 'heart'); });
        if (!today.length) empty('noHealth'); root.appendChild(open()); }
      else if (app.id === 'veilig') { if (!j.wachten || !Array.isArray(j.wachten.lopend)) throw new Error('invalid-safety');
        root.appendChild(U.icon('shield')); j.wachten.lopend.slice(0, 3).forEach(function (x) { row(x.label || x.soort, '', 'shield'); });
        if (!j.wachten.lopend.length) empty('safeEmpty'); root.appendChild(open()); }
      else if (app.id === 'kantoor') { var rows = array(j, 'regels'); rows.slice(0, 3).forEach(function (x) { row(x.titel || x.naam, x.datum || '', 'doc'); });
        if (!rows.length) empty(); root.appendChild(open()); }
      else if (app.id === 'foundation-leren') { var lessons = array(j, 'stukken');
        lessons.slice(0, 3).forEach(function (x) { row(x.naam, x.waarom || x.vak, 'school'); });
        if (!lessons.length) empty(); root.appendChild(open()); }
      else if (app.id === 'foundation-schrijven') { var writing = array(j, 'schrijfsels');
        writing.slice(0, 3).forEach(function (x) { row(x.opdracht, x.at ? date(x.at) : '', 'doc'); });
        if (!writing.length) empty(); root.appendChild(open()); }
      if (Array.isArray(j.stil) && j.stil.length) root.appendChild(copy('p', 'wd-widget-warning', 'partial'));
    }
    return { render: render, empty: empty, button: button, photo: photo, open: open, row: row, copy: copy };
  };
})(window, document);

/* Compact legacy surfaces: actual app subjects, no invented account records.
   Opening projects the existing app, including its own access checks. */
(function (w, d) {
  'use strict';
  w.RTGDesktopCards = function (o) {
    var U = w.RTGDesktopUI, index = 0, query = '', limit = 9, selected = o.defaults.slice(), changed = 0;
    var surfaces = [], favoriteSurfaces = [], onlyFavorites = false, views = Object.create(null);
    var priority = {
      living: ['agenda', 'foodcourt', 'attenties', 'mijn-isolatie', 'geld', 'training', 'bestanden', 'notities', 'comm'],
      travel: ['reizen', 'navigatie', 'agenda', 'reisboek', 'comm', 'bestanden', 'notities'],
      work: ['kantoor', 'agenda', 'notities', 'bestanden', 'comm', 'personeel', 'werkruimte', 'leverancier'],
      foundation: ['foundation-agenda', 'foundation-leren', 'foundation-schrijven', 'foundation-vrienden',
        'foundation-klusjes', 'foundation-gezondheid', 'foundation-geld', 'foundation-samen-thuis', 'foundation-meedoen-ontdekken']
    }[o.world] || [];
    o.apps.sort(function (a, b) { var ai = priority.indexOf(a.id), bi = priority.indexOf(b.id);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name); });
    var saving = Promise.resolve(), status = 'session', enabled = false, ready = false;
    var top = U.el('div', 'wd-library-heading'), heading = U.copy(U.el('h2'), 'library');
    var label = U.el('label', 'wd-search-label'), input = U.el('input', 'wd-search');
    label.appendChild(U.copy(U.el('span'), 'search'));
    input.id = 'wdSearch'; input.type = 'search'; label.htmlFor = input.id; label.appendChild(input);
    top.appendChild(heading); top.appendChild(label); o.library.appendChild(top);
    var filters = U.el('div', 'wd-filters'), filter = U.el('select'); filter.setAttribute('aria-label', w.RTGWidgetCopy('all'));
    ['all', 'favorites'].forEach(function (key) { var option = U.el('option', '', w.RTGWidgetCopy(key)); option.dataset.i18n = 'widget.' + key;
      option.value = key; filter.appendChild(option); });
    filter.onchange = function () { onlyFavorites = filter.value === 'favorites'; index = 0; drawLibrary(); }; filters.appendChild(filter);
    ['grid', 'list'].forEach(function (mode) { var b = U.el('button', '', w.RTGWidgetCopy(mode)); b.type = 'button'; b.dataset.i18n = 'widget.' + mode;
      b.setAttribute('aria-pressed', String(mode === 'grid')); b.onclick = function () {
        o.library.dataset.view = mode; filters.querySelectorAll('button').forEach(function (other) { other.setAttribute('aria-pressed', String(other === b)); });
      }; filters.appendChild(b); }); top.appendChild(filters);
    var results = U.el('div', 'wd-catalog'), empty = U.copy(U.el('p', 'wd-muted'), 'noResults');
    empty.setAttribute('role', 'status'); o.library.appendChild(results); o.library.appendChild(empty);
    var pages = U.el('div', 'wd-pages'), number = U.el('span');
    pages.appendChild(U.button('previous', function () { index--; drawLibrary(); }, 'wd-page-prev'));
    pages.appendChild(number); pages.appendChild(U.button('next', function () { index++; drawLibrary(); }, 'wd-page-next'));
    o.library.appendChild(pages);
    var notice = U.el('p', 'wd-muted'); notice.setAttribute('role', 'status');
    var retry = U.button('retry', function () { if (status === 'readError') read(); else save(); }, 'wd-text-button');
    function translated(text, key) {
      var s = U.el('span', '', text); s.dataset.i18n = 'desktopApp.' + key; s.dataset.i18nSource = text; return s;
    }
    function card(app, compact) {
      var box = U.el('article', 'wd-widget'); box.dataset.widget = app.id; box.dataset.widgetType = app.type;
      var open = U.el('button', 'wd-widget-open'); open.type = 'button'; open.dataset.widgetOpen = app.id;
      open.setAttribute('aria-label', app.name + ' · ' + U.value('open'));
      open.onclick = function () { o.open(app, open); };
      var title = U.el('span', 'wd-widget-title'); title.appendChild(U.icon(app.icon));
      title.appendChild(translated(app.name, app.id + '.name')); title.appendChild(U.el('span', 'wd-expand', '↗')); open.appendChild(title);
      box.appendChild(open);
      var body = U.el('div', 'wd-widget-content'); box.appendChild(body);
      (compact ? favoriteSurfaces : surfaces).push(w.RTGWidgetLive(app, body, { state: views[app.id] || (views[app.id] = {}),
        open: function (action) { o.open(app, open, action); },
        run: function (action, data) { return o.runtime.execute(action, data); } }));
      var pin = U.button(selected.includes(app.id) ? 'unpin' : 'pin', function () {
        if (status === 'readError') { notice.scrollIntoView({ block: 'nearest' }); return; }
        if (!selected.includes(app.id) && selected.length >= 12) { status = 'pinLimit'; drawFavorites(); return; }
        selected = selected.includes(app.id) ? selected.filter(function (id) { return id !== app.id; }) : selected.concat(app.id);
        changed++; draw(); save();
      }, 'wd-widget-pin'); pin.setAttribute('aria-pressed', String(selected.includes(app.id))); box.appendChild(pin);
      if (compact) box.dataset.favorite = 'true'; return box;
    }
    function drawLibrary() {
      surfaces.forEach(function (s) { s.destroy(); }); surfaces = [];
      var matches = o.apps.filter(function (app) { return (!onlyFavorites || selected.includes(app.id)) && (app.name + ' ' + app.sections.join(' ')).toLocaleLowerCase().includes(query); });
      var total = Math.max(1, Math.ceil(matches.length / limit)); index = Math.max(0, Math.min(index, total - 1));
      results.textContent = ''; matches.slice(index * limit, (index + 1) * limit).forEach(function (app) { results.appendChild(card(app, false)); });
      empty.hidden = matches.length > 0; pages.hidden = matches.length <= limit;
      number.textContent = (index + 1) + ' / ' + total;
      pages.firstChild.disabled = index === 0; pages.lastChild.disabled = index === total - 1;
    }
    function drawFavorites() {
      favoriteSurfaces.forEach(function (s) { s.destroy(); }); favoriteSurfaces = [];
      o.favorites.textContent = ''; o.favorites.appendChild(U.copy(U.el('h2'), 'favorites'));
      selected.forEach(function (id) { var app = o.apps.find(function (a) { return a.id === id; }); if (app) o.favorites.appendChild(card(app, true)); });
      o.favorites.appendChild(U.button('choose', function () { o.library.scrollIntoView({ block: 'start' }); input.focus(); }, 'wd-text-button'));
      U.copy(notice, status); o.favorites.appendChild(notice); retry.hidden = !['saveError', 'readError'].includes(status); o.favorites.appendChild(retry);
    }
    function draw() { drawFavorites(); drawLibrary(); }
    function save() {
      if (!enabled || !ready) return; var order = selected.slice(), version = changed;
      saving = saving.catch(function () {}).then(function () { return o.runtime.execute('desktop.layout.save', { order: order }); })
        .then(function () { if (version === changed) { status = 'saved'; drawFavorites(); } })
        .catch(function () { if (version === changed) { status = 'saveError'; drawFavorites(); } });
    }
    input.oninput = function () { query = input.value.trim().toLocaleLowerCase(); index = 0; drawLibrary(); };
    draw();
    function read() { return o.runtime.execute('desktop.layout.read', {}).then(function (j) {
      enabled = true; ready = true;
      if (!changed && j.workspace && j.workspace.updatedAt) selected = j.workspace.order.filter(function (id) {
        return o.apps.some(function (a) { return a.id === id; }); }).slice(0, 12);
      status = j.workspace && j.workspace.updatedAt ? 'saved' : 'defaults'; draw(); if (changed) save();
    }).catch(function () { ready = false; enabled = false; status = 'readError'; drawFavorites(); }); }
    if (w.RTGIdentityRuntime().authenticated()) read();
    return { refresh: draw, selection: function () { return selected.slice(); } };
  };
})(window, document);

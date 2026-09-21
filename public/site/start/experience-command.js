(function (w, d) {
  'use strict';
  var dialog = d.getElementById('commandDialog');
  var input = d.getElementById('commandSearch');
  var results = d.getElementById('commandResults');
  var empty = d.getElementById('commandEmpty');
  var locale = d.documentElement.lang || undefined;
  var entries = [];
  var fixed = [
    { name: 'Hoe RTG verbindt', group: 'Platform', copy: 'Volg een handeling van gebruiker naar partner en organisatie.', href: '#verbinding' },
    { name: 'RTG Graph', group: 'Platform', copy: 'Bekijk welke onderdelen rond een onderwerp samenkomen.', href: '#graph' },
    { name: 'Explore RTG', group: 'Platform', copy: 'Verken de vier werelden en hun actuele onderdelen.', href: '#explore' },
    { name: 'Organisatie', group: 'Ingang', copy: 'Bekijk RTG Werk OS voor organisaties.', href: '#platform', role: 'organisatie' },
    { name: 'Partner', group: 'Ingang', copy: 'Bekijk de zaakomgeving voor partners.', href: '#platform', role: 'partner' },
    { name: 'Gebruiker', group: 'Ingang', copy: 'Bekijk RTG OS voor dagelijks gebruik.', href: '#platform', role: 'gebruiker' }
  ];

  function appUrl(path) {
    var base = d.querySelector('meta[name="rtg-app-base"]');
    return new URL(path.replace(/^\//, ''), base ? base.content : 'https://app.rahultravelgroup.com/').href;
  }

  function build(data) {
    entries = fixed.slice();
    Object.keys((data && data.worlds) || {}).forEach(function (id) {
      var world = data.worlds[id];
      entries.push({ name: world.name, group: 'Wereld', copy: world.featureCount + ' onderdelen in ' + world.groupCount + ' groepen.', href: '#explore', world: id });
      world.tools.forEach(function (tool) {
        entries.push({ name: tool.name, group: world.name, copy: 'Open dit bestaande onderdeel in de app.', href: appUrl(tool.route), world: id });
      });
    });
    render('');
  }

  function match(entry, query) {
    var text = (entry.name + ' ' + entry.group + ' ' + entry.copy).toLocaleLowerCase(locale);
    return !query || text.indexOf(query) > -1;
  }

  function activate(entry, event) {
    if (entry.role && w.RTGPlatformExperience) w.RTGPlatformExperience.select(entry.role, { scroll: false });
    if (entry.world) {
      var worldButton = d.querySelector('[data-explore-world="' + entry.world + '"]');
      if (worldButton && entry.href === '#explore') worldButton.click();
    }
    if (entry.href.charAt(0) === '#') {
      event.preventDefault();
      dialog.close();
      var target = d.querySelector(entry.href);
      if (target) target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
  }

  function render(value) {
    var query = String(value || '').trim().toLocaleLowerCase(locale);
    var found = entries.filter(function (entry) { return match(entry, query); }).slice(0, 12);
    results.replaceChildren();
    found.forEach(function (entry) {
      var link = d.createElement('a');
      link.className = 'command-result'; link.href = entry.href; link.setAttribute('role', 'option');
      var name = d.createElement('strong'); name.textContent = entry.name;
      var group = d.createElement('span'); group.textContent = entry.group;
      var copy = d.createElement('small'); copy.textContent = entry.copy;
      link.append(name, group, copy);
      link.addEventListener('click', function (event) { activate(entry, event); });
      results.appendChild(link);
    });
    empty.hidden = found.length > 0;
  }

  function open() {
    if (!dialog.open) dialog.showModal();
    input.value = ''; render('');
    w.setTimeout(function () { input.focus(); }, 20);
  }

  d.querySelectorAll('[data-command-open]').forEach(function (button) { button.addEventListener('click', open); });
  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'ArrowDown') { var first = results.querySelector('a'); if (first) { event.preventDefault(); first.focus(); } }
  });
  d.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase(locale) === 'k') { event.preventDefault(); open(); }
  });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  w.addEventListener('rtg-website-truth', function (event) { build(event.detail); });
  build(w.RTGWebsiteTruth || null);
  w.RTGCommand = { open: open };
}(window, document));

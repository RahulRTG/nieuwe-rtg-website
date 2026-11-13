(function (w, d) {
  'use strict';
  var dialog = d.getElementById('commandDialog');
  var input = d.getElementById('commandSearch');
  var results = d.getElementById('commandResults');
  var empty = d.getElementById('commandEmpty');
  if (!dialog || !input || !results || !empty) return;
  var entries = [];
  var truth = null;
  var returnFocus = null;
  var stop = /^(?:de|het|een|en|of|van|voor|in|op|aan|bij|met|om|te|tot|naar|over|door|dat|dit|die|er|is|zijn|was|wordt|kan|kunnen|mag|moet|ik|je|jij|mijn|uw|u|ons|onze|wat|wie|hoe|waar|welke|waarom|zit|werkt|werken|meer|lezen|vinden|vertel|wil|graag|iets|rtg)$/;
  var synonyms = [
    ['kost', 'kosten', 'prijs', 'prijzen', 'tarief', 'tarieven', 'betalen', 'betaling', 'betaal'],
    ['privacy', 'gegevens', 'persoonsgegevens', 'toestemming', 'regie'],
    ['reis', 'reizen', 'reiswens', 'vakantie'],
    ['pas', 'passen', 'lidmaatschap', 'abonnement', 'lid'],
    ['ondernemen', 'ondernemer', 'ondernemers', 'zakelijk', 'business'],
    ['interview', 'oprichter', 'initiatiefnemer'],
    ['contact', 'spreken', 'bereiken', 'hulp'],
    ['kunst', 'atelier', 'schilderij', 'geschilderd'],
    ['ai', 'rahul', 'intelligentie'],
    ['boeking', 'boeken', 'geboekt', 'reserveren', 'reservering']
  ];
  var articleTags = {
    'artikel-interview': 'oprichter initiatiefnemer wie zit achter RTG interview ontstaan drijfveer',
    'artikel-reizen': 'reizen vakantie reiswens reisbureau',
    'artikel-leven': 'lifestyle samen tafel leven',
    'artikel-ondernemers': 'ondernemen ondernemer business netwerk gastvrijheid',
    'artikel-foundation': 'foundation toegankelijkheid meedoen maatschappelijke kansen',
    'artikel-atelier': 'kunst schilderij geschilderd atelier kleuren',
    'artikel-code': 'code techniek software AI Rahul architectuur',
    'artikel-vertrouwen': 'boeking reservering gevraagd bevestigd bevestiging vertrouwen'
  };
  // Editorial question aliases select a published source, never compose an answer.
  var articleQuestions = {
    'artikel-interview': ['wie zit achter rtg', 'wie zit er achter rtg', 'wie is de oprichter van rtg', 'wie is de initiatiefnemer van rtg']
  };
  var dossiers = [
    ['prijsbeleid', 'Prijzen & afspraken', 'kosten prijs tarief betaling maand jaar commissie opzeggen', 'Service'],
    ['passen', 'Lidmaatschap & passen', 'pas lidmaatschap abonnement toegang aanmelden', 'Service'],
    ['regie', 'Privacy & eigen regie', 'privacy gegevens persoonsgegevens toestemming verwijderen', 'Dossier'],
    ['techniek', 'De techniek achter RTG', 'techniek code software beveiliging security', 'Dossier'],
    ['foundation', 'FoundationOS', 'foundation gratis meedoen bijdrage', 'Dossier'],
    ['werelden', 'Vier werelden, één RTG', 'livingos travelos workos foundationos mogelijkheden', 'Dossier'],
    ['begin', 'Begin met RTG', 'begin beginnen aanmelden contact spreken partner organisatie', 'Service']
  ];
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
    var root = new URL(base && base.content ? base.content : 'https://app.rahultravelgroup.com/', d.baseURI).href;
    return new URL(path.replace(/^\//, ''), root).href;
  }

  function normal(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function text(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
  function excerpt(value) { return value.length > 170 ? value.slice(0, 167).replace(/\s+\S*$/, '') + '…' : value; }
  function index(entry) {
    entry.fields = [entry.name, entry.tags, entry.group, entry.copy, entry.body].map(function (value) { return ' ' + normal(value) + ' '; });
    entries.push(entry);
  }

  function build(data) {
    truth = data || truth;
    entries = [];
    // Only published DOM text is indexed. No account data, input values,
    // network lookup, generated answers or second copy of a story.
    d.querySelectorAll('[data-issue-article]').forEach(function (article) {
      index({ name: text(article.querySelector('h2')), group: 'Verhaal · RTG Journal', copy: text(article.querySelector('.ds-issue-deck')), body: text(article.querySelector('.ds-issue-prose')), tags: articleTags[article.id], questions: articleQuestions[article.id], href: '#' + article.id, priority: 8 });
    });
    dossiers.forEach(function (row) {
      var target = d.getElementById(row[0]);
      if (target) index({ name: row[1], group: row[3], tags: row[2], copy: excerpt(text(target.querySelector('p'))), body: text(target), href: '#' + row[0], priority: 10 });
    });
    d.querySelectorAll('#faqList details[data-faq]').forEach(function (faq) {
      var name = text(faq.querySelector('summary'));
      if (!faq.id) faq.id = 'magazine-vraag-' + normal(name).replace(/ /g, '-');
      index({ name: name, group: 'Veelgestelde vraag', copy: excerpt(text(faq.querySelector('p'))), body: text(faq), href: '#' + faq.id, priority: 5 });
    });
    fixed.forEach(function (entry) { if (d.getElementById(entry.href.slice(1))) index(entry); });
    data = truth;
    Object.keys((data && data.worlds) || {}).forEach(function (id) {
      var world = data.worlds[id];
      index({ name: world.name, group: 'Wereld', copy: world.featureCount + ' onderdelen in ' + world.groupCount + ' groepen.', href: '#explore', world: id });
      (world.tools || []).forEach(function (tool) {
        index({ name: tool.name, group: world.name, copy: 'Open dit bestaande onderdeel in de app.', href: appUrl(tool.route), world: id });
      });
    });
  }

  function terms(query) {
    var tokens = query.split(' ').filter(function (token) { return token && !stop.test(token); });
    if (!tokens.length) tokens = query.split(' ').filter(Boolean);
    return tokens.slice(0, 12).map(function (token) {
      return synonyms.find(function (group) { return group.indexOf(token) > -1; }) || [token];
    });
  }

  function score(entry, query, words) {
    if (!query) return entry.priority || 0;
    if (entry.questions && entry.questions.indexOf(query) > -1) return 300 + (entry.priority || 0);
    var weights = [30, 18, 8, 6, 2], rank = entry.priority || 0;
    var complete = words.every(function (alternatives) {
      var best = 0;
      entry.fields.forEach(function (field, i) {
        if (alternatives.some(function (word) { return field.indexOf(' ' + word + ' ') > -1; })) best = Math.max(best, weights[i]);
      });
      rank += best;
      return best > 0;
    });
    if (!complete) return 0;
    if (entry.fields[0].trim() === query) rank += 200;
    else if (entry.fields[0].indexOf(' ' + query + ' ') > -1) rank += 80;
    return rank;
  }

  function activate(entry, event) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || (event.button && event.button !== 0)) return;
    if (entry.role && w.RTGPlatformExperience) w.RTGPlatformExperience.select(entry.role, { scroll: false });
    if (entry.world) {
      var worldButton = d.querySelector('[data-explore-world="' + entry.world + '"]');
      if (worldButton && entry.href === '#explore') worldButton.click();
    }
    if (entry.href.charAt(0) === '#') {
      event.preventDefault();
      dialog.close();
      if (returnFocus && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
      if (w.RTGPublicApp) w.RTGPublicApp.open(entry.href.slice(1));
      else { var target = d.getElementById(entry.href.slice(1)); if (target) { if (target.tagName === 'DETAILS') target.open = true; target.scrollIntoView({ behavior: w.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }
    }
  }

  function render(value) {
    var query = normal(String(value || '').slice(0, 160)), words = terms(query);
    var matches = entries.map(function (entry, order) { return { entry: entry, rank: score(entry, query, words), order: order }; }).filter(function (result) { return !query || result.rank > 0; }).sort(function (a, b) { return b.rank - a.rank || a.order - b.order; });
    var found = matches.slice(0, 12);
    results.replaceChildren();
    found.forEach(function (result) {
      var entry = result.entry;
      var link = d.createElement('a');
      link.className = 'command-result'; link.href = entry.href;
      var name = d.createElement('strong'); name.textContent = entry.name;
      var group = d.createElement('span'); group.textContent = entry.group;
      var copy = d.createElement('small'); copy.textContent = entry.copy;
      link.append(name, group, copy);
      link.addEventListener('click', function (event) { activate(entry, event); });
      results.appendChild(link);
    });
    empty.hidden = found.length > 0;
    announcement.textContent = query ? (matches.length ? matches.length + ' resultaten' + (matches.length > 12 ? ', de eerste 12 getoond.' : '.') : 'Geen resultaten.') : 'Verhalen en praktische informatie.';
  }

  function open(query) {
    if (!dialog.open) returnFocus = d.activeElement;
    build(truth);
    if (!dialog.open) dialog.showModal();
    input.value = typeof query === 'string' ? query.slice(0, 160) : ''; render(input.value);
    w.setTimeout(function () { input.focus(); }, 20);
  }

  var announcement = d.createElement('p');
  announcement.className = 'command-hint'; announcement.id = 'commandStatus'; announcement.setAttribute('role', 'status'); announcement.setAttribute('aria-live', 'polite'); announcement.setAttribute('aria-atomic', 'true');
  results.before(announcement); results.removeAttribute('role');
  input.setAttribute('aria-controls', results.id); input.setAttribute('aria-describedby', announcement.id);
  d.querySelectorAll('[data-command-open]').forEach(function (button) { button.addEventListener('click', function () { open(button.dataset.commandQuery); }); });
  input.addEventListener('input', function () { render(input.value); });
  input.addEventListener('keydown', function (event) {
    var first = results.querySelector('a');
    if (event.key === 'ArrowDown' && first) { event.preventDefault(); first.focus(); }
    if (event.key === 'Enter' && !event.isComposing) { event.preventDefault(); if (first) first.click(); }
  });
  results.addEventListener('keydown', function (event) {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    var links = Array.from(results.querySelectorAll('a')), current = links.indexOf(d.activeElement), next;
    if (event.key === 'ArrowDown') next = Math.min(current + 1, links.length - 1);
    else if (event.key === 'ArrowUp') next = current - 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = links.length - 1;
    else return;
    event.preventDefault(); if (next < 0) input.focus(); else if (links[next]) links[next].focus();
  });
  d.addEventListener('keydown', function (event) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); open(); }
  });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) dialog.close(); });
  w.addEventListener('rtg-website-truth', function (event) { build(event.detail); if (dialog.open) render(input.value); });
  build(w.RTGWebsiteTruth || null); render('');
  w.RTGCommand = { open: open };
}(window, document));

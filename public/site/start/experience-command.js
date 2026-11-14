(function (w, d) {
  'use strict';
  var dialog = d.getElementById('commandDialog');
  var input = d.getElementById('commandSearch');
  var results = d.getElementById('commandResults');
  var empty = d.getElementById('commandEmpty');
  if (!dialog || !input || !results || !empty) return;
  var returnFocus = null;
  var sourceIndex = w.RTGCommandIndex();

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
    var lookup = sourceIndex.search(value), query = lookup.query, matches = lookup.matches;
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
    sourceIndex.build();
    if (!dialog.open) dialog.showModal();
    input.value = typeof query === 'string' ? query.slice(0, 160) : ''; render(input.value);
    // Modal contents are ready now. A delayed focus would steal the user's
    // focus back after they have already moved to a search result.
    input.focus();
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
  w.addEventListener('rtg-website-truth', function (event) { sourceIndex.build(event.detail); if (dialog.open) render(input.value); });
  sourceIndex.build(w.RTGWebsiteTruth || null); render('');
  w.RTGCommand = { open: open };
}(window, document));

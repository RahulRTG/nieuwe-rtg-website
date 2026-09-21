(function (w, d) {
  'use strict';
  var truth = null, current = 'work', locale = d.documentElement.lang || undefined;
  var appBase = d.querySelector('meta[name="rtg-app-base"]').content;
  function appUrl(path) { return new URL(path.replace(/^\//, ''), appBase).href; }
  function draw(id) {
    if (!truth || !truth.worlds[id]) return;
    current = id; d.body.dataset.exploreWorld = id;
    var world = truth.worlds[id];
    d.querySelectorAll('[data-world]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.world === id)); });
    d.getElementById('worldTitle').textContent = world.name;
    d.getElementById('worldLabel').textContent = world.name.toUpperCase() + ' / ACTUEEL IN DE APP';
    d.getElementById('worldCount').textContent = world.featureCount + ' onderdelen in ' + world.groupCount + ' groepen.';
    showTools(world.tools, '');
  }
  function showTools(tools, query) {
    var grid = d.getElementById('toolGrid'); grid.replaceChildren();
    tools.filter(function (tool) { return !query || tool.name.toLocaleLowerCase(locale).indexOf(query) > -1; }).forEach(function (tool, index) {
      var link = d.createElement('a'); link.href = appUrl(tool.route); link.style.setProperty('--i', index); 
      var number = d.createElement('span'); number.textContent = String(index + 1).padStart(2, '0');
      var name = d.createElement('strong'); name.textContent = tool.name;
      var action = d.createElement('small'); action.textContent = 'Open in de app';
      link.append(number, name, action); grid.appendChild(link);
    });
    if (!grid.children.length) { var message = d.createElement('p'); message.textContent = 'Geen onderdeel gevonden in deze wereld.'; grid.appendChild(message); }
  }
  d.querySelectorAll('[data-world]').forEach(function (button) { button.addEventListener('click', function () { draw(button.dataset.world); }); });
  d.getElementById('exploreSearch').addEventListener('input', function (event) {
    if (!truth) return;
    var query = event.target.value.trim().toLocaleLowerCase(locale);
    if (!query) { draw(current); return; }
    var tools = [];
    Object.keys(truth.worlds).forEach(function (id) { truth.worlds[id].tools.forEach(function (tool) { tools.push({ name: tool.name + ' / ' + truth.worlds[id].name, route: tool.route }); }); });
    showTools(tools, query);
    d.getElementById('worldTitle').textContent = 'Zoekresultaten';
    d.getElementById('worldCount').textContent = 'Resultaten uit alle vier werelden.';
  });
  fetch('../public/site/website-truth.json', { credentials: 'same-origin' }).then(function (response) { if (!response.ok) throw new Error('bron niet beschikbaar'); return response.json(); }).then(function (data) { truth = data; draw(current); }).catch(function () { d.getElementById('worldCount').textContent = 'De actuele productkaart kon niet worden geladen.'; });
}(window, document));

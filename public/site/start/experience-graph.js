(function (w, d) {
  'use strict';

  var graph = {
    restaurant: {
      nodes: ['reservering', 'betaling', 'planning', 'voorraad', 'klant', 'team'],
      caption: 'Restaurant verbindt reservering, betaling, planning, voorraad, klant en team.'
    },
    werknemer: {
      nodes: ['planning', 'betaling', 'team', 'documenten'],
      caption: 'Werknemer verbindt planning, uren, loon, team en documenten binnen de geldende rechten.'
    },
    reis: {
      nodes: ['reservering', 'betaling', 'planning', 'klant', 'documenten'],
      caption: 'Reis verbindt planning, reservering, vervoerbewijzen, betaling en de gebruiker.'
    }
  };

  function chooseTopic(topic) {
    var data = graph[topic];
    if (!data) return;
    d.querySelector('.rtg-graph').dataset.graphActive = topic;
    d.querySelectorAll('[data-graph-topic]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.graphTopic === topic));
    });
    d.querySelectorAll('[data-graph-node]').forEach(function (node) {
      node.classList.toggle('is-active', data.nodes.indexOf(node.dataset.graphNode) > -1);
    });
    d.getElementById('graphCaption').textContent = data.caption;
  }

  d.querySelectorAll('[data-graph-topic]').forEach(function (button) {
    button.addEventListener('click', function () { chooseTopic(button.dataset.graphTopic); });
    button.addEventListener('mouseenter', function () { chooseTopic(button.dataset.graphTopic); });
  });
  chooseTopic('restaurant');

  var currentWorld = 'work';
  function appUrl(path) {
    var base = d.querySelector('meta[name="rtg-app-base"]');
    return new URL(path.replace(/^\//, ''), base ? base.content : 'https://app.rahultravelgroup.com/').href;
  }

  function renderWorld(id, truth) {
    var world = truth && truth.worlds && truth.worlds[id];
    if (!world) return;
    currentWorld = id;
    d.body.dataset.rtgWorld = id;
    d.querySelectorAll('[data-explore-world]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.exploreWorld === id));
    });
    d.getElementById('exploreEyebrow').textContent = world.name.toUpperCase() + ' / ACTUEEL IN DE APP';
    d.getElementById('exploreName').textContent = world.name;
    d.getElementById('exploreCount').textContent = world.featureCount + ' onderdelen in ' + world.groupCount + ' groepen.';
    var groups = d.getElementById('exploreGroups');
    groups.replaceChildren();
    world.tools.slice(0, 10).forEach(function (tool) {
      var link = d.createElement('a');
      link.href = appUrl(tool.route);
      link.className = 'explore-tool';
      var name = d.createElement('span'); name.textContent = tool.name;
      var arrow = d.createElement('i'); arrow.textContent = 'Open';
      link.append(name, arrow);
      groups.appendChild(link);
    });
    var link = d.getElementById('exploreLink');
    link.href = appUrl(world.publicRoute); link.dataset.appPath = world.publicRoute;
    link.textContent = 'Open ' + world.name;
  }

  function truthReady(data) { renderWorld(currentWorld, data); }
  d.querySelectorAll('[data-explore-world]').forEach(function (button) {
    button.addEventListener('click', function () { renderWorld(button.dataset.exploreWorld, w.RTGWebsiteTruth); });
  });
  w.addEventListener('rtg-website-truth', function (event) { truthReady(event.detail); });
  if (w.RTGWebsiteTruth) truthReady(w.RTGWebsiteTruth);
}(window, document));

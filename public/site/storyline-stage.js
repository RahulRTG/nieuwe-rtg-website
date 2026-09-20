/* One deterministic presentation of the existing demo model. Never reads a member session. */
(function (w, d) {
  'use strict';
  var C = w.RTGExperienceCore;
  var scenes = {
    travel: { photo: 'travel', people: ['Uw reisgezelschap', 'Uw collega’s', 'Uw vervoer'], note: 'Een ander vertrekmoment verandert ook de rest van uw dag.' },
    dinner: { photo: 'living', people: ['Uw gezelschap', 'De tafel voor acht', 'Wie er meekomen'], note: 'Een andere menukeuze loopt mee in hetzelfde voorstel.' },
    work: { photo: 'work', people: ['Uw team', 'Uw gasten', 'Een mogelijke vervanger'], note: 'Een open dienst vraagt om overleg. Een voorstel wijzigt geen rooster.' },
    family: { photo: 'foundation', people: ['Uw gezin', 'Het schoolmoment', 'Wie kan meegaan'], note: 'De gezinsomgeving blijft altijd 100% gratis.' }
  };
  function node(tag, value, cls) { var n = d.createElement(tag); if (value) n.textContent = value; if (cls) n.className = cls; return n; }
  function icon(name) {
    var n = node('span', '', 'story-icon'); n.setAttribute('aria-hidden', 'true');
    n.innerHTML = '<svg viewBox="0 0 24 24">' + ((w.RTGEdgeIcons || {})[name] || '') + '</svg>'; return n;
  }
  function init(root) {
    if (root.dataset.storyStage) return;
    var main = root.querySelector('.simulation-main'), controls = main.firstElementChild;
    controls.classList.add('story-controls');
    var people = node('aside', '', 'story-people'), photo = node('figure', '', 'story-photo');
    var img = node('img'); img.alt = ''; img.loading = 'lazy'; photo.appendChild(img);
    var caption = node('figcaption'); caption.append(node('small', 'Een voorbeeldmoment', 'story-eyebrow'), controls.querySelector('h3'), controls.querySelector('p:not(.overline)'));
    photo.append(caption, node('span', 'Sfeerbeeld', 'story-image-label'));
    controls.append(node('p', 'Uw keuze verandert het voorbeeld. Er gebeurt niets buiten deze pagina.', 'story-boundary'));
    main.prepend(people, photo); root.dataset.storyStage = 'ready';
  }
  function paint(root, state) {
    init(root);
    var spec = C.SCENARIOS[state.scenario], p = C.proposal(state), scene = scenes[state.scenario];
    var query = function (s) { return root.querySelector(s); };
    root.dataset.storyWorld = spec.world; root.dataset.storyScenario = state.scenario;
    query('.story-controls .overline').textContent = C.WORLDS[spec.world].name;
    query('.story-photo h3').textContent = spec.title; query('.story-photo p').textContent = spec.intro;
    var img = query('.story-photo img'), meta = d.querySelector('meta[name="rtg-asset-base"]');
    var base = new URL(((meta && meta.content) || '/').replace(/\/?$/, '/'), d.baseURI);
    var src = new URL('images/world-homes/' + scene.photo + '.webp', base).href;
    if (img.src !== src) img.src = src;
    var select = query('select'), label = query('.demo-choice span'); label.textContent = spec.label;
    if (select.dataset.scenario !== state.scenario) {
      select.replaceChildren(); spec.options.forEach(function (item) { var o = node('option', item[1]); o.value = item[0]; select.appendChild(o); });
      select.dataset.scenario = state.scenario;
    }
    select.value = state.option;
    var people = query('.story-people'); people.replaceChildren(node('h4', 'Alles om dit moment heen.'), node('small', 'Voorbeeld, geen echte contacten'));
    scene.people.forEach(function (name, i) { var row = node('div', '', 'story-person'); row.append(icon(['people', 'calendar', 'branch'][i]), node('span', name)); people.appendChild(row); });
    people.append(node('p', scene.note, 'story-aside-note'));
    var list = query('.connection-steps'), open = [];
    list.querySelectorAll('details').forEach(function (el, i) { if (el.open) open.push(i); });
    if (list.dataset.scenario !== state.scenario) open = [];
    list.dataset.scenario = state.scenario; list.replaceChildren();
    p.rows.forEach(function (row, i) {
      var li = node('li'), detail = node('details'), summary = node('summary');
      li.dataset.conflict = String(row.conflict); detail.open = open.includes(i);
      var kind = ({ LivingOS: 'calendar', WorkOS: 'brief', TravelOS: i ? 'car' : 'plane', FoundationOS: 'book', Pay: 'money' })[row.world];
      var top = node('span', '', 'story-widget-head'); top.append(icon(kind), node('small', row.world));
      summary.append(top, node('strong', row.text), node('span', 'Bekijk de samenhang', 'story-widget-more'));
      detail.append(summary, node('p', row.conflict ? 'Dit voorbeeld past nog niet. Verander de keuze hierboven om te zien wat er met de andere onderdelen meebeweegt.' :
        'Dit onderdeel hoort bij hetzelfde voorbeeldvoorstel. Er zijn geen echte gegevens opgehaald of afspraken aangepast.'));
      li.appendChild(detail); list.appendChild(li);
    });
    query('.rahul-note p').textContent = p.result;
    var badge = query('.demo-label'); badge.textContent = 'Demonstratie';
    root.dispatchEvent(new w.CustomEvent('rtg-storyline-render', { bubbles: true }));
    return p;
  }
  function create(parent) {
    var root = node('div', '', 'simulation');
    root.innerHTML = '<div class="simulation-head"><span class="overline">RTG, een verbonden moment</span><span class="demo-label">Demonstratie</span></div>' +
      '<div class="simulation-main"><div><p class="overline"></p><h3></h3><p></p><label class="demo-choice"><span></span><select></select></label></div><ol class="connection-steps"></ol></div>' +
      '<div class="rahul-note"><span class="rahul-mark" aria-hidden="true"></span><p role="status"></p></div>' +
      '<p class="simulation-disclaimer">Voorbeeldgegevens. Er wordt niets geboekt, betaald of gedeeld. Uw echte agenda en locatie worden niet gebruikt.</p>';
    parent.appendChild(root); return root;
  }
  w.RTGStorylineStage = Object.freeze({ paint: paint, create: create });
}(window, document));

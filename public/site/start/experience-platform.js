(function (w, d) {
  'use strict';

  var roles = {
    organisatie: {
      eyebrow: 'ORGANISATIE / WORKOS',
      title: 'Bestuur uw organisatie zonder haar op te knippen.',
      summary: 'Werk, mensen, planning en informatie blijven één bestuurbare omgeving.',
      capabilities: ['Werk', 'Mensen', 'Planning', 'Communicatie', 'Documenten', 'Financiën', 'Toegang'],
      route: '/apps/werk.html',
      action: 'Open RTG Werk OS',
      contextAction: 'Bekijk hoe uw organisatie aansluit',
      name: 'RTG Werk OS',
      boundary: 'De app bepaalt op basis van rol en werkruimte wat iemand mag zien.'
    },
    partner: {
      eyebrow: 'PARTNER / PARTNER OS',
      title: 'Verbind uw bedrijf met het RTG-netwerk.',
      summary: 'Klanten, boekingen, bestellingen, betalingen, aanbod en team komen samen in de eigen zaakomgeving.',
      capabilities: ['Klanten', 'Boekingen', 'Bestellingen', 'Betalingen', 'Aanbod', 'Team', 'Bereik'],
      route: '/apps/leverancier.html',
      action: 'Open de partneromgeving',
      contextAction: 'Bekijk wat uw bedrijf binnen RTG kan doen',
      name: 'Partner OS',
      boundary: 'Iedere partner bedient alleen de eigen zaak en de daarvoor beschikbare gegevens.'
    },
    gebruiker: {
      eyebrow: 'GEBRUIKER / RTG OS',
      title: 'Eén plek voor het dagelijks leven.',
      summary: 'Living, Travel, Work en Foundation blijven verschillende werelden met dezelfde bediening.',
      capabilities: ['Living', 'Travel', 'Work', 'Foundation'],
      route: '/apps/app.html',
      action: 'Open RTG',
      contextAction: 'Bekijk hoe uw dagelijks leven samenkomt',
      name: 'RTG OS',
      boundary: 'De gebruiker houdt controle over keuzes, gegevens en bevestigingen.'
    }
  };
  var current = 'organisatie';
  var seen = {};

  function appUrl(path) {
    var base = d.querySelector('meta[name="rtg-app-base"]');
    return new URL(path.replace(/^\//, ''), base ? base.content : 'https://app.rahultravelgroup.com/').href;
  }

  function remember(role) {
    seen[role] = (seen[role] || 0) + 1;
    try { w.sessionStorage.setItem('rtg-www-role', role); w.sessionStorage.setItem('rtg-www-seen', JSON.stringify(seen)); } catch (error) { return; }
  }

  function announce(message) {
    var status = d.getElementById('experienceStatus');
    if (status) status.textContent = message;
  }

  function list(items) {
    var target = d.getElementById('roleCapabilities');
    target.replaceChildren();
    items.forEach(function (item) { var li = d.createElement('li'); li.textContent = item; target.appendChild(li); });
  }

  function select(role, options) {
    var data = roles[role];
    if (!data) return;
    current = role;
    if (!options || options.remember !== false) remember(role);
    d.body.dataset.platformRole = role;
    d.querySelector('.arrival-network').dataset.role = role;
    d.querySelectorAll('[data-role-select]').forEach(function (button) {
      var active = button.dataset.roleSelect === role;
      button.classList.toggle('is-active', active);
      if (button.closest('.role-switch')) button.setAttribute('aria-pressed', String(active));
    });
    d.getElementById('roleEyebrow').textContent = data.eyebrow;
    d.getElementById('roleTitle').textContent = data.title;
    d.getElementById('roleSummary').textContent = data.summary;
    d.getElementById('roleBoundary').textContent = data.boundary;
    d.getElementById('stageRole').textContent = role.toUpperCase();
    d.getElementById('stageTitle').textContent = data.name;
    list(data.capabilities);
    var cta = d.getElementById('roleCta');
    cta.href = appUrl(data.route); cta.dataset.appPath = data.route;
    cta.textContent = seen[role] >= 3 ? data.contextAction : data.action;
    d.querySelectorAll('[data-stage-screen]').forEach(function (screen) { screen.classList.toggle('is-active', screen.dataset.stageScreen === role); });
    if (options && options.scroll) d.getElementById('platform').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    announce(role.charAt(0).toUpperCase() + role.slice(1) + ' geselecteerd. De pagina toont nu deze kant van RTG.');
    w.dispatchEvent(new CustomEvent('rtg-platform-role', { detail: { role: role } }));
  }

  function restore() {
    var role;
    try { role = w.sessionStorage.getItem('rtg-www-role'); seen = JSON.parse(w.sessionStorage.getItem('rtg-www-seen') || '{}'); } catch (error) { role = ''; seen = {}; }
    select(roles[role] ? role : 'organisatie', { remember: false });
  }

  d.querySelectorAll('[data-role-select]').forEach(function (button) {
    button.addEventListener('click', function () { select(button.dataset.roleSelect, { scroll: Boolean(button.closest('.arrival-network')) }); });
  });

  var flowCopy = [
    ['GEBRUIKER', 'De keuze begint bij de persoon.'],
    ['PARTNER', 'De partner ontvangt de bevestigde bestelling.'],
    ['WORKOS', 'Planning en capaciteit worden zichtbaar voor bevoegde rollen.'],
    ['BETALING', 'Betalen blijft een afzonderlijke, gecontroleerde stap.'],
    ['ORGANISATIE', 'Het resultaat komt terug in de bestuurbare omgeving.']
  ];
  var stage = d.querySelector('.transaction-stage');
  var flowItems = Array.from(d.querySelectorAll('[data-flow-step]'));
  function setFlow(index) {
    flowItems.forEach(function (item, number) { item.classList.toggle('is-active', number === index); });
    stage.dataset.step = String(index);
    var status = d.getElementById('flowStatus');
    status.replaceChildren();
    var label = d.createElement('span'); label.textContent = flowCopy[index][0];
    status.append(label, d.createTextNode(flowCopy[index][1]));
  }
  if ('IntersectionObserver' in w) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) setFlow(Number(entry.target.dataset.flowStep)); });
    }, { rootMargin: '-34% 0px -44% 0px', threshold: 0 });
    flowItems.forEach(function (item) { observer.observe(item); });
  }
  setFlow(0);
  restore();
  w.RTGPlatformExperience = { select: select, current: function () { return current; } };
}(window, document));

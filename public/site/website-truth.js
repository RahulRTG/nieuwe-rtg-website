(function () {
  'use strict';

  var middelen = document.querySelector('meta[name="rtg-asset-base"]');
  var middelenBasis = new URL((middelen ? middelen.content : '/').replace(/\/?$/, '/'), document.baseURI);
  var bron = new URL('site/website-truth.json', middelenBasis).href;
  var appBasis = document.querySelector('meta[name="rtg-app-base"]');
  var appUrl = new URL(appBasis ? appBasis.content : 'https://app.rahultravelgroup.com/', document.baseURI).href;

  function naarApp(route) { return new URL(String(route || '').replace(/^\//, ''), appUrl).href; }

  function zetTekst(element, tekst) {
    if (element) element.textContent = tekst;
  }

  function vulLijst(lijst, regels) {
    if (!lijst) return;
    lijst.replaceChildren();
    regels.forEach(function (regel) {
      var item = document.createElement('li');
      item.textContent = regel;
      lijst.appendChild(item);
    });
  }

  function bindWereld(kaart, wereld) {
    zetTekst(kaart.querySelector('[data-app-truth-name]'), wereld.name);
    vulLijst(kaart.querySelector('[data-app-truth-tools]'), wereld.tools.slice(0, 3).map(function (tool) { return tool.name; }));
    var link = kaart.querySelector('[data-app-truth-link]');
    if (link) {
      link.href = naarApp(wereld.publicRoute);
      link.dataset.appPath = wereld.publicRoute;
      link.textContent = 'Open ' + wereld.name;
    }
    var plek = kaart.querySelector('[data-app-truth-detail]');
    if (!plek) return;
    var summary = document.createElement('summary');
    summary.textContent = 'Wat zit er nu in de app?';
    var telling = document.createElement('p');
    telling.textContent = wereld.featureCount + ' onderdelen, verdeeld over ' + wereld.groupCount + ' groepen.';
    var groepen = document.createElement('ul');
    vulLijst(groepen, wereld.groups.map(function (groep) { return groep.name + ' (' + groep.count + ')'; }));
    plek.replaceChildren(summary, telling, groepen);
  }

  function bindWereldpagina(wereld) {
    var kopie = document.querySelector('.world-hero-copy');
    if (!kopie || kopie.querySelector('[data-app-truth-panel]')) return;
    var blok = document.createElement('aside');
    blok.className = 'app-truth-panel';
    blok.dataset.appTruthPanel = '';
    var titel = document.createElement('strong');
    titel.textContent = 'Actueel in ' + wereld.name;
    var tekst = document.createElement('p');
    tekst.textContent = wereld.featureCount + ' onderdelen in ' + wereld.groupCount + ' groepen: ' +
      wereld.groups.map(function (groep) { return groep.name; }).join(', ') + '.';
    var link = document.createElement('a');
    link.href = naarApp(wereld.publicRoute);
    link.textContent = 'Bekijk de huidige app';
    blok.append(titel, tekst, link);
    kopie.appendChild(blok);
  }

  function bindPas(element, pas) {
    zetTekst(element.querySelector('[data-app-truth-pass-name]'), pas.name);
    zetTekst(element.querySelector('[data-app-truth-price]'), pas.priceLabel);
    zetTekst(element.querySelector('[data-app-truth-billing]'), pas.billingNote);
  }

  function toepassen(data) {
    document.querySelectorAll('[data-app-truth-world]').forEach(function (element) {
      var wereld = data.worlds[element.dataset.appTruthWorld];
      if (wereld) bindWereld(element, wereld);
    });
    var wereldId = document.body.dataset.world;
    if (wereldId && data.worlds[wereldId]) bindWereldpagina(data.worlds[wereldId]);
    document.querySelectorAll('[data-app-truth-pass]').forEach(function (element) {
      var pas = data.passes[element.dataset.appTruthPass];
      if (pas) bindPas(element, pas);
    });
    var pasId = document.body.dataset.pass;
    if (pasId && data.passes[pasId]) bindPas(document.body, data.passes[pasId]);
    document.documentElement.dataset.websiteTruth = 'actueel';
  }

  fetch(bron, { credentials: 'same-origin' })
    .then(function (antwoord) { if (!antwoord.ok) throw new Error('bron niet beschikbaar'); return antwoord.json(); })
    .then(toepassen)
    .catch(function () { document.documentElement.dataset.websiteTruth = 'terugval'; });
})();

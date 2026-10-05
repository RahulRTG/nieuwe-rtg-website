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
    summary.textContent = 'Alle apps in ' + wereld.name;
    var telling = document.createElement('p');
    telling.textContent = wereld.featureCount + ' actuele apps, verdeeld over ' + wereld.groupCount + ' appvormen. Deze productkaart komt rechtstreeks uit MAPPEN in de app.';
    plek.replaceChildren(summary, telling, maakAppgroepen(wereld));
  }

  function maakAppgroepen(wereld) {
    var groepen = document.createElement('div');
    groepen.className = 'app-truth-groups';
    wereld.groups.forEach(function (groep) {
      var sectie = document.createElement('section');
      var kop = document.createElement('h4');
      var aantal = document.createElement('span');
      var lijst = document.createElement('ul');
      kop.textContent = groep.name;
      aantal.textContent = groep.count + (groep.count === 1 ? ' app' : ' apps');
      kop.appendChild(aantal);
      groep.apps.forEach(function (app) {
        var item = document.createElement('li');
        var detail = document.createElement('details');
        var samenvatting = document.createElement('summary');
        var naam = document.createElement('strong');
        var hint = document.createElement('span');
        var body = document.createElement('div');
        var uitleg = document.createElement('p');
        var acties = document.createElement('ul');
        var noot = document.createElement('p');
        var link = document.createElement('a');
        item.className = 'app-truth-app';
        detail.className = 'app-truth-app-detail';
        body.className = 'app-truth-app-body';
        uitleg.className = 'app-truth-app-summary';
        acties.className = 'app-truth-actions';
        noot.className = 'app-truth-note';
        naam.textContent = app.name;
        hint.textContent = 'Bekijk inhoud';
        uitleg.textContent = app.summary;
        noot.textContent = app.note;
        vulLijst(acties, app.actions);
        link.href = naarApp(app.route);
        link.dataset.appPath = app.route;
        link.textContent = 'Open ' + app.name;
        samenvatting.append(naam, hint);
        body.append(uitleg, acties, noot, link);
        detail.append(samenvatting, body);
        item.appendChild(detail);
        lijst.appendChild(item);
      });
      sectie.append(kop, lijst);
      groepen.appendChild(sectie);
    });
    return groepen;
  }

  function bindPubliekeWereld(id, wereld) {
    document.querySelectorAll('[data-public-world-facts="' + id + '"]').forEach(function (element) {
      element.textContent = wereld.featureCount + ' apps · ' + wereld.groupCount + ' appvormen · rechtstreeks uit MAPPEN';
      var kaart = element.closest('[data-public-widget]');
      if (kaart) kaart.dataset.search = wereld.groups.map(function (groep) {
        return groep.name + ' ' + groep.apps.map(function (app) {
          return [app.name, app.summary, app.note].concat(app.actions).join(' ');
        }).join(' ');
      }).join(' ');
    });
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
    tekst.textContent = wereld.featureCount + ' onderdelen in ' + wereld.groupCount + ' appvormen: ' +
      wereld.groups.map(function (groep) { return groep.name; }).join(', ') + '.';
    var catalogus = document.createElement('details');
    catalogus.className = 'app-truth-detail app-truth-catalog';
    var samenvatting = document.createElement('summary');
    samenvatting.textContent = 'Bekijk alle ' + wereld.featureCount + ' apps';
    catalogus.append(samenvatting, maakAppgroepen(wereld));
    var link = document.createElement('a');
    link.href = naarApp(wereld.publicRoute);
    link.textContent = 'Bekijk de huidige app';
    blok.append(titel, tekst, catalogus, link);
    kopie.appendChild(blok);
  }

  function bindPas(element, pas) {
    zetTekst(element.querySelector('[data-app-truth-pass-name]'), pas.name);
    zetTekst(element.querySelector('[data-app-truth-price]'), pas.priceLabel);
    zetTekst(element.querySelector('[data-app-truth-billing]'), pas.billingNote);
  }

  function bindPlatformScreen(element, screen) {
    zetTekst(element.querySelector('[data-app-truth-screen-audience]'), screen.audience);
    zetTekst(element.querySelector('[data-app-truth-screen-name]'), screen.name);
    zetTekst(element.querySelector('[data-app-truth-screen-summary]'), screen.summary);
    zetTekst(element.querySelector('[data-app-truth-screen-note]'), screen.note);
    vulLijst(element.querySelector('[data-app-truth-screen-actions]'), screen.actions);
    var image = element.querySelector('[data-app-truth-screen-image]');
    if (image) {
      image.src = new URL(screen.image, middelenBasis).href;
      image.alt = 'Echt scherm van ' + screen.name + ' in een afgeschermde testomgeving';
    }
    var link = element.querySelector('[data-app-truth-screen-link]');
    if (link) {
      link.href = naarApp(screen.route);
      link.dataset.appPath = screen.route;
      link.textContent = screen.action;
    }
  }

  function toepassen(data) {
    window.RTGWebsiteTruth = data;
    document.querySelectorAll('[data-app-truth-screen]').forEach(function (element) {
      var screen = (data.platform || []).find(function (item) { return item.id === element.dataset.appTruthScreen; });
      if (screen) bindPlatformScreen(element, screen);
    });
    document.querySelectorAll('[data-app-truth-world]').forEach(function (element) {
      var wereld = data.worlds[element.dataset.appTruthWorld];
      if (wereld) bindWereld(element, wereld);
    });
    Object.keys(data.worlds).forEach(function (id) { bindPubliekeWereld(id, data.worlds[id]); });
    var wereldId = document.body.dataset.world;
    if (wereldId && data.worlds[wereldId]) bindWereldpagina(data.worlds[wereldId]);
    document.querySelectorAll('[data-app-truth-pass]').forEach(function (element) {
      var pas = data.passes[element.dataset.appTruthPass];
      if (pas) bindPas(element, pas);
    });
    var pasId = document.body.dataset.pass;
    if (pasId && data.passes[pasId]) bindPas(document.body, data.passes[pasId]);
    document.documentElement.dataset.websiteTruth = 'actueel';
    window.dispatchEvent(new CustomEvent('rtg-website-truth', { detail: data }));
  }

  window.RTGWebsiteTruthRefresh = toepassen;

  fetch(bron, { credentials: 'same-origin' })
    .then(function (antwoord) { if (!antwoord.ok) throw new Error('bron niet beschikbaar'); return antwoord.json(); })
    .then(toepassen)
    .catch(function () { document.documentElement.dataset.websiteTruth = 'terugval'; });
})();

/* Automatische UI-vertaling voor de volledige RTG-schermfamilie.

   De expliciete data-i18n-sleutels blijven de voorkeursroute: zij geven de
   redactie volledige controle. Deze laag vangt alles op wat nog geen sleutel
   heeft, inclusief tekst die een app later met JavaScript tekent. Hij bewaart
   altijd de oorspronkelijke DOM-waarde, vertaalt in groepen en zet bij een
   taalwissel zonder herladen de juiste bron opnieuw neer.

   Gebruikersinhoud, formulieren, code en expliciet uitgesloten delen gaan
   nooit naar de UI-vertaalroute. Zet `translate="no"`, `data-i18n-ignore` of
   `data-user-content` op een eigen component om dezelfde grens uit te spreken. */
(function (w) {
  'use strict';
  if (w.RTGAutoVertaling) return;

  var RTL = new Set(['ar', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi']);
  var ATTRS = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
  var NEGEER = 'script,style,noscript,template,code,pre,kbd,samp,svg,canvas,textarea,' +
    '[translate="no"],[data-i18n-ignore],[data-user-content],[contenteditable="true"],' +
    '[data-i18n],[data-i18n-html],.chat-bericht,.message-body,.bericht-tekst,.post-body,.review-text';
  var tekstMap = new WeakMap(), attribMap = new WeakMap();
  var tekstStaten = new Set(), attribStaten = new Set();
  var cache = new Map(), wortels = new Set();
  var taal = 'nl', beurt = 0, timer = null, waarnemer = null;
  var keten = Promise.resolve();
  var oorspronkelijkeRichting = document.documentElement.getAttribute('dir');
  var apiMeta = document.querySelector && document.querySelector('meta[name="rtg-api-base"]');
  var apiBasis = String(apiMeta && apiMeta.getAttribute('content') || '').replace(/\/+$/, '');
  function apiPad(pad) { return apiBasis + pad; }

  function letters(s) { return /[A-Za-zÀ-ÖØ-öø-ÿ\u0100-\uFFFF]/.test(s); }
  function kandidaat(s) {
    s = String(s == null ? '' : s).trim();
    if (s.length < 2 || s.length > 300 || !letters(s)) return false;
    if (/^(?:https?:|mailto:|tel:|data:|blob:|\/[-\w./]+$)/i.test(s)) return false;
    if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/.test(s)) return false;
    return true;
  }

  function uitgesloten(el, attribuut) {
    if (!el || el.nodeType !== 1) return true;
    try { if (el.closest(NEGEER)) return true; } catch (e) { return true; }
    if (attribuut === 'placeholder' && el.hasAttribute('data-i18n-ph')) return true;
    if (attribuut === 'title' && el.hasAttribute('data-i18n-title')) return true;
    if (attribuut === 'aria-label' && el.hasAttribute('data-i18n-aria')) return true;
    return false;
  }

  function delen(waarde) {
    var m = /^(\s*)([\s\S]*?)(\s*)$/.exec(String(waarde || ''));
    return { voor: m[1], bron: m[2], na: m[3] };
  }
  function vernieuwTekst(st, waarde) {
    var d = delen(waarde);
    st.bronVol = waarde; st.bron = d.bron; st.voor = d.voor; st.na = d.na; st.weergave = null;
  }
  function tekstStaat(node) {
    var st = tekstMap.get(node), nu = node.nodeValue || '';
    if (!st) {
      st = { soort: 'tekst', node: node, bronVol: '', bron: '', voor: '', na: '', weergave: null };
      vernieuwTekst(st, nu); tekstMap.set(node, st); tekstStaten.add(st);
    } else if (nu !== st.bronVol && nu !== st.weergave) vernieuwTekst(st, nu);
    return st;
  }
  function attribStaat(el, naam) {
    var perEl = attribMap.get(el);
    if (!perEl) { perEl = {}; attribMap.set(el, perEl); }
    var nu = el.getAttribute(naam) || '', st = perEl[naam];
    if (!st) {
      st = { soort: 'attribuut', el: el, naam: naam, bron: nu, weergave: null };
      perEl[naam] = st; attribStaten.add(st);
    } else if (nu !== st.bron && nu !== st.weergave) { st.bron = nu; st.weergave = null; }
    return st;
  }

  function voeg(groepen, st) {
    if (!kandidaat(st.bron)) return;
    var sleutel = taal + '\u0000' + st.bron;
    if (cache.has(sleutel)) return toon(st, cache.get(sleutel));
    if (!groepen.has(st.bron)) groepen.set(st.bron, new Set());
    groepen.get(st.bron).add(st);
  }
  function verzamelTekst(root, groepen) {
    if (!root) return;
    var bekijk = function (node) {
      if (!node || node.nodeType !== 3 || uitgesloten(node.parentElement)) return;
      voeg(groepen, tekstStaat(node));
    };
    if (root.nodeType === 3) bekijk(root);
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    var node;
    while ((node = walker.nextNode())) bekijk(node);
  }
  function verzamelAttributen(root, groepen) {
    if (!root || (root.nodeType !== 1 && root.nodeType !== 9)) return;
    var els = [];
    if (root.nodeType === 1) els.push(root);
    try { els = els.concat(Array.from(root.querySelectorAll('[' + ATTRS.join('],[') + ']'))); } catch (e) {}
    els.forEach(function (el) {
      ATTRS.forEach(function (naam) {
        if (el.hasAttribute(naam) && !uitgesloten(el, naam)) voeg(groepen, attribStaat(el, naam));
      });
      var type = String(el.getAttribute('type') || '').toLowerCase();
      if (el.tagName === 'INPUT' && /^(button|submit|reset)$/.test(type) && el.hasAttribute('value') && !uitgesloten(el, 'value'))
        voeg(groepen, attribStaat(el, 'value'));
    });
  }

  function toon(st, vertaling) {
    if (taal === 'nl' || !st || st.bron == null) return;
    vertaling = String(vertaling == null || vertaling === '' ? st.bron : vertaling);
    if (st.soort === 'tekst') {
      if (!st.node.isConnected) return;
      st.weergave = st.voor + vertaling + st.na;
      if (st.node.nodeValue !== st.weergave) st.node.nodeValue = st.weergave;
    } else {
      if (!st.el.isConnected) return;
      st.weergave = vertaling;
      if (st.el.getAttribute(st.naam) !== vertaling) st.el.setAttribute(st.naam, vertaling);
    }
  }

  function herstel() {
    tekstStaten.forEach(function (st) {
      if (!st.node.isConnected) return tekstStaten.delete(st);
      var nu = st.node.nodeValue || '';
      if (st.weergave != null && nu === st.weergave) st.node.nodeValue = st.bronVol;
      else if (nu !== st.bronVol) vernieuwTekst(st, nu);
      st.weergave = null;
    });
    attribStaten.forEach(function (st) {
      if (!st.el.isConnected) return attribStaten.delete(st);
      var nu = st.el.getAttribute(st.naam) || '';
      if (st.weergave != null && nu === st.weergave) st.el.setAttribute(st.naam, st.bron);
      else if (nu !== st.bron) st.bron = nu;
      st.weergave = null;
    });
  }

  function groepenVan(bronnen, groepen) {
    var uit = [], nu = [], tekens = 0;
    bronnen.forEach(function (bron) {
      if (nu.length && (nu.length >= 300 || tekens + bron.length > 18000)) {
        uit.push(nu); nu = []; tekens = 0;
      }
      nu.push(bron); tekens += bron.length;
    });
    if (nu.length) uit.push(nu);
    return uit.map(function (regels) { return { regels: regels, doelen: regels.map(function (r) { return groepen.get(r); }) }; });
  }

  function vraag(groep, gekozenTaal, gekozenBeurt) {
    var koppen = { 'Content-Type': 'application/json' };
    return fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: koppen,
      body: JSON.stringify({ naar: gekozenTaal, bron: location.pathname, teksten: groep.regels }) })
      .then(function (r) { if (!r.ok) throw new Error('ui-vertaling ' + r.status); return r.json(); })
      .then(function (d) {
        if (!d || d.naar !== gekozenTaal || !Array.isArray(d.teksten)) return;
        groep.regels.forEach(function (bron, i) {
          var vertaling = d.teksten[i] || bron;
          if (vertaling !== bron) cache.set(gekozenTaal + '\u0000' + bron, vertaling);
          if (taal === gekozenTaal && beurt === gekozenBeurt)
            groep.doelen[i].forEach(function (st) { if (st.bron === bron) toon(st, vertaling); });
        });
      });
  }

  function voerUit() {
    timer = null;
    if (taal === 'nl') return;
    var groepen = new Map(), lijst = Array.from(wortels); wortels.clear();
    if (!lijst.length) lijst = [document.documentElement];
    lijst.forEach(function (root) { verzamelTekst(root, groepen); verzamelAttributen(root, groepen); });
    if (!groepen.size) return;
    var gekozenTaal = taal, gekozenBeurt = beurt;
    groepenVan(Array.from(groepen.keys()), groepen).forEach(function (groep) {
      keten = keten.then(function () { return vraag(groep, gekozenTaal, gekozenBeurt); })
        .catch(function () { /* de brontekst blijft heel; een volgende DOM-wijziging probeert opnieuw */ });
    });
  }
  function plan(root) {
    if (root) wortels.add(root.nodeType === 3 ? root.parentElement : root);
    if (timer || taal === 'nl') return;
    timer = setTimeout(voerUit, 80);
  }

  function observeer() {
    if (waarnemer || !document.documentElement) return;
    try {
      waarnemer = new MutationObserver(function (muts) {
        muts.forEach(function (m) {
          if (m.type === 'characterData') plan(m.target);
          else if (m.type === 'attributes') plan(m.target);
          else Array.from(m.addedNodes || []).forEach(plan);
        });
      });
      waarnemer.observe(document.documentElement, { childList: true, subtree: true, characterData: true,
        attributes: true, attributeFilter: ATTRS.concat(['value']) });
    } catch (e) {}
  }

  function pasToe(nieuweTaal) {
    taal = /^[a-z]{2}$/.test(String(nieuweTaal || '')) ? nieuweTaal : 'nl';
    beurt++;
    if (RTL.has(taal)) document.documentElement.setAttribute('dir', 'rtl');
    else if (taal === 'nl' && oorspronkelijkeRichting == null) document.documentElement.removeAttribute('dir');
    else document.documentElement.setAttribute('dir', oorspronkelijkeRichting || 'ltr');
    document.documentElement.setAttribute('data-rtg-taal', taal);
    observeer();
    if (taal === 'nl') { if (timer) { clearTimeout(timer); timer = null; } wortels.clear(); herstel(); }
    else plan(document.documentElement);
  }

  w.RTGAutoVertaling = { apply: pasToe, scan: plan, kandidaat: kandidaat, rtl: RTL };
})(window);

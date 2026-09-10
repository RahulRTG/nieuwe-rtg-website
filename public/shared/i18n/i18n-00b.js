/* De LEZER van de automatische UI-vertaling voor de volledige RTG-schermfamilie.
   (Het tonen, opvragen en wisselen staat in i18n-00c.js: een IIFE, twee helften.)

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
  var wortels = new Set();
  var taal = 'nl', beurt = 0, timer = null, waarnemer = null;
  var eersteRonde = true;
  var keten = Promise.resolve();
  /* De voorraad vertalingen staat in i18n-00.js, in dezelfde bundel. Ontbreekt
     hij toch, dan werkt deze laag door zonder voorraad -- traag zoals vroeger,
     maar geen enkel scherm valt om op een ontbrekende kast. */
  var KAST = w.RTGVertaalKast || { van: function () { return new Map(); },
    zet: function () { return false; }, stand: function () { return { opslag: false, perTaal: {} }; } };
  /* De meegeleverde schil (i18n-00a.js): wat er offline al klaarstaat. Zelfde
     terugval als de kast -- ontbreekt hij, dan werkt deze laag door via het net. */
  var SCHIL = w.RTGTaalSchil || { van: function () { return new Map(); },
    laad: function () { return Promise.resolve(new Map()); } };
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
    var uitKast = KAST.van(taal).get(st.bron);
    if (uitKast != null) return toon(st, uitKast);
    /* Kast, dan schil, dan net. De kast is verser (hij kent ook schermen buiten
       de schil), de schil is breder bij een koude start, het net kost geld. */
    var uitSchil = SCHIL.van(taal).get(st.bron);
    if (uitSchil != null) return toon(st, uitSchil);
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

  /* Hier houdt de LEZER op. Wat hij verzamelde -- welke tekstknopen en welke
     attributen vertaald mogen worden, en met welke oorspronkelijke waarde --
     wordt in i18n-00c.js getoond, hersteld en opgevraagd. Een IIFE, twee
     bestanden: de bundel plakt ze terug aaneen (scripts/bundel.js). */

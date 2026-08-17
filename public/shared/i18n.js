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
/* ============================================================================
   RTG i18n, taalkeuze + automatische detectie voor de website en alle apps.

   Werking:
   - Nederlands is de basistaal: de tekst staat gewoon in de HTML.
   - Andere talen komen uit een woordenboek dat elke pagina zelf meegeeft via
     window.I18N = { en: { 'sleutel': 'vertaling', ... }, ... }.
   - Elementen krijgen data-i18n="sleutel" (tekst), data-i18n-html="sleutel"
     (met opmaak) of data-i18n-ph="sleutel" (placeholder).
   - Bij het eerste bezoek verschijnt een taalkeuze; de taal van het toestel
     (navigator.language) staat voorgeselecteerd. De keuze wordt onthouden.
   - JS-gerenderde schermen kunnen luisteren naar het 'rtglang'-event en
     RTGi18n.t('sleutel', 'standaard') gebruiken.
   ========================================================================== */
(function () {
  if (window.__rtgI18nActief) return;
  window.__rtgI18nActief = true;
  const STORE = 'rtg_lang';
  const apiMeta = document.querySelector('meta[name="rtg-api-base"]');
  const assetMeta = document.querySelector('meta[name="rtg-asset-base"]');
  const API_BASIS = String(apiMeta && apiMeta.getAttribute('content') || '').replace(/\/+$/, '');
  const ASSET_BASIS = String(assetMeta && assetMeta.getAttribute('content') || '').replace(/\/+$/, '');
  const apiPad = pad => API_BASIS + pad;
  const assetPad = pad => ASSET_BASIS + pad;
  const LANGS = {
    nl: { label: 'Nederlands', native: 'Nederlands' },
    en: { label: 'Engels', native: 'English' }
  };
  /* Wereldtalen: de Boardroom bepaalt welke talen aanstaan; de kiezer toont ze
     allemaal. UI-teksten vallen voor andere talen terug op Engels; chats en
     berichten worden door de server echt per taal vertaald. */
  let WERELD = null; // [{code, naam, en}] uit /api/talen
  function supported() { return WERELD ? WERELD.map(t => t.code) : Object.keys(LANGS); }
  const orig = new WeakMap(); // element -> { text, html, ph }

  /* ---------- vlaggen: elke taal krijgt een representatief land ----------
     De 114 talen tonen we als landvlaggen. Een taal is geen land, dus we kiezen
     per taal het land waar hij het meest thuis is; puur als beeld, geen politiek
     statement. Uit de ISO-landcode bouwen we het vlag-emoji (regionale-indicator
     -tekens), dus we bewaren nergens plaatjes. */
  const LAND = {
    nl: 'NL', en: 'GB', de: 'DE', fr: 'FR', es: 'ES', pt: 'PT', it: 'IT', ca: 'ES', gl: 'ES', eu: 'ES',
    ro: 'RO', el: 'GR', tr: 'TR', ru: 'RU', uk: 'UA', be: 'BY', pl: 'PL', cs: 'CZ', sk: 'SK', hu: 'HU',
    bg: 'BG', sr: 'RS', hr: 'HR', bs: 'BA', sl: 'SI', mk: 'MK', sq: 'AL', lt: 'LT', lv: 'LV', et: 'EE',
    fi: 'FI', sv: 'SE', no: 'NO', da: 'DK', is: 'IS', ga: 'IE', cy: 'GB', mt: 'MT', lb: 'LU', fy: 'NL',
    yi: 'IL', ar: 'SA', he: 'IL', fa: 'IR', ku: 'IQ', az: 'AZ', hy: 'AM', ka: 'GE', kk: 'KZ', uz: 'UZ',
    ky: 'KG', tg: 'TJ', tk: 'TM', mn: 'MN', tt: 'RU', hi: 'IN', ur: 'PK', bn: 'BD', pa: 'IN', gu: 'IN',
    mr: 'IN', ta: 'IN', te: 'IN', kn: 'IN', ml: 'IN', si: 'LK', ne: 'NP', ps: 'AF', sd: 'PK', or: 'IN',
    as: 'IN', dv: 'MV', bo: 'CN', zh: 'CN', ja: 'JP', ko: 'KR', th: 'TH', vi: 'VN', id: 'ID', jv: 'ID',
    su: 'ID', ms: 'MY', tl: 'PH', km: 'KH', lo: 'LA', my: 'MM', ug: 'CN', sw: 'KE', am: 'ET', ti: 'ER',
    om: 'ET', so: 'SO', ha: 'NG', yo: 'NG', ig: 'NG', zu: 'ZA', xh: 'ZA', af: 'ZA', st: 'ZA', sn: 'ZW',
    rw: 'RW', mg: 'MG', wo: 'SN', ln: 'CD', ny: 'MW', lg: 'UG', ht: 'HT', qu: 'PE', gn: 'PY', ay: 'BO',
    mi: 'NZ', sm: 'WS', to: 'TO', fj: 'FJ'
  };
  // Geen vlag-emoji's: elke taal draagt haar eigen ISO-code in een ingetogen,
  // goud-omlijnd plaatje - rustiger en volwassener dan een rij vlaggetjes.
  function vlag(code) {
    return '<span class="rtg-lang-code">' + String(code || '').toUpperCase() + '</span>';
  }
  // kleine, in huisstijl getekende tekens (geen emoji), currentColor volgend
  const ICOON = {
    mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0"/><path d="M12 17v3.5"/></svg>',
    spark: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M12 2c.5 4.6 2.4 6.5 7 7-4.6.5-6.5 2.4-7 7-.5-4.6-2.4-6.5-7-7 4.6-.5 6.5-2.4 7-7z"/></svg>',
    globe: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3.2 3 14.8 0 18M12 3c-3 3.2-3 14.8 0 18"/></svg>'
  };
  // veelgebruikte land-/taalnamen die Rahul moet herkennen (genormaliseerd:
  // kleine letters, accenten eraf). De rest matcht op de eigen naam + Engelse naam.
  const ALIAS = {
    nederland: 'nl', holland: 'nl', netherlands: 'nl', vlaanderen: 'nl', belgie: 'nl', belgium: 'nl', suriname: 'nl',
    engeland: 'en', england: 'en', britain: 'en', uk: 'en', amerika: 'en', america: 'en', usa: 'en', australie: 'en', australia: 'en', canada: 'en', ierland: 'en', ireland: 'en',
    duitsland: 'de', germany: 'de', deutschland: 'de', oostenrijk: 'de', austria: 'de', zwitserland: 'de', switzerland: 'de',
    frankrijk: 'fr', france: 'fr',
    spanje: 'es', spain: 'es', espana: 'es', mexico: 'es', argentinie: 'es', argentina: 'es', colombia: 'es', chili: 'es', peru: 'es',
    portugal: 'pt', brazilie: 'pt', brazil: 'pt', brasil: 'pt',
    italie: 'it', italy: 'it', italia: 'it',
    griekenland: 'el', greece: 'el',
    turkije: 'tr', turkey: 'tr', turkiye: 'tr',
    rusland: 'ru', russia: 'ru', oekraine: 'uk', ukraine: 'uk', polen: 'pl', poland: 'pl',
    japan: 'ja', nippon: 'ja', china: 'zh', chinees: 'zh', chinese: 'zh', mandarijn: 'zh', mandarin: 'zh', taiwan: 'zh',
    korea: 'ko', india: 'hi', bharat: 'hi', pakistan: 'ur',
    marokko: 'ar', morocco: 'ar', egypte: 'ar', egypt: 'ar', dubai: 'ar', arabisch: 'ar', arabic: 'ar', saoedi: 'ar',
    iran: 'fa', perzie: 'fa', persia: 'fa', israel: 'he', hebreeuws: 'he', hebrew: 'he',
    indonesie: 'id', indonesia: 'id', bali: 'id', thailand: 'th', vietnam: 'vi', filipijnen: 'tl', philippines: 'tl', maleisie: 'ms', malaysia: 'ms',
    zweden: 'sv', sweden: 'sv', noorwegen: 'no', norway: 'no', denemarken: 'da', denmark: 'da', finland: 'fi', ijsland: 'is', iceland: 'is',
    zuidafrika: 'af', kenia: 'sw', kenya: 'sw', tanzania: 'sw', ethiopie: 'am', ethiopia: 'am', nigeria: 'yo'
  };

  function detectDevice() {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'nl'];
    for (const raw of list) {
      const code = String(raw || '').toLowerCase().slice(0, 2);
      if (supported().includes(code)) return code;
    }
    return 'en'; // geen match: standaard Engels
  }

  const RTGi18n = {
    lang: 'nl',
    chosen: false,
    // UI-woordenboek: eigen taal als die er is, anders Engels (internationale
    // terugval); Nederlands staat gewoon in de HTML zelf.
    dict(lang) {
      const all = window.I18N || {};
      return all[lang] || (lang !== 'nl' ? all.en : null) || {};
    },
    t(key, fallback) {
      if (this.lang === 'nl') return fallback != null ? fallback : key;
      const v = this.dict(this.lang)[key];
      return v != null ? v : (fallback != null ? fallback : key);
    },

    apply(lang) {
      lang = /^[a-z]{2}$/.test(String(lang || '')) ? lang : 'nl';
      this.lang = lang;
      document.documentElement.setAttribute('lang', lang);
      if (lang !== 'nl' && lang !== 'en') this.laadWereldDict(lang);
      const d = this.dict(lang);

      document.querySelectorAll('[data-i18n]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.text == null) o.text = el.textContent;
        const val = d[el.getAttribute('data-i18n')];
        el.textContent = (val != null && lang !== 'nl') ? val : o.text;
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.html == null) o.html = el.innerHTML;
        const val = d[el.getAttribute('data-i18n-html')];
        el.innerHTML = (val != null && lang !== 'nl') ? val : o.html;
      });

      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.ph == null) o.ph = el.getAttribute('placeholder') || '';
        const val = d[el.getAttribute('data-i18n-ph')];
        el.setAttribute('placeholder', (val != null && lang !== 'nl') ? val : o.ph);
      });

      // Ook tekst zonder handmatig woordenboeksleuteltje en later door JS
      // getekende interface gaat via de centrale, gebatchte vangnetlaag.
      if (window.RTGAutoVertaling) window.RTGAutoVertaling.apply(lang);

      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtglang', { detail: { lang } }));
    },

    set(lang, remember) {
      if (remember !== false) { try { localStorage.setItem(STORE, lang); } catch (e) {} this.chosen = true; }
      this.apply(lang);
    },

    /* Wereldtaal-woordenboeken: voor elke taal buiten nl/en halen we het
       UI-woordenboek van DEZE pagina live vertaald op (/api/vertaal/ui) en
       bewaren het op het toestel. Zo draait elke pagina volledig in elke
       actieve wereldtaal; zonder AI-sleutel valt de server terug op het
       woordenboek en blijft de Engelse tekst staan waar hij het niet weet
       (nooit een kapot scherm). */
    _wereldDict: {},
    laadWereldDict(lang) {
      if (lang === 'nl' || lang === 'en' || this._wereldDict[lang]) return;
      const all = window.I18N || {};
      if (all[lang]) return; // de pagina bracht dit woordenboek zelf mee
      const en = all.en || {};
      const keys = Object.keys(en).slice(0, 400);
      if (!keys.length) return;
      this._wereldDict[lang] = true;
      const ck = 'rtg_ui_' + lang + '_' + location.pathname.replace(/\W+/g, '') + '_' + keys.length;
      const zet = (d) => {
        window.I18N = window.I18N || {};
        window.I18N[lang] = d;
        if (this.lang === lang) this.apply(lang); // opnieuw toepassen zodra hij er is
      };
      let dict = null;
      try { dict = JSON.parse(localStorage.getItem(ck) || 'null'); } catch (e) {}
      if (dict) return zet(dict);
      fetch(apiPad('/api/vertaal/ui'), { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ naar: lang, teksten: keys.map(k => en[k]) }) })
        .then(r => r.json())
        .then(d => {
          if (!d || d.naar !== lang || !Array.isArray(d.teksten)) return;
          const uit = {};
          keys.forEach((k, i) => { uit[k] = d.teksten[i] || en[k]; });
          try { localStorage.setItem(ck, JSON.stringify(uit)); } catch (e) {}
          zet(uit);
        })
        .catch(() => { this._wereldDict[lang] = false; });
    },

    /* ---------- taalkeuze: de wereld in RTG-stijl ----------
       Rahuls signatuurlippen in het midden, alle landvlaggen eromheen, en een
       AI-zoekje: zeg waar je vandaan komt of welke taal je spreekt, en Rahul
       kiest mee. Dezelfde donkere, ingetogen huisstijl als de app-poort. */
    zoekTaal(q) {
      const lijst = this._lijst || [];
      const n = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
      const qq = n(q);
      if (!qq) return { code: null, set: new Set(lijst.map(t => t.code)) };
      const set = new Set(); let best = null, bestScore = 0;
      const weeg = (code, sc) => { set.add(code); if (sc > bestScore) { bestScore = sc; best = code; } };
      for (const t of lijst) {
        const naam = n(t.naam), en = n(t.en || ''), code = t.code, iso = (LAND[code] || '').toLowerCase();
        let sc = 0;
        if (code === qq) sc = 100;
        else if (naam === qq || en === qq) sc = 92;
        else if (naam.startsWith(qq)) sc = 82;
        else if (en.startsWith(qq)) sc = 74;
        else if (naam.includes(qq)) sc = 60;
        else if (en.includes(qq)) sc = 52;
        else if (iso === qq) sc = 40;
        if (sc > 0) weeg(code, sc);
      }
      // land-/bijnamen: "holland", "japan", "brazilie" -> de juiste taal
      for (const k in ALIAS) {
        if (k === qq || k.includes(qq) || qq.includes(k)) {
          const c = ALIAS[k];
          if (lijst.some(t => t.code === c)) weeg(c, k === qq ? 96 : 66);
        }
      }
      return { code: best, set };
    },
    buildModal(recommended) {
      const oud = document.getElementById('rtg-lang-modal');
      const stondOpen = oud && oud.classList.contains('open');
      if (oud) oud.remove(); // opnieuw opbouwen zodra de wereldtalen binnen zijn
      this._mond = null; // het oude canvas is weg
      const scrim = document.createElement('div');
      scrim.id = 'rtg-lang-modal';
      scrim.className = 'rtg-lang-scrim';
      scrim.setAttribute('data-i18n-ignore', '');
      // de matcher kent de HELE wereld (alle 114) als die binnen is; anders de
      // actieve set. Er staan geen vlagknoppen meer: je kiest door te typen of
      // te spreken, Rahul herkent je land of taal en stelt hem voor.
      this._lijst = this._alleTalen || WERELD || Object.keys(LANGS).map(c => ({ code: c, naam: LANGS[c].native, en: LANGS[c].label }));
      this._aanbevolen = recommended || 'en';
      const kanSpreken = !!(window.SpeechRecognition || window.webkitSpeechRecognition);
      scrim.innerHTML =
        '<div class="rtg-lang-card" role="dialog" aria-modal="true" aria-label="Choose your language / Kies je taal">' +
          '<canvas class="rtg-lang-mond" id="rtg-lang-mond" width="440" height="200" aria-hidden="true"></canvas>' +
          '<h2>Where in the world are you?</h2>' +
          '<p>Type or say your language &middot; Rahul switches for you</p>' +
          '<div class="rtg-lang-ai">' +
            (kanSpreken ? '<button type="button" id="rtg-lang-mic" aria-label="Speak your language / Spreek je taal">' + ICOON.mic + '</button>' : '') +
            '<input id="rtg-lang-zoek" autocomplete="off" enterkeyhint="go" ' +
              'aria-label="Type your country or language / Typ je land of taal" ' +
              'placeholder="Say or type where you&rsquo;re from&hellip;">' +
            '<button type="button" id="rtg-lang-rahul" aria-label="Let Rahul choose / Laat Rahul kiezen">' + ICOON.spark + '</button>' +
          '</div>' +
          '<button type="button" class="rtg-lang-hint" id="rtg-lang-hint" hidden></button>' +
        '</div>';
      document.body.appendChild(scrim);

      const zoek = scrim.querySelector('#rtg-lang-zoek');
      const hint = scrim.querySelector('#rtg-lang-hint');
      const self = this;
      // toon Rahuls voorstel (geen knoppenlijst): een vlag + de naam, aantikbaar
      const stelVoor = () => {
        const res = self.zoekTaal(zoek.value.trim());
        if (!zoek.value.trim() || !res.code) {
          hint.hidden = true; hint.removeAttribute('data-lang');
          if (zoek.value.trim()) { hint.hidden = false; hint.removeAttribute('data-lang'); hint.innerHTML = '<span class="rtg-lang-mis">Hmm, not sure yet &mdash; try a country or language.</span>'; }
          return;
        }
        const t = self._lijst.find(x => x.code === res.code) || {};
        hint.hidden = false;
        hint.setAttribute('data-lang', res.code);
        hint.innerHTML = vlag(res.code) +
          '<span class="rtg-lang-sug"><b>' + String(t.naam || res.code).replace(/[<>]/g, '') + '</b>' +
          '<span class="rtg-lang-go">tap to continue &middot; tik om verder te gaan</span></span>';
      };
      const kies = (code) => {
        code = code || self.zoekTaal(zoek.value.trim()).code || self._aanbevolen;
        if (code) { self.set(code); self.closeModal(); }
      };
      zoek.addEventListener('input', stelVoor);
      zoek.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); kies(); } });
      scrim.querySelector('#rtg-lang-rahul').addEventListener('click', () => kies());
      hint.addEventListener('click', () => kies(hint.getAttribute('data-lang')));
      // spreken: de eigen stem invullen en meteen laten herkennen
      const mic = scrim.querySelector('#rtg-lang-mic');
      if (mic) mic.addEventListener('click', () => self._luister(zoek, stelVoor, kies, mic));

      // De keuze mag nooit de pagina gijzelen: klik ernaast = huidige taal houden.
      scrim.addEventListener('click', e => { if (e.target === scrim) { self.set(self.lang); self.closeModal(); } });
      if (!this._escBound) { // een keer, niet per herbouw
        this._escBound = true;
        document.addEventListener('keydown', e => {
          const m = document.getElementById('rtg-lang-modal');
          if (e.key === 'Escape' && m && m.classList.contains('open')) { this.set(this.lang); this.closeModal(); }
        });
      }
      if (stondOpen) { scrim.classList.add('open'); this._startMond(); }
    },
    // spreken -> tekst (Web Speech API, geen afhankelijkheden). Lukt het niet,
    // dan gebeurt er gewoon niets bijzonders; typen blijft altijd werken.
    _luister(zoek, stelVoor, kies, mic) {
      const R = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!R) return;
      try {
        const rec = new R();
        rec.lang = (navigator.language || 'en'); rec.interimResults = false; rec.maxAlternatives = 1;
        mic.classList.add('luistert');
        rec.onresult = (ev) => {
          const tekst = (ev.results && ev.results[0] && ev.results[0][0] && ev.results[0][0].transcript) || '';
          if (tekst) { zoek.value = tekst; stelVoor(); const code = this.zoekTaal(tekst).code; if (code) kies(code); }
        };
        rec.onend = () => mic.classList.remove('luistert');
        rec.onerror = () => mic.classList.remove('luistert');
        rec.start();
      } catch (e) { mic.classList.remove('luistert'); }
    },
    // de signatuurlippen: pas laden/tekenen zodra de kiezer echt getoond wordt
    _startMond() {
      const c = document.getElementById('rtg-lang-mond');
      if (!c || this._mond) return;
      const go = () => { if (window.RTGMond && !this._mond) this._mond = window.RTGMond.maak(c); };
      if (window.RTGMond) go();
      else if (!this._mondLaadt) {
        this._mondLaadt = true;
        const s = document.createElement('script'); s.src = assetPad('/shared/mond.js'); s.async = true;
        s.onload = go; document.head.appendChild(s);
      }
      this._startSterren();
    },
    // een heel subtiele 3D-sterrenhemel achter de kaart, in RTG-stijl
    _startSterren() {
      const scrim = document.getElementById('rtg-lang-modal');
      if (!scrim || this._sterren) return;
      const go = () => { if (window.RTGSterren && !this._sterren) this._sterren = window.RTGSterren.hang(scrim, { helderheid: 0.85 }); };
      if (window.RTGSterren) return go();
      if (this._sterLaadt) return;
      this._sterLaadt = true;
      const s = document.createElement('script'); s.src = assetPad('/shared/sterren.js'); s.async = true;
      s.onload = go; document.head.appendChild(s);
    },
    openModal() {
      if (!document.getElementById('rtg-lang-modal')) this.buildModal(this.chosen ? this.lang : (this._aanbevolen || detectDevice()));
      const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open');
      this._startMond();
      const z = document.getElementById('rtg-lang-zoek');
      if (z) setTimeout(() => { try { z.focus(); } catch (e) {} }, 80);
    },
    closeModal() { const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.remove('open'); },

    /* ---------- de taalkeuze heropenen ----------
       De taalknop zweefde linksonder op elk scherm, boven op de themakiezer en
       het vraagteken. Taal is een instelling, dus hij staat nu waar de andere
       instellingen staan: in het bedieningspaneel (shared/bediening.js), dat
       openModal() aanroept. Het leden-OS deed dit al met de tegel "Taal". */
    buildSwitch() { /* geen zwevende knop meer; zie het bedieningspaneel */ },
    /* updateSwitch bijgewerkt de knop die er niet meer is. Hij zocht nog naar
       #rtg-lang-switch, en dat element staat sinds de verhuizing naar het
       bedieningspaneel op geen enkele pagina meer -- de blindevlek-toets ving
       het. Het paneel leest de taal vers uit bij elke opening (vulTaal in
       shared/bediening.js), dus er valt hier niets bij te werken. De methode
       blijft bestaan omdat applyTranslations() hem aanroept en losse pagina's
       hem kunnen overschrijven; hij doet alleen niets meer. */
    updateSwitch() { /* geen zwevende knop meer; het paneel leest zelf uit */ },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
        background:radial-gradient(120% 90% at 50% 0%,rgba(62,20,32,0.6),rgba(12,12,11,0.92) 60%);
        backdrop-filter:blur(10px);padding:1.1rem;-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card{width:100%;max-width:720px;max-height:92vh;display:flex;flex-direction:column;
        background:linear-gradient(180deg,#141110,#0C0C0B);color:#F5F3EF;border:1px solid rgba(201,162,75,0.22);
        border-radius:22px;padding:1.2rem 1.3rem 1rem;text-align:center;box-shadow:0 40px 120px rgba(0,0,0,0.6);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:rtgLangIn .4s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(16px) scale(.98);}to{opacity:1;transform:none;}}
      .rtg-lang-mond{display:block;width:200px;height:90px;margin:0.1rem auto -0.15rem;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:1.55rem;margin:0.1rem 0 0.1rem;letter-spacing:-0.01em;color:#F7F3EC;}
      .rtg-lang-card p{color:#B8B2A8;font-size:0.8rem;margin:0 0 0.85rem;}
      .rtg-lang-ai{display:flex;align-items:center;gap:0.45rem;background:rgba(255,255,255,0.05);
        border:1px solid rgba(222,219,213,0.16);border-radius:13px;padding:0.1rem 0.1rem 0.1rem 0.9rem;
        margin:0 auto 0.5rem;max-width:520px;width:100%;transition:border-color .18s;}
      .rtg-lang-ai:focus-within{border-color:#C9A24B;}
      .rtg-lang-ai input{flex:1;min-width:0;background:none;border:none;outline:none;color:#F5F3EF;
        font-family:inherit;font-size:0.92rem;padding:0.7rem 0;}
      .rtg-lang-ai input::placeholder{color:#8A8680;}
      .rtg-lang-ai button{flex:none;background:linear-gradient(180deg,#9E1C40,#7F1634);color:#fff;border:none;cursor:pointer;
        border-radius:10px;padding:0.55rem 0.72rem;font-size:1rem;line-height:1;transition:filter .18s,transform .12s;}
      .rtg-lang-ai button:hover{filter:brightness(1.14);}
      .rtg-lang-ai button:active{transform:scale(0.95);}
      #rtg-lang-mic{background:rgba(255,255,255,0.08);}
      #rtg-lang-mic.luistert{background:linear-gradient(180deg,#C23A5E,#9E1C40);animation:rtgMic 1.1s ease-in-out infinite;}
      @keyframes rtgMic{0%,100%{box-shadow:0 0 0 0 rgba(194,58,94,0.5);}50%{box-shadow:0 0 0 6px rgba(194,58,94,0);}}
      /* Rahuls voorstel: geen knoppenlijst, maar een enkele aantikbare regel */
      .rtg-lang-hint{display:flex;align-items:center;gap:0.7rem;width:100%;max-width:520px;margin:0.1rem auto 0.2rem;
        background:rgba(201,162,75,0.08);border:1px solid rgba(201,162,75,0.3);border-radius:13px;
        padding:0.55rem 0.9rem;cursor:pointer;text-align:left;font-family:inherit;color:#EDE9E2;
        transition:border-color .16s,background .16s,transform .12s;}
      .rtg-lang-hint:hover{border-color:#F5E6B8;background:rgba(201,162,75,0.14);}
      .rtg-lang-hint:active{transform:scale(0.99);}
      .rtg-lang-hint[hidden]{display:none;}
      .rtg-lang-flag{font-size:1.7rem;line-height:1;}
      .rtg-lang-sug{display:flex;flex-direction:column;line-height:1.2;}
      .rtg-lang-sug b{color:#F7F3EC;font-weight:600;font-size:0.98rem;}
      .rtg-lang-go{font-size:0.66rem;letter-spacing:0.04em;color:#C9A24B;}
      .rtg-lang-mis{color:#8A8680;font-size:0.82rem;}
      .rtg-lang-code{display:inline-block;min-width:1.7rem;font-size:0.6rem;font-weight:700;letter-spacing:0.05em;
        color:#C9A24B;border:1px solid rgba(201,162,75,0.4);border-radius:6px;padding:0.3rem 0.2rem;text-align:center;}
      .rtg-lang-switch{position:fixed;left:14px;bottom:14px;z-index:9990;display:inline-flex;align-items:center;gap:0.35rem;
        background:rgba(12,12,11,0.82);color:#fff;border:1px solid rgba(255,255,255,0.16);border-radius:999px;
        padding:0.42rem 0.8rem;font-family:'Inter',-apple-system,sans-serif;font-size:0.72rem;font-weight:600;
        letter-spacing:0.04em;cursor:pointer;backdrop-filter:blur(8px);box-shadow:0 6px 20px rgba(0,0,0,0.25);
        transition:background .18s;padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));}
      .rtg-lang-switch:hover{background:#7F1634;border-color:#7F1634;}
      .rtg-sw-globe{font-size:0.9rem;}
      @media print{.rtg-lang-switch{display:none;}}
      /* Toegankelijkheid: wie in het systeem "beperk beweging" aan heeft, krijgt
         geen animaties of lange overgangen. 0.01ms i.p.v. 0 zodat code die op
         transitionend/animationend wacht gewoon blijft doorlopen. */
      @media (prefers-reduced-motion: reduce){
        *,*::before,*::after{
          animation-duration:.01ms!important;animation-iteration-count:1!important;
          transition-duration:.01ms!important;scroll-behavior:auto!important;
        }
      }
      `;
      document.head.appendChild(s);
    },

    /* De actieve wereldtalen ophalen (Boardroom-schakelaars). Faalt dit (bijv.
       op de noodserver), dan blijven Nederlands en Engels gewoon werken. */
    laadTalen() {
      return fetch(apiPad('/api/talen'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen; // de actieve set (voor de vertaling)
            // de matcher kent meteen de HELE wereld (alle 114) voor typen/spreken
            this._alleTalen = (Array.isArray(d.alle) && d.alle.length) ? d.alle : d.talen;
            this._lijst = this._alleTalen;
            // De site volgt de telefooninstelling: nu de hele wereld bekend is,
            // kiezen we alsnog de toesteltaal (bijv. Duits of Japans), tenzij het
            // lid zelf al een taal heeft gekozen. Engels blijft de terugval.
            if (!this.chosen) {
              const codes = this._alleTalen.map(t => t.code);
              const dev = detectDevice(codes);
              if (dev && dev !== this.lang) this.apply(dev);
              this._aanbevolen = dev;
            }
            const m = document.getElementById('rtg-lang-modal');
            if (!m || !m.classList.contains('open')) this.buildModal(this._aanbevolen || this.lang);
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      // De site volgt standaard de TELEFOON-/toestelinstelling (navigator.language);
      // kan hij die taal (nog) niet, dan Engels als terugval. Er is geen gedwongen
      // taalkeuze: wie wil wisselen opent de kiezer (de wereldbol linksonder) en
      // typt of spreekt zijn taal. Een eerder gemaakte keuze blijft bewaard.
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(detectDevice()); // toesteltaal onder nl/en; laadTalen verruimt straks naar alle 114
      }
      this.buildSwitch();
      this.laadTalen();
    }
  };

  window.RTGi18n = RTGi18n;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => RTGi18n.init());
  } else {
    RTGi18n.init();
  }
})();

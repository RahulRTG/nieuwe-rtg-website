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
  /* Waar de API woont. Normaal op dezelfde oorsprong -- dat klopt op de
     RTG-server, op localhost en bij een eigen installatie. Maar de publieke
     verhaalpagina's (public/site/) worden OOK van een statische voordeur
     geserveerd, en daar ligt geen API: dan wijzen we naar de app. Een vaste
     meta in die pagina's kan niet, want dan zou een eigen installatie zijn
     vertalingen bij ons ophalen. De lijst staat in server/lib/voordeuren.js;
     test/i18n-auto.test.js zakt zodra deze twee uit elkaar lopen. */
  const STATISCHE_VOORDEUREN = ['https://rahulrtg.github.io', 'https://rahultravelgroup.com', 'https://www.rahultravelgroup.com'];
  const APP_OORSPRONG = 'https://app.rahultravelgroup.com';
  const API_BASIS = String(
    (apiMeta && apiMeta.getAttribute('content')) ||
    (STATISCHE_VOORDEUREN.indexOf(location.origin) >= 0 ? APP_OORSPRONG : '') || ''
  ).replace(/\/+$/, '');
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
  let WERELD = window.RTGWereldTalen || null; // [{code, naam, en}] uit /api/talen
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

  function detectDevice(codes) {
    const list = (navigator.languages && navigator.languages.length)
      ? navigator.languages : [navigator.language || 'nl'];
    for (const raw of list) {
      const code = String(raw || '').toLowerCase().slice(0, 2);
      if ((codes || supported()).includes(code)) return code;
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
      return lang === 'nl' ? (all.nl || {}) : Object.assign({}, all.en || {}, all[lang] || {});
    },
    _usedKeys: new Set(),
    t(key, fallback) {
      this._usedKeys.add(key);
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
        const key=el.getAttribute('data-i18n');
        if (o.text == null || o.key !== key) { o.text=el.getAttribute('data-i18n-source') || el.textContent; o.key=key; }
        const val = d[el.getAttribute('data-i18n')];
        const policy=window.RTGAccessMeaning;
        if(policy && (key.startsWith('access.') || key.startsWith('onb.'))) {
          const projection=policy.projection(key,o.text,(window.I18N || {}).en && window.I18N.en[key],lang,val);
          el.textContent=projection.text; if(projection.fallback) el.setAttribute('lang',projection.language); else el.removeAttribute('lang');
        } else el.textContent = (val != null && lang !== 'nl') ? val : o.text;
      });

      document.querySelectorAll('[data-i18n-html]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.html == null) o.html = el.innerHTML;
        const val = d[el.getAttribute('data-i18n-html')];
        el.innerHTML = (val != null && lang !== 'nl') ? val : o.html;
      });

      for (const [binding,attribute] of [['data-i18n-aria','aria-label'],['data-i18n-title','title']]) {
        document.querySelectorAll('['+binding+']').forEach(el=>{
          if(!orig.has(el)) orig.set(el,{});
          const o=orig.get(el); if(o[attribute]==null) o[attribute]=el.getAttribute(attribute) || '';
          const value=d[el.getAttribute(binding)];
          el.setAttribute(attribute,lang!=='nl' && value!=null ? value:o[attribute]);
        });
      }

      document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        if (!orig.has(el)) orig.set(el, {});
        const o = orig.get(el);
        if (o.ph == null) o.ph = el.getAttribute('placeholder') || '';
        const val = d[el.getAttribute('data-i18n-ph')];
        el.setAttribute('placeholder', (val != null && lang !== 'nl') ? val : o.ph);
      });

      // Ook tekst zonder handmatig woordenboeksleuteltje en later door JS
      // getekende interface gaat via de centrale, gebatchte vangnetlaag.
      // Activeer dat vangnet pas na een opgeslagen of expliciete taalkeuze:
      // de voorgeselecteerde toestel-taal mag een Nederlandstalig scherm niet
      // al op de achtergrond half vertalen voordat de bezoeker kiest.
      if (window.RTGAutoVertaling) window.RTGAutoVertaling.apply(this.chosen ? lang : 'nl');

      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtglang', { detail: { lang } }));
    },

    set(lang, remember) {
      if (remember !== false) { try { localStorage.setItem(STORE, lang); } catch (e) {} this.chosen = true; }
      const state=this._wereldDict[lang];
      if (state && !state.pending) state.tried.clear();
      this.apply(lang);
    },

    /* Wereldtaal-woordenboeken: voor elke taal buiten nl/en halen we het
       UI-woordenboek van DEZE pagina live vertaald op (/api/vertaal/ui). Zo
       draait elke pagina volledig in elke actieve wereldtaal; zonder AI-sleutel
       valt de server terug op het woordenboek en blijft de Engelse tekst staan
       waar hij het niet weet (nooit een kapot scherm).

       DIT WAS EEN TWEEDE OPSLAG, EN DAT KOSTTE TWEE KEER. De cachesleutel
       droeg het PAD van de pagina, dus "Opslaan" op scherm A en "Opslaan" op
       scherm B waren twee vertalingen: twee keer een modelaanroep, twee keer
       bewaard, en op de tweede pagina toch weer wachten. Het gaat nu langs
       dezelfde kast als de automatische laag (i18n-00.js), en die kent geen
       paden -- alleen taal en bron. Wat er al ligt kost daarmee GEEN aanvraag,
       ook niet de eerste keer dat dit scherm wordt geopend.

       EN HIJ VRAAGT ALLEEN WAT HIJ MIST. Van vierhonderd sleutels zijn er op de
       tweede pagina meestal een handvol nieuw; de rest komt uit de kast. */
    _wereldDict: {},
    async laadWereldDict(lang) {
      if (lang === 'nl' || lang === 'en') return;
      const state = this._wereldDict[lang] || (this._wereldDict[lang] = { pending:false, tried:new Map() });
      if (state.pending) return;
      const en = (window.I18N || {}).en || {};
      const own = (window.I18N || {})[lang] || {};
      const kast = window.RTGVertaalKast;
      const keys = Object.keys(en).filter(k => typeof en[k] === 'string' && en[k].length <= 300 &&
        !(window.RTGAccessMeaning && (k.startsWith('access.') || k.startsWith('onb.')) &&
          ['decision','legal'].includes(window.RTGAccessMeaning.risk(k))) &&
        own[k] == null && state.tried.get(k) !== en[k]);
      if (!keys.length) return;
      // The visible screen is first; every remaining key still has a bounded batch.
      keys.sort((a,b)=>Number(this._usedKeys.has(b))-Number(this._usedKeys.has(a)));
      state.pending = true;
      const out = {}, groups = [];
      let group = [], size = 0;
      keys.forEach(k => {
        const known = kast ? kast.lees(lang,en[k]) : null;
        if (known != null) { out[k]=known; return; }
        if (group.length && (group.length >= 100 || size + en[k].length > 18000)) {
          groups.push(group); group=[]; size=0;
        }
        group.push(k); size+=en[k].length;
      });
      if (group.length) groups.push(group);
      const publish = () => {
        window.I18N=window.I18N || {};
        window.I18N[lang]=Object.assign({},window.I18N[lang] || {},out);
        if (this.lang === lang) this.apply(lang);
      };
      if (Object.keys(out).length) publish();
      try {
        for (const batch of groups) {
          if (this.lang !== lang) break;
          const response = await fetch(apiPad('/api/vertaal/ui'), {method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({naar:lang,teksten:batch.map(k=>en[k])})});
          if (!response.ok) throw new Error('UI translation '+response.status);
          const data=await response.json();
          if (!data || data.naar!==lang || !Array.isArray(data.teksten) || data.teksten.length!==batch.length)
            throw new Error('Incomplete UI translation');
          batch.forEach((k,i)=>{
            state.tried.set(k,en[k]);
            const value=data.teksten[i];
            // An unchanged source is a fallback, never a completed translation.
            if(typeof value==='string' && value && value!==en[k]) {
              out[k]=value; if(kast) kast.zet(lang,en[k],value);
            }
          });
          publish();
        }
      } catch (e) {
        // Keep the complete fallback. An explicit language choice can retry.
      } finally { state.pending=false; }
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

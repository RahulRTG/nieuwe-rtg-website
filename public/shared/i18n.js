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
  const STORE = 'rtg_lang';
  const LANGS = {
    nl: { label: 'Nederlands', native: 'Nederlands', flag: '🇳🇱' },
    en: { label: 'Engels', native: 'English', flag: '🇬🇧' }
  };
  /* Wereldtalen: de Boardroom bepaalt welke talen aanstaan; de kiezer toont ze
     allemaal. UI-teksten vallen voor andere talen terug op Engels; chats en
     berichten worden door de server echt per taal vertaald. */
  let WERELD = null; // [{code, naam, en}] uit /api/talen
  function supported() { return WERELD ? WERELD.map(t => t.code) : Object.keys(LANGS); }
  const orig = new WeakMap(); // element -> { text, html, ph }

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
      fetch('/api/vertaal/ui', { method: 'POST', headers: { 'Content-Type': 'application/json' },
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

    /* ---------- taalkeuze-venster ---------- */
    buildModal(recommended) {
      const oud = document.getElementById('rtg-lang-modal');
      const stondOpen = oud && oud.classList.contains('open');
      if (oud) oud.remove(); // opnieuw opbouwen zodra de wereldtalen binnen zijn
      const scrim = document.createElement('div');
      scrim.id = 'rtg-lang-modal';
      scrim.className = 'rtg-lang-scrim';
      const lijst = WERELD || Object.keys(LANGS).map(c => ({ code: c, naam: LANGS[c].native }));
      const opts = lijst.map(t => {
        const code = t.code;
        const basis = LANGS[code];
        const rec = code === recommended;
        return '<button class="rtg-lang-opt' + (rec ? ' rec' : '') + '" data-lang="' + code + '">' +
          '<span class="rtg-lang-flag">' + (basis ? basis.flag : '<span class="rtg-lang-code">' + code.toUpperCase() + '</span>') + '</span>' +
          '<span class="rtg-lang-name">' + t.naam + '</span>' +
          (rec ? '<span class="rtg-lang-rec">aanbevolen · recommended</span>' : '') +
          '</button>';
      }).join('');
      scrim.innerHTML =
        '<div class="rtg-lang-card" role="dialog" aria-modal="true" aria-label="Taalkeuze">' +
          '<div class="rtg-lang-globe">🌐</div>' +
          '<h2>Kies uw taal</h2>' +
          '<p>Choose your language</p>' +
          '<div class="rtg-lang-opts">' + opts + '</div>' +
        '</div>';
      document.body.appendChild(scrim);
      scrim.querySelectorAll('[data-lang]').forEach(b =>
        b.addEventListener('click', () => { this.set(b.dataset.lang); this.closeModal(); }));
      // De keuze mag nooit de pagina gijzelen: klik ernaast of Escape = huidige
      // taal houden en gewoon verder. De schakelaar linksonder blijft bestaan.
      scrim.addEventListener('click', e => {
        if (e.target === scrim) { this.set(this.lang); this.closeModal(); }
      });
      document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { this.set(this.lang); this.closeModal(); }
      });
      if (stondOpen) scrim.classList.add('open');
    },
    openModal() { this.buildModal(this.lang); const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.add('open'); },
    closeModal() { const m = document.getElementById('rtg-lang-modal'); if (m) m.classList.remove('open'); },

    /* ---------- kleine taalschakelaar (heropent de keuze) ---------- */
    buildSwitch() {
      if (document.getElementById('rtg-lang-switch')) return;
      const btn = document.createElement('button');
      btn.id = 'rtg-lang-switch';
      btn.className = 'rtg-lang-switch';
      btn.setAttribute('aria-label', 'Taal wijzigen / Change language');
      btn.addEventListener('click', () => this.openModal());
      document.body.appendChild(btn);
      this.updateSwitch();
    },
    updateSwitch() {
      const btn = document.getElementById('rtg-lang-switch');
      if (btn) btn.innerHTML = '<span class="rtg-sw-globe">🌐</span>' + this.lang.toUpperCase();
    },

    injectStyles() {
      if (document.getElementById('rtg-i18n-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-i18n-styles';
      s.textContent = `
      .rtg-lang-scrim{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;
        background:rgba(12,12,11,0.72);backdrop-filter:blur(6px);padding:1.5rem;-webkit-font-smoothing:antialiased;}
      .rtg-lang-scrim.open{display:flex;}
      .rtg-lang-card{width:100%;max-width:400px;background:#F7F5F1;color:#0C0C0B;border-radius:20px;
        padding:2.5rem 2rem;text-align:center;box-shadow:0 30px 80px rgba(0,0,0,0.5);
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        animation:rtgLangIn .35s cubic-bezier(.2,.8,.2,1);}
      @keyframes rtgLangIn{from{opacity:0;transform:translateY(14px) scale(.97);}to{opacity:1;transform:none;}}
      .rtg-lang-globe{font-size:2.4rem;line-height:1;}
      .rtg-lang-card h2{font-family:'Bodoni Moda',Georgia,serif;font-weight:500;font-size:1.7rem;margin:1rem 0 0.15rem;letter-spacing:-0.01em;color:#0C0C0B;}
      .rtg-lang-card p{color:#66625B;font-size:0.9rem;margin:0 0 1.6rem;}
      .rtg-lang-opts{display:flex;flex-direction:column;gap:0.7rem;max-height:52vh;overflow:auto;padding:2px;}
      .rtg-lang-code{display:inline-block;min-width:2rem;font-size:0.62rem;font-weight:700;letter-spacing:0.06em;
        color:#7F1634;border:1px solid rgba(127,22,52,0.35);border-radius:6px;padding:0.15rem 0.25rem;text-align:center;}
      .rtg-lang-opt{display:flex;align-items:center;gap:0.9rem;width:100%;text-align:left;cursor:pointer;
        background:#fff;border:1px solid #DEDBD5;border-radius:13px;padding:0.95rem 1.1rem;
        font-family:inherit;font-size:1rem;color:#0C0C0B;transition:border-color .18s,background .18s,transform .12s;}
      .rtg-lang-opt:hover{border-color:#7F1634;background:#fff;}
      .rtg-lang-opt:active{transform:scale(0.99);}
      .rtg-lang-opt.rec{border-color:#7F1634;box-shadow:0 0 0 3px rgba(127,22,52,0.08);}
      .rtg-lang-flag{font-size:1.4rem;line-height:1;}
      .rtg-lang-name{font-weight:600;flex:1;}
      .rtg-lang-rec{font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:#7F1634;font-weight:600;}
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
      return fetch('/api/talen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
        .then(r => r.json())
        .then(d => {
          if (Array.isArray(d.talen) && d.talen.length >= 2) {
            WERELD = d.talen;
            this.buildModal(this.chosen ? this.lang : detectDevice()); // kiezer verversen met alle actieve talen
          }
        })
        .catch(() => {});
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      const device = detectDevice();
      if (saved && /^[a-z]{2}$/.test(saved)) {
        this.chosen = true;
        this.apply(saved);
      } else {
        this.apply(device);          // meteen in de toesteltaal tonen
        this.buildModal(device);     // en de keuze aanbieden
        this.openModal();
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

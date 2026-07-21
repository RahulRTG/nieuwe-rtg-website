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

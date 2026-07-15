/* ============================================================================
   RTG thema — licht/donker-keuze voor de hele demo.

   Werking (bewust simpel, zoals shared/i18n.js):
   - Licht is de basis: de kleuren staan gewoon in de HTML/CSS van elke pagina.
   - Donker komt uit één injectie-stylesheet die de gedeelde CSS-variabelen
     (--white, --black, --line, --grey, --paper, …) omkleurt. Elke pagina die
     die variabelen gebruikt, kantelt zo automatisch mee — zonder dat we elk
     bestand hoeven aan te passen.
   - Bordeaux blijft het accent (merkregel): alleen de basis (achtergrond,
     tekst, lijnen) wisselt tussen licht en donker.
   - De keuze wordt onthouden (localStorage). Bij het eerste bezoek volgt het
     de systeemvoorkeur (prefers-color-scheme).
   - Een zwevende knop rechtsonder wisselt; JS-schermen kunnen luisteren naar
     het 'rtgthema'-event of RTGThema.current opvragen.
   ========================================================================== */
(function () {
  const STORE = 'rtg_thema';
  const root = document.documentElement;

  const RTGThema = {
    current: 'licht',

    set(mode, remember) {
      mode = mode === 'donker' ? 'donker' : 'licht';
      this.current = mode;
      root.setAttribute('data-thema', mode);
      root.style.colorScheme = mode === 'donker' ? 'dark' : 'light';
      if (remember !== false) { try { localStorage.setItem(STORE, mode); } catch (e) {} }
      this.updateSwitch();
      window.dispatchEvent(new CustomEvent('rtgthema', { detail: { mode } }));
      this.syncMeta();
    },

    toggle() { this.set(this.current === 'donker' ? 'licht' : 'donker'); },

    /* De PWA-statusbalk (app.html) mag meekleuren met het thema. */
    syncMeta() {
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', this.current === 'donker' ? '#0C0C0B' : '#FFFFFF');
    },

    injectStyles() {
      if (document.getElementById('rtg-thema-styles')) return;
      const s = document.createElement('style');
      s.id = 'rtg-thema-styles';
      s.textContent = `
      /* ---- donkere basispalet: alleen de neutrale kleuren wisselen ---- */
      :root[data-thema="donker"]{
        --white:#141312;          /* was de lichte paginakleur → nu donker oppervlak */
        --black:#F1EEE9;          /* was de tekstkleur → nu licht */
        --paper:#1B1A18;
        --line:#2C2926;
        --grey:#B7B2AB;
        --grey-soft:#8C877F;
        --burgundy:#C23A5E;       /* accent iets opgetild voor contrast op donker */
        --burgundy-bright:#D9557A;
      }
      /* Secties die bewust op zwart/wit staan, expliciet terugzetten zodat het
         omklappen van --black/--white ze niet ongewenst inverteert. */
      :root[data-thema="donker"] .on-black{ background:#0A0A09; color:#F1EEE9; }
      :root[data-thema="donker"] .on-white{ background:#141312; color:#F1EEE9; }
      :root[data-thema="donker"] .salon-strip{ background:#1B1A18; }
      :root[data-thema="donker"] header{ background:rgba(12,12,11,0.82) !important; border-bottom-color:#2C2926; }
      :root[data-thema="donker"] img{ /* beeld hoeft niet te dimmen, maar zachte rand op donker */ }
      :root[data-thema="donker"] .btn-ghost{ color:#F1EEE9; }

      /* Let op: de operationele apps (leverancier, backoffice, leden-app) zijn
         bewust donker ontworpen (o.a. de KDS-schermen) met een eigen palet en
         veel vaste kleuren. Die laten we donker-native; de licht/donker-keuze
         werkt op de licht-gebaseerde vlakken (hub, ledenportaal-web, site). */

      /* ---- de zwevende themaschakelaar ---- */
      .rtg-thema-switch{
        position:fixed; right:14px; bottom:14px; z-index:9990;
        display:inline-flex; align-items:center; gap:0.4rem;
        background:rgba(12,12,11,0.82); color:#fff;
        border:1px solid rgba(255,255,255,0.16); border-radius:999px;
        padding:0.42rem 0.8rem;
        font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
        font-size:0.72rem; font-weight:600; letter-spacing:0.04em;
        cursor:pointer; backdrop-filter:blur(8px);
        box-shadow:0 6px 20px rgba(0,0,0,0.25);
        transition:background .18s, border-color .18s;
        padding-bottom:calc(0.42rem + env(safe-area-inset-bottom,0));
      }
      .rtg-thema-switch:hover{ background:#7F1634; border-color:#7F1634; }
      :root[data-thema="donker"] .rtg-thema-switch{
        background:rgba(241,238,233,0.10); border-color:rgba(241,238,233,0.22);
      }
      :root[data-thema="donker"] .rtg-thema-switch:hover{ background:#C23A5E; border-color:#C23A5E; }
      .rtg-thema-ico{ font-size:0.9rem; line-height:1; }
      @media print{ .rtg-thema-switch{ display:none; } }
      `;
      (document.head || root).appendChild(s);
    },

    buildSwitch() {
      if (document.getElementById('rtg-thema-switch')) return;
      const btn = document.createElement('button');
      btn.id = 'rtg-thema-switch';
      btn.className = 'rtg-thema-switch';
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Licht of donker / Light or dark');
      btn.addEventListener('click', () => this.toggle());
      document.body.appendChild(btn);
      this.updateSwitch();
    },

    updateSwitch() {
      const btn = document.getElementById('rtg-thema-switch');
      if (!btn) return;
      const donker = this.current === 'donker';
      // Toon waar je naartoe schakelt.
      btn.innerHTML = '<span class="rtg-thema-ico">' + (donker ? '☀️' : '🌙') + '</span>' +
        (donker ? 'Licht' : 'Donker');
    },

    init() {
      this.injectStyles();
      let saved = null;
      try { saved = localStorage.getItem(STORE); } catch (e) {}
      let mode = (saved === 'licht' || saved === 'donker') ? saved : null;
      if (!mode) {
        mode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'donker' : 'licht';
      }
      this.set(mode, false);           // toepassen zonder de eerste keer op te slaan
      if (document.body) this.buildSwitch();
      else document.addEventListener('DOMContentLoaded', () => this.buildSwitch());
    }
  };

  window.RTGThema = RTGThema;
  // Zo vroeg mogelijk het data-attribuut zetten (voorkomt een flits), knop later.
  RTGThema.init();
})();

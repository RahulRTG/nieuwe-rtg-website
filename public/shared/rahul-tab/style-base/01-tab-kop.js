/* Rahul-presentatie: DS gebruikt canonieke componenten, legacy behoudt zijn
   bestaande visuele contract totdat de host migreert. Deze fallback is WIP. */
(function () {
  'use strict';
  if (!document.querySelector('.rtg-rahul-page') && !window.__rahulTabDialoog) return;
  if (document.getElementById('rtgRahulTabBasisStijl')) return;
  var ds = document.documentElement.hasAttribute('data-ds');
  if (ds) document.body.classList.add('ds-rahul-eigenaar');
  if (!ds) {
  if (!ds && !document.getElementById('rtgRahulTwinLader')) {
    var lader = document.createElement('script');
    lader.id = 'rtgRahulTwinLader'; lader.src = '/shared/rahul-tab/style-twin.js';
    lader.async = false; document.head.appendChild(lader);
  }
  var css = document.createElement('style'); css.id = 'rtgRahulTabBasisStijl';
  // Alleen de legacy-host behoudt deze cascade; DS gebruikt zijn eigenaarstaat.
  var onderdruk = 'button#rahulFab.rahulfab,.mgz-blok,.rv-rahul,.lo-rahul,.pn-rahul,.po-rahul,.ir-rahul,.gd-rahul,.cmd-console{display:none!important}';
  css.textContent = onderdruk + (
/* De tab kiest zijn gastheer uit een lijst (rahul-tab.js) en erfde daar zijn
     maat van. Op rtg.html is main>header>div op deze tak verdwenen, dus viel hij
     door naar header.topbar, en die zegt `.topbar a,.topbar button{display:flex;
     align-items:center}`: van "Rahul" boven "KOMPAS" werd een rij van 108x16 op
     390x844 -- onder de 24x24 van WCAG 2.5.8 (TOEGANKELIJK.md); op main was hij
     in main>header>div 27 hoog. De gastheer bepaalde de maat, en dat is de val.
     Daarom zet de tab zijn MINIMUM zelf: 44 hoog (de raakvlakmaat van rtg-ui.css
     en GRAMMATICA.md; een gastheer mag hem hoger maken, zoals rtg-edge-system.css
     met 46, nooit lager). Alleen de maat, niet de richting: travel-os.css zet
     de tab in zijn ios-nav bewust als rij op de grondlijn, en de vorm blijft van
     de gastheer. Met !important, want een gastheerregel als .topbar button
     (0,1,1) wint anders van .rtg-rahul-tab (0,1,0). En [hidden] staat er
     expliciet naast: een gastheer die display op zijn knoppen zet, wint ook van
     de browserregel voor [hidden], en dialog.js verbergt de tab zolang een
     app-dialoog open staat (metgezel.js liep in dezelfde val). */
    '.rtg-rahul-tab{min-height:44px!important;min-width:150px!important;border:0!important;border-right:1px solid rgba(244,241,236,.1)!important;border-bottom:2px solid transparent!important;background:transparent!important;color:#99918a!important;padding:0 16px!important;text-align:left!important;font:500 11px Inter,system-ui!important;cursor:pointer}.rtg-rahul-tab[hidden]{display:none!important}.rtg-rahul-tab small{display:block;margin-top:4px;font-size:6px;letter-spacing:.08em;color:#746d67}.rtg-rahul-tab.actief{color:#f2eee8!important;border-bottom-color:#7f1634!important;background:linear-gradient(180deg,rgba(127,22,52,.16),transparent)!important}' +
    '.rtg-rahul-page{position:fixed;z-index:9970;left:154px;right:0;top:64px;bottom:0;color:#f2eee8;background:radial-gradient(70% 55% at 78% 0,rgba(127,22,52,.24),transparent 68%),#0b0b0a;font-family:Inter,system-ui;overflow:auto}.rtg-rahul-page[hidden]{display:none}' +
    '.rtg-command-head{height:88px;display:grid;grid-template-columns:46px 1fr auto 42px;gap:13px;align-items:center;padding:0 clamp(28px,4vw,62px);border-bottom:1px solid rgba(244,241,236,.1)}.rtg-mouth,.rtg-command-close{width:42px;height:42px;border:1px solid rgba(192,165,68,.32);border-radius:50%;background:rgba(127,22,52,.1);color:#d2b96a;font:500 22px Bodoni Moda;cursor:pointer}.rtg-command-head span{display:flex;flex-direction:column}.rtg-command-head b{font:500 21px Bodoni Moda}.rtg-command-head small{font-size:7px;letter-spacing:.12em;color:#817a74}.rtg-command-state{display:flex!important;flex-direction:row!important;align-items:center;gap:8px!important;font-size:7px;color:#817a74}.rtg-command-state i{width:6px;height:6px;border-radius:50%;background:#72bd94;box-shadow:0 0 10px #72bd94}' +

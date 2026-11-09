/* DE UITSTAPKNOP. Een scherm weghalen zonder eerst iets te hoeven bedenken.

   WAARVOOR DIT ER IS. Iemand leest op zijn telefoon waar hij hulp kan krijgen,
   en de persoon over wie het gaat komt de kamer binnen. Dan is drie tikken naar
   een ander scherm te veel. Dit is een knop en een toets, en meer niet.

   WAT HIJ WEL DOET:
     - hij zet de titel van het tabblad meteen neutraal, VOOR de navigatie, want
       de oude titel blijft anders nog even in de tabstrip staan;
     - hij vervangt het huidige adres in plaats van er een nieuw op te stapelen
       (location.replace), zodat de weg terug niet EEN tik terug ligt.

   WAT HIJ NIET DOET, EN DIT HOORT ER HARDOP BIJ (HDI.md par. 5.7):
     - hij wist de browsergeschiedenis niet. Dat kan een webpagina niet, en er
       is geen truc die dat wel doet;
     - hij haalt de pagina niet uit de app-wisselaar van het toestel;
     - hij houdt meldingen niet van het vergrendelscherm.
   Een knop die deed alsof hij dat wel kon, zou gevaarlijker zijn dan geen knop,
   want de lezer rekent erop. Wat hij niet kan staat daarom op onveilig.html in
   een eigen blok, en niet in de kleine lettertjes.

   WAAROM HIJ OP DE HELE STEUN-WERELD STAAT en niet alleen op de pagina's over
   geweld: een knop die alleen op DIE pagina's verschijnt, is zelf het signaal.
   Wie hem op elk scherm van deze wereld ziet, verraadt met zijn aanwezigheid
   niets over wat hij aan het lezen was.

   OPT-IN: dit bestand doet alleen iets op een pagina die hem laadt. Er is geen
   lijst met paden hier -- die zou een tweede waarheid zijn naast de script-tags
   zelf (LAT.md regel 4). */
(function () {
  'use strict';
  const dsBijStart = document.documentElement.hasAttribute('data-ds');
  if (window.__rtgUitstap) return;
  window.__rtgUitstap = true;

  /* Waarheen. Een gewone, alledaagse pagina die op elk toestel te verklaren is.
     Bewust GEEN about:blank: een leeg tabblad is zelf opvallend. */
  var WEG = 'https://www.google.nl/';
  var NEUTRALE_TITEL = 'Nieuw tabblad';

  function weg() {
    /* Eerst de titel, dan pas de navigatie: bij een trage verbinding blijft de
       oude titel anders nog seconden in beeld -- juist de seconden die tellen. */
    try { document.title = NEUTRALE_TITEL; } catch (e) {}
    try { window.location.replace(WEG); } catch (e) { window.location.assign(WEG); }
  }

  function knop() {
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'rtg-uitstap';
    b.textContent = 'Weg hier';
    /* De toegankelijke naam zegt WAT er gebeurt. "Weg hier" alleen is voor wie
       hem ziet duidelijk, maar een schermlezer leest hem uit zijn omgeving. */
    b.setAttribute('aria-label', 'Weg hier: sluit dit scherm en ga naar een neutrale pagina');
    /* Ingetogen, niet alarmerend: een felrode knop is zelf een aanwijzing. Geen
       ronde hoeken (CLAUDE.md), en 44 px hoog zodat een duim hem raakt. */
    if (dsBijStart || document.documentElement.hasAttribute('data-ds')) b.className = 'ds-knop ds-uitstap';
    else b.style.cssText = [
      'position:fixed', 'right:.75rem', 'bottom:calc(.75rem + env(safe-area-inset-bottom,0px))',
      'z-index:2147482000', 'min-height:44px', 'min-width:44px', 'padding:.6rem 1rem',
      'border:1px solid #857007', 'border-radius:0', 'background:#0C0C0B', 'color:#FFFFFF',
      'font:600 .9rem/1 Inter,system-ui,sans-serif', 'cursor:pointer',
      'box-shadow:0 6px 24px rgba(0,0,0,.5)'
    ].join(';');
    b.addEventListener('click', weg);
    return b;
  }

  /* Een body-knop wordt inert onder een native modal, ongeacht zijn z-index.
     Verplaats uitsluitend DEZELFDE vluchtknop naar de daadwerkelijk bovenste
     laag. Hit-testing volgt de top-layer-volgorde, niet de DOM-volgorde.
     Bij een niet-modale Foundation-toegangsdeur blijft alle home-inertheid
     ongemoeid; alleen de vluchtactie hoort bij de zichtbare deur. */
  function volgLaag(b) {
    function zichtbaar(el, nativeModal) {
      return el && el.isConnected && !el.hidden && (!el.closest('[inert]') || nativeModal) &&
        (!el.checkVisibility || el.checkVisibility({ checkVisibilityCSS: true }));
    }
    function laagVan(el, selector) {
      var laag = el && el.closest ? el.closest(selector) : null;
      return zichtbaar(laag, selector === 'dialog:modal') ? laag : null;
    }
    function plaats() {
      var hit = document.elementFromPoint ? document.elementFromPoint(innerWidth / 2, innerHeight / 2) : null;
      var focus = document.activeElement, host = null;
      try {
        host = laagVan(hit, 'dialog:modal') || laagVan(focus, 'dialog:modal');
        if (!host) {
          var modals = document.querySelectorAll('dialog:modal');
          // Eén is ondubbelzinnig. Meerdere zonder hit/focus zijn niet te raden.
          if (modals.length === 1 && zichtbaar(modals[0], true)) host = modals[0];
        }
      } catch (e) { /* Zonder :modal blijft de bestaande zichtbare modal-API. */ }
      if (!host) host = laagVan(hit, '[aria-modal="true"]') || laagVan(focus, '[aria-modal="true"]');
      if (!host) {
        var deur = document.querySelector('.ds-foundation-toegang');
        if (zichtbaar(deur)) host = deur;
      }
      host = host || document.body || document.documentElement;
      if (b.parentNode === host) return;
      var hadFocus = document.activeElement === b;
      host.appendChild(b);
      if (hadFocus) b.focus({ preventScroll: true });
    }
    plaats();
    document.addEventListener('focusin', plaats, true);
    document.addEventListener('close', plaats, true);
    document.addEventListener('toggle', plaats, true);
    if (window.MutationObserver) new MutationObserver(plaats).observe(document.documentElement,
      { childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'hidden', 'aria-hidden', 'aria-modal'] });
  }

  function start() {
    var b = knop();
    (document.body || document.documentElement).appendChild(b);
    if (dsBijStart || document.documentElement.hasAttribute('data-ds')) {
      if (document.body) document.body.classList.add('ds-uitstap-actief');
      volgLaag(b);
    }

    /* Escape TWEE keer binnen anderhalve seconde. Een enkele Escape sluit in dit
       huis dialogen en laden; die betekenis afpakken zou op elk ander scherm een
       fout worden. Twee keer is nog steeds sneller dan een knop zoeken. */
    var laatst = 0;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var nu = Date.now();
      if (nu - laatst < 1500) { weg(); return; }
      laatst = nu;
    }, dsBijStart || document.documentElement.hasAttribute('data-ds'));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

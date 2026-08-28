/* Muisvrij bedienen, deel 7: het bureaublad.

   Alles hierboven is voor een telefoon gebouwd: een strook onderaan, over de
   volle breedte. Op een monitor van 27 inch is diezelfde strook een balk van
   een halve meter met een invoerveld erin. Dat is geen bureaublad-app, dat is
   een vergrote telefoon.

   Op een bureaublad doet dit bestand drie dingen:

   1. DE BALK WORDT EEN PANEEL. Rechtsonder, met een eigen breedte, zodat er
      naast Rahul gewoon gewerkt kan worden. Hij ligt nergens overheen wat je
      nodig hebt, en de pagina blijft over de volle breedte scrollen.
   2. EEN SNELTOETS. Ctrl+K (of Cmd+K) zet de aandacht in het veld, waar je ook
      bent. Op een bureaublad ligt de hand op het toetsenbord; dan is een toets
      sneller dan de muis, en dat is precies het punt van handenvrij.
   3. DE KLIKLAAG, MAAR ALLEEN OP HET WERK.

   Over dat derde. Liever gaat alles via Rahul -- dat is de hele opzet. Maar
   iemand die aan het werk is, mag daar nooit door vertraagd worden. Een kok
   met natte handen die "markeer tafel zes als klaar" moet uitspreken terwijl
   het druk is, wil gewoon een knop. Dus: op de werkpagina's (zaak, personeel,
   kantoor, backoffice, meldkamer) zetten we de BROODNODIGE knoppen van de
   huidige pagina naast het veld. Hooguit vijf, en ze komen uit de pagina zelf
   (dezelfde lijst die Rahul gebruikt om te navigeren), dus er ontstaat geen
   tweede waarheid die uit de pas gaat lopen.

   Vijf en niet meer, met opzet. Een rij van vijftien knoppen is weer gewoon
   een werkbalk, en dan hebben we de AI-laag voor niets gebouwd. */
(function (root) {
  'use strict';
  if (root.__handenvrijBureau) return; root.__handenvrijBureau = true;
  var kamer = root.__handenvrijKamer;
  if (!kamer || !kamer.vak) return;
  var api = root.Handenvrij;

  // Een bureaublad: een fijne aanwijzer (muis) en genoeg breedte. Beide, want
  // een tablet met muis is nog steeds smal, en een breed touchscherm (kassa,
  // extern scherm) wil juist wel de brede strook.
  var bureau = false;
  try {
    bureau = root.matchMedia('(pointer: fine)').matches && root.innerWidth >= 1024;
  } catch (e) { bureau = false; }

  var WERK = /\/apps\/(leverancier|personeel|kantoren|backoffice|office|meldkamer|techniek|boardroom|kantoorpda|overheidspda|gemeentepda)/;
  var opWerk = WERK.test(location.pathname);

  var css =
    /* het paneel rechtsonder; de rest van het scherm blijft van het werk */
    'body.hv-bureau .hv-balk{left:auto;right:1rem;bottom:1rem;width:var(--hv-breed,min(30rem,42vw));' +
    'border:1px solid var(--gold,#857007);border-radius:0;box-shadow:0 12px 34px rgba(0,0,0,.5);}' +
    'body.hv-bureau .hv-chat{left:auto;right:1rem;bottom:4.6rem;width:var(--hv-breed,min(30rem,42vw));' +
    'border:1px solid #2a2a28;border-radius:0;}' +
    /* verplaatst: dan telt de eigen plek en niet meer de hoek rechtsonder */
    'body.hv-bureau.hv-verzet .hv-balk{right:auto;bottom:auto;left:var(--hv-x);top:calc(var(--hv-y) + var(--hv-hoog));}' +
    'body.hv-bureau.hv-verzet .hv-chat{right:auto;bottom:auto;left:var(--hv-x);top:var(--hv-y);' +
    'max-height:var(--hv-hoog) !important;height:var(--hv-hoog);}' +
    /* de greep om groter en kleiner te slepen, rechtsonder in het gesprek */
    '.hv-maat{position:absolute;right:0;bottom:0;width:1.1rem;height:1.1rem;cursor:nwse-resize;' +
    'background:linear-gradient(135deg,transparent 45%,#4a4744 45%,#4a4744 55%,transparent 55%);z-index:3;}' +
    'body:not(.hv-bureau) .hv-maat{display:none;}' +
    'body.hv-bureau .hv-chat[data-stand="scherm"]{right:0;width:100%;border-radius:0;}' +
    /* op een bureaublad hoeft er onder de pagina geen strook vrij te blijven:
       het paneel zweeft in de hoek en dekt geen inhoud af die je nodig hebt */
    'body.hv-bureau.hv-ruimte{padding-bottom:0;}' +
    /* De kliklaag: een smalle rij VLAK BOVEN de balk, alleen op werkpagina's.
       Vast gepositioneerd, net als de balk zelf: in de normale stroom zou hij
       ergens onder aan de pagina belanden in plaats van bij het veld. Staat de
       rij er, dan schuiven het gesprek en de bodemruimte een rij op. */
    '.hv-werk{position:fixed;left:0;right:0;bottom:3.4rem;z-index:36;display:flex;gap:.35rem;' +
    'flex-wrap:wrap;align-items:center;padding:.35rem .7rem;background:rgba(12,12,11,.94);' +
    'border-top:1px solid #201e1c;font-family:Inter,system-ui,sans-serif;}' +
    '.hv-werk[hidden]{display:none;}' +
    'body.hv-werkrij .hv-chat{bottom:6.1rem;}' +
    'body.hv-werkrij.hv-ruimte{padding-bottom:6.3rem;}' +
    'body.hv-bureau .hv-werk{left:auto;right:1rem;bottom:4.6rem;width:min(30rem,42vw);' +
    'border:1px solid #2a2a28;border-radius:0;}' +
    'body.hv-bureau.hv-werkrij .hv-chat{bottom:7.3rem;}' +
    '.hv-werk button{background:transparent;border:1px solid #3a3733;border-radius:0;color:#d8d5d0;' +
    'font:inherit;font-size:.74rem;padding:.3rem .5rem;cursor:pointer;max-width:11rem;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;}' +
    '.hv-werk button:hover{border-color:var(--gold,#857007);color:#fff;}' +
    '.hv-werk button:focus-visible{outline:2px solid var(--gold,#857007);outline-offset:2px;}' +
    '.hv-werk .hv-werk-kop{border:0;color:#8A8680;font-size:.66rem;letter-spacing:.08em;' +
    'text-transform:uppercase;padding:.3rem .2rem;cursor:default;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  if (bureau) document.body.classList.add('hv-bureau');

  /* ---------- de middenconsole: verplaatsen en van maat veranderen ----------

     Op een telefoon hoort de balk onderaan te zitten, punt. Op een bureaublad
     is hij een console: iemand met twee monitoren en een planning open wil hem
     links, iemand anders rechtsonder. Plek en maat blijven staan, per toestel.

     De console beweegt als GEHEEL: het gesprek en de balk eronder horen bij
     elkaar. Daarom zet dit de linkerbovenhoek en de hoogte van het gesprek, en
     hangt de balk daar met CSS onder. */
  var PLEK = 'rtg_hv_console';
  var plek = null;
  try { plek = JSON.parse(localStorage.getItem(PLEK) || 'null'); } catch (e) { plek = null; }

  function pasPlekToe() {
    if (!bureau || !plek) return;
    var st2 = document.documentElement.style;
    st2.setProperty('--hv-x', plek.x + 'px');
    st2.setProperty('--hv-y', plek.y + 'px');
    st2.setProperty('--hv-breed', plek.b + 'px');
    st2.setProperty('--hv-hoog', plek.h + 'px');
    document.body.classList.add('hv-verzet');
  }
  function zetPlek(x, y, b, h) {
    var maxB = Math.min(root.innerWidth - 40, 900), maxH = Math.min(root.innerHeight - 120, 900);
    plek = {
      b: Math.max(280, Math.min(b, maxB)),
      h: Math.max(140, Math.min(h, maxH)),
      x: 0, y: 0
    };
    plek.x = Math.max(6, Math.min(x, root.innerWidth - plek.b - 6));
    plek.y = Math.max(6, Math.min(y, root.innerHeight - plek.h - 70));
    pasPlekToe();
    try { localStorage.setItem(PLEK, JSON.stringify(plek)); } catch (e) {}
  }
  function huidig() {
    var c = kamer.vak.getBoundingClientRect();
    return plek || { x: c.left, y: c.top, b: c.width, h: Math.max(140, c.height) };
  }

  /* Slepen aan de greep van het gesprek verplaatst de console. De greep zelf
     regelt ook de standen (half/vol); daar zit een drempel van 18 px op voor
     verticaal slepen, dus we nemen hier alleen het HORIZONTALE gebaar over als
     dat duidelijk het grootste is. Anders zouden de twee elkaar bijten. */
  function haakSleep() {
    var greep = root.RTGChatScherm && root.RTGChatScherm.greep;
    if (!greep || greep.__hvSleep) return false;
    greep.__hvSleep = true;
    var neer = null;
    greep.addEventListener('pointerdown', function (e) {
      if (!bureau || (e.target.closest && e.target.closest('button'))) return;
      var h = huidig();
      neer = { x: e.clientX, y: e.clientY, bx: h.x, by: h.y, b: h.b, h: h.h, uit: false };
    });
    greep.addEventListener('pointermove', function (e) {
      if (!neer || !bureau) return;
      var dx = e.clientX - neer.x, dy = e.clientY - neer.y;
      if (!neer.uit) {
        if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return;  // verticaal: dat zijn de standen
        neer.uit = true;
      }
      zetPlek(neer.bx + dx, neer.by + dy, neer.b, neer.h);
      e.preventDefault();
    });
    var los = function () { neer = null; };
    greep.addEventListener('pointerup', los);
    greep.addEventListener('pointercancel', los);


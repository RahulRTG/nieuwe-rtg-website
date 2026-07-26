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
    'body.hv-bureau .hv-balk{left:auto;right:1rem;bottom:1rem;width:min(30rem,42vw);border:1px solid var(--gold,#857007);' +
    'border-radius:14px;box-shadow:0 12px 34px rgba(0,0,0,.5);}' +
    'body.hv-bureau .hv-chat{left:auto;right:1rem;bottom:4.6rem;width:min(30rem,42vw);border:1px solid #2a2a28;' +
    'border-radius:14px;}' +
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
    'border:1px solid #2a2a28;border-radius:12px;}' +
    'body.hv-bureau.hv-werkrij .hv-chat{bottom:7.3rem;}' +
    '.hv-werk button{background:transparent;border:1px solid #3a3733;border-radius:9px;color:#d8d5d0;' +
    'font:inherit;font-size:.74rem;padding:.3rem .5rem;cursor:pointer;max-width:11rem;overflow:hidden;' +
    'text-overflow:ellipsis;white-space:nowrap;}' +
    '.hv-werk button:hover{border-color:var(--gold,#857007);color:#fff;}' +
    '.hv-werk button:focus-visible{outline:2px solid var(--gold,#857007);outline-offset:2px;}' +
    '.hv-werk .hv-werk-kop{border:0;color:#8A8680;font-size:.66rem;letter-spacing:.08em;' +
    'text-transform:uppercase;padding:.3rem .2rem;cursor:default;}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  if (bureau) document.body.classList.add('hv-bureau');

  /* ---------- de sneltoets ----------
     Ctrl/Cmd+K is de toets die iedereen al kent van zoeken. handenvrij-balk.js
     vangt losse letters al op, maar die laat sneltoetsen (met ctrl/cmd) bewust
     met rust; deze regel hoort dus hier en niet daar. */
  document.addEventListener('keydown', function (ev) {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    if (String(ev.key).toLowerCase() !== 'k') return;
    var inp = document.querySelector('.hv-balk input');
    if (!inp) return;
    ev.preventDefault();
    inp.focus(); inp.select();
  });

  /* ---------- de kliklaag op werkpagina's ----------
     De knoppen komen uit dezelfde plekkenlijst die Rahul gebruikt. Zo klikt de
     medewerker op precies wat Rahul ook zou aanroepen; er is maar een waarheid
     over wat deze pagina kan. */
  if (!opWerk || !api || !api.plekken) return;
  var rij = document.createElement('div');
  rij.className = 'hv-werk';
  rij.setAttribute('role', 'group');
  rij.setAttribute('aria-label', 'Snel naar (het broodnodige; de rest gaat via Rahul)');

  /* Wat er nu in de rij staat, als tekst. Nodig om te kunnen zien of er echt
     iets veranderd is: zonder die vergelijking herschrijft vul() de rij, ziet
     de waarnemer hieronder zijn eigen wijziging, en draait het geheel voor
     altijd rond in een lus van een halve seconde. */
  var laatste = null;
  function vul() {
    var lijst = [];
    try { lijst = api.plekken() || []; } catch (e) { lijst = []; }
    // hooguit vijf: dit is een uitwijk, geen werkbalk
    var kies = lijst.slice(0, 5);
    var vinger = kies.map(function (p) { return p.naam; }).join('|');
    if (vinger === laatste) return;
    laatste = vinger;
    if (!kies.length) { rij.hidden = true; document.body.classList.remove('hv-werkrij'); return; }
    rij.hidden = false;
    document.body.classList.add('hv-werkrij');
    rij.innerHTML = '<span class="hv-werk-kop">Snel</span>';
    kies.forEach(function (p) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = p.naam; b.title = p.naam;
      b.addEventListener('click', function () { try { p.doen(); } catch (e) {} });
      rij.appendChild(b);
    });
  }

  function hang() {
    var balk = document.querySelector('.hv-balk');
    if (!balk || !balk.parentNode) return false;
    if (!rij.parentNode) document.body.appendChild(rij);
    vul();
    return true;
  }
  if (!hang()) {
    var n = 0;
    var t = setInterval(function () { if (hang() || ++n > 20) clearInterval(t); }, 100);
  }
  /* De pagina wisselt voortdurend van scherm en tab; de lijst hoort dat te
     volgen. Een waarnemer op de body is hier goedkoper dan om de seconde de
     hele DOM aflopen, en hij reageert meteen in plaats van een tel later. */
  if (root.MutationObserver) {
    var wacht = null;
    new MutationObserver(function () {
      clearTimeout(wacht);
      wacht = setTimeout(function () { if (rij.parentNode) vul(); }, 400);
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'aria-hidden', 'class'] });
  }
})(typeof self !== 'undefined' ? self : this);

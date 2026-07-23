/* RTG Flagship: op een ruim scherm krijgt een kantoorpagina een gecentreerd,
   rustig iPad-kader: de inhoud staat als een kalme kaart in het midden, met de
   levende grond eromheen. Met de greep aan de rand maak je het kader breder of
   smaller (de maat wordt onthouden). De hoogte groeit gewoon mee met de inhoud
   -- ontspannen, niet wild. Op een smal scherm blijft de pagina zoals hij is.

   Aanzetten: geef <body> het attribuut data-flagship. */
(function (w, d) {
  'use strict';
  if (w.RTGFlagship) return;
  var MIN = 1180;
  function sleutel() { return 'rtg_flagship_' + (d.body.getAttribute('data-oswereld') || 'kantoor'); }
  function breed() { try { var v = +localStorage.getItem(sleutel()); if (v >= 680 && v <= 1400) return v; } catch (e) {} return 960; }
  function zet(v) { v = Math.max(680, Math.min(1400, Math.round(v))); try { localStorage.setItem(sleutel(), v); } catch (e) {} d.documentElement.style.setProperty('--flag-breed', v + 'px'); }

  function stijl() {
    if (d.getElementById('flagCss')) return;
    var st = d.createElement('style'); st.id = 'flagCss';
    st.textContent =
      ':root{--flag-breed:960px;}' +
      '@media (min-width:' + MIN + 'px){' +
      'body[data-flagship] main#hoofd{max-width:var(--flag-breed);margin:1.6rem auto 3.4rem;' +
        'border:1px solid var(--line,rgba(255,255,255,.1));border-radius:24px;' +
        'background:color-mix(in srgb, var(--card,#151312) 55%, transparent);' +
        'box-shadow:0 34px 90px -55px rgba(0,0,0,.6);position:relative;' +
        'transition:max-width .12s ease;}' +
      'body[data-flagship] main#hoofd > .wrap{max-width:100%;}' +
      'body[data-flagship] #flagGreep{position:absolute;top:50%;right:-8px;transform:translateY(-50%);' +
        'width:16px;height:70px;border-radius:999px;cursor:ew-resize;z-index:6;touch-action:none;' +
        'background:color-mix(in srgb, var(--card,#151312) 80%, transparent);' +
        'border:1px solid var(--line,rgba(255,255,255,.16));display:flex;align-items:center;justify-content:center;}' +
      'body[data-flagship] #flagGreep::after{content:"";width:3px;height:32px;border-radius:2px;background:var(--soft,#8A8680);}' +
      'body[data-flagship] #flagGreep:hover::after{background:var(--gold,#A98F1C);}' +
      '}';
    d.head.appendChild(st);
  }

  function start() {
    if (!d.body || !d.body.hasAttribute('data-flagship')) return;
    stijl(); zet(breed());
    if (w.innerWidth < MIN) return;
    var main = d.getElementById('hoofd'); if (!main || d.getElementById('flagGreep')) return;
    var g = d.createElement('div'); g.id = 'flagGreep'; g.setAttribute('role', 'separator');
    g.setAttribute('aria-label', 'Versleep om het kader breder of smaller te maken');
    main.appendChild(g);
    g.addEventListener('pointerdown', function (e) {
      e.preventDefault(); try { g.setPointerCapture(e.pointerId); } catch (x) {}
      var startX = e.clientX, beginW = main.offsetWidth;
      // gecentreerd: elke pixel aan de greep telt dubbel (beide kanten schuiven mee)
      function bw(ev) { zet(beginW + (ev.clientX - startX) * 2); }
      function los() { d.removeEventListener('pointermove', bw); d.removeEventListener('pointerup', los); }
      d.addEventListener('pointermove', bw); d.addEventListener('pointerup', los);
    });
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();
  w.RTGFlagship = { breed: breed, zet: zet };
})(window, document);

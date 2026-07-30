/* RTG Office, de schets: diagrammen zoals een kantoor ze tekent -- kaders,
   ovalen, ruiten, pijlen en losse tekst op een wit vel. Kies een vorm en
   sleep om te tekenen; klik om te kiezen, sleep om te verplaatsen, pak een
   GREEP om de maat te veranderen (bij een pijl: zijn uiteinden), dubbelklik
   voor de tekst, Delete haalt weg en Ctrl+Z draait terug.

   Alles ligt op een raster van 10: vormen die vanzelf uitlijnen zijn het
   verschil tussen een schema en een gekras. Het vel is SVG (1200 bij 800):
   scherp op elk scherm, strak op papier, en export als echt .svg-bestand.
   Hoe een vorm eruitziet staat in schetsvorm.js; dit bestand is de hand.

   Levert window.RTGOfficeSchets. */
(function () {
  'use strict';
  var V = window.RTGOfficeSchetsVorm;
  var RASTER = 10;
  var snap = function (n) { return Math.round(n / RASTER) * RASTER; };

  function maak(opties) {
    var wrap = opties.wrap, onWijzig = opties.onWijzig, meld = opties.meld, voet = opties.voet;
    var vormen = [], mag = false, keuze = null, sel = -1, svg = null;
    var bezig = null;     // tijdens het slepen: { nieuw, greep, i, vanX, vanY, basis, voor }
    var verleden = [];    // Ctrl+Z: snapshots, alleen bij een echte wijziging

    function punt(e) {
      var r = svg.getBoundingClientRect();
      return { x: snap(Math.max(0, Math.min(1200, (e.clientX - r.left) * 1200 / r.width))),
        y: snap(Math.max(0, Math.min(800, (e.clientY - r.top) * 800 / r.height))) };
    }
    function duw(voor) {
      verleden.push(voor);
      if (verleden.length > 30) verleden.shift();
    }
    function terug() {
      if (!mag || !verleden.length) return;
      vormen = JSON.parse(verleden.pop());
      sel = -1; onWijzig(); teken();
    }

    /* Eén keer bouwen, daarna alleen de vormen hertekenen: wie het hele vel
       bij elke muisbeweging vervangt, raakt de pointer-greep kwijt en laat
       het scherm knipperen. */
    function bouw() {
      wrap.innerHTML = '';
      if (mag) wrap.appendChild(balk());
      svg = V.el('svg', { viewBox: '0 0 1200 800', role: 'img', 'aria-label': 'Schets' });
      if (mag) {
        svg.addEventListener('pointerdown', neer);
        svg.addEventListener('pointermove', beweeg);
        svg.addEventListener('pointerup', los);
        svg.addEventListener('dblclick', dubbel);
      }
      wrap.appendChild(svg);
      teken();
    }
    function teken() {
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      svg.appendChild(V.maakDefs());
      vormen.forEach(function (v, i) { svg.appendChild(V.tekenVorm(v, i, i === sel)); });
      if (mag && sel >= 0 && vormen[sel]) V.grepenVan(vormen[sel]).forEach(function (gr) {
        svg.appendChild(V.tekenGreep(gr));
      });
      var kn = wrap.querySelectorAll('[data-vorm]');
      Array.prototype.forEach.call(kn, function (k) { k.classList.toggle('aan', k.dataset.vorm === keuze); });
      if (voet) voet.textContent = vormen.length + (vormen.length === 1 ? ' vorm' : ' vormen');
    }
    /* De werkbalk woont in schetsbalk.js; dit is de smalle brug die hij
       daarvoor krijgt -- kijken en langs de gewone weg wijzigen. */
    var brug = {
      keuze: function () { return keuze; },
      zetKeuze: function (g) { keuze = keuze === g ? null : g; sel = -1; teken(); },
      sel: function () { return sel; },
      zetSel: function (i) { sel = i; },
      vormen: function () { return vormen; },
      duw: function () { duw(JSON.stringify(vormen)); },
      wegSel: function () { wegSel(); },
      onWijzig: function () { onWijzig(); },
      teken: function () { teken(); },
      meld: function (t) { meld(t); }
    };
    function balk() { return window.RTGOfficeSchetsBalk.bouw(brug); }

    /* ---- muis en vinger ---- */
    function vormBij(e) {
      var g = e.target.closest ? e.target.closest('[data-i]') : null;
      return g ? +g.getAttribute('data-i') : -1;
    }
    function neer(e) {
      var p = punt(e), voor = JSON.stringify(vormen);
      var greep = e.target.getAttribute && e.target.getAttribute('data-h');
      if (greep && sel >= 0) {
        bezig = { greep: greep, i: sel, voor: voor, basis: JSON.parse(JSON.stringify(vormen[sel])) };
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        return;
      }
      if (keuze) {
        if (vormen.length >= 300) return meld('Maximaal 300 vormen.');
        var v = keuze === 'pijl' ? { soort: 'pijl', x: p.x, y: p.y, x2: p.x, y2: p.y, tekst: '' }
          : keuze === 'tekst' ? { soort: 'tekst', x: p.x, y: p.y, tekst: '' }
          : { soort: keuze, x: p.x, y: p.y, b: 10, h: 10, tekst: '' };
        vormen.push(v); sel = vormen.length - 1;
        bezig = { nieuw: true, i: sel, vanX: p.x, vanY: p.y, voor: voor };
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        return;
      }
      var i = vormBij(e);
      sel = i;
      if (i >= 0) {
        bezig = { i: i, vanX: p.x, vanY: p.y, voor: voor, basis: JSON.parse(JSON.stringify(vormen[i])) };
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
      }
      teken();
    }
    function beweeg(e) {
      if (!bezig) return;
      var p = punt(e), v = vormen[bezig.i], b = bezig.basis;
      if (bezig.greep) {
        if (v.soort === 'pijl') {
          if (bezig.greep === 'a') { v.x = p.x; v.y = p.y; } else { v.x2 = p.x; v.y2 = p.y; }
        } else {
          var x1 = b.x, y1 = b.y, x2 = b.x + b.b, y2 = b.y + b.h;
          if (bezig.greep.indexOf('w') >= 0) x1 = p.x; else if (bezig.greep.indexOf('o') >= 0) x2 = p.x;
          if (bezig.greep.indexOf('n') >= 0) y1 = p.y; else y2 = p.y;
          v.x = Math.min(x1, x2); v.y = Math.min(y1, y2);
          v.b = Math.max(10, Math.abs(x2 - x1)); v.h = Math.max(10, Math.abs(y2 - y1));
        }
      } else if (bezig.nieuw) {
        if (v.soort === 'pijl') { v.x2 = p.x; v.y2 = p.y; }
        else if (v.soort !== 'tekst') {
          v.x = Math.min(bezig.vanX, p.x); v.y = Math.min(bezig.vanY, p.y);
          v.b = Math.max(10, Math.abs(p.x - bezig.vanX)); v.h = Math.max(10, Math.abs(p.y - bezig.vanY));
        }
      } else {
        var dx = p.x - bezig.vanX, dy = p.y - bezig.vanY;
        v.x = snap(b.x + dx); v.y = snap(b.y + dy);
        if (v.soort === 'pijl') { v.x2 = snap(b.x2 + dx); v.y2 = snap(b.y2 + dy); }
      }
      teken();
    }
    function los() {
      if (!bezig) return;
      var v = vormen[bezig.i], voor = bezig.voor;
      // een klik zonder sleep levert geen minivormpje op: tekst vraagt meteen
      // om zijn tekst, een pijl of kader van niks verdwijnt weer
      if (bezig.nieuw && v.soort === 'tekst') { bezig = null; keuze = null; zetTekst(vormen.length - 1, voor); return; }
      if (bezig.nieuw && v.soort === 'pijl' && Math.abs(v.x2 - v.x) + Math.abs(v.y2 - v.y) < 12) { vormen.pop(); sel = -1; }
      else if (bezig.nieuw && v.soort !== 'pijl' && (v.b < 12 || v.h < 12)) { vormen.pop(); sel = -1; }
      bezig = null; keuze = null;
      // alleen een echte wijziging is een stap terug waard
      if (JSON.stringify(vormen) !== voor) { duw(voor); onWijzig(); }
      teken();
    }
    function dubbel(e) {
      var i = vormBij(e);
      if (i >= 0) zetTekst(i, JSON.stringify(vormen));
    }
    function zetTekst(i, voor) {
      var t = prompt('De tekst van deze vorm (leeg = geen tekst):', vormen[i].tekst || '');
      if (t === null) { if (vormen[i].soort === 'tekst' && !vormen[i].tekst) { vormen.splice(i, 1); sel = -1; } }
      else {
        vormen[i].tekst = t.slice(0, 120);
        if (vormen[i].soort === 'tekst' && !vormen[i].tekst) { vormen.splice(i, 1); sel = -1; }
      }
      if (JSON.stringify(vormen) !== voor) { duw(voor); onWijzig(); }
      teken();
    }
    function wegSel() {
      if (sel < 0) return meld('Klik eerst een vorm aan.');
      duw(JSON.stringify(vormen));
      vormen.splice(sel, 1); sel = -1; onWijzig(); teken();
    }
    document.addEventListener('keydown', function (e) {
      if (!mag || !wrap.offsetParent) return;      // de schets is niet in beeld
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); terug(); return; }
      if (sel >= 0 && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); wegSel(); }
    });

    return {
      laad: function (inhoud, magNu) {
        mag = !!magNu; sel = -1; keuze = null; bezig = null; verleden = [];
        vormen = JSON.parse(JSON.stringify((inhoud && inhoud.vormen) || []));
        bouw();
      },
      inhoud: function () { return { vormen: vormen }; },
      naarSvg: function () {
        var kopie = svg.cloneNode(true);
        kopie.setAttribute('xmlns', V.NS);
        Array.prototype.forEach.call(kopie.querySelectorAll('.sgreep'), function (g) { g.parentNode.removeChild(g); });
        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
          kopie.outerHTML.replace(/stroke="#7F1634"/g, 'stroke="#0C0C0B"').replace(/stroke-width="3"/g, 'stroke-width="2"');
      }
    };
  }

  window.RTGOfficeSchets = { maak: maak };
})();

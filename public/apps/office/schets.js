/* RTG Office, de schets: diagrammen zoals een kantoor ze tekent -- kaders,
   ovalen, ruiten, pijlen en losse tekst op een wit vel. Kies een vorm en
   sleep om te tekenen; klik om te kiezen, sleep om te verplaatsen,
   dubbelklik om de tekst te zetten, Delete haalt weg.

   Het vel is SVG (1200 bij 800): het schaalt scherp op elk scherm, drukt
   strak af en exporteert als een echt .svg-bestand. Wit met zwarte lijnen,
   bewust: een schema is om te lezen, niet om te stylen.

   Levert window.RTGOfficeSchets. */
(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var GEREEDSCHAP = [['kader', 'Kader'], ['ovaal', 'Ovaal'], ['ruit', 'Ruit'], ['pijl', 'Pijl'], ['tekst', 'Tekst']];

  function maak(opties) {
    var wrap = opties.wrap, onWijzig = opties.onWijzig, meld = opties.meld;
    var vormen = [], mag = false, keuze = null, sel = -1, svg = null, voet = opties.voet;
    var bezig = null; // { nieuw:bool, i, vanX, vanY, basis } tijdens het slepen

    function el(naam, at) {
      var e = document.createElementNS(NS, naam);
      for (var k in at) e.setAttribute(k, at[k]);
      return e;
    }
    function punt(e) {
      var r = svg.getBoundingClientRect();
      return { x: Math.max(0, Math.min(1200, Math.round((e.clientX - r.left) * 1200 / r.width))),
        y: Math.max(0, Math.min(800, Math.round((e.clientY - r.top) * 800 / r.height))) };
    }

    function teken() {
      wrap.innerHTML = '';
      if (mag) {
        var balk = document.createElement('div');
        balk.className = 'sbalk';
        balk.innerHTML = GEREEDSCHAP.map(function (g) {
          return '<button class="tb' + (keuze === g[0] ? ' aan' : '') + '" data-vorm="' + g[0] + '" type="button">' + g[1] + '</button>';
        }).join('') + '<button class="tb weg" id="sWeg" type="button" title="Gekozen vorm weghalen">Weg</button>' +
          '<span class="fstil">Sleep om te tekenen · dubbelklik voor tekst</span>';
        wrap.appendChild(balk);
        Array.prototype.forEach.call(balk.querySelectorAll('[data-vorm]'), function (b) {
          b.addEventListener('click', function () {
            keuze = keuze === b.dataset.vorm ? null : b.dataset.vorm; sel = -1; teken();
          });
        });
        balk.querySelector('#sWeg').addEventListener('click', wegSel);
      }
      svg = el('svg', { viewBox: '0 0 1200 800', role: 'img', 'aria-label': 'Schets' });
      var pijlpunt = el('marker', { id: 'sPijlpunt', viewBox: '0 0 10 10', refX: 9, refY: 5,
        markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' });
      pijlpunt.appendChild(el('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#0C0C0B' }));
      var defs = el('defs', {}); defs.appendChild(pijlpunt); svg.appendChild(defs);
      vormen.forEach(function (v, i) { svg.appendChild(tekenVorm(v, i)); });
      wrap.appendChild(svg);
      if (mag) {
        svg.addEventListener('pointerdown', neer);
        svg.addEventListener('pointermove', beweeg);
        svg.addEventListener('pointerup', los);
        svg.addEventListener('dblclick', dubbel);
      }
      if (voet) voet.textContent = vormen.length + (vormen.length === 1 ? ' vorm' : ' vormen');
    }
    function tekenVorm(v, i) {
      var g = el('g', { 'data-i': i, 'class': i === sel ? 'sv aan' : 'sv' });
      var lijn = { fill: '#FFFFFF', stroke: i === sel ? '#7F1634' : '#0C0C0B', 'stroke-width': i === sel ? 3 : 2 };
      var mx = v.x + (v.b || 0) / 2, my = v.y + (v.h || 0) / 2;
      if (v.soort === 'kader') g.appendChild(el('rect', Object.assign({ x: v.x, y: v.y, width: v.b, height: v.h }, lijn)));
      else if (v.soort === 'ovaal') g.appendChild(el('ellipse', Object.assign({ cx: mx, cy: my, rx: v.b / 2, ry: v.h / 2 }, lijn)));
      else if (v.soort === 'ruit') g.appendChild(el('polygon', Object.assign({ points:
        mx + ',' + v.y + ' ' + (v.x + v.b) + ',' + my + ' ' + mx + ',' + (v.y + v.h) + ' ' + v.x + ',' + my }, lijn)));
      else if (v.soort === 'pijl') {
        g.appendChild(el('line', { x1: v.x, y1: v.y, x2: v.x2, y2: v.y2, stroke: lijn.stroke,
          'stroke-width': lijn['stroke-width'], 'marker-end': 'url(#sPijlpunt)' }));
        mx = (v.x + v.x2) / 2; my = (v.y + v.y2) / 2 - 8;
      } else { mx = v.x; my = v.y; }
      if (v.tekst || v.soort === 'tekst') {
        var t = el('text', { x: mx, y: my + (v.soort === 'pijl' || v.soort === 'tekst' ? 0 : 5),
          'text-anchor': v.soort === 'tekst' ? 'start' : 'middle', fill: '#0C0C0B',
          'font-size': 20, 'font-family': 'Inter, sans-serif' });
        t.textContent = v.tekst || '(dubbelklik voor tekst)';
        g.appendChild(t);
      }
      return g;
    }

    /* ---- muis en vinger ---- */
    function vormBij(e) {
      var g = e.target.closest ? e.target.closest('[data-i]') : null;
      return g ? +g.getAttribute('data-i') : -1;
    }
    function neer(e) {
      var p = punt(e);
      if (keuze) {
        if (vormen.length >= 300) return meld('Maximaal 300 vormen.');
        var v = keuze === 'pijl' ? { soort: 'pijl', x: p.x, y: p.y, x2: p.x, y2: p.y, tekst: '' }
          : keuze === 'tekst' ? { soort: 'tekst', x: p.x, y: p.y, tekst: '' }
          : { soort: keuze, x: p.x, y: p.y, b: 10, h: 10, tekst: '' };
        vormen.push(v); sel = vormen.length - 1;
        bezig = { nieuw: true, i: sel, vanX: p.x, vanY: p.y };
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
        return;
      }
      var i = vormBij(e);
      sel = i;
      if (i >= 0) {
        bezig = { nieuw: false, i: i, vanX: p.x, vanY: p.y, basis: JSON.parse(JSON.stringify(vormen[i])) };
        svg.setPointerCapture && svg.setPointerCapture(e.pointerId);
      }
      teken();
    }
    function beweeg(e) {
      if (!bezig) return;
      var p = punt(e), v = vormen[bezig.i];
      if (bezig.nieuw) {
        if (v.soort === 'pijl') { v.x2 = p.x; v.y2 = p.y; }
        else if (v.soort !== 'tekst') {
          v.x = Math.min(bezig.vanX, p.x); v.y = Math.min(bezig.vanY, p.y);
          v.b = Math.max(10, Math.abs(p.x - bezig.vanX)); v.h = Math.max(10, Math.abs(p.y - bezig.vanY));
        }
      } else {
        var dx = p.x - bezig.vanX, dy = p.y - bezig.vanY, b = bezig.basis;
        v.x = b.x + dx; v.y = b.y + dy;
        if (v.soort === 'pijl') { v.x2 = b.x2 + dx; v.y2 = b.y2 + dy; }
      }
      teken();
    }
    function los() {
      if (!bezig) return;
      var v = vormen[bezig.i];
      // een klik zonder sleep levert geen minivormpje op: tekst vraagt meteen
      // om zijn tekst, een pijl of kader van niks verdwijnt weer
      if (bezig.nieuw && v.soort === 'tekst') zetTekst(bezig.i);
      else if (bezig.nieuw && v.soort === 'pijl' && Math.abs(v.x2 - v.x) + Math.abs(v.y2 - v.y) < 12) { vormen.pop(); sel = -1; }
      else if (bezig.nieuw && v.soort !== 'pijl' && v.soort !== 'tekst' && (v.b < 12 || v.h < 12)) { vormen.pop(); sel = -1; }
      bezig = null; keuze = null; onWijzig(); teken();
    }
    function dubbel(e) {
      var i = vormBij(e);
      if (i >= 0) zetTekst(i);
    }
    function zetTekst(i) {
      var t = prompt('De tekst van deze vorm (leeg = geen tekst):', vormen[i].tekst || '');
      if (t === null) { if (vormen[i].soort === 'tekst' && !vormen[i].tekst) { vormen.splice(i, 1); sel = -1; } }
      else {
        vormen[i].tekst = t.slice(0, 120);
        if (vormen[i].soort === 'tekst' && !vormen[i].tekst) { vormen.splice(i, 1); sel = -1; }
      }
      onWijzig(); teken();
    }
    function wegSel() {
      if (sel < 0) return meld('Klik eerst een vorm aan.');
      vormen.splice(sel, 1); sel = -1; onWijzig(); teken();
    }
    document.addEventListener('keydown', function (e) {
      if (!mag || sel < 0 || (e.key !== 'Delete' && e.key !== 'Backspace')) return;
      var a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.isContentEditable)) return;
      if (!wrap.offsetParent) return; // de schets is niet in beeld
      e.preventDefault(); wegSel();
    });

    return {
      laad: function (inhoud, magNu) {
        mag = !!magNu; sel = -1; keuze = null; bezig = null;
        vormen = JSON.parse(JSON.stringify((inhoud && inhoud.vormen) || []));
        teken();
      },
      inhoud: function () { return { vormen: vormen }; },
      naarSvg: function () {
        var kopie = svg.cloneNode(true);
        kopie.setAttribute('xmlns', NS);
        kopie.querySelectorAll('.sv').forEach(function (g) { g.setAttribute('class', 'sv'); });
        return '<?xml version="1.0" encoding="UTF-8"?>\n' +
          kopie.outerHTML.replace(/stroke="#7F1634"/g, 'stroke="#0C0C0B"').replace(/stroke-width="3"/g, 'stroke-width="2"');
      }
    };
  }

  window.RTGOfficeSchets = { maak: maak };
})();

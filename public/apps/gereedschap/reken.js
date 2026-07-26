/* RTG Gereedschap, de rekenmachine: toetsen en toetsenbord op de eigen
   rekenmotor (shared/rekenkern.js, geen eval), live meerekenen, en de
   zakelijke vakken: btw twee kanten op en een rekening delen met fooi.
   Regelt ook de tabbladen van de pagina. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  /* ---- tabbladen ---- */
  Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (kn) {
    kn.addEventListener('click', function () {
      Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'), function (x) {
        x.classList.toggle('aan', x === kn);
      });
      Array.prototype.forEach.call(document.querySelectorAll('.paneel'), function (p) {
        p.classList.toggle('open', p.id === 'tab-' + kn.dataset.tab);
      });
    });
  });

  var euro = function (n) {
    return 'EUR ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ',');
  };
  var toon = function (n) {
    var t = String(n).replace('.', ',');
    return t.length > 14 ? String(Number(n).toPrecision(10)).replace('.', ',') : t;
  };

  /* ---- de toetsen ---- */
  var RIJEN = ['C', '(', ')', '/', '7', '8', '9', 'x', '4', '5', '6', '-', '1', '2', '3', '+', '0', ',', '%', '='];
  $('#rkToetsen').innerHTML = RIJEN.map(function (k) {
    if (k === '=') return '<button class="gelijk" data-k="=" type="button">=</button>';
    var op = '()/x-+%C'.includes(k);
    return '<button' + (op ? ' class="op"' : '') + ' data-k="' + k + '" type="button">' + k + '</button>';
  }).join('');

  var scherm = $('#rkScherm');
  function live() {
    var t = scherm.value.trim();
    if (!t) { $('#rkUitkomst').textContent = ''; return; }
    var r = window.RTGReken.reken(t);
    $('#rkUitkomst').textContent = r.fout ? '' : '= ' + toon(r.waarde);
  }
  function druk(k) {
    if (k === 'C') { scherm.value = ''; live(); return; }
    if (k === '=') {
      var r = window.RTGReken.reken(scherm.value);
      if (r.fout) { $('#rkUitkomst').textContent = r.fout; return; }
      scherm.value = toon(r.waarde);
      $('#rkUitkomst').textContent = '';
      return;
    }
    scherm.value += k;
    live();
  }
  $('#rkToetsen').addEventListener('click', function (e) {
    var k = e.target && e.target.dataset && e.target.dataset.k;
    if (k) druk(k);
  });
  scherm.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); druk('='); return; }
    if (e.key === 'Escape') { druk('C'); return; }
    if (/^[0-9+\-*/().,%x]$/.test(e.key)) { e.preventDefault(); druk(e.key === '*' ? 'x' : e.key); return; }
    if (e.key === 'Backspace') { setTimeout(live, 0); return; }
    if (e.key.length === 1) e.preventDefault();   // vreemde tekens komen er niet in
  });

  /* ---- btw: twee kanten op, eerlijk afgerond ---- */
  function btw() {
    var b = parseFloat(String($('#btwBedrag').value).replace(',', '.'));
    if (!Number.isFinite(b)) { $('#btwUit').textContent = ''; return; }
    var p = +$('#btwPct').value / 100;
    if ($('#btwKant').value === 'ex') {
      $('#btwUit').innerHTML = 'btw ' + euro(b * p) + '<br>samen ' + euro(b * (1 + p));
    } else {
      var ex = b / (1 + p);
      $('#btwUit').innerHTML = 'zonder btw ' + euro(ex) + '<br>waarvan btw ' + euro(b - ex);
    }
  }
  ['btwBedrag', 'btwPct', 'btwKant'].forEach(function (id) {
    $('#' + id).addEventListener('input', btw);
    $('#' + id).addEventListener('change', btw);
  });

  /* ---- de rekening delen: bedrag, personen, fooi ---- */
  function splits() {
    var b = parseFloat(String($('#splitBedrag').value).replace(',', '.'));
    var n = parseInt($('#splitPersonen').value, 10);
    if (!Number.isFinite(b) || !Number.isFinite(n) || n < 1) { $('#splitUit').textContent = ''; return; }
    var fooi = b * (+$('#splitFooi').value / 100);
    var totaal = b + fooi;
    $('#splitUit').innerHTML = (fooi ? 'met fooi ' + euro(totaal) + '<br>' : '') +
      'per persoon ' + euro(totaal / n);
  }
  ['splitBedrag', 'splitPersonen', 'splitFooi'].forEach(function (id) {
    $('#' + id).addEventListener('input', splits);
    $('#' + id).addEventListener('change', splits);
  });
})();

/* De rekenmachine als app in de RTG App Store.

   TWEE DINGEN DIE DEZE APP ANDERS DOEN DAN HETZELFDE SCHERM IN RTG GEREEDSCHAP.

   1. Hij rekent met dezelfde motor (rekenkern.js, shunting-yard, geen eval),
      maar die motor zit IN de bundel. Een cel heeft geen netwerk, dus er is niets
      te delen met de rest van het huis -- en dat is de prijs van de grens en
      geen omissie.
   2. Hij bewaart twee voorkeuren via RTG.roep('opslag.zet'), en verder niets.
      Faalt die aanroep -- het lid heeft de machtiging niet verleend, of hij nam
      hem terug -- dan werkt de app gewoon door zonder te onthouden. Een app die
      stukgaat op een machtiging die hij niet kreeg, straft het lid voor een
      keuze die hij mocht maken. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };

  /* ---- onthouden, en het mag mislukken ---- */
  var kanBewaren = true;
  function bewaar(sleutel, waarde) {
    if (!kanBewaren || !window.RTG) return;
    window.RTG.roep('opslag.zet', { sleutel: sleutel, waarde: String(waarde) })
      .catch(function () { kanBewaren = false; });
  }
  function haal(sleutel) {
    if (!window.RTG) return Promise.resolve(null);
    return window.RTG.roep('opslag.lees', { sleutel: sleutel })
      .then(function (r) { return r && r.waarde != null ? r.waarde : null; })
      .catch(function () { kanBewaren = false; return null; });
  }

  var euro = function (n) { return 'EUR ' + (Math.round(n * 100) / 100).toFixed(2).replace('.', ','); };
  var toon = function (n) {
    var t = String(n).replace('.', ',');
    return t.length > 14 ? String(Number(n).toPrecision(10)).replace('.', ',') : t;
  };

  /* ---- de toetsen ---- */
  var RIJEN = ['C', '(', ')', '/', '7', '8', '9', 'x', '4', '5', '6', '-', '1', '2', '3', '+', '0', ',', '%', '='];
  $('#rkToetsen').innerHTML = RIJEN.map(function (k) {
    if (k === '=') return '<button class="gelijk" data-k="=" type="button">=</button>';
    var op = '()/x-+%C'.indexOf(k) !== -1;
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
    if (e.key.length === 1) e.preventDefault();
  });

  /* ---- btw, twee kanten op ---- */
  function btw() {
    var b = parseFloat(String($('#btwBedrag').value).replace(',', '.'));
    if (!isFinite(b)) { $('#btwUit').textContent = ''; return; }
    var p = +$('#btwPct').value / 100;
    if ($('#btwKant').value === 'ex') {
      $('#btwUit').textContent = 'btw ' + euro(b * p) + ' · samen ' + euro(b * (1 + p));
    } else {
      var ex = b / (1 + p);
      $('#btwUit').textContent = 'zonder btw ' + euro(ex) + ' · waarvan btw ' + euro(b - ex);
    }
  }
  ['btwBedrag', 'btwPct', 'btwKant'].forEach(function (id) {
    $('#' + id).addEventListener('input', btw);
    $('#' + id).addEventListener('change', btw);
  });
  $('#btwPct').addEventListener('change', function () { bewaar('btw-tarief', $('#btwPct').value); });

  /* ---- de rekening delen ---- */
  function splits() {
    var b = parseFloat(String($('#splitBedrag').value).replace(',', '.'));
    var n = parseInt($('#splitPersonen').value, 10);
    if (!isFinite(b) || !isFinite(n) || n < 1) { $('#splitUit').textContent = ''; return; }
    var fooi = b * (+$('#splitFooi').value / 100);
    var totaal = b + fooi;
    $('#splitUit').textContent = (fooi ? 'met fooi ' + euro(totaal) + ' · ' : '') + 'per persoon ' + euro(totaal / n);
  }
  ['splitBedrag', 'splitPersonen', 'splitFooi'].forEach(function (id) {
    $('#' + id).addEventListener('input', splits);
    $('#' + id).addEventListener('change', splits);
  });
  $('#splitFooi').addEventListener('change', function () { bewaar('fooi', $('#splitFooi').value); });

  /* De voorkeuren terugzetten. Ze worden pas gelezen als het scherm er staat:
     een app die wacht op de brug voordat hij iets toont, voelt traag terwijl er
     niets te wachten viel. */
  haal('btw-tarief').then(function (v) { if (v && $('#btwPct').querySelector('option[value="' + v + '"]')) $('#btwPct').value = v; });
  haal('fooi').then(function (v) { if (v && $('#splitFooi').querySelector('option[value="' + v + '"]')) $('#splitFooi').value = v; });
})();

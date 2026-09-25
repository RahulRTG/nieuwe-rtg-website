/* Magnaat FROM ZERO: het invulveld van een handeling op Vandaag. De server zegt
   per handeling wat erin moet (`invoer`): vaste waarden gaan ongezien mee,
   markeringen worden velden. Dit bestand bouwt die velden en leest ze terug;
   rekenen doet het niet. Gebruikt door ./magnaat-leven.js. */
(function () {
  'use strict';
  /* Vaste waarden die de server al invulde: een opdracht, een dag, wie het doet. */
  var VAST = ['deal', 'wat', 'dag', 'post', 'wie', 'medewerker', 'contract'];

  function keuzes(id, label, lijst) {
    return '<label>' + label + ' <select id="vnF-' + id + '">' + lijst.join('') + '</select></label>';
  }

  function html(a, h) {
    var i = a.invoer || {}, esc = h.esc, duur = h.duur, v = '<p>' + esc(a.waarom) + '</p><div class="vn-velden">';
    var opties = function (l) { return l.map(function (x) { return '<option value="' + esc(x.id) + '">' + esc(x.naam) + '</option>'; }); };
    if (Array.isArray(i.aanbod)) v += keuzes('aanbod', 'Wat ga je maken', opties(i.aanbod));
    if (Array.isArray(i.kandidaat)) v += keuzes('kandidaat', 'Wie neem je aan', opties(i.kandidaat));
    if (Array.isArray(i.wijk)) v += keuzes('wijk', 'Waarheen', opties(i.wijk));
    if (Array.isArray(i.stand)) v += keuzes('stand', 'Hoe zwaar', opties(i.stand));
    if (i.bedrag === 'euro') v += '<label>Bedrag in hele euro\'s <input id="vnF-bedrag" type="number" min="1" step="1" inputmode="numeric"></label>';
    if (i.aantal === 'getal') v += '<label>Hoeveel stuks <input id="vnF-aantal" type="number" min="' + (i.minimum || 1) + '" step="1" value="' + (i.minimum || 1) + '" inputmode="numeric"></label>';
    if (typeof i.dagen === 'number') v += '<label>Af binnen (dagen) <input id="vnF-dagen" type="number" min="1" max="60" step="1" value="' + i.dagen + '"></label>';
    if (Array.isArray(i.voorschot)) v += keuzes('voorschot', 'Vooraf', i.voorschot.map(function (p) { return '<option value="' + p + '">' + (p ? p + '%' : 'niets') + '</option>'; }));
    if (i.minuten === 'minuten') {
      var m = [];
      for (var n = h.vrij - (h.vrij % 30); n >= 30; n -= 30) m.push('<option value="' + n + '">' + duur(n) + '</option>');
      v += keuzes('minuten', 'Hoe lang', m);
    }
    if (i.procent === 'getal') v += '<label>Korting in procent <input id="vnF-procent" type="number" min="1" max="20" step="1" value="3"></label>';
    if (i.naam === 'tekst') v += '<label>Naam van je onderneming <input id="vnF-naam" maxlength="60"></label>';
    return v + '</div><button class="btn primary" type="button" data-vn-doe>' + esc(a.label) + '</button>';
  }

  function lichaam(a, q) {
    var b = { actie: a.actie }, i = a.invoer || {}, v = function (n) { var e = q('#vnF-' + n); return e ? e.value : undefined; };
    VAST.forEach(function (k) { if (i[k] != null && typeof i[k] !== 'object') b[k] = i[k]; });
    if (typeof i.minuten === 'number') b.minuten = i.minuten;
    if (i.aanbod) b.aanbod = v('aanbod');
    if (i.kandidaat) b.kandidaat = v('kandidaat');
    if (i.wijk) b.wijk = v('wijk');
    if (i.stand) b.stand = v('stand');
    if (i.bedrag) b.bedrag = Number(v('bedrag'));
    if (i.aantal) b.aantal = Number(v('aantal'));
    if (i.voorschot) b.voorschot = Number(v('voorschot'));
    if (typeof i.dagen === 'number') b.dagen = Number(v('dagen'));
    if (i.minuten === 'minuten') b.minuten = Number(v('minuten'));
    if (i.procent) b.procent = Number(v('procent'));
    if (i.naam) b.naam = v('naam');
    return b;
  }

  /* Een handeling zonder iets om in te vullen gaat meteen. */
  function zonderVelden(a) {
    var i = a.invoer || {};
    return !(i.aanbod || i.kandidaat || i.wijk || i.stand || i.bedrag || i.aantal || i.minuten === 'minuten' || i.procent || i.naam || typeof i.dagen === 'number');
  }

  window.RTGMagnaatLevenInvoer = { html: html, lichaam: lichaam, zonderVelden: zonderVelden };
}());

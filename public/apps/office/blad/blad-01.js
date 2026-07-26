/* RTG Office, het rekenblad: het raster en wat je ziet.

   Wat een blad tot een blad maakt is niet het hokjespatroon maar wat eromheen
   staat: een formulebalk die zegt in welke cel u staat en wat er echt in staat
   (de formule, niet de uitkomst), koppen die blijven staan als u naar beneden
   scrolt, opmaak per cel zodat geld er als geld uitziet, en onderaan de som
   van wat u geselecteerd heeft.

   HET REKENEN STAAT HIER NIET MEER. Dat zit in shared/rekenmotor.js, met de
   functielijst in shared/rekenfuncties*.js: ruim honderd functies onder hun
   Nederlandse én Engelse naam, kolommen die doorlopen na Z, verwijzingen naar
   een ander blad, en een echte ontleder zodat een formule nooit als code
   draait. Dit bestand vraagt de motor alleen wat er in een cel komt te staan.

   Levert window.RTGOfficeBlad. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var MOTOR = window.RTGRekenmotor;
  var kolLetter = MOTOR.kolNaam;

  function maak(opties) {
    var tabel = opties.tabel, refVak = opties.refVak, invoer = opties.invoer,
        voet = opties.voet, onWijzig = opties.onWijzig;
    var data = { cellen: {}, opmaak: {}, rijen: 20, kolommen: 8 };
    var magBewerken = false, actief = 'A1';

    /* De motor leest rechtstreeks uit `data.cellen`. Er is dus geen tweede
       kopie van het blad die uit de pas kan lopen -- wat u typt is wat hij
       rekent. Bij elke hertekening telt hij opnieuw; dat is bij deze
       afmetingen ruim snel genoeg en het scheelt een berg boekhouding over
       welke cel van welke afhangt. */
    var motor = MOTOR.maak({
      ruw: function (blad, kol, rij) { return data.cellen[kolLetter(kol) + (rij + 1)] || ''; }
    });
    function bereken(formule) { return motor.waarde(String(formule).slice(1)); }

    /* ---- tonen: de opmaak bepaalt hoe een uitkomst eruitziet ---- */
    function ruweUitkomst(ref) {
      var rauw = data.cellen[ref];
      if (rauw == null || rauw === '') return '';
      return String(rauw).charAt(0) === '=' ? bereken(rauw) : rauw;
    }
    function toonWaarde(ref) {
      var uit = ruweUitkomst(ref);
      if (uit === '' || uit == null) return '';
      if (MOTOR.isFout(uit)) return uit;
      var op = data.opmaak[ref];
      if (op === 'geld' || op === 'getal' || op === 'procent') {
        if (!MOTOR.isGetallig(uit)) return MOTOR.tekstVan(uit);
        var n = MOTOR.getalVan(uit);
        if (op === 'procent') return (Math.round(n * 1000) / 10).toString().replace('.', ',') + '%';
        var s = Math.abs(n).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return (n < 0 ? '-' : '') + (op === 'geld' ? '€ ' : '') + s;
      }
      return MOTOR.tekstVan(uit);
    }

    function teken() {
      var h = '<thead><tr><th></th>';
      for (var c = 0; c < data.kolommen; c++) h += '<th>' + kolLetter(c) + '</th>';
      h += '</tr></thead><tbody>';
      for (var r = 1; r <= data.rijen; r++) {
        h += '<tr><td class="rijkop">' + r + '</td>';
        for (var k = 0; k < data.kolommen; k++) {
          var ref = kolLetter(k) + r;
          var rauw = data.cellen[ref] || '';
          var isForm = String(rauw).charAt(0) === '=';
          var toon = toonWaarde(ref);
          var klas = (data.opmaak[ref] === 'kop' ? 'kopcel' : (data.opmaak[ref] || ''));
          if (MOTOR.isFout(toon)) klas += ' fout';
          if (ref === actief) klas += ' actief';
          h += '<td tabindex="0" data-ref="' + ref + '"' + (isForm ? ' data-berekend="1"' : '') +
            (klas ? ' class="' + klas.trim() + '"' : '') + '>' + esc(toon) + '</td>';
        }
        h += '</tr>';
      }
      tabel.innerHTML = h + '</tbody>';

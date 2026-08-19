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
        // Een filter verbergt rijen; hij hoort NIET bij het document (hij wordt
        // niet bewaard), want een filter is hoe u nu kijkt, niet wat er staat.
        if (data.verborgen && data.verborgen[r]) continue;
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
      Array.prototype.forEach.call(tabel.querySelectorAll('td[data-ref]'), function (td) {
        td.addEventListener('focus', function () { kies(td.dataset.ref); });
        td.addEventListener('dblclick', function () { invoer.focus(); invoer.select(); });
        td.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); invoer.focus(); invoer.select(); return; }
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); zetCel(td.dataset.ref, ''); return; }
          /* Het klembord van het blad: kopiëren, knippen en plakken met
             verwijzingen die MEESCHUIVEN (=B2*C2 een rij lager geplakt is
             =B3*C3; een dollarteken zet vast). Ctrl+Z draait terug. */
          if ((e.ctrlKey || e.metaKey) && !e.altKey) {
            var kk = e.key.toLowerCase();
            if (kk === 'c' || kk === 'x') {
              e.preventDefault();
              klem = { ref: td.dataset.ref, w: data.cellen[td.dataset.ref] || '' };
              if (kk === 'x') zetCel(td.dataset.ref, '');
              return;
            }
            if (kk === 'v' && klem && magBewerken) {
              e.preventDefault();
              var hier = /^([A-Z]+)([0-9]+)$/.exec(td.dataset.ref), daar = /^([A-Z]+)([0-9]+)$/.exec(klem.ref);
              zetCel(td.dataset.ref, window.RTGRekenschuif.verschuif(klem.w,
                (+hier[2]) - (+daar[2]), MOTOR.kolIndex(hier[1]) - MOTOR.kolIndex(daar[1])));
              return;
            }
            if (kk === 'z') { e.preventDefault(); terugdraai(); return; }
          }
          var m = /^([A-Z]+)([0-9]+)$/.exec(td.dataset.ref);
          if (!m) return;
          var k = MOTOR.kolIndex(m[1]), r = +m[2], stap = null;
          if (e.key === 'ArrowRight') stap = [k + 1, r]; else if (e.key === 'ArrowLeft') stap = [k - 1, r];
          else if (e.key === 'ArrowDown') stap = [k, r + 1]; else if (e.key === 'ArrowUp') stap = [k, r - 1];
          if (!stap) return;
          e.preventDefault();
          var doel = tabel.querySelector('td[data-ref="' + kolLetter(Math.max(0, Math.min(data.kolommen - 1, stap[0]))) +
            Math.max(1, Math.min(data.rijen, stap[1])) + '"]');
          if (doel) doel.focus();
        });
      });
      voetBij();
    }

    function kies(ref) {
      actief = ref;
      refVak.textContent = ref;
/* de actieve cel: invoer, selectie en het blad */
      invoer.value = data.cellen[ref] || '';
      Array.prototype.forEach.call(tabel.querySelectorAll('td.actief'), function (t) { t.classList.remove('actief'); });
      var td = tabel.querySelector('td[data-ref="' + ref + '"]');
      if (td) td.classList.add('actief');
      voetBij();
    }
    function zetCel(ref, waarde) {
      if (!magBewerken) return;
      var nieuw = waarde ? String(waarde).slice(0, 400) : '';
      if ((data.cellen[ref] || '') === nieuw) return;
      onthoud([{ ref: ref, oud: data.cellen[ref] }]);
      if (nieuw) data.cellen[ref] = nieuw; else delete data.cellen[ref];
      onWijzig(); teken(); kies(ref);
    }

    /* Ongedaan maken: elke wijziging onthoudt wat er stond -- ook een
       sortering of een doorvoer-reeks, als ÉÉN stap. Veertig stappen diep;
       ouder werk staat in de versiegeschiedenis van het document. */
    var klem = null, verleden = [];
    function onthoud(groep) {
      verleden.push(groep);
      if (verleden.length > 40) verleden.shift();
    }
    function terugdraai() {
      if (!magBewerken || !verleden.length) return;
      verleden.pop().forEach(function (x) {
        if (x.oud == null) delete data.cellen[x.ref]; else data.cellen[x.ref] = x.oud;
        if (x.opm !== undefined) { if (x.opm) data.opmaak[x.ref] = x.opm; else delete data.opmaak[x.ref]; }
      });
      onWijzig(); teken(); kies(actief);
    }

    /* De voet: wat staat er in deze kolom onder de actieve cel? Som, gemiddelde
       en aantal, zoals elk rekenblad dat onderaan meldt. */
    function voetBij() {
      var m = /^([A-Z]+)([0-9]+)$/.exec(actief);
      if (!m || !voet) return;
      var getallen = [];
      for (var r = 1; r <= data.rijen; r++) {
        var uit = ruweUitkomst(m[1] + r);
        if (uit === '' || MOTOR.isFout(uit) || !MOTOR.isGetallig(uit)) continue;
        getallen.push(MOTOR.getalVan(uit));
      }
      var som = getallen.reduce(function (n, x) { return n + x; }, 0);
      var rond = function (x) { return (Math.round(x * 100) / 100).toString().replace('.', ','); };
      voet.textContent = 'Kolom ' + m[1] + ': ' + getallen.length + (getallen.length === 1 ? ' getal' : ' getallen') +
        (getallen.length ? ' · som ' + rond(som) + ' · gemiddeld ' + rond(som / getallen.length) : '') +
        ' · ' + Object.keys(data.cellen).length + ' cellen gevuld';
    }

    /* ---- de werkbalk van het blad ---- */
    var OPMAAK = [['', 'Gewoon'], ['kop', 'Kop'], ['geld', 'Bedrag'], ['procent', 'Procent'], ['getal', 'Getal']];
    function bouwBalk(host) {
      host.innerHTML = '<span class="groep">' +
        OPMAAK.map(function (o) {
          return '<button class="tb" type="button" data-op="' + o[0] + '" title="' + o[1] + '">' + o[1] + '</button>';
        }).join('') + '</span><span class="groep">' +
        '<button class="tb" type="button" data-groei="rij" title="Rij erbij">+ rij</button>' +
        '<button class="tb" type="button" data-groei="kolom" title="Kolom erbij">+ kolom</button></span>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-op]'), function (b) {
        b.addEventListener('click', function () {
          if (!magBewerken) return;
          if (b.dataset.op) data.opmaak[actief] = b.dataset.op; else delete data.opmaak[actief];
          onWijzig(); teken(); kies(actief);
        });
      });
      Array.prototype.forEach.call(host.querySelectorAll('[data-groei]'), function (b) {
        b.addEventListener('click', function () {
          if (!magBewerken) return;
          // De kolommen lopen door na Z (AA, AB, ...), dus die grens hoeft niet
          // meer bij 26 te liggen.
          if (b.dataset.groei === 'rij') data.rijen = Math.min(500, data.rijen + 5);
          else data.kolommen = Math.min(60, data.kolommen + 1);
          onWijzig(); teken();
        });
      });
      /* De pro-laag hangt zichzelf hierachter: functie-zoeker, sorteren,
         filteren en een grafiek (apps/office/bladpro.js). Die staat apart
         omdat het ander werk is -- dit bestand gaat over het raster zelf.
         Is hij er niet, dan werkt het blad gewoon zonder. */
      if (window.RTGOfficeBladPro) window.RTGOfficeBladPro.balk(host, zelf);
    }

    invoer.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); zetCel(actief, invoer.value.trim()); var td = tabel.querySelector('td[data-ref="' + actief + '"]'); if (td) td.focus(); }
      if (e.key === 'Escape') { invoer.value = data.cellen[actief] || ''; }
    });
    invoer.addEventListener('blur', function () {
      if ((data.cellen[actief] || '') !== invoer.value.trim()) zetCel(actief, invoer.value.trim());
    });

    var zelf = {
      laad: function (inhoud, mag) {
        magBewerken = !!mag;
        data = { cellen: Object.assign({}, (inhoud && inhoud.cellen) || {}),
          opmaak: Object.assign({}, (inhoud && inhoud.opmaak) || {}),
          rijen: (inhoud && inhoud.rijen) || 20, kolommen: (inhoud && inhoud.kolommen) || 8 };
        actief = 'A1'; invoer.disabled = !mag;
        // een ander document is een ander verleden: hier niets terugdraaien
        verleden = []; klem = null;
        teken(); kies('A1');
      },
      /* Wat de pro-laag mag: kijken, en langs de gewone weg wijzigen. Geen
         eigen tekenwerk, geen eigen opslag -- één blad, één waarheid. */
      data: function () { return data; },
      actief: function () { return actief; },
      mag: function () { return magBewerken; },
      motor: function () { return motor; },
      toon: function (ref) { return toonWaarde(ref); },
      uitkomst: function (ref) { return ruweUitkomst(ref); },
      zetCel: zetCel,
      onthoud: onthoud,
      vernieuw: function () { onWijzig(); teken(); kies(actief); },
      hertekenen: teken,
      bouwBalk: bouwBalk,
      inhoud: function () { return { cellen: data.cellen, opmaak: data.opmaak, rijen: data.rijen, kolommen: data.kolommen }; },
      naarCsv: function () {
        var rijen = [];
        for (var r = 1; r <= data.rijen; r++) {
          var cel = [];
          for (var c = 0; c < data.kolommen; c++) cel.push('"' + String(toonWaarde(kolLetter(c) + r)).replace(/"/g, '""') + '"');
          rijen.push(cel.join(','));
        }
        return rijen.join('\n');
      },
      zetFormule: function (f) { zetCel(actief, f); }
    };
    return zelf;
  }

  window.RTGOfficeBlad = { maak: maak };
})();

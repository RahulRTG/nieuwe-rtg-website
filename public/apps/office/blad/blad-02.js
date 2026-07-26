      Array.prototype.forEach.call(tabel.querySelectorAll('td[data-ref]'), function (td) {
        td.addEventListener('focus', function () { kies(td.dataset.ref); });
        td.addEventListener('dblclick', function () { invoer.focus(); invoer.select(); });
        td.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === 'F2') { e.preventDefault(); invoer.focus(); invoer.select(); return; }
          if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); zetCel(td.dataset.ref, ''); return; }
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
      invoer.value = data.cellen[ref] || '';
      Array.prototype.forEach.call(tabel.querySelectorAll('td.actief'), function (t) { t.classList.remove('actief'); });
      var td = tabel.querySelector('td[data-ref="' + ref + '"]');
      if (td) td.classList.add('actief');
      voetBij();
    }
    function zetCel(ref, waarde) {
      if (!magBewerken) return;
      if (waarde) data.cellen[ref] = String(waarde).slice(0, 400); else delete data.cellen[ref];
      onWijzig(); teken(); kies(ref);
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

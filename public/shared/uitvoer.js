/* Uitvoer: uw gegevens meenemen uit elke app.

   Van de apps die hier "volwaardig" heten kon een kwart zijn gegevens
   uitvoeren; van de rest vijf procent. Dat is precies het verschil tussen
   een scherm dat uw gegevens TOONT en een app die ze aan U geeft -- en dit
   huis zegt in zijn eigen documenten dat de gegevens van het lid zijn.
   Vandaar deze laag: niet zeventig keer een exportknop, maar een.

   Hij leest wat de app al op het scherm heeft staan: een echte tabel, of
   een lijst van rijen die er allemaal hetzelfde uitzien (de vorm die dit
   huis overal gebruikt: .rij, .item, .club, .kaart in een lijst). Daar is
   geen bedrading per app voor nodig, en dus kan hij ook niet verlopen als
   een app verandert -- wat u ziet is wat u meeneemt.

   Een app die het beter weet, zegt het zelf:
     RTGUitvoer.bron(function () { return { naam: 'clubs', rijen: [...] }; });

   CSV en JSON, allebei ter plekke gemaakt; er gaat niets naar een server.
   De knop komt in het bedieningspaneel van de app (of, als dat er niet is,
   naast de eerste kop) en heet gewoon "Meenemen". */
(function () {
  'use strict';
  if (window.RTGUitvoer) return;

  var eigenBron = null;

  function tekst(el) { return (el.textContent || '').replace(/\s+/g, ' ').trim(); }

  /* Alles wat we NIET als gegevens beschouwen: onze eigen knoppen, de
     menubalk, de deur, en wat de pagina zelf verborgen houdt. */
  function telt(el) {
    if (!el || !el.classList) return false;
    if (el.classList.contains('rtgdeel-balk') || el.classList.contains('rtgdeur') ||
        el.classList.contains('rtguitvoer')) return false;
    if (el.closest && el.closest('.rtgdeel-balk,.rtgdeur,nav,header,footer')) return false;
    if (el.hidden || (el.offsetParent === null && el.tagName !== 'TR')) return false;
    return true;
  }

  // een echte tabel is het duidelijkst: koppen uit thead of de eerste rij
  function uitTabel(t) {
    var rijen = [].slice.call(t.querySelectorAll('tr')).filter(telt);
    if (rijen.length < 2) return null;
    var kop = [].slice.call(rijen[0].children).map(tekst);
    var data = rijen.slice(1).map(function (r) { return [].slice.call(r.children).map(tekst); });
    return { naam: 'tabel', kolommen: kop, rijen: data };
  }

  /* Geen lijst-schraper meer, en dat is een besluit.

     De eerste versie pakte de grootste groep gelijkvormige rijen uit het
     scherm. Dat WERKTE -- op vier van tien proefpagina's kwam er iets uit --
     maar wat eruit kwam was "01PassenElke pas heeft een eigen stem" in een
     kolom: alle tekst van een kaart aan elkaar geplakt, zonder velden. Dat
     is geen gegevensuitvoer, dat is een vinkje dat eruitziet als een
     functie. In een huis waar een meter die liegt erger is dan geen meter,
     hoort een export die rommel geeft er ook niet te zijn.

     Wat blijft: een ECHTE tabel (kolommen zijn dan echt kolommen), of wat
     de app zelf aanmeldt met RTGUitvoer.bron(). Dat tweede is het pad voor
     elke app die zijn gegevens serieus wil meegeven, en het kost per app
     drie regels omdat de app zijn eigen model al kent. */
  function verzamel() {
    if (eigenBron) {
      try {
        var e = eigenBron();
        if (e && e.rijen && e.rijen.length && e.kolommen && e.kolommen.length) return e;
      } catch (x) { /* een app die struikelt, blokkeert de rest niet */ }
    }
    var wortel = document.querySelector('main') || document.querySelector('[role="main"]') || document.body;
    var tabellen = [].slice.call(wortel.querySelectorAll('table')).filter(telt);
    for (var i = 0; i < tabellen.length; i++) {
      var t = uitTabel(tabellen[i]);
      if (t && t.kolommen.length >= 2) return t;   // een kolom is geen tabel
    }
    return null;
  }

  function csv(d) {
    var veld = function (v) {
      v = String(v == null ? '' : v);
      return /[",;\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
    };
    return [d.kolommen.map(veld).join(';')]
      .concat(d.rijen.map(function (r) { return r.map(veld).join(';'); })).join('\r\n');
  }

  function bewaar(naam, inhoud, type) {
    var blob = new Blob([inhoud], { type: type + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = naam;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  function bestandsnaam(ext) {
    var app = (document.title || 'rtg').split(/[-·|]/)[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return (app || 'rtg') + '.' + ext;
  }

  function neemMee(vorm) {
    var d = verzamel();
    if (!d) return { ok: false, reden: 'Hier staat nog niets om mee te nemen.' };
    if (vorm === 'json') {
      var objecten = d.rijen.map(function (r) {
        var o = {}; d.kolommen.forEach(function (k, i) { o[k || ('kolom' + (i + 1))] = r[i]; }); return o;
      });
      bewaar(bestandsnaam('json'), JSON.stringify(objecten, null, 1), 'application/json');
    } else {
      bewaar(bestandsnaam('csv'), csv(d), 'text/csv');
    }
    return { ok: true, aantal: d.rijen.length };
  }

  window.RTGUitvoer = {
    bron: function (f) { eigenBron = typeof f === 'function' ? f : null; },
    beschikbaar: function () { return !!verzamel(); },
    gegevens: verzamel,
    neemMee: neemMee
  };
})();

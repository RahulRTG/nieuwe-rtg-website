/* RTG Office, de presentatie: de dia-strook, de indelingen en het presenteren.

   Een deck bouw je niet in een lijst van tekstvakken onder elkaar. Links staat
   een strook met alle dia's, zodat u ziet hoe het verhaal loopt en er sleept
   of springt; rechts de dia waar u aan werkt. Elke dia heeft een indeling --
   titelblad, punten, twee kolommen, citaat of een groot cijfer -- en een
   sprekersnotitie die alleen u ziet.

   Bij het presenteren staat de dia schermvullend; de notitie kunt u eronder
   aanzetten voor uzelf. Pijltjes en spatie lopen door het deck.

   Levert window.RTGOfficePres. */
(function () {
  'use strict';
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var INDELINGEN = [
    ['titel', 'Titelblad', 'Een titel, groot, met een regel eronder.'],
    ['punten', 'Punten', 'Een titel met een regel per punt.'],
    ['twee', 'Twee kolommen', 'Links en rechts, gescheiden door een lege regel.'],
    ['citaat', 'Citaat', 'Een uitspraak of de vraag aan de zaal.'],
    ['cijfer', 'Groot cijfer', 'Een getal dat het verhaal draagt.']
  ];

  function maak(opties) {
    var rail = opties.rail, vlak = opties.vlak, onWijzig = opties.onWijzig, meld = opties.meld;
    var dias = [], huidig = 0, magBewerken = false;

    function schoon(d) {
      return { indeling: d && d.indeling ? d.indeling : 'punten',
        titel: (d && d.titel) || '', tekst: (d && d.tekst) || '', notitie: (d && d.notitie) || '' };
    }

    function tekenRail() {
      rail.innerHTML = dias.map(function (d, i) {
        return '<button class="mini-dia' + (i === huidig ? ' aan' : '') + '" type="button" data-dia="' + i + '">' +
          '<i>' + (i + 1) + ' · ' + esc(labelVan(d.indeling)) + '</i>' +
          '<b>' + esc(d.titel || '(zonder titel)') + '</b>' +
          '<span>' + esc(String(d.tekst || '').split('\n')[0].slice(0, 42)) + '</span></button>';
      }).join('') + (magBewerken
        ? '<button class="knop" id="diaErbij" type="button" style="width:100%;margin-top:.4rem;">+ Dia</button>' : '');
      Array.prototype.forEach.call(rail.querySelectorAll('[data-dia]'), function (b) {
        b.addEventListener('click', function () { huidig = +b.dataset.dia; tekenRail(); tekenVlak(); });
      });
      var erbij = rail.querySelector('#diaErbij');
      if (erbij) erbij.addEventListener('click', function () {
        if (dias.length >= 60) return meld('Maximaal 60 dia\'s.');
        dias.splice(huidig + 1, 0, schoon({ indeling: 'punten' }));
        huidig++; onWijzig(); tekenRail(); tekenVlak();
      });
    }
    function labelVan(id) {
      for (var i = 0; i < INDELINGEN.length; i++) if (INDELINGEN[i][0] === id) return INDELINGEN[i][1];
      return 'Punten';
    }

    function tekenVlak() {
      var d = dias[huidig] || schoon({});
      var uitleg = '';
      for (var i = 0; i < INDELINGEN.length; i++) if (INDELINGEN[i][0] === d.indeling) uitleg = INDELINGEN[i][2];
      vlak.innerHTML = '<div class="diakaart">' +
        '<div class="rij">' +
          '<select id="diaIndeling" aria-label="Indeling van deze dia"' + (magBewerken ? '' : ' disabled') + '>' +
            INDELINGEN.map(function (x) {
              return '<option value="' + x[0] + '"' + (x[0] === d.indeling ? ' selected' : '') + '>' + x[1] + '</option>';
            }).join('') + '</select>' +
          '<span style="color:var(--zacht);font-size:.75rem;">' + esc(uitleg) + '</span>' +
          '<span style="flex:1"></span>' +
          (magBewerken ? '<button class="mini" id="diaOp" type="button" title="Naar voren">↑</button>' +
            '<button class="mini" id="diaNeer" type="button" title="Naar achteren">↓</button>' +
            (dias.length > 1 ? '<button class="mini weg" id="diaWeg" type="button">Verwijder</button>' : '') : '') +
        '</div>' +
        '<input class="dt" id="diaTitel" maxlength="120" placeholder="Titel van de dia" value="' + esc(d.titel) + '"' + (magBewerken ? '' : ' disabled') + '>' +
        '<textarea id="diaTekst" rows="7" maxlength="4000" placeholder="De tekst; een regel per punt."' + (magBewerken ? '' : ' disabled') + '>' + esc(d.tekst) + '</textarea>' +
        '<div class="lab">Sprekersnotitie · alleen u ziet dit</div>' +
        '<textarea id="diaNotitie" rows="3" maxlength="2000" placeholder="Wat u erbij wilt zeggen."' + (magBewerken ? '' : ' disabled') + '>' + esc(d.notitie) + '</textarea>' +
        '</div>';
      var q = function (s) { return vlak.querySelector(s); };
      if (magBewerken) {
        q('#diaIndeling').addEventListener('change', function () { dias[huidig].indeling = this.value; onWijzig(); tekenRail(); tekenVlak(); });
        q('#diaTitel').addEventListener('input', function () { dias[huidig].titel = this.value; onWijzig(); tekenRail(); });
        q('#diaTekst').addEventListener('input', function () { dias[huidig].tekst = this.value; onWijzig(); tekenRail(); });
        q('#diaNotitie').addEventListener('input', function () { dias[huidig].notitie = this.value; onWijzig(); });
        q('#diaOp').addEventListener('click', function () { verplaats(-1); });
        q('#diaNeer').addEventListener('click', function () { verplaats(1); });
        var w = q('#diaWeg');
        if (w) w.addEventListener('click', function () {
          dias.splice(huidig, 1); huidig = Math.max(0, huidig - 1); onWijzig(); tekenRail(); tekenVlak();
        });
      }
    }
    function verplaats(n) {
      var doel = huidig + n;
      if (doel < 0 || doel >= dias.length) return;
      var d = dias.splice(huidig, 1)[0];
      dias.splice(doel, 0, d);
      huidig = doel; onWijzig(); tekenRail(); tekenVlak();
    }

    return {
      laad: function (inhoud, mag) {
        magBewerken = !!mag;
        var bron = (inhoud && inhoud.dias) || [];
        dias = (bron.length ? bron : [{ indeling: 'titel', titel: 'Titelblad', tekst: '' }]).map(schoon);
        huidig = 0; tekenRail(); tekenVlak();
      },
      inhoud: function () { return { dias: dias }; },
      dias: function () { return dias; },
      erbij: function (d) { dias.push(schoon(d)); huidig = dias.length - 1; tekenRail(); tekenVlak(); },
      naarTekst: function () {
        return dias.map(function (d, i) {
          return 'Dia ' + (i + 1) + ' (' + labelVan(d.indeling) + '): ' + d.titel + '\n' + d.tekst +
            (d.notitie ? '\n[notitie] ' + d.notitie : '');
        }).join('\n\n');
      }
    };
  }

  /* De presenteermodus: dezelfde dia's, schermvullend, met de indeling die de
     dia zelf draagt en de notitie die alleen de spreker aanzet. */
  function presenteer(opties) {
    var doos = opties.doos, titelEl = opties.titel, tekstEl = opties.tekst, notitieEl = opties.notitie,
        tellerEl = opties.teller, dias = opties.dias;
    var nr = 0, notitieAan = false;
    function toon() {
      var d = dias[nr] || { titel: '', tekst: '', indeling: 'punten', notitie: '' };
      doos.className = 'aan i-' + (d.indeling || 'punten');
      titelEl.textContent = d.titel || '(zonder titel)';
      tekstEl.textContent = d.tekst || '';
      notitieEl.textContent = notitieAan ? (d.notitie || 'Geen notitie bij deze dia.') : '';
      tellerEl.textContent = (nr + 1) + ' van ' + dias.length;
    }
    toon();
    return {
      stap: function (n) { nr = Math.min(dias.length - 1, Math.max(0, nr + n)); toon(); },
      notitie: function () { notitieAan = !notitieAan; toon(); }
    };
  }

  window.RTGOfficePres = { maak: maak, presenteer: presenteer, INDELINGEN: INDELINGEN };
})();

/* RTG School (leden), deel 1: het leerpaspoort op de officiële ladder, de
   leerlijn per groep of fase, de les in gewone taal en de oefensessie van
   vijf opgaven. Antwoorden blijven op de server; hier staat alleen de stroom.
   Bewust geen scores buiten de sessie, geen reeksen, geen ranglijsten. */
(function () {
  'use strict';
  var LADDER = null, MIJN = null;

  function kpi() {
    var el = document.getElementById('schoolKpi');
    if (!el || !MIJN) return;
    var doelen = Object.keys(MIJN.doelen || {}).length;
    el.innerHTML =
      '<div class="kpi"><b>' + (MIJN.fase ? esc(MIJN.fase.naam) : 'nog geen') + '</b><span>Mijn fase</span></div>' +
      '<div class="kpi"><b>' + (MIJN.fase ? 'jaar ' + MIJN.jaar : '-') + '</b><span>Leerjaar</span></div>' +
      '<div class="kpi"><b>' + doelen + '</b><span>Leerdoelen behaald</span></div>' +
      '<div class="kpi"><b>' + (MIJN.historie || []).length + '</b><span>Stappen op de ladder</span></div>';
  }

  /* De namen horen bij de ladder, niet bij de schermen: een fase-id is een
     verwijzing voor machines, geen tekst voor mensen. */
  function faseNaam(id) {
    var f = (LADDER.fasen || []).find(function (x) { return x.id === id; });
    return f ? f.naam : id;
  }
  function trapNaam(t) { return (LADDER.trappen && LADDER.trappen[t] && LADDER.trappen[t].naam) || t; }

  function toonPaspoort() {
    var el = document.getElementById('paspoort');
    if (!MIJN.fase) {
      el.innerHTML = 'Je staat nog niet op de ladder. Kies hieronder je fase; elke fase mag het begin zijn, en een stap terug is soms de beste stap.';
    } else {
      var verder = MIJN.verder || {};
      el.innerHTML = 'Je bent ingeschreven op <b>' + esc(MIJN.fase.naam) + '</b> (' + esc(trapNaam(MIJN.fase.trap)) + '), leerjaar ' + MIJN.jaar +
        (verder.volgende ? '. De normale trede hierna: ' + esc(faseNaam(verder.volgende)) + '.' : '.') +
        ((verder.doorstroom || []).length ? ' Vanuit hier kun je door naar: ' + verder.doorstroom.map(function (id) { return esc(faseNaam(id)); }).join(', ') + '.' : '');
    }
    document.getElementById('jaarKnop').hidden = !(MIJN.fase && MIJN.fase.jaren > MIJN.jaar);
    document.getElementById('eerlijk').textContent = MIJN.eerlijk || '';
    kpi();
  }

  /* Een fasekiezer is altijd per trap geordend: eerst de schoolsoort
     (Basisschool, Voortgezet onderwijs, Mbo, ...), daarbinnen de fasen.
     Hier stond een platte lijst van alle zesentwintig fasen -- Groep 1 naast
     Vwo naast Promotie -- en dat leest als een hoop, niet als een ladder.
     De trap-indeling bestond al in de data (fase.trap + LADDER.trappen);
     alleen het scherm gooide hem weg. */
  function faseOpties(eersteRegel, filter) {
    var perTrap = {};
    (LADDER.fasen || []).filter(filter || function () { return true; }).forEach(function (f) {
      (perTrap[f.trap] = perTrap[f.trap] || []).push(f);
    });
    return '<option value="">' + esc(eersteRegel) + '</option>' + Object.keys(perTrap)
      .sort(function (a, b) {
        return ((LADDER.trappen[a] || {}).volgorde || 99) - ((LADDER.trappen[b] || {}).volgorde || 99);
      })
      .map(function (t) {
        return '<optgroup label="' + esc(trapNaam(t)) + '">' +
          perTrap[t].map(function (f) {
            return '<option value="' + esc(f.id) + '">' + esc(f.naam) +
              (f.leeftijd ? ' · ' + esc(f.leeftijd) + ' jaar' : (f.jaren ? ' · ' + f.jaren + ' jaar' : '')) + '</option>';
          }).join('') + '</optgroup>';
      }).join('');
  }

  function vulKiezers() {
    document.getElementById('ladderKies').innerHTML = faseOpties('Kies je fase...');
    // een kiezer voor de leerlijn: de basisschoolfasen sturen de groep-leerlijn
    // aan, de rest de fase-leerlijn -- dat onderscheid is techniek en hoort
    // niet als twee losse lijsten op het scherm
    document.getElementById('leerKies').innerHTML = faseOpties('Kies je fase...');
    document.getElementById('examenKies').innerHTML =
      faseOpties('Kies je fase...', function (f) { return f.trap !== 'po' && f.trap !== 'leven'; });
  }


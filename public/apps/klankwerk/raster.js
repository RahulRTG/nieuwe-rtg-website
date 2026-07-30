/* RTG Studio: het raster.

   Het raster is de kern van een sequencer: kanalen onder elkaar, stappen naast
   elkaar, en één blik waarin je ziet wat er gebeurt. Slagwerk zet je aan en uit
   per stap; wat een toonhoogte heeft krijgt een notenrol (rol.js).

   DE ZWAARSTE ONTWERPKEUZE HIER IS WAT ER NIET IS. Een muziekprogramma kan
   eindeloos knoppen krijgen -- automatisering, effecten per kanaal, tempo dat
   meebeweegt. Elk daarvan kost een halve dag en maakt het scherm voor een
   beginner een stukje ontoegankelijker. Wat erin zit is wat je nodig hebt om
   een stuk AF te krijgen: aanzetten, toonhoogte, lengte, volume, links-rechts,
   en stil. De rest wacht tot iemand er echt om vraagt.

   Elke stap draagt zijn nummer als label voor een schermlezer, en de eerste
   tel van elke maat is zwaarder getekend -- anders tel je met je ogen. */
(function () {
  'use strict';
  if (window.RTGStudioRaster) return;

  function maak(opties) {
    var o = opties || {};
    var rackEl = o.rack, rolEl = o.rol;
    var track = null, instrumenten = {}, gekozen = null, opWijziging = o.opWijziging || function () {};
    var speelStap = -1;

    var stappenVan = function () { return track.stappen || (16 * track.maten); };
    var soortVan = function (inst) { return (instrumenten[inst] || {}).soort || 'slag'; };
    var speeltNoten = function (inst) { var so = soortVan(inst); return so === 'toon' || so === 'stem'; };

    // De smalle brug naar de notenrol: wat hij mag weten, en niets daarbuiten.
    var rol = window.RTGStudioRol.maak(rolEl, {
      kanaal: function () { return (track.kanalen || [])[gekozen]; },
      instrument: function (naam) { return instrumenten[naam]; },
      stappen: stappenVan,
      speeltNoten: speeltNoten,
      soortVan: soortVan,
      lengte: function () { return Number(o.lengte && o.lengte()) || 2; },
      opWijziging: function () { opWijziging(); },
      teken: function () { teken(); }
    });

    /* ---- het rek: één regel per kanaal ---- */
    function tekenRack() {
      rackEl.textContent = '';
      var stappen = stappenVan();
      (track.kanalen || []).forEach(function (k, i) {
        var rij = document.createElement('div');
        rij.className = 'kanaal' + (gekozen === i ? ' gekozen' : '');

        var kop = document.createElement('div'); kop.className = 'kkop';
        var naam = document.createElement('button');
        naam.type = 'button'; naam.className = 'knaam';
        naam.textContent = (instrumenten[k.instrument] || {}).naam || k.instrument;
        naam.setAttribute('aria-pressed', gekozen === i ? 'true' : 'false');
        naam.addEventListener('click', function () { gekozen = i; teken(); });
        kop.appendChild(naam);

        var stil = document.createElement('button');
        stil.type = 'button'; stil.className = 'kstil' + (k.stil ? ' aan' : '');
        stil.textContent = k.stil ? 'stil' : 'aan';
        stil.setAttribute('aria-label', (k.stil ? 'Zet aan: ' : 'Zet stil: ') + naam.textContent);
        stil.addEventListener('click', function () { k.stil = !k.stil; opWijziging(); teken(); });
        kop.appendChild(stil);

        var vol = document.createElement('input');
        vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05';
        vol.value = k.volume != null ? k.volume : 0.8;
        vol.className = 'kvol';
        vol.setAttribute('aria-label', 'Volume van ' + naam.textContent);
        vol.addEventListener('input', function () { k.volume = Number(vol.value); opWijziging(); });
        kop.appendChild(vol);
        rij.appendChild(kop);

        var baan = document.createElement('div'); baan.className = 'baan';
        baan.style.gridTemplateColumns = 'repeat(' + stappen + ', 1fr)';
        if (!speeltNoten(k.instrument)) {
          for (var s = 0; s < stappen; s++) tekenStap(baan, k, s);
        } else {
          // een melodisch kanaal toont zijn noten als blokjes; bewerken gaat in de rol
          var perStap = {};
          (k.noten || []).forEach(function (n) { perStap[n.stap] = true; });
          for (var t = 0; t < stappen; t++) {
            var c = document.createElement('div');
            c.className = 'cel toon' + (perStap[t] ? ' aan' : '') + (t % 16 === 0 ? ' maat' : '') + (t % 4 === 0 ? ' tel' : '');
            c.dataset.stap = t;
            baan.appendChild(c);
          }
        }
        rij.appendChild(baan);
        rackEl.appendChild(rij);
      });
      merkSpeelStap();
    }
    function tekenStap(baan, k, s) {
      var aan = (k.stappen || []).indexOf(s) >= 0;
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cel' + (aan ? ' aan' : '') + (s % 16 === 0 ? ' maat' : '') + (s % 4 === 0 ? ' tel' : '');
      b.dataset.stap = s;
      b.setAttribute('aria-pressed', aan ? 'true' : 'false');
      b.setAttribute('aria-label', 'Stap ' + (s + 1));
      b.addEventListener('click', function () {
        var rij = k.stappen = k.stappen || [];
        var i = rij.indexOf(s);
        if (i >= 0) rij.splice(i, 1); else rij.push(s);
        rij.sort(function (a, b2) { return a - b2; });
        opWijziging(); tekenRack();
      });
      baan.appendChild(b);
    }

    /* De loper: welke stap er nu klinkt. Dit raakt alleen een class, geen
       herbouw -- anders zou het scherm 16 keer per maat opnieuw getekend
       worden en dat merkt een telefoon meteen. */
    function merkSpeelStap() {
      var oud = document.querySelectorAll('.cel.nu');
      for (var i = 0; i < oud.length; i++) oud[i].classList.remove('nu');
      if (speelStap < 0) return;
      var nu = document.querySelectorAll('.cel[data-stap="' + speelStap + '"]');
      for (var j = 0; j < nu.length; j++) nu[j].classList.add('nu');
    }

    function teken() { tekenRack(); rol.teken(); }

    return {
      zet: function (t, inst) { track = t; instrumenten = inst || instrumenten;
        if (gekozen == null || gekozen >= (t.kanalen || []).length) {
          gekozen = (t.kanalen || []).findIndex(function (k) { return speeltNoten(k.instrument); });
          if (gekozen < 0) gekozen = (t.kanalen || []).length ? 0 : null;
        }
        teken(); },
      teken: teken,
      kies: function (i) { gekozen = i; teken(); },
      gekozen: function () { return gekozen; },
      loper: function (s) { speelStap = s; merkSpeelStap(); }
    };
  }

  window.RTGStudioRaster = { maak: maak, nootNaam: window.RTGStudioRol.nootNaam };
})();

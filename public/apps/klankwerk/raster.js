/* RTG Studio: het raster.

   Het raster is de kern van een sequencer: kanalen onder elkaar, stappen naast
   elkaar, en één blik waarin je ziet wat er gebeurt. Slagwerk zet je aan en uit
   per stap; wat een toonhoogte heeft krijgt een notenrol (rol.js).

   Onder het raster zit per kanaal een compacte studiostrip: volume, pan,
   driebands EQ, ruimte, delay, mute en solo. Dezelfde waarden gaan naar de
   live motor en de WAV-master; dit zijn dus geen decoratieve regelaars.

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

    function regelaar(k, veld, label, min, max, stap, terug) {
      var vak = document.createElement('label'); vak.className = 'kmix-regelaar';
      var tekst = document.createElement('span'); tekst.textContent = label; vak.appendChild(tekst);
      var invoer = document.createElement('input'); invoer.type = 'range';
      invoer.min = String(min); invoer.max = String(max); invoer.step = String(stap);
      invoer.value = k[veld] != null ? k[veld] : terug;
      invoer.setAttribute('aria-label', label + ' van ' + (k.naam || k.instrument));
      invoer.addEventListener('input', function () { k[veld] = Number(invoer.value); opWijziging(); });
      vak.appendChild(invoer); return vak;
    }

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
        naam.textContent = k.naam || (instrumenten[k.instrument] || {}).naam || k.instrument;
        naam.setAttribute('aria-pressed', gekozen === i ? 'true' : 'false');
        naam.addEventListener('click', function () { gekozen = i; teken(); });
        kop.appendChild(naam);

        var stil = document.createElement('button');
        stil.type = 'button'; stil.className = 'kstil' + (k.stil ? ' aan' : '');
        stil.textContent = k.stil ? 'stil' : 'aan';
        stil.setAttribute('aria-label', (k.stil ? 'Zet aan: ' : 'Zet stil: ') + naam.textContent);
        stil.addEventListener('click', function () { k.stil = !k.stil; opWijziging(); teken(); });
        kop.appendChild(stil);

        var solo = document.createElement('button');
        solo.type = 'button'; solo.className = 'ksolo' + (k.solo ? ' aan' : '');
        solo.textContent = 'solo';
        solo.setAttribute('aria-pressed', k.solo ? 'true' : 'false');
        solo.setAttribute('aria-label', 'Solo: ' + naam.textContent);
        solo.addEventListener('click', function () { k.solo = !k.solo; opWijziging(); teken(); });
        kop.appendChild(solo);

        var mix = document.createElement('div'); mix.className = 'kmix';
        mix.appendChild(regelaar(k, 'volume', 'Vol', 0, 1, .02, .8));
        mix.appendChild(regelaar(k, 'pan', 'Pan', -1, 1, .05, 0));
        mix.appendChild(regelaar(k, 'eqLaag', 'Low', -12, 12, 1, 0));
        mix.appendChild(regelaar(k, 'eqMidden', 'Mid', -12, 12, 1, 0));
        mix.appendChild(regelaar(k, 'eqHoog', 'High', -12, 12, 1, 0));
        mix.appendChild(regelaar(k, 'reverb', 'Space', 0, 1, .05, 0));
        mix.appendChild(regelaar(k, 'delay', 'Delay', 0, 1, .05, 0));
        kop.appendChild(mix);
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

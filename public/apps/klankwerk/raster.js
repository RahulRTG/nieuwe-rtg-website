/* RTG Studio: het raster en de notenrol.

   Het raster is de kern van een sequencer: kanalen naast elkaar, stappen onder
   elkaar, en één blik waarin je ziet wat er gebeurt. Slagwerk zet je aan en uit
   per stap; wat een toonhoogte heeft krijgt een notenrol.

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

  var TOON_NAMEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  function nootNaam(n) { return TOON_NAMEN[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1); }
  function isKruis(n) { return TOON_NAMEN[((n % 12) + 12) % 12].length > 1; }

  function maak(opties) {
    var o = opties || {};
    var rackEl = o.rack, rolEl = o.rol;
    var track = null, instrumenten = {}, gekozen = null, opWijziging = o.opWijziging || function () {};
    var speelStap = -1;

    var stappenVan = function () { return track.stappen || (16 * track.maten); };
    var soortVan = function (inst) { return (instrumenten[inst] || {}).soort || 'slag'; };

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
        if (soortVan(k.instrument) === 'slag') {
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

    /* ---- de notenrol: alleen voor het gekozen melodische kanaal ---- */
    function tekenRol() {
      rolEl.textContent = '';
      var k = (track.kanalen || [])[gekozen];
      if (!k || soortVan(k.instrument) === 'slag') {
        var p = document.createElement('p'); p.className = 'stil';
        p.textContent = k ? 'Slagwerk zet u aan en uit in het raster hierboven.'
          : 'Kies een kanaal om de noten te zien.';
        rolEl.appendChild(p);
        return;
      }
      var basis = (instrumenten[k.instrument] || {}).basToon || 60;
      var laag = basis - 12, hoog = basis + 12;          // twee octaven rond het instrument
      var stappen = stappenVan();
      var tabel = document.createElement('div'); tabel.className = 'rol';
      for (var toon = hoog; toon >= laag; toon--) {
        var rij = document.createElement('div'); rij.className = 'rrij';
        var label = document.createElement('span');
        label.className = 'rlabel' + (isKruis(toon) ? ' kruis' : '');
        label.textContent = nootNaam(toon);
        rij.appendChild(label);
        var baan = document.createElement('div'); baan.className = 'rbaan';
        baan.style.gridTemplateColumns = 'repeat(' + stappen + ', 1fr)';
        for (var s = 0; s < stappen; s++) baan.appendChild(rolCel(k, toon, s));
        rij.appendChild(baan);
        tabel.appendChild(rij);
      }
      rolEl.appendChild(tabel);
    }
    function rolCel(k, toon, s) {
      var noot = (k.noten || []).find(function (n) { return n.toon === toon && n.stap === s; });
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'cel' + (noot ? ' aan' : '') + (isKruis(toon) ? ' zwart' : '') +
        (s % 16 === 0 ? ' maat' : '') + (s % 4 === 0 ? ' tel' : '');
      b.dataset.stap = s;
      b.setAttribute('aria-pressed', noot ? 'true' : 'false');
      b.setAttribute('aria-label', nootNaam(toon) + ', stap ' + (s + 1));
      b.addEventListener('click', function () {
        k.noten = k.noten || [];
        var i = k.noten.findIndex(function (n) { return n.toon === toon && n.stap === s; });
        if (i >= 0) k.noten.splice(i, 1);
        else k.noten.push({ stap: s, toon: toon, lengte: Number(o.lengte && o.lengte()) || 2 });
        k.noten.sort(function (a, b2) { return a.stap - b2.stap || a.toon - b2.toon; });
        opWijziging(); teken();
      });
      return b;
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

    function teken() { tekenRack(); tekenRol(); }

    return {
      zet: function (t, inst) { track = t; instrumenten = inst || instrumenten;
        if (gekozen == null || gekozen >= (t.kanalen || []).length) {
          gekozen = (t.kanalen || []).findIndex(function (k) { return soortVan(k.instrument) !== 'slag'; });
          if (gekozen < 0) gekozen = (t.kanalen || []).length ? 0 : null;
        }
        teken(); },
      teken: teken,
      kies: function (i) { gekozen = i; teken(); },
      gekozen: function () { return gekozen; },
      loper: function (s) { speelStap = s; merkSpeelStap(); }
    };
  }

  window.RTGStudioRaster = { maak: maak, nootNaam: nootNaam };
})();

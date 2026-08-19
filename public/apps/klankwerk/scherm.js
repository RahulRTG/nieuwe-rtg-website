/* RTG Klankwerk: het scherm. Bindt de lijst, het raster, de motor, Rahul en de
   export aan elkaar. De muzikale kennis zit niet hier maar op de server
   (kern/muziek-*.js) en in de motor; dit bestand regelt alleen wie wat mag zien
   en wanneer er bewaard wordt. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }

  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  };
  function api(pad, body) {
    return fetch('/api/muziek/' + pad, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return {}; }); });
  }
  var meldTimer = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldTimer); meldTimer = setTimeout(function () { m.classList.remove('zie'); }, 2600);
  }
  function fout(t) { var f = $('#fout'); f.textContent = t; f.hidden = !t; }
  function download(naam, blob) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = naam; a.click();
    URL.revokeObjectURL(a.href);
  }

  /* De grenzen komen van de server mee (kern/muziek-instrumenten.js). Ze hier
     nog eens opschrijven zou betekenen dat er twee waarheden zijn over hoe lang
     een stuk mag worden -- en die lopen vroeg of laat uit elkaar. */
  var track = null, instrumenten = {}, raster = null, vuil = false, grens = { maten: 8 };

  // de stukken van dit lid, zoals de lijst ze binnenkrijgt
  var STUKKEN = [];
  /* Meenemen: het register van uw stukken. Het geluid gaat als WAV mee (zie
     wav.js); dit is de lijst zelf, met echte velden. */
  if (window.RTGUitvoer) RTGUitvoer.bron(function () {
    if (!STUKKEN.length) return null;
    return { naam: 'mijn-stukken', kolommen: ['naam', 'tempo', 'maten', 'kanalen', 'klaar'],
      rijen: STUKKEN.map(function (t) {
        return [t.naam, t.bpm, t.maten, t.kanalen, t.klaar ? 'ja' : 'nee'];
      }) };
  });

  if (!TOKEN) {
    $('#lijstVlak').innerHTML = '<div class="kaart"><h2>Log eerst in</h2>' +
      '<p class="stil" style="margin-top:.5rem;">Open de RTG-app en log in; daarna staan uw stukken hier.</p></div>';
    return;
  }

  /* ---- de lijst met stukken ---- */
  function toonLijst() {
    stop();
    $('#werkVlak').hidden = true;
    api('mijn').then(function (d) {
      instrumenten = d.instrumenten || instrumenten;
      if (d.maxMaten) { grens.maten = d.maxMaten; $('#tMaten').max = String(d.maxMaten); }
      vulInstrumenten();
      var v = $('#lijstVlak'); v.hidden = false;
      STUKKEN = d.tracks || [];
      var rijen = STUKKEN.map(function (t) {
        return '<button class="stuk" data-id="' + esc(t.id) + '">' +
          '<span><span class="nm">' + esc(t.naam) + (t.klaar ? '<span class="merk">klaar</span>' : '') + '</span>' +
          '<span class="mt">' + t.bpm + ' slagen · ' + t.maten + ' ' + (t.maten === 1 ? 'maat' : 'maten') +
          ' · ' + t.kanalen + ' ' + (t.kanalen === 1 ? 'kanaal' : 'kanalen') + '</span></span>' +
          '<span class="rechts">openen</span></button>';
      }).join('');
      v.innerHTML = '<div class="kop">Mijn stukken</div>' +
        (rijen || '<p class="stil">Nog niets gemaakt. Begin met een nieuw stuk; er staat meteen een maat in ' +
          'die klinkt, zodat u hoort wat u doet.</p>') +
        /* De twee beginwegen staan in de vaste strook onderaan en niet midden
           op de pagina: gemeten stond "Nieuw stuk" op y 305 van 844, boven de
           duimlijn (GRAMMATICA.md). Ze verhuizen samen -- "Leeg beginnen" is
           dezelfde handeling zonder de voorgezette maat, en die twee uit
           elkaar trekken maakt de keuze onleesbaar. */
        '<div class="rij rtg-duimbalk" style="margin-top:.8rem;">' +
        '<button class="knop vol" id="nieuw" type="button" data-hoofdactie>Nieuw stuk</button>' +
        '<button class="knop" id="nieuwLeeg" type="button">Leeg beginnen</button></div>';
      Array.prototype.forEach.call(v.querySelectorAll('[data-id]'), function (b) {
        b.addEventListener('click', function () { openStuk(b.dataset.id); });
      });
      $('#nieuw').addEventListener('click', function () { maakStuk(false); });
      $('#nieuwLeeg').addEventListener('click', function () { maakStuk(true); });
    });
  }
  function vulInstrumenten() {
    var sel = $('#nieuwInstrument');
    if (!sel || sel.options.length) return;
    Object.keys(instrumenten).forEach(function (naam) {
      var o = document.createElement('option');
      o.value = naam; o.textContent = instrumenten[naam].naam;
      sel.appendChild(o);
    });
  }
  function maakStuk(leeg) {
    api('maak', { leeg: !!leeg, naam: leeg ? 'Leeg stuk' : 'Nieuw stuk' }).then(function (d) {
      if (d.error) return zeg(d.error);
      zet(d.track);
    });
  }
  function openStuk(id) {
    api('open', { id: id }).then(function (d) {
      if (d.error) return zeg(d.error);
      zet(d.track);
    });
  }

  /* ---- het werkvlak ---- */
  // Wie er nog meer wakker moet worden als er een stuk opengaat: de vorm, de
  // makers, de uitgave. Ze melden zich zelf aan; dit bestand hoeft ze niet te
  // kennen.
  var luisteraars = [];
  function zet(t) {
    track = t; vuil = false;
    $('#lijstVlak').hidden = true;
    $('#werkVlak').hidden = false;
    $('#rUit').textContent = '';
    fout('');
    $('#tNaam').value = t.naam;
    $('#tBpm').value = t.bpm;
    $('#tMaten').value = t.maten;
    $('#tKlaar').checked = !!t.klaar;
    if (!raster) {
      raster = window.RTGStudioRaster.maak({
        rack: $('#rack'), rol: $('#rol'),
        lengte: function () { return $('#tLengte').value; },
        opWijziging: function () { vuil = true; }
      });
    }
    raster.zet(track, instrumenten);
    meld();
  }
  function meld() { luisteraars.forEach(function (f) { try { f(track); } catch (e) {} }); }

  function leesVelden() {
    track.naam = $('#tNaam').value.trim() || 'Naamloos';
    track.bpm = Math.max(40, Math.min(200, Number($('#tBpm').value) || track.bpm));
    var maten = Math.max(1, Math.min(grens.maten, Number($('#tMaten').value) || track.maten));
    if (maten !== track.maten) { track.maten = maten; track.stappen = 16 * maten; }
    track.klaar = $('#tKlaar').checked;
  }
  ['#tNaam', '#tBpm', '#tMaten', '#tKlaar'].forEach(function (s) {
    document.addEventListener('change', function (e) {
      if (!track || !e.target.matches || !e.target.matches(s)) return;
      leesVelden(); vuil = true; raster.zet(track, instrumenten);
    });
  });

  function bewaarNu(stil) {
    if (!track) return Promise.resolve();
    leesVelden();
    return api('bewaar', { id: track.id, naam: track.naam, bpm: track.bpm, maten: track.maten,
      kanalen: track.kanalen, secties: track.secties || [], klaar: track.klaar }).then(function (d) {
      if (d.error) { fout(d.error); return; }
      track = d.track; vuil = false;
      raster.zet(track, instrumenten);
      // ook na het bewaren, want de server stuurt een NIEUW track-object terug:
      // wie het oude vasthoudt (de vorm, de uitgave) kijkt anders naar iets dat
      // niet meer bestaat. En "klaar" aanvinken opent pas hier de uitgave.
      meld();
      if (!stil) zeg('Bewaard.');
    });
  }

  /* ---- afspelen ---- */
  function speelNu() {
    if (!track) return;
    leesVelden();
    window.RTGStudioMotor.speel(track, { lus: true, opStap: function (s) { raster.loper(s); } });
    zeg('Speelt in een lus. Wat u aanpast hoort u bij de volgende ronde.');
  }
  function stop() {
    if (window.RTGStudioMotor) window.RTGStudioMotor.stop();
    if (raster) raster.loper(-1);
  }

  $('#speel').addEventListener('click', speelNu);
  $('#stopKnop').addEventListener('click', stop);
  $('#bewaar').addEventListener('click', function () { bewaarNu(false); });

  $('#terugLijst').addEventListener('click', function () {
    if (vuil && !confirm('Er zijn wijzigingen die nog niet bewaard zijn. Toch terug?')) return;
    track = null; $('#lijstVlak').hidden = false; toonLijst();
  });

  window.addEventListener('beforeunload', function (e) {
    if (!vuil) return;
    e.preventDefault(); e.returnValue = '';
  });

  /* De brug naar apps/klankwerk/acties.js. Bewust smal: dat bestand mag lezen
     wat er open staat en zeggen dat er iets veranderd is, en verder niets. */
  window.RTGKlankwerk = {
    api: api, zeg: zeg, fout: fout, download: download, stop: stop,
    track: function () { return track; },
    instrumenten: function () { return instrumenten; },
    raster: function () { return raster; },
    leesVelden: function () { if (track) leesVelden(); },
    gewijzigd: function () { vuil = true; },
    bewaar: function () { return bewaarNu(true); },
    bijOpenen: function (f) { luisteraars.push(f); if (track) f(track); },
    velden: function () { $('#tBpm').value = track.bpm; $('#tMaten').value = track.maten; },
    naarLijst: function () { track = null; toonLijst(); }
  };

  toonLijst();
})();

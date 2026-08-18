/* RTG Media -- de speler: drie manieren waarop een stuk tot leven komt.

   MUZIEK rekent uw eigen toestel uit met de motor van het Klankwerk: er reist
   geen audiobestand, alleen de getallen waarmee de maker het zelf hoorde.
   VIDEO komt met bereik-verzoeken uit het Theater, in het origineel.
   EEN KORTE VIDEO komt rechtstreeks van het toestel van de maker, via de
   gedeelde clipdeler (/shared/clipdeler.js) -- dezelfde laag die /apps/clips.html
   gebruikt, want die bytes staan niet bij RTG en er hoort geen tweede exemplaar
   van dat protocol te bestaan (LAT.md regel 4).

   Wat elders hoort te spelen (een livestream gaat over een relay-boom van
   kijker naar kijker) zegt dat, en brengt u naar de app waar dat doorgeefluik
   staat. Een knop die doet alsof is erger dan een knop die verwijst. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) { TOKEN = null; }
  var meldT = null;
  function zeg(t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zien');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zien'); }, 3000);
  }
  /* De clipdeler: DEZELFDE laag die /apps/clips.html gebruikt. Daardoor speelt
     een korte video hier ter plekke, en dient dit scherm de eigen clips ook uit
     zolang het openstaat. */
  var deler = window.RTGClipDeler ? window.RTGClipDeler.start({ token: TOKEN, opStatus: zeg }) : null;

  function stopAlles() {
    if (window.RTGStudioMotor) window.RTGStudioMotor.stop();
    var f = $('#film');
    f.pause(); f.removeAttribute('src'); f.load(); f.classList.remove('zien');
    if (window.RTGOndertitelband) RTGOndertitelband.weg(document.getElementById('filmvlak'));
    var cv = $('#clipvlak'), cf = $('#clipfilm');
    cf.pause(); cf.removeAttribute('src'); cf.load();
    var ond = cv.querySelector('.ondert'); if (ond) ond.remove();
    cv.hidden = true;
  }
  function speel(s) {
    stopAlles();
    if (s.spelen.soort === 'motor') {
      fetch('/api/muziek/uitgave', { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + TOKEN },
        body: JSON.stringify({ id: s.spelen.bron }) })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (!d || d.error || !d.uitgave) return zeg((d && d.error) || 'Dat stuk kon niet geladen worden.');
          var u = d.uitgave;
          window.RTGStudioMotor.speel({ bpm: u.bpm, maten: u.maten, stappen: u.stappen, kanalen: u.kanalen }, { lus: false });
          $('#spTitel').textContent = s.titel;
          $('#spSub').textContent = s.maker.codenaam + ' · uw toestel rekent dit zelf uit; er reist geen bestand';
        });
      return;
    }
    if (s.spelen.soort === 'stream') {
      var f = $('#film');
      f.src = s.spelen.bron + '?token=' + encodeURIComponent(TOKEN);
      f.classList.add('zien');
      /* Dezelfde band als in het Theater en bij een clip: shared/ondertitelband.js.
         Het gaat hier om hetzelfde bestand als in het Theater, dus een kijker die
         daar ondertitels ziet hoort ze hier ook te zien. */
      if (window.RTGOndertitelband) RTGOndertitelband.zet(document.getElementById('filmvlak'), f, s.ondertitels || []);
      f.play().catch(function () {});
      $('#spTitel').textContent = s.titel;
      $('#spSub').textContent = s.maker.codenaam + ' · origineel beeld uit het Theater';
      return;
    }
    /* Een korte video speelt hier ter plekke via de gedeelde clipdeler: het
       beeld komt rechtstreeks van het toestel van de maker. Lukt dat niet (de
       maker is offline, of deze browser kan geen OPFS), dan zegt de deler dat
       zelf -- we sturen niemand naar een knop die dan alsnog niets doet. */
    if (s.spelen.soort === 'p2p' && deler) {
      var vlak = $('#clipvlak');
      vlak.hidden = false;
      $('#spTitel').textContent = s.titel;
      $('#spSub').textContent = s.maker.codenaam + ' · rechtstreeks van het toestel van de maker; RTG heeft dit beeld niet';
      deler.speel(vlak, { id: s.id.slice(s.id.indexOf(':') + 1), titel: s.titel, codenaam: s.maker.codenaam,
        mijn: s.mijn, online: s.online, geluid: s.geluid, knip: s.knip, ondertitels: s.ondertitels });
      return;
    }
    zeg(s.spelen.reden || 'Dit speelt in zijn eigen app.');
    window.location.href = s.spelen.bron;
  }


  $('#spStop').addEventListener('click', function () {
    stopAlles();
    $('#spTitel').textContent = 'Nog stil';
    $('#spSub').textContent = 'Kies iets uit uw wereld.';
  });

  window.RTGMediaSpeler = { speel: speel, stop: stopAlles, deler: deler };
})();

/* RTG Agenda, de bediening: welk venster u ziet (maand, week of lijst),
   het laden van afspraken plus de RTG-laag, Rahul die in gewone taal
   plant, en de ICS-export waarmee deze agenda met elke agenda ter wereld
   praat. Het tekenen woont in kalender.js, het paneel in paneel.js. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var K = window.RTGAgendaKal;
  var token = null;
  try { token = localStorage.getItem('rtg_member_token'); } catch (e) {}

  var api = function (pad, body) {
    return fetch('/api/agenda/' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (b) { return { status: r.status, body: b }; });
    });
  };
  var meldT; var meld = function (t) {
    var m = $('#melding'); m.textContent = t; m.classList.add('zie');
    clearTimeout(meldT); meldT = setTimeout(function () { m.classList.remove('zie'); }, 3200);
  };

  var vandaag = K.iso(new Date());
  var stand = { weergave: 'maand', anker: vandaag };
  var paneel = window.RTGAgendaPaneel.maak(api, meld, laad);

  /* het datumvenster hoort bij de weergave: de maand laadt zijn hele
     raster (inclusief de randen van de buurmaanden), de week zijn zeven
     dagen, de lijst dertig dagen vooruit */
  function venster() {
    if (stand.weergave === 'week') {
      var ma = K.maandagVan(stand.anker);
      return { van: ma, tot: K.plusDagen(ma, 6) };
    }
    if (stand.weergave === 'lijst') return { van: vandaag, tot: K.plusDagen(vandaag, 30) };
    var eerste = stand.anker.slice(0, 8) + '01';
    var start = K.maandagVan(eerste);
    return { van: start, tot: K.plusDagen(start, 41) };
  }

  function laad() {
    var v = venster();
    api('bereik', v).then(function (r) {
      if (r.status !== 200) return meld(r.body.error || 'Log eerst in op de leden-app.');
      var alles = (r.body.items || []).concat(r.body.ecosysteem || []);
      alles.sort(function (a, b) {
        return a.datum.localeCompare(b.datum) || String(a.tijd || '').localeCompare(String(b.tijd || ''));
      });
      stand.items = alles;
      var acties = {
        item: function (x) { paneel.toon(x); },
        dag: function (dag) { paneel.toon({ datum: dag }); }
      };
      $('#periode').textContent = K[stand.weergave]($('#kal'), stand.anker, alles, acties, vandaag);
      ['wMaand', 'wWeek', 'wLijst'].forEach(function (id) {
        $('#' + id).classList.toggle('aan', id.slice(1).toLowerCase() === stand.weergave);
      });
    });
  }

  /* Meenemen: de agenda kent zijn eigen model, dus geeft hij dat door in
     plaats van de gedeelde laag naar het scherm te laten raden -- daar staan
     chips met een afgeknipte titel in, hier staan de velden. Wat u meeneemt
     is precies het venster dat u open hebt (maand, week of lijst). */
  if (window.RTGUitvoer) {
    RTGUitvoer.bron(function () {
      if (!stand.items) return null;
      return {
        naam: 'agenda',
        kolommen: ['datum', 'van', 'tot', 'titel', 'plek', 'bron', 'status'],
        rijen: stand.items.map(function (x) {
          return [x.datum || '', x.tijd || '', x.eind || '', x.titel || '', x.plek || '',
            x.bron || 'agenda', x.status || ''];
        })
      };
    });
  }

  function stap(n) {
    if (stand.weergave === 'week') stand.anker = K.plusDagen(stand.anker, n * 7);
    else if (stand.weergave === 'lijst') return; // de lijst kijkt altijd vooruit
    else {
      var d = new Date(stand.anker.slice(0, 8) + '15T12:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + n);
      stand.anker = K.iso(d);
    }
    laad();
  }
  $('#vorige').addEventListener('click', function () { stap(-1); });
  $('#volgendeK').addEventListener('click', function () { stap(1); });
  $('#vandaagBtn').addEventListener('click', function () { stand.anker = vandaag; laad(); });
  [['wMaand', 'maand'], ['wWeek', 'week'], ['wLijst', 'lijst']].forEach(function (p) {
    $('#' + p[0]).addEventListener('click', function () { stand.weergave = p[1]; laad(); });
  });
  $('#nieuwBtn').addEventListener('click', function () { paneel.toon({ datum: stand.anker }); });

  /* Rahul plant in gewone taal; de bestaande AI-route zet het om */
  function rahul() {
    var t = $('#rahulIn').value.trim();
    if (!t) return;
    $('#rahulIn').value = '';
    api('ai', { opdracht: t }).then(function (r) {
      meld(r.body.antwoord || 'Dat lukte niet.');
      if (r.body.gedaan) laad();
    });
  }
  $('#rahulBtn').addEventListener('click', rahul);
  $('#rahulIn').addEventListener('keydown', function (e) { if (e.key === 'Enter') rahul(); });

  /* de export: een echt .ics-bestand; opent in elke agenda ter wereld */
  $('#icsBtn').addEventListener('click', function () {
    api('ics').then(function (r) {
      if (!r.body.ics) return meld('Kon de agenda niet exporteren.');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([r.body.ics], { type: 'text/calendar;charset=utf-8' }));
      a.download = 'rtg-agenda.ics'; a.click(); URL.revokeObjectURL(a.href);
      meld('Geëxporteerd: rtg-agenda.ics');
    });
  });

  if (!token) meld('Log eerst in op de leden-app.'); else laad();
})();

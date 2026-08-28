/* RTG Festival, het scherm: DE DAG (deel van het blad "Inrichten").

   Afgesplitst van ./inrichten.js op de 10 kB-grens, en langs een echte naad:
   daar staat waar het festival IS (dagen, plekken, producten, partners), hier
   staat wat er op zo een dag GEBEURT -- wie er speelt en wie er werkt. Het is
   wel hetzelfde blad: de helpers, de meldregel en de foutafhandeling komen uit
   F.inr en worden hier niet nagemaakt.

   DAT DIENSTEN EN BOEKINGEN BIJ ELKAAR STAAN, is geen toeval van het opknippen.
   Het zijn dezelfde twee vragen over dezelfde dag, ze hangen aan dezelfde
   dagkeuze, en wie een set verzet moet meteen zien wie er dan staat.

   EEN NIEUWE BOEKING IS EEN VOORNEMEN. Bevestigen gebeurt door een voornemen
   aan te tikken, met de bron uit het veld erboven; zonder bron weigert de kern.
   Wie het vastlegt vult dit scherm niet in -- die naam komt uit de sessie
   (routes/festival/artiest.js), dus daar is geen veld voor en dat is geen
   vergetelheid. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F || !F.inr) return;

  var $ = function (s) { return document.querySelector(s); };
  var doe = F.inr.doe, vulKeuze = F.inr.vulKeuze;

  function herlaadBoekingen() {
    var dagId = $('#bkDag').value;
    if (!dagId) { $('#bkLijst').textContent = ''; return Promise.resolve(); }
    return F.api('/api/festival/boekingen', { festival: F.staat.fid, editie: F.staat.eid, dag: dagId })
      .then(function (r) {
        var lijst = $('#bkLijst');
        lijst.textContent = '';
        var boekingen = (r.body || {}).boekingen || [];
        vulKeuze($('#bkRiderBoeking'), boekingen.map(function (b) {
          return { value: b.id, tekst: b.artiest + ' ' + b.van };
        }), boekingen.length ? '' : 'nog geen boeking');
        boekingen.forEach(function (b) {
          var rechts = b.stand === 'bevestigd'
            ? 'bevestigd · ' + ((b.bevestigd || {}).hoe || '')
            : b.stand + ' · tik aan om te bevestigen';
          if (b.riderOpen) rechts = b.riderOpen + ' rider open · ' + rechts;
          var knop = document.createElement('button');
          knop.type = 'button';
          knop.className = 'fp-regel';
          if (b.stand === 'voornemen') knop.setAttribute('data-sig', 'aandacht');
          var l = document.createElement('span');
          l.textContent = b.artiest + ' · ' + (b.podiumNaam || 'geen podium')
            + ' · ' + b.van + '-' + b.tot;
          knop.appendChild(l);
          var re = document.createElement('span');
          re.className = 'rek';
          re.textContent = rechts;
          knop.appendChild(re);
          if (b.stand !== 'bevestigd') {
            knop.addEventListener('click', function () {
              doe('/api/festival/boeking/stand', { id: b.id, stand: 'bevestigd',
                hoe: $('#bkHoe').value.trim() }, function () { herlaadBoekingen(); });
            });
          }
          lijst.appendChild(knop);
        });
      });
  }

  $('#bkZet').addEventListener('click', function () {
    doe('/api/festival/boeking', { dag: $('#bkDag').value, podium: $('#bkPodium').value || null,
      artiest: $('#bkArtiest').value.trim(), van: $('#bkVan').value.trim(),
      tot: $('#bkTot').value.trim(), soundcheck: $('#bkSound').value.trim() || null,
      gage: $('#bkGage').value }, function () { $('#bkArtiest').value = ''; herlaadBoekingen(); });
  });
  $('#bkDag').addEventListener('change', herlaadBoekingen);

  $('#bkRiderZet').addEventListener('click', function () {
    doe('/api/festival/rider', { boeking: $('#bkRiderBoeking').value,
      wat: $('#bkRiderWat').value.trim() },
      function () { $('#bkRiderWat').value = ''; herlaadBoekingen(); });
  });

  function herlaadDiensten() {
    var dagId = $('#dnDag').value;
    if (!dagId) { $('#dnLijst').textContent = ''; return Promise.resolve(); }
    return F.api('/api/festival/diensten', { festival: F.staat.fid, editie: F.staat.eid, dag: dagId })
      .then(function (r) {
        var lijst = $('#dnLijst');
        lijst.textContent = '';
        ((r.body || {}).diensten || []).forEach(function (d) {
          regel(lijst, d.wie + ' · ' + (d.plekNaam || '?') + (d.rol ? ' · ' + d.rol : ''),
            d.van + '-' + d.tot);
        });
      });
  }

  $('#dnZet').addEventListener('click', function () {
    doe('/api/festival/dienst', { dag: $('#dnDag').value, plek: $('#dnPlek').value,
      wie: $('#dnWie').value.trim(), van: $('#dnVan').value.trim(), tot: $('#dnTot').value.trim(),
      rol: $('#dnRol').value.trim() || null, briefing: $('#dnBrief').value.trim() || null },
      function () { $('#dnWie').value = ''; herlaadDiensten(); });
  });
  $('#dnDag').addEventListener('change', herlaadDiensten);

  /* De keuzelijsten van deze twee blokken worden hier gevuld en niet in
     ./inrichten.js: een lijst hoort te wonen waar hij gelezen wordt. */
  F.inr.na.push(function () {
    var dagen = (F.staat.dagen || []).map(function (d) { return { value: d.id, tekst: d.datum }; });
    vulKeuze($('#dnDag'), dagen);
    vulKeuze($('#bkDag'), dagen);
    vulKeuze($('#dnPlek'), F.staat.plekken.map(function (p) { return { value: p.id, tekst: p.naam }; }));
    vulKeuze($('#bkPodium'), F.staat.plekken.filter(function (p) { return p.soort === 'podium'; })
      .map(function (p) { return { value: p.id, tekst: p.naam }; }), 'geen podium');
    herlaadDiensten();
    herlaadBoekingen();
  });
})();

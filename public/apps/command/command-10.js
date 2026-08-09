/* RTG Command, deel 10: de servicedoelen met hun foutbudget, en de sonde.

   DIT SCHERM MAG NIET GERUSTSTELLEN ALS HET NIETS WEET. Dat is de hele reden
   dat het bestaat. De tellers achter deze cijfers beginnen bij elke herstart op
   nul; een vers proces met drie verzoeken en nul fouten staat op 100% en dat
   als "doel gehaald" tonen is de duurste leugen die hier kan staan. Vandaar de
   derde stand naast gehaald en niet gehaald: "onvoldoende gemeten", in een
   eigen kleur en met de reden erbij.

   EN BINNEN EN BUITEN STAAN APART. Wat de app over zichzelf telt, telt niets
   meer zodra de app plat ligt. De sonde klopt van buitenaf aan; die cijfers
   worden er nergens bij opgeteld, want dan verdwijnt het strenge getal in het
   makkelijke. Staat er niets van buitenaf, dan zegt het scherm dat met zoveel
   woorden in plaats van het weg te laten. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  /* Drie standen, drie kleuren. "Onvoldoende gemeten" heeft er bewust een
     eigen: hem groen tonen zou een leeg venster als een gehaald doel laten
     lezen, en dat is precies de fout die dit scherm moet voorkomen. */
  var KLEUR = { 'gehaald': 'ok', 'niet gehaald': 'mis', 'onvoldoende gemeten': 'onbekend' };

  C.TEKENAARS.slo = function (el) {
    el.innerHTML = '<h2 class="ckop">Servicedoelen</h2>' +
      '<p class="lead">Niet wat wij beloven maar wat wij meten, en hoeveel foutbudget er nog over is. ' +
      'Een doel zonder budgetstand is een rapportcijfer achteraf; met budget is de afweging tussen ' +
      'snelheid en stabiliteit een cijfer in plaats van een discussie.</p>' +
      '<div id="sloUit"><div class="leeg">Meten…</div></div>';
    api('slo').then(function (d) {
      var u = '<div class="rooster">' +
        tegel('Gehaald', d.tel.gehaald, d.tel.gehaald ? 'groen' : '', 'van ' + d.tel.doelen + ' doelen') +
        tegel('Niet gehaald', d.tel.gezakt, d.tel.gezakt ? 'acc' : '', 'budget aan het opmaken') +
        tegel('Onvoldoende gemeten', d.tel.onvoldoende, d.tel.onvoldoende ? 'gold' : '', 'te weinig verkeer of te kort venster') +
        '</div>';

      u += '<div class="kaart"><h3>Uitrol</h3><p><b>' + (d.uitrol.mag ? 'Mag' : 'Niet nu') + '.</b> ' +
        esc(d.uitrol.reden) + '</p>' +
        (d.uitrol.onbeoordeeld ? '<p class="meta">' + d.uitrol.onbeoordeeld + ' doel(en) zijn nog niet beoordeeld. ' +
          'Die houden bewust niets tegen: een slot dat na elke herstart een dag dichtzit, wordt omzeild ' +
          'in plaats van gebruikt.</p>' : '') + '</div>';

      for (var i = 0; i < d.doelen.length; i++) u += doelKaart(d.doelen[i]);

      u += '<div class="kaart"><h3>Waar deze cijfers vandaan komen</h3>' +
        '<p class="meta">' + esc(d.bron.binnen) + '</p>' +
        '<p class="meta">' + (d.bron.buiten && d.bron.buiten.gemeten
          ? 'Van buitenaf: ' + d.bron.buiten.pogingen + ' metingen, ' + d.bron.buiten.mislukt + ' mislukt.'
          : 'Van buitenaf: ' + esc((d.bron.buiten && d.bron.buiten.uitleg) || 'niet gemeten')) + '</p>' +
        '<p class="meta">De failover is apart beproefd en niet beweerd: <code>npm run chaos</code> start een ' +
        'eigen trio en schiet de ACTIEVE server om met SIGKILL. De uitslag staat in SLO.md.</p>' +
        '<p class="meta">De doelen staan in ' + esc(d.norm.bestand) + ' (vastgelegd ' + esc(d.norm.vastgelegd) +
        '); een doel telt pas mee vanaf ' + d.norm.minimumVerzoeken + ' verzoeken en ' +
        Math.round(d.norm.minimumDekking * 100) + '% van zijn venster.</p></div>';
      document.querySelector('#sloUit').innerHTML = u;
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#sloUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function doelKaart(d) {
    var b = d.budget;
    var waarde = d.gemeten == null ? 'niets gemeten'
      : (d.eenheid === 's' ? '<= ' + d.gemeten + ' s' : d.gemeten + '%');
    var streef = d.eenheid === 's' ? '< ' + d.streef + ' s' : d.streef + '%';
    return '<div class="kaart"><h3>' + esc(d.naam) + '</h3>' +
      '<div class="crij"><span class="cniveau ' + (KLEUR[d.oordeel] || '') + '">' + esc(d.oordeel) + '</span>' +
      '<span class="meta">' + esc(d.meet) + '</span></div>' +
      '<div class="rooster">' +
      tegel('Gemeten', waarde, '', d.metingen + ' metingen') +
      tegel('Streef', streef, '', 'over ' + d.venster.dagen + ' dagen') +
      (b ? tegel('Budget over', Math.round(b.restDeel * 100) + '%',
        b.op ? 'acc' : (b.restDeel < 0.25 ? 'gold' : 'groen'),
        Math.max(0, b.restMinuten) + ' van ' + b.totaalMinuten + ' minuten')
        : tegel('Budget', 'n.v.t.', '', 'een snelheidsdoel heeft geen minutenbudget')) +
      '</div>' +
      '<p class="meta">' + esc(d.uitleg) + '</p>' +
      '<p class="meta">Gemeten venster: ' + Math.round(d.venster.gemetenSeconden / 60) + ' min, ' +
      'dat is ' + (d.venster.dekking * 100).toFixed(1) + '% van de afgesproken ' + d.venster.dagen + ' dagen.' +
      (d.waarom ? ' ' + esc(d.waarom) : '') + '</p></div>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  C.TEKENAARS.sonde = function (el) {
    el.innerHTML = '<h2 class="ckop">Sonde</h2>' +
      '<p class="lead">Nepgebruikers die de keten lopen terwijl er niemand kijkt. Ze raken niets aan: ' +
      'de inlogreis logt met opzet verkeerd in en verwacht een afwijzing, want de sonde toetst dat het pad ' +
      'antwoordt en niet dat hij binnenkomt.</p>' +
      '<div id="soUit"><div class="leeg">Ophalen…</div></div>';
    teken();

    function teken() {
      api('sonde', { uren: 24 }).then(function (d) {
        var u = '';
        if (d.let) u += '<div class="kaart"><h3>Let op</h3><p>' + esc(d.let) + '</p></div>';
        u += '<div class="crij"><button class="knop vol" id="soGa">Ronde nu draaien</button>' +
          '<span class="meta">' + d.monsters + ' monsters in ' + d.uren + ' uur, ' +
          d.bewaard + ' bewaard van maximaal ' + d.max + '</span></div>';
        u += kant('Van buitenaf', d.buiten, 'TLS, de proxy en het netwerk zitten hierin. Dit is het cijfer dat telt.');
        u += kant('Van de machine zelf', d.binnen, 'Dit bewijst dat de HTTP-laag antwoordt, niet dat een klant erbij kan.');

        u += '<div class="kaart"><h3>De reizen</h3><div class="schuif"><table class="ctab"><thead><tr>' +
          '<th>Reis</th><th>Pad</th><th>Verwacht</th><th>Max</th></tr></thead><tbody>' +
          d.reizen.map(function (r) {
            return '<tr><td>' + esc(r.naam) + '<div class="meta">' + esc(r.waarom || '') + '</div></td>' +
              '<td class="meta">' + esc(r.methode + ' ' + r.pad) + '</td>' +
              '<td class="meta">' + esc((r.verwacht || []).join('/')) + '</td>' +
              '<td class="meta">' + (r.maxMs || '') + ' ms</td></tr>';
          }).join('') + '</tbody></table></div></div>';

        if (d.storingen.length) {
          u += '<div class="kaart"><h3>Laatste storingen</h3>' + d.storingen.map(function (m) {
            return '<div class="lijn"><b>' + esc(m.reis) + '</b> <span class="meta">' + esc(m.van) + ' · ' +
              esc(m.at) + '</span><div class="meta">' + esc(m.reden || 'zonder reden genoteerd') + '</div></div>';
          }).join('') + '</div>';
        }
        document.querySelector('#soUit').innerHTML = u;
        document.querySelector('#soGa').onclick = function () {
          this.disabled = true;
          api('sonde/draai').then(function (r) { C.meld(r.gelukt + ' van ' + r.van_totaal + ' reizen gelukt'); teken(); })
            .catch(function (e) { if (!e.stil) C.meld(e.message); });
        };
      }).catch(function (e) {
        if (!e.stil) document.querySelector('#soUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
      });
    }
  };

  function kant(titel, k, waarom) {
    var u = '<div class="kaart"><h3>' + esc(titel) + '</h3><p class="meta">' + esc(waarom) + '</p>';
    if (!k.pogingen) return u + '<p>Niets gemeten in dit venster.</p></div>';
    u += '<div class="rooster">' +
      tegel('Gelukt', Math.round(k.deel * 100) + '%', k.deel === 1 ? 'groen' : 'acc', k.gelukt + ' van ' + k.pogingen) +
      tegel('Mislukt', k.mislukt, k.mislukt ? 'acc' : '', 'geen of een onverwacht antwoord') +
      tegel('Te traag', k.traag, k.traag ? 'gold' : '', 'wel geantwoord, over de afgesproken tijd') +
      tegel('p90', (k.p90Ms == null ? '-' : k.p90Ms + ' ms'), '', 'p50 ' + (k.p50Ms == null ? '-' : k.p50Ms + ' ms')) +
      '</div>';
    u += '<div class="schuif"><table class="ctab"><thead><tr><th>Reis</th><th>Gelukt</th><th>p90</th></tr></thead><tbody>' +
      k.reizen.map(function (r) {
        return '<tr><td>' + esc(r.naam) + '</td><td>' + r.gelukt + '/' + r.pogingen + '</td><td class="meta">' +
          (r.p90Ms == null ? '-' : r.p90Ms + ' ms') + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
    return u;
  }

  /* Bij "Spiegel" en niet bij "Zien": dit zijn de schermen waarop deze opzet
     zichzelf kan tegenspreken, net als de werkbesparing en het journaal. */
  C.WERKPLEKKEN.push(
    { id: 'slo', naam: 'Servicedoelen', sec: 'Spiegel',
      teller: function (s) { return s.slo && s.slo.tel ? s.slo.tel.gezakt : 0; } },
    { id: 'sonde', naam: 'Sonde', sec: 'Spiegel' });
  void S;
})();

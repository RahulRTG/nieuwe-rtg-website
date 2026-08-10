/* RTG Command, deel 2: het Command Center en de werkplek.

   HET COMMAND CENTER toont per domein de gerekende stand met de redenen
   eronder. Er is bewust geen knop om een domein op groen te zetten: een
   stoplicht dat je kunt overrulen, staat op den duur altijd groen.

   DE WERKPLEK is de andere helft van "één app": naast besturen moet een
   kantoor ook gewoon kunnen wérken -- schrijven, rekenen, mailen, plannen,
   vergaderen. Die apps bestaan al in dit platform; ze worden hier niet
   nagebouwd maar vanuit dezelfde schil geopend, met de uitleg erbij waarvoor
   je ze pakt. Een tweede tekstverwerker bouwen zou precies de fout zijn die
   deze hele operatie moest oplossen. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, S = C.S;

  var KLEUR = { 'in orde': 'groen', 'let op': 'gold', 'storing': 'acc', 'leeg': '' };

  C.TEKENAARS.puls = function (el) {
    var p = S.puls;
    if (!p) { el.innerHTML = '<div class="leeg">Nog geen beeld.</div>'; return; }
    var u = '<h2 class="ckop">Global Command Center</h2>' +
      '<p class="lead">De stand van elk domein, elke keer opnieuw gerekend uit de gegevens. ' +
      'Een domein zonder objecten staat op <em>leeg</em> en niet op <em>in orde</em>: niet gemeten is geen groen.</p>';

    u += '<div class="rooster">' +
      tegel('Stand', p.stand, KLEUR[p.stand] || '', p.domeinen.length + ' domeinen in beeld') +
      tegel('Open uitzonderingen', p.zaken.open, p.zaken.overTermijn ? 'acc' : '', p.zaken.overTermijn + ' over de termijn, ' + p.zaken.zonderEigenaar + ' zonder eigenaar') +
      tegel('Te herstellen', p.herstel.kandidaten, p.herstel.kandidaten ? 'gold' : 'groen', p.herstel.runbooks + ' runbooks' + (p.herstel.autoAan ? ', automatisch herstel staat aan' : ', automatisch herstel staat UIT')) +
      tegel('Agents', p.agents.totaal, p.agents.gestopt ? 'acc' : '', p.agents.gestopt + ' gestopt, ' + p.agents.bijnaOpBudget + ' bijna op budget') +
      tegel('Journaalregels', p.journaal.regels, p.journaal.keten.heel ? 'groen' : 'acc',
        p.journaal.keten.heel ? 'de keten is heel (' + p.journaal.venster + ' in het venster)' : 'BREUK bij ' + esc(p.journaal.keten.bij)) +
      tegel('Beleidsregels', p.beleid.regels, p.beleid.voorstellenOpen ? 'gold' : '', p.beleid.voorstellenOpen + ' voorstel(len) wachten op een tweede paar ogen') +
      '</div>';

    u += '<h2 class="ckop" style="font-size:1.15rem;margin-top:1.6rem;">Per domein</h2><div class="rooster">';
    for (var i = 0; i < p.domeinen.length; i++) {
      var d = p.domeinen[i];
      u += '<div class="tegel"><div class="l">' + esc(d.domein) + '</div>' +
        '<div class="v ' + (KLEUR[d.stand] || '') + '" style="font-size:1.15rem;">' + esc(d.stand) + '</div>' +
        '<div class="u">' + esc(d.redenen.join(' · ')) + '</div>' +
        '<div class="meta" style="margin-top:.5rem;">' + d.objecten + ' objecten in ' +
        esc(d.soorten.map(function (s) { return s.meervoud; }).join(', ')) + '</div>' +
        (d.runbooks.length ? '<div class="meta" style="margin-top:.35rem;">' +
          d.runbooks.map(function (r) { return esc(r.naam) + ' (' + r.kandidaten + ', ' + esc(r.niveau) + ')'; }).join('<br>') + '</div>' : '') +
        '</div>';
    }
    u += '</div>';
    u += '<p class="meta" style="margin-top:1.2rem;">Dekking: ' + p.dekking.soorten + ' objectsoorten over ' +
      p.dekking.domeinen + ' domeinen. Wat niet in het objectregister staat, telt hier niet mee -- het staat dan niet op groen, het staat er niet.</p>';
    el.innerHTML = u;
  };

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div>' +
      '<div class="v ' + (k || '') + '">' + esc(v) + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  /* De werkplek-suite. Elk kaartje wijst naar een app die er al is; de tekst
     zegt waarvoor je hem pakt, niet wat hij heet. */
  var SUITE = [
    ['Schrijven & rekenen', [
      ['/apps/office.html', 'RTG Office', 'Documenten, bladen, presentaties, formulieren en borden -- met de kantoor-drive eronder.'],
      ['/apps/notities.html', 'Notities', 'Korte aantekeningen die aan een dossier of project blijven hangen.'],
      ['/apps/bestanden.html', 'Bestanden', 'De drive: versies, rechten, bewaartermijn en het spoor wie wat opende.']
    ]],
    ['Contact', [
      ['/apps/rtmail.html', 'RTMail', 'De eigen mailstack met gedeelde postbussen en triage.'],
      ['/apps/comm.html', 'Berichten', 'Chat, bellen, videobellen en afspraken in één gesprekslijst.'],
      ['/apps/meet.html', 'Meet', 'Vergaderen met scherm delen; de notulen komen in het dossier.'],
      ['/apps/agenda.html', 'Agenda', 'Mensen, ruimtes en middelen in één planning.']
    ]],
    ['Bedrijfsvoering', [
      ['/apps/backoffice.html', 'Backoffice', 'De dagcijfers, partners, orders en de verificatiewachtrij.'],
      ['/apps/kantoren.html', 'De kamers', 'De afdelingskamers van RTG, de boardroom en de regie.'],
      ['/apps/personeel.html', 'Personeel', 'Rooster, taken, verlof en de PDA’s van de werkvloer.'],
      ['/apps/payroll.html', 'Payroll', 'De loonrun, uren, toeslagen en de salarisadministratie.'],
      ['/apps/balans.html', 'Balans', 'Grootboek, debiteuren, crediteuren en de jaarcijfers.'],
      /* RTG REKENING. Het b-woord in de eigen productnaam vraagt een
         vergunning (Wft 3:7), dus heet dit overal RTG Rekening --
         test/eu-naleving.test.js loopt elk uitgeleverd scherm na om te zien of
         iemand het toch weer anders noemt, en die pin leest ook commentaar. */
      ['/apps/bank.html', 'RTG Rekening', 'De eigen rekeninglaag op het Pay-grootboek.'],
      ['/apps/juridisch.html', 'Juridisch', 'Voorwaarden, privacy en de partnerafspraken.']
    ]],
    ['Techniek & dienst', [
      ['/apps/techniek.html', 'Techniek', 'De motorkap: grootboeken, belasting en de wacht.'],
      ['/apps/meldkamer.html', 'Meldkamer', 'Incidenten, dienst en de coördinatie erop.'],
      ['/apps/logboek.html', 'Logboek', 'Wat er is gebeurd, in de volgorde waarin het gebeurde.'],
      ['/apps/websitestudio.html', 'Website­studio', 'De publieke kant: pagina’s, campagnes en beeld.']
    ]],
    ['RTG & RTF', [
      ['/apps/foundation/kantoor.html', 'RTF-kantoor', 'De stichting: projecten, vrijwilligers, hulpvragen en de afdrachten.'],
      ['/apps/rtgkantoor.html', 'De RTG AI', 'De eigen AI van het kantoor en de Onderzoeker ernaast.'],
      ['/apps/boardroom.html', 'Boardroom', 'De kamer van de eigenaar: functies aan of uit, platformbreed.'],
      ['/apps/redactiekantoor.html', 'Redactie', 'Krant, magazine en de drukkerij in eigen huis.']
    ]]
  ];

  C.TEKENAARS.werkplek = function (el) {
    var u = '<h2 class="ckop">De werkplek</h2>' +
      '<p class="lead">Command bestuurt; hier wordt gewerkt. Deze apps bestaan al en delen dezelfde inlog, ' +
      'dezelfde codenamen en dezelfde gegevens -- ze worden hier geopend, niet nagebouwd. ' +
      'Wat u in Command aan een object doet, ziet u daar terug, en omgekeerd.</p>';
    for (var i = 0; i < SUITE.length; i++) {
      u += '<h2 class="ckop" style="font-size:1.1rem;margin:1.4rem 0 .6rem;">' + esc(SUITE[i][0]) + '</h2><div class="werkplek">';
      var rij = SUITE[i][1];
      for (var j = 0; j < rij.length; j++) {
        u += '<a href="' + esc(rij[j][0]) + '"><b>' + esc(rij[j][1]) + '</b><span>' + esc(rij[j][2]) + '</span></a>';
      }
      u += '</div>';
    }
    el.innerHTML = u;
  };
})();

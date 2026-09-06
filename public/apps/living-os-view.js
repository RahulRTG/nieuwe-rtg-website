/* HET VOORUITZICHT -- truthful state presentation.

   Deze module vertaalt uitsluitend de ontvangen universumstaat naar zichtbare
   tekst en bediening. Netwerkmutaties en gebruikersinteractie blijven in
   living-os.js, zodat bronwaarheid en presentatie elk een duidelijke grens
   hebben. */
(function (w, d) {
  'use strict';

  var $ = function (s) { return d.querySelector(s); };
  var worlds = {
    likely: { label: 'WAARSCHIJNLIJKE ROUTE', title: 'Gekozen om te onderzoeken.', accent: '#72bd94' },
    ideal: { label: 'IDEALE ROUTE', title: 'Gekozen om te onderzoeken.', accent: '#c0a544' },
    disruption: { label: 'VERSTORINGSSCENARIO', title: 'Hypothetisch · niets operationeels gewijzigd.', accent: '#a64b67' }
  };
  var intentieOpgeslagen = false;

  function tijdstip(waarde) {
    if (!waarde) return '…';
    var datum = new Date(waarde);
    if (!Number.isFinite(datum.getTime())) return '…';
    return datum.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' });
  }

  function providerTekst(status) {
    if (status === 'confirmed') return 'bevestigd';
    if (status === 'verified') return 'geverifieerd';
    if (status === 'reprepare') return 'opnieuw voorbereiden';
    if (status === 'protected') return 'beschermingsverzoek';
    if (status === 'prepared') return 'lokaal concept';
    if (status === 'local') return 'alleen lokaal';
    return 'niet bevestigd';
  }

  function zetBeschikbaarheid(staat, lokaalGewijzigd) {
    var tekst = $('#loIntent').value.trim();
    var alVrijgegeven = staat.state === 'prepared' || staat.state === 'confirmed';
    var kanVoorbereiden = !!tekst && intentieOpgeslagen && !lokaalGewijzigd && !alVrijgegeven;
    $('#loApprove').disabled = !kanVoorbereiden;
    $('#loApprove').textContent = alVrijgegeven ? 'Voorbereiding vrijgegeven' : (kanVoorbereiden ? 'Voorbereiding vrijgeven →' : 'Sla eerst uw intentie op');
    d.querySelectorAll('[data-act="approve"]').forEach(function (knop) { knop.disabled = !kanVoorbereiden; });
    $('#loDelay').disabled = !kanVoorbereiden;
    if (lokaalGewijzigd) {
      $('#loLocalText').textContent = tekst ? 'Lokale wijziging nog niet opgeslagen' : 'Nog niet opgeslagen';
      $('#loLocalState').textContent = tekst ? 'LOKAAL' : 'LEEG';
      $('#loConfidence').textContent = tekst ? 'WACHT OP OPSLAAN' : 'NOG GEEN INTENTIE';
    }
  }

  function setWorld(id, staat) {
    var world = worlds[id] || worlds.likely;
    d.querySelectorAll('[data-world]').forEach(function (knop) {
      knop.classList.toggle('actief', knop.dataset.world === id);
    });
    $('#loWorldLabel').textContent = intentieOpgeslagen ? world.label + ' · NIET DOORGEREKEND' : 'GEEN BEREKENING';
    $('#loWorldTitle').textContent = intentieOpgeslagen ? world.title : 'Voeg eerst een intentie toe.';
    $('#loWorldScore').innerHTML = '…<small>rust</small>';
    ['capMoney', 'capTime', 'capEnergy', 'capPeople', 'capLife'].forEach(function (naam) {
      $('#' + naam).textContent = '…';
    });
    $('#loWorld').style.setProperty('--world-accent', world.accent);
    $('#loContext').textContent = id === 'disruption'
      ? 'Dit is een hypothetisch scenario. Er is geen echte reis of providerstatus gewijzigd.'
      : (intentieOpgeslagen ? 'Deze route is door u gekozen om te onderzoeken; er is nog niets berekend of uitgevoerd.' : 'Begin met een intentie. RTG vult geen reis, bedrag of zekerheid voor u in.');
  }

  function render(staat) {
    var intentie = String(staat.intent || '').trim();
    var providers = staat.providers || {};
    intentieOpgeslagen = !!intentie;

    $('#loId').textContent = staat.id || 'GEEN BRON';
    $('#loVersion').textContent = staat.version ? 'V' + staat.version : 'V…';
    $('#loUpdated').textContent = tijdstip(staat.updated);
    if (d.activeElement !== $('#loIntent')) $('#loIntent').value = intentie;
    $('#loGoal').textContent = intentie || 'Vul uw intentie in; RTG toont hier uitsluitend de letterlijk opgeslagen tekst.';
    $('#loConfidence').textContent = intentie ? 'OPGESLAGEN IN BRON' : 'NOG GEEN INTENTIE';
    $('#loLocalText').textContent = intentie ? 'Letterlijke intentie opgeslagen' : 'Nog niet opgeslagen';
    $('#loLocalState').textContent = intentie ? 'OPGESLAGEN' : 'LEEG';
    $('#loIntentNode').classList.toggle('done', !!intentie);
    $('#loIntentNode').querySelector('small').textContent = intentie ? 'Bronversie ' + staat.version : 'Nog niet opgeslagen';
    $('#loIntentNode').querySelector('em').textContent = intentie ? 'BRON' : 'LEEG';

    var beslissingen = Number.isFinite(Number(staat.decisionCount)) ? Number(staat.decisionCount) : null;
    $('#loDecisionBadge').textContent = beslissingen === null ? '…' : String(beslissingen);
    $('#loDecisionCount').textContent = beslissingen === null ? '…' : String(beslissingen);
    $('#loDecisionLabel').textContent = intentie ? (beslissingen === null ? 'BESLISSINGEN ONBEKEND' : beslissingen + ' OPEN BESLISSING' + (beslissingen === 1 ? '' : 'EN')) : 'NOG GEEN BESLISSING';
    $('#loDecisionTitle').textContent = intentie ? 'Welke route wilt u verder onderzoeken?' : 'Leg eerst vast wat u wilt.';

    $('#hotelState').textContent = providerTekst(providers.hotel);
    $('#transportState').textContent = providerTekst(providers.transport);
    $('#financeState').textContent = providerTekst(providers.finance);
    var staten = [providers.hotel, providers.transport, providers.finance].filter(Boolean);
    var bevestigd = staten.filter(function (status) { return status === 'confirmed'; }).length;
    $('#loProviderState').textContent = bevestigd ? bevestigd + ' VAN 3 BEVESTIGD' : (staten.length ? 'GEEN PROVIDERBEWIJS' : 'NIET GEVRAAGD');
    $('#loFinalState').textContent = bevestigd === 3 ? 'BEVESTIGD' : (bevestigd ? 'DEELS BEVESTIGD' : 'GEEN STATUS');
    $('#loFinal').classList.toggle('done', bevestigd === 3);
    $('#loSlaState').textContent = staat.state === 'prepared' ? 'VOORBEREIDING VRIJGEGEVEN' : (staat.state === 'confirmed' ? 'BRONBEWIJS CONTROLEREN' : 'NIET INGESTELD');

    setWorld(staat.world || 'likely', staat);
    zetBeschikbaarheid(staat, false);
  }

  function lokaleWijziging(staat) {
    intentieOpgeslagen = false;
    zetBeschikbaarheid(staat, true);
  }

  w.RTGLivingView = {
    render: render,
    setWorld: setWorld,
    lokaleWijziging: lokaleWijziging,
    zetBeschikbaarheid: zetBeschikbaarheid,
    isOpgeslagen: function () { return intentieOpgeslagen; }
  };
})(window, document);

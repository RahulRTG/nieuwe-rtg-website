    const markers = proj.map((pt,i) => {
      const s = pts[i];
      return '<div class="mk' + (s.me?' me':'') + '" style="left:' + pt.x.toFixed(1) + '%;top:' + pt.y.toFixed(1) + '%;">' +
        (s.me ? '<div class="pin"></div>' : '<div>' + s.icon + '</div>') +
        '<div class="lbl">' + (s.me ? T('live.you','U') : s.name) + '</div></div>';
    }).join('');

    const partners = L.partners.map(p => {
      const isVeh = p.type === 'taxi' || p.type === 'jet';
      let eta;
      if (p.ride && isVeh){
        eta = p.taxiEtaMin != null && p.ride.status !== 'gearriveerd'
          ? '<div class="eta"><div class="n">' + p.taxiEtaMin + '</div><div class="u">' + T('live.mintoyou','min naar u') + '</div></div>'
          : '<div class="eta"><div class="n" style="font-size:0.9rem;">' + tRide(p.ride.status) + '</div></div>';
      } else if (p.isDest && L.arrived){
        eta = '<div class="eta arr"><div class="n">✓ ' + T('live.here','ter plaatse') + '</div></div>';
      } else {
        eta = p.etaMin != null ? '<div class="eta"><div class="n">' + p.etaMin + '</div><div class="u">' + T('live.minaway','min heen') + '</div></div>' : '';
      }
      let line2 = tType(p.typeLabel);
      if (p.ride){
        line2 += ' · ' + T('live.ride','rit') + ' ' + tRide(p.ride.status);
        const extra = [];
        if (p.ride.driver) extra.push('🚘 ' + p.ride.driver + (p.ride.vehicle ? ' · ' + p.ride.vehicle : ''));
        if (p.ride.quote) extra.push(T('live.vast','vaste nettoprijs') + ' ' + eur(p.ride.quote));
        if (extra.length) line2 += '<br>' + extra.join(' · ');
        // betaling achteraf: de zaak liet de rit direct rijden; afrekenen kan nu
        if (!p.ride.paid && p.ride.quote && p.ride.status !== 'wacht-op-betaling')
          line2 += '<br><button class="js-rpay" data-rref="' + p.ride.ref + '" data-rq="' + p.ride.quote + '" style="margin-top:0.35rem;background:none;border:1px solid var(--gold);color:var(--gold);border-radius:999px;padding:0.3rem 0.8rem;font-size:0.7rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('live.betaalrit','Betaal de rit') + ' · ' + eur(p.ride.quote) + '</button>';
      }
      else if (p.order) line2 += ' · ' + p.order.items + ' ' + T('app.items','item(s)') + ', ' + tStatus(p.order.status);
      return '<div class="live-partner"><span class="pic">' + p.icon + '</span><div class="pt"><b>' + p.name + '</b><span>' + line2 + '</span></div>' + eta + '</div>';
    }).join('');

    let preorder = '';
    const destSup = dest ? suppliers.find(s => s.code === dest.code) : null;
    if (dest && destSup && destSup.hasMenu && !dest.order && !L.arrived){
      preorder = '<div class="live-preorder"><span>' + T('live.preorder','Bestel vast vooruit, dan staat het klaar als u aankomt.') + '</span><button id="livePre">' + T('live.preorderbtn','Vooruit bestellen') + '</button></div>';
    }

    const hasVeh = L.partners.some(p => p.type === 'taxi' || p.type === 'jet');
    const canDoor = L.arrived && dest && dest.hasDoors;
    const acts = '<div class="live-acts">' +
      (canDoor ? '<button class="prim glowbtn" id="liveDoor">🔓 ' + T('live.door','Open de deur') + '</button>' : '') +
      '<button class="sec" id="liveSim">' + T('live.simulate','Simuleer rit') + '</button>' +
      (hasVeh ? '' : '<button class="sec" id="liveTaxi">' + T('live.taxi','Vraag een taxi') + '</button>') +
      (canDoor ? '' : '<button class="prim" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>') +
      (canDoor ? '<button class="sec" id="liveShare">' + T('live.share','Deel mijn locatie') + '</button>' : '') +
    '</div>';

    $('#livePanel').innerHTML =
      '<div class="live-panel">' +
        '<div class="live-top"><span class="live-badge"><span class="dot"></span>' + T('live.badge','Live onderweg') + '</span><button class="live-stop" id="liveStop">' + T('live.stop','Stop') + '</button></div>' +
        '<div class="live-headline">' + head + '</div>' + (sub ? '<div class="live-sub">' + sub + '</div>' : '') +
        '<div class="live-map">' + markers + '</div>' +
        preorder +
        '<div style="margin-top:0.5rem;">' + partners + '</div>' +
        acts +
      '</div>';

    $('#liveStop').addEventListener('click', stopLive);
    $('#liveSim').addEventListener('click', simulateRide);
    document.querySelectorAll('.js-rpay').forEach(b => b.addEventListener('click', () => {
      const bedrag = eur(Number(b.dataset.rq));
      payWithFaceId(bedrag, async () => {
        await API.call('/ride/pay', { ref: b.dataset.rref });
      }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + bedrag, after: () => renderLive() });
    }));
    $('#liveShare').addEventListener('click', shareMyLocation);
    const tx = $('#liveTaxi'); if (tx) tx.addEventListener('click', requestTaxi);
    const pre = $('#livePre'); if (pre) pre.addEventListener('click', () => { if (dest) openMenu(dest.code); });
    const dr = $('#liveDoor'); if (dr) dr.addEventListener('click', async () => {
      try { const d = await API.call('/live/door'); toast('🔓 ' + d.door.name + ' ' + T('live.dooropen','is open. Vergrendelt zichzelf na') + ' ' + d.door.relockSec + ' ' + T('live.sec','seconden.')); }
      catch(e){ toast(e.message); }
    });
  }

  async function stopLive(){
    stopSim();
    try { await API.call('/live/stop'); } catch (e) {}
    liveData = null; toast(T('live.stopped','Reis gestopt.')); renderLive();
  }

  function requestTaxi(){
    const veh = suppliers.find(s => s.type === 'taxi') || suppliers.find(s => s.type === 'jet');
    if (!veh){ toast(T('live.notaxi','Geen vervoerspartner beschikbaar op deze bestemming.')); return; }
    // paspoortleeftijd: privejets boek je vanaf 18 jaar
    if (veh.type === 'jet' && user.leeftijdsgroep === '15-17'){ toast(T('live.jet18','Privejets boek je vanaf 18 jaar. Een taxi regelen we graag voor je.')); return; }
    // nette aanvraag: personen, bagage en tijdstip; de prijs komt direct terug
    $('#rideSup').textContent = veh.name;
    $('#ride-sheet').dataset.code = veh.code;
    $('#ride-sheet').classList.add('open'); $('#ride-scrim').classList.add('open');
  }
  async function verstuurRit(){
    const code = $('#ride-sheet').dataset.code;
    const wanneer = $('#ridePlan').value === 'later' ? ($('#rideTijd').value ? T('live.om','om') + ' ' + $('#rideTijd').value : 'Zo snel mogelijk') : 'Zo snel mogelijk';
    try {
      const d = await API.call('/ride/request', {
        supplierCode: code,
        toCode: (liveData && liveData.destCode) || undefined,
        passengers: Number($('#ridePax').value) || 1,
        luggage: Number($('#rideBag').value) || 0,
        when: wanneer,
        date: $('#ridePlan').value === 'later' ? $('#rideDatum').value : '',
        time: $('#ridePlan').value === 'later' ? $('#rideTijd').value : '',
        note: $('#rideNote').value.trim()
      });
      $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open');
      if (d.ride && d.ride.status === 'wacht-op-betaling'){
        // betalen-eerst: pas na afrekenen gaat de aanvraag naar de vervoerder
        payWithFaceId(eur(d.ride.quote), async () => {
          await API.call('/ride/pay', { ref: d.ride.ref });
          return d.ride;
        }, { message: () => T('live.ritbetaald','Rit betaald en definitief:') + ' ' + eur(d.ride.quote), after: () => renderLive() });
      } else {
        toast('🚘 ' + T('live.taxireq2','Rit aangevraagd.') + (d.ride && d.ride.quote ? ' ' + T('live.vast','vaste nettoprijs') + ': ' + eur(d.ride.quote) : ''));
        await renderLive();
      }
    } catch (e){ toast(e.message); }
  }

  function shareMyLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { liveData = (await API.call('/live/update', { lat: pos.coords.latitude, lng: pos.coords.longitude })).live; renderLivePanel(); toast(T('live.shared','Locatie gedeeld met uw partners.')); }
        catch (e){ toast(e.message); }
      }, () => toast(T('live.geodenied','Locatie niet beschikbaar. Gebruik "Simuleer rit" voor de demo.')), { timeout: 4000 });
    } else toast(T('live.geono','Locatie is hier niet beschikbaar.'));
  }

  function stopSim(){ if (simTimer){ clearInterval(simTimer); simTimer = null; } }
  function simulateRide(){
    const L = liveData;
    if (!L || !L.me || !L.dest || !L.dest.loc){ toast(T('live.nosim','Kies eerst een bestemming.')); return; }
    stopSim();
    const start = { lat: L.me.lat, lng: L.me.lng };
    const end = { lat: L.dest.loc.lat, lng: L.dest.loc.lng };
    let step = 0; const N = 16;
    toast(T('live.simstart','Simulatie gestart, u nadert de bestemming.'));
    simTimer = setInterval(async () => {
      step++;
      const t = step / N;
      const lat = start.lat + (end.lat - start.lat) * t + (Math.random() - 0.5) * 0.0004;
      const lng = start.lng + (end.lng - start.lng) * t + (Math.random() - 0.5) * 0.0004;
      try { liveData = (await API.call('/live/update', { lat, lng })).live; renderLivePanel(); } catch (e) {}
      if (step >= N) stopSim();
    }, 900);
  }


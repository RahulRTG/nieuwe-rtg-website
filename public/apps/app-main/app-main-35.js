/* betalen met Face ID vanuit een rekeningregel */
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
      try { const d = await API.call('/live/door'); toast('' + d.door.name + ' ' + T('live.dooropen','is open. Vergrendelt zichzelf na') + ' ' + d.door.relockSec + ' ' + T('live.sec','seconden.')); }
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
        toast('' + T('live.taxireq2','Rit aangevraagd.') + (d.ride && d.ride.quote ? ' ' + T('live.vast','vaste nettoprijs') + ': ' + eur(d.ride.quote) : ''));
        await renderLive();
      }
    } catch (e){ toast(e.message); }
  }

  function shareMyLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { liveData = (await API.call('/live/update', { lat: pos.coords.latitude, lng: pos.coords.longitude })).live; renderLivePanel(); toast(T('live.shared','Locatie gedeeld met uw partners.')); }
        catch (e){ toast(e.message); }
      }, () => toast(T('live.geodenied','Locatie niet beschikbaar. Vul de locatie handmatig in.')), { timeout: 4000 });
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

  const FID_MINI = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="3" fill="currentColor"/><circle cx="40.5" cy="26.5" r="3" fill="currentColor"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';

  async function openMenu(code){
    let data;
    try { data = await API.call('/supplier/menu/get', { code }); }
    catch (e) { toast(e.message); return; }
    menuState = { supplier: data.supplier, menu: data.menu, alcohol: data.alcohol || null, qty: {}, note: '', tag: false, table: '', retail: null, retailMijn: null };
    // het eigen allergieprofiel: gerechten met een botsend allergeen worden in de
    // kaart meteen gemarkeerd (en de server keurt ze af bij het bestellen)
    try { menuState.allergenen = (((await API.call('/zorgprofiel', {})).zorg || {}).allergenen || []).map(a => String(a).toLowerCase()); } catch(e){ menuState.allergenen = []; }
    $('#msName').textContent = data.supplier.name;
    $('#msMeta').textContent = tType(data.supplier.typeLabel) + ' · ' + data.supplier.city + (data.supplier.loc ? ' · ' + data.supplier.loc.label : '');
    // mode-/retailpartner: haal de catalogus en de eigen apart/styling erbij
    if ((data.supplier.caps || []).includes('retail')){
      try { menuState.retail = await API.call('/retail/catalogus', { supplierCode: code }); } catch(e){}
      try { menuState.retailMijn = await API.call('/retail/mijn', {}); } catch(e){}
      try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){ menuState.modeBezorg = []; }
    }
    renderMenuSheet();
    $('#menu-sheet').classList.add('open');
    $('#menu-scrim').classList.add('open');
  }

  function renderMenuSheet(){
    const m = menuState.menu;
    const s = menuState.supplier;
    // fotostrip + kamers van de partner (hotels, of elke partner met foto's)
    let head = '';
    // rating + favoriet-hart + tafel reserveren (de ervaring-laag)
    head += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.2rem 0 0.6rem;">' +
      (s.rating ? '<span style="font-size:0.8rem;"><b>' + s.rating.score + '</b> <span style="color:var(--soft);font-size:0.7rem;">(' + s.rating.aantal + ')</span></span>' : '<span style="font-size:0.72rem;color:var(--soft);">' + T('erv.nogGeenReviews','Nog geen reviews') + '</span>') +
      '<button id="msFav" style="margin-left:auto;background:none;border:1px solid var(--line);border-radius:0;padding:0.35rem 0.8rem;font-size:0.85rem;" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '' + T('fav.bewaard','Bewaard') : '' + T('fav.bewaar','Bewaar')) + '</button></div>';
    if ((s.tableNames || []).length && s.reservationsOpen !== false){
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('erv.reserveer.h','Tafel reserveren') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.9rem;flex-wrap:wrap;">' +
        '<input type="date" id="rsvDatum" value="' + morgen + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:2;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.datum','Datum') + '">' +
        '<input type="time" id="rsvTijd" value="20:00" style="flex:1;min-width:84px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.tijd','Tijd') + '">' +
        '<select id="rsvPers" style="flex:1;min-width:70px;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,5,6,8,10].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="rsvGo">' + T('erv.reserveer','Reserveer') + '</button></div>';
    }

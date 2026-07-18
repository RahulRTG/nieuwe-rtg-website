    const ts = document.getElementById('tpSend');
    if (ts) ts.addEventListener('click', async () => {
      const inp = document.getElementById('tpText');
      const text = (inp.value || '').trim();
      if (!text) return;
      try {
        const d = await API.call('/staff/trust/send', { text, anon: document.getElementById('tpAnon').checked });
        if (zaken) zaken.trust = d.trust;
        toast('🤝 '+T('pd.tp.sent','Vertrouwelijk verstuurd. Alleen RTG leest dit.'));
        renderHulp();
        openTab('hulp');
      } catch(e){ toast(e.message); }
    });
    const zb = document.getElementById('ziekBtn');
    if (zb) zb.addEventListener('click', async () => {
      if (!ziekArm){ ziekArm = true; renderHulp(); openTab('hulp'); return; }
      ziekArm = false;
      try {
        await API.call('/staff/leave/request', { soort: 'ziek' });
        toast('🤒 '+T('pd.ad.ziekok','Ziekmelding doorgegeven. Beterschap!'));
        await laadZaken(); renderHulp(); openTab('hulp');
      } catch(e){ toast(e.message); renderHulp(); }
    });
    const vg = document.getElementById('vlGo');
    if (vg) vg.addEventListener('click', async () => {
      const van = document.getElementById('vlVan').value, tot = document.getElementById('vlTot').value;
      if (!van || !tot){ toast(T('pd.ad.datum','Kies een begin- en einddatum.')); return; }
      try {
        await API.call('/staff/leave/request', { soort: 'verlof', van, tot, reden: document.getElementById('vlReden').value.trim() });
        toast('🌴 '+T('pd.ad.gevraagd','Verlof aangevraagd; de manager beslist in het Kantoor.'));
        await laadZaken(); renderHulp(); openTab('hulp');
      } catch(e){ toast(e.message); }
    });
    // De trainingskaart tekent zichzelf met Util.el (eigen handlers); vullen volstaat.
    vulTrainingKaart();
  }

  // Ritten: chauffeurs en crew van vervoerspartners (taxi en jet) werken hun
  // ritten volledig vanuit de zak af: nemen, stap voor stap rijden, verdiensten.
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond', 'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_LBL = { 'geaccepteerd':['pd.r.accept','Accepteer'], 'onderweg':['pd.r.go','Ik rijd'], 'aangekomen':['pd.r.atpickup','Ik sta voor'], 'aan-boord':['pd.r.board','Aan boord'], 'afgerond':['pd.r.done','Afronden'] };
  const RIT_ST = { 'aangevraagd':['pd.rs.new','nieuw'], 'geaccepteerd':['pd.rs.acc','geaccepteerd'], 'onderweg':['pd.rs.go','onderweg'], 'aangekomen':['pd.rs.at','staat voor'], 'aan-boord':['pd.rs.board','gast aan boord'], 'rijdt':['pd.rs.board','gast aan boord'] };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  const heeftRitten = () => !!(state && state.supplier && (state.supplier.caps || []).includes('rides'));
  function renderRitten(){
    const aan = heeftRitten();
    const tabBtn = document.getElementById('tabRitten');
    if (tabBtn) tabBtn.style.display = aan ? '' : 'none';
    const wrap = $('#rittenWrap');
    if (!aan){ if (wrap) wrap.innerHTML = ''; return; }
    const jet = state.supplier && state.supplier.type === 'jet';
    const ritten = state.rides || [];
    const mijn = ritten.filter(r => !RIT_KLAAR(r.status) && r.driver && r.driver.staffId === me.staffId);
    const straks = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
    const alleOpen = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
    const open = alleOpen.filter(r => !straks(r));
    const gepland = alleOpen.filter(straks);
    const vandaag = new Date().toISOString().slice(0, 10);
    const klaar = ritten.filter(r => (r.status === 'afgerond' || r.status === 'gearriveerd') && r.driver && r.driver.staffId === me.staffId && String(r.finishedAt || r.at).slice(0, 10) === vandaag);
    const omzet = klaar.reduce((s, r) => s + (r.quote || 0), 0);
    const regel = r => (r.from || '') + ' → ' + (r.to || T('pd.r.opendest','open bestemming')) + (r.passengers ? ' · ' + r.passengers + 'p' : '') + (r.quote ? ' · ' + eur(r.quote) : '');
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.r.mijn','Uw rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(r => {
        const nxt = NEXT_RIDE[r.status];
        const st = RIT_ST[r.status];
        return '<div class="task"><span class="ic">'+(jet?'✈️':'🚗')+'</span><div class="t"><b>'+esc(r.customerCodename)+(st?' · '+T(st[0], st[1]):'')+'</b><span>'+esc(regel(r))+(r.note?' · 📝 '+esc(r.note):'')+(r.zorg?'<span style="display:block;color:#E2B93B;">⚠ '+esc(pkZorg(r.zorg))+'</span>':'')+'</span></div>'+
          (nxt ? '<button class="abtn" data-pdgo="'+r.ref+'" data-st="'+nxt+'">'+T(RIDE_LBL[nxt][0], RIDE_LBL[nxt][1])+'</button>' : '')+'</div>';
      }).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.r.geen','Geen actieve rit. Neem hieronder een open rit aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.r.openh','Open aanvragen')+' ('+open.length+')</div>'+
      (open.length ? open.map(r =>
        '<div class="task"><span class="ic">🔔</span><div class="t"><b>'+esc(r.customerCodename)+'</b><span>'+esc(regel(r))+'</span></div><button class="abtn" data-pdneem="'+r.ref+'">'+T('pd.r.neem','Neem')+'</button></div>'
      ).join('') : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.r.geenopen','Geen open aanvragen. Nieuwe ritten verschijnen hier vanzelf.')+'</div>')+'</div>'+
      (gepland.length ? '<div class="card"><div class="k">'+T('pd.r.gepland','Gepland')+' ('+gepland.length+')</div>'+
        gepland.map(r => '<div class="task"><span class="ic">📅</span><div class="t"><b>'+esc(r.customerCodename)+'</b><span>'+esc((r.when || '') + ' · ' + regel(r))+'</span></div><button class="abtn" data-pdneem="'+r.ref+'">'+T('pd.r.neem','Neem')+'</button></div>').join('')+'</div>' : '')+
      '<div class="card"><div class="k">'+T('pd.r.vandaag','Vandaag')+'</div>'+
      '<div class="task"><span class="ic">💶</span><div class="t"><b>'+klaar.length+' '+T('pd.r.klaar','rit(ten) afgerond')+' · '+eur(omzet)+'</b><span>'+T('pd.r.netto','Volledig voor de zaak: RTG rekent 0% commissie.')+'</span></div></div></div>';
    document.querySelectorAll('[data-pdgo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/ride/status', { ref: b.dataset.pdgo, status: b.dataset.st }); await refresh(); openTab('ritten'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-pdneem]').forEach(b => b.addEventListener('click', async () => {
      try {
        const s = await API.call('/supplier/ride/suggest', { ref: b.dataset.pdneem });
        await API.call('/supplier/ride/assign', { ref: b.dataset.pdneem, self: true, vehicleId: s.vehicleId });
        toast(T('pd.r.genomen','De rit is van u.') + (s.vehicleName ? ' · ' + s.vehicleName : ''));
        await refresh(); openTab('ritten');
      } catch(e){ toast(e.message); }
    }));
  }

  /* ---- bezorgen: ritten op naam, GPS, navigatie en AI-hulp ---- */
  let gpsWatch = null, gpsLaatst = 0, gpsPos = null;
  const heeftBezorg = () => !!(state && state.bezorg && state.bezorg.bezorgen);
  function kaartLink(o){
    if (o.geo && Number.isFinite(o.geo.lat)) return 'https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=' + o.geo.lat + ',' + o.geo.lng;
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(o.adres || '');
  }
  function afstandNaar(o){
    if (!gpsPos || !o.geo || !Number.isFinite(o.geo.lat)) return null;
    const R = 6371000, rad = d => d * Math.PI / 180;
    const dLat = rad(o.geo.lat - gpsPos.lat), dLng = rad(o.geo.lng - gpsPos.lng);
    const a = Math.sin(dLat/2)**2 + Math.cos(rad(gpsPos.lat)) * Math.cos(rad(o.geo.lat)) * Math.sin(dLng/2)**2;
    return Math.round(2 * R * Math.asin(Math.sqrt(a)));
  }
  async function gpsStuur(lat, lng){
    if (Date.now() - gpsLaatst < 8000) return; // hooguit elke 8 s naar de server
    gpsLaatst = Date.now();
    try { await API.call('/supplier/bezorg/gps', { lat, lng }); } catch(e){}
  }
  function gpsAanUit(){
    if (gpsWatch != null){ navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; renderBezorgen(); return; }
    if (!navigator.geolocation){ toast(T('pd.bz.geengps','Dit apparaat deelt geen GPS.')); return; }
    gpsWatch = navigator.geolocation.watchPosition(p => {
      gpsPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      gpsStuur(gpsPos.lat, gpsPos.lng);
    }, () => toast(T('pd.bz.gpsfout','GPS staat uit of is geweigerd.')), { enableHighAccuracy: true, maximumAge: 5000 });
    renderBezorgen();
  }
  function renderBezorgen(){
    const tabBtn = document.getElementById('tabBezorgen');
    if (tabBtn) tabBtn.style.display = heeftBezorg() ? '' : 'none';
    const wrap = $('#bezorgenWrap');
    if (!wrap) return;
    if (!heeftBezorg()){ wrap.innerHTML = ''; return; }
    const alle = (state.bezorg && state.bezorg.lopend) || [];
    const mijn = alle.filter(o => o.levering === 'bezorgen' && o.bezorger && o.bezorger.staffId === me.staffId && !['bezorgd','opgehaald'].includes(o.status));

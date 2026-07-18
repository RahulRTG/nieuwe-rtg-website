  function laadGastLoc(){
    if (gastLocBezig || Date.now() - gastLocAt < 15000) return;
    gastLocBezig = true;
    API.call('/supplier/gastlocaties', {})
      .then(d => { gastLoc = d.gasten || []; gastLocAt = Date.now(); gastLocBezig = false; renderGasten(); })
      .catch(() => { gastLoc = gastLoc || []; gastLocAt = Date.now(); gastLocBezig = false; });
  }
  function gastLocBlok(){
    const lijst = gastLoc || [];
    return '<div class="card"><div class="tt-h">📍 '+T('gl.h','Live meekijken (met toestemming)')+'</div>'+
      '<div style="font-size:0.75rem;color:var(--soft);margin-bottom:0.5rem;">'+T('gl.sub','De gast deelt zelf de live gps-locatie met uw zaak. Zet het uit zodra u het niet meer nodig heeft; de gast krijgt daar direct bericht van.')+'</div>'+
      (lijst.length ? lijst.map(g =>
        '<div class="guest-row" style="flex-wrap:wrap;gap:0.4rem;"><span class="cn">'+esc(g.codenaam)+'</span>'+
        (g.wachtOpLocatie ? '<span class="ge">'+T('gl.wacht','toestemming, wacht op gps')+'</span>'
          : '<span class="ge"><b>'+(g.km!=null?g.km+' km':'')+'</b>'+(g.etaMin!=null?' · ~'+g.etaMin+' min':'')+'</span>')+
        '<button class="obtn" data-glstop="'+g.id+'" style="font-size:0.62rem;">'+T('gl.stop','Niet meer nodig')+'</button>'+
        (g.zorg ? '<div style="flex-basis:100%;font-size:0.74rem;color:#E2B93B;">⚠ '+esc(zorgTekst(g.zorg))+'</div>' : '')+
        '</div>').join('')
      : '<div class="softline">'+T('gl.leeg','Nog geen gasten die hun locatie met u delen.')+'</div>')+'</div>';
  }
  function bindGastLoc(el){
    el.querySelectorAll('[data-glstop]').forEach(b => b.addEventListener('click', async () => {
      try {
        const r = await API.call('/supplier/gastlocatie/stop', { id: b.dataset.glstop });
        toast('📍 '+T('gl.gestopt','Meekijken gestopt;')+' '+r.deel.codenaam+' '+T('gl.gestopt2','heeft bericht gekregen.'));
        gastLocAt = 0; laadGastLoc();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderGasten(){
    const el = $('#gastenWrap'); if (!el) return;
    laadGastLoc();
    if (!has('bookings')){ el.innerHTML = gastLocBlok(); bindGastLoc(el); return; }
    const guests = state.guests || [];
    const nearby = state.nearbyGuests || [];

    // kaartje: het eigen pand + verbonden gasten met positie
    const pts = [];
    if (S.loc) pts.push({ lat:S.loc.lat, lng:S.loc.lng, me:true });
    guests.forEach(g => { if (g.loc) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codename }); });
    // gasten die met toestemming live meekijken laten, staan ook op de kaart
    (gastLoc || []).forEach(g => { if (g.loc && !pts.some(p => p.name === g.codenaam)) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codenaam }); });
    let map = '';
    if (pts.length > 1){
      const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
      let minLat=Math.min(...lats), maxLat=Math.max(...lats), minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
      let dLat=(maxLat-minLat)||0.002, dLng=(maxLng-minLng)||0.002;
      minLat-=dLat*0.2; maxLat+=dLat*0.2; minLng-=dLng*0.2; maxLng+=dLng*0.2;
      dLat=maxLat-minLat; dLng=maxLng-minLng;
      map = '<div class="gmap">'+pts.map(p=>{
        const x=((p.lng-minLng)/dLng)*100, y=(1-(p.lat-minLat)/dLat)*100;
        return '<div class="mk" style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;">'+
          (p.me?'<div>'+S.icon+'</div>':'<div class="gpin"></div>')+
          '<div class="lbl">'+(p.me?S.name.split(' ')[0]:p.name)+'</div></div>';
      }).join('')+'</div>';
    }

    let html = gastLocBlok();
    html += '<div class="card"><div class="tt-h">'+T('gst.connected','Verbonden gasten')+'</div>'+map+
      (guests.length ? guests.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>'
          : g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>'
          : '<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>')+'</div>'
      ).join('') : '<div class="softline">'+T('gst.none','Nog geen verbonden gasten.')+'</div>')+'</div>';

    html += '<div class="card"><div class="tt-h">'+T('gst.nearby','Nu onderweg (nog niet verbonden)')+'</div>'+
      (nearby.length ? nearby.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        '<div style="display:flex;align-items:center;gap:0.6rem;">'+(g.dest?'<span class="ge">'+T('gst.to','naar')+' '+g.dest+'</span>':'')+
        '<button class="obtn primary" data-connect="'+g.codename.replace(/"/g,'&quot;')+'">'+T('gst.connect','Verbind')+'</button></div></div>'
      ).join('') : '<div class="softline">'+T('gst.nonearby','Er is nu niemand live onderweg.')+'</div>')+
      '<div class="note-soft">'+T('gst.note','Verbinden meldt het bij de gast: u volgt de aankomst om alles klaar te zetten. U ziet daarna live de positie en aankomsttijd.')+'</div></div>';

    el.innerHTML = html;
    bindGastLoc(el);
    el.querySelectorAll('[data-connect]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/guest/connect', { codename: b.dataset.connect }); toast(T('gst.done','Verbonden. De gast is op de hoogte.')); await refresh(); openTab('gasten'); }
      catch(e){ toast(e.message); }
    }));
  }

  // ---- gastchat: berichten van gasten beantwoorden ----
  let gchatKey = null; // open gesprek

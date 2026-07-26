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
    const vrij = alle.filter(o => o.levering === 'bezorgen' && !o.bezorger);
    const mijnKlaar = mijn.filter(o => o.status === 'klaar').map(o => o.ref);
    const rij = (o, extra) => {
      const m = afstandNaar(o);
      return '<div class="task"><span class="ic">'+(o.status==='onderweg'?'\uD83D\uDEF5':'\uD83D\uDCE6')+'</span><div class="t">'+
        '<b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+(o.etaMin?' \u00B7 '+o.etaMin+' min':'')+'</b>'+
        '<span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+(m!=null?' \u00B7 '+(m<1000?m+' m':(m/1000).toFixed(1)+' km'):'')+'</span>'+
        '<span><a href="'+kaartLink(o)+'" target="_blank" rel="noopener" style="color:var(--gold);text-decoration:none;">\uD83D\uDDFA\uFE0F '+T('pd.bz.nav','Navigeer')+'</a></span></div>'+(extra||'')+'</div>';
    };
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.bz.gps','Live GPS')+'</div>'+
      '<div class="task"><span class="ic">\uD83D\uDEF0\uFE0F</span><div class="t"><b>'+(gpsWatch!=null?T('pd.bz.gpsaan','U deelt uw positie; de klant ziet u rijden.'):T('pd.bz.gpsuit','GPS staat uit.'))+'</b>'+
      '<span>'+T('pd.bz.gpsuitleg','Alleen tijdens uw rit; stopt zodra u hem uitzet.')+'</span></div>'+
      '<button class="abtn" id="pdGps">'+(gpsWatch!=null?T('pd.bz.stop','Stop'):T('pd.bz.start','Start'))+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.bz.mijn','Mijn rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(o => rij(o,
          o.status==='onderweg' ? '<button class="abtn" data-pdbz="'+o.ref+'" data-st="bezorgd">'+T('pd.bz.bezorgd','Bezorgd')+'</button>' : ''
        )).join('') +
        (mijnKlaar.length ? '<button class="abtn" id="pdVertrek" style="margin-top:0.6rem;">\uD83D\uDEF5 '+T('pd.bz.vertrek','Vertrek')+' ('+mijnKlaar.length+')</button>' : '')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenmijn','Geen rit op uw naam. Neem hieronder leveringen aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.vrij','Klaar om mee te nemen')+' ('+vrij.length+')</div>'+
      (vrij.length ? vrij.map(o =>
        '<label class="task" style="cursor:pointer;"><input type="checkbox" class="pdbzkies" value="'+o.ref+'" style="margin-right:0.4rem;accent-color:var(--gold);"'+(o.status==='klaar'?'':' ')+'>'+
        '<div class="t"><b>'+esc(o.customerCodename)+' \u00B7 '+esc(o.status)+'</b><span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' \u00B7 \uD83D\uDCCD '+esc(o.adres||'')+'</span></div></label>'
      ).join('') + '<button class="abtn" id="pdNeem" style="margin-top:0.6rem;">'+T('pd.bz.neem','Neem geselecteerde ritten (op uw naam)')+'</button>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenvrij','Niets klaar om mee te nemen. Nieuwe leveringen verschijnen hier live.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.ai','Snelle hulp (AI)')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      [[T('pd.bz.ai1','Adres klopt niet'),'Het bezorgadres lijkt niet te kloppen, wat doe ik?'],
       [T('pd.bz.ai2','Gast doet niet open'),'De gast doet niet open bij de bezorging, wat doe ik?'],
       [T('pd.bz.ai3','Ik heb vertraging'),'Ik heb vertraging met de bezorging, wat doe ik?'],
       [T('pd.bz.ai4','Bestelling beschadigd'),'De bestelling is onderweg beschadigd, wat doe ik?']]
      .map(c => '<button class="abtn" data-pdbzai="'+esc(c[1])+'">'+c[0]+'</button>').join('')+'</div>'+
      '<div id="pdBzAiUit" style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);"></div></div>';
    const g = document.getElementById('pdGps'); if (g) g.addEventListener('click', gpsAanUit);
    const v = document.getElementById('pdVertrek'); if (v) v.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { refs: mijnKlaar, status: 'onderweg' }); if (gpsWatch == null) gpsAanUit(); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    const n = document.getElementById('pdNeem'); if (n) n.addEventListener('click', async () => {
      const refs = [...document.querySelectorAll('.pdbzkies:checked')].map(x => x.value);
      if (!refs.length) { toast(T('pd.bz.kies','Vink eerst een of meer leveringen aan.')); return; }
      try { const r = await API.call('/supplier/bezorg/neem', { refs }); toast(r.genomen.length + ' ' + T('pd.bz.opnaam','rit(ten) op uw naam.')); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-pdbz]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/bezorg/status', { ref: b.dataset.pdbz, status: b.dataset.st }); await refresh(); openTab('bezorgen'); } catch(e){ toast(e.message); }
    }));

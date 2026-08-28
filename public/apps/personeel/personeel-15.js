/* de afstand tot een opdracht, uit GPS */
    if (!gpsPos || !o.geo || !Number.isFinite(o.geo.lat)) return null;
    return meters(gpsPos, o.geo);
  }
  function meters(a, b){
    const R = 6371000, rad = d => d * Math.PI / 180;
    const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
    const x = Math.sin(dLat/2)**2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng/2)**2;
    return Math.round(2 * R * Math.asin(Math.sqrt(x)));
  }
  async function gpsStuur(lat, lng){
    if (Date.now() - gpsLaatst < 8000) return; // hooguit elke 8 s naar de server
    gpsLaatst = Date.now();
    try { await API.call('/supplier/bezorg/gps', { lat, lng }); } catch(e){}
  }
  const zaakLoc = () => (state && state.supplier && state.supplier.loc) || null;
  let terugBezig = false;
  async function autoTerug(){
    // de GPS gaat vanzelf uit zodra de bezorger zonder open rit weer bij de zaak is
    const zl = zaakLoc();
    if (gpsWatch == null || terugBezig || !zl || !gpsPos || !Number.isFinite(zl.lat)) return;
    const nogWeg = ((state.bezorg && state.bezorg.lopend) || []).some(o => o.status === 'onderweg' && o.bezorger && o.bezorger.staffId === me.staffId);
    if (nogWeg || meters(gpsPos, zl) > 60) return;
    terugBezig = true;
    try { await API.call('/supplier/bezorg/terug', {}); } catch(e){}
    navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; window.__pdRoute = null;
    toast(T('pd.bz.terug','Terug op de zaak; de GPS staat weer uit.'));
    terugBezig = false;
    renderBezorgen();
  }
  function gpsAanUit(){
    if (gpsWatch != null){ navigator.geolocation.clearWatch(gpsWatch); gpsWatch = null; renderBezorgen(); return; }
    if (!navigator.geolocation){ toast(T('pd.bz.geengps','Dit apparaat deelt geen GPS.')); return; }
    gpsWatch = navigator.geolocation.watchPosition(p => {
      gpsPos = { lat: p.coords.latitude, lng: p.coords.longitude };
      gpsStuur(gpsPos.lat, gpsPos.lng);
      autoTerug();
    }, () => toast(T('pd.bz.gpsfout','GPS staat uit of is geweigerd.')), { enableHighAccuracy: true, maximumAge: 5000 });
    renderBezorgen();
  }
  const VOERTUIGEN = [['auto','Auto'],['motor','Motor'],['scooter','Scooter'],['fatbike','Fatbike/e-bike'],['lopen','Lopen']];
  const voertuig = () => { try { return localStorage.getItem('pd_voertuig') || 'auto'; } catch(e){ return 'auto'; } };
  function renderBezorgen(){
    const tabBtn = document.getElementById('tabBezorgen');
    if (tabBtn) tabBtn.style.display = heeftBezorg() ? '' : 'none';
    const wrap = $('#bezorgenWrap');
    if (!wrap) return;
    if (!heeftBezorg()){ wrap.innerHTML = ''; return; }
    const alle = (state.bezorg && state.bezorg.lopend) || [];
    const mijn = alle.filter(o => o.levering === 'bezorgen' && o.bezorger && o.bezorger.staffId === me.staffId && !['bezorgd','opgehaald'].includes(o.status));
    const vrij = alle.filter(o => o.levering === 'bezorgen' && !o.bezorger);
    const inpakLijst = alle.filter(o => o.levering === 'bezorgen' && !o.inpak && !['onderweg','bezorgd','opgehaald'].includes(o.status));
    const mijnKlaar = mijn.filter(o => o.status === 'klaar');
    const tePakken = mijnKlaar.filter(o => o.inpak && !o.pakcheck).map(o => o.ref);
    const teVertrekken = mijnKlaar.filter(o => o.inpak && o.pakcheck).map(o => o.ref);
    const rt = window.__pdRoute;
    const rij = (o, extra) => {
      const m = afstandNaar(o);
      const keten = (o.inpak ? '✓ ' + T('pd.bz.tasje','tas') + ' ' + esc(o.inpak.tas) : T('pd.bz.wachtinpak','wacht op de inpakker')) +
        ' · ' + (o.pakcheck ? '✓ ' + T('pd.bz.gepakt','gepakt') : T('pd.bz.noggepakt','nog afvinken'));
      return '<div class="task"><div class="t">'+
        '<b>'+esc(o.customerCodename)+' · '+esc(o.status)+(o.etaMin?' · '+o.etaMin+' min':'')+'</b>'+
        '<span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' · '+esc(o.adres||'')+(m!=null?' · '+(m<1000?m+' m':(m/1000).toFixed(1)+' km'):'')+'</span>'+
        '<span style="color:var(--soft);">'+keten+'</span>'+
        '<span><a href="'+kaartLink(o)+'" target="_blank" rel="noopener" style="color:var(--rtg-leesgoud,var(--gold));text-decoration:none;">'+T('pd.bz.nav','Navigeer')+'</a></span></div>'+(extra||'')+'</div>';
    };
    wrap.innerHTML =
      '<div class="card"><div class="k">'+T('pd.bz.gps','Live GPS')+'</div>'+
      '<div class="task"><div class="t"><b>'+(gpsWatch!=null?T('pd.bz.gpsaan','U deelt uw positie; de klant ziet u rijden.'):T('pd.bz.gpsuit','GPS staat uit.'))+'</b>'+
      '<span>'+T('pd.bz.gpsauto','Gaat vanzelf aan zodra u vertrekt en vanzelf uit zodra u terug bent op de zaak.')+'</span></div>'+
      '<button class="abtn" id="pdGps">'+(gpsWatch!=null?T('pd.bz.stop','Stop'):T('pd.bz.start','Start'))+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.bz.inpak','Inpakken: afvinken per tas en bonnummer')+'</div>'+
      (inpakLijst.length ? inpakLijst.map(o =>
        '<div class="task" style="flex-direction:column;align-items:stretch;gap:0.25rem;" data-inpak="'+o.ref+'">'+
        '<b>'+esc(o.customerCodename)+' · '+T('pd.bz.bonnr','bon')+' '+o.ref+'</b>'+
        o.items.map(i=>'<label style="display:block;font-size:0.82rem;cursor:pointer;"><input type="checkbox" class="ipItem" value="'+esc(i.id)+'" style="accent-color:var(--gold);margin-right:0.25rem;">'+i.qty+'x '+esc(i.name)+'</label>').join('')+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+
        '<input class="ipTas" placeholder="'+T('pd.bz.tas','Welke tas? (bv. tas 2)')+'" style="flex:1;min-width:6rem;background:transparent;border:1px solid var(--line);border-radius:0;color:inherit;font:inherit;font-size:0.82rem;padding:0.35rem 0.5rem;">'+
        '<input class="ipBon" placeholder="'+T('pd.bz.bon','Typ het bonnummer')+'" style="flex:1;min-width:7rem;background:transparent;border:1px solid var(--line);border-radius:0;color:inherit;font:inherit;font-size:0.82rem;padding:0.35rem 0.5rem;">'+
        '<button class="abtn ipKlaar">'+T('pd.bz.ingepakt','Alles zit erin')+'</button></div></div>').join('')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geeninpak','Niets om in te pakken; nieuwe bestellingen verschijnen hier.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.mijn','Mijn rit')+' ('+mijn.length+')</div>'+
      (mijn.length ? mijn.map(o => rij(o,
          o.status==='onderweg' ? '<button class="abtn" data-pdbz="'+o.ref+'" data-st="bezorgd">'+T('pd.bz.bezorgd','Bezorgd')+'</button>' : ''
        )).join('') +
        '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        VOERTUIGEN.map(v => '<button class="abtn" data-vt="'+v[0]+'"'+(voertuig()===v[0]?' style="border-color:var(--gold);color:var(--gold);"':'')+'>'+T('pd.bz.vt.'+v[0], v[1])+'</button>').join('')+'</div>'+
        (tePakken.length ? '<button class="abtn h-mt50" id="pdPakcheck">'+T('pd.bz.pakcheck','Ik heb alles gepakt')+' ('+tePakken.length+')</button>' : '')+
        (teVertrekken.length ? '<button class="abtn h-mt50" id="pdVertrek">'+T('pd.bz.vertrek','Ik ga rijden')+' ('+teVertrekken.length+')</button>' : '')+
        (rt && rt.stops ? '<div style="margin-top:0.55rem;font-size:0.82rem;"><b>'+T('pd.bz.route','Beste route')+' ('+T('pd.bz.vt.'+rt.voertuig, rt.voertuig)+' · '+rt.totaal.minuten+' min)</b>'+
          rt.stops.map((s2,i2) => '<div>'+(i2+1)+'. '+esc(s2.adres||s2.ref)+' · '+s2.minuten+' min · <a href="'+s2.nav+'" target="_blank" rel="noopener" style="color:var(--rtg-leesgoud,var(--gold));text-decoration:none;">'+T('pd.bz.nav','Navigeer')+'</a></div>').join('')+'</div>' : '')
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenmijn','Geen rit op uw naam. Neem hieronder leveringen aan.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.vrij','Klaar om mee te nemen')+' ('+vrij.length+')</div>'+
      (vrij.length ? vrij.map(o =>
        '<label class="task" style="cursor:pointer;"><input type="checkbox" class="pdbzkies" value="'+o.ref+'" style="margin-right:0.5rem;accent-color:var(--gold);">'+
        '<div class="t"><b>'+esc(o.customerCodename)+' · '+esc(o.status)+(o.inpak?' · ✓ '+T('pd.bz.tasje','tas')+' '+esc(o.inpak.tas):'')+'</b><span>'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+' · '+esc(o.adres||'')+'</span></div></label>'
      ).join('') + '<button class="abtn h-mt60" id="pdNeem">'+T('pd.bz.neem','Neem geselecteerde ritten (op uw naam)')+'</button>'
        : '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--soft);">'+T('pd.bz.geenvrij','Niets klaar om mee te nemen. Nieuwe leveringen verschijnen hier live.')+'</div>')+'</div>'+
      '<div class="card"><div class="k">'+T('pd.bz.ai','Snelle hulp (AI)')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      [[T('pd.bz.ai1','Adres klopt niet'),'Het bezorgadres lijkt niet te kloppen, wat doe ik?'],
       [T('pd.bz.ai2','Gast doet niet open'),'De gast doet niet open bij de bezorging, wat doe ik?'],
       [T('pd.bz.ai3','Ik heb vertraging'),'Ik heb vertraging met de bezorging, wat doe ik?'],
       [T('pd.bz.ai4','Bestelling beschadigd'),'De bestelling is onderweg beschadigd, wat doe ik?']]
      .map(c => '<button class="abtn" data-pdbzai="'+esc(c[1])+'">'+c[0]+'</button>').join('')+'</div>'+
      '<div id="pdBzAiUit" style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);"></div></div>';

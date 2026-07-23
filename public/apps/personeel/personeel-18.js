    if (!heeftCharter()) return;
    try { pdCharters = (await API.call('/supplier/charter/overzicht', {})).charters; } catch(e){ pdCharters = []; }
    renderVaart();
  }
  function renderVaart(){
    const tabBtn = document.getElementById('tabVaart');
    if (tabBtn) tabBtn.style.display = heeftCharter() ? '' : 'none';
    const wrap = $('#vaartWrap');
    if (!wrap) return;
    if (!heeftCharter()){ wrap.innerHTML = ''; return; }
    if (!pdCharters){ wrap.innerHTML = '<div class="card">…</div>'; laadVaart(); return; }
    wrap.innerHTML = pdCharters.length ? pdCharters.map(c => {
      let knop = '';
      if (c.status === 'aangevraagd') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="voor">'+T('pd.va.voor','Voor-foto')+' ('+c.fotosVoor+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="lopend">'+T('pd.va.uitvaren','Uitvaren')+'</button>';
      else if (c.status === 'lopend') knop =
        '<button class="abtn ghost" data-cvfoto="'+c.ref+'" data-fase="na">'+T('pd.va.na','Na-foto')+' ('+c.fotosNa+')</button> '+
        '<button class="abtn" data-cvst="'+c.ref+'" data-st="afgerond">'+T('pd.va.terug','Teruggeven')+'</button>';
      return '<div class="card">'+
        (c.sos && c.sos.length ? '<div style="background:rgba(194,58,94,0.16);border:1px solid var(--burgundy,#C23A5E);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.5rem;font-size:0.82rem;"><b>SOS:</b> '+esc(c.sos[0].bericht)+
          (Number.isFinite(c.sos[0].lat)?' · <a style="color:var(--gold,#C99A2E);" target="_blank" rel="noopener" href="geo:'+c.sos[0].lat+','+c.sos[0].lng+'?q='+c.sos[0].lat+','+c.sos[0].lng+'">'+T('pd.va.kaart','kaart')+'</a>':'')+
          ' <button class="abtn" data-cvsosok="'+c.ref+'" style="padding:0.15rem 0.7rem;">'+T('pd.va.sosok','Afgehandeld')+'</button></div>':'')+
        '<div class="k">'+esc(c.boot)+' · '+esc(c.type)+'</div>'+
        '<div style="font-size:0.85rem;margin-top:0.3rem;">'+esc(c.codename)+' · '+c.van+' → '+c.tot+' · '+(c.gasten?c.gasten+' '+T('pd.va.gasten','gasten')+' · ':'')+(c.metSkipper?''+T('pd.va.metskipper','met schipper'):T('pd.va.bareboat','bareboat'))+' · '+T('pd.va.st.'+c.status, VAART_ST[c.status]||c.status)+'</div>'+
        (c.teruggave ? '<div style="font-size:0.8rem;margin-top:0.2rem;color:'+(c.teruggave.meerkosten>0?'var(--amber,#C99A2E)':'var(--green,#4C9A75)')+';">'+(c.teruggave.meerkosten>0?T('pd.va.meer','Meerkosten')+' '+eur(c.teruggave.meerkosten):'✓ '+T('pd.va.geenmeer','geen meerkosten'))+'</div>':'')+
        (knop?'<div style="margin-top:0.6rem;display:flex;gap:0.4rem;flex-wrap:wrap;">'+knop+'</div>':'')+
        '</div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--soft);font-size:0.85rem;">'+T('pd.va.geen','Geen charters vandaag.')+'</div>';
    wrap.querySelectorAll('[data-cvst]').forEach(b => b.addEventListener('click', async () => {
      const body = { ref: b.dataset.cvst, status: b.dataset.st };
      if (b.dataset.st === 'lopend'){
        const uren = prompt(T('pd.va.qurenstart','Motorurenstand bij uitvaren?')); if (uren == null) return;
        body.urenStart = Number(uren); body.brandstofStart = Number(prompt(T('pd.va.qbrandstart','Brandstof bij uitvaren in achtsten (8 = vol)?'), '8'));
      } else if (b.dataset.st === 'afgerond'){
        const uren = prompt(T('pd.va.qureneind','Motorurenstand bij teruggave?')); if (uren == null) return;
        body.urenEind = Number(uren); body.brandstofEind = Number(prompt(T('pd.va.qbrandeind','Brandstof bij teruggave in achtsten (8 = vol)?'), '8'));
      }
      try { await API.call('/supplier/charter/status', body); toast(T('pd.va.ok','Bijgewerkt.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvsosok]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/charter/sos-ok', { ref: b.dataset.cvsosok }); toast(T('pd.va.sosafg','SOS afgehandeld.')); await laadVaart(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-cvfoto]').forEach(b => b.addEventListener('click', () => {
      const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
      inp.onchange = () => { const file = inp.files[0]; if (!file) return; const r = new FileReader();
        r.onload = () => { const img = new Image(); img.onload = async () => {
          const cv = document.createElement('canvas'); const sc = Math.min(1, 1000 / Math.max(img.width, img.height));
          cv.width = img.width * sc; cv.height = img.height * sc; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
          try { await API.call('/supplier/charter/foto', { ref: b.dataset.cvfoto, fase: b.dataset.fase, foto: cv.toDataURL('image/jpeg', 0.7) });
            toast(T('pd.va.fotook','De staat is vastgelegd.')); await laadVaart(); } catch(e){ toast(e.message); } };
          img.src = r.result; };
        r.readAsDataURL(file); };
      inp.click();
    }));
  }

  // ---- autoverkoop op de PDA: proefritten inplannen/rijden en auto's afleveren ----
  let pdVerkoop = null;
  const heeftVerkoop = () => !!(state && state.supplier && state.supplier.type === 'verhuur');
  async function laadVerkoop(){
    if (!heeftVerkoop()) return;
    try { pdVerkoop = await API.call('/supplier/verkoop/overzicht', {}); } catch(e){ pdVerkoop = { pda: [] }; }
    renderVerkoop();
  }
  function renderVerkoop(){
    const tabBtn = document.getElementById('tabVerkoop');
    if (tabBtn) tabBtn.style.display = (heeftVerkoop() && pdVerkoop && pdVerkoop.aan) ? '' : 'none';
    const wrap = $('#verkoopWrap'); if (!wrap) return;
    if (!heeftVerkoop()){ wrap.innerHTML = ''; return; }
    if (!pdVerkoop){ wrap.innerHTML = '<div class="card">…</div>'; laadVerkoop(); return; }
    const lijst = pdVerkoop.pda || [];
    wrap.innerHTML = lijst.length ? lijst.map(d => {
      const koop = d.soort === 'koop';
      const knop = koop
        ? '<button class="abtn" data-vkaf="'+d.ref+'">'+T('pd.vk.aflever','Afgeleverd')+'</button>'
        : '<button class="abtn" data-vkgereden="'+d.ref+'">'+T('pd.vk.gereden','Proefrit gereden')+'</button>';
      return '<div class="card"><div class="k">'+(koop?'':'')+esc(d.autoNaam)+'</div>'+
        '<div style="font-size:0.85rem;margin-top:0.3rem;">'+esc(d.codenaam)+' · '+(koop
          ? (T('pd.vk.aflevering','aflevering')+(d.concierge?' · '+T('pd.vk.concierge','concierge')+' '+esc(d.adres||''):' · '+T('pd.vk.ophalen','ophalen'))+' · '+eur(d.prijs||0))
          : (T('pd.vk.proefrit','proefrit')+(d.moment?' · '+esc(d.moment):'')))+'</div>'+
        '<div style="margin-top:0.6rem;">'+knop+'</div></div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--soft);font-size:0.85rem;">'+T('pd.vk.geen','Niets in te plannen of af te leveren.')+'</div>';
    wrap.querySelectorAll('[data-vkgereden]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkgereden, actie:'gereden' }); toast(T('pd.vk.ok','Bijgewerkt.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vkaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkaf, actie:'afgeleverd' }); toast(''+T('pd.vk.afgeleverd','Afgeleverd.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---- PDA beveiliging: mijn dienst, inklokken, rondes, incidenten, SOS ---- */
  let pdBev = null;
  const heeftBeveiliging = () => !!(state && state.supplier && state.supplier.type === 'beveiliging');
  function bevPos(cb){ // GPS met korte time-out en veilige terugval
    let klaar = false; const fire = (lat, lng) => { if (klaar) return; klaar = true; cb(lat, lng); };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p => fire(p.coords.latitude, p.coords.longitude), () => fire(undefined, undefined), { timeout: 2500 });
      setTimeout(() => fire(undefined, undefined), 3000);
    } else fire(undefined, undefined);
  }
  async function laadBevPda(){
    if (!heeftBeveiliging()) return;
    try { pdBev = await API.call('/supplier/beveiliging/pda/diensten', {}); } catch(e){ pdBev = { diensten: [], ronde: null }; }
    renderBevPda();
  }
  function renderBevPda(){
    const tabBtn = document.getElementById('tabBevPda');
    if (tabBtn) tabBtn.style.display = heeftBeveiliging() ? '' : 'none';
    const wrap = $('#bevPdaWrap'); if (!wrap) return;
    if (!heeftBeveiliging()){ wrap.innerHTML = ''; return; }
    if (!pdBev){ wrap.innerHTML = '<div class="card">…</div>'; laadBevPda(); return; }
    const ds = pdBev.diensten || [];
    let h = '';
    // 1) SOS-noodknop, altijd bovenaan
    h += '<button class="abtn" id="bevSosBtn" style="width:100%;background:var(--rood);color:#fff;font-size:1rem;padding:0.8rem;margin-bottom:0.8rem;">'+T('pd.bev.sos','SOS · noodknop')+'</button>';
    // 2) lopende ronde
    if (pdBev.ronde){

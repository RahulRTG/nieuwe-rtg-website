
  // ---- vracht & expeditie: internationale zendingen over lucht, water en land ----
  /* Zonder pictogrammen: de gedeelde themalaag houdt lopende tekst bewust
     zakelijk (emoticons worden eruit geveegd), dus hier alleen woorden. */
  const VR_MOD = {
    lucht:       { label:'Lucht' },
    zee:         { label:'Zee' },
    binnenvaart: { label:'Binnenvaart' },
    weg:         { label:'Weg' },
    spoor:       { label:'Spoor' }
  };
  const VR_STATUS = { onderweg:'onderweg', douane:'bij de douane', aangekomen:'aangekomen', afgeleverd:'afgeleverd' };
  let vrEtappes = [{ modaliteit:'weg', van:'', naar:'' }];

  function vrModOpties(gekozen){
    return Object.keys(VR_MOD).map(k => '<option value="'+k+'"'+(k===gekozen?' selected':'')+'>'+T('vr.mod.'+k, VR_MOD[k].label)+'</option>').join('');
  }
  function vrEtappeRijen(){
    return vrEtappes.map((e,i) =>
      '<div class="row-gap" style="margin-top:0.35rem;align-items:center;">'+
      '<select class="st-in js-vrmod" data-i="'+i+'" style="flex:0 0 9rem;">'+vrModOpties(e.modaliteit)+'</select>'+
      '<input class="st-in js-vrvan" data-i="'+i+'" placeholder="'+T('vr.et.van','Van (haven, airport, depot)')+'" value="'+escAttr(e.van)+'" maxlength="60" style="flex:1;">'+
      '<input class="st-in js-vrnaar" data-i="'+i+'" placeholder="'+T('vr.et.naar','Naar')+'" value="'+escAttr(e.naar)+'" maxlength="60" style="flex:1;">'+
      (vrEtappes.length>1 ? '<button class="js-vretweg" data-i="'+i+'" aria-label="'+T('vr.et.weg','Etappe weghalen')+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.35rem 0.6rem;color:var(--soft);font-family:inherit;">✕</button>' : '')+
      '</div>').join('');
  }
  function vrTijdlijn(z){
    return '<div style="display:flex;flex-wrap:wrap;gap:0.35rem;margin-top:0.45rem;">'+z.etappes.map(e => {
      const stijl = e.status==='bezig' ? 'border-color:var(--gold);background:rgba(201,162,75,0.12);' : e.status==='klaar' ? 'opacity:0.6;' : 'opacity:0.85;';
      return '<span title="'+escAttr(e.document)+'" style="border:1px solid var(--line);'+stijl+'border-radius:999px;padding:0.2rem 0.6rem;font-size:0.72rem;">'+
        T('vr.mod.'+e.modaliteit, VR_MOD[e.modaliteit].label)+' · '+esc(e.van)+' → '+esc(e.naar)+(e.status==='klaar'?' · '+T('vr.et.klaar','klaar'):e.status==='bezig'?' · '+T('vr.et.nu','nu'):'')+'</span>';
    }).join('')+'</div>';
  }
  function vrKaart(z){
    const docs = z.etappes.map(e => esc(e.document)).filter((v,i,a)=>a.indexOf(v)===i).join(' · ');
    let acties = '';
    if (z.status==='onderweg') acties += '<button data-vret="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.etklaar','Etappe klaar')+'</button>';
    if (z.status==='douane') acties += '<button data-vrdouane="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.douane','Douane heeft ingeklaard')+'</button>';
    if (z.status==='aangekomen') acties += '<button data-vraf="'+z.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.4rem;font-weight:600;font-family:inherit;font-size:0.75rem;">'+T('vr.afleveren','Afleveren')+'</button>';
    if (z.status!=='afgeleverd') acties += '<button data-vrmeld="'+z.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--soft);font-family:inherit;font-size:0.75rem;">'+T('vr.melding','Melding')+'</button>';
    return '<div style="border:1px solid '+(z.status==='afgeleverd'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.7rem 0.85rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(z.ref)+' · '+esc(z.klant)+'</b>'+
      '<span style="border:1px solid var(--line);border-radius:999px;padding:0.1rem 0.55rem;font-size:0.7rem;">'+esc(T('vr.st.'+z.status, VR_STATUS[z.status]||z.status))+'</span></div>'+
      '<div class="sub">'+esc(z.inhoud)+' · '+z.gewichtKg.toLocaleString('nl-NL')+' kg · '+z.colli+' colli · '+esc(z.incoterm)+'</div>'+
      '<div class="sub">'+esc(z.van.plaats)+' ('+esc(z.van.land)+') → '+esc(z.naar.plaats)+' ('+esc(z.naar.land)+') · ETA '+esc(z.eta)+'</div>'+
      vrTijdlijn(z)+
      '<div class="sub" style="margin-top:0.4rem;">'+T('vr.docs','Documenten')+': '+docs+' · '+T('vr.volgcode','volgcode voor de klant')+': <b>'+esc(z.volgcode)+'</b></div>'+
      (z.gebeurtenissen.length ? '<details style="margin-top:0.35rem;"><summary class="sub" style="cursor:pointer;">'+T('vr.logboek','Logboek')+' ('+z.gebeurtenissen.length+')</summary>'+
        z.gebeurtenissen.map(g=>'<div class="sub">'+new Date(g.at).toLocaleString('nl-NL')+' · '+esc(g.tekst)+'</div>').join('')+'</details>' : '')+
      (acties ? '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;flex-wrap:wrap;">'+acties+'</div>' : '')+'</div>';
  }

  async function renderVracht(){
    const el = $('#vrWrap'); if (!el) return;
    if (!has('vracht')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/vracht'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.onderweg, T('vr.k.onderweg','onderweg')],[k.douane, T('vr.k.douane','bij douane')],[k.afgeleverd, T('vr.k.af','afgeleverd')],[k.kilosOnderweg.toLocaleString('nl-NL')+' kg', T('vr.k.kg','onderweg in kilo’s')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';
    h += '<div class="sub" style="margin-top:0.5rem;">'+T('vr.permod','Actieve etappes per modaliteit')+': '+Object.keys(VR_MOD).map(m=>T('vr.mod.'+m, VR_MOD[m].label)+' '+(k.perModaliteit[m]||0)).join(' · ')+'</div>';

    // nieuwe zending: klant, lading, herkomst/bestemming en de etappe-bouwer
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('vr.nieuw','Nieuwe zending')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><input id="vrKlant" class="st-in" placeholder="'+T('vr.klant','Klant')+'" maxlength="60" style="flex:2;"><input id="vrInhoud" class="st-in" placeholder="'+T('vr.inhoud','Wat gaat er mee (lading)')+'" maxlength="120" style="flex:3;"></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="vrGewicht" class="st-in" type="number" min="1" placeholder="'+T('vr.gewicht','Gewicht (kg)')+'" style="flex:1;"><input id="vrColli" class="st-in" type="number" min="1" placeholder="'+T('vr.colli','Colli')+'" style="flex:1;">'+
      '<select id="vrIncoterm" class="st-in" style="flex:1;">'+(d.incoterms||[]).map(t=>'<option'+(t==='DAP'?' selected':'')+'>'+t+'</option>').join('')+'</select></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="vrVanPlaats" class="st-in" placeholder="'+T('vr.vanplaats','Van: plaats')+'" maxlength="60" style="flex:1;"><input id="vrVanLand" class="st-in" placeholder="'+T('vr.vanland','Van: land')+'" maxlength="40" style="flex:1;"><input id="vrNaarPlaats" class="st-in" placeholder="'+T('vr.naarplaats','Naar: plaats')+'" maxlength="60" style="flex:1;"><input id="vrNaarLand" class="st-in" placeholder="'+T('vr.naarland','Naar: land')+'" maxlength="40" style="flex:1;"></div>'+
      '<div class="sub" style="margin-top:0.55rem;">'+T('vr.route','De route, etappe voor etappe; het juiste vervoersdocument (AWB, B/L, CMR, CIM, CMNI) regelt de app per etappe:')+'</div>'+
      '<div id="vrEtappes">'+vrEtappeRijen()+'</div>'+
      '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;">'+
      '<button id="vrEtPlus" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.78rem;">+ '+T('vr.etplus','Etappe')+'</button>'+
      '<button id="vrBoek" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('vr.boek','Zending boeken')+'</button></div></div>';

    // de zendingen zelf: lopend eerst, afgeleverd inklapbaar
    const lopend = d.zendingen.filter(z=>z.status!=='afgeleverd'), af = d.zendingen.filter(z=>z.status==='afgeleverd');
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('vr.lopend','Lopende zendingen')+'</div>';
    h += lopend.length ? lopend.map(vrKaart).join('') : '<p class="sub">'+T('vr.geen','Geen lopende zendingen.')+'</p>';
    if (af.length) h += '<details style="margin-top:0.6rem;"><summary class="sub" style="cursor:pointer;">'+T('vr.afgeleverd','Afgeleverd')+' ('+af.length+')</summary>'+af.map(vrKaart).join('')+'</details>';
    el.innerHTML = h;

    // de etappe-bouwer onthoudt wat er al getypt is voordat hij opnieuw tekent
    const leesEtappes = () => {
      el.querySelectorAll('.js-vrmod').forEach(x=>{ vrEtappes[+x.dataset.i].modaliteit = x.value; });
      el.querySelectorAll('.js-vrvan').forEach(x=>{ vrEtappes[+x.dataset.i].van = x.value; });
      el.querySelectorAll('.js-vrnaar').forEach(x=>{ vrEtappes[+x.dataset.i].naar = x.value; });
    };
    const bindEtWeg = () => { el.querySelectorAll('.js-vretweg').forEach(b => b.addEventListener('click', () => { leesEtappes(); vrEtappes.splice(+b.dataset.i,1); $('#vrEtappes').innerHTML = vrEtappeRijen(); bindEtWeg(); })); };
    bindEtWeg();
    const plus = el.querySelector('#vrEtPlus'); if (plus) plus.addEventListener('click', () => {
      leesEtappes();
      if (vrEtappes.length>=8) { toast(T('vr.max8','Tot 8 etappes per zending.')); return; }
      vrEtappes.push({ modaliteit:'weg', van:'', naar:'' }); $('#vrEtappes').innerHTML = vrEtappeRijen(); bindEtWeg();
    });
    const boek = el.querySelector('#vrBoek'); if (boek) boek.addEventListener('click', async () => {
      leesEtappes();
      try {
        await API.call('/supplier/vracht/maak', {
          klant: $('#vrKlant').value, inhoud: $('#vrInhoud').value, gewichtKg: $('#vrGewicht').value, colli: $('#vrColli').value,
          incoterm: $('#vrIncoterm').value,
          van: { plaats: $('#vrVanPlaats').value, land: $('#vrVanLand').value },
          naar: { plaats: $('#vrNaarPlaats').value, land: $('#vrNaarLand').value },
          etappes: vrEtappes
        });
        vrEtappes = [{ modaliteit:'weg', van:'', naar:'' }];
        toast(T('vr.geboekt','Zending geboekt; de eerste etappe loopt.')); renderVracht();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-vret]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/vracht/etappe', { id:b.dataset.vret }); renderVracht(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vrdouane]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/vracht/douane', { id:b.dataset.vrdouane }); renderVracht(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vraf]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/vracht/afleveren', { id:b.dataset.vraf }); toast('✅ '+T('vr.klaar','Afgeleverd en getekend.')); renderVracht(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vrmeld]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('vr.meldvraag','Korte melding voor het logboek (de klant ziet dit op de volgcode):')); if (!t) return;
      try { await API.call('/supplier/vracht/melding', { id:b.dataset.vrmeld, tekst:t }); renderVracht(); } catch(e){ toast(e.message); }
    }));
  }

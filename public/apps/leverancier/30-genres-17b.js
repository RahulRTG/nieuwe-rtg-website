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
    el.querySelectorAll('[data-vraf]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/vracht/afleveren', { id:b.dataset.vraf }); toast(''+T('vr.klaar','Afgeleverd en getekend.')); renderVracht(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-vrmeld]').forEach(b => b.addEventListener('click', async () => {
      const t = prompt(T('vr.meldvraag','Korte melding voor het logboek (de klant ziet dit op de volgcode):')); if (!t) return;
      try { await API.call('/supplier/vracht/melding', { id:b.dataset.vrmeld, tekst:t }); renderVracht(); } catch(e){ toast(e.message); }
    }));
  }


  // ---- de beauty-salon en barbier: stoelen, agenda en de walk-in rij ----
  function vzKnop(attr, id, tekst, goud){
    return '<button '+attr+'="'+id+'" style="'+(goud?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(goud?'font-weight:600;':'')+'">'+tekst+'</button>';
  }
  const vzGoud = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;';
  async function renderBeauty(){
    const el = $('#beautyWrap'); if (!el) return;
    if (!has('beauty')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/beauty'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.afsprakenVandaag, T('bs.k.af','afspraken vandaag')],[k.wachtenden, T('bs.k.wacht','in de wachtrij')],[k.inDeStoel, T('bs.k.stoel','in de stoel')],[eur(k.omzetVandaag), T('bs.k.omzet','omzet vandaag')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de agenda: behandeling op de juiste stoel, zonder dubbele bezetting
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('bs.agenda','De agenda')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><select id="bsBeh" class="st-in" style="flex:2;">'+d.behandelingen.map(b=>'<option value="'+b.id+'">'+esc(b.naam)+' · '+b.duurMin+' min · '+eur(b.prijs)+'</option>').join('')+'</select>'+
      '<select id="bsStoel" class="st-in" style="flex:2;">'+d.stoelen.map(s=>'<option value="'+s.id+'">'+esc(s.naam)+'</option>').join('')+'</select></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="bsNaam" class="st-in" placeholder="'+T('bs.naam','Op naam van')+'" maxlength="60" style="flex:2;"><input id="bsDatum" class="st-in" type="date" style="flex:1;"><input id="bsTijd" class="st-in" type="time" style="flex:1;">'+
      '<button id="bsBoek" style="flex:1;'+vzGoud+'">'+T('bs.boek','Boek')+'</button></div>'+
      ((d.afspraken||[]).length ? d.afspraken.slice(0,10).map(a=>'<div class="sub" style="margin-top:0.35rem;">'+esc(a.datum)+' '+esc(a.van)+' tot '+esc(a.tot)+' · '+esc(a.stoel)+' · '+esc(a.naam)+' · '+esc(a.behandeling)+' · '+eur(a.prijs)+' '+
        (a.status==='gepland'?vzKnop('data-bsk', a.id, T('bs.klaar','Klaar'), true)+' '+vzKnop('data-bsw', a.id, T('bs.weg','Weg')):'· '+esc(a.status))+'</div>').join('') : '<p class="sub" style="margin-top:0.4rem;">'+T('bs.geen','De agenda is nog leeg.')+'</p>')+'</div>';

    // de walk-in rij aan de deur
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('bs.rij','Walk-in wachtrij')+'</div>'+
      '<div class="row-gap"><input id="bsWNaam" class="st-in" placeholder="'+T('bs.rij.naam','Wie loopt er binnen')+'" maxlength="60" style="flex:2;"><select id="bsWBeh" class="st-in" style="flex:2;">'+d.behandelingen.map(b=>'<option value="'+b.id+'">'+esc(b.naam)+'</option>').join('')+'</select>'+
      '<button id="bsWalk" style="flex:1;'+vzGoud+'">'+T('bs.rij.in','In de rij')+'</button></div>';
    h += (d.wachtrij||[]).map(w=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 3rem;">nr '+w.nr+'</span><b style="flex:1;font-size:0.85rem;">'+esc(w.naam)+'</b><span class="sub">'+esc(w.behandeling)+' · '+esc(w.status)+'</span>'+
      (w.status==='wacht'?vzKnop('data-bswp', w.id, T('bs.rij.pak','In de stoel'), true):vzKnop('data-bswk', w.id, T('bs.klaar','Klaar'), true))+'</div>').join('') || '<p class="sub">'+T('bs.rij.leeg','Niemand in de rij; de deur staat open.')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderBeauty(); } catch(e){ toast(e.message); }
    }));
    const b1 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    b1('bsBoek', async () => { try { await API.call('/supplier/beauty/boek', { behandelingId: $('#bsBeh').value, stoelId: $('#bsStoel').value, naam: $('#bsNaam').value, datum: $('#bsDatum').value, tijd: $('#bsTijd').value }); toast(T('bs.geboekt','Afspraak in de agenda.')); renderBeauty(); } catch(e){ toast(e.message); } });
    b1('bsWalk', async () => { try { await API.call('/supplier/beauty/walkin', { naam: $('#bsWNaam').value, behandelingId: $('#bsWBeh').value }); renderBeauty(); } catch(e){ toast(e.message); } });
    doe('data-bsk', '/supplier/beauty/status', ds => ({ id: ds.bsk, status: 'klaar' }));
    doe('data-bsw', '/supplier/beauty/status', ds => ({ id: ds.bsw, status: 'weg' }));
    doe('data-bswp', '/supplier/beauty/walkin/status', ds => ({ id: ds.bswp, status: 'in de stoel' }));
    doe('data-bswk', '/supplier/beauty/walkin/status', ds => ({ id: ds.bswk, status: 'klaar' }));
  }

  // ---- petcare: het pension, de uitlaatrondes en de trimsalon ----
  async function renderPetcare(){
    const el = $('#petWrap'); if (!el) return;
    if (!has('petcare')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/petcare'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.gasten, T('pc.k.gast','gasten in het pension')],[k.hokkenVrij, T('pc.k.vrij','hokken vrij')],[k.rondesVandaag, T('pc.k.ronde','rondes gepland')],[k.trimOpen, T('pc.k.trim','trimafspraken')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // het pension: check-in met dieet, notities en check-uit
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('pc.pension','Het pension')+'</div>'+
      '<div class="row-gap"><select id="pcDier" class="st-in" style="flex:0 0 6rem;"><option value="hond">hond</option><option value="kat">kat</option><option value="anders">anders</option></select>'+
      '<input id="pcNaam" class="st-in" placeholder="'+T('pc.naam','Naam dier')+'" maxlength="40" style="flex:1;"><input id="pcBaas" class="st-in" placeholder="'+T('pc.baas','Baasje')+'" maxlength="60" style="flex:1;">'+
      '<input id="pcDieet" class="st-in" placeholder="'+T('pc.dieet','Dieet of bijzonderheden')+'" maxlength="120" style="flex:2;"><button id="pcIn" style="flex:1;'+vzGoud+'">'+T('pc.in','Check in')+'</button></div>';
    h += (d.gasten||[]).map(g=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(g.naam)+' ('+esc(g.dier)+') · hok '+g.hok+'</b><span class="sub">'+esc(g.baasje)+(g.tot?' · tot '+esc(g.tot):'')+'</span>'+vzKnop('data-pcuit', g.id, T('pc.uit','Check uit'))+'</div>'+
      (g.dieet?'<div class="sub" style="margin-top:0.25rem;">'+esc(g.dieet)+'</div>':'')+
      (g.notities&&g.notities.length?'<div class="sub" style="margin-top:0.25rem;">'+esc(g.notities[0].tekst)+'</div>':'')+
      '<div class="row-gap" style="margin-top:0.4rem;"><input data-pcnt="'+g.id+'" class="st-in" placeholder="'+T('pc.notitie','Notitie voor het baasje')+'" maxlength="160" style="flex:3;">'+vzKnop('data-pcnb', g.id, T('pc.noteer','Noteer'), true)+'</div></div>').join('');

    // de uitlaatrondes
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('pc.rondes','Uitlaatrondes')+'</div>'+
      '<div class="row-gap"><input id="pcRTijd" class="st-in" type="time" style="flex:1;"><button id="pcRonde" style="flex:1;'+vzGoud+'">'+T('pc.ronde.maak','Nieuwe ronde')+'</button></div>';
    h += (d.rondes||[]).map(r=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;flex-wrap:wrap;">'+
      '<b style="flex:0 0 4rem;font-size:0.85rem;">'+esc(r.tijd)+'</b><span class="sub" style="flex:1;">'+(r.honden.length?r.honden.map(esc).join(' · '):T('pc.ronde.leeg','nog geen honden'))+' · '+esc(r.status)+'</span>'+
      (r.status==='gepland'?'<input data-pcrh="'+r.id+'" class="st-in" placeholder="'+T('pc.ronde.hond','Hond erbij')+'" maxlength="40" style="flex:0 0 8rem;">'+vzKnop('data-pcrb', r.id, T('pc.ronde.bij','Erbij'), true)+vzKnop('data-pcrk', r.id, T('pc.ronde.klaar','Gelopen')):'')+'</div>').join('');

    // de trimsalon
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('pc.trim','De trimsalon')+'</div>'+
      '<div class="row-gap"><input id="pcTNaam" class="st-in" placeholder="'+T('pc.naam','Naam dier')+'" maxlength="40" style="flex:1;"><input id="pcTBaas" class="st-in" placeholder="'+T('pc.baas','Baasje')+'" maxlength="60" style="flex:1;">'+
      '<input id="pcTDatum" class="st-in" type="date" style="flex:1;"><input id="pcTTijd" class="st-in" type="time" style="flex:1;"><button id="pcTrim" style="flex:1;'+vzGoud+'">'+T('bs.boek','Boek')+'</button></div>';
    h += (d.trim||[]).map(t=>'<div class="sub" style="padding:0.3rem 0;">'+esc(t.datum)+' '+esc(t.tijd)+' · '+esc(t.naam)+' van '+esc(t.baasje)+' '+vzKnop('data-pctk', t.id, T('bs.klaar','Klaar'), true)+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+esc(d.verwijzing||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset, b)); renderPetcare(); } catch(e){ toast(e.message); }
    }));
    const b2 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    b2('pcIn', async () => { try { await API.call('/supplier/petcare/checkin', { dier: $('#pcDier').value, naam: $('#pcNaam').value, baasje: $('#pcBaas').value, dieet: $('#pcDieet').value }); renderPetcare(); } catch(e){ toast(e.message); } });
    b2('pcRonde', async () => { try { await API.call('/supplier/petcare/ronde', { tijd: $('#pcRTijd').value }); renderPetcare(); } catch(e){ toast(e.message); } });
    b2('pcTrim', async () => { try { await API.call('/supplier/petcare/trim', { naam: $('#pcTNaam').value, baasje: $('#pcTBaas').value, datum: $('#pcTDatum').value, tijd: $('#pcTTijd').value }); renderPetcare(); } catch(e){ toast(e.message); } });
    doe('data-pcuit', '/supplier/petcare/checkuit', ds => ({ id: ds.pcuit }));
    doe('data-pcnb', '/supplier/petcare/notitie', ds => ({ id: ds.pcnb, tekst: (el.querySelector('[data-pcnt="'+ds.pcnb+'"]')||{}).value }));
    doe('data-pcrb', '/supplier/petcare/ronde/hond', ds => ({ id: ds.pcrb, naam: (el.querySelector('[data-pcrh="'+ds.pcrb+'"]')||{}).value }));
    doe('data-pcrk', '/supplier/petcare/ronde/klaar', ds => ({ id: ds.pcrk }));
    doe('data-pctk', '/supplier/petcare/trim/klaar', ds => ({ id: ds.pctk }));
  }

  // ---- de kinderopvang en nanny-service: groepen, ophaalregel, nanny's ----
  async function renderOpvang(){
    const el = $('#opvWrap'); if (!el) return;
    if (!has('opvang')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/opvang'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.aanwezig, T('op.k.aan','kinderen aanwezig')],[k.plekkenVrij, T('op.k.vrij','plekken vrij')],[k.nannyOpen, T('op.k.nanny','nanny-aanvragen')],[k.verslagenVandaag, T('op.k.verslag','verslagjes vandaag')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de groepen: aanmelden en ophalen (alleen door de aangemelde ouder)
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('op.groepen','De groepen')+'</div>'+
      '<div class="row-gap"><select id="opGroep" class="st-in" style="flex:2;">'+d.groepen.map(g=>'<option value="'+g.id+'">'+esc(g.naam)+' · '+g.aanwezig.length+' van '+g.capaciteit+'</option>').join('')+'</select>'+
      '<input id="opKind" class="st-in" placeholder="'+T('op.kind','Voornaam kind')+'" maxlength="30" style="flex:1;"><input id="opOuder" class="st-in" placeholder="'+T('op.ouder','Naam ouder')+'" maxlength="60" style="flex:1;">'+
      '<button id="opMeld" style="flex:1;'+vzGoud+'">'+T('op.meld','Meld aan')+'</button></div>';
    h += d.groepen.map(g=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<b style="font-size:0.85rem;">'+esc(g.naam)+'</b>'+
      (g.aanwezig.length?g.aanwezig.map(kd=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.3rem 0;">'+
        '<span style="flex:1;font-size:0.82rem;">'+esc(kd.voornaam)+'</span>'+
        '<input data-opoud="'+g.id+':'+kd.id+'" class="st-in" placeholder="'+T('op.ouder','Naam ouder')+'" maxlength="60" style="flex:0 0 9rem;">'+
        vzKnop('data-ophaal', g.id+':'+kd.id, T('op.haal','Ophalen'), true)+'</div>').join(''):'<p class="sub" style="margin-top:0.3rem;">'+T('op.leeg','Nog niemand aangemeld.')+'</p>')+'</div>').join('');

    // de nanny-service: aanvraag, en een mens bevestigt met een gescreende nanny
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('op.nanny','Nanny-service')+'</div>'+
      '<div class="row-gap"><input id="opGezin" class="st-in" placeholder="'+T('op.gezin','Gezin')+'" maxlength="60" style="flex:1;"><input id="opNDatum" class="st-in" type="date" style="flex:1;"><input id="opNVan" class="st-in" type="time" style="flex:1;"><input id="opNTot" class="st-in" type="time" style="flex:1;">'+
      '<button id="opNVraag" style="flex:1;'+vzGoud+'">'+T('op.vraag','Vraag aan')+'</button></div>';
    h += (d.nannyBoekingen||[]).map(a=>'<div style="border:1px solid '+(a.status==='afgerond'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(a.gezin)+' · '+esc(a.datum)+' '+esc(a.van)+' tot '+esc(a.tot)+'</b><span class="sub">'+esc(a.status)+(a.nanny?' · '+esc(a.nanny):'')+'</span></div>'+
      (a.status==='aangevraagd'?'<div class="row-gap" style="margin-top:0.45rem;"><select data-opnn="'+a.id+'" class="st-in" style="flex:2;">'+d.nannies.map(n=>'<option value="'+n.id+'">'+esc(n.naam)+' (gescreend)</option>').join('')+'</select>'+vzKnop('data-opnb', a.id, T('op.bevestig','Bevestig'), true)+'</div>':
        a.status==='bevestigd'?'<div style="margin-top:0.45rem;">'+vzKnop('data-opna', a.id, T('op.afgerond','Afgerond'))+'</div>':'')+'</div>').join('');

    // dagverslagjes met alleen voornamen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('op.verslag','Dagverslagjes')+'</div>'+
      '<div class="row-gap"><input id="opVKind" class="st-in" placeholder="'+T('op.kind','Voornaam kind')+'" maxlength="30" style="flex:1;"><input id="opVTekst" class="st-in" placeholder="'+T('op.vtekst','Wat is er vandaag beleefd?')+'" maxlength="240" style="flex:3;">'+
      '<button id="opVMaak" style="flex:1;'+vzGoud+'">'+T('op.schrijf','Schrijf')+'</button></div>';
    h += (d.verslagen||[]).slice(0,6).map(v=>'<div class="sub" style="padding:0.3rem 0;"><b>'+esc(v.voornaam)+'</b> · '+esc(v.tekst)+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+esc(d.regel||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderOpvang(); } catch(e){ toast(e.message); }
    }));
    const b3 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    b3('opMeld', async () => { try { await API.call('/supplier/opvang/kind', { groepId: $('#opGroep').value, voornaam: $('#opKind').value, ouder: $('#opOuder').value }); renderOpvang(); } catch(e){ toast(e.message); } });
    b3('opNVraag', async () => { try { await API.call('/supplier/opvang/nanny', { gezin: $('#opGezin').value, datum: $('#opNDatum').value, van: $('#opNVan').value, tot: $('#opNTot').value }); renderOpvang(); } catch(e){ toast(e.message); } });
    b3('opVMaak', async () => { try { await API.call('/supplier/opvang/verslag', { voornaam: $('#opVKind').value, tekst: $('#opVTekst').value }); renderOpvang(); } catch(e){ toast(e.message); } });
    doe('data-ophaal', '/supplier/opvang/kind/ophaal', ds => {
      const [groepId, kindId] = ds.ophaal.split(':');
      return { groepId, kindId, ouder: (el.querySelector('[data-opoud="'+ds.ophaal+'"]')||{}).value };
    });
    doe('data-opnb', '/supplier/opvang/nanny/zet', ds => ({ id: ds.opnb, status: 'bevestigd', nannyId: (el.querySelector('[data-opnn="'+ds.opnb+'"]')||{}).value }));
    doe('data-opna', '/supplier/opvang/nanny/zet', ds => ({ id: ds.opna, status: 'afgerond' }));
  }

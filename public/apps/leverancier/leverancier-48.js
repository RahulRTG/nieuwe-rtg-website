    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.afsprakenVandaag, T('bs.k.af','afspraken vandaag')],[k.wachtenden, T('bs.k.wacht','in de wachtrij')],[k.inDeStoel, T('bs.k.stoel','in de stoel')],[eur(k.omzetVandaag), T('bs.k.omzet','omzet vandaag')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de agenda: behandeling op de juiste stoel, zonder dubbele bezetting
    h += '<div class="st-sec h-mt100">'+T('bs.agenda','De agenda')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><select id="bsBeh" class="st-in h-flex2">'+d.behandelingen.map(b=>'<option value="'+b.id+'">'+esc(b.naam)+' · '+b.duurMin+' min · '+eur(b.prijs)+'</option>').join('')+'</select>'+
      '<select id="bsStoel" class="st-in h-flex2">'+d.stoelen.map(s=>'<option value="'+s.id+'">'+esc(s.naam)+'</option>').join('')+'</select></div>'+
      '<div class="row-gap h-mt40"><input id="bsNaam" class="st-in" placeholder="'+T('bs.naam','Op naam van')+'" maxlength="60" class="h-flex2"><input id="bsDatum" class="st-in" type="date" class="h-flex1"><input id="bsTijd" class="st-in" type="time" class="h-flex1">'+
      '<button id="bsBoek" style="flex:1;'+vzGoud+'">'+T('bs.boek','Boek')+'</button></div>'+
      ((d.afspraken||[]).length ? d.afspraken.slice(0,10).map(a=>'<div class="sub h-mt35">'+esc(a.datum)+' '+esc(a.van)+' tot '+esc(a.tot)+' · '+esc(a.stoel)+' · '+esc(a.naam)+' · '+esc(a.behandeling)+' · '+eur(a.prijs)+' '+
        (a.status==='gepland'?vzKnop('data-bsk', a.id, T('bs.klaar','Klaar'), true)+' '+vzKnop('data-bsw', a.id, T('bs.weg','Weg')):'· '+esc(a.status))+'</div>').join('') : '<p class="sub h-mt40">'+T('bs.geen','De agenda is nog leeg.')+'</p>')+'</div>';

    // de walk-in rij aan de deur
    h += '<div class="st-sec h-mt100">'+T('bs.rij','Walk-in wachtrij')+'</div>'+
      '<div class="row-gap"><input id="bsWNaam" class="st-in" placeholder="'+T('bs.rij.naam','Wie loopt er binnen')+'" maxlength="60" class="h-flex2"><select id="bsWBeh" class="st-in h-flex2">'+d.behandelingen.map(b=>'<option value="'+b.id+'">'+esc(b.naam)+'</option>').join('')+'</select>'+
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
    h += '<div class="st-sec h-mt100">'+T('pc.pension','Het pension')+'</div>'+
      '<div class="row-gap"><select id="pcDier" class="st-in" style="flex:0 0 6rem;"><option value="hond">hond</option><option value="kat">kat</option><option value="anders">anders</option></select>'+
      '<input id="pcNaam" class="st-in" placeholder="'+T('pc.naam','Naam dier')+'" maxlength="40" class="h-flex1"><input id="pcBaas" class="st-in" placeholder="'+T('pc.baas','Baasje')+'" maxlength="60" class="h-flex1">'+
      '<input id="pcDieet" class="st-in" placeholder="'+T('pc.dieet','Dieet of bijzonderheden')+'" maxlength="120" class="h-flex2"><button id="pcIn" style="flex:1;'+vzGoud+'">'+T('pc.in','Check in')+'</button></div>';
    h += (d.gasten||[]).map(g=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(g.naam)+' ('+esc(g.dier)+') · hok '+g.hok+'</b><span class="sub">'+esc(g.baasje)+(g.tot?' · tot '+esc(g.tot):'')+'</span>'+vzKnop('data-pcuit', g.id, T('pc.uit','Check uit'))+'</div>'+
      (g.dieet?'<div class="sub" style="margin-top:0.25rem;">'+esc(g.dieet)+'</div>':'')+
      (g.notities&&g.notities.length?'<div class="sub" style="margin-top:0.25rem;">'+esc(g.notities[0].tekst)+'</div>':'')+
      '<div class="row-gap h-mt40"><input data-pcnt="'+g.id+'" class="st-in" placeholder="'+T('pc.notitie','Notitie voor het baasje')+'" maxlength="160" style="flex:3;">'+vzKnop('data-pcnb', g.id, T('pc.noteer','Noteer'), true)+'</div></div>').join('');

    // de uitlaatrondes
    h += '<div class="st-sec h-mt100">'+T('pc.rondes','Uitlaatrondes')+'</div>'+
      '<div class="row-gap"><input id="pcRTijd" class="st-in" type="time" class="h-flex1"><button id="pcRonde" style="flex:1;'+vzGoud+'">'+T('pc.ronde.maak','Nieuwe ronde')+'</button></div>';
    h += (d.rondes||[]).map(r=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;flex-wrap:wrap;">'+
      '<b style="flex:0 0 4rem;font-size:0.85rem;">'+esc(r.tijd)+'</b><span class="sub h-flex1">'+(r.honden.length?r.honden.map(esc).join(' · '):T('pc.ronde.leeg','nog geen honden'))+' · '+esc(r.status)+'</span>'+
      (r.status==='gepland'?'<input data-pcrh="'+r.id+'" class="st-in" placeholder="'+T('pc.ronde.hond','Hond erbij')+'" maxlength="40" style="flex:0 0 8rem;">'+vzKnop('data-pcrb', r.id, T('pc.ronde.bij','Erbij'), true)+vzKnop('data-pcrk', r.id, T('pc.ronde.klaar','Gelopen')):'')+'</div>').join('');

    // de trimsalon
    h += '<div class="st-sec h-mt100">'+T('pc.trim','De trimsalon')+'</div>'+
      '<div class="row-gap"><input id="pcTNaam" class="st-in" placeholder="'+T('pc.naam','Naam dier')+'" maxlength="40" class="h-flex1"><input id="pcTBaas" class="st-in" placeholder="'+T('pc.baas','Baasje')+'" maxlength="60" class="h-flex1">'+
      '<input id="pcTDatum" class="st-in" type="date" class="h-flex1"><input id="pcTTijd" class="st-in" type="time" class="h-flex1"><button id="pcTrim" style="flex:1;'+vzGoud+'">'+T('bs.boek','Boek')+'</button></div>';
    h += (d.trim||[]).map(t=>'<div class="sub" style="padding:0.3rem 0;">'+esc(t.datum)+' '+esc(t.tijd)+' · '+esc(t.naam)+' van '+esc(t.baasje)+' '+vzKnop('data-pctk', t.id, T('bs.klaar','Klaar'), true)+'</div>').join('');
    h += '<p class="sub h-mt50">'+esc(d.verwijzing||'')+'</p>';
    el.innerHTML = h;


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


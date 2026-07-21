
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


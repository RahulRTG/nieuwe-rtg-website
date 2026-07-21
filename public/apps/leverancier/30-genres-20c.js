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

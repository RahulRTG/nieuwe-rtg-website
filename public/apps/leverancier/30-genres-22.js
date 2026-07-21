
  // ---- weddings en prive-events: het draaiboek over de keten ----
  const PL_GOUD = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;';
  function plKnop(attr, id, tekst, vol){
    return '<button '+attr+'="'+id+'" style="'+(vol?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(vol?'font-weight:600;':'')+'">'+tekst+'</button>';
  }
  async function renderWeddings(){
    const el = $('#wedWrap'); if (!el) return;
    if (!has('weddings')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/weddings'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.events, T('wd.k.events','draaiboeken')],[k.gepland, T('wd.k.gepland','gepland')],[k.takenOpen, T('wd.k.taken','taken open')],[k.gedraaid, T('wd.k.gedraaid','gedraaid')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // een nieuwe dag aannemen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('wd.nieuw','Nieuwe dag aannemen')+'</div>'+
      '<div class="row-gap"><input id="wdKlant" class="st-in" placeholder="'+T('wd.klant','Voor wie (bijv. Sophie en Milan)')+'" maxlength="60" style="flex:2;"><select id="wdSoort" class="st-in" style="flex:1;"><option value="bruiloft">bruiloft</option><option value="prive-event">prive-event</option></select>'+
      '<select id="wdLoc" class="st-in" style="flex:2;">'+d.locaties.map(l=>'<option value="'+escAttr(l)+'">'+esc(l)+'</option>').join('')+'</select></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="wdDatum" class="st-in" type="date" style="flex:1;"><input id="wdGasten" class="st-in" type="number" min="2" placeholder="'+T('wd.gasten','gasten')+'" style="flex:1;"><input id="wdBudget" class="st-in" type="number" min="0" placeholder="'+T('wd.budget','budget')+'" style="flex:1;">'+
      '<button id="wdMaak" style="flex:1;'+PL_GOUD+'">'+T('wd.aannemen','Neem aan')+'</button></div>';

    // de draaiboeken zelf
    h += d.events.map(e=>'<div style="border:1px solid '+(e.status==='gedraaid'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.6rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.9rem;">'+esc(e.klant)+' · '+esc(e.soort)+'</b><span class="sub">'+esc(e.status)+'</span></div>'+
      '<div class="sub">'+esc(e.datum)+' · '+esc(e.locatie)+' · '+e.gasten+' '+T('wd.gasten','gasten')+(e.budget?' · '+eur(e.budget):'')+'</div>'+
      (e.taken.length?e.taken.map(t=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.3rem 0;">'+
        '<span style="flex:1;font-size:0.8rem;">'+esc(t.tekst)+'</span><span class="sub">'+esc(t.partner)+'</span>'+
        (t.status==='open'?plKnop('data-wdtk', e.id+':'+t.id, T('wd.klaar','Klaar'), true):'<span class="sub">'+T('wd.klaar','Klaar').toLowerCase()+'</span>')+'</div>').join(''):'')+
      (e.status!=='gedraaid'?'<div class="row-gap" style="margin-top:0.45rem;"><input data-wdtt="'+e.id+'" class="st-in" placeholder="'+T('wd.taak','Nieuwe taak')+'" maxlength="160" style="flex:3;">'+
        '<select data-wdtp="'+e.id+'" class="st-in" style="flex:2;">'+d.keten.map(p=>'<option value="'+escAttr(p)+'">'+esc(p)+'</option>').join('')+'</select>'+plKnop('data-wdta', e.id, T('wd.voeg','Voeg toe'), true)+'</div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.45rem;">'+(e.status==='intake'?plKnop('data-wdsp', e.id, T('wd.plan','Zet op gepland'), true):'')+plKnop('data-wdsg', e.id, T('wd.draai','Dag gedraaid'))+'</div>':'')+'</div>').join('');
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderWeddings(); } catch(e){ toast(e.message); }
    }));
    const bw = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bw('wdMaak', async () => { try { await API.call('/supplier/weddings/event', { klant: $('#wdKlant').value, soort: $('#wdSoort').value, locatie: $('#wdLoc').value, datum: $('#wdDatum').value, gasten: $('#wdGasten').value, budget: $('#wdBudget').value }); renderWeddings(); } catch(e){ toast(e.message); } });
    doe('data-wdta', '/supplier/weddings/taak', ds => ({ eventId: ds.wdta, tekst: (el.querySelector('[data-wdtt="'+ds.wdta+'"]')||{}).value, partner: (el.querySelector('[data-wdtp="'+ds.wdta+'"]')||{}).value }));
    doe('data-wdtk', '/supplier/weddings/taak/klaar', ds => { const [eventId, taakId] = ds.wdtk.split(':'); return { eventId, taakId }; });
    doe('data-wdsp', '/supplier/weddings/event/status', ds => ({ id: ds.wdsp, status: 'gepland' }));
    doe('data-wdsg', '/supplier/weddings/event/status', ds => ({ id: ds.wdsg, status: 'gedraaid' }));
  }

  // ---- de professionele praktijk: dossiers en de agenda per adviseur ----
  async function renderAdvies(){
    const el = $('#advWrap'); if (!el) return;
    if (!has('advies')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/advies'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.dossiers, T('lx.k.dossiers','dossiers')],[k.lopend, T('lx.k.lopend','lopend')],[k.afspraken, T('lx.k.afspraken','afspraken')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    h += '<div class="st-sec" style="margin-top:1rem;">'+T('lx.team','De adviseurs')+'</div>';
    h += d.adviseurs.map(a=>'<div style="display:flex;gap:0.6rem;align-items:baseline;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(a.naam)+'</b><span class="sub">'+esc(a.vak)+' · '+eur(a.uurtarief)+' '+T('lx.peruur','per uur')+'</span></div>').join('');

    // een dossier openen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('lx.dossiers','Dossiers')+'</div>'+
      '<div class="row-gap"><input id="lxKlant" class="st-in" placeholder="'+T('lx.klant','Client')+'" maxlength="60" style="flex:1;"><select id="lxVak" class="st-in" style="flex:1;"><option value="advocaat">advocaat</option><option value="notaris">notaris</option><option value="fiscalist">fiscalist</option></select>'+
      '<input id="lxOms" class="st-in" placeholder="'+T('lx.oms','Waar gaat het over (kort)')+'" maxlength="160" style="flex:2;"><button id="lxMaak" style="flex:1;'+PL_GOUD+'">'+T('lx.open','Open dossier')+'</button></div>';
    h += (d.dossiers||[]).map(x=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 4.5rem;">'+esc(x.id)+'</span><b style="flex:1;font-size:0.82rem;">'+esc(x.klant)+' · '+esc(x.omschrijving)+'</b><span class="sub">'+esc(x.vak)+' · '+esc(x.status)+'</span>'+
      (x.status!=='afgerond'?plKnop('data-lxaf', x.id, T('lx.afgerond','Afgerond')):'')+'</div>').join('');

    // een afspraak in de agenda van de adviseur
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('lx.agenda','Afspraak plannen')+'</div>'+
      '<div class="row-gap"><select id="lxAdv" class="st-in" style="flex:2;">'+d.adviseurs.map(a=>'<option value="'+a.id+'">'+esc(a.naam)+' ('+esc(a.vak)+')</option>').join('')+'</select>'+
      '<select id="lxDos" class="st-in" style="flex:1;">'+(d.dossiers||[]).map(x=>'<option value="'+x.id+'">'+esc(x.id)+' · '+esc(x.klant)+'</option>').join('')+'</select>'+
      '<input id="lxDatum" class="st-in" type="date" style="flex:1;"><input id="lxTijd" class="st-in" type="time" style="flex:1;">'+
      '<button id="lxBoek" style="flex:1;'+PL_GOUD+'">'+T('lx.boek','Plan')+'</button></div>';
    h += (d.afspraken||[]).slice(0,8).map(f=>'<div class="sub" style="padding:0.3rem 0;">'+esc(f.datum)+' '+esc(f.tijd)+' · '+esc(f.adviseur)+' · '+esc(f.dossier)+' · '+esc(f.klant)+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+esc(d.regel||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderAdvies(); } catch(e){ toast(e.message); }
    }));
    const ba = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    ba('lxMaak', async () => { try { await API.call('/supplier/advies/dossier', { klant: $('#lxKlant').value, vak: $('#lxVak').value, omschrijving: $('#lxOms').value }); renderAdvies(); } catch(e){ toast(e.message); } });
    ba('lxBoek', async () => { try { await API.call('/supplier/advies/afspraak', { adviseurId: $('#lxAdv').value, dossierId: $('#lxDos').value, datum: $('#lxDatum').value, tijd: $('#lxTijd').value }); renderAdvies(); } catch(e){ toast(e.message); } });
    doe('data-lxaf', '/supplier/advies/dossier/status', ds => ({ id: ds.lxaf, status: 'afgerond' }));
  }

  // ---- verzekeringsadvies: aanvragen, advies van een mens, doorverwijzen ----
  async function renderPolis(){
    const el = $('#polWrap'); if (!el) return;
    if (!has('polis')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/polis'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.open, T('sg.k.open','aanvragen open')],[k.geadviseerd, T('sg.k.klaar','advies klaar')],[k.doorverwezen, T('sg.k.door','doorverwezen')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    h += '<div class="st-sec" style="margin-top:1rem;">'+T('sg.vraag','Nieuwe adviesvraag')+'</div>'+
      '<div class="row-gap"><input id="sgKlant" class="st-in" placeholder="'+T('sg.klant','Voor wie')+'" maxlength="60" style="flex:1;"><select id="sgProd" class="st-in" style="flex:2;">'+d.producten.map(p=>'<option value="'+p.id+'">'+esc(p.naam)+' · '+esc(p.indicatie)+'</option>').join('')+'</select>'+
      '<input id="sgSit" class="st-in" placeholder="'+T('sg.sit','De situatie (bijv. drie weken Ibiza met de boot)')+'" maxlength="200" style="flex:3;"><button id="sgVraag" style="flex:1;'+PL_GOUD+'">'+T('sg.aanvraag','Vraag advies')+'</button></div>';
    h += (d.aanvragen||[]).map(a=>'<div style="border:1px solid '+(a.status==='doorverwezen'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(a.klant)+' · '+esc(a.product)+'</b><span class="sub">'+esc(a.status)+'</span></div>'+
      '<div class="sub">'+esc(a.situatie)+(a.advies?' · '+T('sg.advies','advies')+': '+esc(a.advies):'')+'</div>'+
      (a.status==='aangevraagd'?'<div class="row-gap" style="margin-top:0.45rem;"><input data-sgat="'+a.id+'" class="st-in" placeholder="'+T('sg.schrijf','Het advies, geschreven door de adviseur')+'" maxlength="240" style="flex:3;">'+plKnop('data-sgak', a.id, T('sg.klaarzet','Advies klaar'), true)+'</div>':
        a.status==='advies-klaar'?'<div style="margin-top:0.45rem;">'+plKnop('data-sgdw', a.id, T('sg.verwijs','Doorverwijzen naar de verzekeraar'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+esc(d.regel||'')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderPolis(); } catch(e){ toast(e.message); }
    }));
    const bp = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bp('sgVraag', async () => { try { await API.call('/supplier/polis/vraag', { klant: $('#sgKlant').value, productId: $('#sgProd').value, situatie: $('#sgSit').value }); renderPolis(); } catch(e){ toast(e.message); } });
    doe('data-sgak', '/supplier/polis/zet', ds => ({ id: ds.sgak, status: 'advies-klaar', advies: (el.querySelector('[data-sgat="'+ds.sgak+'"]')||{}).value }));
    doe('data-sgdw', '/supplier/polis/zet', ds => ({ id: ds.sgdw, status: 'doorverwezen' }));
  }

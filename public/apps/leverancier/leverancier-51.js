/* de kengetallen van een weddingplanner */
    let h = '<div class="s-1ah2knl">'+
      [[k.events, T('wd.k.events','draaiboeken')],[k.gepland, T('wd.k.gepland','gepland')],[k.takenOpen, T('wd.k.taken','taken open')],[k.gedraaid, T('wd.k.gedraaid','gedraaid')]]
        .map(x=>'<div class="s-1fk9glc"><b class="s-123kxff">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // een nieuwe dag aannemen
    h += '<div class="st-sec h-mt100">'+T('wd.nieuw','Nieuwe dag aannemen')+'</div>'+
      '<div class="row-gap"><input id="wdKlant" class="st-in h-flex2" placeholder="'+T('wd.klant','Voor wie (bijv. Sophie en Milan)')+'" maxlength="60"><select id="wdSoort" class="st-in h-flex1"><option value="bruiloft">bruiloft</option><option value="prive-event">prive-event</option></select>'+
      '<select id="wdLoc" class="st-in h-flex2">'+d.locaties.map(l=>'<option value="'+escAttr(l)+'">'+esc(l)+'</option>').join('')+'</select></div>'+
      '<div class="row-gap h-mt40"><input id="wdDatum" class="st-in h-flex1" type="date"><input id="wdGasten" class="st-in h-flex1" type="number" min="2" placeholder="'+T('wd.gasten','gasten')+'"><input id="wdBudget" class="st-in h-flex1" type="number" min="0" placeholder="'+T('wd.budget','budget')+'">'+
      '<button id="wdMaak" style="flex:1;'+PL_GOUD+'">'+T('wd.aannemen','Neem aan')+'</button></div>';

    // de draaiboeken zelf
    h += d.events.map(e=>'<div class="' + (e.status==='gedraaid' ? 's-3zlc2l' : 's-1q3oiup') + '">'+
      '<div class="s-tbd6xd"><b class="s-209icl">'+esc(e.klant)+' · '+esc(e.soort)+'</b><span class="sub">'+esc(e.status)+'</span></div>'+
      '<div class="sub">'+esc(e.datum)+' · '+esc(e.locatie)+' · '+e.gasten+' '+T('wd.gasten','gasten')+(e.budget?' · '+eur(e.budget):'')+'</div>'+
      (e.taken.length?e.taken.map(t=>'<div class="s-1d7lcvd">'+
        '<span class="s-208vd2">'+esc(t.tekst)+'</span><span class="sub">'+esc(t.partner)+'</span>'+
        (t.status==='open'?plKnop('data-wdtk', e.id+':'+t.id, T('wd.klaar','Klaar'), true):'<span class="sub">'+T('wd.klaar','Klaar').toLowerCase()+'</span>')+'</div>').join(''):'')+
      (e.status!=='gedraaid'?'<div class="row-gap h-mt45"><input data-wdtt="'+e.id+'" class="st-in s-1dzu8du" placeholder="'+T('wd.taak','Nieuwe taak')+'" maxlength="160">'+
        '<select data-wdtp="'+e.id+'" class="st-in h-flex2">'+d.keten.map(p=>'<option value="'+escAttr(p)+'">'+esc(p)+'</option>').join('')+'</select>'+plKnop('data-wdta', e.id, T('wd.voeg','Voeg toe'), true)+'</div>'+
        '<div class="s-1stuony">'+(e.status==='intake'?plKnop('data-wdsp', e.id, T('wd.plan','Zet op gepland'), true):'')+plKnop('data-wdsg', e.id, T('wd.draai','Dag gedraaid'))+'</div>':'')+'</div>').join('');
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
    let h = '<div class="s-1ah2knl">'+
      [[k.dossiers, T('lx.k.dossiers','dossiers')],[k.lopend, T('lx.k.lopend','lopend')],[k.afspraken, T('lx.k.afspraken','afspraken')]]
        .map(x=>'<div class="s-1fk9glc"><b class="s-123kxff">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    h += '<div class="st-sec h-mt100">'+T('lx.team','De adviseurs')+'</div>';
    h += d.adviseurs.map(a=>'<div class="s-15d06p3">'+
      '<b class="s-1q6kbkp">'+esc(a.naam)+'</b><span class="sub">'+esc(a.vak)+' · '+eur(a.uurtarief)+' '+T('lx.peruur','per uur')+'</span></div>').join('');

    // een dossier openen
    h += '<div class="st-sec h-mt100">'+T('lx.dossiers','Dossiers')+'</div>'+
      '<div class="row-gap"><input id="lxKlant" class="st-in h-flex1" placeholder="'+T('lx.klant','Client')+'" maxlength="60"><select id="lxVak" class="st-in h-flex1"><option value="advocaat">advocaat</option><option value="notaris">notaris</option><option value="fiscalist">fiscalist</option></select>'+
      '<input id="lxOms" class="st-in h-flex2" placeholder="'+T('lx.oms','Waar gaat het over (kort)')+'" maxlength="160"><button id="lxMaak" style="flex:1;'+PL_GOUD+'">'+T('lx.open','Open dossier')+'</button></div>';
    h += (d.dossiers||[]).map(x=>'<div class="s-57bs1i">'+
      '<span class="sub" style="flex:0 0 4.5rem;">'+esc(x.id)+'</span><b class="s-1q6iem4">'+esc(x.klant)+' · '+esc(x.omschrijving)+'</b><span class="sub">'+esc(x.vak)+' · '+esc(x.status)+'</span>'+
      (x.status!=='afgerond'?plKnop('data-lxaf', x.id, T('lx.afgerond','Afgerond')):'')+'</div>').join('');

    // een afspraak in de agenda van de adviseur
    h += '<div class="st-sec h-mt100">'+T('lx.agenda','Afspraak plannen')+'</div>'+
      '<div class="row-gap"><select id="lxAdv" class="st-in h-flex2">'+d.adviseurs.map(a=>'<option value="'+a.id+'">'+esc(a.naam)+' ('+esc(a.vak)+')</option>').join('')+'</select>'+
      '<select id="lxDos" class="st-in h-flex1">'+(d.dossiers||[]).map(x=>'<option value="'+x.id+'">'+esc(x.id)+' · '+esc(x.klant)+'</option>').join('')+'</select>'+
      '<input id="lxDatum" class="st-in h-flex1" type="date"><input id="lxTijd" class="st-in h-flex1" type="time">'+
      '<button id="lxBoek" style="flex:1;'+PL_GOUD+'">'+T('lx.boek','Plan')+'</button></div>';
    h += (d.afspraken||[]).slice(0,8).map(f=>'<div class="sub" style="padding:0.3rem 0;">'+esc(f.datum)+' '+esc(f.tijd)+' · '+esc(f.adviseur)+' · '+esc(f.dossier)+' · '+esc(f.klant)+'</div>').join('');
    h += '<p class="sub h-mt50">'+esc(d.regel||'')+'</p>';
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


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


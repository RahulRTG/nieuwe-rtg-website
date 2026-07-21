
  // ---- de golf- en countryclub: teetimes, pro's, wedstrijden, baanstatus ----
  function clKnop(attr, id, tekst, goud){
    return '<button '+attr+'="'+id+'" style="'+(goud?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(goud?'font-weight:600;':'')+'">'+tekst+'</button>';
  }
  async function renderGolf(){
    const el = $('#golfWrap'); if (!el) return;
    if (!has('golf')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/golf'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.teetimesVandaag, T('golf.k.tee','flights vandaag')],[k.spelersVandaag, T('golf.k.spelers','spelers vandaag')],[k.lessenOpen, T('golf.k.les','lessen open')],[k.inschrijvingen, T('golf.k.wed','wedstrijd-inschrijvingen')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de baan zelf: status van de greenkeeper
    h += '<div class="st-sec" style="margin-top:1rem;">'+esc(d.naam)+' · '+d.holes+' holes · par '+d.par+'</div>'+
      '<div class="row-gap" style="align-items:center;"><span class="sub" style="flex:1;">'+T('golf.baan','Baanstatus')+': <b>'+esc(d.baanStatus)+'</b> · greenfee '+eur(d.greenfee)+' '+T('golf.pp','p.p.')+'</span>'+
      ['open','onderhoud','gesloten'].filter(s=>s!==d.baanStatus).map(s=>clKnop('data-gfbaan', s, s)).join(' ')+'</div>';

    // teetimes: een flight boeken zonder dubbele starttijden
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('golf.tee','Teetimes')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><input id="gfNaam" class="st-in" placeholder="'+T('golf.tee.naam','Naam flight')+'" maxlength="60" style="flex:2;"><select id="gfSpelers" class="st-in" style="flex:0 0 6rem;">'+[1,2,3,4].map(n=>'<option value="'+n+'"'+(n===2?' selected':'')+'>'+n+' '+(n===1?T('golf.speler','speler'):T('golf.spelers','spelers'))+'</option>').join('')+'</select></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="gfDatum" class="st-in" type="date" style="flex:1;"><input id="gfTijd" class="st-in" type="time" style="flex:1;">'+
      '<button id="gfBoek" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('golf.boek','Boek')+'</button></div>'+
      ((d.teetimes||[]).length ? d.teetimes.slice(0,10).map(t=>'<div class="sub" style="margin-top:0.35rem;">'+esc(t.datum)+' '+esc(t.tijd)+' · '+esc(t.naam)+' · '+t.spelers+' '+T('golf.spelers','spelers')+' · '+eur(t.prijs)+' <button data-gfweg="'+t.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></div>').join('') : '<p class="sub" style="margin-top:0.4rem;">'+T('golf.geen','De tee sheet is nog leeg.')+'</p>')+'</div>';

    // de pro's: lessen boeken
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('golf.pros','De pro\'s · lessen')+'</div>'+
      '<div class="row-gap"><select id="gfPro" class="st-in" style="flex:2;">'+d.pros.map(p=>'<option value="'+p.id+'">'+esc(p.naam)+' · '+esc(p.les)+' · '+eur(p.prijs)+'</option>').join('')+'</select>'+
      '<input id="gfLesNaam" class="st-in" placeholder="'+T('golf.les.naam','Voor wie')+'" maxlength="60" style="flex:2;"></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="gfLesDatum" class="st-in" type="date" style="flex:1;"><input id="gfLesTijd" class="st-in" type="time" style="flex:1;">'+
      '<button id="gfLes" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('golf.les.boek','Plan les')+'</button></div>';
    h += (d.lessen||[]).map(l=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(l.naam)+'</b><span class="sub">'+esc(l.pro)+' · '+esc(l.datum)+' '+esc(l.tijd)+' · '+eur(l.prijs)+'</span>'+clKnop('data-gflk', l.id, T('golf.les.klaar','Gegeven'), true)+'</div>').join('') || '<p class="sub">'+T('golf.les.geen','Geen lessen gepland.')+'</p>';

    // wedstrijden: de maandbeker
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('golf.wed','Wedstrijden')+'</div>';
    h += d.wedstrijden.map(w=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(w.naam)+' · '+esc(w.datum)+'</b><span class="sub">'+esc(w.vorm)+' · '+w.inschrijvingen.length+' '+T('golf.van','van')+' '+w.max+'</span></div>'+
      (w.inschrijvingen.length?'<div class="sub" style="margin-top:0.3rem;">'+w.inschrijvingen.slice(0,12).map(i=>esc(i.naam)+(i.handicap!=null?' (hcp '+i.handicap+')':'')).join(' · ')+'</div>':'')+
      '<div class="row-gap" style="margin-top:0.45rem;"><input data-gfwn="'+w.id+'" class="st-in" placeholder="'+T('golf.wed.naam','Naam speler')+'" maxlength="60" style="flex:2;"><input data-gfwh="'+w.id+'" class="st-in" type="number" step="0.1" placeholder="hcp" style="flex:0 0 5rem;">'+
      '<button data-gfwin="'+w.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('golf.wed.in','Schrijf in')+'</button></div></div>').join('');
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderGolf(); } catch(e){ toast(e.message); }
    }));
    const bind4 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bind4('gfBoek', async () => { try { await API.call('/supplier/golf/tee', { naam: $('#gfNaam').value, spelers: $('#gfSpelers').value, datum: $('#gfDatum').value, tijd: $('#gfTijd').value }); toast(T('golf.geboekt','Teetime geboekt.')); renderGolf(); } catch(e){ toast(e.message); } });
    bind4('gfLes', async () => { try { await API.call('/supplier/golf/les', { proId: $('#gfPro').value, naam: $('#gfLesNaam').value, datum: $('#gfLesDatum').value, tijd: $('#gfLesTijd').value }); renderGolf(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-gfbaan]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/golf/baan', { status: b.dataset.gfbaan }); renderGolf(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-gfwin]').forEach(b => b.addEventListener('click', async () => {
      const w = b.dataset.gfwin;
      try { await API.call('/supplier/golf/wedstrijd/in', { wedstrijdId: w, naam: el.querySelector('[data-gfwn="'+w+'"]').value, handicap: el.querySelector('[data-gfwh="'+w+'"]').value }); renderGolf(); } catch(e){ toast(e.message); }
    }));
    doe('data-gfweg', '/supplier/golf/tee/weg', ds => ({ id: ds.gfweg }));
    doe('data-gflk', '/supplier/golf/les/klaar', ds => ({ id: ds.gflk }));
  }


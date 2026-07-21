  // ---- de sport- en fitnessclub: leden, check-in, lessen, banen, PT ----
  async function renderFitclub(){
    const el = $('#fitWrap'); if (!el) return;
    if (!has('fitclub')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/fitclub'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.leden, T('fit.k.leden','leden')],[k.binnenNu, T('fit.k.binnen','nu binnen')],[k.checkinsVandaag, T('fit.k.check','check-ins vandaag')],[k.lesplekkenVrij, T('fit.k.plek','lesplekken vrij')],[k.banenVandaag, T('fit.k.baan','banen vandaag')],[k.ptOpen, T('fit.k.pt','PT open')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // de receptie: leden en check-in
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('fit.leden','Leden · check-in')+'</div>'+
      '<div class="row-gap"><input id="ftNaam" class="st-in" placeholder="'+T('fit.lid.naam','Naam nieuw lid')+'" maxlength="60" style="flex:2;"><select id="ftSoort" class="st-in" style="flex:1;">'+Object.keys(d.lidSoorten).map(s=>'<option value="'+s+'">'+s+' · '+eur(d.lidSoorten[s])+'</option>').join('')+'</select>'+
      '<button id="ftLid" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('fit.lid.maak','Schrijf in')+'</button></div>';
    h += (d.leden||[]).slice(0,10).map(l=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(l.naam)+'</b><span class="sub">'+esc(l.pas)+' · '+esc(l.soort)+' · '+(l.binnen?T('fit.binnen','binnen'):T('fit.buiten','buiten'))+'</span>'+
      (l.binnen?clKnop('data-ftuit', l.id, T('fit.uit','Check uit')):clKnop('data-ftin', l.id, T('fit.in','Check in'), true))+'</div>').join('');

    // groepslessen met capaciteit
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('fit.lessen','Groepslessen vandaag')+'</div>';
    h += d.lessen.map(l=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+esc(l.naam)+' · '+esc(l.tijd)+'</b><span class="sub">'+l.deelnemers.length+' '+T('golf.van','van')+' '+l.capaciteit+'</span></div>'+
      (l.deelnemers.length?'<div class="sub" style="margin-top:0.3rem;">'+l.deelnemers.slice(0,12).map(esc).join(' · ')+'</div>':'')+
      '<div class="row-gap" style="margin-top:0.45rem;"><input data-ftln="'+l.id+'" class="st-in" placeholder="'+T('fit.les.naam','Naam deelnemer')+'" maxlength="60" style="flex:2;">'+
      '<button data-ftlin="'+l.id+'" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('fit.les.in','Meld aan')+'</button></div></div>').join('');

    // padel- en tennisbanen zonder dubbele boekingen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('fit.banen','Banen')+' · '+eur(d.baanUurprijs)+' '+T('fit.peruur','per uur')+'</div>'+
      '<div style="border:1px solid var(--line);border-radius:12px;padding:0.8rem;">'+
      '<div class="row-gap"><select id="ftBaan" class="st-in" style="flex:2;">'+d.banen.map(b=>'<option value="'+b.id+'">'+esc(b.naam)+'</option>').join('')+'</select>'+
      '<input id="ftBNaam" class="st-in" placeholder="'+T('fit.baan.naam','Op naam van')+'" maxlength="60" style="flex:2;"></div>'+
      '<div class="row-gap" style="margin-top:0.4rem;"><input id="ftBDatum" class="st-in" type="date" style="flex:1;"><input id="ftBVan" class="st-in" type="time" style="flex:1;"><input id="ftBTot" class="st-in" type="time" style="flex:1;">'+
      '<button id="ftBBoek" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('golf.boek','Boek')+'</button></div>'+
      ((d.baanboekingen||[]).length ? d.baanboekingen.slice(0,8).map(b=>'<div class="sub" style="margin-top:0.35rem;">'+esc(b.datum)+' '+esc(b.van)+' tot '+esc(b.tot)+' · '+esc(b.baan)+' · '+esc(b.naam)+' · '+eur(b.prijs)+'</div>').join('') : '<p class="sub" style="margin-top:0.4rem;">'+T('fit.baan.geen','Nog geen baanboekingen.')+'</p>')+'</div>';

    // personal training: aanvragen en inplannen
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('fit.pt','Personal training')+'</div>'+
      '<div class="row-gap"><input id="ftPtNaam" class="st-in" placeholder="'+T('fit.pt.naam','Wie wil trainen')+'" maxlength="60" style="flex:1;"><input id="ftPtDoel" class="st-in" placeholder="'+T('fit.pt.doel','Het doel (bijv. marathon in oktober)')+'" maxlength="160" style="flex:2;">'+
      '<button id="ftPt" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;">'+T('fit.pt.vraag','Vraag aan')+'</button></div>';
    h += (d.pt||[]).map(p=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<b style="flex:1;font-size:0.85rem;">'+esc(p.naam)+'</b><span class="sub">'+esc(p.doel)+' · '+esc(p.status)+'</span>'+
      (p.status==='aangevraagd'?clKnop('data-ftpi', p.id, T('fit.pt.plan','Ingepland'), true):p.status==='ingepland'?clKnop('data-ftpa', p.id, T('fit.pt.klaar','Afgerond')):'')+'</div>').join('');
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderFitclub(); } catch(e){ toast(e.message); }
    }));
    const bind5 = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bind5('ftLid', async () => { try { await API.call('/supplier/fitclub/lid', { naam: $('#ftNaam').value, soort: $('#ftSoort').value }); toast(T('fit.lid.klaar','Lid ingeschreven; de clubpas ligt klaar.')); renderFitclub(); } catch(e){ toast(e.message); } });
    bind5('ftBBoek', async () => { try { await API.call('/supplier/fitclub/baan', { baanId: $('#ftBaan').value, naam: $('#ftBNaam').value, datum: $('#ftBDatum').value, van: $('#ftBVan').value, tot: $('#ftBTot').value }); renderFitclub(); } catch(e){ toast(e.message); } });
    bind5('ftPt', async () => { try { await API.call('/supplier/fitclub/pt', { naam: $('#ftPtNaam').value, doel: $('#ftPtDoel').value }); renderFitclub(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-ftlin]').forEach(b => b.addEventListener('click', async () => {
      const l = b.dataset.ftlin;
      try { await API.call('/supplier/fitclub/les/in', { lesId: l, naam: el.querySelector('[data-ftln="'+l+'"]').value }); renderFitclub(); } catch(e){ toast(e.message); }
    }));
    doe('data-ftin', '/supplier/fitclub/checkin', ds => ({ id: ds.ftin }));
    doe('data-ftuit', '/supplier/fitclub/checkout', ds => ({ id: ds.ftuit }));
    doe('data-ftpi', '/supplier/fitclub/pt/status', ds => ({ id: ds.ftpi, status: 'ingepland' }));
    doe('data-ftpa', '/supplier/fitclub/pt/status', ds => ({ id: ds.ftpa, status: 'afgerond' }));
  }

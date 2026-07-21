
  // ---- de marina: ligplaatsen, passanten, brandstof, service, concierge ----
  const MR_SVC = { hijs: 'Hijskraan', helling: 'Hellingbaan', onderhoud: 'Onderhoud', schoonmaak: 'Schoonmaak' };
  const MR_CON = { tender: 'Tender', catering: 'Catering aan boord', crew: 'Crew voor een dag', 'charter-transfer': 'Charter-transfer' };
  async function renderMarina(){
    const el = $('#marWrap'); if (!el) return;
    if (!has('marina')){ el.innerHTML = ''; return; }
    let d; try { d = await API.call('/supplier/marina'); } catch(e){ el.innerHTML = '<p class="sub">'+esc(e.message)+'</p>'; return; }
    const k = d.kpi;
    const goud = 'background:var(--gold);color:#000;border:none;border-radius:8px;padding:0.45rem;font-weight:600;font-family:inherit;';
    const knop = (attr, id, tekst, vol) => '<button '+attr+'="'+id+'" style="'+(vol?'background:var(--gold);color:#000;border:none;':'background:none;border:1px solid var(--line);color:var(--soft);')+'border-radius:8px;padding:0.35rem 0.7rem;font-family:inherit;font-size:0.72rem;'+(vol?'font-weight:600;':'')+'">'+tekst+'</button>';
    let h = '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(7.5rem,1fr));gap:0.5rem;">'+
      [[k.bezet+' van '+k.ligplaatsen, T('mr.k.bezet','ligplaatsen bezet')],[k.passanten, T('mr.k.pas','passanten')],[k.brandstofOpen, T('mr.k.brand','brandstof open')],[k.serviceOpen, T('mr.k.svc','service open')],[k.conciergeOpen, T('mr.k.con','concierge open')]]
        .map(x=>'<div style="border:1px solid var(--line);border-radius:12px;padding:0.55rem 0.7rem;text-align:center;"><b style="font-size:1.1rem;display:block;">'+x[0]+'</b><span class="sub">'+x[1]+'</span></div>').join('')+'</div>';

    // het havenoverzicht: elke steiger een regel
    h += '<div class="st-sec" style="margin-top:1rem;">'+esc(d.naam)+' · '+T('mr.plaatsen','de ligplaatsen')+'</div>';
    h += d.ligplaatsen.map(p=>'<div style="display:flex;gap:0.6rem;align-items:baseline;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 3.2rem;">'+p.id+'</span><span class="sub" style="flex:0 0 6.5rem;">tot '+p.lengteMax+' m · '+eur(p.dagprijs)+'/n</span>'+
      (p.boot?'<b style="flex:1;font-size:0.85rem;">'+esc(p.boot.naam)+' ('+p.boot.lengte+' m)</b><span class="sub">'+esc(p.boot.eigenaar)+(p.vast?' · '+T('mr.vast','vaste ligger'):' · tot '+esc(p.boot.tot||''))+'</span>'+(p.vast?'':knop('data-mrweg', p.id, T('mr.vertrek','Vertrek')))
        :'<span class="sub" style="flex:1;">'+T('mr.vrij','vrij')+'</span>')+'</div>').join('');

    // een passant binnenmelden: de eerste passende plaats
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('mr.passant','Passant binnenmelden')+'</div>'+
      '<div class="row-gap"><input id="mrBoot" class="st-in" placeholder="'+T('mr.boot','Naam boot')+'" maxlength="60" style="flex:2;"><input id="mrEig" class="st-in" placeholder="'+T('mr.eig','Eigenaar')+'" maxlength="60" style="flex:2;">'+
      '<input id="mrLen" class="st-in" type="number" step="0.5" min="1" placeholder="m" style="flex:0 0 4.5rem;"><input id="mrNacht" class="st-in" type="number" min="1" value="1" style="flex:0 0 4.5rem;">'+
      '<button id="mrMeld" style="flex:1;'+goud+'">'+T('mr.meld','Wijs plaats toe')+'</button></div>';

    // de brandstofsteiger
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('mr.brandstof','De brandstofsteiger')+'</div>'+
      '<div class="row-gap"><input id="mrBBoot" class="st-in" placeholder="'+T('mr.boot','Naam boot')+'" maxlength="60" style="flex:2;"><select id="mrBSoort" class="st-in" style="flex:1;"><option value="diesel">diesel</option><option value="benzine">benzine</option></select>'+
      '<input id="mrBLiters" class="st-in" type="number" min="1" placeholder="liters" style="flex:1;"><button id="mrBVraag" style="flex:1;'+goud+'">'+T('mr.tank','Meld aan')+'</button></div>';
    h += (d.brandstof||[]).filter(b=>b.status==='gevraagd').map(b=>'<div class="sub" style="padding:0.3rem 0;">'+esc(b.boot)+' · '+esc(b.soort)+' · '+b.liters+' l '+knop('data-mrbk', b.id, T('mr.getankt','Getankt'), true)+'</div>').join('');

    // service en de hellingbaan
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('mr.service','Service en de helling')+'</div>'+
      '<div class="row-gap"><input id="mrSBoot" class="st-in" placeholder="'+T('mr.boot','Naam boot')+'" maxlength="60" style="flex:2;"><select id="mrSSoort" class="st-in" style="flex:1;">'+Object.keys(MR_SVC).map(s=>'<option value="'+s+'">'+MR_SVC[s]+'</option>').join('')+'</select>'+
      '<input id="mrSWens" class="st-in" placeholder="'+T('mr.wens','Wat moet er gebeuren?')+'" maxlength="160" style="flex:3;"><button id="mrSVraag" style="flex:1;'+goud+'">'+T('mr.tank','Meld aan')+'</button></div>';
    h += (d.service||[]).filter(s=>s.status!=='klaar').map(s=>'<div style="display:flex;gap:0.5rem;align-items:center;border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
      '<span class="sub" style="flex:0 0 7rem;">'+MR_SVC[s.soort]+'</span><b style="flex:1;font-size:0.82rem;">'+esc(s.boot)+' · '+esc(s.wens)+'</b><span class="sub">'+esc(s.status)+'</span>'+
      (s.status==='open'?knop('data-mrsb', s.id, T('mr.pak','Oppakken'), true):knop('data-mrsk', s.id, T('mr.klaar','Klaar'), true))+'</div>').join('') || '<p class="sub">'+T('mr.svc.geen','Geen open verzoeken op de werf.')+'</p>';

    // de marina-concierge: de jetset op het water
    h += '<div class="st-sec" style="margin-top:1rem;">'+T('mr.concierge','De marina-concierge')+'</div>'+
      '<div class="row-gap"><select id="mrCSoort" class="st-in" style="flex:1;">'+Object.keys(MR_CON).map(s=>'<option value="'+s+'">'+MR_CON[s]+'</option>').join('')+'</select>'+
      '<input id="mrCVoor" class="st-in" placeholder="'+T('mr.voor','Voor wie')+'" maxlength="60" style="flex:1;"><input id="mrCWens" class="st-in" placeholder="'+T('mr.cwens','De wens (bijv. tender om 12:00 naar de baai)')+'" maxlength="160" style="flex:3;">'+
      '<button id="mrCVraag" style="flex:1;'+goud+'">'+T('mr.vraag','Vraag aan')+'</button></div>';
    h += (d.concierge||[]).map(c=>'<div style="border:1px solid '+(c.status==='afgerond'?'var(--line)':'var(--gold)')+';border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;">'+
      '<div style="display:flex;gap:0.5rem;align-items:baseline;"><b style="flex:1;font-size:0.85rem;">'+MR_CON[c.soort]+' · '+esc(c.voorWie)+'</b><span class="sub">'+esc(c.status)+'</span></div>'+
      '<div class="sub">'+esc(c.wens)+' · '+esc(c.moment)+(c.notitie?' · '+esc(c.notitie):'')+'</div>'+
      (c.status!=='afgerond'?'<div style="display:flex;gap:0.4rem;margin-top:0.45rem;">'+
        (c.status==='aangevraagd'?knop('data-mrcb', c.id, T('mr.bevestig','Bevestig'), true):'')+knop('data-mrca', c.id, T('mr.afgerond','Afgerond'))+'</div>':'')+'</div>').join('');
    h += '<p class="sub" style="margin-top:0.5rem;">'+T('mr.regel','Een charter-transfer is een dienstverzoek aan RTG Charter; de concierge bevestigt pas na overleg, nooit vanzelf.')+'</p>';
    el.innerHTML = h;

    const doe = (sel, pad, body) => el.querySelectorAll('['+sel+']').forEach(b => b.addEventListener('click', async () => {
      try { await API.call(pad, body(b.dataset)); renderMarina(); } catch(e){ toast(e.message); }
    }));
    const bnd = (id, fn) => { const b = el.querySelector('#'+id); if (b) b.addEventListener('click', fn); };
    bnd('mrMeld', async () => { try { const r = await API.call('/supplier/marina/passant', { naam: $('#mrBoot').value, eigenaar: $('#mrEig').value, lengte: $('#mrLen').value, nachten: $('#mrNacht').value }); toast(T('mr.toegewezen','Ligplaats')+' '+r.ligplaats.id+' · '+eur(r.prijs)); renderMarina(); } catch(e){ toast(e.message); } });
    bnd('mrBVraag', async () => { try { await API.call('/supplier/marina/brandstof', { boot: $('#mrBBoot').value, soort: $('#mrBSoort').value, liters: $('#mrBLiters').value }); renderMarina(); } catch(e){ toast(e.message); } });
    bnd('mrSVraag', async () => { try { await API.call('/supplier/marina/service', { boot: $('#mrSBoot').value, soort: $('#mrSSoort').value, wens: $('#mrSWens').value }); renderMarina(); } catch(e){ toast(e.message); } });
    bnd('mrCVraag', async () => { try { await API.call('/supplier/marina/concierge', { soort: $('#mrCSoort').value, voorWie: $('#mrCVoor').value, wens: $('#mrCWens').value }); renderMarina(); } catch(e){ toast(e.message); } });
    doe('data-mrweg', '/supplier/marina/vertrek', ds => ({ id: ds.mrweg }));
    doe('data-mrbk', '/supplier/marina/brandstof/klaar', ds => ({ id: ds.mrbk }));
    doe('data-mrsb', '/supplier/marina/service/status', ds => ({ id: ds.mrsb, status: 'bezig' }));
    doe('data-mrsk', '/supplier/marina/service/status', ds => ({ id: ds.mrsk, status: 'klaar' }));
    doe('data-mrcb', '/supplier/marina/concierge/status', ds => ({ id: ds.mrcb, status: 'bevestigd' }));
    doe('data-mrca', '/supplier/marina/concierge/status', ds => ({ id: ds.mrca, status: 'afgerond' }));
  }

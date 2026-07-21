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


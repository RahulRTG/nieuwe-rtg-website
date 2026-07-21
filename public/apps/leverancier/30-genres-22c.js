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

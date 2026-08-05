    const pfAdd = $('#crPfAdd'); if (pfAdd) pfAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/platform', { platform: $('#crPfPlat').value, handle: $('#crPfHandle').value, volgers: Number($('#crPfVolg').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-trdel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { weg: true, id: b.dataset.trdel })); } catch(e){ toast(e.message); } }));
    const trAdd = $('#crTrAdd'); if (trAdd) trAdd.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/tarief', { soort: $('#crTrSoort').value, prijs: Number($('#crTrPrijs').value)||0 })); } catch(e){ toast(e.message); } });
    el.querySelectorAll('[data-ideest]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { id: b.dataset.ideest, status: b.dataset.st })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideedel]').forEach(b => b.addEventListener('click', async () => { try { crToe(await API.call('/supplier/creator/idee', { weg: true, id: b.dataset.ideedel })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-ideescript]').forEach(b => b.addEventListener('click', () => { const box = el.querySelector('[data-scriptbox="'+b.dataset.ideescript+'"]'); if (box) box.style.display = box.style.display==='none'?'block':'none'; }));
    const idAdd = $('#crIdAdd'); if (idAdd) idAdd.addEventListener('click', async () => { const tekst = $('#crIdTekst').value.trim(); if (!tekst) return; try { crToe(await API.call('/supplier/creator/idee', { tekst, voor: $('#crIdVoor').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#crAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#crAiIn').value.trim(); if (!opdracht) return; const out = $('#crAiOut'); out.innerHTML = '<div class="ds">'+T('cr.aidenkt','Even denken...')+'</div>';
        try { const r = await API.call('/supplier/creator/ai', { opdracht }); out.innerHTML = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>'; $('#crAiIn').value=''; if (r.overzicht){ cr = r.overzicht; } if (r.gedaan) renderCreator(); }
        catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } };
      aiGo.addEventListener('click', doe);
      const aiIn = $('#crAiIn'); if (aiIn) aiIn.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- samenwerken: creators <-> leveranciers, met EGn knop ----
  let sw = null, swLijst = null;
  const kortN = n => n >= 1000 ? (Math.round(n/100)/10)+'K' : String(n);
  async function laadSamenwerking(){
    if (!API.live) return;
    try { sw = await API.call('/supplier/samenwerking/mijn', {}); } catch(e){ sw = null; }
    try { swLijst = sw && sw.isCreator ? { leveranciers: (await API.call('/supplier/samenwerking/leveranciers', {})).leveranciers } : { creators: (await API.call('/supplier/samenwerking/creators', {})).creators }; } catch(e){ swLijst = {}; }
    renderSamenwerking();
  }
  function renderSamenwerking(){
    const el = $('#swWrap'); if (!el) return;
    if (!sw){ el.innerHTML = '<div class="empty">…</div>'; laadSamenwerking(); return; }
    const canEdit = actor().manager, mk = sw.isCreator;
    const st = 'style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const kaartAnder = a => a.niche != null || a.bereik != null
      ? '<b>'+esc(a.name)+'</b>'+(a.niche?' · '+esc(a.niche):'')+(a.bereik?' · '+kortN(a.bereik)+' '+T('sw.bereik','bereik'):'')
      : (a.icon||'')+' <b>'+esc(a.name)+'</b>'+(a.typeLabel?' · '+esc(a.typeLabel):'');
    const statusKl = { 'voorgesteld':'var(--gold)', 'geaccepteerd':'#7EE0A3', 'afgewezen':'#E0736A' };
    let html = '';
    // lopende samenwerkingen (in + uit)
    const inl = (sw.voorstellen&&sw.voorstellen.in)||[], uitl = (sw.voorstellen&&sw.voorstellen.uit)||[];
    html += '<div class="card"><div class="tt-h">'+T('sw.mijn','Mijn samenwerkingen')+'</div>'+
      (inl.length||uitl.length ? [].concat(inl,uitl).map(x => '<div class="mitem" style="border-left:3px solid '+(statusKl[x.status]||'var(--soft)')+';"><div class="r1"><span class="nm">'+kaartAnder(x.ander)+'</span><span class="pr" style="color:'+(statusKl[x.status]||'var(--soft)')+';">'+T('sw.st.'+x.status, x.status)+'</span></div>'+
        (x.bericht?'<div class="ds">'+esc(x.bericht)+(x.budget?' · € '+x.budget:'')+(x.soort?' · '+esc(x.soort):'')+'</div>':'')+
        (x.richting==='in'&&x.status==='voorgesteld'&&canEdit ? '<div style="margin-top:0.4rem;display:flex;gap:0.4rem;"><button class="obtn primary" data-swja="'+x.id+'">'+T('sw.accept','Accepteren')+'</button><button class="obtn" data-swnee="'+x.id+'">'+T('sw.afwijs','Afwijzen')+'</button></div>' : '')+
        '</div>').join('')
        : '<div class="ds h-mt50">'+T('sw.geen','Nog geen samenwerkingen. Start er hieronder een.')+'</div>')+'</div>';


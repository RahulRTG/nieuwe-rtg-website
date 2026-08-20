/* creator: leveranciers vinden en open oproepen */
    if (mk){
      // CREATOR: leveranciers vinden + open oproepen
      html += '<div class="card"><div class="tt-h">'+T('sw.vind','Vind een leverancier om mee samen te werken')+'</div>'+
        ((swLijst&&swLijst.leveranciers)||[]).slice(0,40).map(l => '<div class="mitem"><div class="r1"><span class="nm">'+(window.RTGGlyf?RTGGlyf.svgHTML(l.icon,{klasse:'gl-inline'}):'')+' '+esc(l.name)+'</span><span class="pr" style="font-size:0.72rem;color:var(--soft);">'+esc(l.typeLabel||'')+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+l.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+l.code+'">'+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
      const oproepen = (sw.openOproepen||[]).filter(op => !op.ikReageerde);
      html += '<div class="card"><div class="tt-h">'+T('sw.oproepen','Open oproepen van leveranciers')+' ('+oproepen.length+')</div>'+
        (oproepen.length ? oproepen.map(op => '<div class="mitem"><div class="r1"><span class="nm">'+esc(op.titel)+'</span><span class="pr">'+(op.budget?'€ '+op.budget:'')+'</span></div>'+
          '<div class="ds">'+(op.van?esc(op.van.name)+' · ':'')+esc(op.omschrijving||'')+(op.soort?' · '+esc(op.soort):'')+'</div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.reactie','Jouw reactie...')+'" data-swreactie="'+op.id+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swreageer="'+op.id+'">'+T('sw.reageer','Reageer')+'</button></div>':'')+'</div>').join('')
          : '<div class="ds h-mt50">'+T('sw.geenoproep','Nu geen open oproepen.')+'</div>')+'</div>';
    } else {
      // LEVERANCIER: creators oproepen + reacties + creators direct benaderen
      if (canEdit) html += '<div class="card"><div class="tt-h">'+T('sw.roepop','Roep content creators op')+'</div>'+
        '<div style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem;"><input id="swOpTitel" placeholder="'+T('sw.optitel','Titel (bijv. Zomercampagne)')+'" '+st+'><input id="swOpOms" placeholder="'+T('sw.opoms','Wat zoek je?')+'" '+st+'><div style="display:flex;gap:0.4rem;"><select id="swOpSoort" '+st+'>'+['reel','post','video','campagne','review','story'].map(x=>'<option value="'+x+'">'+x+'</option>').join('')+'</select><input id="swOpBudget" type="number" min="0" placeholder="'+T('sw.budget','budget €')+'" style="width:7rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.5rem;color:var(--txt);"><button class="obtn primary" id="swOpPlaats">'+T('sw.plaats','Plaats oproep')+'</button></div></div></div>';
      // mijn oproepen met reacties
      (sw.mijnOproepen||[]).forEach(op => {
        html += '<div class="card"><div class="tt-h">'+esc(op.titel)+' '+(op.open?'<span style="font-size:0.68rem;color:#7EE0A3;">'+T('sw.open','open')+'</span>':'<span style="font-size:0.68rem;color:var(--soft);">'+T('sw.dicht','gesloten')+'</span>')+'</div>'+
          '<div class="ds" style="margin-bottom:0.4rem;">'+esc(op.omschrijving||'')+(op.budget?' · € '+op.budget:'')+'</div>'+
          ((op.reacties||[]).length ? (op.reacties||[]).map(r => '<div class="mitem"><div class="r1"><span class="nm">'+esc(r.creator.name)+(r.creator.bereik?' · '+kortN(r.creator.bereik):'')+'</span>'+(r.status==='gekozen'?'<span class="pr" style="color:#7EE0A3;">'+T('sw.gekozen','gekozen')+'</span>':'')+'</div>'+
            (r.bericht?'<div class="ds">'+esc(r.bericht)+'</div>':'')+
            (canEdit&&r.status!=='gekozen'&&op.open?'<div class="h-mt35"><button class="obtn primary" data-swkies="'+op.id+'" data-creator="'+r.creatorCode+'">'+T('sw.kiesdeze','Kies deze creator')+'</button></div>':'')+'</div>').join('')
            : '<div class="ds">'+T('sw.geenreacties','Nog geen reacties.')+'</div>')+
          (canEdit&&op.open?'<button class="obtn" data-swsluit="'+op.id+'" class="h-mt50">'+T('sw.sluit','Oproep sluiten')+'</button>':'')+'</div>';
      });
      // creators direct benaderen
      html += '<div class="card"><div class="tt-h">'+T('sw.vindcreator','Benader een creator direct')+'</div>'+
        ((swLijst&&swLijst.creators)||[]).slice(0,40).map(c => '<div class="mitem"><div class="r1"><span class="nm">'+esc(c.name)+(c.niche?' · '+esc(c.niche):'')+'</span><span class="pr">'+kortN(c.bereik||0)+'</span></div>'+
          (canEdit?'<div style="margin-top:0.4rem;display:flex;gap:0.4rem;flex-wrap:wrap;"><input placeholder="'+T('sw.pitch','Korte pitch...')+'" data-swpitch="'+c.code+'" '+st+' style="flex:1;min-width:8rem;"><button class="obtn primary" data-swvoorstel="'+c.code+'">'+T('sw.werksamen','Werk samen')+'</button></div>':'')+'</div>').join('')+'</div>';
    }
    el.innerHTML = html;
    // wiring
    el.querySelectorAll('[data-swja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swja, actie: 'accepteren' }); toast(T('sw.geaccept','Samenwerking geaccepteerd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/beslis', { id: b.dataset.swnee, actie: 'afwijzen' }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swvoorstel]').forEach(b => b.addEventListener('click', async () => { const pi = el.querySelector('[data-swpitch="'+b.dataset.swvoorstel+'"]'); try { await API.call('/supplier/samenwerking/voorstel', { naarCode: b.dataset.swvoorstel, bericht: pi?pi.value:'' }); toast(T('sw.verstuurd','Voorstel verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swreageer]').forEach(b => b.addEventListener('click', async () => { const ri = el.querySelector('[data-swreactie="'+b.dataset.swreageer+'"]'); try { await API.call('/supplier/samenwerking/reageer', { oproepId: b.dataset.swreageer, bericht: ri?ri.value:'' }); toast(T('sw.gereageerd','Reactie verstuurd.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swkies]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/kies', { oproepId: b.dataset.swkies, creatorCode: b.dataset.creator }); toast(T('sw.gekozenok','Creator gekozen; samenwerking staat vast.')); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-swsluit]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/supplier/samenwerking/oproep/sluit', { id: b.dataset.swsluit }); laadSamenwerking(); } catch(e){ toast(e.message); } }));
    const opP = $('#swOpPlaats'); if (opP) opP.addEventListener('click', async () => { const titel = $('#swOpTitel').value.trim(); if (!titel) return; try { await API.call('/supplier/samenwerking/oproep', { titel, omschrijving: $('#swOpOms').value, soort: $('#swOpSoort').value, budget: Number($('#swOpBudget').value)||0 }); toast(T('sw.oproepok','Oproep geplaatst; creators zien het.')); laadSamenwerking(); } catch(e){ toast(e.message); } });
  }

  // ---- facturen: automatisch bij elke verkoop, plus de AI-factuurtool ----
  let fact = null, factAiAntwoord = '';   // het laatste AI-antwoord blijft staan over herbouw heen
  async function laadFacturen(){
    if (!API.live) return;
    try { fact = await API.call('/supplier/facturen/mijn', {}); } catch(e){ fact = { verkocht:[], gekocht:[], stats:{} }; }
    renderFacturen();
  }
  function factRij(f, kant){
    return '<div class="mitem"><div class="r1"><span class="nm">'+esc(f.nummer)+' · '+esc(kant==='in'?f.verkoper:f.koper)+'</span><span class="pr">'+geld(f.totaal)+'</span></div>'+
      '<div class="ds">'+esc(f.datum)+' · '+T('fact.soort.'+f.soort, f.soort)+' · '+T('fact.btw','btw')+' '+geld(f.btwBedrag)+(f.methode?' · '+esc(f.methode):'')+'</div>'+
      '<div class="h-mt35"><button class="obtn" data-factpdf="'+f.id+'" data-nr="'+escAttr(f.nummer)+'">PDF</button></div></div>';
  }
  function renderFacturen(){
    const el = $('#factWrap'); if (!el) return;
    if (!fact){ el.innerHTML = '<div class="empty">…</div>'; laadFacturen(); return; }
    const canEdit = actor().manager, st = fact.stats || {};
    let html = '';
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      [[st.verkocht||0, T('fact.verkocht','verkoopfacturen')],[geld(st.omzet||0), T('fact.omzet','omzet')],[geld(st.btwAfdracht||0), T('fact.btwaf','btw')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.05rem;font-weight:700;color:var(--rtg-leesgoud,var(--gold));">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';

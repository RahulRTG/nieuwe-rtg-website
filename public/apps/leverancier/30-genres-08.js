    if (!API.live) return;
    try { fact = await API.call('/supplier/facturen/mijn', {}); } catch(e){ fact = { verkocht:[], gekocht:[], stats:{} }; }
    renderFacturen();
  }
  function factRij(f, kant){
    return '<div class="mitem"><div class="r1"><span class="nm">'+esc(f.nummer)+' · '+esc(kant==='in'?f.verkoper:f.koper)+'</span><span class="pr">'+geld(f.totaal)+'</span></div>'+
      '<div class="ds">'+esc(f.datum)+' · '+T('fact.soort.'+f.soort, f.soort)+' · '+T('fact.btw','btw')+' '+geld(f.btwBedrag)+(f.methode?' · '+esc(f.methode):'')+'</div>'+
      '<div style="margin-top:0.35rem;"><button class="obtn" data-factpdf="'+f.id+'" data-nr="'+escAttr(f.nummer)+'">⬇ PDF</button></div></div>';
  }
  function renderFacturen(){
    const el = $('#factWrap'); if (!el) return;
    if (!fact){ el.innerHTML = '<div class="empty">…</div>'; laadFacturen(); return; }
    const canEdit = actor().manager, st = fact.stats || {};
    let html = '';
    html += '<div class="card"><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.5rem;">'+
      [[st.verkocht||0, T('fact.verkocht','verkoopfacturen')],[geld(st.omzet||0), T('fact.omzet','omzet')],[geld(st.btwAfdracht||0), T('fact.btwaf','btw')]]
      .map(c => '<div style="background:var(--card2,var(--card));border:1px solid var(--line);border-radius:12px;padding:0.6rem;text-align:center;"><div style="font-size:1.05rem;font-weight:700;color:var(--gold);">'+c[0]+'</div><div style="font-size:0.6rem;color:var(--soft);text-transform:uppercase;letter-spacing:0.05em;">'+c[1]+'</div></div>').join('')+'</div></div>';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">✨ '+T('fact.ai','AI-factuurtool')+'</div>'+
        '<p class="sub" style="margin-top:0.3rem;">'+T('fact.ai.sub','Vraag iets, of maak een factuur in gewone taal: "maak een factuur voor [codenaam], 3 uur advies a 90 euro".')+'</p>'+
        '<div id="factAiOut" style="margin-top:0.5rem;"></div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.5rem;"><input id="factAiIn" placeholder="'+T('fact.ai.ph','Vraag of opdracht...')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.7rem;color:var(--txt);"><button class="obtn primary" id="factAiGo">'+T('fact.ai.go','Vraag')+'</button></div></div>';
    }
    html += '<div class="card"><div class="tt-h">'+T('fact.uit','Verstuurde facturen')+' ('+(fact.verkocht||[]).length+')</div>'+
      ((fact.verkocht||[]).length ? (fact.verkocht||[]).slice(0,60).map(f => factRij(f,'uit')).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('fact.geenuit','Nog geen facturen. Bij elke kassaverkoop komt hier automatisch een factuur.')+'</div>')+'</div>';
    if ((fact.gekocht||[]).length) html += '<div class="card"><div class="tt-h">'+T('fact.in','Ontvangen facturen')+' ('+fact.gekocht.length+')</div>'+
      fact.gekocht.slice(0,60).map(f => factRij(f,'in')).join('')+'</div>';
    el.innerHTML = html;
    // het laatste AI-antwoord terugzetten, zodat een tussentijdse herbouw (bijv.
    // door de sync-SSE van de nieuwe factuur) het niet wegveegt
    const outHerstel = $('#factAiOut'); if (outHerstel && factAiAntwoord) outHerstel.innerHTML = factAiAntwoord;
    el.querySelectorAll('[data-factpdf]').forEach(b => b.addEventListener('click', () => dlBestand('/supplier/facturen/pdf', { id: b.dataset.factpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    const aiGo = $('#factAiGo'); if (aiGo){
      const doe = async () => { const opdracht = $('#factAiIn').value.trim(); if (!opdracht) return; factAiAntwoord = '<div class="ds">…</div>'; const out = $('#factAiOut'); out.innerHTML = factAiAntwoord;
        try { const r = await API.call('/supplier/facturen/ai', { opdracht });
          factAiAntwoord = '<div class="mitem"'+(r.gedaan?' style="border-left:3px solid #7EE0A3;"':'')+'><div class="ds" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div></div>';
          if (r.overzicht){ fact = r.overzicht; }
          renderFacturen(); }
        catch(e){ factAiAntwoord = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; const o2 = $('#factAiOut'); if (o2) o2.innerHTML = factAiAntwoord; } };
      aiGo.addEventListener('click', doe);
      const i2 = $('#factAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); });
    }
  }

  // ---- De Salon: de zaak verkoopt (optioneel) op de gezinsmarktplaats ----
  let rtfmData = null, rtfmCats = [], rtfmStaatVar = 'gebruikt', rtfmBusy = false;
  async function laadRtfm(){
    if (rtfmBusy) return; rtfmBusy = true;
    try { rtfmData = await API.call('/supplier/markt/mijn', {}); if (rtfmData.categorieen) rtfmCats = rtfmData.categorieen; }
    catch(e){ rtfmData = { ads: [], postvak: [] }; }
    rtfmBusy = false; renderRtfMarkt();
  }
  function rtfmCatNaam(c){ return ({kleding:'Kleding',kids:'Kids & baby',wonen:'Wonen',elektronica:'Elektronica','vrije-tijd':'Vrije tijd',tuin:'Tuin',vervoer:'Vervoer',boeken:'Boeken',sport:'Sport',overig:'Overig'}[c])||c; }
  function renderRtfMarkt(){
    const el = $('#mktWrap'); if (!el) return;
    if (!rtfmData){ el.innerHTML = '<div class="empty">…</div>'; laadRtfm(); return; }
    const canEdit = actor().manager;
    let html = '';
    if (canEdit){
      html += '<div class="card"><div class="tt-h">➕ '+T('mkt.plaats','Plaats een advertentie')+'</div>'+
        '<input id="mktTitel" placeholder="'+T('mkt.titel','Titel, bijv. Etalagepop tweedehands')+'" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.5rem;">'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<select id="mktCat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+rtfmCats.map(c=>'<option value="'+c+'">'+rtfmCatNaam(c)+'</option>').join('')+'</select>'+
          '<select id="mktStaat" style="flex:1;min-width:8rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);"><option value="gebruikt">Gebruikt</option><option value="zgan">Zo goed als nieuw</option><option value="nieuw">Nieuw</option></select>'+
          '<input id="mktPrijs" type="number" inputmode="numeric" placeholder="€" style="width:5.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
        '</div>'+
        '<textarea id="mktOms" placeholder="'+T('mkt.oms','Omschrijving')+'" style="width:100%;min-height:4rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);margin-top:0.4rem;"></textarea>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.4rem;flex-wrap:wrap;">'+
          '<input id="mktPlaats" placeholder="'+T('mkt.plaatsnaam','Plaats')+'" style="flex:1;min-width:6rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.55rem 0.6rem;color:var(--txt);">'+
          '<button class="obtn" id="mktAiOms">✨ '+T('mkt.aioms','AI-omschrijving')+'</button>'+
          '<button class="obtn" id="mktAiPrijs">✨ '+T('mkt.aiprijs','AI-prijs')+'</button>'+
        '</div>'+
        '<div id="mktAiUit" class="sub" style="margin-top:0.35rem;color:var(--gold);"></div>'+
        '<label style="display:flex;gap:0.5rem;align-items:flex-start;font-size:0.8rem;color:var(--soft);margin:0.6rem 0;"><input type="checkbox" id="mktAkkoord" style="margin-top:0.2rem;"><span>'+T('mkt.akkoord','Ik bied alleen toegestane waar aan en houd het netjes en respectvol.')+'</span></label>'+
        '<button class="obtn primary" id="mktPlaatsBtn" style="width:100%;">'+T('mkt.plaatsbtn','Zet in De Salon')+'</button>'+
        '<div id="mktMelding" class="sub" style="margin-top:0.4rem;"></div></div>';
    }
    const ads = rtfmData.ads || [];
    html += '<div class="card"><div class="tt-h">'+T('mkt.mijn','Mijn advertenties')+' ('+ads.length+')</div>'+
      (ads.length ? ads.map(a =>
        '<div class="mitem" style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;flex-wrap:wrap;"><div><b>'+esc(a.titel)+'</b><div class="ds">'+(a.prijs>0?'€ '+a.prijs:'Gratis')+' · '+a.status+(a.meldingen?' · '+a.meldingen+' melding(en)':'')+'</div></div>'+
        '<div style="display:flex;gap:0.3rem;">'+(canEdit?(a.status!=='verkocht'?'<button class="obtn" data-mktverk="'+a.id+'">'+T('mkt.verkocht','Verkocht')+'</button>':'<button class="obtn" data-mktheropen="'+a.id+'">'+T('mkt.heropen','Te koop')+'</button>')+'<button class="obtn warn" data-mktdel="'+a.id+'">'+T('mkt.del','Verwijder')+'</button>':'')+'</div></div>'
      ).join('') : '<div class="ds" style="margin-top:0.5rem;">'+T('mkt.geen','Nog niets geplaatst. Zet uw eerste advertentie hierboven.')+'</div>')+'</div>';
    const pv = rtfmData.postvak || [];

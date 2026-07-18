    if (pv.length) html += '<div class="card"><div class="tt-h">'+T('mkt.berichten','Berichten')+' ('+pv.length+')</div>'+
      pv.map(c => '<div class="mitem"><b>'+esc(c.adTitel)+'</b><div class="ds">'+esc(c.metNaam)+': '+esc(c.laatste)+'</div></div>').join('')+'</div>';
    el.innerHTML = html;
    const uit = $('#mktAiUit');
    const aiOms = $('#mktAiOms'); if (aiOms) aiOms.addEventListener('click', async () => {
      const titel = $('#mktTitel').value.trim(); if (!titel){ uit.textContent = T('mkt.eerst','Vul eerst een titel in.'); return; }
      try { const r = await API.call('/supplier/markt/ai', { soort:'beschrijving', titel, beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.tekst) $('#mktOms').value = r.tekst; } catch(e){}
    });
    const aiPr = $('#mktAiPrijs'); if (aiPr) aiPr.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/markt/ai', { soort:'prijs', titel:$('#mktTitel').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value }); if (r.prijs && !$('#mktPrijs').value) $('#mktPrijs').value = r.prijs.midden; uit.textContent = r.tekst||''; } catch(e){}
    });
    const plaatsBtn = $('#mktPlaatsBtn'); if (plaatsBtn) plaatsBtn.addEventListener('click', async () => {
      const m = $('#mktMelding');
      try {
        const r = await API.call('/supplier/markt/plaats', { akkoord:$('#mktAkkoord').checked, titel:$('#mktTitel').value.trim(), beschrijving:$('#mktOms').value.trim(), categorie:$('#mktCat').value, staat:$('#mktStaat').value, prijs:Number($('#mktPrijs').value)||0, plaats:$('#mktPlaats').value.trim(), levering:['ophalen'] });
        m.style.color = '#7EE0A3'; m.textContent = r.waarschuwing ? T('mkt.let','Geplaatst. Let op: ')+r.waarschuwing : T('mkt.gedaan','Geplaatst in De Salon.');
        rtfmData = null; laadRtfm();
      } catch(e){ m.style.color = '#E0736A'; m.textContent = e.message; }
    });
    el.querySelectorAll('[data-mktverk]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktverk, status:'verkocht' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktheropen]').forEach(b => b.addEventListener('click', async () => { await API.call('/supplier/markt/status', { id:b.dataset.mktheropen, status:'te-koop' }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
    el.querySelectorAll('[data-mktdel]').forEach(b => b.addEventListener('click', async () => { if(!confirm(T('mkt.delc','Deze advertentie verwijderen?')))return; await API.call('/supplier/markt/verwijder', { id:b.dataset.mktdel }).catch(()=>{}); rtfmData=null; laadRtfm(); }));
  }

  // ---- retail / mode: de slimme merk-backoffice ----
  let retailData = null;         // volledige retail-toestand van de server
  let retailSec = 'overzicht';   // overzicht | catalogus | voorraad | clienteling
  let retailKlant = null;        // geopend klantdossier (clienteling)
  let retailArtBewerk = null;    // id van het artikel dat bewerkt wordt (of 'nieuw')
  const RSEC = [['overzicht','📈','Overzicht'],['catalogus','👗','Collecties'],['voorraad','📦','Voorraad'],['clienteling','💎','Klanten']];
  async function laadRetail(){
    if (!has('retail') || !API.live) return;
    try { retailData = (await API.call('/supplier/retail', {})).retail; } catch(e){ retailData = { collecties:[], artikelen:[], apart:[], paskamer:[], styling:[], klanten:[], stats:{}, maten:[], seizoenen:[] }; }
    renderRetail();
  }
  function rSelStyle(){ return 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"'; }
  function retailSubnav(){
    return '<div class="st-chips" style="display:flex;gap:0.4rem;overflow-x:auto;margin-bottom:0.9rem;-webkit-overflow-scrolling:touch;">'+
      RSEC.map(s => { const on = retailSec===s[0]; return '<button data-rsec="'+s[0]+'" style="white-space:nowrap;border:1px solid '+(on?'var(--gold)':'var(--line)')+';background:var(--card2);color:'+(on?'var(--gold)':'var(--txt)')+';border-radius:999px;padding:0.5rem 0.9rem;font-size:0.74rem;font-weight:'+(on?'600':'500')+';">'+s[1]+' '+T('rt.sec.'+s[0], s[2])+'</button>'; }).join('')+'</div>';
  }
  function collNaam(cid){ const c = (retailData.collecties||[]).find(x => x.id===cid); return c ? (c.seizoen+' '+c.jaar+' · '+c.naam) : T('rt.los','Losse artikelen'); }
  function renderRetail(){
    const el = $('#retailWrap'); if (!el) return;
    if (!has('retail')){ el.innerHTML = ''; return; }
    if (!retailData){ el.innerHTML = '<div class="empty">…</div>'; laadRetail(); return; }
    const canEdit = actor().manager;
    let html = retailSubnav();
    if (retailSec === 'overzicht') html += retailOverzicht(canEdit);
    else if (retailSec === 'catalogus') html += retailCatalogusView(canEdit);
    else if (retailSec === 'voorraad') html += retailVoorraadView();
    else if (retailSec === 'clienteling') html += retailClienteling(canEdit);
    el.innerHTML = html;
    el.querySelectorAll('[data-rsec]').forEach(b => b.addEventListener('click', () => { retailSec = b.dataset.rsec; retailKlant = null; retailArtBewerk = null; renderRetail(); }));
    retailBindActions(el, canEdit);
  }
  function retailOverzicht(canEdit){
    const st = retailData.stats || {};
    const kpi = (v,l) => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.8rem;"><div style="font-size:1.25rem;font-weight:700;">'+v+'</div><div class="tt-h" style="margin-top:0.15rem;">'+l+'</div></div>';
    let html = '<div class="card"><div class="tt-h">'+T('rt.vandaag','Vandaag')+'</div>'+
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.5rem;margin-top:0.6rem;">'+
      kpi(geld(st.omzetVandaag||0), T('rt.omzet','omzet'))+kpi(st.bonnenVandaag||0, T('rt.bonnen','bonnen'))+kpi(st.klanten||0, T('rt.klanten','klanten'))+
      kpi(st.artikelen||0, T('rt.artikelen','artikelen'))+kpi(st.voorraadTotaal||0, T('rt.voorraad','stuks voorraad'))+kpi((retailData.paskamer||[]).length+(retailData.apart||[]).length, T('rt.vloer','op de vloer'))+
      '</div></div>';
    // bestsellers
    const bs = st.bestsellers || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bestsellers','Bestsellers')+'</div>'+
      (bs.length ? '<div style="margin-top:0.5rem;">'+bs.map((b,i) => '<div class="mitem"><div class="r1"><span class="nm">'+(i+1)+'. '+esc(b.naam)+'</span><span class="pr">'+b.aantal+'×</span></div></div>').join('') + '</div>'
        : '<div class="empty">'+T('rt.geenverkoop','Nog geen verkopen vandaag.')+'</div>')+'</div>';
    // sell-through per collectie (balkjes)
    const sthr = st.sellThrough || [];
    if (sthr.length) html += '<div class="card"><div class="tt-h">'+T('rt.sellthrough','Sell-through per collectie')+'</div>'+
      '<div style="margin-top:0.5rem;display:grid;gap:0.6rem;">'+sthr.map(c =>
        '<div><div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>'+esc(c.collectie)+'</span><span style="color:var(--gold);">'+c.pct+'%</span></div>'+
        '<div style="height:7px;background:var(--card2);border-radius:999px;margin-top:0.3rem;overflow:hidden;"><div style="height:100%;width:'+c.pct+'%;background:var(--gold);"></div></div>'+
        '<div class="tt-h" style="margin-top:0.2rem;">'+c.verkocht+' '+T('rt.verkocht','verkocht')+' · '+c.voorraad+' '+T('rt.opvoorraad','op voorraad')+'</div></div>').join('')+'</div></div>';
    // lage voorraad / bijbestellen
    const laag = st.laag || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bijbestel','Bijbestellen (lage voorraad)')+'</div>'+
      (laag.length ? '<div style="margin-top:0.5rem;">'+laag.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr" style="color:'+(v.voorraad<=0?'var(--burgundy)':'var(--amber)')+';">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+esc(v.vsku)+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.voorraadok','Alle maten ruim op voorraad.')+'</div>')+'</div>';
    // open paskamerverzoeken (ook af te handelen vanuit de backoffice)
    const pk = retailData.paskamer || [];
    if (pk.length) html += '<div class="card"><div class="tt-h">'+T('rt.paskamer','Paskamerverzoeken')+'</div>'+
      '<div style="margin-top:0.5rem;">'+pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikelNaam)+'</span><span class="pr">'+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<div style="margin-top:0.4rem;"><button class="obtn primary" data-rpkbreng="'+v.id+'">'+T('rt.breng','Breng gebracht')+'</button></div></div>').join('')+'</div></div>';
    // artikelen met een aangekondigde drop (release)

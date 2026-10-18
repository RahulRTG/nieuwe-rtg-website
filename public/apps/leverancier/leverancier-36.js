/* iets op de marktplaats plaatsen */
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
  const RSEC = [['overzicht','','Overzicht'],['catalogus','','Collecties'],['voorraad','','Voorraad'],['clienteling','','Klanten']];
  async function laadRetail(){
    if (!has('retail') || !API.live) return;
    try { retailData = (await API.call('/supplier/retail', {})).retail; } catch(e){ retailData = { collecties:[], artikelen:[], apart:[], paskamer:[], styling:[], klanten:[], stats:{}, maten:[], seizoenen:[] }; }
    renderRetail();
  }
  function rSelStyle(){ return 'style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.7rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;"'; }
  function retailSubnav(){
    return '<div class="st-chips s-1jr4fe9">'+
      RSEC.map(s => { const on = retailSec===s[0]; return '<button data-rsec="'+s[0]+'" class="' + (on ? 's-52gokr' : 's-1ksq6wm') + '">'+s[1]+' '+T('rt.sec.'+s[0], s[2])+'</button>'; }).join('')+'</div>';
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
    const kpi = (v,l) => '<div class="s-eogdoi"><div class="s-plkwk7">'+v+'</div><div class="tt-h h-mt15">'+l+'</div></div>';
    let html = '<div class="card"><div class="tt-h">'+T('rt.vandaag','Vandaag')+'</div>'+
      '<div class="s-yie925">'+
      kpi(geld(st.omzetVandaag||0), T('rt.omzet','omzet'))+kpi(st.bonnenVandaag||0, T('rt.bonnen','bonnen'))+kpi(st.klanten||0, T('rt.klanten','klanten'))+
      kpi(st.artikelen||0, T('rt.artikelen','artikelen'))+kpi(st.voorraadTotaal||0, T('rt.voorraad','stuks voorraad'))+kpi((retailData.paskamer||[]).length+(retailData.apart||[]).length, T('rt.vloer','op de vloer'))+
      '</div></div>';
    // bestsellers
    const bs = st.bestsellers || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bestsellers','Bestsellers')+'</div>'+
      (bs.length ? '<div class="h-mt50">'+bs.map((b,i) => '<div class="mitem"><div class="r1"><span class="nm">'+(i+1)+'. '+esc(b.naam)+'</span><span class="pr">'+b.aantal+'×</span></div></div>').join('') + '</div>'
        : '<div class="empty">'+T('rt.geenverkoop','Nog geen verkopen vandaag.')+'</div>')+'</div>';
    // sell-through per collectie (balkjes)
    const sthr = st.sellThrough || [];
    if (sthr.length) html += '<div class="card"><div class="tt-h">'+T('rt.sellthrough','Sell-through per collectie')+'</div>'+
      '<div class="s-1ydzaen">'+sthr.map(c =>
        '<div><div class="s-99omnx"><span>'+esc(c.collectie)+'</span><span class="s-12itpbj">'+c.pct+'%</span></div>'+
        '<div class="s-1cq8pe0"><div style="height:100%;width:'+c.pct+'%;background:var(--gold);"></div></div>'+
        '<div class="tt-h h-mt20">'+c.verkocht+' '+T('rt.verkocht','verkocht')+' · '+c.voorraad+' '+T('rt.opvoorraad','op voorraad')+'</div></div>').join('')+'</div></div>';
    // lage voorraad / bijbestellen
    const laag = st.laag || [];
    html += '<div class="card"><div class="tt-h">'+T('rt.bijbestel','Bijbestellen (lage voorraad)')+'</div>'+
      (laag.length ? '<div class="h-mt50">'+laag.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikel)+'</span><span class="pr ' + (v.voorraad<=0 ? 's-popvjv' : 's-1qeblr2') + '">'+v.voorraad+'</span></div><div class="ds">'+esc(v.kleur)+' · '+T('rt.maat','maat')+' '+esc(v.maat)+' · '+esc(v.vsku)+'</div></div>').join('')+'</div>'
        : '<div class="empty">'+T('rt.voorraadok','Alle maten ruim op voorraad.')+'</div>')+'</div>';
    // open paskamerverzoeken (ook af te handelen vanuit de backoffice)
    const pk = retailData.paskamer || [];
    if (pk.length) html += '<div class="card"><div class="tt-h">'+T('rt.paskamer','Paskamerverzoeken')+'</div>'+
      '<div class="h-mt50">'+pk.map(v => '<div class="mitem"><div class="r1"><span class="nm">'+esc(v.artikelNaam)+'</span><span class="pr">'+esc(v.maat)+'</span></div>'+
        '<div class="ds">'+esc(v.codenaam||'Gast')+' · '+esc(v.kleur)+(v.paskamer?' · '+esc(v.paskamer):'')+'</div>'+
        '<div class="h-mt40"><button class="obtn primary" data-rpkbreng="'+v.id+'">'+T('rt.breng','Breng gebracht')+'</button></div></div>').join('')+'</div></div>';
    // artikelen met een aangekondigde drop (release)
    if (canEdit){
      const drops = (retailData.artikelen||[]).filter(a => a.drop && !a.drop.gereleased);
      if (drops.length) html += '<div class="card"><div class="tt-h">'+T('rt.drops','Aangekondigde drops')+'</div>'+
        '<div class="h-mt50">'+drops.map(a => '<div class="mitem"><div class="r1"><span class="nm">'+esc(a.naam)+'</span><span class="pr">'+esc(a.drop.datum)+' '+esc(a.drop.tijd)+'</span></div>'+
          '<div class="h-mt40"><button class="obtn primary" data-rrelease="'+a.id+'">'+T('rt.release','Nu vrijgeven')+'</button></div></div>').join('')+'</div></div>';
    }
    return html;
  }
  function retailCatalogusView(canEdit){
    let html = '';
    // collecties

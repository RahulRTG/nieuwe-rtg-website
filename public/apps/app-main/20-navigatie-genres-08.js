      const adres = concierge ? (prompt(T('vk.adres','Afleveradres:')) || '') : '';
      try { await API.call('/verkoop/koop', { supplierCode: b.dataset.code, autoId: b.dataset.id, bod: bod===''?undefined:bod, inruil, concierge, adres }); toast('' + T('vk.koopok','Aanvraag verstuurd. U hoort snel van de zaak.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
  }

  // Boodschappen bij een groothandel/supermarkt (consumentprijs, met bezorging)
  async function laadBoodschappen(){
    const el = $('#boodschappen'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/groothandel/markt'); mijn = await API.call('/groothandel/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const winkels = markt.groothandels || [];
    if (!winkels.length && !(mijn.bestellingen||[]).length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.4rem 0 0.3rem;font-size:1rem;">' + T('bo.h','Boodschappen') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('bo.sub','Bestel en laat bezorgen.') + '</p>';
    for (const g of winkels){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">' +
        '<b>' + escT(g.naam) + '</b><span class="sub"> · ' + escT(g.city||'') + '</span>' +
        g.producten.slice(0,50).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">' +
          '<div style="flex:1;"><span style="font-size:0.85rem;">' + escT(p.naam) + '</span><span class="sub"> · € ' + p.prijs + '/' + escT(p.eenheid) + '</span></div>' +
          '<input class="js-boq" data-code="' + g.code + '" data-pid="' + p.id + '" type="number" min="0" placeholder="0" aria-label="' + T('bo.aantal','Aantal') + '" style="width:3.6rem;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.35rem;color:var(--txt);font-family:inherit;"></div>').join('') +
        '<button class="js-bobestel" data-code="' + g.code + '" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('bo.bestel','Bezorgen') + '</button></div>';
    }
    if ((mijn.bestellingen||[]).length){
      h += '<div class="sub" style="margin:0.6rem 0 0.3rem;">' + T('bo.mijn','Mijn boodschappen') + '</div>';
      h += mijn.bestellingen.slice(0,10).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.35rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">' + escT(o.groothandelNaam) + ' · € ' + o.subtotaal + '</b><span class="sub">' + escT(o.status) + '</span></div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-bobestel').forEach(b => b.addEventListener('click', async () => {
      const regels = [];
      el.querySelectorAll('.js-boq[data-code="' + b.dataset.code + '"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
      if (!regels.length) return toast(T('bo.kies','Vul minstens een aantal in.'));
      try { await API.call('/groothandel/bestel', { groothandelCode: b.dataset.code, regels }); toast('' + T('bo.ok','Boodschappen besteld.')); laadBoodschappen(); } catch(e){ toast(e.message); }
    }));
  }
  async function laadBzMijn(){
    const el = $('#bzMijn'); if (!el || !API.live) return;
    let mijn = [];
    try { mijn = ((await API.call('/orders/mine')).orders || []).filter(o => o.levering && !['bezorgd','opgehaald','geweigerd','terugbetaald','wacht-op-betaling'].includes(o.status)); } catch(e){}
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = mijn.map(o => {
      const st = { 'nieuw': T('bz.m.nieuw','ontvangen door de zaak'), 'in bereiding': T('bz.m.bereid','wordt bereid'),
        'klaar': o.levering === 'ophalen' ? T('bz.m.haal','klaar om op te halen') : T('bz.m.wachtb','klaar, wacht op de bezorger'),
        'onderweg': T('bz.m.weg','onderweg naar u') }[o.status] || o.status;
      return '<div class="card" style="border-color:rgba(194,58,94,0.35);" data-bzvolg="'+o.ref+'">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+esc(o.supplierName)+' \u00B7 '+(o.levering==='ophalen'?T('bz.m.ophalen','ophalen'):T('bz.m.bezorgen','bezorging'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+st+'</b><span id="bzEta-'+o.ref+'">'+(o.status==='onderweg'&&o.etaMin?' \u00B7 \u23F1 '+o.etaMin+' min':'')+'</span></div>'+
        '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+
        (o.levering==='ophalen' ? ' \u00B7 '+T('bz.m.code','code')+' <b style="color:var(--gold);">'+o.pickup+'</b>' : (o.bezorger?' \u00B7 \uD83D\uDEF5 '+esc(o.bezorger.name):''))+'</div></div>';
    }).join('');
  }
  function opBezorg(d){
    // live: status, bezorger of GPS/ETA veranderd
    if (d.kind === 'gps'){
      const el = document.getElementById('bzEta-' + d.ref);
      if (el && d.etaMin) el.textContent = ' \u00B7 \u23F1 ' + d.etaMin + ' min';
      return;
    }
    laadBzMijn();
    if (d.kind === 'status' && (d.status === 'bezorgd' || d.status === 'opgehaald')) toast(T('bz.m.klaar2','Eet smakelijk! Uw bestelling is er.'));
  }
  function renderBestellen(){
    const el = $('#bzInhoud'); if (!el) return;
    if (bzZaak) return renderBzZaak();
    if (!bzPartners.length){
      el.innerHTML = '<div class="card"><div style="font-size:0.85rem;color:var(--muted);">'+T('bz.geen','Nog geen partners met een bezorgdienst op uw bestemming. Zodra een zaak de dienst opent, staat hij hier.')+'</div></div>';
      return;
    }
    el.innerHTML = bzPartners.map(p =>
      '<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;" data-bzkies="'+p.code+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;"><b>'+esc(p.name)+'</b><span class="soft-sm">'+esc(p.city||'')+'</span></div>'+
      '<div style="margin-top:0.3rem;font-size:0.76rem;color:var(--muted);">'+(p.bezorgen?'\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen'):'')+(p.bezorgen&&p.ophalen?' \u00B7 ':'')+(p.ophalen?'\uD83E\uDDFA '+T('bz.kan.oph','ophalen'):'')+' \u00B7 '+p.producten.length+' '+T('bz.prod','producten')+'</div></button>'
    ).join('');
    document.querySelectorAll('[data-bzkies]').forEach(b => b.addEventListener('click', () => {
      bzZaak = bzPartners.find(p => p.code === b.dataset.bzkies); bzMand = {};
      bzLevering = bzZaak.bezorgen ? 'bezorgen' : 'ophalen';
      renderBzZaak();
    }));
  }
  function bzTotaal(){ return (bzZaak.producten||[]).reduce((t,p) => t + (bzMand[p.id]||0) * p.price, 0); }
  function renderBzZaak(){
    const el = $('#bzInhoud'); if (!el) return;
    const p = bzZaak;
    const n = Object.values(bzMand).reduce((a,b)=>a+b,0);
    el.innerHTML =
      '<button class="bz-btn" id="bzTerug" style="margin-bottom:0.8rem;">\u2039 '+T('bz.terug','Alle partners')+'</button>'+
      '<div class="card"><b>'+esc(p.name)+'</b>'+
      p.producten.map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.7rem;">'+
        '<div style="flex:1;"><div style="font-size:0.88rem;">'+esc(x.name)+'</div>'+(x.desc?'<div class="soft-sm">'+esc(x.desc)+'</div>':'')+'</div>'+
        '<span style="color:var(--gold);font-size:0.82rem;">'+eur(x.price)+'</span>'+
        '<span style="display:flex;align-items:center;gap:0.45rem;">'+
        '<button class="bz-btn" data-bzmin="'+x.id+'" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+(bzMand[x.id]||0)+'</b><button class="bz-btn" data-bzplus="'+x.id+'" style="padding:0.2rem 0.7rem;">+</button></span></div>'
      ).join('')+'</div>'+
      '<div class="card">'+
      '<div style="display:flex;gap:0.5rem;">'+
      (p.bezorgen?'<button class="bz-btn'+(bzLevering==='bezorgen'?' on':'')+'" data-bzlev="bezorgen">\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen')+'</button>':'')+
      (p.ophalen?'<button class="bz-btn'+(bzLevering==='ophalen'?' on':'')+'" data-bzlev="ophalen">\uD83E\uDDFA '+T('bz.kan.oph','ophalen')+'</button>':'')+'</div>'+
      (bzLevering==='bezorgen' ? '<div class="bz-veld"><label>'+T('bz.adres','Bezorgadres')+'</label><input id="bzAdres" value="'+escAttr(bzAdresW)+'" placeholder="'+T('bz.adresph','Straat, nummer, plaats')+'"></div>'+
        '<button class="bz-btn'+(bzGeo?' on':'')+'" id="bzHier" style="margin-top:0.5rem;">\uD83D\uDCCD '+(bzGeo?T('bz.hierok','Locatie gedeeld voor de ETA'):T('bz.hier','Deel mijn locatie voor een live ETA'))+'</button>' : '')+
      '<button class="bz-groot" id="bzBestel" style="margin-top:1rem;"'+(n?'':' disabled')+'>'+T('bz.bestel','Bestel en betaal')+(n?' \u00B7 '+eur(bzTotaal()):'')+'</button></div>';
    const adresIn = document.getElementById('bzAdres');

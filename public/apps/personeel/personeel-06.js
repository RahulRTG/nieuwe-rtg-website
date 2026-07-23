    if (tabBtn){
      tabBtn.style.display = aan ? '' : 'none';
      const lbl = tabBtn.querySelector('span');
      if (lbl) lbl.textContent = tabNaam;
    }
    const kop = document.querySelector('.view[data-view="kamers"] h2');
    if (kop) kop.textContent = tabNaam;
    const wrap = $('#kamersWrap'); if (!wrap || !state) return;
    if (!aan){ wrap.innerHTML = ''; return; }
    // de nachtzaak: het hele afdelingenbord (entree, garderobe, bar, vip...)
    if (!heeftKamers() && heeftClubdorp()){
      wrap.innerHTML = pkDorpKaart();
      bindKamers(wrap);
      return;
    }
    // zonder kamers (schoonmaakbedrijf, zzp) werkt de tab op opdrachten
    if (!heeftKamers()) return renderOpdrachten(wrap);
    const rooms = (state.rooms || []).slice().sort((a,b) => (HK_ORDE[hkVan(a)] ?? 9) - (HK_ORDE[hkVan(b)] ?? 9));
    let html = '';
    // de receptie kijkt mee: vuile kamers met een aankomst vandaag gaan voor
    pkLaadReceptie();
    if (pkReceptie && (pkReceptie.hkEerst || []).length)
      html += '<div class="card" style="border-left:4px solid #E5484D;"><div class="k">'+T('hk.eerst','Eerst deze')+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.85rem;"><b>'+pkReceptie.hkEerst.map(esc).join(', ')+'</b> · '+T('hk.eerst.s','daar komt vandaag alweer een gast aan.')+'</div></div>';
    // de AI kijkt vooruit: gasten onderweg (GPS) bepalen de prioriteit
    const onderweg = (state.guests || []).filter(g => g.heading && !g.arrived && Number.isFinite(g.etaMin));
    const vuil = rooms.filter(r => hkVan(r) === 'vuil').length;
    if (onderweg.length && vuil)
      html += '<div class="card" style="border-left:4px solid var(--amber);"><div class="k">'+T('hk.prio','Prioriteit')+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.86rem;">'+onderweg.length+' '+T('hk.gast','gast(en) onderweg, eerste over ~')+Math.min.apply(null, onderweg.map(g=>g.etaMin))+' min · '+vuil+' '+T('hk.vuilcnt','kamer(s) vuil')+'. '+T('hk.gast2','Zorg dat er een schone kamer klaarstaat.')+'</div></div>';
    // de teller van de vloer
    const n = s2 => rooms.filter(r => hkVan(r) === s2).length;
    html += '<div class="card stat"><div><b style="color:#FF8589;">'+n('vuil')+'</b><span>'+T('hk.vuil','Vuil')+'</span></div>'+
      '<div><b style="color:#E2B93B;">'+n('bezig')+'</b><span>'+T('hk.bezig','Bezig')+'</span></div>'+
      '<div><b style="color:#7BC79B;">'+n('schoon')+'</b><span>'+T('hk.schoon','Schoon')+'</span></div>'+
      '<div><b>'+rooms.filter(r=>r.vroegVrij).length+'</b><span>'+T('hk.vrij','Vrijgegeven')+'</span></div></div>';
    html += rooms.map(r => {
      const s2 = hkVan(r);
      const chip = s2==='schoon' ? '<span class="hkchip groen">'+T('hk.schoon','Schoon')+'</span>'
        : s2==='vuil' ? '<span class="hkchip rood">'+T('hk.vuil','Vuil')+'</span>'
        : s2==='bezig' ? '<span class="hkchip amber">'+T('hk.bezig','Bezig')+'</span>'
        : s2==='defect' ? '<span class="hkchip rood">'+T('hk.defect','Defect')+'</span>'
        : '<span class="hkchip">'+T('hk.bezet','Bezet')+'</span>';
      let acts = '';
      if (s2 === 'vuil') acts = '<button class="abtn" data-khk="'+r.id+'" data-st="bezig">▶ '+T('hk.start','Start')+'</button>';
      else if (s2 === 'bezig' || s2 === 'defect') acts = '<button class="abtn" data-khk="'+r.id+'" data-st="schoon">✓ '+T('hk.klaar','Schoon')+'</button>';
      else if (s2 === 'schoon') acts = r.vroegVrij
        ? '<button class="abtn ghost" data-vrij="'+r.id+'" data-op="uit">'+T('hk.vrijaf','Vrijgave intrekken')+'</button>'
        : '<button class="abtn" data-vrij="'+r.id+'" data-op="aan">'+T('hk.geefvrij','Geef vrij voor vroege check-in')+'</button>';
      return '<div class="card kamer '+s2+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:baseline;gap:0.6rem;"><b style="font-size:0.98rem;">'+esc(r.name)+'</b>'+chip+'</div>'+
        (r.hk && r.hk.at ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+timeAgo(r.hk.at)+(r.hk.by?' · '+esc(r.hk.by):'')+(r.hk.note?' · '+esc(r.hk.note):'')+'</div>' : '')+
        (r.vroegVrij ? '<div style="font-size:0.74rem;color:#7BC79B;margin-top:0.3rem;">'+T('hk.vrijchip','vrij voor vroege check-in')+'</div>' : '')+
        '<div class="row" style="flex-wrap:wrap;">'+acts+
          (s2 !== 'vuil' && s2 !== 'defect' ? '<button class="abtn ghost" data-khk="'+r.id+'" data-st="vuil">'+T('hk.checkout','Check-out (vuil)')+'</button>' : '')+
          (s2 !== 'defect' ? '<button class="abtn warn" data-defect="'+r.id+'">'+T('hk.defectmeld','Defect')+'</button>' : '')+
          '<button class="abtn ghost" data-mb="'+r.id+'">'+T('hk.minibar','Minibar')+'</button></div>'+
        (mbOpen === r.id ? minibarBlok(r) : '')+
      '</div>';
    }).join('');
    html += pkDorpKaart();
    wrap.innerHTML = html;
    bindKamers(wrap);
  }
  /* Het hoteldorp op zak: dezelfde afdelingslijsten als in de zaak-app.
     Kies je kant (concierge, parking, security, spa, klusjesman, IT...),
     zet posten erbij en tik ze een stap verder. */
  let pkDorp = null, pkDorpAt = 0, pkDorpBezig = false;
  let pkDorpKant = (() => { try { return localStorage.getItem('rtg_pda_dorp') || 'klussen'; } catch(e){ return 'klussen'; } })();
  function pkLaadDorp(){
    if (pkDorpBezig || Date.now() - pkDorpAt < 20000) return;
    pkDorpBezig = true;
    API.call('/supplier/dorp').then(d => { pkDorp = d; pkDorpAt = Date.now(); pkDorpBezig = false; renderKamers(); })
      .catch(() => { pkDorpBezig = false; pkDorpAt = Date.now(); });
  }
  // het specialistische gereedschap van de gekozen kant, compact op zak
  let pkTools = null, pkToolsKant = null, pkToolsBezig = false;
  function pkLaadTools(){
    if (pkToolsBezig || pkToolsKant === pkDorpKant) return;
    pkToolsBezig = true;
    const kant = pkDorpKant;
    API.call('/supplier/dorp/tools', { afdeling: kant }).then(d => { pkTools = d; pkToolsKant = kant; pkToolsBezig = false; renderKamers(); })
      .catch(() => { pkTools = null; pkToolsKant = kant; pkToolsBezig = false; });
  }
  function pkToolsHtml(){
    const t = pkTools;
    if (!t || pkToolsKant !== pkDorpKant || !Array.isArray(t.tools)) return '';
    const kop = titel => '<div style="margin-top:0.5rem;font-size:0.6rem;letter-spacing:0.1em;text-transform:uppercase;opacity:0.6;">'+esc(titel)+'</div>';
    const regel = (icoon, links, rechts, rood) => '<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;margin-top:0.3rem;"><span>'+(icoon?icoon+' ':'')+links+'</span>'+(rechts?'<b style="color:'+(rood?'#FF8589':'var(--gold)')+';white-space:nowrap;">'+rechts+'</b>':'')+'</div>';
    return t.tools.map(w => {
      if (w.type === 'cijfers') return kop(w.titel)+regel('', w.items.map(i => esc(i.label)+' <b>'+esc(String(i.waarde))+'</b>').join(' · '), '');
      if (w.type === 'lijst') return kop(w.titel)+((w.rijen||[]).length
        ? w.rijen.slice(0, 6).map(r => regel(r.icoon||'', esc(r.tekst)+(r.sub?'<span style="display:block;font-size:0.7rem;opacity:0.7;">'+esc(r.sub)+'</span>':''), r.rechts?esc(r.rechts):'', r.rood)).join('')
        : '<div style="font-size:0.75rem;opacity:0.65;margin-top:0.25rem;">'+esc(w.leeg||'')+'</div>');
      if (w.type === 'knoppen') return kop(w.titel)+'<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+
        (w.knoppen||[]).map(k => '<button class="abtn ghost" data-pkdsnelknop="'+esc(k)+'">'+esc(k)+'</button>').join('')+'</div>';
      if (w.type === 'actie') return '<button class="abtn" data-pkdactie="'+esc(w.tekst)+'" style="width:100%;margin-top:0.45rem;">'+esc(w.knop)+'</button>';
      // de leeftijdscheck aan de deur: ja/nee op codenaam, zonder gegevens
      if (w.type === 'leeftijd') return kop(w.titel)+
        '<div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="pkLftIn" placeholder="'+T('pd.lft.ph','Codenaam van de gast')+'" style="flex:1;background:var(--card2,#191715);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);outline:none;font-family:inherit;font-size:0.85rem;">'+
        '<button class="abtn" data-pklft="18">18+?</button><button class="abtn ghost" data-pklft="21">21+?</button></div>'+
        '<div id="pkLftUit" style="margin-top:0.3rem;font-size:0.78rem;color:var(--soft);">'+esc(w.hint||'')+'</div>';
      if (w.type === 'meter') return kop(w.titel)+'<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.35rem;">'+
        (w.opties||[]).map(o => '<button class="abtn'+(w.stand&&w.stand.stand===o?'':' ghost')+'" data-pkdmeter="'+esc(o)+'" style="flex:1;min-width:70px;">'+esc(o)+'</button>').join('')+'</div>';
      return '';
    }).join('');
  }
  function pkDorpKaart(){
    pkLaadDorp();
    if (!pkDorp) return '';

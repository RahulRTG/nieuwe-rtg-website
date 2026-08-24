/* gevonden voorwerpen melden */
    const lm = $('#lfMeld'); if (lm) lm.addEventListener('click', async () => {
      const item = $('#lfItem').value.trim(); if (!item) return;
      try { await API.call('/supplier/lost/add', { item, room: $('#lfKamer').value, storage: $('#lfPlek').value }); toast(''+T('hk.lfok','Geregistreerd.')); await refresh(); openTab('taken'); } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Kamers: het volledige housekeeping-bord in de PDA ----------
     Alle PDA's leven in deze ene app. Voor zaken met kamers (hotel,
     appartementen) is dit het kamerbord met een tik per stap, vroege
     check-in vrijgeven en de minibar. Voor zaken zonder kamers
     (schoonmaakbedrijven, zzp'ers) werkt dezelfde tab op opdrachten. */
  const HK_ORDE = { defect: 0, vuil: 1, bezig: 2, schoon: 3, bezet: 4 };
  const hkVan = r => (r.hk && r.hk.status) || (r.available ? 'schoon' : 'bezet');
  const heeftKamers = () => !!(state && (state.rooms || []).length);
  const heeftOpdrachten = () => !!(state && !(state.rooms || []).length && (state.boekingen || []).length);
  // het eigen dorp op zak: bars, clubs, beachclubs en restaurants krijgen het afdelingenbord
  const heeftClubdorp = () => !!(state && !(state.rooms || []).length && state.supplier && ['bar', 'club', 'beachclub', 'restaurant'].includes(state.supplier.type));
  // het zorgprofiel van de gast, kort op een regel (reist mee met toestemming)
  const pkZorg = z => [((z.allergenen || []).length ? T('zorg.allergie', 'Allergie') + ': ' + z.allergenen.join(', ') : ''), z.dieet, z.medisch].filter(Boolean).join(' · ');
  let mbOpen = null;          // kamer waarvan de minibar-teller openstaat
  let mbTel = {};             // minibar-aantallen van die kamer
  // het receptiebord op zak: alleen de housekeeping-prioriteit is hier nodig
  let pkReceptie = null, pkReceptieAt = 0, pkReceptieBezig = false;
  function pkLaadReceptie(){
    if (pkReceptieBezig || Date.now() - pkReceptieAt < 30000) return;
    pkReceptieBezig = true;
    API.call('/supplier/receptie').then(d => { pkReceptie = d; pkReceptieAt = Date.now(); pkReceptieBezig = false; renderKamers(); })
      .catch(() => { pkReceptieBezig = false; pkReceptieAt = Date.now(); });
  }

  function renderKamers(){
    const tabBtn = $('#tabKamers');
    const aan = heeftKamers() || heeftOpdrachten() || heeftClubdorp();
    const tabNaam = heeftKamers() ? T('pd.t.kamers','Kamers') : heeftClubdorp() ? T('pd.t.dorp','Afdelingen') : T('pd.t.opdr','Opdrachten');
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
        '<div style="margin-top:0.25rem;font-size:0.85rem;"><b>'+pkReceptie.hkEerst.map(esc).join(', ')+'</b> · '+T('hk.eerst.s','daar komt vandaag alweer een gast aan.')+'</div></div>';
    // de AI kijkt vooruit: gasten onderweg (GPS) bepalen de prioriteit
    const onderweg = (state.guests || []).filter(g => g.heading && !g.arrived && Number.isFinite(g.etaMin));
    const vuil = rooms.filter(r => hkVan(r) === 'vuil').length;
    if (onderweg.length && vuil)
      html += '<div class="card" style="border-left:4px solid var(--amber);"><div class="k">'+T('hk.prio','Prioriteit')+'</div>'+
        '<div style="margin-top:0.25rem;font-size:0.86rem;">'+onderweg.length+' '+T('hk.gast','gast(en) onderweg, eerste over ~')+Math.min.apply(null, onderweg.map(g=>g.etaMin))+' min · '+vuil+' '+T('hk.vuilcnt','kamer(s) vuil')+'. '+T('hk.gast2','Zorg dat er een schone kamer klaarstaat.')+'</div></div>';
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
        (r.hk && r.hk.at ? '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.25rem;">'+timeAgo(r.hk.at)+(r.hk.by?' · '+esc(r.hk.by):'')+(r.hk.note?' · '+esc(r.hk.note):'')+'</div>' : '')+
        (r.vroegVrij ? '<div style="font-size:0.74rem;color:#7BC79B;margin-top:0.25rem;">'+T('hk.vrijchip','vrij voor vroege check-in')+'</div>' : '')+
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

/* de deals: koop of huur */
    wrap.innerHTML = lijst.length ? lijst.map(d => {
      const koop = d.soort === 'koop';
      const knop = koop
        ? '<button class="abtn" data-vkaf="'+d.ref+'">'+T('pd.vk.aflever','Afgeleverd')+'</button>'
        : '<button class="abtn" data-vkgereden="'+d.ref+'">'+T('pd.vk.gereden','Proefrit gereden')+'</button>';
      return '<div class="card"><div class="k">'+(koop?'':'')+esc(d.autoNaam)+'</div>'+
        '<div style="font-size:0.85rem;margin-top:0.25rem;">'+esc(d.codenaam)+' · '+(koop
          ? (T('pd.vk.aflevering','aflevering')+(d.concierge?' · '+T('pd.vk.concierge','concierge')+' '+esc(d.adres||''):' · '+T('pd.vk.ophalen','ophalen'))+' · '+eur(d.prijs||0))
          : (T('pd.vk.proefrit','proefrit')+(d.moment?' · '+esc(d.moment):'')))+'</div>'+
        '<div class="h-mt60">'+knop+'</div></div>';
    }).join('') : '<div class="card" style="text-align:center;color:var(--soft);font-size:0.85rem;">'+T('pd.vk.geen','Niets in te plannen of af te leveren.')+'</div>';
    wrap.querySelectorAll('[data-vkgereden]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkgereden, actie:'gereden' }); toast(T('pd.vk.ok','Bijgewerkt.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-vkaf]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/verkoop/deal', { ref:b.dataset.vkaf, actie:'afgeleverd' }); toast(''+T('pd.vk.afgeleverd','Afgeleverd.')); await laadVerkoop(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---- PDA beveiliging: mijn dienst, inklokken, rondes, incidenten, SOS ---- */
  let pdBev = null;
  const heeftBeveiliging = () => heeftModule('beveiliging');
  function bevPos(cb){ // GPS met korte time-out en veilige terugval
    let klaar = false; const fire = (lat, lng) => { if (klaar) return; klaar = true; cb(lat, lng); };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(p => fire(p.coords.latitude, p.coords.longitude), () => fire(undefined, undefined), { timeout: 2500 });
      setTimeout(() => fire(undefined, undefined), 3000);
    } else fire(undefined, undefined);
  }
  async function laadBevPda(){
    if (!heeftBeveiliging()) return;
    try { pdBev = await API.call('/supplier/beveiliging/pda/diensten', {}); } catch(e){ pdBev = { diensten: [], ronde: null }; }
    renderBevPda();
  }
  function renderBevPda(){
    const tabBtn = document.getElementById('tabBevPda');
    if (tabBtn) tabBtn.style.display = heeftBeveiliging() ? '' : 'none';
    const wrap = $('#bevPdaWrap'); if (!wrap) return;
    if (!heeftBeveiliging()){ wrap.innerHTML = ''; return; }
    if (!pdBev){ wrap.innerHTML = '<div class="card">…</div>'; laadBevPda(); return; }
    const ds = pdBev.diensten || [];
    let h = '';
    // 1) SOS-noodknop, altijd bovenaan
    h += '<button class="abtn" id="bevSosBtn" style="width:100%;background:var(--rood);color:#fff;font-size:1rem;padding:0.8rem;margin-bottom:0.75rem;">'+T('pd.bev.sos','SOS · noodknop')+'</button>';
    // 2) lopende ronde
    if (pdBev.ronde){
      const r = pdBev.ronde;
      h += '<div class="card"><div class="k">'+T('pd.bev.ronde','Patrouilleronde')+' · '+esc(r.post)+'</div>'+
        '<div style="font-size:0.82rem;margin:0.25rem 0;">'+(r.checkpoints.length? r.checkpoints.map(c=>'✓ '+esc(c.naam)).join(' · ') : T('pd.bev.nogcp','Nog geen checkpoints.'))+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><input id="bevCpNaam" placeholder="'+T('pd.bev.cpnaam','checkpoint')+'" style="flex:1;min-width:7rem;">'+
        '<button class="abtn" id="bevCpAdd">'+T('pd.bev.cpadd','Checkpoint')+'</button>'+
        '<button class="abtn ghost" id="bevRondeKlaar">'+T('pd.bev.rondeklaar','Ronde klaar')+'</button></div></div>';
    }
    // 3) mijn diensten
    h += '<div class="card"><div class="k">'+T('pd.bev.diensten','Mijn diensten')+'</div>';
    h += ds.length ? ds.map(d => {
      const ingeklokt = d.status === 'ingeklokt';
      return '<div class="task"><span class="ic">'+(ingeklokt?'':'')+'</span><div class="t"><b>'+esc(d.post)+'</b><span>'+esc(d.datum)+' · '+esc(d.shift)+(d.klant?' · '+esc(d.klant):'')+'</span></div>'+
        (d.status==='afgerond' ? '<span style="font-size:0.72rem;color:var(--soft);">'+T('pd.bev.klaar','afgerond')+'</span>'
          : ingeklokt ? '<button class="abtn ghost" data-bevuit="'+d.id+'">'+T('pd.bev.uit','Uitklokken')+'</button>'
          : '<button class="abtn" data-bevin="'+d.id+'">'+T('pd.bev.in','Inklokken')+'</button>')+'</div>'+
        (ingeklokt && !pdBev.ronde ? '<div style="text-align:right;margin-top:-0.3rem;"><button class="abtn ghost" data-bevronde="'+d.postId+'" style="font-size:0.7rem;">'+T('pd.bev.startronde','Start ronde')+'</button></div>' : '');
    }).join('') : '<div style="font-size:0.85rem;color:var(--soft);">'+T('pd.bev.geendienst','Geen diensten ingepland.')+'</div>';
    h += '</div>';
    // 4) incident melden
    h += '<div class="card"><div class="k">'+T('pd.bev.incident','Incident melden')+'</div>'+
      '<input id="bevIncSoort" placeholder="'+T('pd.bev.incsoort','soort (bijv. inbraakpoging)')+'" style="width:100%;margin-bottom:0.5rem;">'+
      '<select id="bevIncErnst" style="width:100%;margin-bottom:0.5rem;"><option value="laag">'+T('pd.bev.laag','laag')+'</option><option value="midden" selected>'+T('pd.bev.midden','midden')+'</option><option value="hoog">'+T('pd.bev.hoog','hoog')+'</option><option value="kritiek">'+T('pd.bev.kritiek','kritiek')+'</option></select>'+
      '<textarea id="bevIncTekst" placeholder="'+T('pd.bev.inctekst','wat is er gebeurd?')+'" style="width:100%;min-height:3rem;margin-bottom:0.5rem;"></textarea>'+
      '<button class="abtn" id="bevIncSend" style="width:100%;">'+T('pd.bev.incsend','Melden')+'</button></div>';
    wrap.innerHTML = h;
    // bindingen
    const bind = (id, fn) => { const e2 = document.getElementById(id); if (e2) e2.addEventListener('click', fn); };
    bind('bevSosBtn', () => { if (!confirm(T('pd.bev.sosbev','SOS versturen? Het team en RTG-kantoor worden direct gealarmeerd.'))) return;
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/sos', { lat, lng }); toast(''+T('pd.bev.sosok','SOS verstuurd. Bijstand onderweg.')); } catch(e){ toast(e.message); } }); });
    wrap.querySelectorAll('[data-bevin]').forEach(b => b.addEventListener('click', () => {
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/inklok', { id:b.dataset.bevin, lat, lng }); toast(''+T('pd.bev.inok','Ingeklokt op post.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    }));
    wrap.querySelectorAll('[data-bevuit]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/pda/uitklok', { id:b.dataset.bevuit }); toast(T('pd.bev.uitok','Uitgeklokt.')); await laadBevPda(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-bevronde]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/pda/ronde/start', { postId:b.dataset.bevronde }); await laadBevPda(); } catch(e){ toast(e.message); }
    }));
    bind('bevCpAdd', () => { const naam = ($('#bevCpNaam')||{}).value || '';
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/ronde/checkpoint', { id: pdBev.ronde.id, naam, lat, lng }); await laadBevPda(); } catch(e){ toast(e.message); } }); });
    bind('bevRondeKlaar', async () => { try { await API.call('/supplier/beveiliging/pda/ronde/klaar', { id: pdBev.ronde.id }); toast(T('pd.bev.rondeok','Ronde afgerond.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    bind('bevIncSend', () => {
      const tekst = ($('#bevIncTekst')||{}).value || '';
      if (!tekst.trim()) { toast(T('pd.bev.incleeg','Beschrijf het incident.')); return; }
      const soort = ($('#bevIncSoort')||{}).value || '';
      const ernst = ($('#bevIncErnst')||{}).value || 'midden';
      const post = ds[0] ? ds[0].post : '';
      const postId = ds.find(d => d.status==='ingeklokt') ? ds.find(d => d.status==='ingeklokt').postId : (ds[0]||{}).postId;
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/incident', { soort, ernst, tekst, post, postId, lat, lng }); toast(''+T('pd.bev.incok','Incident gemeld.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    });
  }

  function renderTeam(){
    const team = state.team || [];
    const act = (state.activity || []).slice(0, 10);
    const staff = (state.staff || []).filter(m => m.id !== me.staffId);

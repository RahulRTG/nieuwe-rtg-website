      const r = pdBev.ronde;
      h += '<div class="card"><div class="k">🚶 '+T('pd.bev.ronde','Patrouilleronde')+' · '+esc(r.post)+'</div>'+
        '<div style="font-size:0.82rem;margin:0.3rem 0;">'+(r.checkpoints.length? r.checkpoints.map(c=>'✓ '+esc(c.naam)).join(' · ') : T('pd.bev.nogcp','Nog geen checkpoints.'))+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;"><input id="bevCpNaam" placeholder="'+T('pd.bev.cpnaam','checkpoint')+'" style="flex:1;min-width:7rem;">'+
        '<button class="abtn" id="bevCpAdd">'+T('pd.bev.cpadd','Checkpoint')+'</button>'+
        '<button class="abtn ghost" id="bevRondeKlaar">'+T('pd.bev.rondeklaar','Ronde klaar')+'</button></div></div>';
    }
    // 3) mijn diensten
    h += '<div class="card"><div class="k">'+T('pd.bev.diensten','Mijn diensten')+'</div>';
    h += ds.length ? ds.map(d => {
      const ingeklokt = d.status === 'ingeklokt';
      return '<div class="task"><span class="ic">'+(ingeklokt?'🟢':'📋')+'</span><div class="t"><b>'+esc(d.post)+'</b><span>'+esc(d.datum)+' · '+esc(d.shift)+(d.klant?' · '+esc(d.klant):'')+'</span></div>'+
        (d.status==='afgerond' ? '<span style="font-size:0.72rem;color:var(--soft);">'+T('pd.bev.klaar','afgerond')+'</span>'
          : ingeklokt ? '<button class="abtn ghost" data-bevuit="'+d.id+'">'+T('pd.bev.uit','Uitklokken')+'</button>'
          : '<button class="abtn" data-bevin="'+d.id+'">'+T('pd.bev.in','Inklokken')+'</button>')+'</div>'+
        (ingeklokt && !pdBev.ronde ? '<div style="text-align:right;margin-top:-0.3rem;"><button class="abtn ghost" data-bevronde="'+d.postId+'" style="font-size:0.7rem;">🚶 '+T('pd.bev.startronde','Start ronde')+'</button></div>' : '');
    }).join('') : '<div style="font-size:0.85rem;color:var(--soft);">'+T('pd.bev.geendienst','Geen diensten ingepland.')+'</div>';
    h += '</div>';
    // 4) incident melden
    h += '<div class="card"><div class="k">📋 '+T('pd.bev.incident','Incident melden')+'</div>'+
      '<input id="bevIncSoort" placeholder="'+T('pd.bev.incsoort','soort (bijv. inbraakpoging)')+'" style="width:100%;margin-bottom:0.4rem;">'+
      '<select id="bevIncErnst" style="width:100%;margin-bottom:0.4rem;"><option value="laag">'+T('pd.bev.laag','laag')+'</option><option value="midden" selected>'+T('pd.bev.midden','midden')+'</option><option value="hoog">'+T('pd.bev.hoog','hoog')+'</option><option value="kritiek">'+T('pd.bev.kritiek','kritiek')+'</option></select>'+
      '<textarea id="bevIncTekst" placeholder="'+T('pd.bev.inctekst','wat is er gebeurd?')+'" style="width:100%;min-height:3rem;margin-bottom:0.4rem;"></textarea>'+
      '<button class="abtn" id="bevIncSend" style="width:100%;">'+T('pd.bev.incsend','Melden')+'</button></div>';
    wrap.innerHTML = h;
    // bindingen
    const bind = (id, fn) => { const e2 = document.getElementById(id); if (e2) e2.addEventListener('click', fn); };
    bind('bevSosBtn', () => { if (!confirm(T('pd.bev.sosbev','SOS versturen? Het team en RTG-kantoor worden direct gealarmeerd.'))) return;
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/sos', { lat, lng }); toast('🆘 '+T('pd.bev.sosok','SOS verstuurd. Bijstand onderweg.')); } catch(e){ toast(e.message); } }); });
    wrap.querySelectorAll('[data-bevin]').forEach(b => b.addEventListener('click', () => {
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/inklok', { id:b.dataset.bevin, lat, lng }); toast('🟢 '+T('pd.bev.inok','Ingeklokt op post.')); await laadBevPda(); } catch(e){ toast(e.message); } });
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
      bevPos(async (lat, lng) => { try { await API.call('/supplier/beveiliging/pda/incident', { soort, ernst, tekst, post, postId, lat, lng }); toast('📋 '+T('pd.bev.incok','Incident gemeld.')); await laadBevPda(); } catch(e){ toast(e.message); } });
    });
  }

  function renderTeam(){
    const team = state.team || [];
    const act = (state.activity || []).slice(0, 10);
    const staff = (state.staff || []).filter(m => m.id !== me.staffId);
    $('#teamWrap').innerHTML =
      (staff.length ? '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.buzzh','Collega oproepen')+'<span style="display:flex;gap:0.4rem;"><button class="abtn" id="teamCall" style="font-size:0.66rem;">📹 '+T('pd.teamcall','Teamcall')+'</button><button class="abtn ghost" id="buzzAll" style="font-size:0.66rem;">📢 '+T('pd.buzzall','Iedereen')+'</button></span></div>'+
        staff.map(m=>{
          const in2 = !!(state.klok && (state.klok.binnen||[]).includes(m.name));
          return '<div class="task"><span class="ic">'+(m.role==='manager'?'⭐':'👤')+'</span><div class="t"><b>'+esc(m.name)+'</b><span>'+(m.role==='manager'?'Manager':T('pd.staff','Medewerker'))+(in2?' · 🟢 '+T('pd.ingeklokt','ingeklokt'):'')+'</span></div>'+
            (in2?'<button class="abtn" data-belm="'+m.id+'" data-naam="'+esc(m.name)+'">📞</button>':'')+
            '<button class="abtn ghost" data-dmm="'+m.id+'" data-naam="'+esc(m.name)+'" style="position:relative;">💬<i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-6px;right:-6px;background:#C23A5E;color:#fff;border-radius:999px;font-style:normal;font-size:0.6rem;min-width:1.1rem;height:1.1rem;line-height:1.1rem;text-align:center;"></i></button>'+
            '<button class="abtn ghost" data-buzz="'+m.id+'">📳 '+T('pd.buzz','Tril')+'</button></div>';
        }).join('')+'</div>' : '')+
      '<div class="card"><div class="k">'+T('pd.chat','Teamchat')+'</div><div class="chat">'+
      (team.length ? team.map(m=>'<div class="msg '+(m.who===me.name?'me':'other')+'"><span class="who">'+esc(m.who)+'</span>'+
        (m.audio?'<audio controls src="'+m.audio+'" style="width:190px;max-width:100%;height:34px;"></audio>':esc(m.text))+'</div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.nochat','Nog geen berichten.')+'</div>')+
      '</div><div class="compose"><input id="tmMsg" placeholder="'+T('pd.msgph','Bericht aan het team')+'"><button id="tmSend">'+T('pd.send','Stuur')+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.activity','Wie deed wat')+'</div>'+
      (act.length ? act.map(e=>'<div class="act"><b>'+esc(e.who)+'</b><span>'+esc(e.text)+'</span><time>'+timeAgo(e.at)+'</time></div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);padding:0.4rem 0;">'+T('pd.noact','Nog geen activiteit.')+'</div>')+'</div>'+
      // Aparte ruimte: het personeelsnetwerk met andere zaken (met toestemming).
      '<div class="card"><div class="k">'+T('pd.net','Netwerk met andere zaken')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.4rem;">'+T('pd.net.sub','Aparte ruimte. Alleen zaken die uw manager heeft verbonden.')+'</div>'+
      (netwerk.length ? netwerk.map(v => {
        if (v.status==='akkoord') return '<div class="task"><span class="ic">🤝</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.open','tik om te chatten')+'</span></div><button class="abtn ghost" data-netopen="'+v.code+'">💬</button></div>';

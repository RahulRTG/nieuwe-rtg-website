      const eigen = (zbData.afspraken || []).filter(a => a.behandelaarId === b.id);
      return '<div class="card"><div class="k">'+esc(b.naam)+' · '+esc(b.functie)+'</div>'+
        (eigen.length ? eigen.map(a =>
          '<div class="task"><span class="ic">'+(a.soort==='medisch'?'🩺':'🧖')+'</span><div class="t">'+
            '<b style="font-variant-numeric:tabular-nums;">'+esc(a.tijd)+' · '+esc(a.behandelingNaam)+'</b>'+
            '<span>'+T('pd.zb.gast','Gast')+': '+esc(a.codenaam || '')+' · '+a.duurMin+' min · '+eur(a.prijs)+'</span>'+
            (a.zorg ? '<span style="display:block;color:#E2B93B;">⚠ '+esc(pkZorg(a.zorg))+'</span>' : '')+
            (a.intake ? '<span style="display:block;color:#E2B93B;">🩺 '+esc(a.intake)+'</span>' : '')+
          '</div>'+
          (a.status === 'afgerond' ? '<span class="pill g">'+T('pd.zb.klaar','Afgerond')+'</span>'
            : '<button class="abtn" data-zbklaar="'+esc(a.ref)+'">'+T('pd.zb.afronden','Afronden')+'</button>')+
          '</div>').join('')
        : '<div style="margin-top:0.5rem;color:var(--soft);font-size:0.8rem;">'+T('pd.zb.leeg','Geen afspraken op deze dag.')+'</div>')+
      '</div>';
    }).join('');
    wrap.innerHTML = '<div class="card"><div class="k">'+esc(zbData.aanbieder || '')+'</div>'+
      '<div class="row" style="flex-wrap:wrap;margin-top:0.5rem;">'+dagen.join('')+'</div></div>' + perBehandelaar;
    wrap.querySelectorAll('[data-zbdag]').forEach(b => b.addEventListener('click', () => { zbDatum = b.dataset.zbdag; laadZorgbalie(); }));
    wrap.querySelectorAll('[data-zbklaar]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/care/afronden', { ref: b.dataset.zbklaar }); toast(T('pd.zb.klaar','Afgerond') + ' ✅'); laadZorgbalie(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- de meldkamer op de PDA: het korps in de binnenzak ----------
     Voor de hulpdiensten (politie, brandweer, ambulance, special forces) de
     open meldingen met de veld-knoppen (ter plaatse, afronden); voor de
     zorg-zaken de medische receptie en de eerste hulp. De tab verschijnt
     alleen als de zaak een korps of zorg-zaak is. */
  let mkHulp = null, mkZorg = null;
  async function laadMeldkamerPda(){
    if (!API.token) return;
    try { mkHulp = await API.call('/supplier/hulp/overzicht'); } catch(e){ mkHulp = null; }
    try { mkZorg = await API.call('/supplier/zorg/overzicht'); } catch(e){ mkZorg = null; }
    renderMeldkamerPda();
  }
  function renderMeldkamerPda(){
    const tabBtn = document.getElementById('tabMeldkamer');
    if (tabBtn) tabBtn.style.display = (mkHulp || mkZorg) ? '' : 'none';
    const wrap = $('#meldkamerWrap');
    if (!wrap) return;
    if (!mkHulp && !mkZorg){ wrap.innerHTML = ''; return; }
    let html = '';
    if (mkHulp){
      const open = [...(mkHulp.bijstand || []), ...(mkHulp.meldingen || []).filter(m => m.status !== 'afgerond')];
      html += '<div class="card"><div class="k">'+esc(mkHulp.korps.naam)+' · '+(mkHulp.open || 0)+' '+T('pd.mk.open','open')+'</div>'+
        (open.length ? open.map(m =>
          '<div class="task"><span class="ic">'+(m.prio === 1 ? '🔴' : m.prio === 2 ? '🟠' : '🟢')+'</span><div class="t"><b>'+esc(m.tekst)+'</b>'+
          '<span>'+(m.plek ? esc(m.plek)+' · ' : '')+esc(m.status)+'</span></div>'+
          '<button class="abtn ghost" data-mkst="ter-plaatse" data-mkm="'+m.id+'">'+T('pd.mk.tp','Ter plaatse')+'</button>'+
          '<button class="abtn" data-mkst="afgerond" data-mkm="'+m.id+'">'+T('pd.mk.af','Rond af')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.rustig','Geen open meldingen; rustig op het bord.')+'</div>')+
        '<div style="margin-top:0.5rem;font-size:0.75rem;color:var(--soft);">'+(mkHulp.eenheden || []).map(e => e.naam+' ('+e.status+')').join(' · ')+'</div></div>';
    }
    if (mkZorg && mkZorg.receptie){
      html += '<div class="card"><div class="k">'+T('pd.mk.receptie','Medische receptie')+'</div>'+
        (mkZorg.receptie.length ? mkZorg.receptie.map(p =>
          '<div class="task"><span class="ic">🪪</span><div class="t"><b>'+esc(p.aanduiding)+'</b><span>'+esc(p.status)+(p.kamer ? ' ('+esc(p.kamer)+')' : '')+'</span></div>'+
          (p.status === 'wacht' ? '<button class="abtn" data-mkroep="'+p.id+'">'+T('pd.mk.roep','Roep op')+'</button>' : '')+
          '<button class="abtn ghost" data-mkpk="'+p.id+'">'+T('pd.mk.klaar','Klaar')+'</button></div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.mk.wkleeg','De wachtkamer is leeg.')+'</div>')+'</div>';
    }
    if (mkZorg && mkZorg.seh){
      html += '<div class="card"><div class="k">'+T('pd.mk.seh','Eerste hulp')+' · '+mkZorg.seh.length+' '+T('pd.mk.inrij','in de rij')+'</div>'+
        mkZorg.seh.slice(0, 6).map(p => '<div class="task"><span class="ic">'+({rood:'🔴',oranje:'🟠',geel:'🟡',groen:'🟢',blauw:'🔵'}[p.triage]||'🟡')+'</span><div class="t"><b>'+esc(p.klacht)+'</b><span>'+esc(p.status)+' · via '+esc(p.via)+'</span></div></div>').join('')+'</div>';
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-mkm]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/hulp/melding/status', { melding: b.dataset.mkm, status: b.dataset.mkst }); toast('✅'); laadMeldkamerPda(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkroep]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/roep', { id: b.dataset.mkroep }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkpk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/klaar', { id: b.dataset.mkpk }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
  }

  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view===tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab===tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    $('#content').scrollTop = 0;
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }
  document.querySelectorAll('.tabbar button').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  $('#switchBtn').addEventListener('click', () => {
    try { localStorage.removeItem('rtg_pda_token'); localStorage.removeItem('rtg_pda_code'); } catch(e){}
    location.reload();
  });
  $('#sosBtn').addEventListener('click', () => sendSOS());

  function startStream(){
    if (!window.EventSource) return;
    try {
      const src = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token));
      src.addEventListener('sync', () => { refresh(); if (heeftRetail() && pdRetail) laadWinkel(); if (heeftCharter() && pdCharters) laadVaart(); if (heeftBeveiliging()) laadBevPda(); if (zbData) laadZorgbalie(); if (mkHulp || mkZorg) laadMeldkamerPda(); });
      // de keuken praat met de bediening: bon compleet op de pas -> belletje op de PDA,
      // maar alleen op toestellen waar de pas-bel aanstaat (de gekozen personen)
      src.addEventListener('pas', e => {
        if (!pdaPasBel || !ikBinnen()) return;
        try {
          const d = JSON.parse(e.data || '{}');
          toast('🛎️ ' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
          if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
        } catch(err){}
      });
      src.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
      src.addEventListener('alarm', e => { const d=JSON.parse(e.data); if (d.from !== me.name) showAlarm(d); });
      src.addEventListener('notify', () => refresh());
      // echt (video)bellen: alle WebRTC-signalen gaan naar de teamcall-module
      if (window.TeamCall) src.addEventListener('rtc', TeamCall.event);
      if (window.CollegaChat) src.addEventListener('dm', CollegaChat.event);
    } catch(e){}
  }

  window.addEventListener('rtglang', () => { if (state) renderAll(); else stepStart(); gateTik(); });
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
  gateTik(); setInterval(gateTik, 15000);
  stepStart();
  // het Werk-OS: springboard, dock, klok en Cmd+K, precies als op een telefoon.
  // RTG Eye (de camerabril: voertuigschouw + werkvloerregister) staat als
  // eigen app op het springboard; de knop leeft in een onzichtbare houder.
  const extraHouder = document.createElement('div');
  extraHouder.id = 'pdaExtra'; extraHouder.style.display = 'none';
  const oogKnop = document.createElement('button');
  oogKnop.type = 'button'; oogKnop.className = 'pda-app';
  oogKnop.innerHTML = '<svg viewBox="0 0 24 24"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="3"/></svg>RTG Eye';
  oogKnop.addEventListener('click', () => { location.href = '/apps/oog.html'; });
  extraHouder.appendChild(oogKnop);
  // de OV-dienst (chauffeur/machinist/schipper): dienst starten en GPS delen
  const ovKnop = document.createElement('button');
  ovKnop.type = 'button'; ovKnop.className = 'pda-app';
  ovKnop.innerHTML = '<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 10h16"/><circle cx="8" cy="19" r="1.6"/><circle cx="16" cy="19" r="1.6"/></svg>OV-dienst';
  ovKnop.addEventListener('click', () => { location.href = '/apps/ovdienst.html'; });
  extraHouder.appendChild(ovKnop);
  document.body.appendChild(extraHouder);
  if (window.WerkOS) WerkOS.koppel({ thuisTab: 'vandaag', dock: ['rooster', 'taken', 'team', 'hulp'],
    extra: { houder: '#pdaExtra', knop: '.pda-app' } });
  restoreSession();
})();

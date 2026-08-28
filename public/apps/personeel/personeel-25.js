/* de ketenchat tussen zaken */
    if (mkKeten && (mkKeten.kanalen || []).length){
      html += '<div class="card"><div class="k">'+T('pd.mk.keten','Ketenchat')+'</div>'+
        '<div class="row" style="flex-wrap:wrap;margin-top:0.5rem;">'+mkKeten.kanalen.map(k =>
          '<button class="abtn '+(k.id===mkKanaal?'':'ghost')+'" data-mkkan="'+k.id+'"'+(k.id===mkKanaal?' aria-current="true"':'')+'>'+esc(k.naam)+'</button>').join('')+'</div>'+
        '<div class="chat h-mt40">'+((mkGesprek && mkGesprek.berichten) || []).slice(-15).map(m =>
          '<div class="msg other"><span class="who">'+esc(m.van)+' · '+esc(m.korpsNaam || m.korps)+'</span>'+esc(m.tekst)+'</div>').join('')+'</div>'+
        (mkGesprek && mkGesprek.magSchrijven === false
          ? '<div style="font-size:0.75rem;color:var(--soft);margin-top:0.25rem;">'+T('pd.mk.meekijk','U kijkt mee als meldkamer; alleen de leden schrijven.')+'</div>'
          : '<div class="compose h-mt40"><input id="mkMsg" placeholder="'+T('pd.mk.msg','Bericht aan de keten')+'" maxlength="500"><button id="mkSend">'+T('pd.send','Stuur')+'</button></div>')+
        '</div>';
    }
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-mkkan]').forEach(b => b.addEventListener('click', () => { mkKanaal = b.dataset.mkkan; laadMeldkamerPda(); }));
    const mkSend = wrap.querySelector('#mkSend');
    if (mkSend) mkSend.addEventListener('click', async () => {
      const i = wrap.querySelector('#mkMsg'); const t = (i.value || '').trim(); if (!t) return; i.value = '';
      try { await API.call('/supplier/keten/bericht', { kanaal: mkKanaal, tekst: t }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    });
    wrap.querySelectorAll('[data-mkm]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/hulp/melding/status', { melding: b.dataset.mkm, status: b.dataset.mkst }); toast(''); laadMeldkamerPda(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkroep]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/roep', { id: b.dataset.mkroep }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-mkpk]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zorg/receptie/klaar', { id: b.dataset.mkpk }); laadMeldkamerPda(); } catch(e){ toast(e.message); }
    }));
  }

  /* ---- De Regie van de zaak, in duimstand ----
     Hetzelfde scherm als in de zaak-app; alleen de weergave is smaller. `mag`
     staat hier op false: op de vloer kijk je en zet je iets op de lijst, maar
     beleid en besluiten horen op een scherm waar je bij zit. De server weigert
     het hoe dan ook zonder managerrol -- dit is de nette kant, niet de grendel. */
  let pdRegie = null;
  function renderPdRegie(){
    const wrap = $('#pdRegieWrap');
    if (!wrap || !window.RTGZaakCommand) return;
    if (pdRegie) { pdRegie.ververs(); return; }
    pdRegie = RTGZaakCommand.toon(wrap, {
      api: (pad, body) => API.call('/supplier/command/' + pad, body),
      compact: true, mag: false, meld: toast
    });
  }

  function openTab(tab, focusView){
    if (tab === 'regie') renderPdRegie();
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
      src.addEventListener('sync', e => { refresh(); if (heeftRetail() && pdRetail) laadWinkel(); if (heeftCharter() && pdCharters) laadVaart(); if (heeftBeveiliging()) laadBevPda(); if (zbData) laadZorgbalie(); if (mkHulp || mkZorg) laadMeldkamerPda();
        // losstaande scripts (hr-mijn e.d.) luisteren mee via een window-event
        try { window.dispatchEvent(new CustomEvent('rtgsync', { detail: JSON.parse(e.data || '{}') })); } catch(err){} });
      // de keuken praat met de bediening: bon compleet op de pas -> belletje op de PDA,
      // maar alleen op toestellen waar de pas-bel aanstaat (de gekozen personen)
      src.addEventListener('pas', e => {
        if (!pdaPasBel || !ikBinnen()) return;
        try {
          const d = JSON.parse(e.data || '{}');
          toast('' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
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
  async function startPersoneel(){
    await laadOmgeving();
    stepStart();
    await restoreSession();
  }
  // WerkOS: de echte dagstand eerst, daarna het werkregister, dock en Cmd+K.
  // RTG Eye (de camerabril: voertuigschouw + werkvloerregister) staat als
  // eigen werkvlak in het register; de knop leeft in een onzichtbare houder.
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
  // het dispatchcentrum: de openstaande ritten, de vloot en het toewijzen
  const dispKnop = document.createElement('button');
  dispKnop.type = 'button'; dispKnop.className = 'pda-app';
  dispKnop.innerHTML = '<svg viewBox="0 0 24 24"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>Dispatch';
  dispKnop.addEventListener('click', () => { location.href = '/apps/dispatch.html'; });
  extraHouder.appendChild(dispKnop);
  /* Zakelijk vervoer: het reisbeleid, de goedkeuringen en het maandoverzicht.
     Bewust een eigen app en geen tab in Dispatch -- de werkgever die zijn
     medewerkers laat rijden is een andere rol dan de planner die wagens
     verdeelt, en het overgrote deel van de bedrijven hier heeft geen vloot. */
  const zakKnop = document.createElement('button');
  zakKnop.type = 'button'; zakKnop.className = 'pda-app';
  zakKnop.innerHTML = '<svg viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/></svg>Zakelijk vervoer';
  zakKnop.addEventListener('click', () => { location.href = '/apps/zakelijk.html'; });
  extraHouder.appendChild(zakKnop);
  document.body.appendChild(extraHouder);
  if (window.WerkOS) WerkOS.koppel({ thuisTab: 'vandaag', dock: ['rooster', 'taken', 'team', 'hulp'],
    extra: { houder: '#pdaExtra', knop: '.pda-app' } });
  startPersoneel();
})();

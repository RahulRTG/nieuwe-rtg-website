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

  async function loadNotifs(){ try { const d = await API.call('/supplier/notifications', {}); } catch(e){} }
  $('#bell').addEventListener('click', () => { $('#notifPanel').classList.add('open'); $('#notifScrim').classList.add('open'); if (notifs.some(n=>!n.read)){ notifs.forEach(n=>n.read=true); API.call('/supplier/notifications/read').catch(()=>{}); renderBell(); } });
  $('#notifClose').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });
  $('#notifScrim').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });

  // ---- live stream ----
  function startStream(){
    if (!window.EventSource) return;
    // de interne call en het directe bericht draaien op dezelfde stroom
    if (window.TeamCall) TeamCall.init({ API, mij: () => { const a = actor(); return a.staffId ? { staffId: a.staffId, name: a.name } : null; }, T, toast });
    if (window.CollegaChat) CollegaChat.init({ API, mij: () => ({ staffId: actor().staffId, name: actor().name }), T, toast });
    try { source = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('hello', e => { const d=JSON.parse(e.data); notifs = d.unread||[]; renderBell(); });
    source.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
    source.addEventListener('alarm', e => { const d=JSON.parse(e.data); showAlarm(d); });
    source.addEventListener('rtc', e => { if (window.TeamCall) TeamCall.event(e); });
    source.addEventListener('dm', e => { if (window.CollegaChat) CollegaChat.event(e); });
    source.addEventListener('sync', e => { refresh(); if (has('retail') && retailData) laadRetail(); if (has('retail') && wvRetail) laadWinkelvloer(); if (has('care') && zbLev) laadZorgbalieLev(); if (has('charter') && charters !== null) laadCharters(); if (paspoortData) laadPaspoort(); if (has('boerderij') && boer) laadBoerderij(); if (has('creator') && cr) laadCreator(); if (sw) laadSamenwerking(); if (fact) laadFacturen(); laadAgendaSup(); });
    // de keuken praat met de bediening: bon compleet op de pas -> belletje op
    // elk open scherm van de zaak (bedieningspost, kassa, kantoor)
    source.addEventListener('pas', e => {
      try {
        const d = JSON.parse(e.data || '{}');
        toast('🛎️ ' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
      } catch(err){}
    });
    source.addEventListener('notify', e => {
      const n = JSON.parse(e.data); notifs.unshift(n); renderBell();
      if ('Notification' in window && Notification.permission==='granted'){ try{ new Notification(n.title,{body:n.body,icon:'icon.svg',tag:n.id}); }catch(_){} }
      toast(n.title + ', ' + n.body);
      refresh();
    });
  }

  window.addEventListener('rtglang', () => {
    if (!S) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset ? document.querySelector('.tabbar button.active').dataset.tab : 'home';
    buildTabs(); renderAll(); openTab(active || 'home');
  });

  $('#actorChip').addEventListener('click', switchUser);
  $('#aiSend').addEventListener('click', sendAI);
  $('#aiInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendAI(); });
  renderAIThread();
  buildPad();
  renderGate();
  // het Werk-OS: springboard, dock, klok en Cmd+K over het bestaande tabmodel
  if (window.WerkOS) WerkOS.koppel({
    thuisTab: 'home', dock: ['orders', 'kassa', 'menu', 'ai', 'team'],
    // het Meer-grid waaiert uit over het springboard: alle functies als apps
    verberg: ['meer'], extra: { houder: '#meerWrap', knop: '.meer-btn' }
  });
  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();

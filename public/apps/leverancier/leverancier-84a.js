  function bindEtenWerkblad(el){
    el.querySelectorAll('[data-eten-rol]').forEach(b => b.addEventListener('click', () => { etenRol=b.dataset.etenRol; try{localStorage.setItem('rtg_eten_rol',etenRol);}catch(e){} laadEtenWerkblad(true); }));
    el.querySelectorAll('[data-eten-filter]').forEach(b => b.addEventListener('click', () => { const f=b.dataset.etenFilter; etenFilters=etenFilters.includes(f)?etenFilters.filter(x=>x!==f):etenFilters.concat(f); laadEtenWerkblad(true); }));
    const zoek = () => { etenZoek=$('#etenZoek').value.trim(); laadEtenWerkblad(true); };
    $('#etenZoekGo').addEventListener('click', zoek); $('#etenZoek').addEventListener('keydown', e => { if(e.key==='Enter') zoek(); });
    $('#etenZoek').addEventListener('input', e => { clearTimeout(etenZoekTimer); const v=e.target.value; etenZoekTimer=setTimeout(()=>{etenZoek=v.trim(); laadEtenWerkblad(true);},350); });
    el.querySelectorAll('[data-eten-status]').forEach(b => b.addEventListener('click', async () => { b.disabled=true; try{await API.call('/supplier/eten/status',{rekeningId:b.dataset.etenRekening,status:b.dataset.etenStatus}); await laadEtenWerkblad(true); toast('Order bijgewerkt.');}catch(e){toast(e.message);b.disabled=false;} }));
    const capBtn=$('#etenCapBewaar'); if(capBtn) capBtn.addEventListener('click', async () => { try{await API.call('/supplier/eten/capaciteit',{wijzig:true,open:$('#etenOpen').checked,auto:$('#etenAuto').checked,extraMinuten:Number($('#etenExtra').value),limietMinuten:Number($('#etenLimiet').value),kokken:Number($('#etenKokken').value),afhalenPromoten:$('#etenAfhaal').checked,gepauzeerdeItems:[...el.querySelectorAll('[data-eten-pauze]:checked')].map(x=>x.dataset.etenPauze)});await laadEtenWerkblad(true);toast('Capaciteit staat live.');}catch(e){toast(e.message);} });
    const codeBtn=$('#etenCodeBewaar'); if(codeBtn) codeBtn.addEventListener('click',async()=>{try{await API.call('/supplier/eten/instellingen',{actie:'bewaar-korting',code:$('#etenCode').value,procent:Number($('#etenProcent').value)});await laadEtenWerkblad(true);toast('Kortingscode bijgewerkt.');}catch(e){toast(e.message);} });
    el.querySelectorAll('[data-eten-codeweg]').forEach(b=>b.addEventListener('click',async()=>{try{await API.call('/supplier/eten/instellingen',{actie:'verwijder-korting',code:b.dataset.etenCodeweg});await laadEtenWerkblad(true);}catch(e){toast(e.message);} }));
  }

  async function laadEtenWerkblad(force){
    if (etenBezig || !state || !state.supplier || !((state.supplier.caps||[]).includes('menu'))) return;
    if (!force && etenWerk && Date.now()-Number(etenWerk._geladenAt||0)<10000){ renderEtenWerkblad(); return; }
    etenBezig=true; if(!etenWerk) renderEtenWerkblad();
    try { const d=await API.call('/supplier/eten/werkblad',{rol:etenRol,zoek:etenZoek,filters:etenFilters}); etenRol=d.rol; d._geladenAt=Date.now(); etenWerk=d; renderEtenWerkblad(); }
    catch(e){ const el=$('#etenWerkblad'); if(el) el.innerHTML='<section class="eten-werk"><div class="eten-leeg">'+esc(e.message)+'</div></section>'; }
    finally { etenBezig=false; }
  }
/* Live synchronisatie, meldingen en het opstarten van het partnerwerkblad. */
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
        toast('' + T('pas.klaar', 'Op de pas: bon ') + d.pickup + (d.table ? ' (' + d.table + ')' : ''));
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
  // WerkOS: de echte stand eerst, daarna het werkregister, dock en Cmd+K.
  if (window.WerkOS) WerkOS.koppel({
    thuisTab: 'home', dock: ['orders', 'kassa', 'menu', 'ai', 'team'],
    // Het Meer-grid vult het register aan met de overige bestaande functies.
    verberg: ['meer'], extra: { houder: '#meerWrap', knop: '.meer-btn' }
  });
  /* WAT UW ZAAK KAN (kern/geschikt.js). Een uitspraak van de ondernemer, geen
     keuring door RTG - net als de allergenen bij een gerecht. Wat hier niet
     staat, wordt nergens als toegezegd gelezen: een lid met die eis krijgt de
     zaak dan niet voorgesteld. De woordenlijst komt met de state mee, dus er is
     hier geen tweede kopie. Staat aan het eind van de IIFE en niet bij
     renderBeheer, want dat deel zit al tegen de bestandsgrens aan. */
  function kaartGeschikt(){
    const s = (state && state.supplier) || {};
    const lijst = s.geschiktLijst || [], aan = s.geschikt || [];
    if (!lijst.length) return '';
    return '<div class="card"><div class="tt-h">'+T('gs.h','Wat uw zaak kan')+'</div>'+
      '<div class="gs-sub">'+
      T('gs.sub','Uw eigen opgave; RTG controleert dit niet. Wat u niet aankruist, geldt nergens als toegezegd: leden met die eis krijgen uw zaak dan niet voorgesteld.')+'</div>'+
      lijst.map(e => '<label class="gs-rij">'+
        '<input type="checkbox" data-geschikt="'+e.id+'"'+(aan.indexOf(e.id) >= 0 ? ' checked' : '')+' class="gs-vink">'+
        '<span><b class="gs-naam">'+esc(e.label)+'</b>'+
        '<span class="gs-uitleg">'+esc(e.uitleg||'')+'</span></span></label>').join('')+
      '<div class="tt-add"><button id="gsZet">'+T('gs.zet','Opslaan')+'</button></div></div>';
  }
  function koppelGeschikt(el, klaar){
    const b = el.querySelector('#gsZet'); if (!b) return;
    b.addEventListener('click', async () => {
      const geschikt = Array.prototype.slice.call(el.querySelectorAll('[data-geschikt]'))
        .filter(c => c.checked).map(c => c.dataset.geschikt);
      try { await API.call('/supplier/settings', { geschikt }); toast(T('bh.saved','Opgeslagen, leden zien het direct.')); if (klaar) klaar(); }
      catch(e){ toast(e.message); }
    });
  }

  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();

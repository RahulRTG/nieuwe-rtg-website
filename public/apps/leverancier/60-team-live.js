  // ---- AI-assistent ----
  let aiMsgs = [];
  function renderAIChips(){
    const el = $('#aiChips'); if (!el) return;
    let chips = [T('ai.c1','Dagomzet'), T('ai.c2','Onbeantwoorde berichten')];
    if (has('bookings')) chips.push(T('ai.c3','Welke kamers zijn vuil?'), T('ai.c4','Welke minibars nog tellen?'));
    if (has('orders')) chips.push(T('ai.c5','Open bestellingen'));
    if (has('doors')) chips.push(T('ai.c6','Open de voordeur'));
    chips.push(T('ai.c7','Wie is er onderweg?'), T('ai.c8','Welke klussen staan open?'));
    el.innerHTML = chips.map(c => '<button class="ai-chip">'+c+'</button>').join('');
    el.querySelectorAll('.ai-chip').forEach(b => b.addEventListener('click', () => { $('#aiInput').value = b.textContent; sendAI(); }));
  }
  function renderAIThread(){
    const t = $('#aiThread'); if (!t) return;
    t.innerHTML = aiMsgs.length ? aiMsgs.map(m =>
      '<div class="tt-msg ' + (m.role === 'user' ? 'me' : 'other') + '">' +
      (m.role === 'ai' ? '<span class="who">✦ AI</span>' : '') +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.did ? '<span class="ai-did">✓ ' + T('ai.did','uitgevoerd') + '</span>' : '') + '</div>'
    ).join('') : '<div class="pcempty" style="padding:1.4rem 0.5rem;text-align:center;color:var(--soft);font-size:0.82rem;line-height:1.6;">' + T('ai.empty','Uw assistent kent het hele bedrijf: de kassa, de kamers, de klussen, de gasten. Vraag iets of geef een opdracht.') + '</div>';
    t.scrollTop = t.scrollHeight;
  }
  async function sendAI(){
    const inp = $('#aiInput');
    const q = (inp.value || '').trim();
    if (!q) return;
    inp.value = '';
    aiMsgs.push({ role: 'user', text: q });
    aiMsgs.push({ role: 'ai', text: '…' });
    renderAIThread();
    try {
      const d = await API.call('/supplier/ai', { q });
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: d.reply, did: d.did };
      renderAIThread();
      if (d.did) await refresh();
      openTab('ai');
    } catch(e){
      aiMsgs[aiMsgs.length - 1] = { role: 'ai', text: e.message };
      renderAIThread();
    }
  }

  // ---- team ----
  let lastPin = null; // laatst gemaakte uitnodiging (kassacode), eenmalig getoond aan de manager
  function renderTeam(){
    const a = actor();
    const staff = state.staff || [];
    const activity = state.activity || [];
    const team = state.team || [];
    let html = '';

    // personeel
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('team.roster','Personeel')+'<button class="obtn" id="buzzAll" style="font-size:0.66rem;">📢 '+T('team.buzzall','Iedereen')+'</button></div>';
    html += staff.map(m => {
      const you = a.staffId && m.id === a.staffId;
      const buzz = you ? '' : '<button class="tt-buzz" data-buzz="'+m.id+'" title="'+T('team.buzz','Oproepen (tril)')+'">📳</button>';
      const rm = (a.manager && !you) ? '<button class="tt-rm" data-rm="'+m.id+'">'+T('team.remove','Verwijder')+'</button>' : '';
      const tag = you ? '<span class="you">'+T('team.you','jij')+'</span>' : '';
      return '<div class="tt-person"><span class="av">'+initials(m.name)+'</span><span class="nm"><b>'+m.name+' '+tag+'</b><span>'+(m.func? m.func+' · ':'')+T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker')+'</span></span>'+buzz+rm+'</div>';
    }).join('') || '<div class="softline">'+T('team.nostaff','Nog geen personeel toegevoegd.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;"><input id="ttName" placeholder="'+T('team.name','Naam')+'" style="flex:2;min-width:110px;"><input id="ttFunc" placeholder="'+T('team.func','Functie')+'" style="flex:1;min-width:90px;"><select id="ttRole"><option value="staff">'+T('role.staff','Medewerker')+'</option><option value="manager">'+T('role.manager','Manager')+'</option></select><button id="ttAdd">'+T('team.invite','Nodig uit')+'</button></div>';
      if (lastPin) html += '<div class="tt-pinbox">'+T('team.invintro','Uitnodiging voor')+' '+escT(lastPin.name)+' · '+T('kt.invite.biz','Bedrijfsnaam')+': <b>'+escT(lastPin.bedrijf)+'</b> · '+T('kt.invite.code','Kassacode')+': <b>'+escT(lastPin.kassacode)+'</b><br>'+T('team.invnote','Eenmalige code; aanmelden met eigen RTG-account.')+'</div>';
    }
    html += '</div>';

    // vacatures: het bedrijf plaatst openstaande functies; die verschijnen ook
    // in de RTFoundation zodat leden vanaf 16 jaar met hun cv solliciteren.
    const vacs = state.vacatures || [];
    html += '<div class="card"><div class="tt-h">'+T('vac.h','Vacatures')+' <i style="font-style:normal;font-size:0.58rem;letter-spacing:0.08em;color:#7ecb8f;border:1px solid #7ecb8f;border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">'+T('vac.rtf','ook in RTFoundation')+'</i></div>';
    html += '<div style="font-size:0.78rem;color:var(--soft);margin-bottom:0.6rem;">'+T('vac.intro','Vacatures die je hier plaatst komen ook in de RTFoundation-app. Leden van gezinnen die het minder breed hebben solliciteren er vanaf 16 jaar in een tik op, met hun cv.')+'</div>';
    html += vacs.length ? vacs.map(v =>
      '<div class="tk-row" style="flex-wrap:wrap;'+(v.open?'':'opacity:0.55;')+'"><div class="tk-t"><b>'+esc(v.func)+' <span style="font-weight:400;color:var(--soft);">'+T('vac.soort.'+v.soort, v.soort)+' · '+T('vac.vanaf','vanaf')+' '+v.minLeeftijd+' '+T('vac.jaar','jaar')+'</span></b><span>'+(v.plaats?esc(v.plaats)+' · ':'')+(v.uren?esc(v.uren)+' · ':'')+(v.open?T('vac.open','staat open'):T('vac.dicht','gesloten'))+'</span></div>'+
      (a.manager ? '<button class="obtn" data-vactoggle="'+v.id+'" data-vacnow="'+(v.open?'sluit':'open')+'">'+(v.open?T('vac.sluitbtn','Sluiten'):T('vac.openbtn','Openen'))+'</button><button class="obtn warn" data-vacdel="'+v.id+'">'+T('vac.del','Verwijderen')+'</button>' : '')+
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('vac.geen','Nog geen vacatures. Plaats er een om personeel te vinden via de RTFoundation.')+'</div>';
    if (a.manager){
      html += '<div class="tt-add" style="flex-wrap:wrap;gap:0.4rem;margin-top:0.7rem;">'+
        '<input id="vacFunc" placeholder="'+T('vac.func','Functie (bijv. afwasser)')+'" style="flex:2;min-width:130px;">'+
        '<select id="vacSoort" style="flex:1;min-width:110px;"><option value="bijbaan">'+T('vac.soort.bijbaan','Bijbaan')+'</option><option value="vakantiewerk">'+T('vac.soort.vakantiewerk','Vakantiewerk')+'</option><option value="parttime">'+T('vac.soort.parttime','Parttime')+'</option><option value="fulltime">'+T('vac.soort.fulltime','Fulltime')+'</option><option value="stage">'+T('vac.soort.stage','Stage')+'</option><option value="vrijwilliger">'+T('vac.soort.vrijwilliger','Vrijwilliger')+'</option></select>'+
        '<select id="vacLft" style="flex:1;min-width:90px;"><option value="16">'+T('vac.vanaf','vanaf')+' 16</option><option value="18">'+T('vac.vanaf','vanaf')+' 18</option><option value="21">'+T('vac.vanaf','vanaf')+' 21</option></select>'+
        '<input id="vacPlaats" placeholder="'+T('vac.plaats','Plaats')+'" style="flex:1;min-width:90px;">'+
        '<input id="vacUren" placeholder="'+T('vac.uren','Uren (bijv. 8-16u/week)')+'" style="flex:1;min-width:110px;">'+
        '<input id="vacOms" placeholder="'+T('vac.oms','Korte omschrijving')+'" style="flex:2;min-width:150px;">'+
        '<button id="vacAdd">'+T('vac.plaatsbtn','Vacature plaatsen')+'</button></div>';
    }
    html += '</div>';

    // sollicitaties: overal hetzelfde kanaal, de manager beslist
    const apps = (state.applications || []).filter(x => x.status === 'nieuw');
    const decided = (state.applications || []).filter(x => x.status !== 'nieuw').slice(0, 4);
    html += '<div class="card"><div class="tt-h">'+T('ap.h','Sollicitaties')+(apps.length?' <i class="gc-unread">'+apps.length+'</i>':'')+'</div>';
    const apCv = x => {
      if (!x.viaRTG || !x.cv) return '';
      const c = x.cv, parts = [];
      if (c.headline) parts.push('<b style="color:var(--txt);">'+c.headline+'</b>');
      if (c.experience && c.experience.length) parts.push(c.experience.slice(0,3).join(' · '));
      if (c.skills && c.skills.length) parts.push(T('ap.skills','Vaardigheden')+': '+c.skills.join(', '));
      if (c.languages) parts.push(T('ap.langs','Talen')+': '+c.languages);
      if (!parts.length) return '';
      return '<div style="flex-basis:100%;font-size:0.72rem;color:var(--muted);line-height:1.5;margin-top:0.35rem;background:var(--card2);border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;">📄 '+parts.join('<br>')+'</div>';
    };
    html += apps.length ? apps.map(x =>
      '<div class="tk-row" style="flex-wrap:wrap;"><div class="tk-t"><b>'+x.name+' · '+x.func+
      (x.viaRTG?' <i style="font-style:normal;font-size:0.58rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">RTG</i>':'')+
      '</b><span>'+x.contact+(x.note?' · "'+x.note.slice(0,60)+'"':'')+' · '+timeAgo(x.at)+'</span></div>'+
      (a.manager ? '<button class="obtn" data-apinvite="'+x.id+'">'+T('ap.invite','Uitnodigen')+'</button><button class="obtn primary" data-aphire="'+x.id+'">'+T('ap.hire','Aannemen')+'</button><button class="obtn warn" data-apno="'+x.id+'">'+T('ap.reject','Afwijzen')+'</button>' : '')+
      apCv(x)+
      '</div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.5rem 0;">'+T('ap.none','Geen open sollicitaties. Kandidaten solliciteren via het startscherm van deze app, RTG-leden via de leden-app met hun cv.')+'</div>';
    html += decided.map(x => {
      const kanChat = x.status === 'uitgenodigd' || x.status === 'aangenomen';
      const stLabel = x.status === 'uitgenodigd' ? T('ap.st.invited','uitgenodigd') : x.status === 'aangenomen' ? T('ap.st.hired','aangenomen') : T('ap.st.rejected','afgewezen');
      return '<div class="tk-row done" style="flex-wrap:wrap;"><div class="tk-t"><b>'+x.name+' · '+x.func+'</b><span>'+stLabel+'</span></div>'+
        (kanChat && a.manager ? '<button class="obtn primary" data-apchat="'+x.id+'" data-apname="'+encodeURIComponent(x.name)+'">💬 '+T('ap.chat','Chat')+'</button>' : '')+'</div>';
    }).join('');
    html += '</div>';

    // activiteit
    html += '<div class="card"><div class="tt-h">'+T('team.activity','Wie deed wat')+'</div>';
    html += activity.length ? activity.map(e =>
      '<div class="tt-act"><span class="aw">'+e.who+'</span><span class="ax">'+e.text+'</span><time>'+timeAgo(e.at)+'</time></div>'
    ).join('') : '<div class="softline">'+T('team.noactivity','Nog geen activiteit vastgelegd.')+'</div>';
    html += '</div>';

    // interne chat
    html += '<div class="card"><div class="tt-h" style="margin-bottom:0.6rem;">'+T('team.chat','Interne teamchat')+'</div><div class="tt-chat" id="ttChat">';
    html += team.length ? team.map(m =>
      '<div class="tt-msg '+(m.who===a.name?'me':'other')+'"><span class="who">'+m.who+'</span>'+
      (m.audio ? '<audio controls src="'+m.audio+'" style="width:200px;max-width:100%;height:34px;"></audio>' : esc(m.text))+
      '<time>'+timeAgo(m.at)+'</time></div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('team.nochat','Nog geen berichten. Stuur je team een bericht.')+'</div>';
    html += '</div><div class="tt-compose"><button class="tt-mic" id="ttMic" title="'+T('team.memo','Spraakmemo')+'">🎤</button><input id="ttMsg" placeholder="'+T('team.msgph','Bericht aan het team')+'"><button id="ttSend">'+T('team.send','Stuur')+'</button></div></div>';

    $('#teamWrap').innerHTML = html;

    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', ()=>removeStaff(Number(b.dataset.rm))));
    const ba = $('#buzzAll'); if (ba) ba.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { all: true });
        toast('📢 '+T('team.allbuzzed','Hele team opgeroepen')+' ('+d.reached+' '+T('team.online','online')+').'); }
      catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-buzz]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { staffId: Number(b.dataset.buzz) });
        toast(d.reached ? '📳 '+d.name+' '+T('team.buzzed','wordt opgeroepen.') : d.name+' '+T('team.buzzoff','heeft de app nu niet open.')); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-aphire]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/apply/decide', { id: b.dataset.aphire, action: 'aannemen' });
        lastPin = { name: d.invite.naam, kassacode: d.invite.kassacode, bedrijf: d.bedrijf };
        toast(T('ap.hired2','Aangenomen. Kassacode: ') + d.invite.kassacode);
        await refresh(); openTab('team');
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.apno, action: 'afwijzen' }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apinvite]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.apinvite, action: 'uitnodigen' });
        toast('💬 '+T('ap.invited','Uitgenodigd. Maak samen een afspraak in de chat.'));
        await refresh(); openTab('team'); openApChat(b.dataset.apinvite, d.chat && d.chat.metWie); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-apchat]').forEach(b => b.addEventListener('click', () => openApChat(b.dataset.apchat, decodeURIComponent(b.dataset.apname||''))));
    const vacAdd = $('#vacAdd'); if (vacAdd) vacAdd.addEventListener('click', async () => {
      const func = $('#vacFunc').value.trim();
      if (!func) { toast(T('vac.needfunc','Geef de functie een naam.')); return; }
      try {
        await API.call('/supplier/vacature', {
          func, soort: $('#vacSoort').value, minLeeftijd: Number($('#vacLft').value),
          plaats: $('#vacPlaats').value.trim(), uren: $('#vacUren').value.trim(), omschrijving: $('#vacOms').value.trim()
        });
        toast('✅ '+T('vac.geplaatst','Vacature geplaatst en zichtbaar in de RTFoundation.'));
        await refresh(); openTab('team');
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-vactoggle]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vacature/verwijder', { id: b.dataset.vactoggle, action: b.dataset.vacnow }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vacdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/vacature/verwijder', { id: b.dataset.vacdel }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    const addBtn = $('#ttAdd'); if (addBtn) addBtn.addEventListener('click', addStaff);
    const send = $('#ttSend'); if (send) send.addEventListener('click', sendTeam);
    const msg = $('#ttMsg'); if (msg) msg.addEventListener('keydown', e => { if (e.key==='Enter') sendTeam(); });
    const mic = $('#ttMic'); if (mic) mic.addEventListener('click', () => toggleMemo(mic));
    const chat = $('#ttChat'); if (chat) chat.scrollTop = chat.scrollHeight;
  }

  // ---- spraakmemo: opnemen en als teamchat-bericht versturen ----
  let memoRec = null;
  async function toggleMemo(btn){
    if (memoRec){ memoRec.stop(); return; }
    if (!navigator.mediaDevices || !window.MediaRecorder){ toast(T('memo.no','Opnemen is hier niet beschikbaar.')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      memoRec = new MediaRecorder(stream);
      memoRec.ondataavailable = e => chunks.push(e.data);
      memoRec.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        btn.classList.remove('rec');
        memoRec = null;
        const blob = new Blob(chunks, { type: chunks[0] && chunks[0].type || 'audio/webm' });
        if (blob.size < 200){ toast(T('memo.short','Te kort.')); return; }
        if (blob.size > 1.4 * 1024 * 1024){ toast(T('memo.long','Memo te lang (max ~1 minuut).')); return; }
        const reader = new FileReader();
        reader.onload = async () => {
          try { await API.call('/supplier/team/message', { audio: reader.result }); toast(T('memo.sent','Spraakmemo verstuurd.')); await refresh(); openTab('team'); }
          catch(e){ toast(e.message); }
        };
        reader.readAsDataURL(blob);
      };
      memoRec.start();
      btn.classList.add('rec');
      toast(T('memo.rec','Opnemen... tik nogmaals om te versturen.'));
    } catch(e){ toast(T('memo.denied','Geen toegang tot de microfoon.')); }
  }

  // ---- opgeroepen worden: trilscherm ----
  function showBuzz(from){
    if (navigator.vibrate) navigator.vibrate([300,120,300,120,600]);
    let el = document.getElementById('buzzOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'buzzOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    el.innerHTML = '<div class="bz"><div class="bz-ic">📳</div><b>'+esc(from)+'</b><span>'+T('buzz.calls','roept u op')+'</span><i>'+T('buzz.close','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 8000);
  }

  // walkie-talkie: binnenkomende spraakmemo direct afspelen
  function playPtt(from, audio){
    if (navigator.vibrate) navigator.vibrate(150);
    let bar = document.getElementById('pttBar');
    if (!bar){ bar = document.createElement('div'); bar.id = 'pttBar'; document.getElementById('shell').appendChild(bar); }
    bar.innerHTML = '🔊 <b>'+esc(from)+'</b> '+T('ptt.speaks','spreekt');
    bar.classList.add('on');
    try { const a = new Audio(audio); a.play().catch(()=>{}); a.onended = () => bar.classList.remove('on'); } catch(e){}
    setTimeout(() => bar.classList.remove('on'), 15000);
    refresh();
  }

  // security-alarm: schermvullend, met locatie
  function showAlarm(d){
    if (navigator.vibrate) navigator.vibrate([500,150,500,150,800]);
    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('alarm.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic">🚨</div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('alarm.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">📍 '+esc(locTxt)+'</span><i>'+T('buzz.close','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function escAttr(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  async function addStaff(){
    const name = ($('#ttName').value||'').trim();
    const func = ($('#ttFunc') && $('#ttFunc').value || '').trim();
    const role = $('#ttRole').value;
    try {
      const d = await API.call('/supplier/staff/invite', { name, func, role });
      lastPin = { name: d.invite.naam || name || T('kt.staff','Medewerker'), kassacode: d.invite.kassacode, bedrijf: d.bedrijf };
      toast(T('team.invited','Uitnodiging gemaakt. Kassacode: ')+d.invite.kassacode);
      await refresh(); openTab('team');
    } catch(e){ toast(e.message); }
  }
  async function removeStaff(id){
    try { await API.call('/supplier/staff/remove', { staffId: id }); toast(T('team.removed','Verwijderd uit het team.')); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }
  async function sendTeam(){
    const el = $('#ttMsg'); const text = (el.value||'').trim();
    if (!text) return;
    el.value = '';
    try { await API.call('/supplier/team/message', { text }); await refresh(); openTab('team'); }
    catch(e){ toast(e.message); }
  }

  // ---- meldingen ----
  function renderBell(){
    const unread = notifs.filter(n=>!n.read).length;
    const b = $('#bellBadge'); b.style.display = unread>0?'flex':'none'; b.textContent = unread>9?'9+':unread;
    $('#notifList').innerHTML = notifs.length ? notifs.map(n =>
      '<div class="notif-item'+(n.read?'':' unread')+'"><div class="ic">'+(n.icon||'•')+'</div><div class="tx"><b>'+n.title+'</b><span>'+n.body+'</span><time>'+timeAgo(n.at)+'</time></div></div>'
    ).join('') : '<div class="empty">'+T('sup.nonotif','Nog geen meldingen. Nieuwe bestellingen en betalingen ziet u hier live.')+'</div>';
  }
  async function loadNotifs(){ try { const d = await API.call('/supplier/notifications', {}); } catch(e){} }
  $('#bell').addEventListener('click', () => { $('#notifPanel').classList.add('open'); $('#notifScrim').classList.add('open'); if (notifs.some(n=>!n.read)){ notifs.forEach(n=>n.read=true); API.call('/supplier/notifications/read').catch(()=>{}); renderBell(); } });
  $('#notifClose').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });
  $('#notifScrim').addEventListener('click', () => { $('#notifPanel').classList.remove('open'); $('#notifScrim').classList.remove('open'); });

  // ---- live stream ----
  function startStream(){
    if (!window.EventSource) return;
    try { source = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('hello', e => { const d=JSON.parse(e.data); notifs = d.unread||[]; renderBell(); });
    source.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
    source.addEventListener('ptt', e => { const d=JSON.parse(e.data); playPtt(d.from, d.audio); });
    source.addEventListener('alarm', e => { const d=JSON.parse(e.data); showAlarm(d); });
    source.addEventListener('sync', e => { refresh(); if (has('retail') && retailData) laadRetail(); if (has('charter') && charters !== null) laadCharters(); if (paspoortData) laadPaspoort(); if (has('boerderij') && boer) laadBoerderij(); if (has('creator') && cr) laadCreator(); if (sw) laadSamenwerking(); if (fact) laadFacturen(); laadAgendaSup(); });
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
  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();

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
    html += '<div class="card"><div class="tt-h" style="display:flex;justify-content:space-between;align-items:center;">'+T('team.roster','Personeel')+'<span style="display:flex;gap:0.4rem;">'+
      (a.staffId ? '<button class="obtn" id="teamCallSup" style="font-size:0.66rem;">📹 '+T('team.call','Teamcall')+'</button>' : '')+
      '<button class="obtn" id="buzzAll" style="font-size:0.66rem;">📢 '+T('team.buzzall','Iedereen')+'</button></span></div>';
    html += staff.map(m => {
      const you = a.staffId && m.id === a.staffId;
      // iedereen bereikt iedereen: een interne (video)call of een direct bericht
      const bel = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-belm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.belhint','Interne call (video)')+'">📞</button>';
      const dm = (you || !a.staffId) ? '' : '<button class="tt-buzz" data-dmm="'+m.id+'" data-naam="'+escAttr(m.name)+'" title="'+T('team.dmhint','Direct bericht')+'" style="position:relative;">💬<i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-5px;right:-5px;background:#C23A5E;color:#fff;border-radius:999px;font-style:normal;font-size:0.58rem;min-width:1rem;height:1rem;line-height:1rem;text-align:center;"></i></button>';
      const buzz = you ? '' : '<button class="tt-buzz" data-buzz="'+m.id+'" title="'+T('team.buzz','Oproepen (tril)')+'">📳</button>';
      const rm = (a.manager && !you) ? '<button class="tt-rm" data-rm="'+m.id+'">'+T('team.remove','Verwijder')+'</button>' : '';
      const tag = you ? '<span class="you">'+T('team.you','jij')+'</span>' : '';
      return '<div class="tt-person"><span class="av">'+initials(m.name)+'</span><span class="nm"><b>'+m.name+' '+tag+'</b><span>'+(m.func? m.func+' · ':'')+T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker')+'</span></span>'+bel+dm+buzz+rm+'</div>';
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

    // de PDA van dit bedrijf: personeel opent met deze link (of QR) meteen
    // het eigen team, zonder sector- en bedrijfskeuze
    html += '<a class="obtn" style="text-decoration:none;display:inline-block;margin:0.2rem 0 0.8rem;" href="/apps/personeel.html?bedrijf='+encodeURIComponent(S.code)+'">👤 '+T('team.pdalink','Personeels-app van dit bedrijf')+'</a>';

    // activiteit
    html += '<div class="card"><div class="tt-h">'+T('team.activity','Wie deed wat')+'</div>';
    html += activity.length ? activity.map(e =>
      '<div class="tt-act"><span class="aw">'+e.who+'</span><span class="ax">'+e.text+'</span><time>'+timeAgo(e.at)+'</time></div>'
    ).join('') : '<div class="softline">'+T('team.noactivity','Nog geen activiteit vastgelegd.')+'</div>';
    html += '</div>';

    // interne chat
    html += '<div class="card"><div class="tt-h" style="margin-bottom:0.6rem;">'+T('team.chat','Interne teamchat')+'</div><div class="tt-chat" id="ttChat">';
    html += team.length ? team.map(m =>
      '<div class="tt-msg '+(m.who===a.name?'me':'other')+'"><span class="who">'+m.who+'</span>'+esc(m.text)+'<time>'+timeAgo(m.at)+'</time></div>'
    ).join('') : '<div style="font-size:0.82rem;color:var(--soft);padding:0.4rem 0;">'+T('team.nochat','Nog geen berichten. Stuur je team een bericht.')+'</div>';
    html += '</div><div class="tt-compose"><input id="ttMsg" placeholder="'+T('team.msgph','Bericht aan het team')+'"><button id="ttSend">'+T('team.send','Stuur')+'</button></div></div>';

    $('#teamWrap').innerHTML = html;

    document.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', ()=>removeStaff(Number(b.dataset.rm))));
    // de interne call en het directe bericht (shared/teamcall.js en collegachat.js)
    document.querySelectorAll('[data-belm]').forEach(b => b.addEventListener('click', () => window.TeamCall && TeamCall.bel(parseInt(b.dataset.belm, 10), b.dataset.naam)));
    document.querySelectorAll('[data-dmm]').forEach(b => b.addEventListener('click', () => window.CollegaChat && CollegaChat.open(parseInt(b.dataset.dmm, 10), b.dataset.naam)));
    if (window.CollegaChat && a.staffId) CollegaChat.badges();
    const tcs = $('#teamCallSup'); if (tcs) tcs.addEventListener('click', () => window.TeamCall && TeamCall.groep());
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
    const chat = $('#ttChat'); if (chat) chat.scrollTop = chat.scrollHeight;
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

  /* ---- Borden: het gedeelde werkbord van de zaak (shared/borden.js) ----
     Dezelfde module draait ook in de PDA en de Business Pass, zodat het bord
     overal identiek werkt. */
  let bordenUI = null;
  function renderBorden(){
    const wrap = $('#bordenWrap');
    if (!wrap || !window.BordenUI) return;
    if (bordenUI) { bordenUI.refresh(); return; }
    bordenUI = BordenUI.mount(wrap, {
      laad: () => API.call('/supplier/borden'),
      doe: b => API.call('/supplier/bord', b),
      teamleden: () => (state && state.staff || []).map(m => ({ id: m.id, name: m.name })),
      kanBeheren: () => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); },
      T, toast
    });
  }

  /* ---- Reviews & reputatie: reageren op elke gastreview, met AI-concept ---- */
  function renderReviews(){
    const el = $('#reviewsWrap'); if (!el) return;
    const rating = state && state.reviews && state.reviews.rating;
    const revs = (state && state.reviews && state.reviews.recent) || [];
    let h = '<div class="card"><div class="tt-h">⭐ '+T('rev2.score','Uw reputatie')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:1.4rem;font-family:\'Bodoni Moda\',serif;">'+
      (rating ? rating.score+' <span style="font-size:0.8rem;color:var(--soft);">/ 5 · '+rating.aantal+' '+T('rev2.stuks','review(s)')+'</span>' : T('rev2.geen','Nog geen reviews'))+'</div>'+
      '<div class="softline" style="margin-top:0.3rem;">'+T('rev2.deck','Een snel, persoonlijk antwoord weegt zwaar: gasten lezen mee, en de schrijver krijgt uw reactie direct als melding.')+'</div></div>';
    h += revs.length ? revs.map(r =>
      '<div class="card">'+
      '<div class="tt-top" style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+'⭐'.repeat(r.score)+'<span style="opacity:0.25;">'+'⭐'.repeat(5-r.score)+'</span> · '+esc(r.codename||'gast')+'</b><time style="color:var(--soft);font-size:0.7rem;">'+timeAgo(r.at)+'</time></div>'+
      (r.tekst ? '<div style="margin-top:0.35rem;font-size:0.86rem;">'+esc(r.tekst)+'</div>' : '')+
      (r.reactie
        ? '<div style="margin-top:0.5rem;border-left:3px solid var(--gold);padding:0.4rem 0.7rem;font-size:0.82rem;"><b style="color:var(--gold);">'+T('rev2.uw','Uw reactie')+'</b> · '+timeAgo(r.reactie.at)+'<br>'+esc(r.reactie.tekst)+'</div>'
        : '<div class="tt-compose" style="margin-top:0.5rem;"><input id="rv-'+r.id+'" placeholder="'+T('rev2.ph','Schrijf een persoonlijke reactie...')+'">'+
          '<button class="obtn ghost" data-rvai="'+r.id+'">✨</button><button data-rvsend="'+r.id+'">'+T('team.send','Stuur')+'</button></div>')+
      '</div>').join('')
      : '<div class="card softline">'+T('rev2.leeg','Nog geen reviews. Na elke afgeronde dienst kan de gast er een achterlaten.')+'</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-rvai]').forEach(b => b.addEventListener('click', async () => {
      b.textContent = '…';
      try { const d = await API.call('/supplier/review/concept', { id: b.dataset.rvai }); const inp = $('#rv-'+b.dataset.rvai); if (inp) inp.value = d.concept; }
      catch(e){ toast(e.message); }
      b.textContent = '✨';
    }));
    el.querySelectorAll('[data-rvsend]').forEach(b => b.addEventListener('click', async () => {
      const inp = $('#rv-'+b.dataset.rvsend);
      if (!inp || !inp.value.trim()) return;
      try { await API.call('/supplier/review/reageer', { id: b.dataset.rvsend, tekst: inp.value.trim() }); toast('💬 '+T('rev2.ok','Reactie geplaatst; de gast krijgt een melding.')); await refresh(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---- Voorraad: de lichte inventaris, iedereen telt mee ---- */
  // het keukenbrein: voorraad met waarde, recepten met marge, telling,
  // verspilling, levering en het inkoopadvies (server: kern/keuken.js)
  async function renderVoorraad(){
    const el = $('#voorraadWrap'); if (!el) return;
    let d; try { d = await API.call('/supplier/keuken'); } catch(e){ return; }
    let ma = null; try { ma = await API.call('/supplier/keuken/menu-analyse'); } catch(e){}
    const vs = d.artikelen || [];
    const mgr = (() => { const a = actor(); return !!(a.manager || a.role === 'manager' || !a.staffId); })();
    const geld = x => '€ ' + (Number(x)||0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    let h = '<div class="card"><div class="st-row"><span>'+T('vr.waarde','Voorraadwaarde')+'</span><b>'+geld(d.totaalWaarde)+'</b></div>'+
      '<div class="st-row"><span>'+T('vr.onder','Onder minimum')+'</span><b'+(d.onderMinimum?' style="color:#FF8589;"':'')+'>'+d.onderMinimum+'</b></div></div>';
    // het inkoopadvies: aanvullen tot twee keer het minimum
    if ((d.advies||[]).length) h += '<div class="card" style="border-left:4px solid var(--gold,#A98F1C);"><div class="tt-h">🛒 '+T('vr.advies','Inkoopadvies')+'</div>'+
      d.advies.map(a => '<div class="st-row"><span>'+esc(a.naam)+' <span class="sub">'+a.aantal+' '+esc(a.eenheid)+', min '+a.min+'</span></span><b>+ '+a.advies+' '+esc(a.eenheid)+(a.kosten?' <span class="sub">'+geld(a.kosten)+'</span>':'')+'</b></div>').join('')+
      (mgr?'<button class="bigbtn" id="vrBestel" style="margin-top:0.5rem;">🛒 '+T('vr.bestel','Bestel dit advies bij de groothandel')+'</button>':'')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.advies.s','Geleverd = automatisch bijgeboekt, met de inkoopprijs als nieuwe kostprijs.')+'</div></div>';
    // de artikelen zelf, met kostprijs en de vloerhandelingen
    h += '<div class="card">'+(vs.length ? vs.map(v =>
      '<div class="st-row" style="align-items:center;"><span'+(v.min>0&&v.aantal<=v.min?' style="color:#FF8589;"':'')+'>'+esc(v.naam)+
        '<span class="sub">min '+v.min+(v.kostprijs?' · '+geld(v.kostprijs)+'/'+esc(v.eenheid):'')+(v.waarde?' · '+T('vr.wrd','waarde')+' '+geld(v.waarde):'')+'</span></span>'+
      '<span style="display:flex;gap:0.35rem;align-items:center;flex-shrink:0;">'+
        '<b style="min-width:3.6rem;text-align:center;">'+v.aantal+' '+esc(v.eenheid)+'</b>'+
        '<button class="obtn ghost" data-vtel="'+v.id+'" title="'+T('vr.tel','Telling')+'">🧮</button>'+
        '<button class="obtn ghost" data-vderf="'+v.id+'" title="'+T('vr.derf','Verspilling')+'">♻</button>'+
        (mgr?'<button class="obtn ghost" data-vlev="'+v.id+'" title="'+T('vr.lev','Levering')+'">🚚</button><button class="obtn warn" data-vweg="'+v.id+'">🗑</button>':'')+'</span></div>').join('')
      : '<div class="softline">'+T('vr.leeg','Nog geen voorraaditems. Het management zet hieronder de lijst op.')+'</div>')+'</div>';
    // recepten en marge per gerecht: dit maakt de afboeking automatisch
    const rec = (d.recepten||[]);
    if (rec.length) h += '<div class="card"><div class="tt-h">📖 '+T('vr.recepten','Recepten en marge')+'</div>'+
      rec.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;">'+
        '<div class="st-row"><span><b>'+esc(r.naam)+'</b> <span class="sub">'+geld(r.prijs)+(r.regels.length?' · '+T('vr.kost','kost')+' '+geld(r.kostprijs)+' · '+T('vr.marge','marge')+' '+geld(r.marge)+(r.margePct!=null?' ('+r.margePct+'%)':''):'')+'</span></span>'+
        (mgr?'<button class="obtn ghost" data-vrec="'+r.id+'">'+(r.regels.length?T('vr.rbew','Recept'):T('vr.rzet','+ Recept'))+'</button>':'')+'</div>'+
        (r.regels.length?'<div class="sub">'+r.regels.map(x=>x.hoeveelheid+' '+esc(x.eenheid)+' '+esc(x.naam)).join(' · ')+'</div>':'')+
        '</div>').join('')+
      '<div class="softline" style="margin-top:0.3rem;">'+T('vr.rec.s','Elke kassabon en betaalde bestelling boekt de ingredienten automatisch af via het recept.')+'</div></div>';
    // menu-engineering: volume maal marge, in de klassieke kwadranten
    if (ma && (ma.rijen||[]).some(r => r.verkocht > 0 || r.heeftRecept)){
      const KLASSE = { ster: ['⭐', '#D8B940'], werkpaard: ['🐴', '#69B98B'], puzzel: ['🧩', '#7FA6D9'], hond: ['🐕', '#FF8589'], onbekend: ['·', 'var(--soft)'] };
      h += '<div class="card"><div class="tt-h">📊 '+T('vr.me','Menu-engineering')+' <span class="sub">('+ma.dagen+' '+T('vr.dagen','dagen')+')</span></div>'+
        ma.rijen.map(r => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;">'+
          '<div class="st-row"><span><b style="color:'+KLASSE[r.klasse][1]+';">'+KLASSE[r.klasse][0]+' '+esc(r.klasse)+'</b> '+esc(r.naam)+'</span>'+
          '<span class="sub">'+r.verkocht+'× · '+T('vr.marge','marge')+' '+geld(r.marge)+' · '+T('vr.winst','winst')+' '+geld(r.brutowinst)+'</span></div>'+
          '<div class="sub">'+esc(r.advies)+'</div></div>').join('')+
        (mgr?'<button class="bigbtn" id="vrPlan" style="margin-top:0.5rem;">🧠 '+T('vr.plan','Vraag het actieplan')+'</button><div id="vrPlanUit"></div>':'')+'</div>';
    }
    // het logboek: elke beweging herleidbaar
    if ((d.logboek||[]).length) h += '<div class="card"><div class="tt-h">🧾 '+T('vr.log','Laatste bewegingen')+'</div>'+
      d.logboek.slice(0,8).map(l => '<div class="st-row"><span>'+esc(l.artikel)+' <span class="sub">'+esc(l.soort)+' · '+esc(l.oms||'')+' · '+esc(l.wie||'')+'</span></span><b'+(l.delta<0?' style="color:#FF8589;"':' style="color:#69B98B;"')+'>'+(l.delta>0?'+':'')+l.delta+'</b></div>').join('')+'</div>';
    if (mgr) h += '<div class="card"><div class="tt-h">'+T('vr.nieuw','Nieuw item')+'</div>'+
      '<div class="row-gap" style="margin-top:0.5rem;"><input class="st-in" id="vrNaam" placeholder="'+T('vr.naam','Naam, bijv. Cava brut')+'" style="flex:2;">'+
      '<input class="st-in" id="vrAantal" type="number" min="0" placeholder="'+T('vr.aantal','aantal')+'" style="flex:1;">'+
      '<input class="st-in" id="vrMin" type="number" min="0" placeholder="'+T('vr.mindr','min.')+'" style="flex:1;">'+
      '<input class="st-in" id="vrEenheid" placeholder="'+T('vr.eenheid','eenheid (fles, kg...)')+'" style="flex:1;">'+
      '<input class="st-in" id="vrKost" type="number" min="0" step="0.01" placeholder="'+T('vr.kostph','€/eenheid')+'" style="flex:1;"></div>'+
      '<button class="bigbtn" id="vrAdd" style="margin-top:0.5rem;">'+T('vr.voeg','Zet op de lijst')+'</button></div>';
    el.innerHTML = h;
    const doe = async (pad, body) => { try { await API.call(pad, body); renderVoorraad(); } catch(e){ toast(e.message); } };
    // een knop: het advies wordt een echte groothandelsbestelling
    const vb = el.querySelector('#vrBestel'); if (vb) vb.addEventListener('click', async () => {
      try {
        const markt = await API.call('/supplier/inkoop/markt', {});
        const ghs = markt.groothandels || [];
        if (!ghs.length){ toast(T('vr.geengh','Er is nog geen groothandel actief op het platform.')); return; }
        let code = ghs[0].code;
        if (ghs.length > 1){
          const keuze = prompt(T('vr.welkegh','Welke groothandel? ') + ghs.map(g=>g.code+' ('+g.naam+')').join(', '), code);
          if (!keuze) return;
          code = keuze.trim().toUpperCase();
        }
        const r = await API.call('/supplier/keuken/bestel-advies', { groothandelCode: code });
        toast('🛒 '+T('vr.besteld','Bestelling ')+r.order.ref+' '+T('vr.besteld2','geplaatst.')+(r.nietGevonden.length?' '+T('vr.nietgev','Niet in het assortiment: ')+r.nietGevonden.join(', '):''));
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
    // het actieplan van de chef-adviseur: kwadranten plus derving, in euro's
    const vp = el.querySelector('#vrPlan'); if (vp) vp.addEventListener('click', async () => {
      const uit = el.querySelector('#vrPlanUit');
      uit.innerHTML = '<div class="softline" style="margin-top:0.4rem;">'+T('vr.plan.laden','De adviseur rekent...')+'</div>';
      try {
        const p = await API.call('/supplier/keuken/menu-advies', {});
        uit.innerHTML = '<div class="sub" style="margin-top:0.5rem;">'+esc(p.samenvatting)+'</div>'+
          (p.acties||[]).map(x => '<div style="border-top:1px solid var(--line);padding:0.35rem 0;font-size:0.82rem;">'+
            (x.impact?'<b style="color:var(--gold);">'+geld(x.impact)+'</b> · ':'')+esc(x.tekst)+'</div>').join('');
      } catch(e){ uit.innerHTML = ''; toast(e.message); }
    });
    el.querySelectorAll('[data-vtel]').forEach(b => b.addEventListener('click', () => {
      const g = prompt(T('vr.telvraag','Wat is de getelde stand?')); if (g == null || g === '') return;
      doe('/supplier/keuken/telling', { artikelId: b.dataset.vtel, geteld: Number(String(g).replace(',', '.')) });
    }));
    el.querySelectorAll('[data-vderf]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.derfvraag','Hoeveel is er weg (breuk, derving)?')); if (hv == null || hv === '') return;
      const reden = prompt(T('vr.derfreden','Reden?')) || '';
      doe('/supplier/keuken/verspilling', { artikelId: b.dataset.vderf, hoeveelheid: Number(String(hv).replace(',', '.')), reden });
    }));
    el.querySelectorAll('[data-vlev]').forEach(b => b.addEventListener('click', () => {
      const hv = prompt(T('vr.levvraag','Hoeveel is er geleverd?')); if (hv == null || hv === '') return;
      const k = prompt(T('vr.levkost','Inkoopprijs per eenheid in euro (leeg = ongewijzigd)?'));
      doe('/supplier/keuken/levering', { artikelId: b.dataset.vlev, hoeveelheid: Number(String(hv).replace(',', '.')), kostprijs: k ? Number(String(k).replace(',', '.')) : undefined });
    }));
    el.querySelectorAll('[data-vweg]').forEach(b => b.addEventListener('click', () => doe('/supplier/voorraad/zet', { id: b.dataset.vweg, weg: true })));
    el.querySelectorAll('[data-vrec]').forEach(b => b.addEventListener('click', () => {
      const r = rec.find(x => x.id === b.dataset.vrec); if (!r) return;
      // compact recept-bewerken: "hoeveelheid x artikelnaam" per regel
      const huidig = r.regels.map(x => x.hoeveelheid + ' x ' + x.naam).join('\n');
      const inp = prompt(T('vr.recvraag','Recept voor ') + r.naam + T('vr.recuitleg',': per regel "hoeveelheid x artikelnaam", bijv. "0.2 x Lamsrack".'), huidig);
      if (inp == null) return;
      const regels = inp.split('\n').map(x => {
        const m = /^\s*([\d.,]+)\s*[xX]\s*(.+)$/.exec(x); if (!m) return null;
        const a = vs.find(v => v.naam.toLowerCase() === m[2].trim().toLowerCase());
        return a ? { artikelId: a.id, hoeveelheid: Number(m[1].replace(',', '.')) } : null;
      }).filter(Boolean);
      doe('/supplier/keuken/recept', { menuItemId: r.id, regels });
    }));
    const va = $('#vrAdd'); if (va) va.addEventListener('click', async () => {
      const naam = $('#vrNaam').value.trim(); if (!naam) return;
      try {
        await API.call('/supplier/voorraad/zet', { naam, aantal: Number($('#vrAantal').value)||0, min: Number($('#vrMin').value)||0, eenheid: $('#vrEenheid').value.trim(), kostprijs: Number(String($('#vrKost').value).replace(',', '.'))||0 });
        renderVoorraad();
      } catch(e){ toast(e.message); }
    });
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
    // de interne call en het directe bericht draaien op dezelfde stroom
    if (window.TeamCall) TeamCall.init({ API, mij: () => { const a = actor(); return a.staffId ? { staffId: a.staffId, name: a.name } : null; }, T, toast });
    if (window.CollegaChat) CollegaChat.init({ API, mij: () => ({ staffId: actor().staffId, name: actor().name }), T, toast });
    try { source = new EventSource('/api/supplier/stream?token='+encodeURIComponent(API.token)); } catch(e){ return; }
    source.addEventListener('hello', e => { const d=JSON.parse(e.data); notifs = d.unread||[]; renderBell(); });
    source.addEventListener('buzz', e => { const d=JSON.parse(e.data); showBuzz(d.from); });
    source.addEventListener('alarm', e => { const d=JSON.parse(e.data); showAlarm(d); });
    source.addEventListener('rtc', e => { if (window.TeamCall) TeamCall.event(e); });
    source.addEventListener('dm', e => { if (window.CollegaChat) CollegaChat.event(e); });
    source.addEventListener('sync', e => { refresh(); if (has('retail') && retailData) laadRetail(); if (has('charter') && charters !== null) laadCharters(); if (paspoortData) laadPaspoort(); if (has('boerderij') && boer) laadBoerderij(); if (has('creator') && cr) laadCreator(); if (sw) laadSamenwerking(); if (fact) laadFacturen(); laadAgendaSup(); });
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
  restoreSession();
  if ('serviceWorker' in navigator && (location.protocol==='http:'||location.protocol==='https:')) navigator.serviceWorker.register('/sw.js').catch(()=>{});
})();

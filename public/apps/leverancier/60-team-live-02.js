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

/* het team van vandaag */
    $('#teamWrap').innerHTML =
      (staff.length ? '<div class="card"><div class="k" style="display:flex;justify-content:space-between;align-items:center;">'+T('pd.buzzh','Collega oproepen')+'<span style="display:flex;gap:0.4rem;"><button class="abtn" id="teamCall" style="font-size:0.66rem;">'+T('pd.teamcall','Teamcall')+'</button><button class="abtn ghost" id="buzzAll" style="font-size:0.66rem;">'+T('pd.buzzall','Iedereen')+'</button></span></div>'+
        staff.map(m=>{
          const in2 = !!(state.klok && (state.klok.binnen||[]).includes(m.name));
          return '<div class="task"><span class="ic">'+(m.role==='manager'?'':'')+'</span><div class="t"><b>'+esc(m.name)+'</b><span>'+(m.role==='manager'?'Manager':T('pd.staff','Medewerker'))+(in2?' ·  '+T('pd.ingeklokt','ingeklokt'):'')+'</span></div>'+
            (in2?'<button class="abtn" data-belm="'+m.id+'" data-naam="'+esc(m.name)+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 3.5c-1 0-1.8.8-1.8 1.8 0 7.2 5.8 13 13 13 1 0 1.8-.8 1.8-1.8v-2.2c0-.8-.6-1.5-1.4-1.7l-2-.4c-.7-.2-1.4.1-1.8.7l-.4.8c-2-1-3.6-2.6-4.6-4.6l.8-.4c.6-.4.9-1.1.7-1.8l-.4-2C9.3 4.1 8.6 3.5 7.8 3.5z"/></svg></button>':'')+
            '<button class="abtn ghost" data-dmm="'+m.id+'" data-naam="'+esc(m.name)+'" style="position:relative;"><i data-dmbadge="'+m.id+'" style="display:none;position:absolute;top:-6px;right:-6px;background:#C23A5E;color:#fff;border-radius:0;font-style:normal;font-size:0.6rem;min-width:1.1rem;height:1.1rem;line-height:1.1rem;text-align:center;"></i></button>'+
            '<button class="abtn ghost" data-buzz="'+m.id+'">'+T('pd.buzz','Tril')+'</button></div>';
        }).join('')+'</div>' : '')+
      '<div class="card"><div class="k">'+T('pd.chat','Teamchat')+'</div><div class="chat">'+
      (team.length ? team.map(m=>'<div class="msg '+(m.who===me.name?'me':'other')+'"><span class="who">'+esc(m.who)+'</span>'+
        esc(m.text)+'</div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.nochat','Nog geen berichten.')+'</div>')+
      '</div><div class="compose"><input id="tmMsg" placeholder="'+T('pd.msgph','Bericht aan het team')+'"><button id="tmSend">'+T('pd.send','Stuur')+'</button></div></div>'+
      '<div class="card"><div class="k">'+T('pd.activity','Wie deed wat')+'</div>'+
      (act.length ? act.map(e=>'<div class="act"><b>'+esc(e.who)+'</b><span>'+esc(e.text)+'</span><time>'+timeAgo(e.at)+'</time></div>').join('') : '<div style="font-size:0.8rem;color:var(--soft);padding:0.4rem 0;">'+T('pd.noact','Nog geen activiteit.')+'</div>')+'</div>'+
      // Aparte ruimte: het personeelsnetwerk met andere zaken (met toestemming).
      '<div class="card"><div class="k">'+T('pd.net','Netwerk met andere zaken')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('pd.net.sub','Aparte ruimte. Alleen zaken die uw manager heeft verbonden.')+'</div>'+
      (netwerk.length ? netwerk.map(v => {
        if (v.status==='akkoord') return '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.open','tik om te chatten')+'</span></div><button class="abtn ghost" data-netopen="'+v.code+'"></button></div>';
        if (v.inkomend) return '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.inc','wil verbinden')+'</span></div>'+(me.role==='manager'?'<button class="abtn" data-netja="'+v.code+'">'+T('pd.accept','Akkoord')+'</button>':'<span style="font-size:0.7rem;color:var(--soft);">'+T('pd.net.mgr','manager beslist')+'</span>')+'</div>';
        return '<div class="task"><span class="ic"></span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.wait','wacht op akkoord')+'</span></div></div>';
      }).join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.net.none','Nog geen verbindingen.')+'</div>')+
      (me.role==='manager' ? '<div class="compose h-mt50"><input id="netCode" placeholder="'+T('pd.net.code','Bedrijfscode')+'" style="text-transform:uppercase;"><button id="netAdd">'+T('pd.net.connect','Verbind')+'</button></div>' : '')+
      '<div id="netChat"></div></div>';
    const send = async () => {
      const inp = $('#tmMsg'); const text = (inp.value||'').trim(); if (!text) return;
      inp.value = '';
      try { await API.call('/supplier/team/message', { text }); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    };
    $('#tmSend').addEventListener('click', send);
    $('#tmMsg').addEventListener('keydown', e => { if (e.key==='Enter') send(); });
    const tc = document.getElementById('teamCall'); if (tc) tc.addEventListener('click', () => window.TeamCall && TeamCall.groep());
    const ba = document.getElementById('buzzAll'); if (ba) ba.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { all: true }); toast(''+T('pd.allbuzzed','Hele team opgeroepen')+' ('+d.reached+').'); }
      catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-belm]').forEach(b => b.addEventListener('click', () => window.TeamCall && TeamCall.bel(parseInt(b.dataset.belm, 10), b.dataset.naam)));
    document.querySelectorAll('[data-dmm]').forEach(b => b.addEventListener('click', () => window.CollegaChat && CollegaChat.open(parseInt(b.dataset.dmm, 10), b.dataset.naam)));
    if (window.CollegaChat) CollegaChat.badges();
    document.querySelectorAll('[data-buzz]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { staffId: Number(b.dataset.buzz) });
        toast(d.reached ? ''+d.name+' '+T('pd.buzzed','wordt opgeroepen.') : d.name+' '+T('pd.buzzoff','heeft de app nu niet open.')); }
      catch(e){ toast(e.message); }
    }));
    // personeelsnetwerk: verbinden, goedkeuren en chatten in de aparte ruimte
    const na = document.getElementById('netAdd');
    if (na) na.addEventListener('click', async () => {
      const c = (document.getElementById('netCode').value||'').trim().toUpperCase(); if (!c) return;
      try { const d = await API.call('/supplier/net/verzoek', { code:c }); toast(d.status==='akkoord'?T('pd.net.linked','Verbonden.'):T('pd.net.sent','Verzoek verstuurd.')); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-netja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/net/beslis', { code:b.dataset.netja, actie:'akkoord' }); toast(T('pd.net.linked','Verbonden.')); await refresh(); openTab('team'); } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-netopen]').forEach(b => b.addEventListener('click', async () => {
      netOpen = b.dataset.netopen;
      try { netBerichten = (await API.call('/supplier/net/gesprek', { code:netOpen })).berichten || []; } catch(e){ netBerichten = []; }
      renderNetChat();
    }));
    renderNetChat();
  }
  let netOpen = null, netBerichten = [];
  function renderNetChat(){
    const box = document.getElementById('netChat'); if (!box) return;
    if (!netOpen){ box.innerHTML = ''; return; }
    const naam = (netwerk.find(v => v.code === netOpen) || {}).naam || netOpen;
    box.innerHTML = '<div class="k h-mt70">'+esc(naam)+'</div><div class="chat">'+
      (netBerichten.length ? netBerichten.map(m => '<div class="msg '+(m.code===code?'me':'other')+'"><span class="who">'+esc(m.naam+' · '+m.door)+'</span>'+esc(m.tekst)+'</div>').join('')
        : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.net.nomsg','Nog geen berichten.')+'</div>')+
      '</div><div class="compose"><input id="netMsg" placeholder="'+T('pd.net.msgph','Bericht')+'"><button id="netSend">'+T('pd.send','Stuur')+'</button></div>';
    const doSend = async () => {
      const i = document.getElementById('netMsg'); const t = (i.value||'').trim(); if (!t) return; i.value = '';
      try { await API.call('/supplier/net/bericht', { code:netOpen, tekst:t }); netBerichten = (await API.call('/supplier/net/gesprek', { code:netOpen })).berichten || []; renderNetChat(); } catch(e){ toast(e.message); }
    };
    document.getElementById('netSend').addEventListener('click', doSend);
    document.getElementById('netMsg').addEventListener('keydown', e => { if (e.key==='Enter') doSend(); });
  }

  // opgeroepen worden: trilscherm
  function showBuzz(from){
    if (navigator.vibrate) navigator.vibrate([300,120,300,120,600]);
    let el = document.getElementById('buzzOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'buzzOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    el.innerHTML = '<div class="bz"><div class="bz-ic"></div><b>'+esc(from)+'</b><span>'+T('pd.buzzcalls','roept u op')+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');

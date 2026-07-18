        if (v.inkomend) return '<div class="task"><span class="ic">📥</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.inc','wil verbinden')+'</span></div>'+(me.role==='manager'?'<button class="abtn" data-netja="'+v.code+'">'+T('pd.accept','Akkoord')+'</button>':'<span style="font-size:0.7rem;color:var(--soft);">'+T('pd.net.mgr','manager beslist')+'</span>')+'</div>';
        return '<div class="task"><span class="ic">📤</span><div class="t"><b>'+esc(v.naam)+'</b><span>'+T('pd.net.wait','wacht op akkoord')+'</span></div></div>';
      }).join('') : '<div style="font-size:0.8rem;color:var(--soft);">'+T('pd.net.none','Nog geen verbindingen.')+'</div>')+
      (me.role==='manager' ? '<div class="compose" style="margin-top:0.5rem;"><input id="netCode" placeholder="'+T('pd.net.code','Bedrijfscode')+'" style="text-transform:uppercase;"><button id="netAdd">'+T('pd.net.connect','Verbind')+'</button></div>' : '')+
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
      try { const d = await API.call('/supplier/team/buzz', { all: true }); toast('📢 '+T('pd.allbuzzed','Hele team opgeroepen')+' ('+d.reached+').'); }
      catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-belm]').forEach(b => b.addEventListener('click', () => window.TeamCall && TeamCall.bel(parseInt(b.dataset.belm, 10), b.dataset.naam)));
    document.querySelectorAll('[data-dmm]').forEach(b => b.addEventListener('click', () => window.CollegaChat && CollegaChat.open(parseInt(b.dataset.dmm, 10), b.dataset.naam)));
    if (window.CollegaChat) CollegaChat.badges();
    document.querySelectorAll('[data-buzz]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/team/buzz', { staffId: Number(b.dataset.buzz) });
        toast(d.reached ? '📳 '+d.name+' '+T('pd.buzzed','wordt opgeroepen.') : d.name+' '+T('pd.buzzoff','heeft de app nu niet open.')); }
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
    box.innerHTML = '<div class="k" style="margin-top:0.7rem;">'+esc(naam)+'</div><div class="chat">'+
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
    el.innerHTML = '<div class="bz"><div class="bz-ic">📳</div><b>'+esc(from)+'</b><span>'+T('pd.buzzcalls','roept u op')+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
    setTimeout(() => el.classList.remove('on'), 8000);
  }

  function showAlarm(d){
    if (navigator.vibrate) navigator.vibrate([500,150,500,150,800]);
    let el = document.getElementById('alarmOverlay');
    if (!el){
      el = document.createElement('div');
      el.id = 'alarmOverlay';
      document.getElementById('shell').appendChild(el);
      el.addEventListener('click', () => el.classList.remove('on'));
    }
    const locTxt = d.loc ? (d.label ? d.label + ' · ' : '') + d.loc.lat.toFixed(4) + ', ' + d.loc.lng.toFixed(4) : T('pd.noloc','locatie onbekend');
    el.innerHTML = '<div class="bz"><div class="bz-ic">🚨</div><b>'+esc(d.from)+'</b><span>'+(d.note?esc(d.note):T('pd.needs','heeft direct assistentie nodig'))+'</span>'+
      '<span style="margin-top:0.6rem;font-size:0.8rem;">📍 '+esc(locTxt)+'</span><i>'+T('pd.buzzclose','Tik om te bevestigen')+'</i></div>';
    el.classList.add('on');
  }

  // SOS en EHBO-alarm: locatie meesturen als die er is, direct het hele bedrijf
  // alarmeren. Een noodknop mag nooit blijven hangen: als de locatievraag niet
  // (op tijd) beantwoord wordt, gaat het alarm zonder locatie de deur uit.
  async function sendSOS(note, melding){
    let klaar = false;
    const fire = async (lat, lng) => {
      if (klaar) return;
      klaar = true;
      try { await API.call('/supplier/security', { lat, lng, note: note || '' }); toast(melding || ('🚨 '+T('pd.sossent','Noodoproep verstuurd. Het team en RTG zijn gealarmeerd.'))); }
      catch(e){ toast(e.message); }
    };
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(
        pos => fire(pos.coords.latitude, pos.coords.longitude),
        () => fire(undefined, undefined),
        { timeout: 2500 }
      );
      setTimeout(() => fire(undefined, undefined), 3200);
    } else fire(undefined, undefined);
  }

  /* ---------- de zorgbalie: de behandelaar-agenda (spa of kliniek) ----------
     Alleen zaken die als zorgaanbieder gekoppeld zijn (bijv. Zenith, Clara)
     krijgen deze tab; de agenda toont per behandelaar wie er komt, met de
     zorgcontext (allergenen, intake) die het lid met toestemming deelt. */
  let zbData = null, zbDatum = null;
  async function laadZorgbalie(){
    if (!API.token) return;
    try { zbData = await API.call('/supplier/care/agenda', zbDatum ? { datum: zbDatum } : {}); }
    catch(e){ zbData = null; }
    renderZorgbalie();
  }
  function renderZorgbalie(){
    const tabBtn = document.getElementById('tabZorgbalie');
    if (tabBtn) tabBtn.style.display = zbData ? '' : 'none';
    const wrap = $('#zorgbalieWrap');
    if (!wrap) return;
    if (!zbData){ wrap.innerHTML = ''; return; }
    const dagen = [];
    for (let i = 0; i < 7; i++){
      const dt = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const aan = dt === zbData.datum;
      dagen.push('<button class="abtn ghost" data-zbdag="'+dt+'" style="padding:0.4rem 0.7rem;'+(aan?'border-color:var(--gold);color:var(--gold);':'')+'"'+(aan?' aria-current="date"':'')+'>'+
        (i===0 ? T('pd.zb.vandaag','vandaag') : dt.slice(8)+'/'+dt.slice(5,7))+'</button>');
    }
    const perBehandelaar = (zbData.behandelaars || []).map(b => {

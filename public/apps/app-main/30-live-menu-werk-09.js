    if (!rij.length){
      h += '<div style="margin-top:0.6rem;font-size:0.82rem;color:var(--muted);">'+T('vac.leeg','Nu geen open vacatures die bij u passen. Kijk gerust later nog eens.')+'</div>';
    } else {
      h += '<div style="margin-top:0.7rem;display:flex;flex-direction:column;gap:0.6rem;">'+ rij.slice(0,20).map(({v,km})=>{
        const al = isApplied(v);
        const meta = [ VACSOORT[v.soort]||v.soort, (VLAG[v.land]||'')+' '+(v.landNaam||''), v.plaats||v.stad, km!=null?(''+Geo.tekst(km)):'' ].filter(x=>x&&x.trim()).join(' · ');
        return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.85rem;">'+
          '<div style="display:flex;align-items:flex-start;gap:0.5rem;justify-content:space-between;">'+
          '<div style="min-width:0;"><b style="font-size:0.9rem;">'+esc(v.func)+'</b>'+
          '<div style="font-size:0.74rem;color:var(--gold);font-weight:600;">'+esc(v.bedrijf)+'</div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.15rem;">'+esc(meta)+'</div></div>'+
          (al ? '<span style="flex-shrink:0;font-size:0.6rem;letter-spacing:0.06em;text-transform:uppercase;color:#4CAF7D;border:1px solid #4CAF7D;border-radius:999px;padding:0.15rem 0.5rem;">'+T('vac.verstuurd','verstuurd')+'</span>'
               : '<button class="vbtn" style="flex-shrink:0;width:auto;padding:0.4rem 0.8rem;font-size:0.74rem;" data-vac="'+v.id+'" data-sup="'+v.supplierCode+'">'+T('vac.sol','Solliciteer')+'</button>')+
          '</div>'+
          (v.omschrijving?'<div style="font-size:0.74rem;color:var(--muted);margin-top:0.4rem;line-height:1.4;">'+esc(v.omschrijving)+'</div>':'')+
          '</div>';
      }).join('')+'</div>';
    }
    el.innerHTML = h;
    const sel = $('#vacLand'); if (sel) sel.addEventListener('change', () => { vacLand = sel.value; loadVacatures(); });
    el.querySelectorAll('[data-vac]').forEach(b => b.addEventListener('click', () => applyVac(b.dataset.sup, b.dataset.vac)));
  }
  async function applyVac(supplierCode, vacatureId){
    const v = vacs.find(x => x.id === vacatureId);
    try {
      await API.call('/member/apply', { supplierCode, vacatureId });
      toast(T('cv.applied','Sollicitatie verstuurd, met uw RTG-cv erbij.'));
      if (v) myApps.unshift({ company: v.bedrijf, func: v.func, status: 'nieuw', at: new Date().toISOString() });
      renderVacatures(); renderCvCard();
    } catch(e){
      toast(e.message);
      if (/cv/i.test(e.message)) openCvSheet();
    }
  }

  /* ---------- chat met de werkgever (na uitnodigen/aannemen) ----------
     De sollicitant en de werkgever maken hier samen een afspraak om langs te
     komen. Berichten worden automatisch naar de gekozen taal vertaald. */
  let apChatId = null, apChatTimer = null;
  function apMsgHtml(m){
    const mij = m.van === 'sollicitant';
    const inner = mij ? escT(m.tekst) : '<span class="xlate">' + escT(m.tekst) + '</span>';
    return '<div class="dm-m' + (mij ? ' mine' : '') + '">' + inner + '</div>';
  }
  function ensureApChatEl(){
    let ov = document.getElementById('apchat'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='apchat';
    ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:none;align-items:flex-end;justify-content:center;';
    ov.innerHTML='<div style="background:var(--bg,#0C0C0B);border:1px solid var(--line);border-radius:16px 16px 0 0;width:min(100%,34rem);height:78vh;display:flex;flex-direction:column;">'+
      '<div style="display:flex;align-items:center;gap:.6rem;padding:.9rem 1rem;border-bottom:1px solid var(--line);"><b id="apchatWie" style="flex:1;"></b><button id="apchatX" style="background:none;border:none;color:var(--soft);font-size:1.3rem;">✕</button></div>'+
      '<div id="apchatMsgs" class="dm-body" style="flex:1;overflow:auto;padding:1rem;display:flex;flex-direction:column;gap:.4rem;"></div>'+
      '<div style="display:flex;gap:.5rem;padding:.8rem 1rem;border-top:1px solid var(--line);"><input id="apchatIn" placeholder="'+T('cv.chat.ph','Bericht (bijv. Kan ik donderdag om 15u langskomen?)')+'" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:.6rem .85rem;color:var(--txt,#fff);"><button id="apchatSend" class="vbtn" style="width:auto;padding:.5rem 1rem;">'+T('cv.chat.send','Stuur')+'</button></div>'+
      '</div>';
    document.body.appendChild(ov);
    ov.querySelector('#apchatX').addEventListener('click', closeApplyChat);
    ov.addEventListener('click', e=>{ if(e.target===ov) closeApplyChat(); });
    ov.querySelector('#apchatSend').addEventListener('click', sendApplyChat);
    ov.querySelector('#apchatIn').addEventListener('keydown', e=>{ if(e.key==='Enter') sendApplyChat(); });
    return ov;
  }
  async function laadApplyChat(){
    if (!apChatId) return;
    try { const d = await API.call('/member/apply/chat', { id: apChatId });
      const box = document.getElementById('apchatMsgs'); if(!box) return;
      box.innerHTML = (d.chat.berichten||[]).map(apMsgHtml).join('') || '<div style="color:var(--soft);text-align:center;margin:auto;font-size:0.82rem;">'+T('cv.chat.leeg','Nog geen berichten. Stel een moment voor om langs te komen.')+'</div>';
      vertaalBubbels(box); box.scrollTop = box.scrollHeight;
    } catch(e){}
  }
  function openApplyChat(id, bedrijf){
    apChatId = id; const ov = ensureApChatEl();
    ov.querySelector('#apchatWie').textContent = bedrijf || T('cv.chat.title','Chat met de werkgever');
    ov.style.display='flex'; laadApplyChat();
    clearInterval(apChatTimer); apChatTimer = setInterval(laadApplyChat, 4000);
  }
  function closeApplyChat(){ apChatId=null; clearInterval(apChatTimer); const ov=document.getElementById('apchat'); if(ov) ov.style.display='none'; }
  async function sendApplyChat(){
    const inp = document.getElementById('apchatIn'); const t=(inp.value||'').trim(); if(!t||!apChatId) return; inp.value='';
    try { await API.call('/member/apply/chat/send', { id: apChatId, text: t }); laadApplyChat(); } catch(e){ toast(e.message); }
  }

  /* ---------- gastchat met een partner ---------- */
  let pchat = null; // { code, name, dept, depts }
  const DEPT_EN = { 'Receptie':'Reception', 'Roomservice':'Room service', 'Housekeeping':'Housekeeping', 'Onderhoud':'Maintenance', 'Security':'Security', 'Beheer':'Management', 'Team':'Team' };
  const tDept = d => (lang() === 'en' ? (DEPT_EN[d] || d) : d);
  async function openPChat(code){
    const s = suppliers.find(x => x.code === code);
    if (!s) return;
    const depts = s.depts && s.depts.length ? s.depts : ['Team'];
    pchat = { code, name: s.name, dept: depts[0], depts };
    $('#pcName').textContent = s.name;
    renderPChatDepts();
    $('#pchat-sheet').classList.add('open');
    $('#pchat-scrim').classList.add('open');
    await loadPChat();
    $('#pcInput').focus();
  }
  function renderPChatDepts(){
    const el = $('#pcDepts');
    if (!pchat || pchat.depts.length < 2){ el.innerHTML = ''; return; }
    el.innerHTML = pchat.depts.map(d =>
      '<button data-dept="' + d + '"' + (d === pchat.dept ? ' class="on"' : '') + '>' + tDept(d) + '</button>'
    ).join('');
    el.querySelectorAll('[data-dept]').forEach(b => b.addEventListener('click', async () => {
      pchat.dept = b.dataset.dept;
      renderPChatDepts();
      await loadPChat();
    }));
  }
  function closePChat(){
    pchat = null;
    $('#pchat-sheet').classList.remove('open');
    $('#pchat-scrim').classList.remove('open');
  }
  async function loadPChat(){
    if (!pchat) return;
    let msgs = [];
    try { msgs = (await API.call('/partner/chat/history', { supplierCode: pchat.code, dept: pchat.dept })).messages || []; }
    catch(e){ return; }
    renderPChat(msgs);
  }
  function renderPChat(msgs){
    // Met Util.el: zowel de naam van de afzender (m.who) als de berichttekst gaan
    // structureel als tekstknoop. Dat sluit een gat: de oude versie zette m.who
    // ongefilterd in de HTML en escapete de tekst maar deels.
    const E = Util.el, body = $('#pcBody');
    if (!msgs.length){
      Util.vervang(body, E('div', { class: 'pc-empty' }, T('app.pc.empty', 'Stel uw vraag rechtstreeks aan het team. Roomservice, een verzoek aan de eigenaar, of gewoon even iets regelen.')));
      return;
    }
    Util.vervang(body, msgs.map(m => E('div', { class: 'pc-msg ' + (m.from === 'guest' ? 'me' : 'them') },
      m.from === 'partner' ? E('span', { class: 'who' }, m.who) : null,
      m.text,
      m.orig ? E('span', { style: { display: 'block', marginTop: '0.25rem', fontSize: '0.66rem', opacity: '0.55', fontStyle: 'italic' } }, m.orig) : null,
      E('time', {}, timeAgo(m.at)))));
    body.scrollTop = body.scrollHeight;
  }
  async function sendPChat(){
    const inp = $('#pcInput');
    const text = (inp.value || '').trim();

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
    if (!text || !pchat) return;
    inp.value = '';
    try { renderPChat((await API.call('/partner/chat/send', { supplierCode: pchat.code, dept: pchat.dept, text })).messages); }
    catch(e){ toast(e.message); }
  }
  $('#pcClose').addEventListener('click', closePChat);
  $('#pchat-scrim').addEventListener('click', closePChat);
  // vooraf al op elkaars Salon kijken: nooit vreemden van elkaar
  $('#pcSalon').addEventListener('click', () => { if (pchat) openEtalage(pchat.code); });
  $('#pcSend').addEventListener('click', sendPChat);
  $('#pcInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendPChat(); });
  // De gast vraagt zelf om aandacht: het team krijgt meteen een prioriteitsmelding.
  document.querySelectorAll('#pcAttn [data-attn]').forEach(b => b.addEventListener('click', async () => {
    if (!pchat) return;
    try { await API.call('/aandacht', { supplierCode: pchat.code, reden: b.dataset.attn }); toast(T('app.attn.ok','Het team is gewaarschuwd en komt eraan.')); }

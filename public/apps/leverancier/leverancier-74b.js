
  /* Afgesplitst van leverancier-74.js, dat over de 10 KB ging toen de drie
     berichtenlijsten er een werden. De snede loopt langs de grens tussen de
     LIJST (welke draden er zijn, van welke soort) en de DRAAD zelf (de
     gastchat: bubbels, vertaling, de Salon-knop). */
  function renderGChat(){
    const el = $('#gchatWrap'); if (!el) return;
    const chats = state.guestChats || [];
    if (gchatKey && !chats.find(c => c.key === gchatKey)) gchatKey = null;
    if (!gchatKey){
      const rijen = berichtRijen();
      el.innerHTML = '<div class="card">' + (rijen.length ? rijen.map((r, i) =>
        '<button class="gc-row" data-bericht="' + i + '">' +
          '<span class="av">' + String(r.titel || '?').split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<span class="gt"><b>' + r.titel + ' <em class="gc-dept">' + r.bij + '</em>' + (r.ongelezen ? ' <i class="gc-unread">' + r.ongelezen + '</i>' : '') + '</b>' +
          '<span>' + (r.vanMij ? T('gc.you','U: ') : '') + (r.laatste || '') + ' · ' + timeAgo(r.at) + '</span></span>' +
        '</button>'
      ).join('') : '<div class="softline">' + T('gc.none','Nog geen gesprekken. Berichten van gasten verschijnen hier live.') + '</div>') + '</div>';
      el.querySelectorAll('[data-bericht]').forEach(b => b.addEventListener('click', () => {
        const r = rijen[Number(b.dataset.bericht)]; if (!r) return;
        if (r.open.soort === 'werk') return openApChat(r.open.sleutel, r.titel);
        if (r.open.soort === 'collega') return window.CollegaChat && CollegaChat.open(r.open.staffId, r.titel);
        gchatKey = r.open.sleutel; klantSalonOpen = false; renderGChat(); openTab('gchat');
      }));
      return;
    }
    const meta = chats.find(c => c.key === gchatKey);
    el.innerHTML = '<button class="sp-back" id="gcBack">← ' + T('gc.back','Alle gesprekken') + '</button>' +
      '<div class="card"><div class="tt-h">' + T('sup.guest','Gast') + ' <span style="color:var(--rtg-leesgoud,var(--gold));">' + (meta ? meta.codename : '') + '</span>' + (meta && meta.dept ? ' · ' + meta.dept : '') +
        ' <button class="gc-salon-btn" id="gcSalonBtn">' + T('gc.salon','Bekijk Salon') + '</button></div>' +
      '<div id="gcSalon"></div>' +
      '<div class="tt-chat" id="gcThread"></div>' +
      '<div class="tt-compose"><input id="gcMsg" placeholder="' + T('gc.ph','Antwoord de gast') + '" autocomplete="off"><button id="gcSend">' + T('team.send','Stuur') + '</button></div></div>';
    $('#gcBack').addEventListener('click', () => { gchatKey = null; renderGChat(); openTab('gchat'); });
    $('#gcSalonBtn').addEventListener('click', toggleKlantSalon);
    $('#gcSend').addEventListener('click', sendGChat);
    $('#gcMsg').addEventListener('keydown', e => { if (e.key === 'Enter') sendGChat(); });
    loadGChatThread();
  }
  // De partner bekijkt vooraf de Salon van het lid: geen vreemden van elkaar.
  // Privacy-first: alleen de codenaam, de pas en de eigen posts van het lid.
  let klantSalonOpen = false;
  async function toggleKlantSalon(){
    const box = $('#gcSalon'); if (!box || !gchatKey) return;
    klantSalonOpen = !klantSalonOpen;
    if (!klantSalonOpen){ box.innerHTML = ''; return; }
    box.innerHTML = '<div class="softline">' + T('gc.salonLaad','Salon laden…') + '</div>';
    try {
      const d = await API.call('/supplier/klant/salon', { key: gchatKey });
      const posts = (d.posts || []).map(p =>
        '<div class="ks-post">' + (p.photo ? '<img src="' + p.photo + '" alt="' + T('gc.salonFoto','Salon-foto van het lid') + '">' : '') +
          '<div>' + (p.place ? '<em>' + esc(p.place) + '</em> ' : '') + esc(p.text) + '</div></div>'
      ).join('');
      box.innerHTML = '<div class="ks-card"><div class="ks-h">' +
          '<span class="av">' + (d.codename||'?').split(' ').map(w=>w[0]).slice(0,2).join('') + '</span>' +
          '<b>' + esc(d.codename || '') + '</b> <span class="ks-pas">' + esc(d.tier || '') + '</span></div>' +
        (posts || '<div class="softline">' + T('gc.salonLeeg','Dit lid heeft nog geen Salon-posts.') + '</div>') + '</div>';
    } catch(e){ box.innerHTML = '<div class="softline">' + T('gc.salonFout','Salon nu niet te laden.') + '</div>'; }
  }
  async function loadGChatThread(){
    if (!gchatKey) return;
    try {
      const d = await API.call('/supplier/chat/history', { key: gchatKey });
      fillGChatThread(d.messages);
    } catch(e){}
  }
  function fillGChatThread(msgs){
    const t = $('#gcThread'); if (!t) return;
    t.innerHTML = (msgs || []).map(m =>
      '<div class="tt-msg ' + (m.from === 'partner' ? 'me' : (m.from === 'systeem' ? 'sys' : 'other')) + '"><span class="who">' + (m.who || (m.from === 'systeem' ? 'RTG' : '')) + '</span>' +
      m.text.replace(/&/g,'&amp;').replace(/</g,'&lt;') +
      (m.orig ? '<span style="display:block;margin-top:0.25rem;font-size:0.68rem;color:var(--soft);font-style:italic;">' + m.orig.replace(/&/g,'&amp;').replace(/</g,'&lt;') + '</span>' : '') +
      '<time>' + timeAgo(m.at) + '</time></div>'
    ).join('');
    t.scrollTop = t.scrollHeight;
  }
  async function sendGChat(){
    const inp = $('#gcMsg');
    const text = (inp.value || '').trim();
    if (!text || !gchatKey) return;
    inp.value = '';
    try { fillGChatThread((await API.call('/supplier/chat/send', { key: gchatKey, text })).messages); }
    catch(e){ toast(e.message); }
  }

  // ---- pagina: foto's + publiceren op De Salon ----
  function fileToDataURL(file, cb){
    const reader = new FileReader();
    reader.onload = () => cb(String(reader.result));
    reader.readAsDataURL(file);
  }
  let salonStatus = null;
  async function laadSalonStatus(){
    if (!API.live) return;
    try { salonStatus = await API.call('/supplier/salon/status', {}); } catch(e){ salonStatus = null; }
    renderPage();
  }
  function renderPage(){
    const el = $('#pageWrap'); if (!el) return;
    const photos = state.photos || [];

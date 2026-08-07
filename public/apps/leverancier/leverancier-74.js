    el.querySelectorAll('[data-glstop]').forEach(b => b.addEventListener('click', async () => {
      try {
        const r = await API.call('/supplier/gastlocatie/stop', { id: b.dataset.glstop });
        toast(''+T('gl.gestopt','Meekijken gestopt;')+' '+r.deel.codenaam+' '+T('gl.gestopt2','heeft bericht gekregen.'));
        gastLocAt = 0; laadGastLoc();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderGasten(){
    const el = $('#gastenWrap'); if (!el) return;
    laadGastLoc();
    if (!has('bookings')){ el.innerHTML = gastLocBlok(); bindGastLoc(el); return; }
    const guests = state.guests || [];
    const nearby = state.nearbyGuests || [];

    // kaartje: het eigen pand + verbonden gasten met positie
    const pts = [];
    if (S.loc) pts.push({ lat:S.loc.lat, lng:S.loc.lng, me:true });
    guests.forEach(g => { if (g.loc) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codename }); });
    // gasten die met toestemming live meekijken laten, staan ook op de kaart
    (gastLoc || []).forEach(g => { if (g.loc && !pts.some(p => p.name === g.codenaam)) pts.push({ lat:g.loc.lat, lng:g.loc.lng, name:g.codenaam }); });
    let map = '';
    if (pts.length > 1){
      const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
      let minLat=Math.min(...lats), maxLat=Math.max(...lats), minLng=Math.min(...lngs), maxLng=Math.max(...lngs);
      let dLat=(maxLat-minLat)||0.002, dLng=(maxLng-minLng)||0.002;
      minLat-=dLat*0.2; maxLat+=dLat*0.2; minLng-=dLng*0.2; maxLng+=dLng*0.2;
      dLat=maxLat-minLat; dLng=maxLng-minLng;
      map = '<div class="gmap">'+pts.map(p=>{
        const x=((p.lng-minLng)/dLng)*100, y=(1-(p.lat-minLat)/dLat)*100;
        return '<div class="mk" style="left:'+x.toFixed(1)+'%;top:'+y.toFixed(1)+'%;">'+
          (p.me?'<div>'+RTGGlyf.tekst(S.icon)+'</div>':'<div class="gpin"></div>')+
          '<div class="lbl">'+(p.me?S.name.split(' ')[0]:p.name)+'</div></div>';
      }).join('')+'</div>';
    }

    let html = gastLocBlok();
    html += '<div class="card"><div class="tt-h">'+T('gst.connected','Verbonden gasten')+'</div>'+map+
      (guests.length ? guests.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        (g.arrived?'<span class="ge here">✓ '+T('sup.arrived','gearriveerd')+'</span>'
          : g.etaMin!=null?'<span class="ge"><b>'+g.etaMin+'</b> '+T('sup.minaway','min')+'</span>'
          : '<span class="ge">'+T('sup.enrouteshort','onderweg')+'</span>')+'</div>'
      ).join('') : '<div class="softline">'+T('gst.none','Nog geen verbonden gasten.')+'</div>')+'</div>';

    html += '<div class="card"><div class="tt-h">'+T('gst.nearby','Nu onderweg (nog niet verbonden)')+'</div>'+
      (nearby.length ? nearby.map(g =>
        '<div class="guest-row"><span class="cn">'+g.codename+'</span>'+
        '<div style="display:flex;align-items:center;gap:0.6rem;">'+(g.dest?'<span class="ge">'+T('gst.to','naar')+' '+g.dest+'</span>':'')+
        '<button class="obtn primary" data-connect="'+g.codename.replace(/"/g,'&quot;')+'">'+T('gst.connect','Verbind')+'</button></div></div>'
      ).join('') : '<div class="softline">'+T('gst.nonearby','Er is nu niemand live onderweg.')+'</div>')+
      '<div class="note-soft">'+T('gst.note','Verbinden meldt het bij de gast: u volgt de aankomst om alles klaar te zetten. U ziet daarna live de positie en aankomsttijd.')+'</div></div>';

    el.innerHTML = html;
    bindGastLoc(el);
    el.querySelectorAll('[data-connect]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/guest/connect', { codename: b.dataset.connect }); toast(T('gst.done','Verbonden. De gast is op de hoogte.')); await refresh(); openTab('gasten'); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---- BERICHTEN: EEN LIJST, DRIE SOORTEN DRAAD ----

     Hier stonden drie plekken waar iets kon liggen: de gastchat, de
     sollicitaties (in het team-tabblad) en de collega's (in een paneel). Voor
     wie er werkt is dat drie keer kijken of er iets is, terwijl het onderhuids
     allemaal gesprekken uit dezelfde kern zijn. De LIJST is daarom een: hij
     komt van /api/supplier/comm/inbox, en die zegt per gesprek zelf welke deur
     erbij hoort (het veld `open`).

     De DRADEN blijven wel apart, en dat is geen halfheid maar een keuze. De
     gastchat kan de Salon van de klant tonen en vertaalt per kijker; de
     sollicitatiechat hangt aan de werk-module met haar eigen controles; de
     collega-DM is een paneel dat in elke werk-app zit. Die drie samenvoegen
     zou functies kosten in ruil voor uniformiteit -- en de winst zat in het
     ZOEKEN, niet in het typen.

     Valt de ene lijst weg (oude server, netwerk), dan staan de gastgesprekken
     er nog gewoon uit state.guestChats. Een nieuw scherm hoort niet minder te
     tonen dan het oude als er iets hapert. */
  let gchatKey = null; // open gesprek
  let inboxRijen = null; // de ene lijst; null = nog niet opgehaald
  async function laadInbox(){
    try {
      const d = await API.call('/supplier/comm/inbox', {});
      inboxRijen = (d.gesprekken || []).filter(g => g.open);
    } catch (e) { inboxRijen = null; }
    renderGChat();
  }
  /* De terugval: de gastgesprekken zoals ze er altijd stonden. Zo is deze
     verbouwing omkeerbaar en kost een hapering niets. */
  const alsRij = c => ({ titel: c.codename, bij: c.dept, laatste: c.last, at: c.lastAt,
    ongelezen: c.unread, vanMij: c.lastFrom === 'partner', open: { soort: 'gast', sleutel: c.key } });
  function berichtRijen(){
    if (inboxRijen && inboxRijen.length) {
      return inboxRijen.map(g => ({ titel: g.titel, bij: (g.open.dept || SOORTNAAM(g.open.soort)),
        laatste: g.laatste, at: g.at, ongelezen: g.ongelezen, vanMij: g.laatsteVanMij, open: g.open }));
    }
    return (state.guestChats || []).map(alsRij);
  }
  const SOORTNAAM = s => s === 'werk' ? T('gc.s.werk','Sollicitatie')
    : s === 'collega' ? T('gc.s.collega','Collega') : T('gc.s.gast','Gast');

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
      '<div class="card"><div class="tt-h">' + T('sup.guest','Gast') + ' <span style="color:var(--gold);">' + (meta ? meta.codename : '') + '</span>' + (meta && meta.dept ? ' · ' + meta.dept : '') +
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

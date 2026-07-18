    for (const r of (social.requests || [])){
      html += '<div class="sc-req"><b>' + escT(r.codename) + '</b><span style="color:var(--soft);font-size:0.7rem;">' + T('sal.wilverbinden','wil verbinden') + '</span>' +
        '<button class="ja" data-scja="' + escT(r.key) + '">' + T('sal.accepteer','Accepteer') + '</button>' +
        '<button data-scnee="' + escT(r.key) + '">✕</button></div>';
    }
    html += '<div class="sc-strip">' +
      '<button class="sc-p add" id="scAddBtn"><span class="sc-av">+</span><span>' + T('sal.add','Toevoegen') + '</span></button>' +
      (social.connections || []).map(c =>
        '<button class="sc-p" data-scdm="' + escT(c.key) + '" data-cn="' + escT(c.codename) + '">' +
          '<span class="sc-av">' + initCN(c.codename) + (c.unread ? '<span class="sc-badge">' + c.unread + '</span>' : '') + '</span>' +
          '<span>' + escT(c.codename.split(' ')[0]) + '</span></button>'
      ).join('') + '</div>';
    html += '<div class="sc-zoek" id="scZoek"><input id="scQ" placeholder="' + T('sal.zoekph','Zoek op codenaam, bijv. Gouden Ibis') + '"><button id="scGo">' + T('sal.zoek','Zoek') + '</button></div>' +
      '<div class="sc-res" id="scRes"></div>';
    el.innerHTML = html;

    el.querySelectorAll('[data-scja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/member/connect/respond', { key: b.dataset.scnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-scdm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.scdm, b.dataset.cn)));
    const add = $('#scAddBtn'); if (add) add.addEventListener('click', () => { $('#scZoek').classList.toggle('open'); const q = $('#scQ'); if (q) q.focus(); });
    const go = $('#scGo'); if (go) go.addEventListener('click', zoekLeden);
    const q = $('#scQ'); if (q) q.addEventListener('keydown', e => { if (e.key === 'Enter') zoekLeden(); });
  }

  async function zoekLeden(){
    const q = $('#scQ').value.trim();
    if (q.length < 2){ toast(T('sal.zoekkort','Typ minimaal twee letters.')); return; }
    try {
      const d = await API.call('/member/find', { q });
      $('#scRes').innerHTML = (d.results || []).map(r =>
        '<div class="sc-hit"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(r.codename) + '</span><b>' + escT(r.codename) + '</b>' +
        (r.status === 'geen' ? '<button data-scvz="' + escT(r.key) + '">' + T('sal.verzoek','Verzoek sturen') + '</button>'
         : r.status === 'verbonden' ? '<span style="color:var(--green,#2E7D4F);font-size:0.72rem;">✓ ' + T('sal.isverbonden','verbonden') + '</span>'
         : r.status === 'aangevraagd' ? '<span style="color:var(--soft);font-size:0.72rem;">' + T('sal.gevraagd','aangevraagd') + '</span>'
         : '<span style="color:var(--gold);font-size:0.72rem;">' + T('sal.wachtu','wacht op u') + '</span>') + '</div>'
      ).join('') || '<div style="font-size:0.78rem;color:var(--soft);">' + T('sal.niksgevonden','Geen leden gevonden met deze codenaam.') + '</div>';
      $('#scRes').querySelectorAll('[data-scvz]').forEach(b => b.addEventListener('click', async () => {
        try { await API.call('/member/connect', { key: b.dataset.scvz }); toast(T('sal.verzonden','Verzoek verstuurd.')); zoekLeden(); } catch(e){ toast(e.message); }
      }));
    } catch(e){ toast(e.message); }
  }

  /* ---- dm ---- */
  async function openDm(key, naam){
    dmWith = key; dmNaam = naam;
    $('#dmNaam').textContent = naam;
    $('#dm-sheet').classList.add('open'); $('#dm-scrim').classList.add('open');
    await laadDm();
    loadSocial(); // ongelezen-teller bijwerken
  }
  async function laadDm(){
    if (!dmWith) return;
    try {
      const d = await API.call('/member/dm', { withKey: dmWith });
      $('#dmBody').innerHTML = (d.messages || []).map(m => dmBubbel(m)).join('') ||
        '<div style="font-size:0.78rem;color:var(--soft);text-align:center;margin:auto 0;">' + T('sal.dm.leeg','Nog geen berichten. Zeg hallo.') + '</div>';
      vertaalBubbels($('#dmBody'));
      $('#dmBody').scrollTop = 999999;
    } catch(e){ toast(e.message); }
  }
  // Vertaal binnenkomende berichten naar de gekozen taal van de lezer. Alleen
  // berichten van de ander (.xlate) worden vertaald; eigen berichten niet.
  function vertaalBubbels(root){
    if (!root || !window.Vertaal) return;
    root.querySelectorAll('.xlate:not([data-vt])').forEach(function(el){
      el.setAttribute('data-vt','1');
      Vertaal.vul(el, el.textContent, lang());
    });
  }
  function dmBubbel(m){
    const mijn = m.from === social.me;
    const tijd = new Date(m.at).toLocaleTimeString(lang()==='en'?'en-GB':'nl-NL',{hour:'2-digit',minute:'2-digit'});
    const txt = mijn ? escT(m.text) : '<span class="xlate">' + escT(m.text) + '</span>';
    return '<div class="dm-m' + (mijn ? ' mine' : '') + '">' + txt +
      (m.post ? '<div class="dm-post"><b>↗ ' + escT(m.post.author) + ' · ' + escT(m.post.place) + '</b>' + escT(m.post.text) + '…</div>' : '') +
      '<span class="tijd">' + tijd + '</span></div>';
  }
  function dmToevoegen(m){ const b = $('#dmBody'); b.insertAdjacentHTML('beforeend', dmBubbel(m)); vertaalBubbels(b); b.scrollTop = 999999; }
  async function stuurDm(){
    const text = $('#dmInput').value.trim();
    if (!text || !dmWith) return;
    $('#dmInput').value = '';
    try {
      const d = await API.call('/member/dm/send', { toKey: dmWith, text });
      dmToevoegen(d.message);
    } catch(e){ toast(e.message); }
  }
  $('#dmSend').addEventListener('click', stuurDm);
  $('#dmInput').addEventListener('keydown', e => { if (e.key === 'Enter') stuurDm(); });
  const dmDicht = () => { $('#dm-sheet').classList.remove('open'); $('#dm-scrim').classList.remove('open'); dmWith = null; };
  $('#dmClose').addEventListener('click', dmDicht);
  $('#rideGo').addEventListener('click', verstuurRit);
  $('#rideClose').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#ride-scrim').addEventListener('click', () => { $('#ride-sheet').classList.remove('open'); $('#ride-scrim').classList.remove('open'); });
  $('#dm-scrim').addEventListener('click', dmDicht);

  /* ---- post delen ---- */
  let deelPost = null;
  function openShare(postId){
    if (!socialOK){ toast(T('sal.eerstlid','Alleen voor leden.')); return; }
    if (!(social.connections || []).length){ toast(T('sal.geenconn','Nog geen connecties. Voeg eerst iemand toe in De Salon.')); return; }
    deelPost = postId;
    $('#shareList').innerHTML = social.connections.map(c =>
      '<button class="sc-hit" style="width:100%;cursor:pointer;" data-deel="' + escT(c.key) + '"><span class="sc-av" style="width:34px;height:34px;font-size:0.7rem;">' + initCN(c.codename) + '</span><b>' + escT(c.codename) + '</b><span style="color:var(--gold);font-size:0.72rem;">↗</span></button>'
    ).join('');
    $('#shareList').querySelectorAll('[data-deel]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/member/dm/send', { toKey: b.dataset.deel, postId: deelPost, text: '' });
        toast(T('sal.gedeeld','Gedeeld.'));
        $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open');
      } catch(e){ toast(e.message); }
    }));
    $('#share-sheet').classList.add('open'); $('#share-scrim').classList.add('open');
  }
  $('#shareClose').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });
  $('#share-scrim').addEventListener('click', () => { $('#share-sheet').classList.remove('open'); $('#share-scrim').classList.remove('open'); });

  /* ---- bellen en videobellen (WebRTC) ---- */
  let call = null;        // { pc, stream, withKey, naam, video, richting, pendingIce, timer, t0 }
  let inkomend = null;    // { from, codename, video }

  function belUI(open){
    $('#callScreen').classList.toggle('open', !!open);
    if (!open){ $('#csRemote').srcObject = null; $('#csLocal').srcObject = null; }
  }
  function belTimer(){
    if (!call) return;
    const s = Math.round((Date.now() - call.t0) / 1000);
    $('#csTijd').textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  let iceConfig = null;
  // Elke oproep verse ICE-servers (TURN met kort geldige inloggegevens roteert).
  async function haalIce(){ try { iceConfig = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ iceConfig = [{ urls:'stun:stun.l.google.com:19302' }]; } return iceConfig; }
  function maakPc(){

  /* ================= SALON-CONNECTIES =================
     Leden voegen elkaar toe op codenaam, chatten 1-op-1, delen posts
     en bellen elkaar. Bellen is echte WebRTC: beeld en geluid gaan
     rechtstreeks tussen de twee telefoons; de server geeft alleen de
     belsignalen door en ziet nooit het gesprek. */
  let social = { me: null, codename: null, connections: [], requests: [] };
  let socialOK = false;      // false = gast of nog niet geladen: geen sociale UI
  let dmWith = null, dmNaam = '';
  const escT = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const initCN = cn => String(cn||'?').trim().split(/\s+/).map(w=>w[0]).slice(0,2).join('').toUpperCase();

  async function loadSocial(){
    if (!API.live) return;
    try {
      const d = await API.call('/member/connections');
      social = d; socialOK = true;
    } catch(e){ socialOK = false; }
    renderSocialBar();
    renderContacts();
    renderSpelen();
  }

  // Spelen-kaart op Home: voor elke pas (RTG, Lifestyle en Business dezelfde
  // spelgroep); alleen een anonieme demo-gast zonder account speelt niet mee
  function renderSpelen(){
    const el = $('#homeSpelen'); if (!el) return;
    // de kaart begint verborgen (hidden in de HTML): zo staat er nooit een
    // lege kaart op Home als de sociale laag (nog) niet geladen is
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = '<div class="label">'+T('spel.label','Spelen')+'</div>'+
      '<div class="big" style="font-size:1.02rem;">🎲 '+T('spel.kop','Een potje tussendoor?')+'</div>'+
      '<div class="meta" style="margin:.2rem 0 .7rem;">'+T('spel.uitleg','Schaken, Woordduel, Magnaat, 30 Seconden, Proost (18+) en Vingerroulette. Tegen vrienden of een random tegenstander; samen spelen maakt je niet automatisch vrienden.')+'</div>'+
      '<button class="go" id="gaSpelen">'+T('spel.ga','Naar de spellen')+' →</button>';
    el.querySelector('#gaSpelen').addEventListener('click', () => { location.href = '/apps/spelen.html?pas=' + encodeURIComponent(vastePas || 'rtg'); });
  }

  // Contacten-kaart op Home: na het toevoegen bericht of (video)bel je elkaar met één tik
  function snelBel(key, naam, video){ dmWith = key; dmNaam = naam; beginGesprek(video); }
  function renderContacts(){
    const el = $('#homeContacts'); if (!el) return;
    // ook een gratis account (met paspoort) chat met vrienden; alleen een
    // anonieme demo-gast zonder account niet
    if (!socialOK || !user || (user.tier === 'guest' && !user.account)){ el.style.display='none'; return; }
    el.style.display='';
    const conns = social.connections || [], reqs = social.requests || [];
    const totUnread = conns.reduce((n,c)=> n + (c.unread||0), 0);
    let html = '<div class="label">Contacten'+(totUnread?' · <span style="color:var(--gold)">'+totUnread+' nieuw</span>':'')+'</div>';
    reqs.forEach(r => {
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2rem;height:2rem;">'+initCN(r.codename)+'</span>'+
        '<div class="grow-min"><b>'+escT(r.codename)+'</b><div class="meta">wil verbinden</div></div>'+
        '<button class="go" style="padding:.2rem .6rem;" data-cja="'+escT(r.key)+'">Accepteer</button>'+
        '<button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-cnee="'+escT(r.key)+'">✕</button></div>';
    });
    if (!conns.length && !reqs.length){
      html += '<div class="big" style="font-size:1.02rem;">Nog geen contacten</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">Voeg iemand toe in De Salon; daarna bericht of (video)bel je elkaar met één tik, zonder telefoonnummer.</div>'+
        '<button class="go" data-goto="salon">Iemand toevoegen →</button>';
    } else {
      html += conns.map(c =>
        '<div class="hc-rij" style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2.2rem;height:2.2rem;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+initCN(c.codename)+(c.unread?'<span class="sc-badge">'+c.unread+'</span>':'')+'</span>'+
        '<b style="flex:1;min-width:0;cursor:pointer;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">'+escT(c.codename)+'</b>'+
        '<button class="go" style="padding:.2rem .5rem;" data-dm="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">Bericht</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-snap="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'" title="Snap">📷</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-bel="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">📞</button>'+
        '<button class="go" style="background:transparent;padding:.2rem .35rem;" data-vid="'+escT(c.key)+'" data-cn="'+escT(c.codename)+'">🎥</button></div>'
      ).join('') + '<button class="go" style="margin-top:.7rem;background:transparent;color:var(--muted);" data-goto="salon">+ Iemand toevoegen</button>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-dm]').forEach(b => b.addEventListener('click', () => openDm(b.dataset.dm, b.dataset.cn)));
    el.querySelectorAll('[data-snap]').forEach(b => b.addEventListener('click', () => snapKies(b.dataset.snap)));
    el.querySelectorAll('[data-bel]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.bel, b.dataset.cn, false)));
    el.querySelectorAll('[data-vid]').forEach(b => b.addEventListener('click', () => snelBel(b.dataset.vid, b.dataset.cn, true)));
    renderSnapsStories();
    el.querySelectorAll('[data-cja]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cja, action: 'accept' }); toast(T('sal.verbonden','Verbonden.')); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-cnee]').forEach(b => b.addEventListener('click', async () => { try { await API.call('/member/connect/respond', { key: b.dataset.cnee, action: 'decline' }); loadSocial(); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
  }

  /* ---------- snaps en 24-uurs verhalen (Snapchat-achtig) ---------- */
  let snapNaar = null, snapStoryMode = false, snapFileEl = null;
  function snapFile(){ if (!snapFileEl){ snapFileEl = document.createElement('input'); snapFileEl.type='file'; snapFileEl.accept='image/*'; snapFileEl.style.display='none'; document.body.appendChild(snapFileEl); snapFileEl.addEventListener('change', snapGekozen); } return snapFileEl; }
  function snapKies(key){ snapNaar = key; snapStoryMode = false; snapFile().click(); }
  function storyKies(){ snapStoryMode = true; snapNaar = null; snapFile().click(); }
  async function snapGekozen(e){
    const f = e.target.files[0]; e.target.value=''; if(!f) return;
    const foto = await snapVerklein(f); if(!foto){ toast(T('snap.leesfout','Kon de foto niet lezen.')); return; }
    const tekst = prompt(T('snap.tekst','Tekst erbij (mag leeg):'),'') || '';
    try {
      if (snapStoryMode){ await API.call('/member/story/post', { foto, tekst }); toast('✨ '+T('snap.storyok','Je verhaal staat er 24 uur op.')); loadStories(); }
      else { await API.call('/member/snap/send', { toKey: snapNaar, foto, tekst }); toast('📷 '+T('snap.verstuurd','Snap verstuurd. Hij verdwijnt na bekijken.')); }
    } catch(err){ toast(err.message); }
  }
  function snapVerklein(file){
    return new Promise(res => { const img=new Image(), rd=new FileReader();
      rd.onload=()=>{ img.onload=()=>{ const max=1000; let w=img.width,h=img.height; if(w>max||h>max){ const r=Math.min(max/w,max/h); w=Math.round(w*r); h=Math.round(h*r);} const cv=document.createElement('canvas'); cv.width=w; cv.height=h; cv.getContext('2d').drawImage(img,0,0,w,h); res(cv.toDataURL('image/jpeg',0.7)); }; img.onerror=()=>res(null); img.src=rd.result; };
      rd.onerror=()=>res(null); rd.readAsDataURL(file); });
  }
  /* ---------- verplichte onboarding + contract (blokkeert de app) ---------- */
  let onbBezig = false;
  async function checkOnboarding(){
    if (!API.live || !API.token || onbBezig) return;
    let st; try { st = await API.call('/onboarding/status'); } catch(e){ return; }
    if (!st || st.klaar){ var g0 = document.getElementById('onbGate'); if (g0) g0.hidden = true; return; }
    tekenOnbGate(st);
  }
  function onbInputType(t){ return t==='date'?'date':t==='email'?'email':t==='tel'?'tel':'text'; }
  function tekenOnbGate(st){
    const g = document.getElementById('onbGate'); if (!g) return;
    g.hidden = false;
    const vBox = document.getElementById('onbVelden');
    // bewaar wat de gebruiker al typte (een KYC-upload herbouwt dit paneel)
    const huidig = {}; vBox.querySelectorAll('input[data-veld]').forEach(function(i){ if (i.value) huidig[i.dataset.veld] = i.value; });
    vBox.textContent='';
    (st.velden||[]).forEach(function(v){
      if (v.type === 'kyc'){
        const d = document.createElement('div'); d.className='onb-kyc';
        const l = document.createElement('div');
        const b = document.createElement('b'); b.textContent = v.label; l.appendChild(b);
        const s = document.createElement('span'); s.className='sub';
        s.textContent = v.ingevuld ? T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.') : T('onb.kyc.upl','Upload een foto van de voorkant van uw paspoort.');
        l.appendChild(s); d.appendChild(l);
        if (v.ingevuld){ const st2 = document.createElement('span'); st2.className='st'; st2.style.color='#7EE0A3'; st2.textContent='✓'; d.appendChild(st2); }
        else { const btn = document.createElement('button'); btn.type='button'; btn.className='onb-btn ghost'; btn.textContent=T('onb.kyc.knop','Uploaden');
          btn.addEventListener('click', ()=> document.getElementById('onbKycFile').click()); d.appendChild(btn); }
        vBox.appendChild(d); return;
      }
      const wrap = document.createElement('label'); wrap.className='onb-veld';
      const sp = document.createElement('span'); sp.textContent = v.label + (v.ingevuld ? ' ✓' : '');
      wrap.appendChild(sp);
      const inp = document.createElement('input'); inp.type = onbInputType(v.type); inp.dataset.veld = v.id;
      inp.value = huidig[v.id] != null ? huidig[v.id] : (v.waarde || ''); inp.autocomplete = ({naam:'name',email:'email',telefoon:'tel',adres:'street-address',postcode:'postal-code',woonplaats:'address-level2',land:'country-name'})[v.id] || 'off';
      wrap.appendChild(inp); vBox.appendChild(wrap);
    });
    document.getElementById('onbCTitel').textContent = st.contract.titel || '';
    document.getElementById('onbCTekst').textContent = st.contract.tekst || '';
    const ak = document.getElementById('onbAkkoord'); ak.checked = ak.checked || !!st.contract.ondertekend;
    document.getElementById('onbFout').textContent = '';
  }
  (function initOnb(){
    const kf = document.getElementById('onbKycFile');
    if (kf) kf.addEventListener('change', async () => {
      const file = kf.files[0]; kf.value=''; if (!file) return;
      if (file.size > 5*1024*1024){ document.getElementById('onbFout').textContent = T('onb.toobig','De foto is te groot (max 5 MB).'); return; }
      const data = await snapVerklein(file); if (!data) return;
      try { await API.call('/verify/upload', { image: data }); if (user) user.verified='pending'; toast(T('onb.kyc.ok','Ontvangen, wordt gecontroleerd.')); checkOnboarding(); }
      catch(e){ document.getElementById('onbFout').textContent = e.message || 'Upload mislukt.'; }
    });
    const kn = document.getElementById('onbKlaar');
    if (kn) kn.addEventListener('click', async () => {
      const fout = document.getElementById('onbFout'); fout.textContent='';
      onbBezig = true;
      try {
        const velden = {};
        document.querySelectorAll('#onbVelden input[data-veld]').forEach(function(i){ if (i.value.trim()) velden[i.dataset.veld] = i.value.trim(); });
        if (Object.keys(velden).length) { try { await API.call('/onboarding/opslaan', { velden }); } catch(e){} }
        const naam = (document.getElementById('onbNaam').value || '').trim();
        const akkoord = document.getElementById('onbAkkoord').checked;
        const r = await API.call('/onboarding/teken', { naam, akkoord });
        if (r.klaar){ document.getElementById('onbGate').hidden = true; toast(T('onb.welkom','Welkom aan boord! Fijne reis.')); onbBezig=false; return; }
        tekenOnbGate(r);
        fout.textContent = T('onb.rest','Nog niet compleet: vul de resterende velden in (ook uw paspoort).');
      } catch(e){ fout.textContent = e.message || 'Er ging iets mis.'; }
      onbBezig = false;
    });
  })();

  function snapOverlay(){
    let ov = document.getElementById('snapOv'); if (ov) return ov;
    ov = document.createElement('div'); ov.id='snapOv';
    ov.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.9);display:none;flex-direction:column;align-items:center;justify-content:center;padding:1rem;';
    ov.innerHTML='<button id="snapOvX" style="position:absolute;top:1rem;right:1rem;background:none;border:none;color:#fff;font-size:1.6rem;">✕</button>'+
      '<div id="snapOvVan" style="color:#fff;font-size:.85rem;margin-bottom:.6rem;"></div>'+
      '<img id="snapOvImg" alt="" style="max-width:100%;max-height:72vh;border-radius:12px;">'+
      '<div id="snapOvTxt" style="color:#fff;margin-top:.7rem;text-align:center;"></div>'+
      '<div id="snapOvNote" style="color:#999;font-size:.72rem;margin-top:.7rem;"></div>';
    document.body.appendChild(ov);
    ov.querySelector('#snapOvX').addEventListener('click', ()=>{ ov.style.display='none'; ov.querySelector('#snapOvImg').src=''; loadSocial(); });
    return ov;
  }
  async function renderSnapsStories(){
    const el = $('#homeContacts'); if (!el || !socialOK) return;
    // verhalen-strip + inkomende snaps bovenaan de contactenkaart
    let stories = [], snaps = [];
    try { stories = (await API.call('/member/stories')).stories || []; } catch(e){}
    try { snaps = (await API.call('/member/snaps')).snaps || []; } catch(e){}
    let box = el.querySelector('#snapStrip');
    if (!box){ box = document.createElement('div'); box.id='snapStrip'; el.insertBefore(box, el.firstChild.nextSibling); }
    let h = '<div style="display:flex;gap:.6rem;overflow-x:auto;padding:.2rem 0 .7rem;">';
    h += '<button id="storyPlus" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:1.2rem;background:var(--card2);border:2px dashed var(--gold);color:var(--gold);">＋</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;">Verhaal</span></button>';
    h += stories.map(v=>'<button class="js-story" data-id="'+escT(v.id)+'" style="flex:0 0 auto;background:none;border:none;text-align:center;width:3.6rem;cursor:pointer;"><span style="display:flex;width:3rem;height:3rem;border-radius:50%;margin:0 auto;align-items:center;justify-content:center;font-size:.72rem;font-weight:700;background:var(--card2);border:2px solid '+(v.gezien?'var(--line)':'var(--gold)')+';">'+initCN(v.van)+'</span><span style="display:block;font-size:.6rem;color:var(--soft);margin-top:.2rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+escT(v.vanMij?'Jij':v.van)+'</span></button>').join('');
    h += '</div>';
    if (snaps.length){
      h += '<div style="display:flex;flex-direction:column;gap:.35rem;margin-bottom:.5rem;">'+snaps.map(sn=>
        '<div style="display:flex;align-items:center;gap:.5rem;font-size:.78rem;"><span>📷</span><b style="flex:1;color:var(--gold);">'+escT(sn.van)+'</b><span style="color:var(--soft);">stuurde een snap</span><button class="js-opensnap go" data-id="'+escT(sn.id)+'" style="padding:.15rem .55rem;">Bekijk</button></div>'
      ).join('')+'</div>';
    }
    box.innerHTML = h;
    box.querySelector('#storyPlus').addEventListener('click', storyKies);
    box.querySelectorAll('.js-story').forEach(b => b.addEventListener('click', () => openStory(b.dataset.id)));
    box.querySelectorAll('.js-opensnap').forEach(b => b.addEventListener('click', () => openSnap(b.dataset.id)));
  }
  async function openSnap(id){
    let d; try { d = await API.call('/member/snap/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Snap van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = T('snap.weg','Deze snap verdwijnt zodra je sluit.');
    ov.style.display='flex';
  }
  async function openStory(id){
    let d; try { d = await API.call('/member/story/view', { id }); } catch(e){ toast(e.message); return; }
    const ov = snapOverlay();
    ov.querySelector('#snapOvVan').textContent = 'Verhaal van ' + d.van;
    ov.querySelector('#snapOvImg').src = d.foto;
    ov.querySelector('#snapOvTxt').textContent = d.tekst || '';
    ov.querySelector('#snapOvNote').textContent = '';
    ov.style.display='flex';
  }

  function renderSocialBar(){
    const el = $('#socialBar'); if (!el) return;
    if (!socialOK){ el.innerHTML = ''; return; }
    let html = '';
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
    const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls:'stun:stun.l.google.com:19302' }] });
    call.stream.getTracks().forEach(t => pc.addTrack(t, call.stream));
    pc.onicecandidate = ev => { if (ev.candidate && call) API.call('/member/call', { toKey: call.withKey, kind: 'ice', payload: ev.candidate }).catch(()=>{}); };
    pc.ontrack = ev => {
      const v = $('#csRemote');
      if (v.srcObject !== ev.streams[0]) v.srcObject = ev.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected' && call && !call.t0){ call.t0 = Date.now(); call.timer = setInterval(belTimer, 1000); }
      if (pc.connectionState === 'failed'){ toast(T('sal.belmislukt','Verbinding mislukt. Op een streng netwerk lukt bellen soms niet.')); eindeGesprek(false); }
      else if (pc.connectionState === 'closed') eindeGesprek(false);
    };
    call.pc = pc;
    window.__rtgCall = () => call; // voor tests
    return pc;
  }
  async function pakMedia(video){
    try { return await navigator.mediaDevices.getUserMedia({ audio: true, video: video ? { facingMode: 'user' } : false }); }
    catch(e){ toast(T('sal.geenmedia','Geen toegang tot microfoon of camera.')); return null; }
  }
  function toonGesprek(naam, video){
    $('#csNaam').textContent = naam; $('#csNaam2').textContent = naam;
    $('#csAv').textContent = initCN(naam);
    $('#csAudioOnly').style.display = video ? 'none' : 'flex';
    $('#csLocal').style.display = video ? '' : 'none';
    $('#csCam').style.display = video ? '' : 'none';
    $('#csTijd').textContent = T('sal.belt','gaat over…');
    belUI(true);
  }
  async function beginGesprek(video){
    if (!dmWith) return;
    if (call){ toast(T('sal.algesprek','Er loopt al een gesprek.')); return; }
    await haalIce();
    const stream = await pakMedia(video);
    if (!stream) return;
    call = { withKey: dmWith, naam: dmNaam, video, richting: 'uit', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(dmNaam, video);
    try { await API.call('/member/call', { toKey: call.withKey, kind: 'ring', video }); }
    catch(e){ toast(e.message); eindeGesprek(false); }
  }
  $('#dmBel').addEventListener('click', () => beginGesprek(false));
  $('#dmVideo').addEventListener('click', () => beginGesprek(true));
  $('#dmBlok').addEventListener('click', async () => {
    if (!dmWith) return;
    const keuze = prompt('Wat wil je doen met ' + dmNaam + '?\n\n1 = Blokkeren\n2 = Melden\n3 = Blokkeren en melden', '1');
    if (keuze === null) return;
    try {
      if (keuze === '2' || keuze === '3') { const reden = prompt('Wat is er aan de hand?', '') || ''; await API.call('/member/report', { key: dmWith, reden }); }
      if (keuze === '1' || keuze === '3') { await API.call('/member/block', { key: dmWith }); $('#dm-sheet').classList.remove('open'); loadSocial(); }
      toast(keuze === '2' ? T('sal.gemeld', 'Bedankt, je melding is doorgegeven.') : T('sal.geblokkeerd', 'Geblokkeerd.'));
    } catch (e) { toast(e.message); }
  });

  async function neemOp(){
    $('#callIncoming').classList.remove('open');
    if (!inkomend) return;
    await haalIce();
    const stream = await pakMedia(inkomend.video);
    if (!stream){ API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{}); inkomend = null; return; }
    call = { withKey: inkomend.from, naam: inkomend.codename, video: inkomend.video, richting: 'in', pendingIce: [], stream, t0: 0 };
    $('#csLocal').srcObject = stream;
    toonGesprek(inkomend.codename, inkomend.video);
    await API.call('/member/call', { toKey: call.withKey, kind: 'accept' }).catch(()=>{});
    inkomend = null;
  }
  $('#ciJa').addEventListener('click', neemOp);
  $('#ciNee').addEventListener('click', () => {
    $('#callIncoming').classList.remove('open');
    if (inkomend) API.call('/member/call', { toKey: inkomend.from, kind: 'decline' }).catch(()=>{});
    inkomend = null;
  });

  function eindeGesprek(zeggen){
    if (!call) { belUI(false); return; }
    if (zeggen) API.call('/member/call', { toKey: call.withKey, kind: 'hangup' }).catch(()=>{});
    clearInterval(call.timer);
    try { call.stream.getTracks().forEach(t => t.stop()); } catch(e){}
    try { if (call.pc) call.pc.close(); } catch(e){}
    call = null;
    belUI(false);
  }
  $('#csWeg').addEventListener('click', () => eindeGesprek(true));
  $('#csMute').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getAudioTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csMute').classList.toggle('dicht', !t.enabled);
  });
  $('#csCam').addEventListener('click', () => {
    if (!call) return;
    const t = call.stream.getVideoTracks()[0]; if (!t) return;
    t.enabled = !t.enabled;
    $('#csCam').classList.toggle('dicht', !t.enabled);
  });

  async function flushIce(){
    if (!call || !call.pc || !call.pc.remoteDescription) return;
    for (const c of call.pendingIce.splice(0)) { try { await call.pc.addIceCandidate(c); } catch(e){} }
  }
  async function opBelsignaal(d){
    if (d.kind === 'ring'){
      if (call){ API.call('/member/call', { toKey: d.from, kind: 'busy' }).catch(()=>{}); return; }
      inkomend = { from: d.from, codename: d.codename, video: d.video };
      $('#ciAv').textContent = initCN(d.codename);
      $('#ciNaam').textContent = d.codename;
      $('#ciSoort').textContent = d.video ? T('sal.videogesprek','Videogesprek') : T('sal.spraakoproep','Spraakoproep');
      $('#callIncoming').classList.add('open');
      return;
    }
    if (!call || d.from !== call.withKey) return;
    if (d.kind === 'accept'){
      const pc = maakPc();
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      API.call('/member/call', { toKey: call.withKey, kind: 'offer', payload: offer }).catch(()=>{});
    } else if (d.kind === 'offer'){
      const pc = maakPc();
      await pc.setRemoteDescription(d.payload);
      await flushIce();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      API.call('/member/call', { toKey: call.withKey, kind: 'answer', payload: answer }).catch(()=>{});
    } else if (d.kind === 'answer'){
      await call.pc.setRemoteDescription(d.payload);
      await flushIce();
    } else if (d.kind === 'ice'){
      if (call.pc && call.pc.remoteDescription) { try { await call.pc.addIceCandidate(d.payload); } catch(e){} }
      else call.pendingIce.push(d.payload);
    } else if (d.kind === 'hangup' || d.kind === 'decline' || d.kind === 'busy'){
      toast(d.kind === 'busy' ? T('sal.bezet','In gesprek.') : d.kind === 'decline' ? T('sal.geweigerd','Oproep geweigerd.') : T('sal.opgehangen','Gesprek beëindigd.'));
      eindeGesprek(false);
    }
  }

  function opSociaal(d){
    if (d.kind === 'request'){ toast('🤝 ' + d.from + ' ' + T('sal.wilverbinden','wil verbinden')); loadSocial(); }
    else if (d.kind === 'accepted'){ toast('🤝 ' + d.by + ' ' + T('sal.accepteerde','accepteerde uw verzoek')); loadSocial(); }
    else if (d.kind === 'dm'){
      if (dmWith === d.from && $('#dm-sheet').classList.contains('open')){
        dmToevoegen({ from: d.from, text: d.text, post: d.post, at: d.at });
        API.call('/member/dm', { withKey: d.from }).catch(()=>{}); // gelezen
      } else {
        toast('💬 ' + d.codename + ': ' + (d.text || '↗').slice(0, 60));
        loadSocial();
      }
    }
  }


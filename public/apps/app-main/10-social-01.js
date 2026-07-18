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

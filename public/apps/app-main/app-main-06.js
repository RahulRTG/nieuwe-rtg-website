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
      '<div class="big" style="font-size:1.02rem;">'+T('spel.kop','Een potje tussendoor?')+'</div>'+
      '<div class="meta" style="margin:0.25rem 0 0.75rem;">'+T('spel.uitleg','Schaken, Woordduel, Magnaat, 30 Seconden, Proost (18+) en Vingerroulette. Tegen vrienden of een random tegenstander; samen spelen maakt je niet automatisch vrienden.')+'</div>'+
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
    let html = '<div class="label">Contacten'+(totUnread?' · <span style="color:var(--rtg-leesgoud,var(--gold))">'+totUnread+' nieuw</span>':'')+'</div>';
    reqs.forEach(r => {
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2rem;height:2rem;">'+initCN(r.codename)+'</span>'+
        '<div class="grow-min"><b>'+escT(r.codename)+'</b><div class="meta">wil verbinden</div></div>'+
        '<button class="go" style="padding:.2rem .6rem;" data-cja="'+escT(r.key)+'">Accepteer</button>'+
        '<button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-cnee="'+escT(r.key)+'">✕</button></div>';
    });

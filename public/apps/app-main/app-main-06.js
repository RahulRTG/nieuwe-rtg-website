/* het gesprek met Rahul: versturen, wachten en het antwoord tonen */
    async function stuur(){
      const tekst = inp.value.trim();
      if (!tekst || bezig) return;
      inp.value = '';
      inp.closest('.ag-rij').classList.remove('vol');
      // wachtwoord-herstel loopt via zijn eigen kleine gesprek
      if (resetStap){ bezig = true; try { await resetStuur(tekst); } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); } bezig = false; inp.focus(); return; }
      bezig = true;
      try {
        // "opnieuw" en "wachtwoord vergeten" zijn commando's voor het gesprek,
        // ook midden in het wachtwoordstadium; al het andere is daar een
        // wachtwoordpoging, rechtstreeks naar de ene inlogroute
        const commando = loginU && tekst.length <= 40 && /\b(opnieuw|vergeten)\b/i.test(tekst);
        if (loginU && !commando){
          try {
            await login('rtg', { u: loginU, p: tekst });
            zeg('rahul', T('ag.welkom','Daar ben je weer: welkom terug in het huis.'));
            toonVoortgang({});
          } catch(e){
            zeg('rahul', (e && e.message ? e.message + ' ' : '') + T('ag.wwmis','Probeer het nog eens, zeg "opnieuw", of zeg "wachtwoord vergeten" en dan regel ik een herstel-link.'));
          }
        } else {
          const d = await API.call('/aanmeld/zeg', { id: gesprek, tekst, lang: document.documentElement.lang || 'nl' });
          zeg('rahul', d.tekst);
          toonVoortgang(d);
          // ingelogd via de sleutelwoorden: de server heeft server-side
          // geverifieerd en een echte token gemunt; wij bewaren hem en
          // herstellen de sessie precies zoals na een gewone inlog
          if (d.ingelogd && d.token){
            try { API.token = d.token; localStorage.setItem('rtg_member_token', d.token); } catch(e2){}
            bezig = false;
            if (typeof restoreSession === 'function') await restoreSession();
            return;
          }
          // wachtwoord vergeten: Rahul belooft de herstel-link, de app vraagt
          // hem stil aan op de bestaande route (die nooit een bestaan lekt)
          if (d.vergeten && d.vergeten.u){
            API.call('/auth/forgot', { email: d.vergeten.u }).catch(() => {});
          }
          if (d.login && d.login.u){
            loginU = d.login.u;
            wachtwoordVeld();
          } else if (/wachtwoord/i.test(d.tekst) && !d.klaar){
            // de aanmeld-wachtwoordstap: niemand kijkt mee, ook op het scherm niet
            wachtwoordVeld(T('ag.wwnieuw','Kies een wachtwoord'));
          } else {
            tekstVeld();
          }
          if (d.klaar && d.velden){
            if (d.werkgever) { try { localStorage.setItem('rtg_ag_werkgever', JSON.stringify(d.werkgever)); } catch(e2){} }
            if (d.woonplaats) { try { localStorage.setItem('rtg_ag_woonplaats', d.woonplaats); } catch(e2){} }
            // dezelfde ene registratieroute als het formulier
            await login('rtg', { register: true, name: d.velden.name, u: d.velden.email, phone: d.velden.phone,
              geboortedatum: d.velden.geboortedatum, p: d.velden.password, tier: d.velden.tier });
          }
        }
      } catch(e){ zeg('rahul', e.message || T('ag.mis2','Dat ging even mis; zeg het nog eens.')); }
      // zei de gebruiker "opnieuw", dan verlaat de motor het inlogpad;
      // de app volgt door het wachtwoordveld weer een tekstveld te maken
      if (loginU && /\bopnieuw\b/i.test(tekst)){ loginU = null; tekstVeld(); }
      bezig = false;
      inp.focus();
    }
    doos.querySelector('#agGo').addEventListener('click', stuur);
    inp.addEventListener('keydown', e => { if (e.key === 'Enter'){ e.preventDefault(); stuur(); } });
    inp.addEventListener('input', () => inp.closest('.ag-rij').classList.toggle('vol', !!inp.value.trim()));
    // herstel-link uit de e-mail: Rahul begint meteen het herstel-gesprek.
    // Anders begint het gewone gesprek zodra duidelijk is dat er geen sessie ligt.
    let onthouden = null;
    try { onthouden = localStorage.getItem('rtg_member_token'); } catch(e){}
    if (herstel){ andereManier(true); setTimeout(resetStart, 400); }
    else if (!onthouden) setTimeout(() => passkeyInlog(true), 400);
    inp.addEventListener('focus', () => { if (!herstel && !resetStap) start(); }, { once: true });
  })();
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
    let html = '<div class="label">Contacten'+(totUnread?' · <span style="color:var(--gold)">'+totUnread+' nieuw</span>':'')+'</div>';
    reqs.forEach(r => {
      html += '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);">'+
        '<span class="sc-av" style="width:2rem;height:2rem;">'+initCN(r.codename)+'</span>'+
        '<div class="grow-min"><b>'+escT(r.codename)+'</b><div class="meta">wil verbinden</div></div>'+
        '<button class="go" style="padding:.2rem .6rem;" data-cja="'+escT(r.key)+'">Accepteer</button>'+
        '<button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-cnee="'+escT(r.key)+'">✕</button></div>';
    });

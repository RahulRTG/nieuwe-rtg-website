/* inloggen en de staat binnenhalen: token, pas en het eerste scherm */
    API.token = t;
    try {
      applyState((await API.call('/state')).state);
      const doelPas = user.tier === 'guest' ? 'rtg' : user.tier;
      const magHier = vastePas ? (vastePas === 'rtg' ? ['rtg','guest'] : [vastePas]) : [];
      if (!magHier.includes(user.tier)){
        if (['rtg','lifestyle','business'].includes(doelPas)){ location.replace(pasAdres(doelPas)); return; }
        API.token = null; return; // onbekende pas: poort tonen
      }
      $('#gate').style.display = 'none';
      $('#app').classList.add('active');
      renderAll();
      if (window.RTGRealtime) RTGRealtime.start(API.token, { onSync: syncScope, onChange: renderBell, onSocial: opSociaal, onCall: opBelsignaal, onBezorg: opBezorg, onOntmoetSignaal: opOntmoetSignaal });
      loadSocial();
      checkOnboarding(); laadAgendaLid();
    } catch(e){
      API.token = null;
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
    }
  }

  async function doLogout(){
    try { if (API.live) await API.call('/logout'); } catch(e){}
    try { localStorage.removeItem('rtg_member_token'); } catch(e){}
    try { localStorage.removeItem('rtg_actieve_tab'); } catch(e){} // de volgende gast begint op het beginscherm
    location.reload();
  }

  /* De poort is van Rahul: inloggen, aanmelden EN wachtwoord-herstel als een
     gesprek. Er zijn geen ouderwetse formulieren meer; Rahul is de enige poort.
     Hij ontdekt zelf of je terugkomt of nieuw bent, vraagt subtiel wat hij
     nodig heeft en legt op "waarom?" uit waarvoor iets dient. Alle paden
     eindigen op de bestaande routes: aanmelden via login() -> /auth/register,
     inloggen via login() -> /auth/login, herstel via /auth/reset. Het
     wachtwoord van een terugkerend lid gaat NOOIT door het gespreks-endpoint
     maar rechtstreeks naar de inlogroute. In beeld: de klok, Rahuls
     signatuurmond van bewegende lichtpuntjes, zijn zin en de ene regel van de
     gebruiker. Deelt de IIFE-scope met 00-kern-03.js (login, restoreSession,
     API, T). */
  (function aanmeldGesprek(){
    const gate = document.getElementById('gate');
    if (!gate || !API.enabled) return;
    const st = document.createElement('style');
    st.textContent =
      '.ag-doos{display:flex;flex-direction:column;width:100%;}' +
      // geen chatbubbels: alleen Rahuls zin, groot en stil in Bodoni, en
      // daaronder de ene regel van de gebruiker; verder niets
      /* VASTE KLEUR, GEEN MEEBEWEGENDE. Deze zin is het enige wat je aan de
         poort te lezen krijgt, op een donkere sterrenhemel. Hij stond op
         var(--txt), en die schuift mee met de dagkleur: afhankelijk van het
         tijdstip werd hij warmer en doffer, en een gebruiker meldde dat de
         letters bij hem niet zo wit waren. Leesbaarheid van de enige tekst op
         het scherm hoort niet van het uur van de dag af te hangen. CLAUDE.md
         is hier ook duidelijk over: op zwart is de tekstkleur wit. */
      ".ag-zin{font-family:'Bodoni Moda',serif;font-weight:400;font-size:1.12rem;line-height:1.65;color:#FBFAF8;" +
        'text-align:center;min-height:4.6rem;display:flex;align-items:center;justify-content:center;' +
        'padding:0.9rem 0.4rem 1.1rem;text-wrap:balance;animation:agZin 0.5s ease;}' +
      '@keyframes agZin{from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:none;}}' +
      '.ag-rij{display:flex;align-items:center;border-bottom:1px solid var(--line);margin:0 0.6rem;transition:border-color 0.2s;}' +
      '.ag-rij[hidden]{display:none;}' +
      '.ag-rij:focus-within{border-color:var(--burgundy);}' +
      '.ag-rij input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt);' +
        "font-family:'Inter',sans-serif;font-size:0.95rem;text-align:center;padding:0.75rem 0.4rem;}" +
      '.ag-rij input::placeholder{color:var(--soft);}' +
      '.ag-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#857007);font-size:1.15rem;' +
        'padding:0.4rem 0.2rem;opacity:0;transition:opacity 0.2s;font-family:inherit;}' +
      '.ag-rij:focus-within button,.ag-rij.vol button{opacity:0.85;}' +
      '.ag-mond{display:block;margin:0.15rem auto 0.3rem;width:220px;height:100px;}' +
      // De passkey is de voordeur: groot genoeg als eerste handeling, maar nog
      // steeds in de stille horlogetaal van het huis.
      '.ag-passkey{margin:0.95rem auto 0;background:color-mix(in srgb,var(--gold,#857007) 10%,transparent);' +
        'border:1px solid color-mix(in srgb,var(--gold,#857007) 48%,transparent);border-radius:0;color:var(--gold,#857007);' +
        'font-family:inherit;font-size:0.82rem;letter-spacing:0.03em;cursor:pointer;min-height:44px;padding:0.65rem 1.15rem;' +
        'display:flex;align-items:center;justify-content:center;gap:0.48rem;min-width:min(18rem,82vw);}' +
      '.ag-passkey[hidden]{display:none;}' +
      '.ag-passkey svg{width:17px;height:17px;stroke:currentColor;fill:none;}' +
      '.ag-anders{margin:0.65rem auto 0;padding:0.4rem 0.7rem;background:none;border:0;color:var(--soft);' +
        'font:inherit;font-size:0.72rem;letter-spacing:0.025em;cursor:pointer;text-decoration:underline;text-underline-offset:0.22rem;}' +
      '.ag-anders[hidden]{display:none;}' +
      /* De ballotage-regalia: pas zichtbaar zodra de vier vragen beginnen.
         Een stille kopregel met haarlijnen (de horlogetaal van het huis), en
         daaronder vier Romeinse cijfers als plaatsbepaling -- een uitnodiging,
         geen formulierbalk. Bij vertrouwelijke vragen (geboortedatum,
         wachtwoord) verschijnt een gedempte kluisregel onder het veld. */
      '.ag-kop{display:none;align-items:center;gap:0.8rem;justify-content:center;margin:0 0 0.35rem;' +
        "font-family:'Inter',sans-serif;font-size:0.62rem;font-weight:500;letter-spacing:0.34em;" +
        'text-transform:uppercase;color:var(--gold,#857007);opacity:0;transition:opacity var(--rtg-royaal,560ms) var(--rtg-ease,ease);}' +
      '.ag-kop::before,.ag-kop::after{content:"";flex:0 0 2.2rem;height:1px;' +
        'background:color-mix(in srgb, var(--gold,#857007) 45%, transparent);}' +
      '.ag-doos.ag-ballotage .ag-kop{display:flex;opacity:1;}' +
      '.ag-stappen:empty{display:none !important;}' +
      ".ag-stappen{display:none;justify-content:center;gap:1.6rem;margin:1.05rem 0 0;font-family:'Bodoni Moda',serif;" +
        'font-size:0.8rem;color:var(--soft);opacity:0;transition:opacity var(--rtg-royaal,560ms) var(--rtg-ease,ease);}' +
      '.ag-doos.ag-ballotage .ag-stappen{display:flex;opacity:1;}' +
      '.ag-stappen span{transition:color var(--rtg-tempo,340ms) var(--rtg-ease,ease);}' +
      '.ag-stappen span.nu{color:var(--gold,#857007);}' +
      '.ag-stappen span.gehad{color:color-mix(in srgb, var(--gold,#857007) 55%, var(--soft));}' +
      ".ag-kluis{display:none;justify-content:center;margin:0.7rem 0 0;font-family:'Inter',sans-serif;" +
        'font-size:0.68rem;letter-spacing:0.06em;color:var(--soft);opacity:0;transition:opacity var(--rtg-tempo,340ms) var(--rtg-ease,ease);}' +
      '.ag-doos.ag-kluis-aan .ag-kluis{display:flex;opacity:1;}' +
      // de sterrenhemel gaat achter alles; de poort-inhoud eroverheen
      '#gate > *:not(canvas){position:relative;z-index:1;}' +
      /* OP DESKTOP VULT DE HEMEL HET SCHERM. De poort was een kaart van 662px
         midden op een venster van 1600: de sterren stonden opgesloten in een
         rechthoek met afgeronde hoeken en daarbuiten was het vlak zwart. Een
         inlogscherm hoort geen venster in een venster te zijn.
         De inhoud houdt zijn eigen breedte -- alleen de HEMEL wordt groot. */

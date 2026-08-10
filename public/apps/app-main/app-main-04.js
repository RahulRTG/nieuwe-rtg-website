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
      '.ag-rij:focus-within{border-color:var(--burgundy);}' +
      '.ag-rij input{flex:1;min-width:0;background:none;border:none;outline:none;color:var(--txt);' +
        "font-family:'Inter',sans-serif;font-size:0.95rem;text-align:center;padding:0.75rem 0.4rem;}" +
      '.ag-rij input::placeholder{color:var(--soft);}' +
      '.ag-rij button{background:none;border:none;cursor:pointer;color:var(--gold,#857007);font-size:1.15rem;' +
        'padding:0.4rem 0.2rem;opacity:0;transition:opacity 0.2s;font-family:inherit;}' +
      '.ag-rij:focus-within button,.ag-rij.vol button{opacity:0.85;}' +
      '.ag-mond{display:block;margin:0.15rem auto 0.3rem;width:220px;height:100px;}' +
      // Face ID / passkey: een ingetogen gouden regel onder het veld, alleen
      // zichtbaar zodra Rahul weet met wie hij praat (een terugkerend lid)
      '.ag-passkey{margin:0.95rem auto 0;background:none;border:none;color:var(--gold,#857007);' +
        'font-family:inherit;font-size:0.78rem;letter-spacing:0.03em;cursor:pointer;opacity:0.9;' +
        'display:flex;align-items:center;gap:0.4rem;}' +
      '.ag-passkey[hidden]{display:none;}' +
      '.ag-passkey svg{width:15px;height:15px;stroke:currentColor;fill:none;}' +
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
      /* DE COMPOSITIE. Dit scherm had vijf objecten die allemaal ongeveer even
         belangrijk waren -- klok, lippen, zin, invoerveld, koekjesmelding --
         met grote lege vlakken ertussen die niets deden. Leegte in een premium
         ontwerp is bewust; dit was leegte omdat de inhoud niet wist waar hij
         moest staan.
         Nu is het EEN verticale kolom met een duidelijke rangorde: de klok is
         de identiteit en de held, Rahul komt er direct onder uit, en daaronder
         staat de actie. Alles daaronder is bijzaak. */
      '#gate{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
        'gap:0;padding:6vh 1.1rem;}' +
      /* de klok groeit: hij is letterlijk het merk, en stond op een zesde van
         de hoogte alsof hij een illustratie was */
      '#gate .os-lock{margin:0;}' +
      /* SCHALEN MET TRANSFORM, niet met width/height. De klok tekent zijn
         wijzers, het merkje en de datumvensters op VASTE posities binnen zijn
         eigen maat; zet je die maat om, dan verschuift het draaipunt en staat
         alles scheef -- precies wat er gebeurde toen ik hem groter maakte.
         transform schaalt het hele beeld uniform, dus de geometrie blijft heel. */
      /* Schaal 1 op een telefoon: daar is de klok al bijna schermbreed en
         duwt elke vergroting het invoerveld uit beeld -- de actie hoort altijd
         zichtbaar te blijven. Op een breed scherm is er wel ruimte. */
      '#gate .os-lock{transform:scale(var(--klokschaal,1));transform-origin:center;margin:0;}' +
      /* de lippen sluiten AAN op de klok: Rahul komt eruit, hij zweeft er niet
         tientallen pixels onder */
      '#gate .ag-mond{margin:-0.6rem auto 0.2rem;width:min(52vw,240px);height:auto;}' +
      // de zin is de aanspreking en geen onderschrift
      '#gate .ag-zin{font-size:clamp(1.35rem,5.2vw,1.9rem);line-height:1.3;' +
        'min-height:0;padding:0.5rem 0 1.1rem;max-width:22ch;}' +
      // het invoerveld is de actie: breed en royaal, geen streepje
      /* EEN rand, niet twee. De rij had al een border-bottom uit de basisstijl;
         daar een volledige rand overheen leggen gaf een dubbele doos met een
         verspringende binnenrand. Eerst de oude weg, dan de nieuwe. */
      '#gate .ag-rij{width:min(100%,30rem);min-height:58px;border:0;' +
        'box-shadow:inset 0 0 0 1px var(--line);border-radius:14px;' +
        'margin:0;padding:0 0.5rem 0 0.9rem;}' +
      '#gate .ag-rij:focus-within{box-shadow:inset 0 0 0 1px var(--burgundy);}' +
      '#gate .ag-rij input{font-size:1rem;padding:1rem 0.4rem;text-align:left;}' +
      /* de koekjesmelding hoort niet MIDDEN in de kennismaking. Hij zweeft
         onderaan, buiten de kolom, waar hij de compositie niet meer breekt. */
      '#gate ~ .rtgcookie,.rtgcookie{position:fixed;left:50%;transform:translateX(-50%);' +
        'bottom:1rem;z-index:60;max-width:min(92vw,26rem);}' +
      '@media (min-width:900px){' +
        '#gate .os-lock{--klokschaal:1.5;}' +
        '#gate{position:fixed;inset:0;width:100vw;max-width:none;height:100vh;' +
          'margin:0;border-radius:0;border:0;display:flex;align-items:center;' +
          'justify-content:center;flex-direction:column;}' +
        '#gate canvas:not(.ag-mond){position:absolute;inset:0;width:100vw;height:100vh;}' +
        '#gate .ag-doos{max-width:34rem;}' +
      '}';
    document.head.appendChild(st);

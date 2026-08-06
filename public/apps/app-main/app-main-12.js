    list.innerHTML = R.notifications.length
      ? R.notifications.map(x =>
          '<div class="notif-item' + (x.read ? '' : ' unread') + '">' +
            '<div class="ic">' + (window.RTGGlyf && RTGGlyf.heeft(x.icon) ? RTGGlyf.svgHTML(x.icon, { klasse: 'gl-inline' }) : (x.icon || '•')) + '</div>' +
            '<div class="tx"><b>' + x.title + '</b><span>' + x.body + '</span><time>' + timeAgo(x.at) + '</time></div>' +
          '</div>').join('')
      : '<div class="notif-empty">'+T('app.nonotif','Nog geen meldingen. Zodra iemand op uw post reageert of u een bericht stuurt, ziet u het hier.')+'</div>';
    const pb = $('#notifPush');
    const st = R.pushState();
    if (st === 'on'){ pb.textContent = '✓ '+T('app.pushon','Push aan'); pb.classList.add('on'); }
    else if (st === 'unsupported'){ pb.style.display = 'none'; }
    else { pb.textContent = T('app.pushenable','Push aanzetten'); pb.classList.remove('on'); }
  }

  function openNotif(open){
    $('#notifPanel').classList.toggle('open', open);
    $('#notifScrim').classList.toggle('open', open);
    if (open && window.RTGRealtime && RTGRealtime.unread() > 0){
      RTGRealtime.markRead();
      renderBell();
    }
  }
  $('#bell').addEventListener('click', () => openNotif(true));
  $('#notifScrim').addEventListener('click', () => openNotif(false));
  $('#notifPush').addEventListener('click', async () => {
    if (!window.RTGRealtime) return;
    const r = await RTGRealtime.enablePush();
    toast(r === 'on' ? T('app.pushtoast.on','Push-notificaties staan aan.') : r === 'denied' ? T('app.pushtoast.denied','Toestemming geweigerd, zet meldingen aan in uw instellingen.') : T('app.pushtoast.no','Push is hier niet beschikbaar.'));
    renderBell();
  });

  document.querySelectorAll('.tabbar button').forEach(b =>
    b.addEventListener('click', () => openTab(b.dataset.tab, true)));
  // de codenaam in de statusbalk is de korte weg naar je pas: die ligt sinds
  // het OS-beginscherm in je wallet, niet meer op de home
  $('#codeChip').addEventListener('click', () => { location.href = '/apps/wallet.html'; });

  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
    /* Onthouden waar je bent: op een telefoon wordt de app voortdurend door
       het systeem gedood en herstart (iOS doet dat al na een paar minuten
       achtergrond), en elke herstart betekende terug-naar-home -- midden in
       de Salon of een bestelling. Dat voelt als een app die je plek kwijt-
       raakt. renderAll() leest dit terug en zet je waar je was. */
    try { localStorage.setItem('rtg_actieve_tab', JSON.stringify({ tab, t: Date.now() })); } catch(e){}
    $('#content').scrollTop = 0;
    // Alleen bij een echte klik de focus naar de nieuwe weergave verplaatsen, zodat
    // toetsenbord- en schermlezergebruikers meelopen (niet bij programmatische wissels).
    if (focusView){
      const v = document.querySelector('.view[data-view="'+tab+'"]');
      if (v){ v.setAttribute('tabindex','-1'); v.focus({ preventScroll: true }); }
    }
  }

  /* EEN KAPOTTE KAART MAG NIET HET HELE SCHERM MEENEMEN.

     renderAll() riep twintig opbouwfuncties na elkaar aan, zonder vangnet.
     Struikelde de eerste, dan stierf de rest mee en bleef er van het
     beginscherm niets over dan wat er vast in de HTML staat -- de balk van
     Rahul. Dat is precies het beeld dat gemeld werd: "ik zie alleen de AI-balk".
     Een zwart scherm is bovendien de slechtste foutmelding die er is: hij zegt
     niet wat er stuk is, en niet dat de rest het nog zou doen.

     stap() draait elk onderdeel apart. Gaat er een mis, dan gaat de rest
     gewoon door en zegt de console WELKE het was. Dat is geen doekje voor het
     bloeden: een lid dat zijn tegels, klok en wallet ziet terwijl een van de
     twintig kaarten ontbreekt, heeft een werkende app -- en wij een spoor. */
  /* WAT ER MISGING, OP HET SCHERM ZELF.

     Een gebruiker met een half leeg beginscherm hoort niet de console te
     hoeven openen om te weten wat er speelt -- en wij horen niet te moeten
     raden. Deze regel verschijnt alleen als er echt iets omviel: een rustige
     mededeling onderaan met de naam van het onderdeel, en verder niets. Geen
     stacktrace, geen alarm; wie het niet interesseert leest er gewoon
     overheen, en wie het meldt kan het letterlijk overtypen. */
  let leegGemeld = false;
  function meldLeegScherm(wat) {
    if (leegGemeld) return;
    leegGemeld = true;
    try {
      const el = document.createElement('div');
      el.id = 'rtgOnderdeelStuk';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:9970;' +
        'bottom:calc(env(safe-area-inset-bottom,0px) + 8.5rem);width:min(26rem,calc(100vw - 2rem));' +
        'background:var(--card,#151312);border:1px solid var(--line,#2A2724);border-radius:12px;' +
        'padding:.7rem .9rem;color:var(--muted,#8A8680);font-family:Inter,system-ui,sans-serif;' +
        'font-size:.76rem;line-height:1.5;text-align:center;';
      el.textContent = 'Een onderdeel van dit scherm laadde niet: ' + wat + '. De rest werkt gewoon.';
      document.body.appendChild(el);
    } catch (e) { /* zelfs de melding mag niets breken */ }
  }
  // de tegelbouw (app-main-26b.js) meldt hier ook, dus hij moet daar bereikbaar zijn
  window.RTGMeldStuk = meldLeegScherm;

  function stap(naam, fn) {
    try { fn(); } catch (e) {
      console.error('[rtg] onderdeel "' + naam + '" van het beginscherm ging mis:', e);
      meldLeegScherm(naam);
    }
  }

  function renderAll(){
    /* Ook deze aanloop liep zonder vangnet, en juist hier staan de regels die
       aannemen dat een element bestaat. Viel er een om, dan kwam de rest van
       renderAll niet eens op gang en hielp het afschermen van de stappen
       hieronder niets. */
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    stap('scherm-aanloop', () => {
    $('#codeChipTxt').textContent = user.codename;
    ['reizen','betalen','ai','assets','zorg'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    // het OS-beginscherm leest dit: zonder pas geen wallet-tegel en geen balk
    // van Rahul, want allebei zijn ze voor leden
    document.getElementById('app').classList.toggle('os-gast', guest);
    });
    stap('renderHome', renderHome);
    // Rahul opent het gesprek op het beginscherm zelf, met wat hij nu ziet
    stap('rahul-thuis', () => { if (!guest && window.RTGThuisRahul) RTGThuisRahul.opent(); });
    if (!guest){
      stap('renderTrip', renderTrip); stap('renderPay', renderPay); stap('renderAI', renderAI);
      stap('renderAssets', renderAssets); stap('renderFluister', renderFluister);
    }
    stap('renderSalon', renderSalon);
    stap('renderTerPlaatse', renderTerPlaatse);
    stap('laadBestellen', laadBestellen);
    stap('laadBoodschappen', laadBoodschappen);
    stap('laadShowroom', laadShowroom);
    stap('laadTickets', laadTickets);
    stap('laadVerhuur', laadVerhuur);
    stap('laadCharter', laadCharter);
    stap('laadContracten', laadContracten);
    stap('laadVastgoed', laadVastgoed);
    if (!guest) laadCare();
    stap('loadCv', loadCv);
    stap('loadVacatures', loadVacatures);
    stap('laadOntmoet', laadOntmoet);
    /* Terug waar je was, maar KORT. Dit venster stond op een half uur, en dat
       was te ver doorgeschoten: openTab schrijft de tijd bij elke schermwissel
       bij, dus het venster schoof steeds mee en in gewoon gebruik landde je
       vrijwel altijd weer in de app waar je was. Het beginscherm -- de tegels,
       de klok, het gezicht van het huis -- kreeg je dan nooit meer te zien.

       Waar dit voor bedoeld is, is de app die ONDER je vandaan wordt gedood:
       iOS ruimt een app in de achtergrond op, of je herlaadt per ongeluk, en
       dan hoor je niet je plek kwijt te raken. Dat gebeurt binnen seconden,
       niet binnen een half uur. Twee minuten dekt dat ruim, en alles wat
       later komt is een NIEUWE keer openen -- en die begint thuis. */
    const PLEK_VENSTER = 2 * 60000;
    let beginTab = 'home';
    try {
      const b = JSON.parse(localStorage.getItem('rtg_actieve_tab') || 'null');
      if (b && b.tab && Date.now() - (b.t || 0) < PLEK_VENSTER){
        const knop = document.querySelector('.tabbar button[data-tab="' + b.tab + '"]');
        if (knop && knop.style.display !== 'none') beginTab = b.tab;
      }
    } catch(e){}
    openTab(beginTab);

    /* KIJKT DE APP OF ER IETS TE ZIEN IS. Een zwart scherm meldt zichzelf niet:
       er gooit niets, alle verzoeken slagen, en toch staat er niets. Daarom
       meten we het na het opbouwen gewoon na. Is het beginscherm leeg, dan
       gaan de MATEN naar het logboek (venster, hoogtes, aantal tegels, de
       rekeneenheid) -- genoeg om een layoutstoring te plaatsen zonder dat
       iemand een console hoeft te openen. Staat er wel wat, dan gebeurt er
       niets en weet niemand hiervan. */
    setTimeout(() => {
      try {
        const thuis = document.querySelector('.os-thuisscherm');
        const tegels = document.querySelectorAll('.os-app').length;
        const hoog = thuis ? thuis.getBoundingClientRect().height : 0;
        if ((!tegels || hoog < 40) && window.RTGFoutmelder && RTGFoutmelder.meetLeeg) {
          RTGFoutmelder.meetLeeg(tegels ? 'thuisscherm zonder hoogte' : 'geen tegels');
        }
      } catch (e) { /* een controle mag nooit de oorzaak van iets worden */ }
    }, 2500);
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }

  /* ---------- tickets: activiteiten, tours en musea ---------- */
  let tkPartners = [], tkOpen = null, tkKeuze = null;

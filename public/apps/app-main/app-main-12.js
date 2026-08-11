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
  $('#codeChip').addEventListener('click', () => { location.href = '/apps/geld.html#wallet'; });

  /* EEN TABBLAD HAALT ZIJN GEGEVENS OP ALS JE HEM OPENT, NIET EERDER.

     Gemeten, niet gegokt: een keer de app openen kostte 66 API-verzoeken. De
     rem op de deur (server/middleware/remmen.js) laat er 300 per minuut door,
     dus wie de app drie keer achter elkaar opende kreeg "te veel verzoeken"
     terug van zijn eigen app. Dat is precies wat er gemeld werd, en het is
     onze fout: drie keer openen is doodgewoon gedrag.

     Waar die 66 vandaan kwamen: renderAll() vulde alle vijftien tabbladen bij
     het opstarten. Een eerdere ingreep zette dat na het eerste beeld en met
     adempauzes ertussen (naBeeld in ./app-main-12a.js). Dat hielp voor hoe snel
     het VOELT, maar het aantal verzoeken bleef gelijk: uitstellen is niet
     hetzelfde als niet doen. De oorzaak is dat we gegevens ophalen voor
     schermen die op dat moment niemand ziet.

     De indeling hieronder is afgeleid en niet bedacht: per lader is opgezocht
     welke element-ids hij vult, en in welke .view die in apps/app.html staan.
     Drie laders (laadCare, laadBestellen, loadCv) schrijven nergens zo'n id;
     die blijven bij het openen laden, want stil iets NIET tonen is erger dan
     een verzoek te veel. Na de eerste keer blijft een tabblad gevuld, en de
     live-verbinding (syncScope) houdt bij wat er verandert. */
  const LADERS_PER_TAB = {
    reizen:     [['renderTrip', () => renderTrip()], ['laadShowroom', () => laadShowroom()]],
    betalen:    [['renderPay', () => renderPay()]],
    ai:         [['renderAI', () => renderAI()], ['renderFluister', () => renderFluister()]],
    assets:     [['renderAssets', () => renderAssets()]],
    salon:      [['renderSalon', () => renderSalon()], ['loadVacatures', () => loadVacatures()],
                 ['laadOntmoet', () => laadOntmoet()]],
    bestellen:  [['laadBoodschappen', () => laadBoodschappen()]],
    terplaatse: [['renderTerPlaatse', () => renderTerPlaatse()], ['laadTickets', () => laadTickets()],
                 ['laadVerhuur', () => laadVerhuur()], ['laadCharter', () => laadCharter()],
                 ['laadContracten', () => laadContracten()], ['laadVastgoed', () => laadVastgoed()]]
  };
  const gevuldeTabs = {};

  /* Vullen loopt via stap() uit ./app-main-12a.js, om dezelfde reden als daar:
     valt er een lader om, dan staat de rest van het tabblad er gewoon en zegt
     de console welke het was. */
  function vulTab(tab){
    const lijst = LADERS_PER_TAB[tab];
    if (!lijst || gevuldeTabs[tab]) return;
    gevuldeTabs[tab] = true;
    // een gratis gebruiker heeft geen reizen, betalen, AI, assets of zorg: die
    // tabbladen staan voor hem verborgen, dus halen we er ook niets voor op
    if (user.tier === 'guest' && ['reizen','betalen','ai','assets','zorg'].includes(tab)) return;
    for (const [naam, fn] of lijst) stap(naam, fn);
  }

  /* De pin-herstellink uit de mail (?pinherstel=...) wordt opgevangen door
     /shared/pinherstel.js. Dat staat apart en niet hier, omdat dit deel daarmee
     over de 10 KB ging -- en omdat het een op zichzelf staand schermpje is dat
     niets van de app-schil nodig heeft. */
  function pinHerstelUitAdres(){ if (window.RTGPinHerstel) RTGPinHerstel.opvangen(API, T); }

  function openTab(tab, focusView){
    vulTab(tab);   // nu pas de gegevens van dit tabblad, en alleen de eerste keer
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

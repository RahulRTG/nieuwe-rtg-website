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

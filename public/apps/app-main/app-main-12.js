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

  function renderAll(){
    $('#codeChipTxt').textContent = user.codename;
    // gratis gebruiker (zonder pas): reizen, betalen en AI zijn voor leden
    const guest = user.tier === 'guest';
    ['reizen','betalen','ai','assets','zorg'].forEach(t => { const b = document.querySelector('.tabbar button[data-tab="'+t+'"]'); if (b) b.style.display = guest ? 'none' : ''; });
    // het OS-beginscherm leest dit: zonder pas geen wallet-tegel en geen balk
    // van Rahul, want allebei zijn ze voor leden
    document.getElementById('app').classList.toggle('os-gast', guest);
    renderHome();
    // Rahul opent het gesprek op het beginscherm zelf, met wat hij nu ziet
    if (!guest && window.RTGThuisRahul) RTGThuisRahul.opent();
    if (!guest){ renderTrip(); renderPay(); renderAI(); renderAssets(); renderFluister(); }
    renderSalon();
    renderTerPlaatse();
    laadBestellen();
    laadBoodschappen();
    laadShowroom();
    laadTickets();
    laadVerhuur();
    laadCharter();
    laadContracten();
    laadVastgoed();
    if (!guest) laadCare();
    loadCv();
    loadVacatures();
    laadOntmoet();
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
    if ((rtf.gekoppeld || []).length) ensurePush(false); // stil vernieuwen als het al aan staat
  }

  /* ---------- tickets: activiteiten, tours en musea ---------- */
  let tkPartners = [], tkOpen = null, tkKeuze = null;
  async function laadTickets(){
    if (!API.live) return;
    try { tkPartners = (await API.call('/tickets/aanbod')).partners || []; } catch(e){ tkPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/tickets/mijn')).tickets || []; } catch(e){}
    const mijnEl = $('#tkMijn');
    if (mijnEl) mijnEl.innerHTML = mijn.filter(t => !t.gebruikt || t.datum >= new Date().toISOString().slice(0, 10)).map(t =>
      '<div class="card" style="border-color:rgba(208,172,87,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">\uD83C\uDF9F\uFE0F '+T('tk.ticket','Ticket')+' \u00B7 '+esc(t.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(t.naam)+'</b> \u00B7 '+t.datum+' '+t.tijd+' \u00B7 '+t.personen+'p</div>'+
      (t.gebruikt
        ? '<div style="margin-top:0.4rem;font-size:0.8rem;color:var(--green);">\u2705 '+T('tk.gebruikt','Binnen; ingecheckt door ')+esc(t.checkin.door)+'</div>'
        : '<div style="margin-top:0.5rem;text-align:center;background:rgba(208,172,87,0.12);border:1px dashed rgba(208,172,87,0.5);border-radius:12px;padding:0.55rem;">'+
          '<span style="font-size:1.3rem;letter-spacing:0.35em;color:var(--gold);font-weight:700;">'+esc(t.code)+'</span>'+
          '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.2rem;">'+T('tk.laatzien','Laat deze code zien aan de deur')+'</div></div>')+
      // de eigen transferdienst van de zaak: aanvragen, of live zien wie er komt
      (t.transfer
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--muted);">\uD83D\uDE90 '+T('tk.tr','Transfer')+': <b style="color:var(--txt);">'+
          ({ 'wacht-op-betaling': T('tk.tr.betalen','nog betalen'), 'aangevraagd': T('tk.tr.aangevraagd','aangevraagd'), 'geaccepteerd': T('tk.tr.geacc','bevestigd'), 'onderweg': T('tk.tr.onderweg','onderweg naar u') }[t.transfer.status] || t.transfer.status)+'</b>'+
          (t.transfer.chauffeur ? ' \u00B7 '+esc(t.transfer.chauffeur) : '')+(t.transfer.etaMin ? ' \u00B7 \u23F1 '+t.transfer.etaMin+' min' : '')+
          (t.transfer.prijs ? ' \u00B7 '+eur(t.transfer.prijs) : ' \u00B7 '+T('tk.tr.incl','inclusief'))+'</div>'
        : (t.transferAan && !t.gebruikt
          ? '<div style="margin-top:0.55rem;display:flex;gap:0.4rem;">'+
            '<input id="trVan-'+t.ref+'" placeholder="'+T('tk.tr.vanph','Ophaaladres')+'" style="flex:1;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;">'+
            '<button class="bz-btn" data-trvraag="'+t.ref+'" data-trprijs="'+t.transferPrijs+'">\uD83D\uDE90 '+(t.transferPrijs ? eur(t.transferPrijs) : T('tk.tr.gratis','Gratis'))+'</button></div>'
          : ''))+
      '</div>').join('');
    document.querySelectorAll('[data-trvraag]').forEach(b => b.addEventListener('click', async () => {
      const veld = document.getElementById('trVan-' + b.dataset.trvraag);
      try {
        const r = await API.call('/transfer/aanvraag', { ticketRef: b.dataset.trvraag, van: veld ? veld.value : '' });
        if (Number(b.dataset.trprijs) > 0) await API.call('/ride/pay', { ref: r.ride.ref });
        toast(T('tk.tr.ok','Transfer aangevraagd. U ziet hier wie u komt halen.'));
        laadTickets();
      } catch(e){ toast(e.message); }
    }));
    renderTkAanbod();
  }
  function renderTkAanbod(){
    const el = $('#tkAanbod'); if (!el) return;
    if (!tkPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('tk.kop','Activiteiten, tours en musea')+'</div>';

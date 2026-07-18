  /* ---------- live updates ---------- */

  // een scherm werkt zichzelf bij zonder page-refresh
  async function syncScope(scope){
    if (!API.live) return;
    try {
      const data = await API.call('/state');
      applyState(data.state);
    } catch (e) { return; }
    if (scope === 'payments'){ renderPay(); renderHome(); renderTrip(); }
    else if (scope === 'salon'){ renderSalon(); renderHome(); }
    else if (scope === 'orders'){ renderTerPlaatse(); if (user.tier === 'guest') loadGuestHistory(); }
        else if (scope === 'gchat'){ if (pchat) loadPChat(); }
    else if (scope === 'apply'){ renderCvCard(); if (apChatId) laadApplyChat(); }
    else if (scope === 'chat'){ if (user.account) renderChat(); }
    else if (scope === 'tickets'){ laadTickets(); }
    else if (scope === 'huur'){ laadVerhuur(); }
    else if (scope === 'charter'){ laadCharter(); }
    else if (scope === 'groothandel'){ laadBoodschappen(); }
    else if (scope === 'verkoop'){ laadShowroom(); }
    else if (scope === 'contract'){ laadContracten(); }
    else if (scope === 'vastgoed'){ laadVastgoed(); }
    else if (scope === 'care'){ laadCare(); }
    else if (scope === 'live'){ renderLive(); laadTickets(); }
    else if (scope === 'paspoort'){ laadPaspoortInbox(); }
    else if (scope === 'ontmoeting'){ laadOntmoet(); }
    else { renderPay(); renderHome(); renderTrip(); renderSalon(); renderTerPlaatse(); if (user.account) renderChat(); laadPaspoortInbox(); laadOntmoet(); }
  }

  function timeAgo(iso){
    const s = Math.max(1, Math.round((Date.now() - new Date(iso)) / 1000));
    if (s < 60) return T('t.now','zojuist');
    const ago = T('t.ago',' geleden');
    const m = Math.round(s / 60);
    if (m < 60) return m + T('t.min',' min') + ago;
    const h = Math.round(m / 60);
    if (h < 24) return h + T('t.hour',' uur') + ago;
    return Math.round(h / 24) + T('t.days',' dag(en)') + ago;
  }

  function renderBell(){
    const R = window.RTGRealtime;
    if (!R) return;
    const n = R.unread();
    const badge = $('#bellBadge');
    badge.style.display = n > 0 ? 'flex' : 'none';
    badge.textContent = n > 9 ? '9+' : n;
    const list = $('#notifList');
    list.innerHTML = R.notifications.length
      ? R.notifications.map(x =>
          '<div class="notif-item' + (x.read ? '' : ' unread') + '">' +
            '<div class="ic">' + (x.icon || '•') + '</div>' +
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
  $('#codeChip').addEventListener('click', () => { openTab('home'); toggleWhy(true); });

  function openTab(tab, focusView){
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === tab));
    document.querySelectorAll('.tabbar button').forEach(b => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('active', on);
      if (on) b.setAttribute('aria-current','page'); else b.removeAttribute('aria-current'); // schermlezer meldt de actieve tab
    });
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
    renderHome();
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
    openTab('home');
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

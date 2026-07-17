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
    for (const p of tkPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.activiteiten){
        const open = tkOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(a.name)+'</div>'+
          (a.desc?'<div class="soft-sm">'+esc(a.desc)+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div>':'')+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.prijs)+' p.p.</span></div>';
        if (open){
          const k = tkKeuze;
          const dagen = [];
          for (let d = 0; d < 7; d++){ const dt = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); dagen.push(dt); }
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-tkd="'+d+'">'+(d===dagen[0]?T('tk.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(a.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-tkt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.55rem;">'+
            '<span style="font-size:0.78rem;color:var(--muted);">'+T('tk.personen','Personen')+'</span>'+
            '<button class="bz-btn" data-tkp="-1" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+k.personen+'</b><button class="bz-btn" data-tkp="1" style="padding:0.2rem 0.7rem;">+</button></div>'+
            '<button class="bz-groot" id="tkKoop" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('tk.koop','Koop tickets')+' \u00B7 '+eur(a.prijs * k.personen)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-tkopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('tk.kies','Kies datum en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-tkopen]').forEach(b => b.addEventListener('click', () => {
      tkOpen = b.dataset.tkopen;
      tkKeuze = { datum: new Date().toISOString().slice(0, 10), tijd: null, personen: 2 };
      renderTkAanbod();
    }));
    document.querySelectorAll('[data-tkd]').forEach(b => b.addEventListener('click', () => { tkKeuze.datum = b.dataset.tkd; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkt]').forEach(b => b.addEventListener('click', () => { tkKeuze.tijd = b.dataset.tkt; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkp]').forEach(b => b.addEventListener('click', () => {
      tkKeuze.personen = Math.min(10, Math.max(1, tkKeuze.personen + Number(b.dataset.tkp))); renderTkAanbod();
    }));
    const koop = document.getElementById('tkKoop');
    if (koop) koop.addEventListener('click', async () => {
      const [code, actId] = tkOpen.split(':');
      try {
        const t = await API.call('/ticket/koop', { supplierCode: code, activiteitId: actId, datum: tkKeuze.datum, tijd: tkKeuze.tijd, personen: tkKeuze.personen });
        await API.call('/booking/pay', { ref: t.ticket.ref });
        toast(T('tk.ok','Betaald! Uw entreecode: ') + t.ticket.code);
        tkOpen = null; tkKeuze = null;
        laadTickets();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 4: Zorg & welzijn (RTG Care) ----------
     Een eigen tab: mijn boekingen, mijn intake-delingen, herstelpakketten
     en het aanbod van spa's, wellness en klinieken. Boeken kiest een dag en
     tijdslot bij een behandelaar; betalen loopt via RTG Pay. Het zorgprofiel
     reist automatisch mee; medische context deelt het lid apart en per
     aanbieder, met een einddatum en altijd te stoppen. */
  let careOv = null, careOpen = null, careKeuze = null, careIntakeTekst = {};
  let carePak = [], carePakMijn = [], carePakOpen = null, carePakKeuze = null;
  const careSoort = { spa: 'Spa', wellness: 'Wellness', kliniek: 'Kliniek' };
  async function laadCare(){
    if (!API.live) return;
    try { careOv = await API.call('/care', {}); } catch(e){ careOv = null; }
    let mijn = [];
    try { mijn = (await API.call('/care/mijn', {})).boekingen || []; } catch(e){}
    try { carePak = (await API.call('/care/pakketten', {})).pakketten || []; } catch(e){ carePak = []; }
    try { carePakMijn = (await API.call('/care/pakket/mijn', {})).pakketten || []; } catch(e){ carePakMijn = []; }
    renderCareMijn(mijn);
    renderCareIntakes();
    renderCarePakketten();
    renderCareAanbod();
  }
  function renderCareMijn(mijn){
    const el = $('#careMijn'); if (!el) return;
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">'+T('care.mijn','Mijn afspraken')+'</div>'+
      mijn.map(b => '<div class="card" style="border-color:rgba(139,195,168,0.35);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green,#8bc3a8);">🌿 '+esc(b.aanbiederNaam)+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(b.behandelingNaam)+'</b>'+(b.behandelaarNaam?' · '+esc(b.behandelaarNaam):'')+'</div>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+b.datum+' · '+b.tijd+' · '+eur(b.prijs)+' · '+
          (b.paid ? '<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>' : '<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;">'+
          (b.paid ? '' : '<button class="bz-groot" data-care-pay="'+esc(b.ref)+'" style="flex:1;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
          '<button class="bz-btn" data-care-annul="'+esc(b.ref)+'">'+T('care.annuleer','Annuleer')+'</button>'+
        '</div></div>').join('');
    el.querySelectorAll('[data-care-pay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/betaal', { ref: x.dataset.carePay }); toast(T('care.paytoast','Betaald. Tot uw afspraak.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-care-annul]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/annuleer', { ref: x.dataset.careAnnul }); toast(T('care.annultoast','Afspraak geannuleerd.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareIntakes(){
    const el = $('#careIntakes'); if (!el) return;
    const list = (careOv && careOv.intakes) || [];
    if (!list.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card" style="border-color:rgba(208,172,87,0.3);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">🩺 '+T('care.intakes','Gedeelde medische context')+'</div>'+
      list.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;">'+
        '<div style="font-size:0.85rem;">'+esc(i.aanbiederNaam)+'<div class="soft-sm">'+T('care.tot','tot')+' '+i.vervaltOp+'</div></div>'+
        '<button class="bz-btn" data-care-intakestop="'+esc(i.id)+'">'+T('care.stopdelen','Stop delen')+'</button></div>').join('')+
      '</div>';
    el.querySelectorAll('[data-care-intakestop]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/intake/stop', { id: x.dataset.careIntakestop }); toast(T('care.stoptoast','Deling gestopt. Weg is weg.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareAanbod(){
    const el = $('#careAanbod'); if (!el) return;
    const aanb = (careOv && careOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.aanbod','Spa’s, wellness en klinieken')+'</div>';
    for (const a of aanb){
      const medisch = a.soort === 'kliniek' || (a.behandelingen || []).some(b => b.soort === 'medisch');
      html += '<div class="card"><div style="display:flex;gap:0.5rem;align-items:baseline;"><span style="font-size:1.1rem;">'+esc(a.icon||'🌿')+'</span>'+
        '<div style="flex:1;"><b>'+esc(a.naam)+'</b> <span class="soft-sm">· '+esc(careSoort[a.soort]||a.soort)+(a.waar?' · '+esc(a.waar):'')+'</span>'+
        (a.beschrijving?'<div class="soft-sm" style="margin-top:0.15rem;">'+esc(a.beschrijving)+'</div>':'')+
        ((a.behandelaars||[]).length?'<div class="soft-sm" style="margin-top:0.2rem;">👤 '+a.behandelaars.map(b => esc(b.naam)+(b.functie?' ('+esc(b.functie)+')':'')).join(' · ')+'</div>':'')+'</div></div>';
      // intake-deling voor klinieken/medische zorg: uitdrukkelijk en per aanbieder
      if (medisch){
        const actief = !!a.intakeActief;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">🩺 '+(actief
            ? T('care.intakeaan','U deelt medische context met deze kliniek. U kunt dit bij Mijn afspraken stoppen.')
            : T('care.intakeuit','Wilt u dat de behandelaar iets weet (medicijnen, allergie, aandoening)? Deel het apart en alleen met deze kliniek.'))+'</div>'+
          (actief ? '' :
            '<textarea data-care-intaketxt="'+esc(a.id)+'" rows="2" placeholder="'+T('care.intakeph','Bijv. ik gebruik bloedverdunners en ben allergisch voor penicilline')+'" style="width:100%;box-sizing:border-box;background:var(--card2,var(--card));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;font-size:0.8rem;color:var(--txt);outline:none;resize:vertical;">'+esc(careIntakeTekst[a.id]||'')+'</textarea>'+
            '<button class="bz-btn" data-care-intakedeel="'+esc(a.id)+'" style="margin-top:0.4rem;">'+T('care.intakedeel','Deel met deze kliniek')+'</button>')+
          '</div>';
      }
      for (const b of (a.behandelingen || [])){
        const open = careOpen === a.id + ':' + b.id;
        const behlr = (a.behandelaars || []).find(x => x.id === b.behandelaarId);
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(b.naam)+
            ' <span style="font-size:0.6rem;text-transform:uppercase;letter-spacing:0.08em;color:'+(b.soort==='medisch'?'var(--gold)':'var(--green,#8bc3a8)')+';">'+(b.soort==='medisch'?T('care.med','medisch'):T('care.well','wellness'))+'</span></div>'+
            '<div class="soft-sm">'+b.duurMin+' '+T('care.min','min')+(behlr?' · '+esc(behlr.naam):'')+'</div></div>'+
            '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.prijs)+'</span></div>';
        if (open){
          const k = careKeuze;
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-cared="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(b.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-caret="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<button class="bz-groot" id="careBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.boek','Boek en betaal')+' · '+eur(b.prijs)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-careopen="'+a.id+':'+b.id+'" style="margin-top:0.45rem;">'+T('care.kies','Kies dag en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-care-intaketxt]').forEach(t => t.addEventListener('input', () => { careIntakeTekst[t.dataset.careIntaketxt] = t.value; }));
    el.querySelectorAll('[data-care-intakedeel]').forEach(x => x.addEventListener('click', async () => {
      const id = x.dataset.careIntakedeel;
      try { await API.call('/care/intake/deel', { aanbiederId: id, medisch: careIntakeTekst[id] || '' }); careIntakeTekst[id] = ''; toast(T('care.deeltoast','Gedeeld. Alleen deze kliniek ziet het, tot u stopt.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-careopen]').forEach(x => x.addEventListener('click', () => {
      careOpen = x.dataset.careopen; careKeuze = { datum: dagen[0], tijd: null }; renderCareAanbod();
    }));
    el.querySelectorAll('[data-cared]').forEach(x => x.addEventListener('click', () => { careKeuze.datum = x.dataset.cared; renderCareAanbod(); }));
    el.querySelectorAll('[data-caret]').forEach(x => x.addEventListener('click', () => { careKeuze.tijd = x.dataset.caret; renderCareAanbod(); }));
    const boek = document.getElementById('careBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [aanbiederId, behandelingId] = careOpen.split(':');
      try {
        const r = await API.call('/care/boek', { aanbiederId, behandelingId, datum: careKeuze.datum, tijd: careKeuze.tijd });
        await API.call('/care/betaal', { ref: r.boeking.ref });
        toast(T('care.oktoast','Geboekt en betaald. Tot uw afspraak.'));
        careOpen = null; careKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }
  function renderCarePakketten(){
    const el = $('#carePakketten'); if (!el) return;
    if (!carePak.length && !carePakMijn.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.pakketten','Herstel- & verblijfpakketten')+'</div>';
    // mijn geboekte pakketten
    for (const b of carePakMijn){
      html += '<div class="card" style="border-color:rgba(194,58,94,0.3);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);">🌸 '+T('care.pakket','Pakket')+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.92rem;"><b>'+esc(b.naam)+'</b></div>'+
        '<div class="soft-sm">'+b.nachten+' '+T('care.nachten','nachten')+' · '+esc(b.hotelNaam)+' · '+b.datum+' '+b.tijd+' · '+eur(b.prijs)+
          ' · '+(b.paid?'<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>':'<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        (b.paid?'':'<button class="bz-groot" data-carepakpay="'+esc(b.ref)+'" style="margin-top:0.5rem;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
        '</div>';
    }
    // aanbod
    for (const p of carePak){
      const open = carePakOpen === p.id;
      html += '<div class="card"><div style="display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<div style="flex:1;"><b>'+esc(p.naam)+'</b>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+esc(p.beschrijving)+'</div>'+
        '<div class="soft-sm" style="margin-top:0.25rem;">🏨 '+esc(p.hotelNaam)+' · '+p.nachten+' '+T('care.nachten','nachten')+' + '+esc(p.behandelingNaam)+' ('+p.duurMin+' min)</div></div>'+
        '<div style="text-align:right;white-space:nowrap;"><div style="color:var(--gold);font-size:0.95rem;">'+eur(p.prijs)+'</div>'+
        (p.bespaar>0?'<div class="soft-sm" style="color:var(--green,#8bc3a8);">'+T('care.bespaar','bespaar')+' '+eur(p.bespaar)+'</div>':'')+'</div></div>';
      if (open){
        const k = carePakKeuze;
        html += '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div class="soft-sm" style="margin-bottom:0.35rem;">'+T('care.pakkies','Kies wanneer de behandeling valt:')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
            '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-carepakd="'+d+'">'+(d===dagen[0]?T('care.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
          '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(p.tijden||[]).map(t2 =>
            '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-carepakt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
          '<button class="bz-groot" id="carePakBoek" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('care.pakboek','Boek dit pakket')+' · '+eur(p.prijs)+'</button></div>';
      } else {
        html += '<button class="bz-btn" data-carepakopen="'+esc(p.id)+'" style="margin-top:0.5rem;">'+T('care.pakkies2','Kies dag en tijd')+'</button>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-carepakpay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/pakket/betaal', { ref: x.dataset.carepakpay }); toast(T('care.paktoast','Pakket betaald. Fijn verblijf.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-carepakopen]').forEach(x => x.addEventListener('click', () => {
      carePakOpen = x.dataset.carepakopen; carePakKeuze = { datum: dagen[0], tijd: null }; renderCarePakketten();
    }));
    el.querySelectorAll('[data-carepakd]').forEach(x => x.addEventListener('click', () => { carePakKeuze.datum = x.dataset.carepakd; renderCarePakketten(); }));
    el.querySelectorAll('[data-carepakt]').forEach(x => x.addEventListener('click', () => { carePakKeuze.tijd = x.dataset.carepakt; renderCarePakketten(); }));
    const pb = document.getElementById('carePakBoek');
    if (pb) pb.addEventListener('click', async () => {
      try {
        const r = await API.call('/care/pakket/boek', { pakketId: carePakOpen, datum: carePakKeuze.datum, tijd: carePakKeuze.tijd });
        await API.call('/care/pakket/betaal', { ref: r.pakket.ref });
        toast(T('care.paktoast','Pakket betaald. Fijn verblijf.'));
        carePakOpen = null; carePakKeuze = null;
        laadCare();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- autoverhuur: eerlijk huren ---------- */
  let vhPartners = [], vhOpen = null, vhKeuze = null, vhLocWatch = {};
  function vhFotoKlein(file, cb){
    const r = new FileReader();
    r.onload = () => { const img = new Image(); img.onload = () => {
      const c = document.createElement('canvas'); const sc = Math.min(1, 900 / Math.max(img.width, img.height));
      c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.7));
    }; img.src = r.result; };
    r.readAsDataURL(file);
  }
  async function laadVerhuur(){
    if (!API.live) return;
    try { vhPartners = (await API.call('/verhuur/aanbod')).partners || []; } catch(e){ vhPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/huur/mijn')).huren || []; } catch(e){}
    const el = $('#vhMijn');
    const VH_ST = { 'aangevraagd': T('vh.m.geboekt','geboekt; leg de staat vast bij het ophalen'), 'lopend': T('vh.m.lopend','onderweg; goede reis'), 'afgerond': T('vh.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(h => h.status !== 'afgerond' || h.tot >= new Date().toISOString().slice(0, 10)).map(h =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDE97 '+T('vh.m.kop','Huurauto')+' \u00B7 '+esc(h.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(h.auto)+'</b>'+(h.kenteken?' ('+esc(h.kenteken)+')':'')+' \u00B7 '+h.van+' \u2192 '+h.tot+' \u00B7 '+eur(h.prijs)+'</div>'+
      (h.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+esc(h.spec.categorie||'')+' \u00B7 '+(h.spec.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 \uD83D\uDC65'+(h.spec.stoelen||'-')+' \u00B7 '+(h.spec.kmPerDag?h.spec.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+(h.borg?' \u00B7 '+T('vh.borg','borg')+' '+eur(h.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(VH_ST[h.status]||h.status)+' \u00B7 \uD83D\uDCF7 '+T('vh.m.voor','voor')+' '+h.fotosVoor+' \u00B7 '+T('vh.m.na','na')+' '+h.fotosNa+(h.uitgifte?' \u00B7 '+h.uitgifte.kmStart+' km':'')+'</div>'+
      (h.inname ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(h.inname.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(h.inname.meerkosten>0 ? T('vh.m.meer','Meerkosten')+': '+eur(h.inname.meerkosten)+' ('+h.inname.gereden+' km)' : '\u2713 '+h.inname.gereden+' km \u00B7 '+T('vh.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (h.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (h.status === 'aangevraagd' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="voor">\uD83D\uDCF7 '+T('vh.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (h.status === 'lopend' ? '<button class="bz-btn" data-vhf="'+h.ref+'" data-fase="na">\uD83D\uDCF7 '+T('vh.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(h.locatieAan?' on':'')+'" data-vhloc="'+h.ref+'" data-aan="'+(h.locatieAan?'0':'1')+'">\uD83D\uDCCD '+(h.locatieAan?T('vh.m.locuit','Locatie delen uit'):T('vh.m.locaan','Deel live locatie'))+'</button>' : '')+
        '<button data-vhsos="'+h.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">\uD83C\uDD98 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderVhAanbod();
    koppelVhActies();
  }
  function koppelVhActies(){
    const file = (() => { let f = document.getElementById('vhLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'vhLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-vhf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/huur/foto', { ref: b.dataset.vhf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('vh.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadVerhuur(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-vhsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('vh.m.sosvraag','Wat is er aan de hand? (gaat direct naar de verhuurder EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/huur/sos', { ref: b.dataset.vhsos, bericht, lat, lng })
        .then(() => toast(T('vh.m.sosok','SOS verstuurd. De verhuurder en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-vhloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.vhloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          vhLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/huur/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/huur/locatie', { ref, aan: true });
        } else {
          if (vhLocWatch[ref] != null){ navigator.geolocation.clearWatch(vhLocWatch[ref]); delete vhLocWatch[ref]; }
          await API.call('/huur/locatie', { ref, aan: false });
        }
        toast(aan ? T('vh.m.locaanok','U deelt uw locatie met de verhuurder; uitzetten kan altijd.') : T('vh.m.locuitok','Locatie delen staat uit en is gewist.'));
        laadVerhuur();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderVhAanbod(){
    const el = $('#vhAanbod'); if (!el) return;
    if (!vhPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('vh.kop','Autoverhuur, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('vh.uitleg','Vaste prijs vooraf betaald. Staat vastgelegd met foto\'s voor en na. SOS-knop en RTG als scheidsrechter.')+'</div>';
    for (const p of vhPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.autos){
        const open = vhOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(a.icoon||'\uD83D\uDE97')+' '+esc(a.name)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.dagprijs)+'/'+T('vh.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(a.categorie||'')+' \u00B7 '+(a.transmissie==='automaat'?T('vh.aut','automaat'):T('vh.hand','handgesch.'))+' \u00B7 '+esc(a.brandstof||'')+' \u00B7 \uD83D\uDC65'+(a.stoelen||'-')+' \u00B7 \uD83E\uDDF3'+(a.bagage||0)+(a.airco?' \u00B7 \u2744\uFE0F':'')+
          ' \u00B7 '+(a.kmPerDag?a.kmPerDag+' km/'+T('vh.dag','dag'):T('vh.onbeperkt','onbeperkt km'))+' \u00B7 '+T('vh.borg','borg')+' '+eur(a.borg||0)+'</div>';
        if (open){
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.van','Ophalen')+'</label><input type="date" id="vhVan" value="'+vhKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('vh.tot','Inleveren')+'</label><input type="date" id="vhTot" value="'+vhKeuze.tot+'"></div></div>'+
            '<button class="bz-groot" id="vhBoek" style="margin-top:0.7rem;">'+T('vh.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-vhopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('vh.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vhopen]').forEach(b => b.addEventListener('click', () => {
      vhOpen = b.dataset.vhopen;
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const overmorgen = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
      vhKeuze = { van: morgen, tot: overmorgen };
      renderVhAanbod(); koppelVhActies();
    }));
    const boek = document.getElementById('vhBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, autoId] = vhOpen.split(':');
      try {
        const h = await API.call('/huur/boek', { supplierCode: code, autoId, van: $('#vhVan').value, tot: $('#vhTot').value });
        await API.call('/booking/pay', { ref: h.huur.ref });
        toast(T('vh.ok','Geboekt en betaald: ') + eur(h.huur.price) + T('vh.ok2',' vast, geen verrassingen aan de balie.'));
        vhOpen = null; vhKeuze = null;
        laadVerhuur();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- charter: boten en jachten huren ---------- */
  let chPartners = [], chOpen = null, chKeuze = null, chLocWatch = {};
  async function laadCharter(){
    if (!API.live) return;
    try { chPartners = (await API.call('/charter/aanbod')).partners || []; } catch(e){ chPartners = []; }
    let mijn = [];
    try { mijn = (await API.call('/charter/mijn')).charters || []; } catch(e){}
    const el = $('#chMijn');
    const CH_ST = { 'aangevraagd': T('ch.m.geboekt','geboekt; leg de staat vast bij het uitvaren'), 'lopend': T('ch.m.lopend','op zee; behouden vaart'), 'afgerond': T('ch.m.af','afgerond') };
    if (el) el.innerHTML = mijn.filter(c => c.status !== 'afgerond' || c.tot >= new Date().toISOString().slice(0, 10)).map(c =>
      '<div class="card" style="border-color:rgba(91,185,140,0.35);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">⛵ '+T('ch.m.kop','Charter')+' · '+esc(c.supplierName)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.boot)+'</b> ('+esc(c.type)+') · '+c.van+' → '+c.tot+' · '+eur(c.prijs)+'</div>'+
      (c.spec ? '<div style="margin-top:0.25rem;font-size:0.72rem;color:var(--soft);">'+(c.spec.lengte||0)+'m · 👥'+(c.spec.gasten||'-')+(c.spec.hutten?' · 🛏️'+c.spec.hutten:'')+' · '+(c.spec.snelheidKn||0)+' kn · '+esc(c.spec.ligplaats||'')+(c.borg?' · '+T('ch.borg','borg')+' '+eur(c.borg):'')+'</div>' : '')+
      '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+(c.metSkipper?'⚓ '+T('ch.m.metskipper','met schipper')+(c.skipperNaam?' ('+esc(c.skipperNaam)+')':''):T('ch.m.bareboat','bareboat'))+' · '+(CH_ST[c.status]||c.status)+' · 📷 '+c.fotosVoor+'/'+c.fotosNa+'</div>'+
      (c.teruggave ? '<div style="margin-top:0.25rem;font-size:0.78rem;color:'+(c.teruggave.meerkosten>0?'var(--gold)':'var(--green)')+';">'+(c.teruggave.meerkosten>0 ? T('ch.m.meer','Meerkosten')+': '+eur(c.teruggave.meerkosten) : '✓ '+T('ch.m.geenmeer','geen meerkosten, borg vrij'))+'</div>' : '')+
      (c.status !== 'afgerond' ?
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.55rem;">'+
        (c.status === 'aangevraagd' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="voor">📷 '+T('ch.m.fotovoor','Staat vastleggen (voor)')+'</button>' : '')+
        (c.status === 'lopend' ? '<button class="bz-btn" data-chf="'+c.ref+'" data-fase="na">📷 '+T('ch.m.fotona','Staat vastleggen (na)')+'</button>'+
          '<button class="bz-btn'+(c.locatieAan?' on':'')+'" data-chloc="'+c.ref+'" data-aan="'+(c.locatieAan?'0':'1')+'">📍 '+(c.locatieAan?T('ch.m.locuit','Positie delen uit'):T('ch.m.locaan','Deel live positie'))+'</button>' : '')+
        '<button data-chsos="'+c.ref+'" style="background:var(--burgundy-deep);border:1px solid var(--burgundy);color:#fff;border-radius:999px;padding:0.5rem 1rem;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">🆘 SOS</button>'+
        '</div>' : '')+
      '</div>').join('');
    renderChAanbod();
    koppelChActies();
  }
  function koppelChActies(){
    const file = (() => { let f = document.getElementById('chLidFile');
      if (!f){ f = document.createElement('input'); f.type = 'file'; f.accept = 'image/*'; f.capture = 'environment'; f.id = 'chLidFile'; f.style.display = 'none'; document.body.appendChild(f); }
      return f; })();
    document.querySelectorAll('[data-chf]').forEach(b => b.addEventListener('click', () => {
      file.onchange = () => {
        if (!file.files[0]) return;
        vhFotoKlein(file.files[0], async (dataUrl) => {
          try { await API.call('/charter/foto', { ref: b.dataset.chf, fase: b.dataset.fase, foto: dataUrl });
            toast(T('ch.m.foto.ok','Vastgelegd. Dit is uw bewijs van de staat.')); laadCharter(); }
          catch(e){ toast(e.message); }
        });
        file.value = '';
      };
      file.click();
    }));
    document.querySelectorAll('[data-chsos]').forEach(b => b.addEventListener('click', () => {
      const bericht = prompt(T('ch.m.sosvraag','Wat is er aan de hand? (gaat direct naar het charterbedrijf EN naar RTG)'));
      if (bericht == null) return;
      const stuur = (lat, lng) => API.call('/charter/sos', { ref: b.dataset.chsos, bericht, lat, lng })
        .then(() => toast(T('ch.m.sosok','SOS verstuurd. Het charterbedrijf en RTG zijn gewaarschuwd.')))
        .catch(e => toast(e.message));
      if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => stuur(p.coords.latitude, p.coords.longitude), () => stuur());
      else stuur();
    }));
    document.querySelectorAll('[data-chloc]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.chloc, aan = b.dataset.aan === '1';
      try {
        if (aan && navigator.geolocation){
          chLocWatch[ref] = navigator.geolocation.watchPosition(p =>
            API.call('/charter/locatie', { ref, aan: true, lat: p.coords.latitude, lng: p.coords.longitude }).catch(()=>{}));
          await API.call('/charter/locatie', { ref, aan: true });
        } else {
          if (chLocWatch[ref] != null){ navigator.geolocation.clearWatch(chLocWatch[ref]); delete chLocWatch[ref]; }
          await API.call('/charter/locatie', { ref, aan: false });
        }
        toast(aan ? T('ch.m.locaanok','U deelt uw positie met het charterbedrijf; uitzetten kan altijd.') : T('ch.m.locuitok','Positie delen staat uit en is gewist.'));
        laadCharter();
      } catch(e){ toast(e.message); }
    }));
  }
  function renderChAanbod(){
    const el = $('#chAanbod'); if (!el) return;
    if (!chPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('ch.kop','Boten & jachten, RTG-veilig')+'</div>'+
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.5rem;">'+T('ch.uitleg','Vaste prijs vooraf. Met of zonder schipper (bareboat met vaarbewijs). Staat met foto\'s voor en na, SOS op zee en RTG als scheidsrechter.')+'</div>';
    for (const p of chPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">· '+esc(p.city||'')+'</span>';
      for (const b of p.boten){
        const open = chOpen === p.code + ':' + b.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="font-size:0.88rem;">'+(b.icoon||'🛥️')+' '+esc(b.naam)+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(b.dagprijs)+'/'+T('ch.dag','dag')+'</span></div>'+
          '<div style="font-size:0.7rem;color:var(--soft);margin-top:0.2rem;">'+esc(b.type||'')+' · '+(b.lengte||0)+'m · 👥'+(b.gasten||'-')+(b.hutten?' · 🛏️'+b.hutten:'')+' · '+(b.snelheidKn||0)+' kn · '+esc(b.ligplaats||'')+' · '+T('ch.borg','borg')+' '+eur(b.borg||0)+
          ' · '+(b.skipperVerplicht?'⚓ '+T('ch.skipperv','schipper verplicht'):(b.vaarbewijsVereist?T('ch.vaarbewijs','vaarbewijs of schipper'):T('ch.vrij','vrij')))+'</div>';
        if (open){
          const verplicht = b.skipperVerplicht;
          html += '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.van','Vanaf')+'</label><input type="date" id="chVan" value="'+chKeuze.van+'"></div>'+
            '<div class="bz-veld" style="flex:1;margin-top:0;"><label>'+T('ch.tot','Tot')+'</label><input type="date" id="chTot" value="'+chKeuze.tot+'"></div>'+
            '<div class="bz-veld" style="width:76px;margin-top:0;"><label>'+T('ch.gastn','Gasten')+'</label><input type="number" id="chGasten" min="1" max="'+(b.gasten||12)+'" value="'+Math.min(2,b.gasten||2)+'"></div></div>'+
            (verplicht
              ? '<div style="font-size:0.72rem;color:var(--muted);margin-top:0.5rem;">⚓ '+T('ch.altijdskipper','Dit vaartuig vaart altijd met een schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+').')+'</div>'
              : '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.55rem;"><input type="checkbox" id="chSkipper"> ⚓ '+T('ch.wilskipper','Met schipper (+'+eur(b.skipperPrijsPerDag||0)+'/'+T('ch.dag','dag')+')')+'</label>'+
                '<label style="display:flex;align-items:center;gap:0.5rem;font-size:0.8rem;margin-top:0.35rem;"><input type="checkbox" id="chVaarbewijs"> '+T('ch.hebvaarbewijs','Ik vaar bareboat en heb een geldig vaarbewijs')+'</label>')+
            '<button class="bz-groot" id="chBoek" style="margin-top:0.7rem;" data-verplicht="'+(verplicht?'1':'0')+'">'+T('ch.boek','Boek en betaal, vaste prijs')+'</button>';
        } else {
          html += '<button class="bz-btn" data-chopen="'+p.code+':'+b.id+'" style="margin-top:0.45rem;">'+T('ch.kies','Kies periode')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-chopen]').forEach(b => b.addEventListener('click', () => {
      chOpen = b.dataset.chopen;
      chKeuze = { van: new Date(Date.now() + 86400000).toISOString().slice(0, 10), tot: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) };
      renderChAanbod(); koppelChActies();
    }));
    const boek = document.getElementById('chBoek');
    if (boek) boek.addEventListener('click', async () => {
      const [code, bootId] = chOpen.split(':');
      const verplicht = boek.dataset.verplicht === '1';
      const metSkipper = verplicht || ($('#chSkipper') && $('#chSkipper').checked);
      const body = { supplierCode: code, bootId, van: $('#chVan').value, tot: $('#chTot').value, gasten: Number($('#chGasten').value), metSkipper };
      if (!metSkipper && $('#chVaarbewijs')) body.vaarbewijs = $('#chVaarbewijs').checked;
      try {
        const c = await API.call('/charter/boek', body);
        await API.call('/booking/pay', { ref: c.charter.ref });
        toast(T('ch.ok','Geboekt en betaald: ') + eur(c.charter.price) + T('ch.ok2',' vast. Behouden vaart.'));
        chOpen = null; chKeuze = null;
        laadCharter();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- vastgoed: aanbod, interesse, bod, keyless ---------- */
  let vgOpen = null;
  const vgGeld = n => '\u20AC ' + Number(n||0).toLocaleString('nl-NL');
  async function laadVastgoed(){
    if (!API.live) return;
    let d = { panden: [], bezichtigingen: [], biedingen: [] };
    try { d = await API.call('/vastgoed/aanbod'); } catch(e){}
    const el = $('#vgMijn'); if (!el) return;
    if (!d.panden.length && !d.bezichtigingen.length && !d.biedingen.length){ el.innerHTML = ''; return; }
    const bodBij = pid => d.biedingen.filter(b => true); // biedingen zijn per pand niet gelinkt in de lijst; toon apart
    let html = '';
    // lopende bezichtigingen met keyless
    for (const b of d.bezichtigingen){
      if (b.status === 'afgewezen') continue;
      html += '<div class="card" style="border-color:rgba(91,185,140,0.4);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green);">\uD83D\uDD11 '+T('vg.m.bez','Bezichtiging')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+({ 'aangevraagd': T('vg.m.aangevr','aangevraagd, wacht op bevestiging'), 'bevestigd': T('vg.m.bevestigd','bevestigd')+(b.moment?' \u00B7 '+String(b.moment).replace('T',' ').slice(0,16):''), 'afgewezen': T('vg.m.afgewezen','afgewezen') }[b.status] || b.status)+'</div>'+
        (b.keyless ? (b.keyless.actiefNu
          ? '<button class="bz-groot" style="margin-top:0.6rem;" data-vgkey="'+b.ref+'">\uD83D\uDD13 '+T('vg.m.open','Open de deur (keyless)')+'</button>'
          : '<div style="margin-top:0.4rem;font-size:0.76rem;color:var(--soft);">\uD83D\uDD12 '+T('vg.m.venster','Keyless toegang rond het afgesproken moment')+'</div>') : '')+
        '</div>';
    }
    // eigen biedingen
    for (const b of d.biedingen){
      html += '<div class="card"><div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">\uD83D\uDCB0 '+T('vg.m.bod','Uw bod')+' \u00B7 '+esc(b.pand)+'</div>'+
        '<div style="margin-top:0.3rem;font-size:0.85rem;">'+vgGeld(b.bedrag)+' \u00B7 <b>'+({ 'open':T('vg.m.open2','in behandeling'),'geaccepteerd':T('vg.m.acc','geaccepteerd!'),'afgewezen':T('vg.m.afg','afgewezen'),'tegenbod':T('vg.m.tegen','tegenbod')+(b.tegenbod?' '+vgGeld(b.tegenbod):'') }[b.status]||b.status)+'</b></div></div>';
    }
    // aangeboden panden
    if (d.panden.length){
      html += '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">\uD83C\uDFE1 '+T('vg.m.aanbod','Voor u: vastgoed')+'</div>';
      for (const p of d.panden){
        const open = vgOpen === p.supplierCode + ':' + p.id;
        html += '<div class="card">'+
          (p.fotos && p.fotos.length ? '<img src="'+p.fotos[0]+'" alt="" style="width:100%;border-radius:12px;margin-bottom:0.5rem;max-height:180px;object-fit:cover;">' : '')+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b>'+esc(p.titel)+(p.gericht?' <span style="font-size:0.6rem;color:var(--burgundy);">\u2605 '+T('vg.m.gericht','persoonlijk')+'</span>':'')+'</b>'+
          '<span style="color:var(--gold);white-space:nowrap;">'+vgGeld(p.prijs)+(p.transactie==='huur'?'/mnd':'')+'</span></div>'+
          '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">'+esc(p.soort)+' \u00B7 '+esc(p.plaats||'')+' \u00B7 \uD83D\uDECF\uFE0F'+(p.slaapkamers||0)+' \u00B7 \uD83D\uDEC1'+(p.badkamers||0)+' \u00B7 '+(p.oppervlakte||0)+'m\u00B2'+(p.zwembad?' \u00B7 \uD83C\uDFCA':'')+'</div>'+
          (open ? '<div style="margin-top:0.5rem;font-size:0.82rem;color:var(--muted);">'+escT(p.omschrijving||'')+'</div>'+
            (p.fotos && p.fotos.length > 1 ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">'+p.fotos.slice(1).map(f=>'<img src="'+f+'" alt="" style="height:70px;border-radius:8px;">').join('')+'</div>' : '')+
            '<div style="display:flex;gap:0.5rem;margin-top:0.7rem;">'+
            '<button class="bz-groot" style="flex:1;" data-vgint="'+p.supplierCode+':'+p.id+'">\uD83D\uDC41\uFE0F '+T('vg.m.interesse','Bezichtigen')+'</button>'+
            '<button class="bz-btn" data-vgbod="'+p.supplierCode+':'+p.id+'">\uD83D\uDCB0 '+T('vg.m.doebod','Bod')+'</button></div>'
            : '<button class="bz-btn" data-vgopen="'+p.supplierCode+':'+p.id+'" style="margin-top:0.5rem;">'+T('vg.m.bekijk','Bekijk')+'</button>')+
          '</div>';
      }
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-vgopen]').forEach(b => b.addEventListener('click', () => { vgOpen = b.dataset.vgopen; laadVastgoed(); }));
    document.querySelectorAll('[data-vgint]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgint.split(':');
      const wens = prompt(T('vg.m.wensvraag','Wanneer zou u willen bezichtigen? (bijv. zaterdagochtend)'));
      if (wens === null) return;
      try { await API.call('/vastgoed/interesse', { supplierCode: code, pandId: pid, wens }); toast(T('vg.m.intok','De makelaar krijgt uw aanvraag en bevestigt een moment.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgbod]').forEach(b => b.addEventListener('click', async () => {
      const [code, pid] = b.dataset.vgbod.split(':');
      const bod = prompt(T('vg.m.bodvraag','Uw bod in euro:'));
      if (!bod) return;
      try { await API.call('/vastgoed/bod', { supplierCode: code, pandId: pid, bedrag: Number(bod) }); toast(T('vg.m.bodok','Uw bod is verstuurd naar de makelaar.')); laadVastgoed(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-vgkey]').forEach(b => b.addEventListener('click', async () => {
      try { const r = await API.call('/vastgoed/keyless', { ref: b.dataset.vgkey }); toast('\uD83D\uDD13 '+T('vg.m.geopend','De deur is open. Code: ')+r.code); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- contracten: digitaal ondertekenen ---------- */  /* ---------- contracten: digitaal ondertekenen ---------- */
  async function laadContracten(){
    if (!API.live) return;
    let lijst = [];
    try { lijst = (await API.call('/contracten/mijn')).contracten || []; } catch(e){}
    const el = $('#conMijn'); if (!el) return;
    const open = lijst.filter(c => c.status !== 'geweigerd');
    if (!open.length){ el.innerHTML = ''; return; }
    el.innerHTML = open.map(c =>
      '<div class="card" style="border-color:'+(c.getekendDoorMij?'rgba(91,185,140,0.4)':'rgba(208,172,87,0.5)')+';">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:'+(c.getekendDoorMij?'var(--green)':'var(--gold)')+';">\uD83D\uDCDD '+esc(c.supplierName)+' \u00B7 '+T('con.'+c.soort, c.soort)+'</div>'+
      '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(c.titel)+'</b></div>'+
      (c.velden && c.velden.length ? '<div style="margin-top:0.2rem;font-size:0.76rem;color:var(--muted);">'+c.velden.map(v=>esc(v.label)+': '+esc(v.waarde)).join(' \u00B7 ')+'</div>' : '')+
      '<details style="margin-top:0.4rem;"><summary style="cursor:pointer;font-size:0.74rem;color:var(--gold);">'+T('con.lees','Lees de voorwaarden')+'</summary><div style="font-size:0.8rem;color:var(--muted);white-space:pre-wrap;margin-top:0.35rem;">'+escT(c.tekst)+'</div></details>'+
      (c.getekendDoorMij
        ? '<div style="margin-top:0.5rem;font-size:0.8rem;color:var(--green);">\u2705 '+(c.status==='getekend'?T('con.klaar','Getekend door beide partijen.'):T('con.wacht','U tekende; de zaak tekent nog.'))+'</div>'
        : '<div style="margin-top:0.6rem;display:flex;gap:0.5rem;"><button class="bz-groot" style="flex:1;" data-conteken="'+c.ref+'">'+T('con.teken','Ondertekenen')+'</button><button class="bz-btn" data-conweiger="'+c.ref+'">'+T('con.weiger','Weiger')+'</button></div>')+
      '</div>').join('');
    document.querySelectorAll('[data-conteken]').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('con.tekenvraag','Typ uw naam om digitaal te ondertekenen. Zo gaat u akkoord met de voorwaarden.'));
      if (!naam) return;
      try { await API.call('/contract/teken', { ref: b.dataset.conteken, naam, akkoord: true }); toast(T('con.tekenok','Getekend. Bedankt!')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-conweiger]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm(T('con.weigervraag','Dit contract weigeren?'))) return;
      try { await API.call('/contract/weiger', { ref: b.dataset.conweiger }); toast(T('con.weigerok','Geweigerd.')); laadContracten(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- bestellen: de ophaal/bezorgdienst ---------- */
  let bzPartners = [], bzZaak = null, bzMand = {}, bzLevering = 'bezorgen', bzGeo = null, bzAdresW = '';
  async function laadBestellen(){
    if (!API.live) return;
    try { bzPartners = (await API.call('/bezorg/partners')).partners || []; } catch(e){ bzPartners = []; }
    renderBestellen();
    laadBzMijn();
  }

  // De exclusieve autoshowroom: bekijken, proefrit, kopen (bod/inruil/concierge)
  async function laadShowroom(){
    const el = $('#showroom'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let d, mijn;
    try { d = await API.call('/verkoop/showroom'); mijn = await API.call('/verkoop/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const autos = d.autos || [];
    const deals = (mijn.deals || []).filter(x => !['gereden','afgeleverd','afgewezen','geannuleerd'].includes(x.status));
    if (!autos.length && !deals.length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.6rem 0 0.3rem;font-size:1rem;">🚗 ' + T('vk.h','Autoshowroom') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('vk.sub','Exclusieve occasions. Proefrit, bod of inruil.') + '</p>';
    for (const d2 of deals){
      h += '<div style="border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);text-transform:uppercase;letter-spacing:0.08em;">' + (d2.soort==='koop'?'🔑 '+T('vk.koop','Koop'):'🚗 '+T('vk.proefritk','Proefrit')) + ' · ' + escT(d2.status) + '</div>' +
        '<div style="font-size:0.86rem;margin-top:0.2rem;">' + escT(d2.autoNaam) + (d2.prijs?' · € ' + d2.prijs.toLocaleString('nl-NL'):'') + (d2.moment?' · ' + escT(d2.moment):'') + '</div>' +
        (d2.soort==='koop' && d2.status==='aanvaard' ? '<button class="js-vkteken" data-ref="' + d2.ref + '" style="margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem 0.9rem;font-weight:600;font-family:inherit;cursor:pointer;">✍️ ' + T('vk.teken','Koopcontract tekenen') + '</button>' : '') + '</div>';
    }
    h += autos.slice(0,20).map(a => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.85rem;margin-bottom:0.7rem;" data-av="' + a.id + '">' +
      '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.95rem;">' + (a.vip?'★ ':'') + escT(a.naam) + '</b><span style="font-weight:600;">€ ' + a.prijs.toLocaleString('nl-NL') + '</span></div>' +
      '<div class="sub">' + a.km.toLocaleString('nl-NL') + ' km · ' + escT(a.brandstof) + ' · ' + escT(a.transmissie) + (a.vermogenPk?' · ' + a.vermogenPk + ' pk':'') + (a.garantieMnd?' · ' + a.garantieMnd + ' mnd garantie':'') + '</div>' +
      (a.opties && a.opties.length ? '<div class="sub" style="margin-top:0.2rem;">' + a.opties.slice(0,4).map(escT).join(' · ') + '</div>' : '') +
      '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;">' +
      '<button class="js-vkproef" data-code="' + a.supplierCode + '" data-id="' + a.id + '" style="flex:1;background:none;border:1px solid var(--gold);border-radius:10px;padding:0.45rem;color:var(--gold);font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.proefritk','Proefrit') + '</button>' +
      '<button class="js-vkkoop" data-code="' + a.supplierCode + '" data-id="' + a.id + '" data-prijs="' + a.prijs + '" data-naam="' + escAttr(a.naam) + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.45rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('vk.bodknop','Bod / kopen') + '</button>' +
      '</div></div>').join('');
    el.innerHTML = h;
    el.querySelectorAll('.js-vkteken').forEach(b => b.addEventListener('click', async () => {
      const naam = prompt(T('vk.tekennaam','Typ uw naam om het koopcontract te tekenen:')); if (!naam) return;
      try { await API.call('/verkoop/teken', { ref: b.dataset.ref, naam }); toast('✍️ ' + T('vk.getekend','Getekend. De zaak levert de auto af.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkproef').forEach(b => b.addEventListener('click', async () => {
      const wens = prompt(T('vk.wens','Wanneer wilt u proefrijden? (bv. zaterdagochtend)')) || '';
      try { await API.call('/verkoop/proefrit', { supplierCode: b.dataset.code, autoId: b.dataset.id, wens }); toast('🚗 ' + T('vk.proefok','Proefrit aangevraagd. De zaak plant hem in.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-vkkoop').forEach(b => b.addEventListener('click', async () => {
      const bod = prompt(T('vk.bodvraag','Uw bod in € (leeg = vraagprijs):'), b.dataset.prijs);
      if (bod === null) return;
      const wilInruil = confirm(T('vk.inruilvraag','Wilt u een auto inruilen?'));
      let inruil = null;
      if (wilInruil){ const merk = prompt(T('vk.inmerk','Merk + model van uw inruilauto:')); if (merk){ const jaar = prompt(T('vk.injaar','Bouwjaar?'),''); const km = prompt(T('vk.inkm','Kilometerstand?'),''); inruil = { merk, model: '', jaar, km }; } }
      const concierge = confirm(T('vk.concvraag','Concierge-aflevering op uw adres?'));
      const adres = concierge ? (prompt(T('vk.adres','Afleveradres:')) || '') : '';
      try { await API.call('/verkoop/koop', { supplierCode: b.dataset.code, autoId: b.dataset.id, bod: bod===''?undefined:bod, inruil, concierge, adres }); toast('🔑 ' + T('vk.koopok','Aanvraag verstuurd. U hoort snel van de zaak.')); laadShowroom(); } catch(e){ toast(e.message); }
    }));
  }

  // Boodschappen bij een groothandel/supermarkt (consumentprijs, met bezorging)
  async function laadBoodschappen(){
    const el = $('#boodschappen'); if (!el || !API.live) return;
    if (user && user.tier === 'guest'){ el.innerHTML = ''; return; }
    let markt, mijn;
    try { markt = await API.call('/groothandel/markt'); mijn = await API.call('/groothandel/mijn'); } catch(e){ el.innerHTML = ''; return; }
    const winkels = markt.groothandels || [];
    if (!winkels.length && !(mijn.bestellingen||[]).length){ el.innerHTML = ''; return; }
    let h = '<h3 style="margin:1.4rem 0 0.3rem;font-size:1rem;">🛒 ' + T('bo.h','Boodschappen') + '</h3><p class="sub" style="margin-bottom:0.6rem;">' + T('bo.sub','Bestel en laat bezorgen.') + '</p>';
    for (const g of winkels){
      h += '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem;margin-bottom:0.8rem;">' +
        '<b>' + escT(g.naam) + '</b><span class="sub"> · ' + escT(g.city||'') + '</span>' +
        g.producten.slice(0,50).map(p => '<div style="display:flex;align-items:center;gap:0.5rem;padding:0.4rem 0;border-top:1px solid var(--line);">' +
          '<div style="flex:1;"><span style="font-size:0.85rem;">' + escT(p.naam) + '</span><span class="sub"> · € ' + p.prijs + '/' + escT(p.eenheid) + '</span></div>' +
          '<input class="js-boq" data-code="' + g.code + '" data-pid="' + p.id + '" type="number" min="0" placeholder="0" aria-label="' + T('bo.aantal','Aantal') + '" style="width:3.6rem;text-align:center;background:var(--card);border:1px solid var(--line);border-radius:8px;padding:0.35rem;color:var(--txt);font-family:inherit;"></div>').join('') +
        '<button class="js-bobestel" data-code="' + g.code + '" style="width:100%;margin-top:0.5rem;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('bo.bestel','Bezorgen') + '</button></div>';
    }
    if ((mijn.bestellingen||[]).length){
      h += '<div class="sub" style="margin:0.6rem 0 0.3rem;">' + T('bo.mijn','Mijn boodschappen') + '</div>';
      h += mijn.bestellingen.slice(0,10).map(o => '<div style="border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;margin-bottom:0.35rem;"><div style="display:flex;gap:0.5rem;"><b style="flex:1;font-size:0.82rem;">' + escT(o.groothandelNaam) + ' · € ' + o.subtotaal + '</b><span class="sub">' + escT(o.status) + '</span></div></div>').join('');
    }
    el.innerHTML = h;
    el.querySelectorAll('.js-bobestel').forEach(b => b.addEventListener('click', async () => {
      const regels = [];
      el.querySelectorAll('.js-boq[data-code="' + b.dataset.code + '"]').forEach(inp => { const a = Number(inp.value)||0; if (a>0) regels.push({ productId: inp.dataset.pid, aantal: a }); });
      if (!regels.length) return toast(T('bo.kies','Vul minstens een aantal in.'));
      try { await API.call('/groothandel/bestel', { groothandelCode: b.dataset.code, regels }); toast('🛒 ' + T('bo.ok','Boodschappen besteld.')); laadBoodschappen(); } catch(e){ toast(e.message); }
    }));
  }
  async function laadBzMijn(){
    const el = $('#bzMijn'); if (!el || !API.live) return;
    let mijn = [];
    try { mijn = ((await API.call('/orders/mine')).orders || []).filter(o => o.levering && !['bezorgd','opgehaald','geweigerd','terugbetaald','wacht-op-betaling'].includes(o.status)); } catch(e){}
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = mijn.map(o => {
      const st = { 'nieuw': T('bz.m.nieuw','ontvangen door de zaak'), 'in bereiding': T('bz.m.bereid','wordt bereid'),
        'klaar': o.levering === 'ophalen' ? T('bz.m.haal','klaar om op te halen') : T('bz.m.wachtb','klaar, wacht op de bezorger'),
        'onderweg': T('bz.m.weg','onderweg naar u') }[o.status] || o.status;
      return '<div class="card" style="border-color:rgba(194,58,94,0.35);" data-bzvolg="'+o.ref+'">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--burgundy);display:flex;align-items:center;gap:0.4rem;"><span class="livedot"></span>'+esc(o.supplierName)+' \u00B7 '+(o.levering==='ophalen'?T('bz.m.ophalen','ophalen'):T('bz.m.bezorgen','bezorging'))+'</div>'+
        '<div style="margin-top:0.4rem;font-size:0.9rem;"><b>'+st+'</b><span id="bzEta-'+o.ref+'">'+(o.status==='onderweg'&&o.etaMin?' \u00B7 \u23F1 '+o.etaMin+' min':'')+'</span></div>'+
        '<div style="margin-top:0.3rem;font-size:0.78rem;color:var(--muted);">'+o.items.map(i=>i.qty+'x '+esc(i.name)).join(', ')+
        (o.levering==='ophalen' ? ' \u00B7 '+T('bz.m.code','code')+' <b style="color:var(--gold);">'+o.pickup+'</b>' : (o.bezorger?' \u00B7 \uD83D\uDEF5 '+esc(o.bezorger.name):''))+'</div></div>';
    }).join('');
  }
  function opBezorg(d){
    // live: status, bezorger of GPS/ETA veranderd
    if (d.kind === 'gps'){
      const el = document.getElementById('bzEta-' + d.ref);
      if (el && d.etaMin) el.textContent = ' \u00B7 \u23F1 ' + d.etaMin + ' min';
      return;
    }
    laadBzMijn();
    if (d.kind === 'status' && (d.status === 'bezorgd' || d.status === 'opgehaald')) toast(T('bz.m.klaar2','Eet smakelijk! Uw bestelling is er.'));
  }
  function renderBestellen(){
    const el = $('#bzInhoud'); if (!el) return;
    if (bzZaak) return renderBzZaak();
    if (!bzPartners.length){
      el.innerHTML = '<div class="card"><div style="font-size:0.85rem;color:var(--muted);">'+T('bz.geen','Nog geen partners met een bezorgdienst op uw bestemming. Zodra een zaak de dienst opent, staat hij hier.')+'</div></div>';
      return;
    }
    el.innerHTML = bzPartners.map(p =>
      '<button class="card" style="display:block;width:100%;text-align:left;cursor:pointer;" data-bzkies="'+p.code+'">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;"><b>'+esc(p.name)+'</b><span class="soft-sm">'+esc(p.city||'')+'</span></div>'+
      '<div style="margin-top:0.3rem;font-size:0.76rem;color:var(--muted);">'+(p.bezorgen?'\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen'):'')+(p.bezorgen&&p.ophalen?' \u00B7 ':'')+(p.ophalen?'\uD83E\uDDFA '+T('bz.kan.oph','ophalen'):'')+' \u00B7 '+p.producten.length+' '+T('bz.prod','producten')+'</div></button>'
    ).join('');
    document.querySelectorAll('[data-bzkies]').forEach(b => b.addEventListener('click', () => {
      bzZaak = bzPartners.find(p => p.code === b.dataset.bzkies); bzMand = {};
      bzLevering = bzZaak.bezorgen ? 'bezorgen' : 'ophalen';
      renderBzZaak();
    }));
  }
  function bzTotaal(){ return (bzZaak.producten||[]).reduce((t,p) => t + (bzMand[p.id]||0) * p.price, 0); }
  function renderBzZaak(){
    const el = $('#bzInhoud'); if (!el) return;
    const p = bzZaak;
    const n = Object.values(bzMand).reduce((a,b)=>a+b,0);
    el.innerHTML =
      '<button class="bz-btn" id="bzTerug" style="margin-bottom:0.8rem;">\u2039 '+T('bz.terug','Alle partners')+'</button>'+
      '<div class="card"><b>'+esc(p.name)+'</b>'+
      p.producten.map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.7rem;">'+
        '<div style="flex:1;"><div style="font-size:0.88rem;">'+esc(x.name)+'</div>'+(x.desc?'<div class="soft-sm">'+esc(x.desc)+'</div>':'')+'</div>'+
        '<span style="color:var(--gold);font-size:0.82rem;">'+eur(x.price)+'</span>'+
        '<span style="display:flex;align-items:center;gap:0.45rem;">'+
        '<button class="bz-btn" data-bzmin="'+x.id+'" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+(bzMand[x.id]||0)+'</b><button class="bz-btn" data-bzplus="'+x.id+'" style="padding:0.2rem 0.7rem;">+</button></span></div>'
      ).join('')+'</div>'+
      '<div class="card">'+
      '<div style="display:flex;gap:0.5rem;">'+
      (p.bezorgen?'<button class="bz-btn'+(bzLevering==='bezorgen'?' on':'')+'" data-bzlev="bezorgen">\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen')+'</button>':'')+
      (p.ophalen?'<button class="bz-btn'+(bzLevering==='ophalen'?' on':'')+'" data-bzlev="ophalen">\uD83E\uDDFA '+T('bz.kan.oph','ophalen')+'</button>':'')+'</div>'+
      (bzLevering==='bezorgen' ? '<div class="bz-veld"><label>'+T('bz.adres','Bezorgadres')+'</label><input id="bzAdres" value="'+escAttr(bzAdresW)+'" placeholder="'+T('bz.adresph','Straat, nummer, plaats')+'"></div>'+
        '<button class="bz-btn'+(bzGeo?' on':'')+'" id="bzHier" style="margin-top:0.5rem;">\uD83D\uDCCD '+(bzGeo?T('bz.hierok','Locatie gedeeld voor de ETA'):T('bz.hier','Deel mijn locatie voor een live ETA'))+'</button>' : '')+
      '<button class="bz-groot" id="bzBestel" style="margin-top:1rem;"'+(n?'':' disabled')+'>'+T('bz.bestel','Bestel en betaal')+(n?' \u00B7 '+eur(bzTotaal()):'')+'</button></div>';
    const adresIn = document.getElementById('bzAdres');
    if (adresIn) adresIn.addEventListener('input', () => { bzAdresW = adresIn.value; });
    $('#bzTerug').addEventListener('click', () => { bzZaak = null; renderBestellen(); });
    document.querySelectorAll('[data-bzplus]').forEach(b => b.addEventListener('click', () => { bzMand[b.dataset.bzplus]=(bzMand[b.dataset.bzplus]||0)+1; renderBzZaak(); }));
    document.querySelectorAll('[data-bzmin]').forEach(b => b.addEventListener('click', () => { const k=b.dataset.bzmin; if (bzMand[k]) bzMand[k]--; if (!bzMand[k]) delete bzMand[k]; renderBzZaak(); }));
    document.querySelectorAll('[data-bzlev]').forEach(b => b.addEventListener('click', () => { bzLevering = b.dataset.bzlev; renderBzZaak(); }));
    const hier = document.getElementById('bzHier');
    if (hier) hier.addEventListener('click', () => {
      if (!navigator.geolocation) return toast(T('bz.geengps','Dit apparaat deelt geen locatie.'));
      navigator.geolocation.getCurrentPosition(pos => { bzGeo = { lat: pos.coords.latitude, lng: pos.coords.longitude }; renderBzZaak(); },
        () => toast(T('bz.gpsfout','Locatie delen is geweigerd; de ETA blijft dan een schatting.')));
    });
    $('#bzBestel').addEventListener('click', async () => {
      const items = Object.entries(bzMand).map(([id, qty]) => ({ id, qty }));
      if (!items.length) return;
      try {
        const b = await API.call('/bezorg/bestel', { supplierCode: p.code, levering: bzLevering, items,
          adres: bzLevering === 'bezorgen' ? bzAdresW : undefined,
          lat: bzGeo ? bzGeo.lat : undefined, lng: bzGeo ? bzGeo.lng : undefined });
        await API.call('/order/pay', { ref: b.order.ref });
        toast(bzLevering === 'ophalen' ? T('bz.ok.oph','Betaald. Uw ophaalcode: ') + b.order.pickup : T('bz.ok.bez','Betaald. U volgt de bezorging hierboven live.'));
        bzZaak = null; bzMand = {};
        renderBestellen(); laadBzMijn();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- ter plaatse: bestellen bij RTG-partners ---------- */
  const ALG_ICON = '<svg viewBox="0 0 64 64" fill="none" stroke="#0C0C0B" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="2.6" fill="#0C0C0B"/><circle cx="40.5" cy="26.5" r="2.6" fill="#0C0C0B"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';
  let suppliers = [];
  let myOrders = [];
  let menuState = null; // { supplier, menu, qty:{}, note, tag }

  async function renderTerPlaatse(){
    if (!API.live){
      $('#supplierList').innerHTML = '<div class="empty" style="padding:2rem 1rem;color:var(--soft);text-align:center;font-size:0.85rem;">'+T('app.tp.needserver','Ter plaatse werkt via de RTG-server. Start de app met de backend om te bestellen bij partners.')+'</div>';
      return;
    }
    try {
      const [sd, od] = await Promise.all([API.call('/suppliers', { city: trip.dest }), API.call('/orders/mine')]);
      suppliers = sd.suppliers || [];
      myOrders = od.orders || [];
      $('#tpSub').textContent = T('app.tp.partnersin','RTG-partners in') + ' ' + (sd.city || trip.dest) + ', ' + T('app.tp.orderpayreserve','bestel, betaal en reserveer.');
    } catch (e) { return; }

    renderLive();  // live "onderweg"-paneel bovenaan
    renderZorg();  // zorgprofiel + wie er (met toestemming) live meekijkt

    // mijn lopende bestellingen bovenaan
    const active = myOrders.filter(o => o.status !== 'terugbetaald');
    $('#myOrders').innerHTML = active.length
      ? '<div class="sec-label">'+T('app.tp.myorders','Mijn bestellingen')+'</div>' + active.map(o => {
          const pc = o.status === 'nieuw' ? 'nieuw' : o.status === 'in bereiding' ? 'bereiding' : 'klaar';
          return '<div class="myorder" data-ref="' + o.ref + '">' +
            '<div class="r1"><div><div class="nm">' + o.supplierName + '</div><div class="sub2">' + o.items.reduce((n,i)=>n+i.qty,0) + ' ' + T('app.items','item(s)') + ' · ' + timeAgo(o.at) + '</div></div>' +
              '<div style="text-align:right;"><div class="amt">' + eur(o.total) + '</div><span class="mo-pill ' + pc + '">' + tStatus(o.status) + '</span></div></div>' +
            '<div class="acts">' + (o.paid
              ? '<span class="mo-paid">✓ '+T('app.paid','Betaald')+'</span>'
              : '<button class="mo-pay js-opay">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button>') +
              (o.pickup ? '<button class="mo-code js-ocode">' + T('app.showcode','Toon ophaalcode') + '</button>' : '') +
              (['nieuw','wacht-op-betaling'].includes(o.status) ? '<button class="mo-code js-oann">✕ ' + T('erv.annuleer','Annuleer') + '</button>' : '') +
              (o.paid && !o.splitst ? '<button class="mo-code js-osplit">🤝 ' + T('erv.splits','Splits') + '</button>' : '') +
              (['geserveerd','bezorgd','opgehaald'].includes(o.status) ? '<button class="mo-code js-orev">⭐ ' + T('erv.review','Beoordeel') + '</button>' : '') +
              (o.tagSalon ? '<span style="font-size:0.68rem;color:var(--burgundy);margin-left:auto;">✦ '+T('app.taggedsalon','getagd voor Salon')+'</span>' : '') +
            '</div></div>';
        }).join('')
      : '';
    $('#myOrders').querySelectorAll('.myorder').forEach(el => {
      const o = active.find(x => x.ref === el.dataset.ref);
      const pb = el.querySelector('.js-opay');
      if (pb) pb.addEventListener('click', () => payOrder(o));
      const cb = el.querySelector('.js-ocode');
      if (cb) cb.addEventListener('click', () => showGlow(o));
      const ab = el.querySelector('.js-oann');
      if (ab) ab.addEventListener('click', async () => {
        try {
          const d = await API.call('/annuleer', { soort: 'order', ref: o.ref });
          toast(d.terugbetaald ? '↩️ ' + T('erv.retour','U ontvangt') + ' ' + eur(d.terugbetaald) + ' ' + T('erv.terug','retour.') : T('erv.geannuleerd','Geannuleerd.'));
          renderTerPlaatse();
        } catch(e){ toast(e.message); }
      });
      const rb = el.querySelector('.js-orev');
      if (rb) rb.addEventListener('click', () => reviewUI(el, o));
      const sb = el.querySelector('.js-osplit');
      if (sb) sb.addEventListener('click', () => splitsUI(el, o));
    });

    // partners: op afstand tonen en sorteren wanneer we de locatie weten
    const mijnPlek = window.Geo ? Geo.laatste() : null;
    const supRij = suppliers.map(s => ({ s, km: mijnPlek && s.loc ? Geo.afstandKm(mijnPlek, s.loc) : null }));
    if (mijnPlek) supRij.sort((a,b) => (a.km==null?1e9:a.km) - (b.km==null?1e9:b.km));
    $('#supplierList').innerHTML = '<div class="sec-label">'+T('app.tp.partnersdest','Partners op uw bestemming')+'</div>' + supRij.map(({s, km}) => {
      const rooms = (s.rooms || []).length, photos = (s.photos || []).length;
      const zzp = (s.services || []).length > 0;
      const viewable = s.hasMenu || rooms || photos;
      const afst = km!=null ? ' · 📍 ' + Geo.tekst(km) : '';
      const ster = s.rating ? ' · ⭐ ' + s.rating.score : '';
      const sub = (s.vak ? s.vak : tType(s.typeLabel)) + ster + ' · ' + s.city + (rooms ? ' · ' + rooms + ' ' + T('app.roomsfree','kamer(s) vrij') : '') + afst;
      return '<div class="sup-card">' +
        '<span class="ic">' + (s.icon || '📍') + '</span>' +
        '<div class="t"><b>' + s.name + '</b><span>' + sub + '</span></div>' +
        '<button class="chatb js-fav" data-fav="' + s.code + '" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '❤️' : '🤍') + '</button>' +
        '<button class="chatb" data-chat="' + s.code + '" aria-label="Chat">💬</button>' +
        (zzp
          ? '<button class="go" data-boek="' + s.code + '">'+T('app.tp.boek','Boek')+'</button>'
          : viewable
          ? '<button class="go" data-menu="' + s.code + '">'+(s.hasMenu ? T('app.tp.viewmenu','Bekijk kaart') : T('app.tp.view','Bekijk'))+'</button>'
          : '<button class="go ghost" data-loc="' + s.code + '">'+T('app.tp.location','Locatie')+'</button>') +
      '</div>';
    }).join('');
    $('#supplierList').querySelectorAll('[data-chat]').forEach(b => b.addEventListener('click', () => openPChat(b.dataset.chat)));
    $('#supplierList').querySelectorAll('[data-menu]').forEach(b => b.addEventListener('click', () => openMenu(b.dataset.menu)));
    $('#supplierList').querySelectorAll('[data-boek]').forEach(b => b.addEventListener('click', () => openBoekSheet(b.dataset.boek)));
    $('#supplierList').querySelectorAll('.js-fav').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: b.dataset.fav });
        b.textContent = d.favoriet ? '❤️' : '🤍';
        toast(d.favoriet ? '❤️ ' + T('fav.on','Bewaard bij mijn adressen.') : T('fav.off','Uit mijn adressen gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    // eenmalig de locatie ophalen zodat partners op afstand worden getoond en gesorteerd
    if (window.Geo && !mijnPlek && !renderTerPlaatse._gps){ renderTerPlaatse._gps = true; Geo.positie().then(p => { if (p) renderTerPlaatse(); }); }
    renderAfspraken();
  }

  // review: de actie-rij wordt vijf sterren; een tik plaatst de beoordeling
  function reviewUI(el, o){
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<span style="font-size:0.72rem;color:var(--soft);align-self:center;">' + T('erv.hoewas','Hoe was het?') + '</span>' +
      [1,2,3,4,5].map(n => '<button class="mo-code js-star" data-n="' + n + '" aria-label="' + n + ' ' + T('erv.sterren','sterren') + '">' + '⭐'.repeat(1) + n + '</button>').join('');
    acts.querySelectorAll('.js-star').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/review', { soort: 'order', ref: o.ref, score: Number(b.dataset.n) });
        toast('⭐ ' + T('erv.bedanktreview','Dank voor uw beoordeling.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); renderTerPlaatse(); }
    }));
  }

  // splitsen: kies verbonden vrienden; ieder krijgt een betaalverzoek voor een gelijk deel
  async function splitsUI(el, o){
    let cons = [];
    try { cons = (await API.call('/member/connections')).connections || []; } catch(e){}
    if (!cons.length){ toast(T('erv.geenvrienden','Voeg eerst vrienden toe via de Salon om te kunnen splitsen.')); return; }
    const acts = el.querySelector('.acts');
    acts.innerHTML = '<div style="width:100%;">' +
      '<div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.35rem;">' + T('erv.splitsmet','Splits gelijk met:') + '</div>' +
      cons.slice(0,8).map(c => '<label style="display:inline-flex;align-items:center;gap:0.3rem;margin:0 0.6rem 0.4rem 0;font-size:0.78rem;"><input type="checkbox" class="js-splid" value="' + c.key + '"> ' + c.codename + '</label>').join('') +
      '<button class="mo-pay js-splgo" style="width:100%;margin-top:0.2rem;">🤝 ' + T('erv.stuurverzoek','Stuur betaalverzoeken') + '</button></div>';
    acts.querySelector('.js-splgo').addEventListener('click', async () => {
      const metKeys = [...acts.querySelectorAll('.js-splid:checked')].map(x => x.value);
      if (!metKeys.length){ toast(T('erv.kiesvriend','Kies minstens een vriend.')); return; }
      try {
        const d = await API.call('/splits', { ref: o.ref, metKeys });
        toast('🤝 ' + T('erv.verzoekweg','Betaalverzoeken verstuurd:') + ' ' + eur(d.splits.delen[0].bedrag) + ' ' + T('erv.pp','p.p.'));
        renderTerPlaatse();
      } catch(e){ toast(e.message); }
    });
  }

  // mijn afspraken bij zelfstandigen: status volgen en achteraf betalen
  async function renderAfspraken(){
    const wrap = $('#afsprakenList');
    if (!wrap) return;
    let bs = [];
    try { bs = (await API.call('/bookings/mine')).boekingen || []; } catch(e){}
    const actief = bs.filter(b => b.status !== 'afgerond' && b.status !== 'geweigerd').slice(0, 6);
    const BST = {
      'wacht-op-betaling': [T('boek.st.wacht','wacht op betaling'), 'var(--amber, #C99A2E)'],
      'aangevraagd': [T('boek.st.aan','aangevraagd'), 'var(--soft)'],
      'bevestigd': [T('boek.st.ok','bevestigd'), 'var(--green, #4C9A75)']
    };
    wrap.innerHTML = actief.length ? '<div class="sec-label">🗓️ '+T('boek.mijn','Mijn afspraken')+'</div>' + actief.map(b => {
      const st = BST[b.status] || [b.status, 'var(--soft)'];
      return '<div class="myorder">' +
        '<div class="r1"><div><div class="nm">' + b.supplierName + '</div><div class="sub2">' + b.service.name + (b.wanneer ? ' · ' + b.wanneer : '') + '</div></div>' +
        '<div style="text-align:right;"><div class="amt">' + eur(b.price) + '</div><span style="font-size:0.62rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:' + st[1] + ';">' + st[0] + '</span></div></div>' +
        (!b.paid ? '<div class="acts"><button class="mo-pay js-bpay" data-bref="' + b.ref + '" data-bamt="' + b.price + '">' + FID_MINI + T('app.paywithfid','Betaal met Face ID') + '</button></div>' : '') +
      '</div>';
    }).join('') : '';
    wrap.querySelectorAll('.js-bpay').forEach(k => k.addEventListener('click', () => {
      payWithFaceId(eur(Number(k.dataset.bamt)), async () => {
        await API.call('/booking/pay', { ref: k.dataset.bref });
      }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
    }));
    $('#supplierList').querySelectorAll('[data-loc]').forEach(b => b.addEventListener('click', () => {
      const s = suppliers.find(x => x.code === b.dataset.loc);
      toast(s.name + ', ' + (s.loc && s.loc.label ? s.loc.label : T('app.tp.locwhenenroute','locatie gedeeld zodra u onderweg bent')) + '.');
    }));
  }

  /* ---------- zelfstandigen boeken: diensten en producten met datum en tijd ---------- */
  let boekKeuze = null;
  function openBoekSheet(code){
    const s = suppliers.find(x => x.code === code);
    if (!s || !(s.services || []).length) return;
    boekKeuze = null;
    $('#boekSup').textContent = s.name;
    const morgen = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    $('#boekBody').innerHTML =
      (s.vak ? '<div style="font-size:0.72rem;color:var(--gold);letter-spacing:0.1em;text-transform:uppercase;margin-bottom:0.6rem;">' + s.vak + ' · ' + s.city + '</div>' : '') +
      s.services.map(x =>
        '<div class="rowitem js-svc" data-svc="' + x.id + '" style="cursor:pointer;border:1px solid var(--line);border-radius:12px;padding:0.75rem 0.9rem;margin-bottom:0.55rem;">' +
        '<div class="t"><b>' + (x.soort === 'product' ? '📦 ' : '🗓️ ') + x.name + '</b><span>' + (x.desc || '') + (x.duurMin ? ' · ' + x.duurMin + ' min' : '') + '</span></div>' +
        '<span class="amount">' + eur(x.price) + '</span></div>').join('') +
      '<div style="display:flex;gap:0.5rem;margin-top:0.6rem;">' +
      '<input id="boekDatum" type="date" value="' + morgen + '" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;">' +
      '<input id="boekTijd" type="time" value="14:00" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem;color:var(--txt);font-family:inherit;color-scheme:dark;"></div>' +
      '<input id="boekNote" placeholder="' + T('boek.noteph','Bijv. maat, locatie of blessure') + '" style="width:100%;margin-top:0.5rem;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.6rem 0.7rem;color:var(--txt);font-family:inherit;font-size:0.82rem;">' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.5rem 0 0;">' + T('boek.los','U boekt rechtstreeks bij deze professional: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de professional.') + '</div>' +
      '<button id="boekGo" class="btn-pay" style="width:100%;margin-top:0.7rem;justify-content:center;">' + FID + T('boek.go','Boek en betaal') + '</button>';
    $('#boek-sheet').classList.add('open');
    $('#boek-scrim').classList.add('open');
    $('#boekBody').querySelectorAll('.js-svc').forEach(el => el.addEventListener('click', () => {
      boekKeuze = el.dataset.svc;
      $('#boekBody').querySelectorAll('.js-svc').forEach(x => x.style.borderColor = x.dataset.svc === boekKeuze ? 'var(--gold)' : 'var(--line)');
    }));
    $('#boekGo').addEventListener('click', async () => {
      if (!boekKeuze){ toast(T('boek.kies','Kies eerst een dienst of product.')); return; }
      let d;
      try {
        d = await API.call('/booking/request', { supplierCode: code, serviceId: boekKeuze,
          date: $('#boekDatum').value, time: $('#boekTijd').value, note: $('#boekNote').value.trim() });
      } catch(e){ toast(e.message); return; }
      $('#boek-sheet').classList.remove('open');
      $('#boek-scrim').classList.remove('open');
      if (d.boeking.status === 'wacht-op-betaling'){
        payWithFaceId(eur(d.boeking.price), async () => {
          await API.call('/booking/pay', { ref: d.boeking.ref });
          return d.boeking;
        }, { message: () => T('boek.betaald','Geboekt en betaald; u hoort het zodra het bevestigd is.'), after: () => renderTerPlaatse() });
      } else {
        toast('🗓️ ' + T('boek.ok','Aanvraag verstuurd; betalen kan achteraf.'));
        renderTerPlaatse();
      }
    });
  }
  $('#boekClose').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });
  $('#boek-scrim').addEventListener('click', () => { $('#boek-sheet').classList.remove('open'); $('#boek-scrim').classList.remove('open'); });


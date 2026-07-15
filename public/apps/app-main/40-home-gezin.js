  /* ---------- oplichtend ophaalcode-scherm ---------- */
  function showGlow(o){
    $('#gcSup').textContent = o.supplierName;
    $('#gcCode').textContent = o.pickup;
    $('#glowCode').classList.add('open');
  }
  $('#glowCode').addEventListener('click', () => $('#glowCode').classList.remove('open'));

  /* ---------- home + codenaam ---------- */

  function qrSvg(seed){
    let s = seed, cells = '';
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++){
      const corner = (x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8);
      const on = corner
        ? ((x % 12 < 1 || x % 12 > 2 ? 1 : 0) || (y % 12 < 1 || y % 12 > 2 ? 1 : 0)) &&
          !((x % 12 === 1 || x % 12 === 2) && (y % 12 === 1 || y % 12 === 2)) || (x===1&&y===1)||(x===2&&y===2)||(x===11&&y===1)||(x===1&&y===11)
        : rnd() > 0.5;
      if (on) cells += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
    }
    return '<svg viewBox="0 0 13 13" xmlns="http://www.w3.org/2000/svg" fill="#0C0C0B">' + cells + '</svg>';
  }

  function toggleWhy(forceOpen){
    const why = document.querySelector('.codecard .why');
    if (!why) return;
    why.classList.toggle('open', forceOpen === true ? true : !why.classList.contains('open'));
  }

  function renderVerifyBanner(){
    const el = $('#verifyBanner');
    if (!el) return;
    const v = user && user.account ? user.verified : null;
    if (!user || !user.account || v === 'verified'){ el.innerHTML = ''; return; }
    if (v === 'pending'){
      el.innerHTML = '<div class="vbanner pending"><b>'+T('vf.pending.h','Verificatie in behandeling')+'</b><span>'+T('vf.pending.b','We controleren uw document. U kunt de app gewoon blijven gebruiken.')+'</span>'+
        '<button class="vbtn" id="selfieStart" style="margin-top:0.5rem;">'+T('vf.selfie','Selfie toevoegen (gezichtscontrole)')+'</button></div>';
      const sb = $('#selfieStart'); if (sb) sb.addEventListener('click', () => $('#selfieFile').click());
      return;
    }
    el.innerHTML = '<div class="vbanner"><b>'+T('vf.h','Verifieer uw identiteit, boek in één tik')+'</b>' +
      '<span>'+T('vf.b','Eén foto van de voorkant van uw paspoort plus een selfie. Zo weet RTG zeker dat u het bent (gezicht x paspoort), houden we nepaccounts buiten, en boekt u daarna zonder gedoe. Uw gegevens zijn alleen zichtbaar voor RTG.')+'</span>' +
      '<button class="vbtn" id="verifyStart">'+T('vf.btn','Document uploaden')+'</button></div>';
    $('#verifyStart').addEventListener('click', () => $('#verifyFile').click());
  }
  (function initVerifyUpload(){
    const vf = document.getElementById('verifyFile');
    if (!vf) return;
    vf.addEventListener('change', () => {
      const file = vf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); vf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/upload', { image: reader.result }); user.verified = 'pending'; renderVerifyBanner(); toast(T('vf.sent','Document ontvangen, we controleren het.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      vf.value = '';
    });
    const sf = document.getElementById('selfieFile');
    if (sf) sf.addEventListener('change', () => {
      const file = sf.files[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024){ toast(T('vf.toobig','Bestand te groot (max 5 MB).')); sf.value=''; return; }
      const reader = new FileReader();
      reader.onload = async () => {
        try { await API.call('/verify/selfie', { image: reader.result }); toast(T('vf.selfieok','Selfie ontvangen. RTG controleert het gezicht bij uw paspoort.')); }
        catch (e){ toast(e.message || 'Upload mislukt.'); }
      };
      reader.readAsDataURL(file);
      sf.value = '';
    });
  })();

  /* ---- paspoortverzoeken: een partner vroeg uw identiteit op (u beslist) ---- */
  let paspoortInboxData = null;
  async function laadPaspoortInbox(){
    if (!user || !user.account){ const el = $('#paspoortInbox'); if (el) el.innerHTML = ''; return; }
    try { paspoortInboxData = await API.call('/paspoort/mijn', {}); } catch(e){ paspoortInboxData = null; }
    renderPaspoortInbox();
  }
  function renderPaspoortInbox(){
    const el = $('#paspoortInbox'); if (!el) return;
    if (!user || !user.account){ el.innerHTML = ''; return; }
    if (!paspoortInboxData){ laadPaspoortInbox(); return; }
    const open = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'aangevraagd');
    const lopend = (paspoortInboxData.verzoeken || []).filter(v => v.status === 'goedgekeurd');
    let html = '';
    if (open.length) html += open.map(v => '<div class="vbanner" style="border-color:var(--gold,#c9a227);">' +
      '<b>🪪 '+esc(v.supplierName)+' '+T('pi.vraagt','vraagt uw')+' '+T('pi.n.'+v.niveau, v.niveau)+'</b>' +
      '<span>'+(v.reden?esc(v.reden)+' · ':'')+T('pi.uitleg','U beslist. Bij goedkeuren ziet de partner dit 10 minuten; daarna vervalt het vanzelf.')+'</span>' +
      '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;"><button class="vbtn" data-pigo="'+v.id+'">'+T('pi.goed','Goedkeuren')+'</button>' +
      '<button class="vbtn" data-piweiger="'+v.id+'" style="background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.weiger','Weigeren')+'</button></div></div>').join('');
    if (lopend.length) html += lopend.map(v => '<div class="vbanner pending"><b>'+esc(v.supplierName)+' · '+T('pi.n.'+v.niveau, v.niveau)+' '+T('pi.gedeeld','gedeeld')+'</b>' +
      '<span>'+T('pi.lopend','De inzage loopt. U kunt hem intrekken.')+'</span>' +
      '<button class="vbtn" data-pitrek="'+v.id+'" style="margin-top:0.4rem;background:none;border:1px solid var(--line);color:var(--txt);">'+T('pi.trek','Intrekken')+'</button></div>').join('');
    el.innerHTML = html;
    el.querySelectorAll('[data-pigo]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.pigo, akkoord: true }); toast(T('pi.goedok','Goedgekeurd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-piweiger]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/beslis', { id: b.dataset.piweiger, akkoord: false }); toast(T('pi.weigerok','Geweigerd.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-pitrek]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/paspoort/trek-in', { id: b.dataset.pitrek }); toast(T('pi.trekok','Ingetrokken.')); await laadPaspoortInbox(); } catch(e){ toast(e.message); }
    }));
  }

  function renderHome(){
    renderVerifyBanner();
    laadPaspoortInbox();
    // gratis gebruiker (zonder pas): beperkte, veilige startpagina
    if (user.tier === 'guest'){ renderHomeGuest(); return; }
    const first = user.full.split(' ')[0];
    const E = Util.el; // componentframework voor de kaarten hieronder
    // de stem volgt de pas van het ingelogde lid (niet alleen de ingang)
    document.documentElement.setAttribute('data-stem', user.tier);
    stemKoppen();
    $('#homeGreeting').textContent = stem(
      'Ha ' + first + ', goed je te zien.',
      'Dag ' + first + '. Alles onder controle.',
      'Welkom terug, ' + first + '. Alles staat voor u klaar.'
    ) || (T('app.welcome','Welkom,') + ' ' + first + '.');
    $('#homeSub').textContent = TIER_LABEL[user.tier] + ' · ' + T('app.membersince','lid sinds') + ' ' + user.since;

    // De codecard met Util.el: codenaam, lidnummer en leeftijdsgroep gaan
    // structureel als tekstknoop. De QR is gegenereerd (geen gebruikerstekst) en
    // blijft als kant-en-klare SVG in een eigen container.
    const qr = E('div');
    qr.innerHTML = qrSvg(user.number.length * 7919);
    Util.vervang($('#codecard'),
      E('div', { class: 'label' }, stem(
        'Je codenaam, je identiteit in onze wereld',
        'Je codenaam, de identiteit van de zaak onderweg',
        'Uw codenaam, uw identiteit in onze wereld'
      ) || T('app.cc.label', 'Uw codenaam, uw identiteit in onze systemen')),
      E('div', { class: 'cn' }, user.codename),
      E('div', { class: 'row' },
        E('div', {},
          E('div', { class: 'mrow' }, T('app.cc.membernr', 'Lidnummer'), E('b', {}, user.number)),
          E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.pass', 'Pas'), E('b', {}, TIER_LABEL[user.tier])),
          user.leeftijdsgroep ? E('div', { class: 'mrow', style: { marginTop: '0.55rem' } }, T('app.cc.age', 'Leeftijd'), E('b', {}, user.leeftijdsgroep + ' \u00b7 ' + T('app.cc.ageok', 'paspoort'))) : null),
        qr),
      E('button', { class: 'whybtn', id: 'whyBtn', onclick: () => toggleWhy() }, T('app.cc.why', 'Waarom een codenaam?') + ' \u2192'),
      E('div', { class: 'why' }, E('b', {}, T('app.cc.why.h', 'Uw echte naam staat niet in onze reisdata.')),
        ' ' + T('app.cc.why.b', 'Reserveringen, betalingen en Salon-activiteit staan op uw codenaam. Uw echte naam ligt in een gescheiden, versleutelde kluis en wordt pas bij ticketing en check-in eenmalig gekoppeld. Zou reisdata ooit gestolen worden, dan heeft de aanvaller nooit de juiste naam bij uw reizen.')));

    const open = invoices.filter(i => i.status === 'open');
    const openSum = open.reduce((s,i) => s + i.netto + i.bijdrage, 0);

    // Deze twee kaarten met Util.el: tekst structureel veilig, data-goto blijft
    // (de globale [data-goto]-binding onderaan pakt de knoppen op).
    Util.vervang($('#homeTrip'),
      E('div', { class: 'label' }, T('app.nexttrip', 'Eerstvolgende reis')),
      E('div', { class: 'big' }, trip.dest),
      E('div', { class: 'meta' }, trip.dates + ' · ' + T('app.in', 'over') + ' ' + trip.days + ' ' + T('app.days', 'dagen')),
      E('button', { class: 'go', dataset: { goto: 'reizen' } }, (stem('Bekijk je reis', 'Naar je reizen', 'Bekijk uw reis') || T('app.viewtrip', 'Bekijk uw reis')) + ' →'));
    Util.vervang($('#homePay'), open.length
      ? [E('div', { class: 'label' }, T('app.outstanding', 'Openstaand')),
         E('div', { class: 'big accent' }, eur(openSum)),
         E('div', { class: 'meta' }, open.length + ' ' + (open.length === 1 ? T('app.payment', 'betaling') : T('app.payments', 'betalingen')) + ' · ' + T('app.onetapfid', 'één tik met Face ID')),
         E('button', { class: 'go', dataset: { goto: 'betalen' } }, T('app.paynow', 'Nu betalen') + ' →')]
      : [E('div', { class: 'label' }, T('app.payments.cap', 'Betalingen')),
         E('div', { class: 'big', style: { color: 'var(--green)' } }, T('app.allsettled', 'Alles voldaan')),
         E('div', { class: 'meta' }, T('app.nothingopen', 'Er staat niets open.'))]);
    $('#homeSalon').innerHTML =
      '<div class="label">'+T('app.thesalon','De Salon')+'</div>' +
      '<div class="big gold">' + nfmt(creatorLikes) + '</div>' +
      '<div class="meta">'+T('app.likesquarter','likes dit kwartaal, content levert voorrang, korting en gratis diensten op')+'</div>' +
      '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    document.querySelectorAll('#content [data-goto]').forEach(b =>
      b.addEventListener('click', () => openTab(b.dataset.goto)));
    renderContacts();
    renderFoundation();
  }

  // Startpagina voor de gratis gebruiker (zonder pas): betalen bij partners,
  // De Salon bekijken en solliciteren. Geen ledenkaart, reis of betalingen.
  function renderHomeGuest(){
    document.documentElement.setAttribute('data-stem', 'rtg');
    stemKoppen();
    $('#homeGreeting').textContent = stem('Ha, fijn dat je er bent.', '', '') || (T('app.welcome','Welkom,') + '.');
    $('#homeSub').textContent = T('app.guestsub','Gratis, zonder pas');
    $('#codecard').innerHTML =
      '<div class="label">'+T('app.guest.k','Gratis account')+'</div>'+
      '<div class="cn" style="font-size:1.35rem;">'+T('app.guest.title','Zonder pas')+'</div>'+
      '<div style="font-size:0.82rem;color:var(--muted);line-height:1.55;margin-top:0.7rem;">'+T('app.guest.body','Je kunt bij RTG-partners betalen via de app, de foto’s in De Salon bekijken en solliciteren op vacatures met je cv. Liken en reageren bij leden hoort bij een pas.')+'</div>'+
      '<button class="go" data-goto="terplaatse" style="margin-top:0.9rem;">'+T('app.guest.pay','Betaal bij een partner')+' →</button>';
    const trip = $('#homeTrip'); if (trip) trip.style.display='none';
    // de gratis app is een bestel/betaal-app: toon de betaalgeschiedenis
    const pay = $('#homePay'); if (pay){ pay.style.display=''; pay.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div><div class="meta">'+T('app.loading','Laden...')+'</div>'; }
    loadGuestHistory();
    const salon = $('#homeSalon');
    if (salon){ salon.style.display='';
      salon.innerHTML = '<div class="label">'+T('app.thesalon','De Salon')+'</div>'+
        '<div class="big" style="font-size:1.1rem;">'+T('app.guest.salon','Bekijk de foto’s')+'</div>'+
        '<div class="meta" style="margin:.2rem 0 .7rem;">'+T('app.guest.salonsub','Ontdek wat leden en partners delen.')+'</div>'+
        '<button class="go" data-goto="salon">'+T('app.tosalon','Naar De Salon')+' →</button>';
    }
    document.querySelectorAll('#content [data-goto]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto)));
    const fEl = $('#homeFoundation'); if (fEl) fEl.style.display='none';
    const gtab = $('#tabGezin'); if (gtab) gtab.style.display='none';
    // een gratis account (met paspoort) kan vrienden toevoegen en met hen chatten
    if (user.account) loadSocial(); else { const c = $('#homeContacts'); if (c) c.style.display='none'; }
  }
  // Betaalgeschiedenis van de gratis gebruiker: wat is besteld en betaald.
  async function loadGuestHistory(){
    const el = $('#homePay'); if (!el) return;
    let orders = [];
    try { orders = (await API.call('/orders/mine')).orders || []; } catch(e){}
    const betaald = orders.filter(o => o.paid);
    const som = betaald.reduce((s,o) => s + o.total, 0);
    const open = orders.filter(o => !o.paid);
    el.innerHTML = '<div class="label">'+T('app.guest.history','Mijn bestellingen en betalingen')+'</div>'+
      (orders.length
        ? '<div class="big" style="font-size:1.05rem;">'+eur(som)+' <span style="font-size:0.7rem;color:var(--soft);font-weight:400;">'+T('app.guest.paid','betaald')+'</span></div>'+
          '<div class="meta" style="margin:.2rem 0 .6rem;">'+betaald.length+' '+T('app.guest.paidorders','betaalde bestelling(en)')+(open.length?(' · '+open.length+' '+T('app.guest.open','open')):'')+'</div>'+
          '<div style="display:flex;flex-direction:column;gap:.45rem;">'+orders.slice(0,6).map(o=>{
            const kleur = o.paid ? 'var(--green,#4CAF7D)' : 'var(--gold)';
            const st = o.paid ? T('app.guest.ok','betaald') : T('app.guest.te','te betalen');
            return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;font-size:0.78rem;color:var(--muted);">'+
              '<span>'+escT(o.supplierName)+' · '+o.items.reduce((n,i)=>n+i.qty,0)+' '+T('app.items','item(s)')+' · '+timeAgo(o.at)+'</span>'+
              '<span style="flex-shrink:0;white-space:nowrap;">'+eur(o.total)+' · <span style="color:'+kleur+';">'+st+'</span>'+
              (o.paid?'':' <button class="pa" data-guestpay="'+o.ref+'" style="padding:.12rem .5rem;font-size:0.66rem;margin-left:.2rem;">'+T('app.guest.paynow','betaal')+'</button>')+'</span></div>';
          }).join('')+'</div>'
        : '<div class="meta">'+T('app.guest.none','Je hebt nog niets besteld. Betaal bij een partner via Ter plaatse.')+'</div>');
    el.querySelectorAll('[data-guestpay]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/order/pay', { ref: b.dataset.guestpay }); toast(T('app.guest.paid2','Betaald.')); loadGuestHistory(); }
      catch(e){ toast(e.message); }
    }));
  }

  /* ---------- RTFoundation: eigen gezinsruimte voor gekoppelde oppas/opa/oma ---------- */
  function esc(t){ return String(t==null?'':t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function renderFoundation(){
    const homeEl = $('#homeFoundation'), tab = $('#tabGezin'), dot = $('#tabGezinDot');
    if (!user || !user.account){ if(homeEl) homeEl.style.display='none'; if(tab) tab.style.display='none'; return; }
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    const ongelezen = m.filter(x=>!x.gelezen).length;
    if (tab) tab.style.display = g.length ? '' : 'none';
    if (dot) dot.style.display = (g.length && ongelezen) ? 'block' : 'none';
    // compacte ingang op Home
    if (homeEl){
      homeEl.style.display='';
      if (!g.length){
        homeEl.innerHTML = '<div class="label">RTFoundation</div>'+
          '<div class="big" style="font-size:1.05rem;line-height:1.4;">Ben je oppas, opa of oma?</div>'+
          '<div class="meta" style="margin:.3rem 0 .7rem;">Volg een RTFoundation-gezin met je pas, dan krijg je hun meldingen hier op je telefoon, zonder een extra app.</div>'+
          '<button class="go" id="rtfKoppelBtn">Koppel een gezin →</button>';
      } else {
        homeEl.innerHTML = '<div class="label">Je gezinsruimte'+(ongelezen?' · <span style="color:var(--gold)">'+ongelezen+' nieuw</span>':'')+'</div>'+
          '<div class="big" style="font-size:1.05rem;">'+g.map(x=>esc(x.gezinNaam)).join(', ')+'</div>'+
          '<div class="meta" style="margin:.2rem 0 .7rem;">'+(ongelezen? ongelezen+' nieuwe melding'+(ongelezen>1?'en':'') : 'Alles gelezen')+'</div>'+
          '<button class="go" data-goto="gezin">Open je gezinsruimte →</button>';
      }
      const kb = $('#rtfKoppelBtn'); if (kb) kb.addEventListener('click', rtfKoppelStart);
      homeEl.querySelectorAll('[data-goto]').forEach(b=> b.addEventListener('click', ()=> openTab(b.dataset.goto)));
    }
    renderGezin();
  }
  function rtfBerichtHtml(x){
    return '<div style="padding:.55rem .7rem;border:1px solid var(--line);border-radius:12px;margin:.4rem 0;'+(x.gelezen?'':'border-color:var(--burgundy,#C23A5E);')+(x.soort==='hulp'?'background:rgba(194,58,94,.08);':'')+'">'+
      '<div style="font-size:.72rem;color:var(--muted);">'+(x.soort==='hulp'?'🆘 ':(x.soort==='reis'?'✈️ ':''))+esc(x.gezin)+' · '+esc(x.van||'')+'</div>'+
      '<div style="font-size:.92rem;line-height:1.4;margin-top:.15rem;white-space:pre-wrap;">'+esc(x.tekst)+'</div></div>';
  }
  function renderGezin(){
    const fam = $('#gezinFamilies'), feed = $('#gezinFeed'); if (!fam || !feed) return;
    const g = (rtf.gekoppeld || []), m = (rtf.meldingen || []);
    $('#gezinSub').textContent = g.length ? 'De RTFoundation-gezinnen die je als oppas of familie volgt.' : 'Je volgt nog geen gezin.';
    fam.innerHTML = '<div class="label">Gevolgde gezinnen</div>'+
      (g.length ? g.map(x=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><b style="flex:1;">'+esc(x.gezinNaam)+'</b><span class="meta">als '+esc(x.profielNaam)+'</span><button class="go" style="background:transparent;color:var(--muted);padding:.2rem .4rem;" data-los="'+x.code+'|'+x.profielId+'">Ontkoppel</button></div>').join('') : '<div class="meta">Nog geen gezin gekoppeld.</div>')+
      '<div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.9rem;"><button class="go" id="rtfKoppelBtn2">Koppel een gezin →</button><button class="go" id="rtfPushBtn" style="background:transparent;color:var(--muted);">🔔 Meldingen op mijn telefoon</button></div>';
    feed.innerHTML = '<div class="label">Meldingen van het gezin</div>'+
      (m.length ? m.slice(0,30).map(rtfBerichtHtml).join('') : '<div class="meta">Nog geen meldingen. Zodra het gezin iets deelt, zie je het hier en op je telefoon.</div>')+
      (g.length ? '<div style="display:flex;gap:.5rem;margin-top:.8rem;"><input id="rtfReplyIn" placeholder="Antwoord het gezin..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.6rem .8rem;color:var(--txt);"><button class="go" id="rtfReplyBtn">Stuur</button></div>' : '');
    fam.querySelectorAll('[data-los]').forEach(b=> b.addEventListener('click', async ()=>{ const [code,pid]=b.dataset.los.split('|'); if(!confirm('Dit gezin niet meer volgen?')) return; try{ await API.call('/rtf/ontkoppel',{code,profielId:pid}); toast('Ontkoppeld.'); await refreshState(); renderFoundation(); if(!(rtf.gekoppeld||[]).length) openTab('home'); }catch(e){ toast(e.message); } }));
    const kb=$('#rtfKoppelBtn2'); if(kb) kb.addEventListener('click', rtfKoppelStart);
    const pb=$('#rtfPushBtn'); if(pb) pb.addEventListener('click', ()=> ensurePush(true));
    const rb=$('#rtfReplyBtn'); if(rb) rb.addEventListener('click', rtfReply);
    const ri=$('#rtfReplyIn'); if(ri) ri.addEventListener('keydown', e=>{ if(e.key==='Enter') rtfReply(); });
    if (m.filter(x=>!x.gelezen).length) API.call('/rtf/meldingen/gelezen').catch(()=>{});
    if (g.length){ laadGezinInfo(); laadGezinChat(); } else { const gc=$('#gezinChat'); if(gc) gc.style.display='none'; }
  }
  let grtInit=false, grtActief=null;
  async function laadGezinChat(){
    const box=$('#gezinChat'); if(!box) return;
    const g=(rtf.gekoppeld||[]); if(!g.length){ box.style.display='none'; return; }
    box.style.display='';
    let kan; try{ kan=await API.call('/rtf/kanaal',{ code:g[0].code }); }catch(e){ box.innerHTML='<div class="meta">Chat is nu niet beschikbaar.</div>'; return; }
    if (!grtInit && window.GezinRT){ GezinRT.init({ base:'/api/foundation', code:kan.code, token:kan.token, mijnId:kan.profielId, mijnNaam:'ik', leden:kan.leden, onChat:onGrtChat }); grtInit=true; }
    else if (window.GezinRT){ GezinRT.setLeden(kan.leden); }
    let chats=[]; try{ chats=(await GezinRT.chats()).chats||[]; }catch(e){}
    const byId={}; chats.forEach(c=> byId[c.id]=c);
    box.innerHTML='<div class="label">💬 Chat en bellen</div>'+
      '<div class="meta" style="margin-bottom:.4rem;">Bericht of (video)bel het gezin in de app.</div>'+
      kan.leden.map(function(l){ var c=byId[l.id]||{}; return '<div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--line);"><span style="width:2rem;height:2rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;flex-shrink:0;">'+(l.avatar||'🙂')+'</span><div class="grow-min"><b>'+esc(l.naam)+'</b>'+(c.ongelezen?' <span style="color:var(--burgundy);">('+c.ongelezen+')</span>':'')+(c.laatste?'<div class="meta" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+esc(c.laatste)+'</div>':'')+'</div><button class="go" style="padding:.2rem .5rem;" data-chat="'+l.id+'">Chat</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-bel="'+l.id+'">📞</button><button class="go" style="background:transparent;padding:.2rem .4rem;" data-video="'+l.id+'">🎥</button></div>'; }).join('')+
      '<div id="grtThread" style="display:none;margin-top:.7rem;"></div>';
    box.querySelectorAll('[data-chat]').forEach(function(b){ b.onclick=function(){ openGrtThread(b.dataset.chat, kan.leden.find(function(x){return x.id===b.dataset.chat;})); }; });
    box.querySelectorAll('[data-bel]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.bel,false); }; });
    box.querySelectorAll('[data-video]').forEach(function(b){ b.onclick=function(){ GezinRT.bel(b.dataset.video,true); }; });
  }
  function grtMsgHtml(m){ var mij=m.vanMij; var inner = mij ? esc(m.tekst) : '<span class="xlate">'+esc(m.tekst)+'</span>'; return '<div style="align-self:'+(mij?'flex-end':'flex-start')+';max-width:80%;padding:.4rem .7rem;border-radius:12px;'+(mij?'background:var(--gold);color:#1a1710;':'background:var(--card2,#1B1817);border:1px solid var(--line);')+'white-space:pre-wrap;">'+inner+'</div>'; }
  function scrollGrt(){ var m=$('#grtMsgs'); if(m) m.scrollTop=m.scrollHeight; }
  async function openGrtThread(id, lid){
    grtActief=id; var t=$('#grtThread'); t.style.display='';
    var d={berichten:[]}; try{ d=await GezinRT.thread(id); }catch(e){}
    t.innerHTML='<div style="font-weight:600;margin-bottom:.4rem;">Gesprek met '+esc(lid?lid.naam:'')+'</div>'+
      '<div id="grtMsgs" style="max-height:14rem;overflow:auto;display:flex;flex-direction:column;gap:.3rem;">'+(d.berichten||[]).map(grtMsgHtml).join('')+'</div>'+
      '<div style="display:flex;gap:.5rem;margin-top:.5rem;"><input id="grtIn" placeholder="Bericht..." style="flex:1;background:var(--card2,#1B1817);border:1px solid var(--line);border-radius:12px;padding:.5rem .7rem;color:var(--txt);"><button class="go" id="grtStuur">Stuur</button></div>';
    $('#grtStuur').onclick=grtStuur; $('#grtIn').addEventListener('keydown',function(e){ if(e.key==='Enter') grtStuur(); });
    vertaalBubbels($('#grtMsgs'));
    scrollGrt();
  }
  async function grtStuur(){ var inp=$('#grtIn'); if(!inp) return; var t=(inp.value||'').trim(); if(!t||!grtActief) return; inp.value=''; try{ var r=await GezinRT.stuur(grtActief,t); var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:r.bericht.tekst,vanMij:true})); scrollGrt(); } }catch(e){ toast(e.message); } }
  function onGrtChat(m){ if(grtActief && m.van===grtActief){ var el=$('#grtMsgs'); if(el){ el.insertAdjacentHTML('beforeend', grtMsgHtml({tekst:m.tekst,vanMij:false})); vertaalBubbels(el); scrollGrt(); } } }
  const telHref = t => 'tel:' + String(t||'').replace(/[^0-9+]/g,'');
  function geleden(iso){ const s=Math.floor((Date.now()-new Date(iso).getTime())/1000); if(s<60)return 'net nu'; if(s<3600)return Math.floor(s/60)+' min geleden'; if(s<86400)return Math.floor(s/3600)+' uur geleden'; return Math.floor(s/86400)+' dag(en) geleden'; }
  function datumKort(d){ try{ const dt=new Date(d+'T00:00:00'); const vd=new Date(); vd.setHours(0,0,0,0); const mo=new Date(vd); mo.setDate(mo.getDate()+1); if(dt.getTime()===vd.getTime())return 'Vandaag'; if(dt.getTime()===mo.getTime())return 'Morgen'; return dt.toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'}); }catch(e){ return d; } }
  async function laadGezinInfo(){
    const box = $('#gezinInfo'); if(!box) return;
    let d; try{ d = await API.call('/rtf/overzicht'); }catch(e){ box.innerHTML=''; return; }
    box.innerHTML = (d.gezinnen||[]).map(gz=>{
      const o = gz.oppasinfo||{};
      const meerdan1 = (d.gezinnen||[]).length>1;
      let h = '';
      if (meerdan1) h += '<div class="label" style="margin:.4rem 0 .2rem;color:var(--burgundy);">'+esc(gz.gezinNaam)+'</div>';
      // Belangrijke info
      h += '<div class="card"><div class="label">📋 Belangrijke info</div>';
      h += (o.noodcontacten&&o.noodcontacten.length)
        ? '<div style="margin:.2rem 0 .6rem;">'+o.noodcontacten.map(c=>'<a href="'+telHref(c.telefoon)+'" style="display:flex;align-items:center;gap:.5rem;padding:.45rem 0;border-bottom:1px solid var(--line);text-decoration:none;color:var(--txt);"><span>📞</span><b style="flex:1;">'+esc(c.naam||'Contact')+(c.wie?' <span class="meta">· '+esc(c.wie)+'</span>':'')+'</b><span style="color:var(--gold);">'+esc(c.telefoon)+'</span></a>').join('')+'</div>'
        : '';
      h += infoRij('💊 Allergieën en medisch', o.allergie);
      h += infoRij('🍽️ Eten en bedtijden', o.eten);
      h += infoRij('🏠 Huisregels', o.huisregels);
      if (!(o.noodcontacten&&o.noodcontacten.length) && !o.allergie && !o.eten && !o.huisregels) h += '<div class="meta">Het gezin heeft nog geen info ingevuld.</div>';
      h += '<div class="meta" style="margin-top:.6rem;">Bij nood: bel 112.</div></div>';
      // Agenda
      const ag = (gz.agenda||[]).filter(a=>!a.voorbij).slice(0,8);
      h += '<div class="card"><div class="label">📅 Agenda</div>'+
        (ag.length ? ag.map(a=>'<div style="display:flex;gap:.6rem;padding:.4rem 0;border-bottom:1px solid var(--line);"><b style="color:var(--gold);white-space:nowrap;">'+(a.tijd||datumKort(a.datum))+'</b><span style="flex:1;">'+esc(a.titel)+(a.wieNaam?' <span class="meta">· '+esc(a.wieNaam)+'</span>':'')+'<div class="meta">'+datumKort(a.datum)+'</div></span></div>').join('') : '<div class="meta">Niets gepland.</div>')+'</div>';
      // Waar is iedereen
      const loc = (gz.locaties||[]);
      h += '<div class="card"><div class="label">📍 Waar is iedereen</div>'+
        (loc.length ? loc.map(l=>'<div style="display:flex;align-items:center;gap:.6rem;padding:.45rem 0;border-bottom:1px solid var(--line);"><span style="width:1.8rem;height:1.8rem;border-radius:50%;background:'+(l.kleur||'#C9A24B')+';display:flex;align-items:center;justify-content:center;">'+(l.avatar||'🙂')+'</span><div style="flex:1;"><b>'+esc(l.naam)+'</b><div class="meta">'+esc(l.status)+' · '+geleden(l.at)+'</div></div>'+(l.lat!=null?'<a href="https://www.google.com/maps?q='+l.lat+','+l.lon+'" target="_blank" rel="noopener" style="color:var(--gold);white-space:nowrap;">Kaart →</a>':'')+'</div>').join('') : '<div class="meta">Niemand deelt nu iets.</div>')+'</div>';
      return h;
    }).join('');
  }
  function infoRij(titel, tekst){ return tekst ? '<div style="margin-top:.5rem;"><div class="meta" style="font-weight:600;color:var(--txt);">'+esc(titel)+'</div><div style="white-space:pre-wrap;line-height:1.4;font-size:.92rem;">'+esc(tekst)+'</div></div>' : ''; }
  async function rtfReply(){
    const inp=$('#rtfReplyIn'); if(!inp) return; const t=(inp.value||'').trim(); if(!t) return;
    const g=(rtf.gekoppeld||[]); if(!g.length) return;
    try{ await API.call('/rtf/bericht',{ code:g[0].code, tekst:t }); inp.value=''; toast('Verstuurd naar '+g[0].gezinNaam+'.'); }
    catch(e){ toast(e.message); }
  }
  async function rtfKoppelStart(){
    const code = prompt('Vul de gezinscode in die je van het gezin kreeg:');
    if (!code) return;
    try {
      const d = await API.call('/rtf/profielen', { code: code.trim().toUpperCase() });
      const namen = d.profielen.map((p,i)=> (i+1)+'. '+p.naam + (p.gekoppeld?' (al gekoppeld)':'')).join('\n');
      const keuze = prompt('Gezin "'+d.gezinNaam+'". Welk profiel ben jij?\n'+namen+'\n\nTyp het nummer:');
      const idx = parseInt(keuze,10)-1;
      if (isNaN(idx) || !d.profielen[idx]) return;
      const r = await API.call('/rtf/koppel', { code: code.trim().toUpperCase(), profielId: d.profielen[idx].id });
      toast('Gekoppeld aan '+r.gezinNaam+'. Je krijgt hun meldingen nu ook op je telefoon.');
      await refreshState(); renderFoundation(); openTab('gezin');
      ensurePush(true);
    } catch(e){ toast(e.message || 'Koppelen lukte niet.'); }
  }
  // web-push aanzetten voor gezinsmeldingen op de telefoon
  function urlB64ToUint8(base64){
    const pad='='.repeat((4-base64.length%4)%4); const b=(base64+pad).replace(/-/g,'+').replace(/_/g,'/');
    const raw=atob(b); const arr=new Uint8Array(raw.length); for(let i=0;i<raw.length;i++)arr[i]=raw.charCodeAt(i); return arr;
  }
  async function ensurePush(interactief){
    try{
      if (!('serviceWorker' in navigator) || !('PushManager' in window)){ if(interactief) toast('Push wordt op dit toestel niet ondersteund.'); return; }
      const keyRes = await fetch('/api/push/key').then(r=>r.json()).catch(()=>({}));
      if (!keyRes.key){ if(interactief) toast('Meldingen zijn nu niet beschikbaar.'); return; }
      if (interactief || Notification.permission==='default'){
        const perm = await Notification.requestPermission();
        if (perm !== 'granted'){ if(interactief) toast('Zet meldingen aan in je instellingen om ze te ontvangen.'); return; }
      } else if (Notification.permission !== 'granted'){ return; }
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly:true, applicationServerKey: urlB64ToUint8(keyRes.key) });
      await API.call('/push/subscribe', { subscription: sub });
      if (interactief) toast('Top! Gezinsmeldingen komen nu ook op je telefoon binnen.');
    }catch(e){ if(interactief) toast('Meldingen aanzetten lukte niet.'); }
  }

  /* ---------- reizen ---------- */

  function renderTrip(){
    $('#tripSub').textContent = trip.dest + ' · ' + trip.dates + ' · ' + T('app.in','over') + ' ' + trip.days + ' ' + T('app.days','dagen');
    $('#tripList').innerHTML = trip.items.map(it =>
      '<div class="rowitem">' +
        '<div class="t"><b>' + it.title + '</b><span>' + it.when + ' · ' + it.sub + '</span></div>' +
        '<span class="pill ' + (it.status === 'paid' ? 'paid' : it.status === 'req' ? 'req' : 'open') + '">' + tLbl(it.label) + '</span>' +
      '</div>').join('');
    renderAgenda();
  }

  /* de reisagenda: alles met een datum (tafels, tickets, ritten, events)
     automatisch samengevoegd tot een dagprogramma onder de reis */
  const AGENDA_ICO = { reservering: '🪑', ticket: '🎟', boeking: '🗓', rit: '🚗', event: '🎉' };
  async function renderAgenda(){
    if (!API.live) return;
    let wrap = $('#agendaWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'agendaWrap';
      $('#tripList').insertAdjacentElement('afterend', wrap);
    }
    let dagen = [];
    try { dagen = (await API.call('/agenda/mijn')).dagen || []; } catch(e){ return; }
    if (!dagen.length){ wrap.innerHTML = ''; return; }
    const dagNaam = d => new Date(d + 'T12:00:00').toLocaleDateString(lang() === 'en' ? 'en-GB' : 'nl-NL', { weekday: 'long', day: 'numeric', month: 'long' });
    wrap.innerHTML = '<div class="sec-label" style="margin-top:1.2rem;">📅 ' + T('erv.agenda','Mijn programma') + '</div>' +
      dagen.map(d =>
        '<div style="font-size:0.68rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--gold);margin:0.7rem 0 0.35rem;">' + dagNaam(d.datum) + '</div>' +
        d.items.map(it =>
          '<div class="rowitem"><div class="t"><b>' + (AGENDA_ICO[it.soort] || '·') + ' ' + it.titel + '</b><span>' + (it.tijd || T('erv.heledag','hele dag')) + ' · ' + tStatus(it.status) + '</span></div></div>'
        ).join('')
      ).join('');
  }


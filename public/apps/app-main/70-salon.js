  /* ---------- salon ---------- */

  // De publieke Salon-etalage van een partner: bio, foto's, folders, deals, polls
  async function openEtalage(code){
    let d;
    try { d = await API.call('/salon/profiel', { code }); } catch(e){ toast(e.message); return; }
    const p = d.partner;
    await laadBetaalVerzoeken();
    const vz = betaalVerzoeken.filter(v => v.supplierCode === code);
    const kanBetalen = user && user.tier !== 'guest';
    let ov = document.getElementById('etalage-ov');
    if (!ov){ ov = document.createElement('div'); ov.id = 'etalage-ov';
      ov.style.cssText = 'position:fixed;inset:0;z-index:120;background:rgba(0,0,0,0.55);display:flex;align-items:flex-end;justify-content:center;';
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    }
    const eur2 = n => '€ ' + Number(n||0).toLocaleString('nl-NL');
    const items = d.items || [];
    const html =
      '<div style="width:100%;max-width:560px;max-height:88vh;overflow-y:auto;background:var(--bg);border-radius:20px 20px 0 0;border:1px solid var(--line);">' +
      '<div style="position:relative;">' +
        (p.foto ? '<img src="' + p.foto + '" alt="" style="width:100%;height:150px;object-fit:cover;border-radius:20px 20px 0 0;">' : '<div style="height:80px;"></div>') +
        '<button id="etaClose" style="position:absolute;top:0.7rem;right:0.7rem;background:rgba(0,0,0,0.5);color:#fff;border:none;border-radius:999px;width:34px;height:34px;font-size:1rem;cursor:pointer;">✕</button>' +
      '</div>' +
      '<div style="padding:1rem 1.1rem 1.4rem;">' +
        '<div style="display:flex;align-items:center;gap:0.6rem;"><b style="font-size:1.1rem;font-family:\'Bodoni Moda\',serif;">' + escT(p.name) + '</b>' +
          '<button id="etaVolg" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.3rem 0.9rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button></div>' +
        '<div style="font-size:0.74rem;color:var(--soft);margin-top:0.2rem;">' + (p.icon ? p.icon + ' ' : '') + escT(p.typeLabel || '') + ' · ' + escT(p.city || '') + ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') + '</div>' +
        (p.bio ? '<div style="font-size:0.86rem;margin-top:0.6rem;line-height:1.5;">' + escT(p.bio) + '</div>' : '') +
        (kanBetalen ? '<button id="etaBetaal" class="mo-pay" style="width:100%;justify-content:center;margin-top:0.8rem;padding:0.7rem;">' + FID_MINI + T('dp.betaaldirect','Betaal direct met Face ID') + '</button>' : '') +
        (vz.length ? '<div style="margin-top:0.8rem;">' + vz.map(v =>
          '<div style="border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.5rem;background:var(--card);">' +
          '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + FID_MINI + T('dp.verzoek','Betaalverzoek') + '</div>' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.3rem;"><span style="font-size:0.85rem;">' + escT(v.omschrijving || '') + '</span><b style="color:var(--gold);white-space:nowrap;">' + eur2((v.bedrag||0)/100) + '</b></div>' +
          '<button class="mo-pay js-vzpay" data-vz="' + v.ref + '" style="width:100%;justify-content:center;margin-top:0.5rem;padding:0.6rem;">' + FID_MINI + T('dp.betaalverzoek','Betaal dit verzoek') + '</button></div>').join('') + '</div>' : '') +
        (items.length
          ? items.map(it =>
            '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;margin-top:0.7rem;">' +
            '<div style="font-size:0.58rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--gold);">' + (it.soort === 'folder' ? '📖 ' + T('sal.folder','Folder') : it.soort === 'deal' ? '🎁 ' + T('sal.deal','Aanbieding') : it.soort === 'poll' ? '📊 Poll' : '📣 ' + T('sal.bericht','Bericht')) + '</div>' +
            (it.folder ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.folder.titel) + '</div>' +
              ((it.folder.fotos && it.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.45rem;">' + it.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:90px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
              ((it.folder.items && it.folder.items.length) ? '<div style="margin-top:0.45rem;display:grid;gap:0.2rem;">' + it.folder.items.map(x => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(x.naam) + '</span>' + (x.prijs != null ? '<span style="color:var(--gold);">' + eur2(x.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '')
              : (it.deal ? '<div style="font-weight:600;margin-top:0.2rem;">' + escT(it.deal.titel) + (it.deal.mijnCode ? ' · <span style="color:var(--gold);">' + it.deal.mijnCode + '</span>' : '') + '</div>'
              : '<div style="font-size:0.85rem;margin-top:0.2rem;">' + escT(it.text || '') + '</div>')) +
            '</div>').join('')
          : '<div style="text-align:center;color:var(--soft);font-size:0.82rem;padding:1.4rem 0;">' + T('sal.etaleeg','Nog geen folders of aanbiedingen.') + '</div>') +
      '</div></div>';
    ov.innerHTML = html;
    ov.querySelector('#etaClose').addEventListener('click', () => ov.remove());
    ov.querySelector('#etaVolg').addEventListener('click', async () => {
      try { await API.call('/salon/volg', { code }); await refreshState(); renderSalon(); openEtalage(code); } catch(e){ toast(e.message); }
    });
    const eb = ov.querySelector('#etaBetaal');
    if (eb) eb.addEventListener('click', () => { ov.remove(); betaalPartner(code, p.name, { bron: 'salon' }); });
    ov.querySelectorAll('.js-vzpay').forEach(b => b.addEventListener('click', () => {
      const v = vz.find(x => x.ref === b.dataset.vz); if (!v) return;
      ov.remove(); betaalVerzoekPay(v);
    }));
  }

  function renderSalon(){
    const isGuest = user && user.tier === 'guest';
    // RTG Zakelijk: de ingang staat aan voor de Lifestyle en Business Pass
    const zakL = $('#zakLauncher');
    if (user && (user.tier === 'business' || user.tier === 'lifestyle')){
      zakL.style.display = 'block';
      zakL.innerHTML = '<button id="zakOpenBtn" style="display:flex;align-items:center;gap:0.7rem;width:100%;text-align:left;background:none;border:1px solid var(--gold);border-radius:14px;padding:0.75rem 1rem;margin-bottom:0.8rem;color:var(--txt);font-family:inherit;cursor:pointer;">' +
        '<span style="font-size:1.2rem;">💼</span><span style="flex:1;"><b style="font-size:0.85rem;">' + T('zak.h','RTG Zakelijk') + '</b>' +
        '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('zak.launch','Uw professionele netwerk: profiel, gids, feed en aanbevelingen.') + '</span></span>' +
        '<span style="color:var(--gold);">›</span></button>';
      $('#zakOpenBtn').addEventListener('click', zakOpen);
    } else { zakL.style.display = 'none'; }
    $('#feed').innerHTML = posts.map(p => {
      const engage = canEngage(p);
      // gratis gebruikers (zonder pas) liken/reageren niet bij particulieren
      const mayLike = !(isGuest && !p.partner);
      const visual = p.photo
        ? '<div class="visual"><img src="' + p.photo + '" alt=""><span class="place">' + escT(p.place) + '</span></div>'
        : '<div class="visual ' + (p.visual || 'v-partner') + '"><span class="place">' + escT(p.place) + '</span></div>';
      // partners posten zonder wachttijd: hun bericht staat er direct, met
      // tijdstempel; de 7-dagen-privacyregel geldt alleen voor ledenposts
      const meta = p.partner
        ? TIER_LABEL.partner + ' · ' + p.place + ' · ' + (p.at ? timeAgo(p.at) : T('app.salon.direct','direct geplaatst'))
        : TIER_LABEL[p.tier] + ' · ' + p.place + ' · ' + T('app.salon.7days','7 dagen na verblijf');
      // bedrijfslaag: volg-knop, exclusieve aanbieding en poll
      const volg = p.partnerCode
        ? '<button class="js-volg" data-code="' + p.partnerCode + '" style="margin-left:auto;background:' + (p.volgIk ? 'var(--gold)' : 'none') + ';color:' + (p.volgIk ? '#000' : 'var(--gold)') + ';border:1px solid var(--gold);border-radius:999px;padding:0.25rem 0.75rem;font-size:0.66rem;font-weight:600;font-family:inherit;flex-shrink:0;cursor:pointer;">' + (p.volgIk ? '✓ ' + T('sal.volgt','Volgt') : '+ ' + T('sal.volg','Volg')) + '</button>'
        : '';
      const deal = p.deal
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">🎁 ' + T('sal.deal','Exclusief voor leden') + (p.deal.geldigTot ? ' · t/m ' + p.deal.geldigTot : '') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + p.deal.titel + '</div>' +
          (p.deal.mijnCode
            ? '<div style="margin-top:0.45rem;font-size:0.8rem;color:var(--gold);letter-spacing:0.08em;">' + T('sal.uwcode','Uw code') + ': <b>' + p.deal.mijnCode + '</b> <span style="color:var(--soft);font-size:0.68rem;">· ' + T('sal.toon','toon aan de kassa') + '</span></div>'
            : '<button class="js-claim" style="margin-top:0.5rem;background:var(--knop);color:var(--knop-txt);border:none;border-radius:999px;padding:0.45rem 0.95rem;font-size:0.72rem;font-weight:600;font-family:inherit;cursor:pointer;">' + T('sal.claim','Claim deze aanbieding') + '</button>') +
          '<div style="margin-top:0.35rem;font-size:0.62rem;color:var(--soft);">' + p.deal.claims + ' ' + T('sal.geclaimd','keer geclaimd') + '</div></div>'
        : '';
      const poll = p.poll
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📊 ' + T('sal.poll','Poll') + ' · ' + p.poll.totaal + ' ' + T('sal.stemmen','stem(men)') + '</div>' +
          p.poll.opties.map((o, i) => {
            const pct = p.poll.totaal ? Math.round(o.stemmen / p.poll.totaal * 100) : 0;
            return p.poll.gestemd
              ? '<div style="margin-top:0.45rem;"><div style="display:flex;justify-content:space-between;font-size:0.76rem;"><span>' + (o.mijn ? '✓ ' : '') + o.tekst + '</span><span style="color:var(--soft);">' + pct + '%</span></div>' +
                '<div style="height:4px;border-radius:99px;background:rgba(255,255,255,0.08);margin-top:0.25rem;overflow:hidden;"><i style="display:block;height:100%;width:' + pct + '%;background:' + (o.mijn ? 'var(--gold)' : 'var(--soft)') + ';border-radius:99px;"></i></div></div>'
              : '<button class="js-stem" data-optie="' + i + '" style="display:block;width:100%;margin-top:0.45rem;background:none;border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.7rem;color:var(--txt);font-size:0.78rem;font-family:inherit;text-align:left;cursor:pointer;">' + o.tekst + '</button>';
          }).join('') + '</div>'
        : '';
      const folder = p.folder
        ? '<div style="margin:0.6rem 1.1rem 0;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;">' +
          '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">📖 ' + T('sal.folder','Folder') + '</div>' +
          '<div style="font-weight:600;font-size:0.9rem;margin-top:0.25rem;">' + escT(p.folder.titel) + '</div>' +
          ((p.folder.fotos && p.folder.fotos.length) ? '<div style="display:flex;gap:0.4rem;overflow-x:auto;margin-top:0.5rem;">' + p.folder.fotos.map(f => '<img src="' + f + '" alt="" style="height:96px;border-radius:8px;flex-shrink:0;">').join('') + '</div>' : '') +
          ((p.folder.items && p.folder.items.length) ? '<div style="margin-top:0.5rem;display:grid;gap:0.2rem;">' + p.folder.items.slice(0, 12).map(it => '<div style="display:flex;justify-content:space-between;font-size:0.8rem;"><span>' + escT(it.naam) + (it.tekst ? ' <span style="color:var(--soft);">· ' + escT(it.tekst) + '</span>' : '') + '</span>' + (it.prijs != null ? '<span style="color:var(--gold);white-space:nowrap;">' + eur(it.prijs) + '</span>' : '') + '</div>').join('') + '</div>' : '') +
          '</div>'
        : '';
      const etalageBtn = p.partnerCode
        ? '<button class="pa js-etalage" data-code="' + p.partnerCode + '" title="' + T('sal.etalage','Etalage') + '">🏬 ' + T('sal.etalage','Etalage') + '</button>'
        : '';
      return '<article class="post" data-post="' + p.id + '">' +
        '<div class="head">' +
          '<div class="avatar a-' + p.tier + '">' + escT((p.author || ' ')[0]) + '</div>' +
          '<div><b>' + escT(p.author) + (p.partner ? '<span class="partner-badge">' + T('app.partner','Partner') + '</span>' : '') + '</b><span>' + escT(meta) + (p.partnerCode && p.volgers != null ? ' · ' + p.volgers + ' ' + T('sal.volgers','volgers') : '') + '</span></div>' +
          volg +
        '</div>' +
        visual +
        '<div class="body">' + msgHTML(p.text, p.lang) + '</div>' +
        folder + deal + poll +
        '<div class="acts">' +
          '<button class="pa js-like' + (p.liked ? ' liked' : '') + '"' + (mayLike ? '' : ' disabled') + '>♥ <span class="lc">' + p.likes + '</span></button>' +
          '<button class="pa js-comm"' + (engage ? '' : ' disabled') + '>' + T('app.salon.comment','Reageren') + ' (' + p.comments.length + ')</button>' +
          etalageBtn +
          '<button class="pa js-share" title="' + T('sal.deel','Delen met een connectie') + '">↗</button>' +
        '</div>' +
        '<div class="comments">' +
          '<div class="clist">' + p.comments.map(c => '<div class="comment"><b>' + escT(c.who) + '</b>, ' + msgHTML(c.text, c.lang) + '</div>').join('') + '</div>' +
          '<div class="cform"><input placeholder="' + T('app.salon.write','Schrijf een reactie…') + '"><button>' + T('app.salon.post','Plaats') + '</button></div>' +
        '</div>' +
      '</article>';
    }).join('');
    hydrateMsgs($('#feed'));

    document.querySelectorAll('.post').forEach(el => {
      const post = posts.find(p => p.id === Number(el.dataset.post));
      el.querySelector('.js-like').addEventListener('click', ev => {
        // zonder pas kun je berichten van leden wel zien, maar niet liken
        if (user && user.tier === 'guest' && !post.partner){ toast(T('sal.guestlike','Zonder pas bekijk je de Salon; liken en reageren bij leden is voor leden.')); return; }
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        ev.currentTarget.classList.toggle('liked', post.liked);
        el.querySelector('.lc').textContent = post.likes;
        if (API.live) API.call('/like', {postId: post.id, liked: post.liked}).catch(() => {});
      });
      const shareBtn = el.querySelector('.js-share');
      if (shareBtn) shareBtn.addEventListener('click', () => openShare(post.id));
      const volgBtn = el.querySelector('.js-volg');
      if (volgBtn) volgBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/volg', { code: volgBtn.dataset.code });
          toast(d.volgIk ? '✦ ' + T('sal.volgok','U volgt') + ' ' + post.author + '.' : T('sal.ontvolgd','Niet meer gevolgd.'));
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const claimBtn = el.querySelector('.js-claim');
      if (claimBtn) claimBtn.addEventListener('click', async () => {
        try {
          const d = await API.call('/salon/deal/claim', { postId: post.id });
          toast('🎁 ' + T('sal.claimok','Geclaimd. Uw code:') + ' ' + d.code);
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      });
      const etaBtn = el.querySelector('.js-etalage');
      if (etaBtn) etaBtn.addEventListener('click', () => openEtalage(etaBtn.dataset.code));
      el.querySelectorAll('.js-stem').forEach(sb => sb.addEventListener('click', async () => {
        try {
          await API.call('/salon/poll/stem', { postId: post.id, optie: Number(sb.dataset.optie) });
          await refreshState();
          renderSalon();
        } catch(e){ toast(e.message); }
      }));
      const commBtn = el.querySelector('.js-comm');
      commBtn.addEventListener('click', () => {
        if (commBtn.disabled) return;
        el.querySelector('.comments').classList.toggle('open');
      });
      el.querySelectorAll('.pa:disabled').forEach(b => {
        b.style.pointerEvents = 'auto';
        b.addEventListener('click', e => {
          e.preventDefault();
          toast(user.tier === 'rtg'
            ? T('app.salon.rtgnote','Met de RTG Pass reageert u met RTG-leden, of met wie u eerst aanspreekt.')
            : T('app.salon.nocomment','Reageren is hier niet beschikbaar.'));
        });
      });
      el.querySelector('.cform button').addEventListener('click', async () => {
        const inp = el.querySelector('.cform input');
        if (!inp.value.trim()) return;
        if (API.live){
          try { await API.call('/comment', {postId: post.id, text: inp.value.trim()}); }
          catch (e) { toast(e.message || T('app.salon.notallowed','Reageren niet toegestaan.')); return; }
        }
        post.comments.push({who: user.full, tier: user.tier, text: inp.value.trim()});
        const d = document.createElement('div');
        d.className = 'comment';
        d.innerHTML = '<b>' + user.full + '</b>, ' + inp.value.trim().replace(/</g, '&lt;');
        el.querySelector('.clist').appendChild(d);
        inp.value = '';
        commBtn.textContent = T('app.salon.comment','Reageren') + ' (' + post.comments.length + ')';
        toast(T('app.salon.posted','Reactie geplaatst.'));
      });
    });
  }

  /* ================= Salon-ontmoetingen (wederzijdse connecties in de buurt) =
     Elk lid zet dit zelf aan/uit. Aan: de app stuurt af en toe de positie mee;
     een verbonden vriend die ook aanstaat en vlakbij is levert een voorstel op.
     Beiden kiezen een activiteit (of niets = afwijzen); bij een match tekenen ze
     een veiligheidscontract, waarna RTG-kantoor live meekijkt tot het klaar is.
     Bij een SOS gaat de camera aan en kijkt kantoor mee (WebRTC). */
  let ontmoetState = null, ontmoetTimer = null, ontmoetSosPc = null, ontmoetSosDate = null, ontmoetPending = null;

  async function laadOntmoet(){
    const el = $('#ontmoetPaneel'); if (!el) return;
    if (!API.live || !user || !user.account){ el.style.display = 'none'; stopOntmoetTimer(); return; }
    try { ontmoetState = await API.call('/ontmoeten/state'); }
    catch(e){ el.style.display = 'none'; return; }
    renderOntmoet();
    beheerOntmoetTimer();
  }
  function stopOntmoetTimer(){ if (ontmoetTimer){ clearInterval(ontmoetTimer); ontmoetTimer = null; } }
  // terwijl de functie aanstaat (of er een afspraak loopt) periodiek de positie sturen
  function beheerOntmoetTimer(){
    const s = ontmoetState;
    const loopt = s && (s.aan || (s.dates && s.dates.some(d => d.status === 'actief' || d.status === 'noodgeval')));
    if (loopt && !ontmoetTimer){ ontmoetTick(); ontmoetTimer = setInterval(ontmoetTick, 20000); }
    else if (!loopt) stopOntmoetTimer();
  }
  function ontmoetPositie(){
    return new Promise(res => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(p => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { maximumAge: 15000, timeout: 8000 });
    });
  }
  async function ontmoetTick(){
    const s = ontmoetState; if (!s) return;
    const pos = await ontmoetPositie();
    try {
      if (s.aan){ const r = await API.call('/ontmoeten/hier', pos || {}); ontmoetState = r.state; renderOntmoet(); }
      // live-positie voor lopende afspraken naar kantoor
      for (const d of (ontmoetState.dates || [])) if (d.status === 'actief' || d.status === 'noodgeval'){
        try { await API.call('/ontmoeten/hier-date', { dateId: d.id, lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined }); } catch(e){}
      }
    } catch(e){}
  }

  function ontmoetActBtns(voorstelId){
    return (ontmoetState.activiteiten || []).map(a =>
      '<button class="js-oa" data-v="' + voorstelId + '" data-a="' + a.id + '" style="flex:1;min-width:5.5rem;background:none;border:1px solid var(--gold);border-radius:12px;padding:0.6rem 0.4rem;color:var(--txt);font-family:inherit;cursor:pointer;text-align:center;">' +
      '<span style="font-size:1.3rem;display:block;">' + a.icon + '</span><b style="font-size:0.78rem;">' + escT(a.label) + '</b>' +
      '<span style="display:block;font-size:0.6rem;color:var(--muted);">' + escT(a.tekst) + '</span></button>').join('');
  }
  function renderOntmoet(){
    const el = $('#ontmoetPaneel'); const s = ontmoetState;
    if (!s){ el.style.display = 'none'; return; }
    el.style.display = 'block';
    const kaart = (inner) => '<div style="border:1px solid var(--line);border-radius:16px;padding:0.9rem 1rem;margin-bottom:0.8rem;background:rgba(255,255,255,0.02);">' + inner + '</div>';
    let h = '';
    // kop met aan/uit
    const uit = !s.aan;
    h += '<div style="display:flex;align-items:flex-start;gap:0.7rem;">' +
      '<span style="font-size:1.3rem;">🌟</span>' +
      '<div style="flex:1;"><b style="font-size:0.9rem;">' + T('ont.titel','Ontmoetingen') + '</b>' +
      '<span style="display:block;font-size:0.68rem;color:var(--muted);">' + T('ont.sub','Connecties die vlakbij zijn kunnen samen afspreken. Alleen jij bepaalt of dit aanstaat.') + '</span></div>' +
      (s.mag
        ? '<button id="ontToggle" role="switch" aria-checked="' + (s.aan ? 'true' : 'false') + '" style="flex-shrink:0;width:52px;height:30px;border-radius:999px;border:1px solid var(--gold);background:' + (s.aan ? 'var(--gold)' : 'none') + ';position:relative;cursor:pointer;" aria-label="' + T('ont.toggle','Ontmoetingen aan of uit') + '"><span style="position:absolute;top:3px;left:' + (s.aan ? '25px' : '3px') + ';width:22px;height:22px;border-radius:50%;background:' + (s.aan ? '#000' : 'var(--gold)') + ';transition:left .15s;"></span></button>'
        : '') +
      '</div>';
    if (!s.mag){
      h += '<div style="margin-top:0.6rem;font-size:0.72rem;color:var(--soft);border-top:1px solid var(--line);padding-top:0.6rem;">🔒 ' + escT(s.reden || T('ont.magniet','Nog niet beschikbaar.')) + '</div>';
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    if (uit){
      el.innerHTML = kaart(h);
      bindOntmoet();
      return;
    }
    // lopende afspraken (tekenen / actief / noodgeval)
    let blokken = '';
    for (const d of (s.dates || [])){
      const metNaam = escT(d.met);
      if (d.status === 'wacht-op-tekenen'){
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
          '<b style="font-size:0.82rem;">' + d.icon + ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.66rem;color:var(--muted);margin:0.3rem 0;">' + T('ont.tekenuitleg','Teken het veiligheidscontract om te starten. RTG-kantoor kijkt dan mee voor jullie veiligheid.') + '</div>' +
          '<pre style="white-space:pre-wrap;font-family:inherit;font-size:0.64rem;color:var(--soft);background:rgba(0,0,0,0.15);border-radius:10px;padding:0.6rem;max-height:8rem;overflow:auto;">' + escT(d.contract) + '</pre>' +
          '<div style="display:flex;gap:0.5rem;margin-top:0.5rem;">' +
          (d.ikTekende
            ? '<span style="flex:1;font-size:0.72rem;color:var(--gold);align-self:center;">✓ ' + T('ont.jijtekende','Jij tekende. ') + (d.anderTekende ? '' : T('ont.wachtander','Wachten op ') + metNaam) + '</span>'
            : '<button class="js-oteken" data-d="' + d.id + '" style="flex:1;background:var(--gold);color:#000;border:none;border-radius:999px;padding:0.55rem;font-weight:600;font-family:inherit;cursor:pointer;">✍️ ' + T('ont.teken','Contract tekenen') + '</button>') +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.55rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">' + T('ont.annuleer','Annuleren') + '</button>' +
          '</div></div>';
      } else if (d.status === 'actief' || d.status === 'noodgeval'){
        const nood = d.status === 'noodgeval';
        blokken += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;' + (nood ? 'background:rgba(220,40,40,0.08);border-radius:10px;padding:0.7rem;' : '') + '">' +
          '<b style="font-size:0.82rem;">' + d.icon + ' ' + escT(d.activiteitLabel) + ' ' + T('ont.met','met') + ' ' + metNaam + '</b>' +
          '<div style="font-size:0.64rem;color:var(--muted);margin:0.25rem 0 0.5rem;">🛰️ ' + T('ont.kijktmee','RTG-kantoor kijkt live mee voor jullie veiligheid, tot jullie afronden.') + '</div>' +
          (nood ? '<div style="font-size:0.72rem;color:#ff8a8a;font-weight:600;margin-bottom:0.4rem;">🚨 ' + T('ont.noodloopt','Noodsignaal actief. Kantoor kijkt mee via je camera.') + '</div>' : '') +
          '<div style="display:flex;gap:0.5rem;">' +
          '<button class="js-osos" data-d="' + d.id + '" style="flex:1;background:#c62828;color:#fff;border:none;border-radius:999px;padding:0.6rem;font-weight:700;font-family:inherit;cursor:pointer;">🚨 ' + T('ont.sos','SOS') + '</button>' +
          '<button class="js-ostop" data-d="' + d.id + '" style="background:none;border:1px solid var(--line);border-radius:999px;padding:0.6rem 0.8rem;color:var(--soft);font-family:inherit;cursor:pointer;">🏁 ' + T('ont.afronden','Afronden') + '</button>' +
          '</div></div>';
      }
    }
    // open voorstellen
    let voors = '';
    for (const v of (s.voorstellen || [])){
      const metNaam = escT(v.met);
      voors += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.7rem;">' +
        '<b style="font-size:0.82rem;">📍 ' + metNaam + ' ' + T('ont.indebuurt','is in de buurt') + '</b>';
      if (v.mijnKeuze){
        voors += '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.35rem;">✓ ' + T('ont.jijkoos','Jij koos') + ' ' + escT((s.activiteiten.find(a => a.id === v.mijnKeuze) || {}).label || v.mijnKeuze) + '. ' + T('ont.wachtkeuze','Wachten op de keuze van ') + metNaam + '.</div>';
      } else {
        voors += '<div style="font-size:0.66rem;color:var(--muted);margin:0.3rem 0;">' + T('ont.kiessamen','Kies samen. Niets doen betekent afwijzen.') + '</div>' +
          '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">' + ontmoetActBtns(v.id) + '</div>' +
          '<button class="js-oweiger" data-v="' + v.id + '" style="margin-top:0.4rem;background:none;border:none;color:var(--soft);font-size:0.68rem;font-family:inherit;cursor:pointer;text-decoration:underline;">' + T('ont.nietnu','Niet nu') + '</button>';
      }
      voors += '</div>';
    }
    if (!blokken && !voors) h += '<div style="margin-top:0.6rem;font-size:0.68rem;color:var(--muted);border-top:1px solid var(--line);padding-top:0.6rem;">' + T('ont.aanuitleg','Staat aan. Zodra een connectie vlakbij is, verschijnt hier een voorstel.') + '</div>';
    el.innerHTML = kaart(h + blokken + voors);
    bindOntmoet();
  }
  function bindOntmoet(){
    const el = $('#ontmoetPaneel');
    const tg = el.querySelector('#ontToggle');
    if (tg) tg.addEventListener('click', async () => {
      const aan = !(ontmoetState && ontmoetState.aan);
      try { const r = await API.call('/ontmoeten/aan', { aan }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('.js-oa').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, b.dataset.a)));
    el.querySelectorAll('.js-oweiger').forEach(b => b.addEventListener('click', () => ontmoetKies(b.dataset.v, 'afwijzen')));
    el.querySelectorAll('.js-oteken').forEach(b => b.addEventListener('click', () => ontmoetTeken(b.dataset.d)));
    el.querySelectorAll('.js-ostop').forEach(b => b.addEventListener('click', () => ontmoetStop(b.dataset.d)));
    el.querySelectorAll('.js-osos').forEach(b => b.addEventListener('click', () => ontmoetSos(b.dataset.d)));
  }
  async function ontmoetKies(voorstelId, keuze){
    try { const r = await API.call('/ontmoeten/kies', { voorstelId, keuze }); ontmoetState = r.state;
      if (r.status === 'gematcht') toast('🎉 ' + T('ont.match','Match! Teken het contract om te starten.'));
      renderOntmoet();
    } catch(e){ toast(e.message); }
  }
  async function ontmoetTeken(dateId){
    if (!confirm(T('ont.tekenbevestig','Ik ben 18+ met een geverifieerd paspoort en ga akkoord met het veiligheidscontract: RTG-kantoor mag mijn live-locatie zien tot de afspraak klaar is, en bij SOS meekijken via de camera en 112 bellen.'))) return;
    try { const r = await API.call('/ontmoeten/teken', { dateId }); ontmoetState = r.state; renderOntmoet(); beheerOntmoetTimer();
      if (r.status === 'actief') toast('✅ ' + T('ont.gestart','Afspraak gestart. RTG kijkt mee voor jullie veiligheid.'));
    } catch(e){ toast(e.message); }
  }
  async function ontmoetStop(dateId){
    try { const r = await API.call('/ontmoeten/stop', { dateId }); ontmoetState = r.state; ontmoetSosStop(); renderOntmoet(); beheerOntmoetTimer(); }
    catch(e){ toast(e.message); }
  }
  async function ontmoetSos(dateId){
    const pos = await ontmoetPositie();
    try {
      await API.call('/ontmoeten/sos', { dateId, bericht: T('ont.sosbericht','Ik voel me niet veilig'), lat: pos ? pos.lat : undefined, lng: pos ? pos.lng : undefined });
      toast('🚨 ' + T('ont.sosverstuurd','SOS verstuurd. RTG-kantoor is gewaarschuwd en kijkt mee.'));
      ontmoetSosLive(dateId);         // camera + microfoon naar kantoor
      try { window.location.href = 'tel:112'; } catch(e){}   // en direct de hulpdiensten
      await laadOntmoet();
    } catch(e){ toast(e.message); }
  }
  // WebRTC: stuur camera + microfoon naar RTG-kantoor (kantoor beantwoordt via SSE)
  async function ontmoetSosLive(dateId){
    if (ontmoetSosPc) return;
    try {
      await haalIce();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: 'environment' } });
      const pc = new RTCPeerConnection({ iceServers: iceConfig || [{ urls: 'stun:stun.l.google.com:19302' }] });
      ontmoetSosPc = pc; ontmoetSosDate = dateId;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      pc.onicecandidate = e => { if (e.candidate) API.call('/ontmoeten/signaal', { dateId, payload: { ice: e.candidate } }).catch(() => {}); };
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await API.call('/ontmoeten/signaal', { dateId, payload: { sdp: pc.localDescription } });
    } catch(e){ /* camera geweigerd of niet beschikbaar: de SOS zelf is al binnen */ }
  }
  function ontmoetSosStop(){
    if (ontmoetSosPc){ try { ontmoetSosPc.getSenders().forEach(s => s.track && s.track.stop()); ontmoetSosPc.close(); } catch(e){} ontmoetSosPc = null; ontmoetSosDate = null; }
  }
  // antwoord van RTG-kantoor op ons SOS-beeld (WebRTC-signaal)
  async function opOntmoetSignaal(d){
    if (!ontmoetSosPc || !d || d.dateId !== ontmoetSosDate || !d.payload) return;
    try {
      if (d.payload.sdp) await ontmoetSosPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      else if (d.payload.ice) await ontmoetSosPc.addIceCandidate(new RTCIceCandidate(d.payload.ice));
    } catch(e){}
  }

  /* ---------- taal gewijzigd: dynamische schermen opnieuw opbouwen ---------- */
  window.addEventListener('rtglang', async () => {
    if (!user) return;
    const active = (document.querySelector('.tabbar button.active') || {}).dataset;
    const tab = active ? active.tab : 'home';
    // inhoud opnieuw ophalen in de nieuwe taal (facturen, reis, menu's)
    if (API.live){ try { applyState((await API.call('/state')).state); } catch (e) {} }
    renderAll();
    renderBell();
    openTab(tab);
  });

  /* ---------- PWA ---------- */

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')){
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) logoutBtn.addEventListener('click', doLogout);

  /* ---------- AVG: inzage en vergetelheid ---------- */
  const privExport = document.getElementById('privExport');
  if (privExport) privExport.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    try {
      const data = await API.call('/privacy/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'rtg-mijn-gegevens.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(T('app.priv.exported','Uw gegevens zijn gedownload als JSON.'));
    } catch(e){ toast(e.message); }
  });
  const privDelete = document.getElementById('privDelete');
  if (privDelete) privDelete.addEventListener('click', async () => {
    if (!API.live){ toast(T('app.priv.needlogin','Log eerst in.')); return; }
    if (!confirm(T('app.priv.confirm','Weet u het zeker? Dit wist uw cv, chats, likes en locatie definitief en logt u overal uit.'))) return;
    try {
      await API.call('/privacy/delete');
      try { localStorage.removeItem('rtg_member_token'); } catch(e2){}
      location.reload();
    } catch(e){ toast(e.message); }
  });

  restoreSession();
})();

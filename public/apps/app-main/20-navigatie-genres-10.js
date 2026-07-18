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


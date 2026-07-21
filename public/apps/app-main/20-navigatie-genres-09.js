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
    // "De rekening": achteraf-lopende bonnen per zaak, om na het eten in een keer
    // te voldoen (aan-de-balie-bonnen tellen niet mee: die gaan langs de kassa)
    const rekBij = {};
    active.filter(o => !o.paid && o.betaalMoment === 'achteraf' && !o.aanBalie).forEach(o => {
      const r = rekBij[o.supplierCode] = rekBij[o.supplierCode] || { naam: o.supplierName, tafel: '', n: 0, som: 0 };
      r.n++; r.som += o.total || 0; if (o.table && !r.tafel) r.tafel = o.table;
    });
    const rekLijst = Object.entries(rekBij);
    const rekHtml = rekLijst.length
      ? '<div class="sec-label">🧾 ' + T('app.rek.k','De rekening') + '</div>' + rekLijst.map(([code, r]) =>
          '<div class="rek-card"><div class="rek-top"><div><b>' + r.naam + '</b>' + (r.tafel ? ' · ' + r.tafel : '') +
            '<div class="sub2">' + r.n + ' ' + T('app.rek.bonnen','bon(nen) lopen') + ' · ' + T('app.rek.napm','betaal na het eten') + '</div></div>' +
            '<div class="amt">' + eur(r.som) + '</div></div>' +
          '<button class="rek-pay" data-rekpay="' + code + '">🧾 ' + T('app.rek.vraag','Vraag de rekening') + '</button></div>').join('')
      : '';
    $('#myOrders').innerHTML = rekHtml + (active.length
      ? '<div class="sec-label">'+T('app.tp.myorders','Mijn bestellingen')+'</div>' + active.map(o => {
          const pc = o.status === 'nieuw' ? 'nieuw' : o.status === 'in bereiding' ? 'bereiding' : 'klaar';
          return '<div class="myorder" data-ref="' + o.ref + '">' +
            '<div class="r1"><div><div class="nm">' + o.supplierName + '</div><div class="sub2">' + o.items.reduce((n,i)=>n+i.qty,0) + ' ' + T('app.items','item(s)') + ' · ' + timeAgo(o.at) + '</div></div>' +
              '<div style="text-align:right;"><div class="amt">' + eur(o.total) + '</div><span class="mo-pill ' + pc + '">' + tStatus(o.status) + '</span></div></div>' +
            (o.regieKorting ? '<div class="sub2" style="text-align:right;color:var(--gold);">✦ ' + T('app.ledenvoordeel','RTG-ledenvoordeel') + ' − ' + eur(o.regieKorting) + '</div>' : '') +
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
      : '');
    $('#myOrders').querySelectorAll('[data-rekpay]').forEach(b => b.addEventListener('click', () => vraagRekening(b.dataset.rekpay)));
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

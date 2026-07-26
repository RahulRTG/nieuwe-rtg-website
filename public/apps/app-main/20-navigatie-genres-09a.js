      const r = rekBij[o.supplierCode] = rekBij[o.supplierCode] || { naam: o.supplierName, tafel: '', n: 0, som: 0 };
      r.n++; r.som += o.total || 0; if (o.table && !r.tafel) r.tafel = o.table;
    });
    const rekLijst = Object.entries(rekBij);
    const rekHtml = rekLijst.length
      ? '<div class="sec-label">' + T('app.rek.k','De rekening') + '</div>' + rekLijst.map(([code, r]) =>
          '<div class="rek-card"><div class="rek-top"><div><b>' + r.naam + '</b>' + (r.tafel ? ' · ' + r.tafel : '') +
            '<div class="sub2">' + r.n + ' ' + T('app.rek.bonnen','bon(nen) lopen') + ' · ' + T('app.rek.napm','betaal na het eten') + '</div></div>' +
            '<div class="amt">' + eur(r.som) + '</div></div>' +
          '<button class="rek-pay" data-rekpay="' + code + '">' + T('app.rek.vraag','Vraag de rekening') + '</button></div>').join('')
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
              (o.paid && !o.splitst ? '<button class="mo-code js-osplit">' + T('erv.splits','Splits') + '</button>' : '') +
              (['geserveerd','bezorgd','opgehaald'].includes(o.status) ? '<button class="mo-code js-orev">' + T('erv.review','Beoordeel') + '</button>' : '') +
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
          toast(d.terugbetaald ? T('erv.retour','U ontvangt') + ' ' + eur(d.terugbetaald) + ' ' + T('erv.terug','retour.') : T('erv.geannuleerd','Geannuleerd.'));
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
      const afst = km!=null ? ' · ' + Geo.tekst(km) : '';
      const ster = s.rating ? ' · ' + s.rating.score : '';
      const sub = (s.vak ? s.vak : tType(s.typeLabel)) + ster + ' · ' + s.city + (rooms ? ' · ' + rooms + ' ' + T('app.roomsfree','kamer(s) vrij') : '') + afst;
      return '<div class="sup-card">' +
        '<span class="ic">' + (s.icon || RTGGlyf.svgHTML('gps')) + '</span>' +
        '<div class="t"><b>' + s.name + '</b><span>' + sub + '</span></div>' +
        '<button class="chatb js-fav" data-fav="' + s.code + '" aria-label="' + T('fav.aria','Favoriet') + '">' + RTGGlyf.svgHTML('hart', s.favoriet ? { fill: true } : {}) + '</button>' +
        '<button class="chatb" data-chat="' + s.code + '" aria-label="Chat">' + RTGGlyf.svgHTML('berichten') + '</button>' +
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
        b.innerHTML = RTGGlyf.svgHTML('hart', d.favoriet ? { fill: true } : {});
        toast(d.favoriet ? T('fav.on','Bewaard bij mijn adressen.') : T('fav.off','Uit mijn adressen gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    // eenmalig de locatie ophalen zodat partners op afstand worden getoond en gesorteerd

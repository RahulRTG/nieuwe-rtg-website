/* de bazaar van een partner: producten en bestellen */
    el.innerHTML =
      '<button class="bz-btn" id="bzTerug" style="margin-bottom:0.8rem;">\u2039 '+T('bz.terug','Alle partners')+'</button>'+
      '<div class="card"><b>'+esc(p.name)+'</b>'+
      p.producten.map(x =>
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.7rem;">'+
        '<div class="h-flex1"><div style="font-size:0.88rem;">'+esc(x.name)+'</div>'+(x.desc?'<div class="soft-sm">'+esc(x.desc)+'</div>':'')+'</div>'+
        '<span style="color:var(--gold);font-size:0.82rem;">'+eur(x.price)+'</span>'+
        '<span style="display:flex;align-items:center;gap:0.45rem;">'+
        '<button class="bz-btn" data-bzmin="'+x.id+'" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+(bzMand[x.id]||0)+'</b><button class="bz-btn" data-bzplus="'+x.id+'" style="padding:0.2rem 0.7rem;">+</button></span></div>'
      ).join('')+'</div>'+
      '<div class="card">'+
      '<div style="display:flex;gap:0.5rem;">'+
      (p.bezorgen?'<button class="bz-btn'+(bzLevering==='bezorgen'?' on':'')+'" data-bzlev="bezorgen">\uD83D\uDEF5 '+T('bz.kan.bez','bezorgen')+'</button>':'')+
      (p.ophalen?'<button class="bz-btn'+(bzLevering==='ophalen'?' on':'')+'" data-bzlev="ophalen">\uD83E\uDDFA '+T('bz.kan.oph','ophalen')+'</button>':'')+'</div>'+
      (bzLevering==='bezorgen' ? '<div class="bz-veld"><label>'+T('bz.adres','Bezorgadres')+'</label><input id="bzAdres" value="'+escAttr(bzAdresW)+'" placeholder="'+T('bz.adresph','Straat, nummer, plaats')+'"></div>'+
        '<button class="bz-btn'+(bzGeo?' on':'')+' h-mt50" id="bzHier">\uD83D\uDCCD '+(bzGeo?T('bz.hierok','Locatie gedeeld voor de ETA'):T('bz.hier','Deel mijn locatie voor een live ETA'))+'</button>' : '')+
      '<button class="bz-groot h-mt100" id="bzBestel"'+(n?'':' disabled')+'>'+T('bz.bestel','Bestel en betaal')+(n?' \u00B7 '+eur(bzTotaal()):'')+'</button></div>';
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
        // niet-leden zien de servicekosten eerlijk terug op de bevestiging
        // het bedrag komt van de server (order.servicekosten), niet uit deze regel:
        // stond het hier ook, dan noemt dit scherm het oude tarief bij een nieuw totaal
        const skV = b.order.servicekosten;
        const sk = skV ? ' ' + T('bz.service','(incl. EUR {bedrag} servicekosten ex btw voor niet-leden)')
          .replace('{bedrag}', String(skV.exBtw).replace('.', ',')) : '';
        toast((bzLevering === 'ophalen' ? T('bz.ok.oph','Betaald. Uw ophaalcode: ') + b.order.pickup : T('bz.ok.bez','Betaald. U volgt de bezorging hierboven live.')) + sk);
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
      /* De stad komt van de EIGEN reis. Stond hier onvoorwaardelijk trip.dest,
         en trip was altijd gevuld -- desnoods met de demo-reis, waardoor elk lid
         "RTG-partners in Ibiza" te zien kreeg. Zonder reis vragen we de hele
         lijst op en zegt de ondertitel dat ook. */
      const stad = trip ? trip.dest : null;
      const [sd, od] = await Promise.all([API.call('/suppliers', stad ? { city: stad } : {}), API.call('/orders/mine')]);
      suppliers = sd.suppliers || [];
      myOrders = od.orders || [];
      const waar = sd.city || stad;
      $('#tpSub').textContent = waar
        ? T('app.tp.partnersin','RTG-partners in') + ' ' + waar + ', ' + T('app.tp.orderpayreserve','bestel, betaal en reserveer.')
        : T('app.tp.partnersall','Alle RTG-partners: bestel, betaal en reserveer. Zodra er een reis staat, ziet u hier de partners op uw bestemming.');
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

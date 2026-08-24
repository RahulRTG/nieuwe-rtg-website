/* de artikelen van een partner, met drops die nog niet los zijn */
    const now = Date.now();
    html += (r.artikelen || []).map(a => {
      const drop = a.drop && a.drop.releaseMs > now;
      const bes = a.beschikbaar || [];
      return '<div style="border:1px solid var(--line);border-radius:16px;padding:0.8rem;margin-bottom:0.75rem;" data-rart="' + escAttr(a.id) + '">' +
        '<div style="display:flex;gap:0.8rem;">' +
        (a.foto ? '<img src="' + escAttr(a.foto) + '" alt="' + escAttr(a.naam) + '" style="width:72px;height:92px;object-fit:cover;border-radius:10px;flex-shrink:0;">' : '<div style="width:72px;height:92px;border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.4rem;"></div>') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.92rem;">' + esc(a.naam) + '</b>' +
        '<button class="rt-fav" data-rfav="' + escAttr(a.id) + '" style="background:none;border:none;font-size:1.1rem;flex-shrink:0;cursor:pointer;" aria-label="' + T('rt.m.verlang','Verlanglijst') + '">' + RTGGlyf.svgHTML('hart', a.opWishlist ? { fill: true } : {}) + '</button></div>' +
        '<div style="font-size:0.78rem;color:var(--soft);">' + esc(a.categorie || '') + (a.materiaal ? ' · ' + esc(a.materiaal) : '') + '</div>' +
        (a.kleuren && a.kleuren.length ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.25rem;">' + a.kleuren.map(k => esc(k)).join(' · ') + '</div>' : '') +
        '<div style="font-weight:600;margin-top:0.25rem;">' + eur(a.price) + '</div>' +
        (drop ? '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.25rem;">' + T('rt.m.drop','Drop') + ' ' + esc(a.drop.datum) + ' ' + esc(a.drop.tijd) + '</div>' : '') +
        '</div></div>' +
        (!drop && bes.length ? '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.5rem;flex-wrap:wrap;">' +
          '<span style="font-size:0.72rem;color:var(--soft);">' + T('rt.m.paskamer','Vraag een maat in de paskamer:') + '</span>' +
          '<select class="rt-maat" style="background:var(--card);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.6rem;font-size:0.8rem;color:var(--txt);">' +
          bes.map(v => '<option value="' + escAttr(v.vsku) + '">' + esc(v.kleur) + ' · ' + esc(v.maat) + '</option>').join('') + '</select>' +
          '<button class="vbtn rt-pas" data-rpas="' + escAttr(a.id) + '">' + T('rt.m.vraag','Vraag') + '</button></div>'
          : (drop ? '' : '<div style="font-size:0.72rem;color:var(--soft);margin-top:0.5rem;">' + T('rt.m.uitverkocht','Tijdelijk uitverkocht.') + '</div>')) +
        '</div>';
    }).join('');
    return html;
  }
  function bindRetailMenu(){
    const code = menuState.supplier.code;
    const bezBtn = document.querySelector('.rt-bezorg');
    if (bezBtn) bezBtn.addEventListener('click', async () => {
      const mijn = menuState.retailMijn || { apart: [] };
      const items = (mijn.apart || []).filter(a => a.supplierName === menuState.supplier.name)
        .map(a => ({ naam: a.artikelNaam, maat: a.maat, kleur: a.kleur, prijs: a.price || 0, aantal: 1 }));
      if (!items.length) return toast(T('mb.geenitems','Geen apart-gelegde stukken om te bezorgen.'));
      const adres = prompt(T('mb.vraagadres','Op welk adres bezorgen we?'));
      if (!adres || !adres.trim()) return;
      try {
        const r = await API.call('/mode/bezorg/aanvraag', { supplierCode: code, adres: adres.trim(), items });
        toast('' + T('mb.aangevraagd','Bezorging aangevraagd. Bezorgcode:') + ' ' + r.bezorging.bezorgcode);
        try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){}
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-rfav]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/retail/wishlist', { code, artikelId: b.dataset.rfav });
        b.innerHTML = RTGGlyf.svgHTML('hart', d.wishlist ? { fill: true } : {});
        const a = (menuState.retail.artikelen || []).find(x => x.id === b.dataset.rfav); if (a) a.opWishlist = d.wishlist;
        toast(d.wishlist ? T('rt.m.opverlang','Op uw verlanglijst. De boetiek ziet het.') : T('rt.m.afverlang','Van uw verlanglijst gehaald.'));
      } catch(e){ toast(e.message); }
    }));
    document.querySelectorAll('[data-rpas]').forEach(b => b.addEventListener('click', async () => {
      const card = b.closest('[data-rart]');
      const sel = card ? card.querySelector('.rt-maat') : null;
      if (!sel || !sel.value) return;
      try {
        await API.call('/retail/paskamer', { code, vsku: sel.value });
        toast('' + T('rt.m.pasok','Uw maat is aangevraagd. Een medewerker brengt hem naar de paskamer.'));
      } catch(e){ toast(e.message); }
    }));
  }

  async function placeOrder(opts){
    opts = opts || {};
    const items = Object.entries(menuState.qty).filter(([,q]) => q > 0).map(([id,qty]) => ({ id, qty }));
    if (!items.length) return;
    let d;
    try {
      d = await API.call('/order', { supplierCode: menuState.supplier.code, items, table: menuState.table || '', allergyNote: menuState.note, tagSalon: menuState.tag, naarKassa: !!opts.naarKassa, allergieAkkoord: !!opts.allergieAkkoord });
    } catch (e) {
      // allergieveiligheid: de server houdt een botsend gerecht tegen. Vraag het
      // lid het bewust te bevestigen; pas dan sturen we het met allergieAkkoord door.
      const bots = e.status === 409 && e.data && e.data.allergieBotsing;
      if (bots && !opts.allergieAkkoord){
        const namen = bots.map(b => b.naam + ' (' + b.allergenen.map(a => tAlg(a)).join(', ') + ')').join('; ');
        if (confirm('' + T('menu.allergiebevestig','Dit botst met je allergieprofiel') + ': ' + namen + '.\n\n' + T('menu.allergietochbestel','Weet je zeker dat je dit toch wilt bestellen?')))
          return placeOrder(Object.assign({}, opts, { allergieAkkoord: true }));
        return;
      }
      toast(e.message); return;
    }
    $('#menu-sheet').classList.remove('open');
    $('#menu-scrim').classList.remove('open');
    if (d.order.status === 'wacht-op-betaling'){
      // betalen-eerst (vooraf-zaak of jeugdlid): definitief na directe betaling
      payOrder(d.order, menuState.fooi);
    } else if (d.order.aanBalie){
      // naar de kassa: de keuken maakt hem al; toon de code groot om aan de balie
      // te laten scannen of tonen
      toast('' + T('app.naarkassaok','Naar de kassa gestuurd. Toon je code aan de balie.'));
      showGlow(d.order);
    } else {
      // deze zaak koos betaling achteraf: de bestelling loopt al; na het eten
      // vraagt u de rekening (alle bonnen in een keer) bij Mijn bestellingen
      toast('' + T('app.orderok','Bestelling geplaatst.') + ' ' + T('app.betaalnaeten','Betaal na het eten: vraag de rekening bij Mijn bestellingen.'));
    }
    renderTerPlaatse();
  }

  function payOrder(o, fooiKeus){
    // fooi voor het team: percentage of vast bedrag, gekozen in de bestelbon
    const fooi = fooiKeus === 'p5' ? Math.round(o.total * 5) / 100
      : fooiKeus === 'p10' ? Math.round(o.total * 10) / 100
      : fooiKeus === 'e5' ? 5 : 0;
    payWithFaceId(eur(o.total + fooi), async () => {
      await API.call('/order/pay', { ref: o.ref, fooi });
      return o;
    }, { message: () => T('app.paidto','Betaald aan') + ' ' + o.supplierName + '.' + (fooi ? '  ' + eur(fooi) + ' ' + T('erv.fooivoorteam','fooi voor het team.') : ''), after: () => renderTerPlaatse() });
  }

  $('#msClose').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });
  $('#menu-scrim').addEventListener('click', () => { $('#menu-sheet').classList.remove('open'); $('#menu-scrim').classList.remove('open'); });

  /* ---------- cv-builder + solliciteren via RTG ---------- */
  let myCv = null, myCvReady = false, myApps = [];
  const APPLY_FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    villa:      ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot']
  };
  async function loadCv(){
    if (!API.live) return;
    try { const d = await API.call('/cv/get'); myCv = d.cv; myCvReady = d.ready; renderCvCard(); } catch(e){}
  }
  function renderCvCard(){
    const el = $('#homeCv'); if (!el) return;

    if (apart.length) html += '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">' + T('rt.m.apart','Voor u apart gelegd') + '</div>' +
      apart.map(a => '<div style="font-size:0.82rem;margin-top:0.3rem;">' + esc(a.artikelNaam) + ' · ' + esc(a.kleur) + ', ' + esc(a.maat) + ' <span style="color:var(--soft);">(' + T('rt.m.tot','tot') + ' ' + esc(a.tot) + ')</span></div>').join('') +
      '<button class="rt-bezorg" style="margin-top:0.55rem;width:100%;background:var(--gold);color:#000;border:none;border-radius:10px;padding:0.5rem;font-weight:600;font-family:inherit;cursor:pointer;">🚚 ' + T('mb.laat','Veilig laten bezorgen') + '</button>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin-top:0.3rem;">' + T('mb.veiliguitleg','Met bezorgcode, live volgen en pas-aan-de-deur. Dure stukken: ID aan de deur.') + '</div></div>';
    // lopende bezorgingen van deze winkel
    const bez = (menuState.modeBezorg || []).filter(b => b.supplierName === r.supplier.name && !['afgeleverd','retour','geannuleerd'].includes(b.status));
    if (bez.length) html += bez.map(b => '<div style="background:var(--card);border:1px solid var(--gold);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">🚚 ' + T('mb.onderweg','Bezorging') + ' · ' + esc(b.status) + '</div>' +
      '<div style="font-size:0.85rem;margin-top:0.3rem;">' + T('mb.code','Bezorgcode') + ': <b style="letter-spacing:0.2em;font-size:1.05rem;">' + esc(b.bezorgcode) + '</b></div>' +
      '<div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + (b.koerier ? T('mb.koerieris','Koerier') + ': ' + esc(b.koerier) + (b.etaMin != null ? ' · ETA ' + b.etaMin + ' min' : '') : T('mb.geefcode','Geef deze code alleen aan de RTG-koerier aan de deur.')) + '</div></div>').join('');
    const styling = (mijn.styling || []).filter(v => v.supplierName === r.supplier.name);
    if (styling.length) html += styling.map(v => '<div style="background:var(--card);border:1px solid var(--line);border-radius:14px;padding:0.7rem 0.9rem;margin-bottom:0.7rem;"><div style="font-size:0.7rem;color:var(--gold);letter-spacing:0.08em;text-transform:uppercase;">✨ ' + esc(v.titel) + '</div>' +
      (v.bericht ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + esc(v.bericht) + '</div>' : '') +
      '<div style="font-size:0.8rem;margin-top:0.3rem;">' + v.items.map(i => esc(i.naam)).join(' · ') + '</div><div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">' + T('rt.m.van','van') + ' ' + esc(v.van) + '</div></div>').join('');
    // de artikelen
    const now = Date.now();
    html += (r.artikelen || []).map(a => {
      const drop = a.drop && a.drop.releaseMs > now;
      const bes = a.beschikbaar || [];
      return '<div style="border:1px solid var(--line);border-radius:16px;padding:0.8rem;margin-bottom:0.7rem;" data-rart="' + escAttr(a.id) + '">' +
        '<div style="display:flex;gap:0.8rem;">' +
        (a.foto ? '<img src="' + escAttr(a.foto) + '" alt="' + escAttr(a.naam) + '" style="width:72px;height:92px;object-fit:cover;border-radius:10px;flex-shrink:0;">' : '<div style="width:72px;height:92px;border-radius:10px;background:var(--card);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.4rem;">👗</div>') +
        '<div style="flex:1;min-width:0;">' +
        '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><b style="font-size:0.92rem;">' + esc(a.naam) + '</b>' +
        '<button class="rt-fav" data-rfav="' + escAttr(a.id) + '" style="background:none;border:none;font-size:1.1rem;flex-shrink:0;cursor:pointer;" aria-label="' + T('rt.m.verlang','Verlanglijst') + '">' + (a.opWishlist ? '💛' : '🤍') + '</button></div>' +
        '<div style="font-size:0.78rem;color:var(--soft);">' + esc(a.categorie || '') + (a.materiaal ? ' · ' + esc(a.materiaal) : '') + '</div>' +
        (a.kleuren && a.kleuren.length ? '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.2rem;">' + a.kleuren.map(k => esc(k)).join(' · ') + '</div>' : '') +
        '<div style="font-weight:600;margin-top:0.3rem;">' + eur(a.price) + '</div>' +
        (drop ? '<div style="font-size:0.72rem;color:var(--gold);margin-top:0.3rem;">⏳ ' + T('rt.m.drop','Drop') + ' ' + esc(a.drop.datum) + ' ' + esc(a.drop.tijd) + '</div>' : '') +
        '</div></div>' +
        (!drop && bes.length ? '<div style="display:flex;gap:0.4rem;align-items:center;margin-top:0.6rem;flex-wrap:wrap;">' +
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
        toast('🚚 ' + T('mb.aangevraagd','Bezorging aangevraagd. Bezorgcode:') + ' ' + r.bezorging.bezorgcode);
        try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){}
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    document.querySelectorAll('[data-rfav]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/retail/wishlist', { code, artikelId: b.dataset.rfav });
        b.textContent = d.wishlist ? '💛' : '🤍';
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
        toast('🚪 ' + T('rt.m.pasok','Uw maat is aangevraagd. Een medewerker brengt hem naar de paskamer.'));
      } catch(e){ toast(e.message); }
    }));
  }

  async function placeOrder(opts){
    opts = opts || {};
    const items = Object.entries(menuState.qty).filter(([,q]) => q > 0).map(([id,qty]) => ({ id, qty }));
    if (!items.length) return;
    let d;
    try {
      d = await API.call('/order', { supplierCode: menuState.supplier.code, items, table: menuState.table || '', allergyNote: menuState.note, tagSalon: menuState.tag, naarKassa: !!opts.naarKassa });
    } catch (e) { toast(e.message); return; }
    $('#menu-sheet').classList.remove('open');
    $('#menu-scrim').classList.remove('open');
    if (d.order.status === 'wacht-op-betaling'){
      // betalen-eerst (vooraf-zaak of jeugdlid): definitief na directe betaling
      payOrder(d.order, menuState.fooi);
    } else if (d.order.aanBalie){
      // naar de kassa: de keuken maakt hem al; toon de code groot om aan de balie
      // te laten scannen of tonen
      toast('🧾 ' + T('app.naarkassaok','Naar de kassa gestuurd. Toon je code aan de balie.'));
      showGlow(d.order);
    } else {
      // deze zaak koos betaling achteraf: de bestelling loopt al, afrekenen kan zo
      toast('🛎️ ' + T('app.orderok','Bestelling geplaatst.') + ' ' + T('app.betaalachteraf','Betalen kan achteraf via Bestellingen.'));
    }
    renderTerPlaatse();
  }

  function payOrder(o, fooiKeus){
    // fooi voor het team: percentage of vast bedrag, gekozen in de bestelbon

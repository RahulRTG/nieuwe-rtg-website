    const cats = [...new Set(m.map(x => x.cat))];
    $('#msBody').innerHTML = head + retailBlock + eventsBlock + applyBlock + cats.map(c =>
      '<div class="ms-cat">' + c + '</div>' + m.filter(x => x.cat === c).map(x => {
        const q = menuState.qty[x.id] || 0;
        // alcohol op slot: onder de landsgrens (paspoortleeftijd) niet bestelbaar
        const slot = x.station === 'bar' && menuState.alcohol && menuState.alcohol.mag === false;
        // 86 van het keukenscherm: uitverkocht, dus even niet te bestellen
        const op86 = !!x.uitverkocht;
        return '<div class="ms-item" data-id="' + x.id + '"' + (op86 ? ' style="opacity:0.5;"' : '') + '>' +
          '<div class="info"><div class="nm">' + x.name + '</div>' +
            (x.desc ? '<div class="ds">' + x.desc + '</div>' : '') +
            (x.allergens && x.allergens.length ? '<div class="alg">' + x.allergens.map(a => '<span>' + tAlg(a) + '</span>').join('') + '</div>' : '') +
          '</div>' +
          '<div class="side"><div class="pr">' + eur(x.price) + '</div>' +
            (op86 ? '<div class="qty" style="opacity:0.7;font-size:0.64rem;justify-content:center;">' + T('menu.86','uitverkocht') + '</div>'
              : slot ? '<div class="qty" style="opacity:0.55;font-size:0.64rem;justify-content:center;">🔞 ' + menuState.alcohol.grens + '+</div>'
              : '<div class="qty"><button class="js-minus">−</button><b>' + q + '</b><button class="js-plus">+</button></div>') +
          '</div></div>';
      }).join('')
    ).join('');
    const apGo = $('#apGo2');
    if (apGo) apGo.addEventListener('click', () => memberApply(menuState.supplier.code, $('#apFunc2').value, ''));
    document.querySelectorAll('[data-rsvp]').forEach(b => b.addEventListener('click', async () => {
      try {
        await API.call('/event/rsvp', { supplierCode: menuState.supplier.code, eventId: b.dataset.rsvp, qty: 1 });
        toast(T('ev.joined','U staat op de gastenlijst. Uw codenaam is uw toegang.'));
        await openMenu(menuState.supplier.code); // sheet ververst: plekken en knop kloppen weer
      } catch(e){ toast(e.message); }
    }));
    // vol event: op de wachtlijst; bij een vrijgekomen plek krijgt u meteen bericht
    document.querySelectorAll('[data-wl]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/wachtlijst', { supplierCode: menuState.supplier.code, eventId: b.dataset.wl });
        toast('⏳ ' + T('erv.wlok','U staat op de wachtlijst (nr. ') + d.positie + '). ' + T('erv.wlbericht','Bij een vrije plek hoort u het meteen.'));
      } catch(e){ toast(e.message); }
    }));
    // favoriet-hart + tafel reserveren
    const favB = $('#msFav');
    if (favB) favB.addEventListener('click', async () => {
      try {
        const d = await API.call('/favoriet', { supplierCode: s.code });
        menuState.supplier.favoriet = d.favoriet;
        renderMenuSheet();
      } catch(e){ toast(e.message); }
    });
    const rsvGo = $('#rsvGo');
    if (rsvGo) rsvGo.addEventListener('click', async () => {
      try {
        const d = await API.call('/reserveer', { supplierCode: s.code, datum: $('#rsvDatum').value, tijd: $('#rsvTijd').value, personen: Number($('#rsvPers').value) });
        toast('🪑 ' + T('erv.reserveerok','Reservering aangevraagd voor') + ' ' + d.reservering.datum + ' ' + d.reservering.tijd + '. ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    });
    // keyless: de deur van je kamer of de entree, met je telefoon als sleutel
    const deur = async welke => {
      try {
        const d = await API.call('/verblijf/deur', { supplierCode: s.code, welke });
        toast('🔓 ' + d.door.name + ' ' + T('vb.deuropen','is open; hij vergrendelt zelf weer na') + ' ' + d.door.relockSec + 's.');
      } catch(e){ toast(e.message); }
    };
    const dk = $('#vbDeurKamer'); if (dk) dk.addEventListener('click', () => deur('kamer'));
    const de = $('#vbDeurEntree'); if (de) de.addEventListener('click', () => deur('entree'));
    // een kamer boeken: datums kiezen, een knop, het huis bevestigt
    $('#msBody').querySelectorAll('[data-vbboek]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await API.call('/verblijf', {
          supplierCode: s.code, roomId: b.dataset.vbboek,
          aankomst: $('#vbAankomst').value, vertrek: $('#vbVertrek').value,
          personen: Number($('#vbPers').value)
        });
        toast('🛎️ ' + T('vb.ok','Verblijf aangevraagd:') + ' ' + d.verblijf.roomName + ', ' + d.verblijf.nachten + ' ' + T('vb.nachten','nacht(en)') + ' (' + eur(d.verblijf.totaal) + '). ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    }));
    if (menuState.retail) bindRetailMenu();
    $('#msBody').querySelectorAll('.ms-item').forEach(el => {
      const id = el.dataset.id;
      const plus = el.querySelector('.js-plus'), min = el.querySelector('.js-minus');
      if (plus) plus.addEventListener('click', () => { menuState.qty[id] = (menuState.qty[id]||0)+1; renderMenuSheet(); });
      if (min) min.addEventListener('click', () => { menuState.qty[id] = Math.max(0,(menuState.qty[id]||0)-1); renderMenuSheet(); });
    });
    if (!m.length){ $('#msFoot').innerHTML = ''; return; }
    if (menuState.supplier.ordersOpen === false){
      $('#msFoot').innerHTML = '<div style="padding:0.9rem 0;text-align:center;font-size:0.82rem;color:var(--soft);">⏸ ' + T('app.ms.closed','Bestellingen zijn tijdelijk gesloten. De kaart blijft ter inzage.') + '</div>';
      return;
    }
    const total = m.reduce((s,x) => s + x.price * (menuState.qty[x.id]||0), 0);
    const count = Object.values(menuState.qty).reduce((a,b)=>a+b,0);
    const tafels = menuState.supplier.tableNames || [];
    $('#msFoot').innerHTML =
      (tafels.length ? '<select class="ms-note" id="msTable" style="margin-bottom:0.5rem;">'+
        '<option value="">' + T('app.ms.tableq','Aan welke tafel zit u? (optioneel)') + '</option>'+
        tafels.map(t => '<option' + (menuState.table === t ? ' selected' : '') + '>' + t + '</option>').join('') + '</select>' : '') +
      '<input class="ms-note" id="msNote" placeholder="' + T('app.ms.note','Allergie of opmerking (bijv. geen noten)') + '" value="' + menuState.note.replace(/"/g,'&quot;') + '">' +
      '<label class="ms-tag"><input type="checkbox" id="msTag"' + (menuState.tag ? ' checked' : '') + '> ' + T('app.ms.tag','Tag dit voor De Salon (7 dagen na verblijf)') + '</label>' +
      '<select class="ms-note" id="msFooi" style="margin-top:0.4rem;" aria-label="' + T('erv.fooi','Fooi') + '">' +
        '<option value="0">' + T('erv.fooi.geen','Geen fooi') + '</option>' +
        '<option value="p5"' + (menuState.fooi==='p5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 5%</option>' +
        '<option value="p10"' + (menuState.fooi==='p10'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': 10%</option>' +
        '<option value="e5"' + (menuState.fooi==='e5'?' selected':'') + '>' + T('erv.fooi.team','Fooi voor het team') + ': € 5</option>' +
      '</select>' +
      '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">' + T('app.ms.los','U bestelt rechtstreeks bij deze zaak: een losse overeenkomst, en uw betaling gaat rechtstreeks naar de zaak.') + '</div>' +
      ((menuState.supplier.hasMenu !== false && (menuState.menu || []).some(x => x.station === 'bar'))
        ? '<div style="font-size:0.66rem;color:var(--soft);margin:0.35rem 0;">🔞 ' +
          (menuState.alcohol && menuState.alcohol.mag === false
            ? T('app.ms.geenalc','Alcohol staat voor u uit:') + ' ' + (menuState.alcohol.land || '') + ' ' + T('app.ms.vanaf','hanteert') + ' ' + menuState.alcohol.grens + '+ ' + T('app.ms.pasp','(leeftijd geverifieerd via uw paspoort).')
            : 'Alcohol: ' + ((menuState.alcohol && menuState.alcohol.grens) || 18) + '+; ' + T('app.ms.18b','de zaak kan om legitimatie vragen.')) + '</div>' : '') +
      '<button class="ms-order" id="msOrder"' + (count ? '' : ' disabled') + '>' + (count ? T('app.ms.order','Bestel') + ' ' + count + ' ' + T('app.items','item(s)') + ', ' + eur(total) : T('app.ms.choose','Kies gerechten')) + '</button>' +
      (count ? '<button class="ms-order" id="msKassa" style="margin-top:0.4rem;background:none;border:1px solid var(--line);color:var(--txt);">🧾 ' + T('app.ms.naarkassa','Stuur naar de kassa, betaal aan de balie') + '</button>' : '');
    const mt = $('#msTable');
    if (mt) mt.addEventListener('change', e => menuState.table = e.target.value);
    $('#msNote').addEventListener('input', e => menuState.note = e.target.value);
    $('#msTag').addEventListener('change', e => menuState.tag = e.target.checked);
    const mf = $('#msFooi');
    if (mf) mf.addEventListener('change', e => menuState.fooi = e.target.value);
    const ob = $('#msOrder');
    if (count) ob.addEventListener('click', () => placeOrder());
    const kb = $('#msKassa');
    if (kb) kb.addEventListener('click', () => placeOrder({ naarKassa: true }));
  }

  // ---- mode-/retailcatalogus in de partner-sheet ----
  function retailMenuBlock(){
    const r = menuState.retail;
    const mijn = menuState.retailMijn || { apart: [], styling: [] };
    let html = '<div class="ms-cat">🛍 ' + T('rt.m.cat','Collectie') + '</div>';
    // eigen apart-artikelen en stylingvoorstellen bij dit merk
    const apart = (mijn.apart || []).filter(a => a.supplierName === r.supplier.name);

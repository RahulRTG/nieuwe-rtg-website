/* een verblijf tonen: foto's en kamers */
    if (s.photos && s.photos.length)
      head += '<div class="ms-photos">' + s.photos.map(p => '<img src="' + p + '" alt="">').join('') + '</div>';
    if (s.rooms && s.rooms.length){
      const inDatum = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      const uitDatum = new Date(Date.now() + 3 * 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">' + T('app.ms.rooms','Beschikbare kamers') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.6rem;flex-wrap:wrap;">' +
        '<input type="date" id="vbAankomst" value="' + inDatum + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.aankomst','Aankomst') + '">' +
        '<input type="date" id="vbVertrek" value="' + uitDatum + '" min="' + inDatum + '" style="flex:1;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('vb.vertrek','Vertrek') + '">' +
        '<select id="vbPers" style="flex:0 1 70px;min-width:64px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,6].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select></div>' +
        s.rooms.map(r => '<div class="ms-room"><div class="rt"><b>' + r.name + '</b>' + (r.desc ? '<span>' + r.desc + '</span>' : '') + '</div>' +
          '<div class="rp" style="display:flex;align-items:center;gap:0.5rem;">' + eur(r.price) + ' <span style="font-size:0.62rem;color:var(--soft);">' + T('app.ms.pernight','p.n.') + '</span>' +
          '<button class="vbtn" data-vbboek="' + r.id + '">' + T('vb.boek','Boek') + '</button></div></div>').join('') +
        '<div style="margin:0.5rem 0 0.6rem;font-size:0.74rem;color:var(--soft);">' + T('app.ms.roomnote2','Tegen nettoprijs; het huis bevestigt uw verblijf en de rekening loopt op de kamer.') + '</div>' +
        // keyless: tijdens een ingecheckt verblijf is de telefoon de sleutel
        '<div style="display:flex;gap:0.5rem;padding-bottom:0.8rem;">' +
        '<button class="vbtn h-flex1" id="vbDeurKamer">' + T('vb.deurkamer','Open mijn kamerdeur') + '</button>' +
        '<button class="vbtn" id="vbDeurEntree" style="flex:1;background:var(--card);color:var(--txt);border:1px solid var(--line);">' + T('vb.deurentree','Open de entree') + '</button></div>';
    }
    const funcs = APPLY_FUNCS[s.type] || [];
    const applyBlock = funcs.length
      ? '<div class="ms-cat">' + T('cv.workat','Werken bij') + ' ' + s.name + '</div>' +
        '<div style="display:flex;gap:0.5rem;align-items:center;padding:0.3rem 0 0.9rem;">' +
        '<select id="apFunc2" style="flex:1;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.86rem;color:var(--txt);outline:none;">' +
        funcs.map(f => '<option>' + f + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="apGo2">' + T('cv.apply','Solliciteer') + '</button></div>'
      : '';
    const evs = s.events || [];
    const eventsBlock = evs.length
      ? '<div class="ms-cat">\uD83C\uDF9F ' + T('ev.h','Events') + '</div>' + evs.map(e =>
          '<div style="border:1px solid var(--line);border-radius:14px;padding:0.85rem 1rem;margin-bottom:0.6rem;">' +
          '<div style="display:flex;justify-content:space-between;gap:0.6rem;align-items:baseline;"><b style="font-size:0.92rem;">' + e.name + '</b><span style="font-size:0.7rem;color:var(--soft);flex-shrink:0;">' + e.date + (e.time ? ' \u00b7 ' + e.time : '') + '</span></div>' +
          (e.desc ? '<div style="font-size:0.78rem;color:var(--muted);margin-top:0.25rem;">' + e.desc + '</div>' : '') +
          '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:0.6rem;gap:0.6rem;">' +
          '<span style="font-size:0.72rem;color:' + (e.spotsLeft > 0 ? 'var(--soft)' : 'var(--burgundy)') + ';">' + (e.spotsLeft > 0 ? e.spotsLeft + ' ' + T('ev.spots','plekken vrij') : T('ev.full','Vol')) + (e.price ? ' \u00b7 ' + eur(e.price) + ' p.p.' : ' \u00b7 ' + T('ev.free','gratis')) + '</span>' +
          (e.spotsLeft > 0 ? '<button class="vbtn" data-rsvp="' + e.id + '">' + T('ev.join','Zet mij op de lijst') + '</button>'
            : '<button class="vbtn" data-wl="' + e.id + '">' + T('erv.wachtlijst','Wachtlijst') + '</button>') +
          '</div></div>'
        ).join('')
      : '';
    const retailBlock = menuState.retail ? retailMenuBlock() : '';
    const cats = [...new Set(m.map(x => x.cat))];
    $('#msBody').innerHTML = head + retailBlock + eventsBlock + applyBlock + cats.map(c =>
      '<div class="ms-cat">' + c + '</div>' + m.filter(x => x.cat === c).map(x => {
        const q = menuState.qty[x.id] || 0;
        // alcohol op slot: onder de landsgrens (paspoortleeftijd) niet bestelbaar
        const slot = x.station === 'bar' && menuState.alcohol && menuState.alcohol.mag === false;
        // 86 van het keukenscherm: uitverkocht, dus even niet te bestellen
        const op86 = !!x.uitverkocht;
        // allergie: welke allergenen van dit gerecht staan in jouw profiel?
        const botst = ((menuState.allergenen || []).length && (x.allergens || []).filter(a => menuState.allergenen.includes(String(a).toLowerCase()))) || [];
        return '<div class="ms-item' + (botst.length ? ' ms-allergie' : '') + '" data-id="' + x.id + '"' + (op86 ? ' style="opacity:0.5;"' : '') + '>' +
          '<div class="info"><div class="nm">' + x.name + '</div>' +
            (x.desc ? '<div class="ds">' + x.desc + '</div>' : '') +
            (botst.length ? '<div class="alg-waarschuwing">' + T('menu.jouwallergie','jouw allergie') + ': ' + botst.map(a => tAlg(a)).join(', ') + '</div>' : '') +
            (x.allergens && x.allergens.length ? '<div class="alg">' + x.allergens.map(a => '<span>' + tAlg(a) + '</span>').join('') + '</div>' : '') +
          '</div>' +
          '<div class="side"><div class="pr">' + eur(x.price) + '</div>' +
            (op86 ? '<div class="qty" style="opacity:0.7;font-size:0.64rem;justify-content:center;">' + T('menu.86','uitverkocht') + '</div>'
              : slot ? '<div class="qty" style="opacity:0.55;font-size:0.64rem;justify-content:center;">' + menuState.alcohol.grens + '+</div>'
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
        toast('' + T('erv.wlok','U staat op de wachtlijst (nr. ') + d.positie + '). ' + T('erv.wlbericht','Bij een vrije plek hoort u het meteen.'));
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
        toast('' + T('erv.reserveerok','Reservering aangevraagd voor') + ' ' + d.reservering.datum + ' ' + d.reservering.tijd + '. ' + T('erv.zaakbevestigt','De zaak bevestigt hem zo.'));
      } catch(e){ toast(e.message); }
    });
    // keyless: de deur van je kamer of de entree, met je telefoon als sleutel
    const deur = async welke => {
      try {
        const d = await API.call('/verblijf/deur', { supplierCode: s.code, welke });
        toast('' + d.door.name + ' ' + T('vb.deuropen','is open; hij vergrendelt zelf weer na') + ' ' + d.door.relockSec + 's.');
      } catch(e){ toast(e.message); }
    };

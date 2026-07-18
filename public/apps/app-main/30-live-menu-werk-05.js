  const FID_MINI = '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 19 V13 a7 7 0 0 1 7-7 h6"/><path d="M45 6 h6 a7 7 0 0 1 7 7 v6"/><path d="M58 45 v6 a7 7 0 0 1-7 7 h-6"/><path d="M19 58 h-6 a7 7 0 0 1-7-7 v-6"/><circle cx="23.5" cy="26.5" r="3" fill="currentColor"/><circle cx="40.5" cy="26.5" r="3" fill="currentColor"/><path d="M32 26 v8.5 a2.2 2.2 0 0 1-2.2 2.2"/><path d="M23 42.5 a12.5 8.5 0 0 0 18 0"/></svg>';

  async function openMenu(code){
    let data;
    try { data = await API.call('/supplier/menu/get', { code }); }
    catch (e) { toast(e.message); return; }
    menuState = { supplier: data.supplier, menu: data.menu, alcohol: data.alcohol || null, qty: {}, note: '', tag: false, table: '', retail: null, retailMijn: null };
    $('#msName').textContent = data.supplier.name;
    $('#msMeta').textContent = tType(data.supplier.typeLabel) + ' · ' + data.supplier.city + (data.supplier.loc ? ' · ' + data.supplier.loc.label : '');
    // mode-/retailpartner: haal de catalogus en de eigen apart/styling erbij
    if ((data.supplier.caps || []).includes('retail')){
      try { menuState.retail = await API.call('/retail/catalogus', { supplierCode: code }); } catch(e){}
      try { menuState.retailMijn = await API.call('/retail/mijn', {}); } catch(e){}
      try { menuState.modeBezorg = (await API.call('/mode/bezorg/mijn', {})).bezorgingen || []; } catch(e){ menuState.modeBezorg = []; }
    }
    renderMenuSheet();
    $('#menu-sheet').classList.add('open');
    $('#menu-scrim').classList.add('open');
  }

  function renderMenuSheet(){
    const m = menuState.menu;
    const s = menuState.supplier;
    // fotostrip + kamers van de partner (hotels, of elke partner met foto's)
    let head = '';
    // rating + favoriet-hart + tafel reserveren (de ervaring-laag)
    head += '<div style="display:flex;align-items:center;gap:0.6rem;padding:0.2rem 0 0.6rem;">' +
      (s.rating ? '<span style="font-size:0.8rem;">⭐ <b>' + s.rating.score + '</b> <span style="color:var(--soft);font-size:0.7rem;">(' + s.rating.aantal + ')</span></span>' : '<span style="font-size:0.72rem;color:var(--soft);">' + T('erv.nogGeenReviews','Nog geen reviews') + '</span>') +
      '<button id="msFav" style="margin-left:auto;background:none;border:1px solid var(--line);border-radius:999px;padding:0.35rem 0.8rem;font-size:0.85rem;" aria-label="' + T('fav.aria','Favoriet') + '">' + (s.favoriet ? '❤️ ' + T('fav.bewaard','Bewaard') : '🤍 ' + T('fav.bewaar','Bewaar')) + '</button></div>';
    if ((s.tableNames || []).length && s.reservationsOpen !== false){
      const morgen = new Date(Date.now() + 86400000).toISOString().slice(0,10);
      head += '<div class="ms-cat">🪑 ' + T('erv.reserveer.h','Tafel reserveren') + '</div>' +
        '<div style="display:flex;gap:0.4rem;align-items:center;padding:0.2rem 0 0.9rem;flex-wrap:wrap;">' +
        '<input type="date" id="rsvDatum" value="' + morgen + '" min="' + new Date().toISOString().slice(0,10) + '" style="flex:2;min-width:120px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.datum','Datum') + '">' +
        '<input type="time" id="rsvTijd" value="20:00" style="flex:1;min-width:84px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.tijd','Tijd') + '">' +
        '<select id="rsvPers" style="flex:1;min-width:70px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.5rem;font-size:0.8rem;color:var(--txt);" aria-label="' + T('erv.personen','Personen') + '">' +
        [1,2,3,4,5,6,8,10].map(n => '<option' + (n===2?' selected':'') + '>' + n + '</option>').join('') + '</select>' +
        '<button class="vbtn" id="rsvGo">' + T('erv.reserveer','Reserveer') + '</button></div>';
    }
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
        '<button class="vbtn" id="vbDeurKamer" style="flex:1;">🗝️ ' + T('vb.deurkamer','Open mijn kamerdeur') + '</button>' +
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
            : '<button class="vbtn" data-wl="' + e.id + '">⏳ ' + T('erv.wachtlijst','Wachtlijst') + '</button>') +
          '</div></div>'
        ).join('')
      : '';
    const retailBlock = menuState.retail ? retailMenuBlock() : '';

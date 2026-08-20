/* een gerecht aan de menukaart toevoegen */
    if (canEdit){
      html += '<div class="card h-mt120"><div class="tt-h">'+T('menu.add','Gerecht toevoegen')+'</div>'+
        '<div class="field"><label>'+T('menu.name','Naam')+'</label><input id="mnName" placeholder="'+T('menu.nameph','Bijv. gegrilde octopus')+'"></div>'+
        '<div class="row-gap"><div class="field h-flex2"><label>'+T('menu.cat','Categorie')+'</label><input id="mnCat" placeholder="'+T('menu.catph','Bijv. Voorgerechten')+'"></div>'+
        '<div class="field h-flex1"><label>'+T('menu.price','Prijs (€)')+'</label><input id="mnPrice" type="number" inputmode="decimal" placeholder="45"></div></div>'+
        '<div class="field"><label>'+T('menu.desc','Omschrijving')+'</label><input id="mnDesc" placeholder="'+T('menu.descph','Kort en smakelijk')+'"></div>'+
        '<div class="field"><label>'+T('menu.alg','Allergenen (komma\'s)')+'</label><input id="mnAlg" placeholder="vis, soja"></div>'+
        '<div class="field"><label>'+T('menu.station','Werkplek')+'</label><select id="mnStation" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:0;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="keuken"'+((S&&(S.type==='bar'||S.type==='club'))?'':' selected')+'>\uD83D\uDD25 '+T('menu.keuken','Keuken')+'</option>'+
        '<option value="bar"'+((S&&(S.type==='bar'||S.type==='club'))?' selected':'')+'>\uD83C\uDF78 Bar</option></select></div>'+
        '<button class="bigbtn" id="mnAdd">'+T('menu.addbtn','Zet op de kaart')+'</button></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-mdel]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).filter(x => x.id !== b.dataset.mdel);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.removed','Van de kaart gehaald.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    // gerecht wisselen van werkplek: keuken <-> bar (bepaalt op welk scherm het ticket komt)
    el.querySelectorAll('[data-mst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.mst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); toast(T('menu.stmoved','Verplaatst naar de andere werkplek.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    }));
    const add = $('#mnAdd'); if (add) add.addEventListener('click', async () => {
      const name = $('#mnName').value.trim(), price = Number($('#mnPrice').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: RTGId('m'), cat: $('#mnCat').value.trim()||T('menu.other','Overig'), name, desc: $('#mnDesc').value.trim(), price, allergens: $('#mnAlg').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), station: $('#mnStation') ? $('#mnStation').value : 'keuken' };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); toast(T('menu.added','Staat op de kaart, gasten zien het direct.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    });
  }

  // ---- dynamische prijs ----
  function renderPrice(){
    const h = state.prices || [];
    $('#prHistory').innerHTML = '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);margin-bottom:0.3rem;">'+T('sup.pricehist','Eerder doorgegeven')+'</div>' +
      (h.length ? h.slice(0,8).map(p=>'<div class="price-row"><span class="s">'+p.service+'<br><span style="font-size:0.66rem;color:var(--soft);">'+timeAgo(p.at)+'</span></span><span class="p">'+eur(p.price)+'</span></div>').join('') : '<div class="softline">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>');
  }
  $('#prSend').addEventListener('click', async () => {
    const service = $('#prService').value.trim();
    const price = Number($('#prPrice').value);
    if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
    try { await API.call('/supplier/price', {service, price}); toast(T('sup.pricesent','Prijs verstuurd naar RTG.')); $('#prService').value=''; $('#prPrice').value=''; await refresh(); openTab('price'); }
    catch(e){ toast(e.message); }
  });

  // ---- locatie ----
  function renderLocation(){
    const loc = S.loc || {};
    $('#locWrap').innerHTML =
      '<div class="loc-card"><div class="loc-map"><div class="pin"></div><div class="lbl">'+(loc.label||T('sup.locunknown','Locatie onbekend'))+'</div></div>'+
      '<div class="loc-info">'+T('sup.locinfo','Uw locatie is zichtbaar voor RTG-gasten met een actieve rit of bestelling bij u. Gasten delen hun locatie terug wanneer zij onderweg zijn.')+'</div></div>'+
      '<button class="bigbtn" id="locShare">'+T('sup.sharelive','Deel mijn live locatie')+'</button>';
    $('#locShare').addEventListener('click', shareLocation);
  }
  function shareLocation(){
    if (navigator.geolocation){
      navigator.geolocation.getCurrentPosition(async pos => {
        try { await API.call('/supplier/location', { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Live positie' }); toast(T('sup.locshared','Live locatie gedeeld met gasten.')); await refresh(); }
        catch(e){ toast(e.message); }
      }, () => demoShare(), { timeout: 4000 });
    } else demoShare();
  }
  async function demoShare(){
    try { await API.call('/supplier/location', { lat: S.loc.lat, lng: S.loc.lng, label: S.loc.label }); toast(T('sup.locshareddemo','Locatie gedeeld (demo-positie).')); }
    catch(e){ toast(e.message); }
  }

  // ---- kassa, per sector ----
  let bon = {};        // horeca: menu-id -> aantal
  function bonTotal(){ return (state.menu||[]).reduce((s,m)=>s+m.price*(bon[m.id]||0),0); }
  /* Luchtzijde: staat de zaak op de luchthaven, dan toont de kassa dubbele
     prijzen (normaal + luchthavenprijs met de toeslag van het beheer). De bon
     gaat met NORMALE prijzen naar de server; die rekent dezelfde toeslag en
     de gast betaalt de luchthavenprijs. De vertaalknop () zet de kaartnamen
     in elke actieve wereldtaal, voor de gast aan de balie. */
  const MENU_VERTAAL = { naar: null, map: {} };
  const mNaam = x => MENU_VERTAAL.map[x.id] || x.name;
  function luchtPct(){ const st = state.settings || {}; return st.luchtzijde ? (Number.isFinite(Number(st.luchtToeslagPct)) ? Math.round(Number(st.luchtToeslagPct)) : 15) : 0; }
  function luchtPrijs(p){ const pct = luchtPct(); return pct ? Math.round(p * (1 + pct / 100) * 100) / 100 : p; }
  function methodLabel(m){ return m==='rtgpay'?'RTG Pay':m==='pin'?T('pos.pin','PIN'):m==='contant'?T('pos.cash','Contant'):m==='rtg'?T('pos.rtg','RTG-code'):m==='kamer'?T('pos.room','Op de kamer'):m==='tafel'?T('pos.table','Op de tafel'):m==='app'?T('pos.app','In de app'):m; }
  /* RTG Pay aan de kassa: tap to pay als het kan (de gast houdt zijn toestel
     hiertegen), met altijd de uitweg om de code te typen; werkt de NFC-chip
     niet of tikt er niemand, dan komt het typvenster vanzelf. */
  async function vraagPayCode(){
    if (window.TapPay && TapPay.kan()){
      const tap = window.confirm(T('pos.tapkeuze','Tap to pay: de gast tikt zijn toestel hiertegen. Liever de code scannen of typen? Kies dan Annuleren.'));
      if (tap){
        toast(''+T('pos.tap','Tap to pay: laat de gast het toestel hiertegen houden...'));
        const code = await TapPay.lees(12000);
        if (code){ toast(''+T('pos.tapok','Code ontvangen via tap to pay.')); return code; }
        toast(T('pos.tapmis','Geen tik ontvangen; scan of typ de code van de gast.'));
      }
    }
    // scan de betaal-QR op het scherm van de gast; het scanscherm biedt zelf een
    // typveld aan als er geen camera is of de code niet leesbaar is
    if (window.RTGScanknop){
      return await new Promise((resolve) => {
        let klaar = false;
        RTGScanknop.open({
          titel: T('pos.scanbetaal','Scan de betaalcode'),
          hint: T('pos.scanbetaalhint','Scan de QR op het scherm van de gast.'),
          handTekst: T('pos.oftyp','Of typ de betaalcode'),
          onCode: (c) => { klaar = true; resolve(((c.tekst||'').trim().toUpperCase()) || null); },
          onSluit: () => { if (!klaar) resolve(null); }
        });
      });
    }
    const c = window.prompt(T('pos.paycode','Betaalcode van de gast (uit de app):'));
    return c ? c.trim().toUpperCase() : null;
  }

  function renderKassa(){
    const el = $('#kassaWrap'); if (!el) return;
    const type = S.type;
    let html = '';
    if (type==='restaurant'||type==='bar'||type==='club') html = kassaHoreca();
    else if (type==='hotel'||type==='apartment'||type==='villa') html = kassaHotel();
    else html = kassaVervoer();
    html += kassaDay();
    html += '<div id="zWrap"></div><div id="shiftWrap"></div>';
    el.innerHTML = html;
    bindKassa(type);
    laadZ();

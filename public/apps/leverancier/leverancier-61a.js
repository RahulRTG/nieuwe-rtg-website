/* Menukaart, dynamische prijzen, locatie en de sectorgebonden kassa. */
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
  function methodLabel(m){ return m==='rtgpay'?'RTG Pay':m==='pin'?T('pos.pin','PIN'):m==='contant'?T('pos.cash','Contant'):m==='rtg'?T('pos.rtg','RTG-code'):m==='cadeaukaart'?T('pos.gc','Cadeaukaart'):m==='kamer'?T('pos.room','Op de kamer'):m==='tafel'?T('pos.table','Op de tafel'):m==='app'?T('pos.app','In de app'):m; }
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

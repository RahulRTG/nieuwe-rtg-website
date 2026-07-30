    const rooms = state.rooms || [];
    return '<div class="card"><div class="tt-h">'+T('pos.charge','Afrekening of kamerlast')+'</div>'+
      '<div class="field"><label>'+T('pos.roomlbl','Kamer (optioneel)')+'</label><select id="posRoom" style="width:100%;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        '<option value="">'+T('pos.noroom','Geen kamer, losse verkoop')+'</option>'+
        rooms.map(r=>'<option value="'+r.name.replace(/"/g,'&quot;')+'">'+r.name+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('pos.desc','Omschrijving')+'</label><input id="posDesc" placeholder="'+T('pos.deschotel','Bijv. minibar, spa, roomservice')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="45"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="kamer">'+T('pos.toroom','Op de kamer')+'</button>'+
        '<button class="obtn js-pay" data-method="rtgpay">RTG Pay</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>' + kassaOpenRooms();
  }

  // open kamerrekeningen: alles wat op de kamer staat, in één keer uitchecken
  function kassaOpenRooms(){
    const open = (state.pos && state.pos.openRooms) || {};
    const rooms = Object.keys(open);
    if (!rooms.length) return '';
    return '<div class="card"><div class="tt-h">'+T('pos.openrooms','Open kamerrekeningen')+'</div>'+
      rooms.map(r =>
        '<div class="pos-sale"><div><b>'+r+'</b><span>'+open[r].count+' '+T('pos.posts','post(en)')+'</span></div>'+
        '<div class="row-mid-gap"><span class="amt" style="font-family:\'Bodoni Moda\',serif;">'+eur(open[r].total)+'</span>'+
        '<button class="obtn primary js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="rtgpay">'+T('pos.checkoutrtg','Check-out, RTG Pay')+'</button>'+
        '<button class="obtn js-checkout" data-room="'+r.replace(/"/g,'&quot;')+'" data-method="contant">'+T('pos.cash','Contant')+'</button></div></div>'
      ).join('')+'</div>';
  }

  // vervoer: rit afrekenen
  function kassaVervoer(){
    return '<div class="card"><div class="tt-h">'+T('pos.ridebill','Rit afrekenen')+'</div>'+
      '<div class="field"><label>'+T('pos.ride','Rit')+'</label><input id="posDesc" placeholder="'+T('pos.descride','Bijv. luchthaven naar Cala Jondal')+'"></div>'+
      '<div class="field"><label>'+T('pos.amount','Bedrag (€)')+'</label><input id="posAmt" type="number" inputmode="decimal" placeholder="28"></div>'+
      '<div class="pos-pay">'+
        '<button class="obtn primary js-pay" data-method="rtgpay">'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant">'+T('pos.cash','Contant')+'</button>'+
      '</div></div>';
  }

  // dagoverzicht: totaal, per betaalmethode, per medewerker, laatste bonnen
  function kassaDay(){
    const p = state.pos || { total:0, count:0, byMethod:{}, byActor:{}, sales:[] };
    let html = '<div class="card"><div class="tt-h">'+T('pos.today','Vandaag')+'</div>'+
      '<div class="pos-day"><b>'+eur(p.total)+'</b><span>'+p.count+' '+T('pos.bons','bon(nen)')+'</span></div>';
    const methods = Object.keys(p.byMethod);
    if (methods.length) html += '<div class="pos-chips">'+methods.map(m=>'<span>'+methodLabel(m)+' '+eur(p.byMethod[m])+'</span>').join('')+(p.fooien?'<span>'+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span>':'')+'</div>';
    else if (p.fooien) html += '<div class="pos-chips"><span>'+T('pos.fooien','Fooien')+' '+eur(p.fooien)+'</span></div>';
    const actors = Object.keys(p.byActor);
    if (actors.length>1 || (actors.length===1 && actors[0]!==actor().name))
      html += '<div class="pos-chips actors">'+actors.map(a=>'<span>'+a+' '+eur(p.byActor[a])+'</span>').join('')+'</div>';
    html += p.sales.length
      ? p.sales.map(s=>'<div class="pos-sale"><div><b>'+(s.desc||((s.items||[]).map(i=>i.qty+'× '+i.name).join(', '))||T('pos.sale','Verkoop'))+'</b>'+
          '<span>'+s.bon+' · '+s.actor+(s.room?' · '+s.room:'')+' · '+timeAgo(s.at)+'</span></div>'+
          '<div class="amt">'+eur(s.total)+'<span class="m">'+methodLabel(s.method)+'</span></div></div>').join('')
      : '<div class="softline">'+T('pos.nosales','Nog geen verkopen vandaag.')+'</div>';
    return html + '</div>';
  }

  function bindKassa(type){
    document.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.pos; bon[id] = (bon[id]||0)+1; renderKassa(); openTab('kassa');
    }));
    const clear = $('#posClear'); if (clear) clear.addEventListener('click', () => { bon = {}; renderKassa(); openTab('kassa'); });
    document.querySelectorAll('.js-pay').forEach(b => b.addEventListener('click', () => paySale(type, b.dataset.method)));
    const redeem = $('#posRedeem'); if (redeem) redeem.addEventListener('click', redeemCode);
    // scan de ophaalcode van het lid (het oplichtende scherm toont hem als QR)
    const posScan = $('#posScan'); if (posScan) posScan.addEventListener('click', () => {
      if (!window.RTGScanknop){ toast(T('pos.scannietklaar','De scanner is nog niet geladen.')); return; }
      RTGScanknop.open({ titel: T('pos.scan','Scan de ophaalcode'), hint: T('pos.scanhint','Scan de QR op het scherm van het lid.'), onCode: (c) => {
        const el = $('#posCode'); if (el) el.value = String(c.tekst || '').trim().toUpperCase().slice(0, 4);
        redeemCode();
      } });
    });
    // de vertaalknop: de kaartnamen in elke actieve wereldtaal, voor de gast
    const vt = $('#posVertaal'); if (vt) vt.addEventListener('click', async () => {
      const naar = (window.prompt(T('pos.vertaalnaar','Taalcode voor de kaart (bijv. en, es, de, fr) of nl voor terug:'), MENU_VERTAAL.naar || 'en')||'').trim().toLowerCase();
      if (!naar) return;
      if (naar === 'nl'){ MENU_VERTAAL.naar = null; MENU_VERTAAL.map = {}; renderKassa(); openTab('kassa'); return; }
      try {
        const m = state.menu || [];
        const r = await API.call('/supplier/vertaal', { teksten: m.map(x=>x.name), naar });
        MENU_VERTAAL.naar = r.naar; MENU_VERTAAL.map = {};
        m.forEach((x,i)=>{ MENU_VERTAAL.map[x.id] = r.teksten[i] || x.name; });
        renderKassa(); openTab('kassa');
      } catch(e){ toast(e.message); }
    });
    // luchtzijde: de boarding pass van de gast aan de deur of de balie checken
    const bp = $('#posPass'); if (bp) bp.addEventListener('click', async () => {
      const code = window.prompt(T('pos.passvraag','Boarding pass-code van de gast (bijv. VL-3F2A9C):'));
      if (!code) return;
      try {
        const r = await API.call('/supplier/lucht/pass', { code });
        toast(r.geldig
          ? ''+T('pos.passok','Geldig:')+' '+r.pass.naam+' · '+r.pass.vlucht+' '+r.pass.tijd+' · '+T('pos.stoel','stoel')+' '+r.pass.stoel+' · gate '+r.pass.gate
          : '✗ '+(r.reden||T('pos.passnee','Niet geldig.')));
      } catch(e){ toast(e.message); }
    });
    const codeInp = $('#posCode'); if (codeInp) codeInp.addEventListener('keydown', e => { if (e.key==='Enter') redeemCode(); });
    document.querySelectorAll('.js-checkout').forEach(b => b.addEventListener('click', async () => {
      try {
        const body = { room: b.dataset.room, method: b.dataset.method };
        if (body.method === 'rtgpay'){
          body.payCode = await vraagPayCode(); if (!body.payCode) return;
          body.idem = 'co' + Date.now();
        }
        const d = await API.call('/supplier/pos/checkout', body);
        toast(T('pos.checkedout','Uitgecheckt:')+' '+b.dataset.room+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')');
        await refresh(); openTab('kassa');
      } catch(e){ toast(e.message); }
    }));
  }

  async function redeemCode(){
    const inp = $('#posCode');
    const code = (inp.value||'').trim().toUpperCase();
    if (!code){ toast(T('pos.entercode','Voer een ophaalcode in.')); return; }
    const box = $('#posRedeemResult');
    try {
      const d = await API.call('/supplier/pos/redeem', { code });
      const o = d.order;
      box.innerHTML = '<div class="enroute here" style="margin-top:0.8rem;">✓ '+code+' · '+T('sup.guest','Gast')+' <b>'+o.codename+'</b> · '+
        o.items.map(i=>i.qty+'× '+i.name).join(', ')+' · '+eur(o.total)+
        (o.wasPaid ? ' · '+T('pos.waspaid','al betaald in de app') : ' · '+T('pos.chargedrtg','afgerekend via RTG'))+'</div>';
      inp.value = '';
      toast(T('pos.redeemed','Uitgegeven aan')+' '+o.codename+'.');
      await refresh(); openTab('kassa');
      $('#posRedeemResult').innerHTML = box.innerHTML;
    } catch(e){
      box.innerHTML = '<div class="enroute" style="margin-top:0.8rem;border-color:rgba(194,58,94,0.4);color:var(--burgundy);">'+e.message+'</div>';
      toast(e.message);
    }
  }

  async function paySale(type, method){
    let body = { method };

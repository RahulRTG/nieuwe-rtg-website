  function kassaHoreca(){
    const m = state.menu || [];
    if (!m.length) return '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('pos.nomenu','Zet eerst gerechten op de menukaart; die worden hier uw kassaknoppen.')+'</div></div>';
    const total = bonTotal();
    const pct = luchtPct();
    const lines = m.filter(x=>bon[x.id]).map(x=>'<div class="pos-line"><span>'+bon[x.id]+'× '+mNaam(x)+'</span><span>'+eur(x.price*bon[x.id])+(pct?' ·  '+eur(luchtPrijs(x.price)*bon[x.id]):'')+'</span></div>').join('');
    return '<div class="card"><div class="tt-h">'+T('pos.newbon','Nieuwe bon')+
      (pct?' <span style="font-size:0.64rem;color:var(--gold);letter-spacing:0.08em;">'+T('pos.luchtzijde','LUCHTZIJDE')+' +'+pct+'%</span>':'')+'</div>'+
      '<div class="pos-pay" style="margin:0.4rem 0 0.2rem;">'+
        '<button class="obtn" id="posVertaal">'+(MENU_VERTAAL.naar?MENU_VERTAAL.naar.toUpperCase():T('pos.vertaal','Vertaal de kaart'))+'</button>'+
        (pct?'<button class="obtn" id="posPass">'+T('pos.pass','Boarding pass')+'</button>':'')+
      '</div>'+
      '<div class="pos-grid">'+m.map(x=>'<button class="pos-key" data-pos="'+x.id+'"><b>'+mNaam(x)+'</b><span>'+eur(x.price)+(pct?' ·  '+eur(luchtPrijs(x.price)):'')+(bon[x.id]?' · '+bon[x.id]+'×':'')+'</span></button>').join('')+'</div>'+
      (lines?'<div class="pos-bon">'+lines+'<div class="pos-line total"><span>'+T('pos.total','Totaal')+'</span><span>'+eur(total)+(pct?' ·  '+eur(luchtPrijs(total)):'')+'</span></div>'+
        (pct?'<div style="font-size:0.68rem;color:var(--soft);margin-top:0.2rem;">'+T('pos.luchtsub','De gast betaalt de luchthavenprijs (); de bon draagt beide prijzen.')+'</div>':'')+'</div>':'')+
      '<div class="pos-pay">'+
        '<button class="obtn" id="posClear"'+(total?'':' disabled')+'>'+T('pos.clear','Leegmaken')+'</button>'+
        '<button class="obtn primary js-pay" data-method="rtgpay"'+(total?'':' disabled')+'>'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant"'+(total?'':' disabled')+'>'+T('pos.cash','Contant')+'</button>'+
      '</div>'+
      ((state.tables||[]).length ? '<div class="pos-pay" style="margin-top:0.4rem;">'+
        '<select id="posTafel" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;">'+
          '<option value="">'+T('pos.tafelkies','Tafel...')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name.replace(/"/g,'&quot;')+'">'+t.name+'</option>').join('')+'</select>'+
        '<button class="obtn js-pay" data-method="tafel"'+(total?'':' disabled')+'>'+T('pos.optafel','Op de tafel')+'</button>'+
      '</div>' : '')+
      '</div>'+
      // gast toont het oplichtende scherm; sla de code aan om de bestelling uit te geven
      '<div class="card"><div class="tt-h">'+T('pos.redeemh','RTG-ophaalcode innen')+'</div>'+
      '<div style="margin-top:0.4rem;font-size:0.78rem;color:var(--muted);">'+T('pos.redeemsub','De gast laat het oplichtende scherm zien. Sla de code aan; de bestelling wordt gekoppeld, zo nodig afgerekend en uitgegeven.')+'</div>'+
      '<div class="tt-add"><input id="posCode" placeholder="'+T('pos.codeph','Bijv. TBS9')+'" maxlength="4" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:0.2em;font-weight:700;"><button id="posScan" title="'+T('pos.scan','Scan de code')+'" aria-label="'+T('pos.scan','Scan de code')+'"></button><button id="posRedeem">'+T('pos.redeem','Innen')+'</button></div>'+
      '<div id="posRedeemResult"></div></div>';
  }

  // hotel: bedrag op de kamer zetten of direct afrekenen
  function kassaHotel(){
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


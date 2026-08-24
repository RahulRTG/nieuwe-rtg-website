/* de shift-samenvatting: het avondbriefingmoment */
    laadShift();
  }

  /* De shift-samenvatting: het avondbriefing-moment. Gasten, no-shows en
     walk-ins, de toppers van de dag, de derving en wie er op de kassa stond. */
  async function laadShift(){
    const el = $('#shiftWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/shift', {}); } catch(e){ return; }
    const heeftGasten = r.gasten.reserveringen || r.gasten.walkIns || r.gasten.noShows;
    if (!r.bonnen && !heeftGasten) { el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card"><div class="tt-h">'+T('shift.h','Shift-samenvatting')+'</div>'+
      (heeftGasten?'<div class="pos-chips h-mt40">'+
        '<span>'+r.gasten.personen+' '+T('shift.gasten','gasten aan tafel')+'</span>'+
        '<span>'+r.gasten.reserveringen+' '+T('shift.res','reservering(en)')+'</span>'+
        (r.gasten.walkIns?'<span>'+r.gasten.walkIns+' walk-in(s)</span>':'')+
        (r.gasten.noShows?'<span style="color:var(--burgundy);">✗ '+r.gasten.noShows+' no-show(s)</span>':'')+
      '</div>':'')+
      (r.verblijf?'<div class="pos-chips h-mt40">'+
        '<span>'+r.verblijf.bezet+' / '+r.verblijf.totaal+' '+T('rc.bezet','bezet')+'</span>'+
        (r.verblijf.aankomsten?'<span>'+r.verblijf.aankomsten+' '+T('shift.aank','check-in(s)')+'</span>':'')+
        (r.verblijf.vertrekken?'<span>'+r.verblijf.vertrekken+' '+T('shift.vertr','check-out(s)')+'</span>':'')+
        (r.verblijf.noShows?'<span style="color:var(--burgundy);">✗ '+r.verblijf.noShows+' no-show(s)</span>':'')+
        (r.verblijf.adr?'<span>ADR '+eur(r.verblijf.adr)+'</span>':'')+
      '</div>':'')+
      ((r.toppers||[]).length?'<div class="st-row h-mt40"><span>'+T('shift.toppers','Toppers')+'</span><span class="sub">'+r.toppers.map(t=>t.aantal+'× '+esc(t.naam)).join(' · ')+'</span></div>':'')+
      (r.derving?'<div class="st-row"><span>'+T('shift.derving','Derving (kostprijs)')+'</span><b style="color:var(--burgundy);">'+eur(r.derving)+'</b></div>':'')+
      ((r.team||[]).length?'<div class="st-row"><span>'+T('shift.team','Op de kassa')+'</span><span class="sub">'+r.team.map(t=>esc(t.naam)+' '+eur(t.omzet)).join(' · ')+'</span></div>':'')+
      '<div class="softline h-mt30">'+T('shift.s','Samen met het Z-rapport hierboven is dit de briefing voor morgen.')+'</div></div>';
  }

  /* De dagafsluiting (Z-rapport): omzet, bonnen, fooien en de btw-splitsing
     van vandaag, met de boekhoudexport (journaalregels als CSV) eronder. */
  async function laadZ(){
    const el = $('#zWrap'); if (!el) return;
    let r; try { r = await API.call('/supplier/dagrapport', {}); } catch(e){ return; }
    el.innerHTML = '<div class="card"><div class="tt-h">'+T('pos.z','Dagafsluiting (Z-rapport)')+'</div>'+
      '<div class="st-row"><span>'+T('pos.z.omzet','Omzet vandaag')+'</span><b>'+eur(r.omzet)+'</b></div>'+
      '<div class="st-row"><span>'+T('pos.z.bonnen','Bonnen')+'</span><b>'+r.bonnen+'</b></div>'+
      (r.fooien?'<div class="st-row"><span>'+T('pos.fooien','Fooien')+'</span><b>'+eur(r.fooien)+'</b></div>':'')+
      (r.btw||[]).map(b => '<div class="st-row"><span>'+esc(b.label)+' · '+b.tarief+'% btw</span><b>'+eur(b.omzet)+' <span class="sub">'+T('pos.z.waarvanbtw','waarvan btw')+' '+eur(b.btw)+'</span></b></div>').join('')+
      Object.entries(r.betaalwijzen||{}).map(([w, b2]) => '<div class="st-row"><span class="sub">'+T('pos.z.ontv','Ontvangsten')+' '+esc(methodLabel(w))+'</span><span class="sub">'+eur(b2)+'</span></div>').join('')+
      /* Openstaand gezet is GEEN ontvangst: die posten komen bij de check-out
         alsnog als bon langs. Ze stonden tot deze ronde tussen de ontvangsten,
         waardoor de som het dubbele van de lade was (TAKEN.md 4.54). */
      Object.entries(r.openstaandGezet||{}).map(([w, b2]) => '<div class="st-row"><span class="sub">'+T('pos.z.open','Openstaand gezet')+' '+esc(methodLabel(w))+'</span><span class="sub">'+eur(b2)+'</span></div>').join('')+
      '<button class="bigbtn" id="zCsv" class="h-mt50">'+T('pos.z.csv','Boekhoudexport (CSV)')+'</button>'+
      '<div class="softline h-mt30">'+T('pos.z.s','Journaalregels per btw-categorie en betaalwijze; in te lezen in Exact, Twinfield of Excel.')+'</div></div>';
    const k = el.querySelector('#zCsv');
    if (k) k.addEventListener('click', () => { API.download('/supplier/dagrapport.csv', { datum: r.datum }, 'dagrapport-' + r.datum + '.csv').catch(() => {}); });
  }

  // horeca: tik gerechten aan, bon loopt op, afrekenen met PIN of contant
  function kassaHoreca(){
    const m = state.menu || [];
    if (!m.length) return '<div class="card"><div style="font-size:0.84rem;color:var(--muted);">'+T('pos.nomenu','Zet eerst gerechten op de menukaart; die worden hier uw kassaknoppen.')+'</div></div>';
    const total = bonTotal();
    const pct = luchtPct();
    const lines = m.filter(x=>bon[x.id]).map(x=>'<div class="pos-line"><span>'+bon[x.id]+'× '+mNaam(x)+'</span><span>'+eur(x.price*bon[x.id])+(pct?' ·  '+eur(luchtPrijs(x.price)*bon[x.id]):'')+'</span></div>').join('');
    return '<div class="card"><div class="tt-h">'+T('pos.newbon','Nieuwe bon')+
      (pct?' <span style="font-size:0.64rem;color:var(--gold);letter-spacing:0.08em;">'+T('pos.luchtzijde','LUCHTZIJDE')+' +'+pct+'%</span>':'')+'</div>'+
      '<div class="pos-pay" style="margin:0.5rem 0 0.25rem;">'+
        '<button class="obtn" id="posVertaal">'+(MENU_VERTAAL.naar?MENU_VERTAAL.naar.toUpperCase():T('pos.vertaal','Vertaal de kaart'))+'</button>'+
        (pct?'<button class="obtn" id="posPass">'+T('pos.pass','Boarding pass')+'</button>':'')+
      '</div>'+
      '<div class="pos-grid">'+m.map(x=>'<button class="pos-key" data-pos="'+x.id+'"><b>'+mNaam(x)+'</b><span>'+eur(x.price)+(pct?' ·  '+eur(luchtPrijs(x.price)):'')+(bon[x.id]?' · '+bon[x.id]+'×':'')+'</span></button>').join('')+'</div>'+
      (lines?'<div class="pos-bon">'+lines+'<div class="pos-line total"><span>'+T('pos.total','Totaal')+'</span><span>'+eur(total)+(pct?' ·  '+eur(luchtPrijs(total)):'')+'</span></div>'+
        (pct?'<div style="font-size:0.68rem;color:var(--soft);margin-top:0.25rem;">'+T('pos.luchtsub','De gast betaalt de luchthavenprijs (); de bon draagt beide prijzen.')+'</div>':'')+'</div>':'')+
      '<div class="pos-pay">'+
        '<button class="obtn" id="posClear"'+(total?'':' disabled')+'>'+T('pos.clear','Leegmaken')+'</button>'+
        '<button class="obtn primary js-pay" data-method="rtgpay"'+(total?'':' disabled')+'>'+T('pos.payrtg','Afrekenen, RTG Pay')+'</button>'+
        '<button class="obtn js-pay" data-method="contant"'+(total?'':' disabled')+'>'+T('pos.cash','Contant')+'</button>'+
        '<button class="obtn js-pay" data-method="cadeaukaart"'+(total?'':' disabled')+'>'+T('pos.gc','Cadeaukaart')+'</button>'+
      '</div>'+
      ((state.tables||[]).length ? '<div class="pos-pay h-mt40">'+
        '<select id="posTafel" style="flex:1;background:var(--card2);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;font-size:0.85rem;color:var(--txt);outline:none;">'+
          '<option value="">'+T('pos.tafelkies','Tafel...')+'</option>'+
          (state.tables||[]).map(t=>'<option value="'+t.name.replace(/"/g,'&quot;')+'">'+t.name+'</option>').join('')+'</select>'+
        '<button class="obtn js-pay" data-method="tafel"'+(total?'':' disabled')+'>'+T('pos.optafel','Op de tafel')+'</button>'+
      '</div>' : '')+
      '</div>'+
      // gast toont het oplichtende scherm; sla de code aan om de bestelling uit te geven
      '<div class="card"><div class="tt-h">'+T('pos.redeemh','RTG-ophaalcode innen')+'</div>'+
      '<div style="margin-top:0.5rem;font-size:0.78rem;color:var(--muted);">'+T('pos.redeemsub','De gast laat het oplichtende scherm zien. Sla de code aan; de bestelling wordt gekoppeld, zo nodig afgerekend en uitgegeven.')+'</div>'+
      '<div class="tt-add"><input id="posCode" placeholder="'+T('pos.codeph','Bijv. TBS9')+'" maxlength="4" autocapitalize="characters" style="text-transform:uppercase;letter-spacing:0.2em;font-weight:700;"><button id="posScan" title="'+T('pos.scan','Scan de code')+'" aria-label="'+T('pos.scan','Scan de code')+'"></button><button id="posRedeem">'+T('pos.redeem','Innen')+'</button></div>'+
      '<div id="posRedeemResult"></div></div>';
  }

  // hotel: bedrag op de kamer zetten of direct afrekenen
  function kassaHotel(){

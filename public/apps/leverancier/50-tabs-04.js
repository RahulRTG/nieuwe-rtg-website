  // ---- rides (taxi/jet) ----
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond',
                      'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_NEXT_LABEL = { 'geaccepteerd':'sup.ride.accept', 'onderweg':'sup.ride.go', 'aangekomen':'sup.ride.atpickup', 'aan-boord':'sup.ride.driving', 'afgerond':'sup.ride.done' };
  const RIDE_NEXT_NL = { 'geaccepteerd':'Accepteer de rit', 'onderweg':'Ik rijd naar de gast', 'aangekomen':'Ik sta voor', 'aan-boord':'Gast aan boord', 'afgerond':'Rit afronden' };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  function ridePill(st){ return st==='aangevraagd'?'nieuw':RIT_KLAAR(st)?'klaar':'bereiding'; }
  function ritRegel(r){
    return (r.passengers?'👤 '+r.passengers+' ':'')+(r.luggage?'🧳 '+r.luggage+' ':'')+(r.km?'· '+r.km+' km ':'')+(r.quote?'· <b style="color:var(--gold);">'+eur(r.quote)+'</b>':'');
  }
  function renderRides(){
    const list = (state.rides || []).filter(r => !RIT_KLAAR(r.status));
    $('#rideList').innerHTML = list.length ? list.map(r => {
      const nxt = NEXT_RIDE[r.status];
      const eta = (r.status === 'aangevraagd' || r.status === 'onderweg')
        ? (r.pickupEtaMin != null ? '<div class="enroute">🚗 '+T('sup.pickupeta','Gast op ~')+r.pickupEtaMin+' '+T('sup.min','min')+' '+T('sup.rijden','rijden')+'.</div>' : '')
        : (r.status === 'rijdt' && r.dropEtaMin != null ? '<div class="enroute">🏁 '+T('sup.dropeta','Aankomst bestemming over ~')+r.dropEtaMin+' '+T('sup.min','min')+'.</div>' : '');
      return '<div class="order" data-rref="'+r.ref+'">'+
        '<div class="top"><div><div class="who">'+T('sup.guest','Gast')+' <span class="cn">'+r.customerCodename+'</span></div>'+
          '<div class="ref">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+' · '+timeAgo(r.at)+'</div></div>'+
          '<span class="pill '+ridePill(r.status)+'">'+tStatus(r.status)+'</span></div>'+
        '<div class="ref" style="margin-top:0.25rem;">'+ritRegel(r)+
          (r.driver?' · 🚘 '+r.driver.name+(r.vehicle?' ('+r.vehicle.name+')':''):' · <span style="color:var(--amber,#B8860B);">'+T('sup.ride.nodriver','nog geen chauffeur')+'</span>')+'</div>'+
        (r.note?'<div class="ref">📝 '+r.note+'</div>':'')+
        (r.zorg?'<div class="allergy">⚠ '+T('sup.zorgp','Zorgprofiel gast:')+' '+esc(zorgTekst(r.zorg))+'</div>':'')+
        eta +
        '<div class="acts">'+
          (nxt?'<button class="obtn primary js-rnext">'+T(RIDE_NEXT_LABEL[nxt], RIDE_NEXT_NL[nxt])+'</button>':'')+
          (r.status==='aangevraagd'?'<button class="obtn warn js-rreject">'+T('sup.reject','Weiger')+'</button>':'')+
        '</div>'+
      '</div>';
    }).join('') : '<div class="empty">'+T('sup.norides','Geen ritaanvragen. RTG-gasten die een rit boeken, verschijnen hier met bestemming en live locatie.')+'</div>';
    document.querySelectorAll('[data-rref]').forEach(el => {
      const ref = el.dataset.rref;
      const r = (state.rides||[]).find(x=>x.ref===ref);
      const nb = el.querySelector('.js-rnext'); if (nb) nb.addEventListener('click', ()=>setRideStatus(ref, NEXT_RIDE[r.status]));
      const rj = el.querySelector('.js-rreject'); if (rj) rj.addEventListener('click', ()=>setRideStatus(ref,'geweigerd'));
    });
  }
  async function setRideStatus(ref, status){
    try { await API.call('/supplier/ride/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- menu: bekijken voor iedereen, bewerken voor managers/chefs ----
  function renderMenu(){
    const el = $('#menuList'); if (!el) return;
    const m = state.menu || [];
    const canEdit = actor().manager;
    const cats = [...new Set(m.map(x=>x.cat))];
    let html = m.length ? cats.map(c =>
      '<div class="menu-cat">'+c+'</div>' + m.filter(x=>x.cat===c).map(x =>
        '<div class="mitem"><div class="r1"><span class="nm">'+x.name+'</span><span class="row-mid-gap">'+
        (canEdit?'<button class="mn-station" data-mst="'+x.id+'">'+(x.station==='bar'?'\uD83C\uDF78 bar':'\uD83D\uDD25 '+T('menu.keuken','keuken'))+'</button>':'<span class="soft-xs">'+(x.station==='bar'?'\uD83C\uDF78':'\uD83D\uDD25')+'</span>')+
        '<span class="pr">'+eur(x.price)+'</span>'+
        (canEdit?'<button class="rr-del" data-mdel="'+x.id+'">✕</button>':'')+'</span></div>'+
        (x.desc?'<div class="ds">'+x.desc+'</div>':'')+
        (x.allergens&&x.allergens.length?'<div class="alg">'+x.allergens.map(a=>'<span>'+tAlg(a)+'</span>').join('')+'</div>':'')+
        '</div>'
      ).join('')
    ).join('') : '<div class="empty">'+T('sup.nomenu','Nog geen menukaart. Voeg gerechten toe zodat gasten vooraf kunnen bestellen.')+'</div>';
    if (canEdit){
      html += '<div class="card" style="margin-top:1.2rem;"><div class="tt-h">'+T('menu.add','Gerecht toevoegen')+'</div>'+
        '<div class="field"><label>'+T('menu.name','Naam')+'</label><input id="mnName" placeholder="'+T('menu.nameph','Bijv. gegrilde octopus')+'"></div>'+
        '<div class="row-gap"><div class="field" style="flex:2;"><label>'+T('menu.cat','Categorie')+'</label><input id="mnCat" placeholder="'+T('menu.catph','Bijv. Voorgerechten')+'"></div>'+
        '<div class="field" style="flex:1;"><label>'+T('menu.price','Prijs (€)')+'</label><input id="mnPrice" type="number" inputmode="decimal" placeholder="45"></div></div>'+
        '<div class="field"><label>'+T('menu.desc','Omschrijving')+'</label><input id="mnDesc" placeholder="'+T('menu.descph','Kort en smakelijk')+'"></div>'+
        '<div class="field"><label>'+T('menu.alg','Allergenen (komma\'s)')+'</label><input id="mnAlg" placeholder="vis, soja"></div>'+
        '<div class="field"><label>'+T('menu.station','Werkplek')+'</label><select id="mnStation" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
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
      const item = { id: 'm'+Date.now().toString(36), cat: $('#mnCat').value.trim()||T('menu.other','Overig'), name, desc: $('#mnDesc').value.trim(), price, allergens: $('#mnAlg').value.split(',').map(a=>a.trim().toLowerCase()).filter(Boolean), station: $('#mnStation') ? $('#mnStation').value : 'keuken' };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); toast(T('menu.added','Staat op de kaart, gasten zien het direct.')); await refresh(); openTab('menu'); } catch(e){ toast(e.message); }
    });
  }

  // ---- dynamische prijs ----

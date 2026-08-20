/* een tafel afrekenen */
    wrap.querySelectorAll('[data-tafelrek]').forEach(el => {
      const rekenAf = async (extra) => {
        try {
          const body = Object.assign({ room: el.dataset.tafelrek }, extra);
          if (body.method === 'rtgpay'){
            body.payCode = await vraagPayCode(); if (!body.payCode) return;
            body.idem = RTGIdem('trek');
          }
          const d = await API.call('/supplier/pos/checkout', body);
          let boodschap = T('res.rekklaar','Rekening afgerekend:')+' '+el.dataset.tafelrek+', '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+')';
          if (d.gesplitst) boodschap += ' · '+T('res.gesplitst','gesplitst met')+' '+d.gesplitst.vrienden+' ('+eur(d.gesplitst.perPersoon/100)+' p.p.)';
          if (d.splitsFout) boodschap += ' · '+d.splitsFout;
          toast(boodschap);
          await refresh(); renderReserveringen();
        } catch(e){ toast(e.message); }
      };
      el.querySelectorAll('.js-rekpay').forEach(b => b.addEventListener('click', () => rekenAf({ method: b.dataset.method })));
      // splitsen: een gast betaalt het geheel met RTG Pay, de tafelgenoten
      // krijgen meteen een Klompje voor hun deel, uit naam van de betaler
      const sp = el.querySelector('.js-reksplit'); if (sp) sp.addEventListener('click', () => {
        const namen = window.prompt(T('res.splitswie','Codenamen van de tafelgenoten (met komma); de betaler tikt zo zijn code:'));
        if (!namen) return;
        rekenAf({ method: 'rtgpay', splitsMet: namen.split(',').map(x => x.trim()).filter(Boolean) });
      });
    });
    wrap.querySelectorAll('.js-walkin').forEach(b => b.addEventListener('click', async () => {
      const p = window.prompt(T('res.walkinp','Walk-in aan '+b.dataset.tafel+': met hoeveel personen?'), '2');
      if (!p) return;
      try { await API.call('/supplier/walkin', { tafel: b.dataset.tafel, personen: Number(p) }); toast(''+T('res.walkintoast','Walk-in geplaatst.')); renderReserveringen(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-res]').forEach(el => {
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, body); if (boodschap) toast(boodschap); await refresh(); }
        catch(e){ toast(e.message); }
      };
      const id = el.dataset.res;
      const ok = el.querySelector('.js-resok'); if (ok) ok.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'bevestig' }, ''+T('res.oktoast','Reservering bevestigd; de gast hoort het meteen.')));
      const nee = el.querySelector('.js-resnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'weiger' }, T('res.neetoast','Reservering geweigerd.')));
      const tf = el.querySelector('.js-restafel'); if (tf) tf.addEventListener('click', () => {
        const namen = plan.tafels.map(t => t.name);
        const keuze = window.prompt(T('res.tafelp','Welke tafel?')+' ('+namen.join(', ')+')');
        if (keuze) doe('/supplier/reservering/tafel', { id, tafel: keuze.trim() }, ''+T('res.tafeltoast','Tafel toegewezen; de gast krijgt bericht.'));
      });
      const er = el.querySelector('.js-reser'); if (er) er.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'aangekomen' }, T('res.ertoast','Welkom; de tafel staat op bezet.')));
      const no = el.querySelector('.js-resno'); if (no) no.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'no-show' }, T('res.noshowtoast','Gemeld als no-show; de tafel is weer vrij.')));
      const weg = el.querySelector('.js-resweg'); if (weg) weg.addEventListener('click', () => doe('/supplier/reservering/komst', { id, actie:'vertrokken' }, T('res.wegtoast','Afgerond; de tafel is weer vrij.')));
    });
  }
  async function setStatus(ref, status){
    try { await API.call('/supplier/order/status', {ref, status}); toast(T('sup.status','Status:')+' '+tStatus(status)); await refresh(); }
    catch(e){ toast(e.message); }
  }
  async function refund(ref){
    try { const d = await API.call('/supplier/refund', {ref}); toast(T('sup.refundedtoast','Terugbetaald:')+' '+eur(d.order.total)); await refresh(); }
    catch(e){ toast(e.message); }
  }

  // ---- rides (taxi/jet) ----
  const NEXT_RIDE = { 'aangevraagd':'geaccepteerd', 'geaccepteerd':'onderweg', 'onderweg':'aangekomen', 'aangekomen':'aan-boord', 'aan-boord':'afgerond',
                      'rijdt':'afgerond', 'gearriveerd':null };
  const RIDE_NEXT_LABEL = { 'geaccepteerd':'sup.ride.accept', 'onderweg':'sup.ride.go', 'aangekomen':'sup.ride.atpickup', 'aan-boord':'sup.ride.driving', 'afgerond':'sup.ride.done' };
  const RIDE_NEXT_NL = { 'geaccepteerd':'Accepteer de rit', 'onderweg':'Ik rijd naar de gast', 'aangekomen':'Ik sta voor', 'aan-boord':'Gast aan boord', 'afgerond':'Rit afronden' };
  const RIT_KLAAR = st => st === 'gearriveerd' || st === 'afgerond' || st === 'geweigerd';
  function ridePill(st){ return st==='aangevraagd'?'nieuw':RIT_KLAAR(st)?'klaar':'bereiding'; }
  function ritRegel(r){
    return (r.passengers?''+r.passengers+' ':'')+(r.luggage?''+r.luggage+' ':'')+(r.km?'· '+r.km+' km ':'')+(r.quote?'· <b style="color:var(--rtg-leesgoud,var(--gold));">'+eur(r.quote)+'</b>':'');
  }
  function renderRides(){
    const list = (state.rides || []).filter(r => !RIT_KLAAR(r.status));
    $('#rideList').innerHTML = list.length ? list.map(r => {
      const nxt = NEXT_RIDE[r.status];
      const eta = (r.status === 'aangevraagd' || r.status === 'onderweg')
        ? (r.pickupEtaMin != null ? '<div class="enroute">'+T('sup.pickupeta','Gast op ~')+r.pickupEtaMin+' '+T('sup.min','min')+' '+T('sup.rijden','rijden')+'.</div>' : '')
        : (r.status === 'rijdt' && r.dropEtaMin != null ? '<div class="enroute">'+T('sup.dropeta','Aankomst bestemming over ~')+r.dropEtaMin+' '+T('sup.min','min')+'.</div>' : '');
      return '<div class="order" data-rref="'+r.ref+'">'+
        '<div class="top"><div><div class="who">'+T('sup.guest','Gast')+' <span class="cn">'+r.customerCodename+'</span></div>'+
          '<div class="ref">'+(r.from||'')+' → '+(r.to||T('sup.opendest','open bestemming'))+' · '+timeAgo(r.at)+'</div></div>'+
          '<span class="pill '+ridePill(r.status)+'">'+tStatus(r.status)+'</span></div>'+
        '<div class="ref h-mt25">'+ritRegel(r)+
          (r.driver?' ·  '+r.driver.name+(r.vehicle?' ('+r.vehicle.name+')':''):' · <span style="color:var(--amber,#B8860B);">'+T('sup.ride.nodriver','nog geen chauffeur')+'</span>')+'</div>'+
        (r.note?'<div class="ref">'+r.note+'</div>':'')+
        (r.zorg?'<div class="allergy">'+T('sup.zorgp','Zorgprofiel gast:')+' '+esc(zorgTekst(r.zorg))+'</div>':'')+
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

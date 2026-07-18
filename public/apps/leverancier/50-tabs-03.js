  function resRij(r, vandaag){
    const knoppen = [];
    if (r.status === 'aangevraagd') knoppen.push('<button class="obtn primary js-resok">'+T('res.ok','Bevestig')+'</button>','<button class="obtn warn js-resnee">'+T('sup.reject','Weiger')+'</button>');
    if (r.status === 'bevestigd'){
      knoppen.push('<button class="obtn js-restafel">🪑 '+(r.tafel?esc(r.tafel):T('res.tafel','Tafel'))+'</button>');
      if (vandaag) knoppen.push('<button class="obtn primary js-reser">'+T('res.er','Gast is er')+'</button>','<button class="obtn warn js-resno">'+T('res.noshow','No-show')+'</button>');
    }
    if (r.status === 'aangekomen') knoppen.push('<button class="obtn js-resweg">'+T('res.weg','Vertrokken')+'</button>');
    return '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-res="'+r.id+'">'+
      '<span><b>'+r.tijd+'</b> · <b class="cn">'+esc(r.customerCodename)+'</b> · '+r.personen+'p'+
        (r.tafel?' · 🪑 '+esc(r.tafel):'')+(r.notitie?' · 📝 '+esc(r.notitie):'')+(vandaag?'':' · '+r.datum)+
        (r.zorg?'<span style="display:block;color:#E2B93B;">⚠ '+esc(zorgTekst(r.zorg))+'</span>':'')+'</span>'+
      (knoppen.length
        ? '<span style="display:flex;gap:0.4rem;flex-shrink:0;">'+knoppen.join('')+'</span>'
        : '<span class="pill '+(RES_PILL[r.status]||'klaar')+'" style="flex-shrink:0;">'+resStatusTekst(r.status)+'</span>')+
    '</div>';
  }
  async function renderReserveringen(){
    const wrap = $('#resWrap');
    if (!wrap) return;
    const later = (state.reserveringen || []).filter(r => r.datum > new Date().toISOString().slice(0,10) && ['aangevraagd','bevestigd'].includes(r.status));
    let plan = null;
    try { plan = await API.call('/supplier/tafelplan', {}); } catch(e){ plan = { reserveringen: [], tafels: [], verwachtePersonen: 0, openAanvragen: 0, zonderTafel: 0 }; }
    if (!plan.reserveringen.length && !later.length && !plan.tafels.length){ wrap.innerHTML = ''; return; }
    const chips = plan.tafels.length
      ? '<div class="pos-chips" style="margin-top:0.5rem;">'+plan.tafels.map(t =>
          t.status==='vrij'
            ? '<span><button class="obtn js-walkin" data-tafel="'+esc(t.name)+'" style="padding:0.15rem 0.5rem;">'+esc(t.name)+' · '+T('res.vrij','vrij')+'</button></span>'
            : '<span>'+esc(t.name)+' · '+t.status+(t.reserveringen.length?' · '+t.reserveringen.join(', '):'')+(t.rekening?' · '+eur(t.rekening.totaal):'')+'</span>'
        ).join('')+'</div>'+
        '<div class="softline" style="margin-top:0.3rem;">'+T('res.walkins','Een vrije tafel aantikken plaatst een walk-in.')+'</div>'
      : '';
    // de open rekeningen: alles wat de kassa op de tafel zette, hier afrekenen
    const rekeningen = plan.tafels.filter(t => t.rekening);
    const rekBlok = rekeningen.length
      ? rekeningen.map(t => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.6rem;margin-top:0.55rem;font-size:0.82rem;flex-wrap:wrap;" data-tafelrek="'+esc(t.name)+'">'+
          '<span><b>'+esc(t.name)+'</b> · '+t.rekening.posten+' '+T('pos.posts','post(en)')+' · <b style="color:var(--gold);">'+eur(t.rekening.totaal)+'</b></span>'+
          '<span style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;">'+
            '<button class="obtn primary js-rekpay" data-method="rtgpay">RTG Pay</button>'+
            '<button class="obtn js-reksplit">'+T('res.splits','Splits')+'</button>'+
            '<button class="obtn js-rekpay" data-method="contant">'+T('pos.cash','Contant')+'</button></span>'+
        '</div>').join('')
      : '';
    wrap.innerHTML = '<div class="card"><div class="tt-h">🪑 '+T('res.vandaag','Tafelplanning vandaag')+'</div>'+
      '<div class="pos-chips" style="margin-top:0.4rem;">'+
        '<span>👥 '+plan.verwachtePersonen+' '+T('res.verwacht','verwacht')+'</span>'+
        (plan.openAanvragen?'<span>✋ '+plan.openAanvragen+' '+T('res.open','open aanvraag(en)')+'</span>':'')+
        (plan.zonderTafel?'<span>🪑 '+plan.zonderTafel+' '+T('res.zonder','zonder tafel')+'</span>':'')+
      '</div>'+chips+rekBlok+
      (plan.reserveringen.length ? plan.reserveringen.map(r => resRij(r, true)).join('') : '<div class="softline" style="margin-top:0.5rem;">'+T('res.leeg','Nog geen reserveringen voor vandaag.')+'</div>')+
      '</div>'+
      (later.length ? '<div class="card"><div class="tt-h">🗓 '+T('res.later','Komende dagen')+'</div>'+later.map(r => resRij(r, false)).join('')+'</div>' : '');
    // een open rekening afrekenen: RTG Pay (met tap to pay) of contant, tafel weer vrij
    wrap.querySelectorAll('[data-tafelrek]').forEach(el => {
      const rekenAf = async (extra) => {
        try {
          const body = Object.assign({ room: el.dataset.tafelrek }, extra);
          if (body.method === 'rtgpay'){
            body.payCode = await vraagPayCode(); if (!body.payCode) return;
            body.idem = 'trek' + Date.now();
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
      try { await API.call('/supplier/walkin', { tafel: b.dataset.tafel, personen: Number(p) }); toast('🪑 '+T('res.walkintoast','Walk-in geplaatst.')); renderReserveringen(); }
      catch(e){ toast(e.message); }
    }));
    wrap.querySelectorAll('[data-res]').forEach(el => {
      const doe = async (pad, body, boodschap) => {
        try { await API.call(pad, body); if (boodschap) toast(boodschap); await refresh(); }
        catch(e){ toast(e.message); }
      };
      const id = el.dataset.res;
      const ok = el.querySelector('.js-resok'); if (ok) ok.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'bevestig' }, '🪑 '+T('res.oktoast','Reservering bevestigd; de gast hoort het meteen.')));
      const nee = el.querySelector('.js-resnee'); if (nee) nee.addEventListener('click', () => doe('/supplier/reservering/beslis', { id, action:'weiger' }, T('res.neetoast','Reservering geweigerd.')));
      const tf = el.querySelector('.js-restafel'); if (tf) tf.addEventListener('click', () => {
        const namen = plan.tafels.map(t => t.name);
        const keuze = window.prompt(T('res.tafelp','Welke tafel?')+' ('+namen.join(', ')+')');
        if (keuze) doe('/supplier/reservering/tafel', { id, tafel: keuze.trim() }, '🪑 '+T('res.tafeltoast','Tafel toegewezen; de gast krijgt bericht.'));
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


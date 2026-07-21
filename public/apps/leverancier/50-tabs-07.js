  function bindKassa(type){
    document.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.pos; bon[id] = (bon[id]||0)+1; renderKassa(); openTab('kassa');
    }));
    const clear = $('#posClear'); if (clear) clear.addEventListener('click', () => { bon = {}; renderKassa(); openTab('kassa'); });
    document.querySelectorAll('.js-pay').forEach(b => b.addEventListener('click', () => paySale(type, b.dataset.method)));
    const redeem = $('#posRedeem'); if (redeem) redeem.addEventListener('click', redeemCode);
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
          ? '✈ '+T('pos.passok','Geldig:')+' '+r.pass.naam+' · '+r.pass.vlucht+' '+r.pass.tijd+' · '+T('pos.stoel','stoel')+' '+r.pass.stoel+' · gate '+r.pass.gate
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
    if (type==='restaurant'||type==='bar'||type==='club'){
      const items = (state.menu||[]).filter(m=>bon[m.id]).map(m=>({ name:m.name, qty:bon[m.id], price:m.price }));
      if (!items.length){ toast(T('pos.empty','Tik eerst gerechten aan.')); return; }
      body.items = items; body.total = bonTotal();
      if (method === 'tafel'){
        body.room = (($('#posTafel')||{}).value||'');
        if (!body.room){ toast(T('pos.kiestafel','Kies eerst een tafel.')); return; }
      }
    } else {
      body.total = Number(($('#posAmt')||{}).value);
      body.desc = (($('#posDesc')||{}).value||'').trim();
      const room = ($('#posRoom')||{}).value;
      if (room) body.room = room;
      if (!(body.total>0)){ toast(T('pos.fillamount','Vul een bedrag in.')); return; }
    }
    if (method === 'rtgpay'){
      body.payCode = await vraagPayCode(); if (!body.payCode) return;
      body.idem = 'pos' + Date.now();
    }
    try {
      const d = await API.call('/supplier/pos/sale', body);
      bon = {};
      toast(T('pos.done','Afgerekend:')+' '+eur(d.sale.total)+' ('+methodLabel(d.sale.method)+'), '+T('pos.bonnr','bon')+' '+d.sale.bon+
        (d.sale.betaaldienstKosten ? ' · '+T('pos.kosten','betaaldienst')+' '+eur(d.sale.betaaldienstKosten/100)+' '+T('pos.kostendirect','direct verrekend') : ''));
      await refresh(); openTab('kassa');
    } catch(e){ toast(e.message); }
  }

  // ---- kamers (hotel/appartement): beschikbaarheid + housekeeping ----
  const HK_LABEL = { schoon:'Schoon', vuil:'Vuil', bezig:'Bezig', bezet:'Bezet', defect:'Defect' };
  const HK_LABEL_EN = { schoon:'Clean', vuil:'Dirty', bezig:'In progress', bezet:'Occupied', defect:'Out of order' };
  const tHk = s => (lang() === 'en' ? (HK_LABEL_EN[s] || s) : (HK_LABEL[s] || s));
  let hkDefectFor = null; // kamer-id waarvoor de defect-notitie openstaat
  // ---- tickets: dagprogramma, entree-check en aanbodbeheer ----
  let programma = null;
  async function laadProgramma(){
    if (!has('tickets') || !API.live) return;
    try { programma = await API.call('/supplier/programma', {}); } catch(e){ programma = { datum: '', slots: [] }; } // nooit null laten: dat zou opnieuw laden blijven aanroepen
    renderTickets();
  }

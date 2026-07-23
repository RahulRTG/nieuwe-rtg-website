      const veld = document.getElementById('trVan-' + b.dataset.trvraag);
      try {
        const r = await API.call('/transfer/aanvraag', { ticketRef: b.dataset.trvraag, van: veld ? veld.value : '' });
        if (Number(b.dataset.trprijs) > 0) await API.call('/ride/pay', { ref: r.ride.ref });
        toast(T('tk.tr.ok','Transfer aangevraagd. U ziet hier wie u komt halen.'));
        laadTickets();
      } catch(e){ toast(e.message); }
    }));
    renderTkAanbod();
  }
  function renderTkAanbod(){
    const el = $('#tkAanbod'); if (!el) return;
    if (!tkPartners.length){ el.innerHTML = ''; return; }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('tk.kop','Activiteiten, tours en musea')+'</div>';
    for (const p of tkPartners){
      html += '<div class="card"><b>'+esc(p.name)+'</b> <span class="soft-sm">\u00B7 '+esc(p.city||'')+'</span>';
      for (const a of p.activiteiten){
        const open = tkOpen === p.code + ':' + a.id;
        html += '<div style="margin-top:0.7rem;border-top:1px solid var(--line);padding-top:0.6rem;">'+
          '<div style="display:flex;justify-content:space-between;gap:0.5rem;"><div style="flex:1;"><div style="font-size:0.88rem;">'+esc(a.name)+'</div>'+
          (a.desc?'<div class="soft-sm">'+esc(a.desc)+(a.duur?' \u00B7 '+esc(a.duur):'')+'</div>':'')+'</div>'+
          '<span style="color:var(--gold);font-size:0.82rem;white-space:nowrap;">'+eur(a.prijs)+' p.p.</span></div>';
        if (open){
          const k = tkKeuze;
          const dagen = [];
          for (let d = 0; d < 7; d++){ const dt = new Date(Date.now() + d * 86400000).toISOString().slice(0, 10); dagen.push(dt); }
          html += '<div style="margin-top:0.5rem;">'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;">'+dagen.map(d =>
              '<button class="bz-btn'+(k.datum===d?' on':'')+'" data-tkd="'+d+'">'+(d===dagen[0]?T('tk.vandaag','vandaag'):d.slice(8)+'/'+d.slice(5,7))+'</button>').join('')+'</div>'+
            '<div style="display:flex;gap:0.35rem;flex-wrap:wrap;margin-top:0.45rem;">'+(a.tijden||[]).map(t2 =>
              '<button class="bz-btn'+(k.tijd===t2?' on':'')+'" data-tkt="'+t2+'">'+t2+'</button>').join('')+'</div>'+
            '<div style="display:flex;align-items:center;gap:0.6rem;margin-top:0.55rem;">'+
            '<span style="font-size:0.78rem;color:var(--muted);">'+T('tk.personen','Personen')+'</span>'+
            '<button class="bz-btn" data-tkp="-1" style="padding:0.2rem 0.7rem;">\u2212</button><b>'+k.personen+'</b><button class="bz-btn" data-tkp="1" style="padding:0.2rem 0.7rem;">+</button></div>'+
            '<button class="bz-groot" id="tkKoop" style="margin-top:0.7rem;"'+(k.tijd?'':' disabled')+'>'+T('tk.koop','Koop tickets')+' \u00B7 '+eur(a.prijs * k.personen)+'</button></div>';
        } else {
          html += '<button class="bz-btn" data-tkopen="'+p.code+':'+a.id+'" style="margin-top:0.45rem;">'+T('tk.kies','Kies datum en tijd')+'</button>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    el.innerHTML = html;
    document.querySelectorAll('[data-tkopen]').forEach(b => b.addEventListener('click', () => {
      tkOpen = b.dataset.tkopen;
      tkKeuze = { datum: new Date().toISOString().slice(0, 10), tijd: null, personen: 2 };
      renderTkAanbod();
    }));
    document.querySelectorAll('[data-tkd]').forEach(b => b.addEventListener('click', () => { tkKeuze.datum = b.dataset.tkd; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkt]').forEach(b => b.addEventListener('click', () => { tkKeuze.tijd = b.dataset.tkt; renderTkAanbod(); }));
    document.querySelectorAll('[data-tkp]').forEach(b => b.addEventListener('click', () => {
      tkKeuze.personen = Math.min(10, Math.max(1, tkKeuze.personen + Number(b.dataset.tkp))); renderTkAanbod();
    }));
    const koop = document.getElementById('tkKoop');
    if (koop) koop.addEventListener('click', async () => {
      const [code, actId] = tkOpen.split(':');
      try {
        const t = await API.call('/ticket/koop', { supplierCode: code, activiteitId: actId, datum: tkKeuze.datum, tijd: tkKeuze.tijd, personen: tkKeuze.personen });
        await API.call('/booking/pay', { ref: t.ticket.ref });
        toast(T('tk.ok','Betaald! Uw entreecode: ') + t.ticket.code);
        tkOpen = null; tkKeuze = null;
        laadTickets();
      } catch(e){ toast(e.message); }
    });
  }

  /* ---------- Toren 4: Zorg & welzijn (RTG Care) ----------
     Een eigen tab: mijn boekingen, mijn intake-delingen, herstelpakketten
     en het aanbod van spa's, wellness en klinieken. Boeken kiest een dag en
     tijdslot bij een behandelaar; betalen loopt via RTG Pay. Het zorgprofiel
     reist automatisch mee; medische context deelt het lid apart en per
     aanbieder, met een einddatum en altijd te stoppen. */
  let careOv = null, careOpen = null, careKeuze = null, careIntakeTekst = {};
  let carePak = [], carePakMijn = [], carePakOpen = null, carePakKeuze = null;
  const careSoort = { spa: 'Spa', wellness: 'Wellness', kliniek: 'Kliniek' };
  async function laadCare(){
    if (!API.live) return;
    try { careOv = await API.call('/care', {}); } catch(e){ careOv = null; }
    let mijn = [];
    try { mijn = (await API.call('/care/mijn', {})).boekingen || []; } catch(e){}
    try { carePak = (await API.call('/care/pakketten', {})).pakketten || []; } catch(e){ carePak = []; }
    try { carePakMijn = (await API.call('/care/pakket/mijn', {})).pakketten || []; } catch(e){ carePakMijn = []; }
    renderCareMijn(mijn);
    renderCareIntakes();
    renderCarePakketten();
    renderCareAanbod();
  }
  function renderCareMijn(mijn){
    const el = $('#careMijn'); if (!el) return;
    if (!mijn.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:0 0 0.5rem;">'+T('care.mijn','Mijn afspraken')+'</div>'+
      mijn.map(b => '<div class="card" style="border-color:rgba(139,195,168,0.35);">'+
        '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--green,#8bc3a8);">'+esc(b.aanbiederNaam)+'</div>'+
        '<div style="margin-top:0.35rem;font-size:0.92rem;"><b>'+esc(b.behandelingNaam)+'</b>'+(b.behandelaarNaam?' · '+esc(b.behandelaarNaam):'')+'</div>'+
        '<div class="soft-sm" style="margin-top:0.15rem;">'+b.datum+' · '+b.tijd+' · '+eur(b.prijs)+' · '+
          (b.paid ? '<span style="color:var(--green,#8bc3a8);">'+T('care.betaald','betaald')+'</span>' : '<span style="color:var(--gold);">'+T('care.tebetalen','nog te betalen')+'</span>')+'</div>'+
        '<div style="display:flex;gap:0.4rem;margin-top:0.55rem;">'+
          (b.paid ? '' : '<button class="bz-groot" data-care-pay="'+esc(b.ref)+'" style="flex:1;">'+T('care.betaal','Betaal')+' · '+eur(b.prijs)+'</button>')+
          '<button class="bz-btn" data-care-annul="'+esc(b.ref)+'">'+T('care.annuleer','Annuleer')+'</button>'+
        '</div></div>').join('');
    el.querySelectorAll('[data-care-pay]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/betaal', { ref: x.dataset.carePay }); toast(T('care.paytoast','Betaald. Tot uw afspraak.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-care-annul]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/annuleer', { ref: x.dataset.careAnnul }); toast(T('care.annultoast','Afspraak geannuleerd.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareIntakes(){
    const el = $('#careIntakes'); if (!el) return;
    const list = (careOv && careOv.intakes) || [];
    if (!list.length){ el.innerHTML = ''; return; }
    el.innerHTML = '<div class="card" style="border-color:rgba(208,172,87,0.3);">'+
      '<div style="font-size:0.62rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);">'+T('care.intakes','Gedeelde medische context')+'</div>'+
      list.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;margin-top:0.5rem;">'+
        '<div style="font-size:0.85rem;">'+esc(i.aanbiederNaam)+'<div class="soft-sm">'+T('care.tot','tot')+' '+i.vervaltOp+'</div></div>'+
        '<button class="bz-btn" data-care-intakestop="'+esc(i.id)+'">'+T('care.stopdelen','Stop delen')+'</button></div>').join('')+
      '</div>';
    el.querySelectorAll('[data-care-intakestop]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/care/intake/stop', { id: x.dataset.careIntakestop }); toast(T('care.stoptoast','Deling gestopt. Weg is weg.')); laadCare(); }
      catch(e){ toast(e.message); }
    }));
  }
  function renderCareAanbod(){
    const el = $('#careAanbod'); if (!el) return;
    const aanb = (careOv && careOv.aanbieders) || [];
    if (!aanb.length){ el.innerHTML = ''; return; }
    const dagen = [];
    for (let d = 0; d < 7; d++){ dagen.push(new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)); }
    let html = '<div style="font-size:0.66rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--soft);margin:1.1rem 0 0.5rem;">'+T('care.aanbod','Spa’s, wellness en klinieken')+'</div>';

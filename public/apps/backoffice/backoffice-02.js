  // ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ----
  async function loadIncidenten(){
    const el = document.getElementById('incidenten'); if (!el) return;
    let inc = [];
    try { inc = (await call('/office/incidenten', { alleen: 'open' })).incidenten || []; } catch(e){ return; }
    el.innerHTML = inc.length ? inc.map(i =>
      '<div class="vrow" data-id="'+i.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(i.codenaam||'\u2013')+' <span class="s-1caek87">· '+escHtml(i.supplierName)+' · '+escHtml(i.gevraagdNiveau)+'</span></div>' +
          '<div class="sub">'+escHtml(i.reden)+'</div></div>' +
        '<button class="vbtn ok" data-vrij>'+T('bo.release','Vrijgeven')+'</button>' +
        '<button class="vbtn no" data-afw>'+T('bo.declineinc','Afwijzen')+'</button>' +
      '</div>').join('') : '<div class="empty">'+T('bo.noinc','Geen openstaande incidenten.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-vrij]').addEventListener('click', () => decideInc(id, 'vrijgeven'));
      row.querySelector('[data-afw]').addEventListener('click', () => decideInc(id, 'afwijzen'));
    });
  }
  async function decideInc(id, besluit){
    try { await call('/office/incident/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadIncidenten();
  }

  // ---- Salon-naleving: welke partners hebben (g)een compleet profiel ----
  async function loadSalonNaleving(){
    const el = document.getElementById('salonNaleving'); if (!el) return;
    let d;
    try { d = await call('/office/salon-naleving', {}); } catch(e){ return; }
    const kop = '<div class="vrow"><div class="vi"><div class="nm">'+d.compleet+' / '+d.totaal+' '+T('bo.saloncompleet','profielen compleet')+'</div>'+
      '<div class="sub">'+(d.achter.length ? d.achter.length+' '+T('bo.salonachter','partner(s) nog niet zichtbaar voor leden') : T('bo.salonok','alle partners zijn zichtbaar'))+'</div></div></div>';
    const rows = (d.partners || []).map(p =>
      '<div class="vrow"><div class="vi"><div class="nm">'+(p.compleet?'✓':'⚠')+' '+escHtml(p.name)+' <span class="s-1caek87">· '+escHtml(p.type)+'</span></div>'+
      '<div class="sub">'+(p.bio?'✓':'✗')+' bio · '+(p.foto?'✓':'✗')+' foto · '+p.items+' '+T('bo.salonitems','items')+' · '+p.volgers+' '+T('bo.salonvolgers','volgers')+'</div></div></div>').join('');
    el.innerHTML = kop + rows;
  }

  // ---- Salon-ontmoetingen: lopende afspraken met live-locatie en SOS ----
  async function loadOntmoetingen(){
    const el = document.getElementById('ontmoetOffice'); if (!el) return;
    let d;
    try { d = await call('/office/ontmoetingen', {}); } catch(e){ return; }
    if (!d.dates || !d.dates.length){ el.innerHTML = '<div class="empty">'+T('bo.ontgeen','Geen lopende afspraken.')+'</div>'; return; }
    el.innerHTML = d.dates.map(dt => {
      const nood = dt.sos && dt.sos.length;
      const namen = dt.deelnemers.map(p => escHtml(p.codenaam) + (p.getekend ? ' ✓' : '')).join(' · ');
      const pos = dt.deelnemers.filter(p => p.pos).map(p => escHtml(p.codenaam) + ': ' + p.pos.lat.toFixed(4) + ', ' + p.pos.lng.toFixed(4)).join(' · ') || T('bo.ontgeenpos','nog geen locatie');
      const status = dt.status === 'noodgeval' ? ''+T('bo.ontnood','NOODGEVAL') : dt.status === 'actief' ? ''+T('bo.ontactief','loopt') : ''+T('bo.onttekenen','wacht op tekenen');
      let sosBlok = '';
      if (nood) sosBlok = dt.sos.map(s =>
        '<div class="s-1d6sgl7">'+
        '<b class="s-1l3c0pq">'+escHtml(s.door)+'</b> · '+escHtml(s.bericht)+
        '<div class="s-15zpg3n">'+
        '<button class="vbtn ok" data-live="'+dt.id+'" data-naam="'+escHtml(s.door)+'">'+T('bo.ontlive','Live meekijken')+'</button>'+
        '<a class="vbtn s-16ipkp2" href="tel:112">'+T('bo.ont112','Bel 112')+'</a>'+
        '<button class="vbtn" data-sosaf="'+dt.id+'" data-sosid="'+s.id+'">'+T('bo.ontsosaf','SOS afgehandeld')+'</button>'+
        '</div></div>').join('');
      return '<div class="vrow ' + (nood ? 's-1o5v06e' : '') + '"><div class="vi s-186m9vs">'+
        '<div class="nm">'+RTGGlyf.tekst(dt.icon)+' '+escHtml(dt.activiteitLabel)+' <span class="s-1caek87">· '+namen+'</span></div>'+
        '<div class="sub">'+status+' · '+pos+'</div>'+ sosBlok +'</div></div>';
    }).join('');
    el.querySelectorAll('[data-sosaf]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/ontmoeting/sos-af', { dateId: b.dataset.sosaf, sosId: b.dataset.sosid }); loadOntmoetingen(); } catch(e){ alert(e.message); }
    }));
    el.querySelectorAll('[data-live]').forEach(b => b.addEventListener('click', () => ontLiveWacht(b.dataset.live, b.dataset.naam)));
  }


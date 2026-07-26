  // ---- aanmeldingen per pas: de AI deed alles, alleen ja/nee is aan het personeel ----
  async function loadAanmeldingen(){
    const el = document.getElementById('aanmeldingen'); if (!el) return;
    let lijst = [];
    try { lijst = (await call('/aanmelding/lijst', { status: 'in behandeling' })).aanmeldingen || []; } catch(e){ return; }
    el.innerHTML = lijst.length ? lijst.map(a => {
      const gedaan = (a.reis || []).map(s => s.naam).join(' · ');
      const uitnod = a.viaUitnodiging ? ' <span style="color:var(--gold);font-size:0.7rem;">op uitnodiging</span>' : '';
      return '<div class="vrow" data-id="'+a.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(a.naam)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(a.pasNaam)+'</span>'+uitnod+'</div>' +
          '<div class="sub">'+escHtml(a.contact||'')+'</div>' +
          '<div class="sub" style="color:var(--soft);">'+T('bo.aanmklaar','AI klaar')+': '+escHtml(gedaan)+'</div></div>' +
        '<button class="vbtn ok" data-ok>'+T('bo.accept','Accepteren')+'</button>' +
        '<button class="vbtn no" data-no>'+T('bo.reject','Afwijzen')+'</button>' +
      '</div>';
    }).join('') : '<div class="empty">'+T('bo.noaanm','Geen openstaande aanmeldingen.')+'</div>';
    el.querySelectorAll('.vrow').forEach(row => {
      const id = row.dataset.id;
      row.querySelector('[data-ok]').addEventListener('click', () => beslisAanm(id, 'geaccepteerd'));
      row.querySelector('[data-no]').addEventListener('click', () => beslisAanm(id, 'afgewezen'));
    });
    // de lopende lidmaatschapsbetalingen: na een akkoord loopt de bijdrage 12
    // maanden automatisch, met de 30%-foundationsplit (20% lokaal, 10% RTF).
    try {
      const b = await call('/aanmelding/betalingen', {});
      const eur = n => '€ ' + (Math.round(Number(n))).toLocaleString('nl-NL');
      if (b && b.aantalLeden) {
        el.insertAdjacentHTML('beforeend',
          '<div style="margin-top:.7rem;border-top:1px solid var(--line,#2a2a2a);padding-top:.6rem;font-size:0.8rem;color:var(--soft);line-height:1.7;">' +
          '<b style="color:var(--txt);">'+b.aantalLeden+'</b> '+T('bo.aanmlopend','lopende lidmaatschap(pen), 12 maanden automatisch.')+'<br>' +
          T('bo.aanmnaarfound','Per jaar naar de RTFoundation')+': <b style="color:var(--gold);">'+eur(b.totaal.foundation)+'</b> ('+
          T('bo.aanmlokaal','20% lokaal')+' '+eur(b.totaal.lokaal)+' &middot; '+T('bo.aanmrtf','10% RTF')+' '+eur(b.totaal.rtf)+')</div>');
      }
    } catch(e){}
  }
  async function beslisAanm(id, besluit){
    try { await call('/aanmelding/beslis', { id, besluit }); } catch(e){ alert(e.message); return; }
    loadAanmeldingen();
  }

  // ---- paspoort-incidenten: RTG beoordeelt of een opgeeiste identiteit vrijkomt ----
  async function loadIncidenten(){
    const el = document.getElementById('incidenten'); if (!el) return;
    let inc = [];
    try { inc = (await call('/office/incidenten', { alleen: 'open' })).incidenten || []; } catch(e){ return; }
    el.innerHTML = inc.length ? inc.map(i =>
      '<div class="vrow" data-id="'+i.id+'">' +
        '<div class="vi"><div class="nm">'+escHtml(i.codenaam||'\u2013')+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(i.supplierName)+' · '+escHtml(i.gevraagdNiveau)+'</span></div>' +
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
      '<div class="vrow"><div class="vi"><div class="nm">'+(p.compleet?'✅':'⚠️')+' '+escHtml(p.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(p.type)+'</span></div>'+
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

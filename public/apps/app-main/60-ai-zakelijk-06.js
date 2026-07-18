    const aiGo = document.getElementById('agLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('agLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('agLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/agenda/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; document.getElementById('agLidAiIn').value=''; agendaToeLid(r); } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('agLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- mijn facturen: automatisch bij elke aankoop ---------- */
  let memberFacturen = null;
  async function laadFacturenLid(){ if (!API.live || !API.token) return; try { memberFacturen = await API.call('/facturen/mijn', {}); } catch(e){ return; } renderFacturenLid(); }
  function renderFacturenLid(){
    const el = document.getElementById('boFacturenCard'); if (!el) return;
    if (!memberFacturen){ laadFacturenLid(); return; }
    const o = memberFacturen, items = o.facturen || [];
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">🧾 ' + T('fact.mijn','Mijn facturen') + (o.telling?' <span style="color:var(--gold);">('+o.telling+')</span>':'') + '</b>';
    h += items.length
      ? '<div style="font-size:0.72rem;color:var(--muted);margin:0.3rem 0 0.4rem;">'+T('fact.besteed','Samen besteed')+': '+eur(o.besteed||0)+'</div>' + items.slice(0,30).map(f => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.4rem;"><span>'+esc(f.verkoper)+'<span style="color:var(--muted);"> · '+esc(f.datum)+' · '+esc(f.nummer)+'</span></span><span style="white-space:nowrap;"><b>'+eur(f.totaal)+'</b> <button class="fact-pdf" data-fpdf="'+f.id+'" data-nr="'+esc(f.nummer)+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">PDF</button></span></div>').join('')
      : '<div class="fineprint" style="margin-top:0.4rem;">'+T('fact.geenlid','U heeft nog geen facturen. Bij een aankoop op uw codenaam verschijnt hier automatisch de factuur.')+'</div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div id="factLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="factLidAiIn" placeholder="'+T('fact.lidph','Vraag over uw facturen...')+'" '+inp+' style="flex:1;"><button id="factLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('fact.vraag','Vraag')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fpdf]').forEach(b => b.addEventListener('click', () => downloadPdf('/facturen/pdf', { id: b.dataset.fpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  /* ---------- Mijn backoffice: de slimme accountkamer van elke pas ---------- */
  function boOpen(){ $('#bo-scrim').classList.add('open'); $('#bo-sheet').classList.add('open'); boRender(); }
  function boDicht(){ $('#bo-scrim').classList.remove('open'); $('#bo-sheet').classList.remove('open'); }
  $('#boBtn').addEventListener('click', boOpen);
  $('#boClose').addEventListener('click', boDicht);
  $('#bo-scrim').addEventListener('click', boDicht);
  const naarTab = (naam) => { boDicht(); const b = document.querySelector('#tabbar [data-tab="' + naam + '"]'); if (b) b.click(); };

  async function boRender(){
    const body = $('#boBody');
    $('#boSub').textContent = (TIER_LABEL[user.tier] || '') + ' · ' + (user.codename || user.name || '');
    const kaart = (titel, inhoud) => '<div class="zak-kaart"><b style="font-size:0.8rem;">' + titel + '</b>' + inhoud + '</div>';
    const rij = (l, w) => '<div style="display:flex;justify-content:space-between;font-size:0.78rem;margin-top:0.4rem;"><span style="color:var(--muted);">' + l + '</span><b>' + w + '</b></div>';
    const knopje = (id, tekst) => '<button id="' + id + '" style="margin-top:0.55rem;margin-right:0.4rem;background:none;border:1px solid var(--line);border-radius:999px;padding:0.4rem 0.85rem;color:var(--txt);font-family:inherit;font-size:0.7rem;cursor:pointer;">' + tekst + '</button>';

    // de slimme cijfers: wat er open staat komt bovenaan, met een knop erbij
    const open = invoices.filter(i => i.status === 'open');
    const betaald = invoices.filter(i => i.status === 'paid');
    const totaalBetaald = betaald.reduce((s, i) => s + (i.netto || 0) + (i.bijdrage || 0), 0);
    const fonds = betaald.reduce((s, i) => s + Math.round((i.bijdrage || 0) * 0.3), 0);
    const acties = [];
    if (open.length) acties.push('💳 ' + open.length + ' ' + T('bo2.open','openstaande factuur/facturen; betaal in één tik via Betalen.'));
    if (user.account && user.emailVerified === false) acties.push('✉️ ' + T('bo2.mailniet','Uw e-mailadres is nog niet bevestigd.'));
    if (user.account && user.verified && user.verified !== 'verified') acties.push('🪪 ' + T('bo2.kyc','Verifieer uw identiteit om in één tik te boeken.'));

    let html = '';
    if (acties.length) html += kaart('⚡ ' + T('bo2.acties','Nu aandacht nodig'),
      acties.map(a => '<div class="fineprint">' + a + '</div>').join('') +
      (open.length ? knopje('boNaarBetalen', T('bo2.betaalnu','Naar Betalen')) : ''));
    else html += kaart('✓ ' + T('bo2.alsklaar','Alles op orde'), '<div style="font-size:0.76rem;color:var(--muted);margin-top:0.4rem;">' + T('bo2.geen','Geen openstaande zaken op uw account.') + '</div>');

    html += kaart('📊 ' + T('bo2.cijfers','Mijn cijfers'),
      rij(T('bo2.betaald','Betaald via RTG'), eur(totaalBetaald)) +
      rij(T('bo2.facturen','Facturen'), betaald.length + ' ' + T('bo2.voldaan','voldaan') + (open.length ? ' · ' + open.length + ' open' : '')) +
      rij('RTFoundation', eur(fonds) + ' ' + T('bo2.viamij','via mijn bijdragen')) +
      (myApps && myApps.length ? rij(T('bo2.sollicitaties','Sollicitaties'), String(myApps.length)) : ''));

    // interactieve AI-agenda
    if (user.tier !== 'guest') html += '<div id="boAgendaCard"></div>';
    // mijn facturen (automatisch bij elke aankoop)
    if (user.tier !== 'guest') html += '<div id="boFacturenCard"></div>';


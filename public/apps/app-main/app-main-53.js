    const btn = document.getElementById('boBtn'); if (!btn) return;
    btn.style.position = 'relative';
    let b = btn.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); btn.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:-4px;right:-4px;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:#E0736A;color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaLid(){ if (!API.live || !API.token) return; try { memberAgenda = await API.call('/agenda/mijn-lijst', {}); } catch(e){ return; } agendaBadgeLid(memberAgenda.telling || 0); }
  function agendaToeLid(r){ if (r && r.items){ memberAgenda = r; agendaBadgeLid(r.telling || 0); } renderAgendaLid(); }

  function renderAgendaLid(){
    const el = document.getElementById('boAgendaCard'); if (!el) return;
    if (!memberAgenda){ el.innerHTML = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + '</b><div class="fineprint">…</div></div>'; laadAgendaLid().then(renderAgendaLid); return; }
    const o = memberAgenda, items = o.items || [];
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:0.45rem 0.55rem;color:var(--txt);font-family:inherit;font-size:0.76rem;"';
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('ag.titel','Agenda') + (o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'') + '</b>';
    h += items.length ? items.map(i => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.45rem;opacity:'+(i.gedaan?'0.55':'1')+';"><span>'+(i.gedaan?'✓ ':'')+esc(i.titel)+'<span style="color:var(--muted);"> · '+esc(dagLbl(i.datum))+(i.tijd?' '+esc(i.tijd):'')+'</span></span><span style="white-space:nowrap;">'+(!i.gedaan?'<button class="ag-done" data-agdone="'+i.id+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">✓</button> ':'')+'<button class="ag-del" data-agdel="'+i.id+'" style="background:none;border:none;color:var(--soft);cursor:pointer;">✕</button></span></div>').join('') : '<div class="fineprint" style="margin-top:0.4rem;">'+T('ag.leeg','Nog niets gepland. Typ het of laat de AI het inplannen.')+'</div>'+
      '<button class="rahul-leeg-knop" data-rahul-leeg="Plan mijn dag: kijk wat er speelt en zet afspraken klaar" style="margin-top:0.5rem;">'+T('ag.leegdoe','Laat Rahul mijn dag plannen')+'</button>';
    h += '<div style="display:flex;gap:0.35rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="agLidTitel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:7rem;"><input id="agLidDatum" type="date" '+inp+'><input id="agLidTijd" type="time" '+inp+'><button id="agLidAdd" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">+</button></div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div style="font-size:0.68rem;color:var(--soft);margin-bottom:0.3rem;">'+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="agLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="agLidAiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button id="agLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('ag.plan','Plan')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-agdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/wijzig', { id: b.dataset.agdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-agdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeLid(await API.call('/agenda/verwijder', { id: b.dataset.agdel })); } catch(e){ toast(e.message); } }));
    const add = document.getElementById('agLidAdd'); if (add) add.addEventListener('click', async () => { const titel = document.getElementById('agLidTitel').value.trim(); const datum = document.getElementById('agLidDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeLid(await API.call('/agenda/toevoegen', { titel, datum, tijd: document.getElementById('agLidTijd').value })); } catch(e){ toast(e.message); } });
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
    let h = '<div class="zak-kaart"><b style="font-size:0.8rem;">' + T('fact.mijn','Mijn facturen') + (o.telling?' <span style="color:var(--gold);">('+o.telling+')</span>':'') + '</b>';
    h += items.length
      ? '<div style="font-size:0.72rem;color:var(--muted);margin:0.3rem 0 0.4rem;">'+T('fact.besteed','Samen besteed')+': '+eur(o.besteed||0)+'</div>' + items.slice(0,30).map(f => '<div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.78rem;margin-top:0.4rem;"><span>'+esc(f.verkoper)+'<span style="color:var(--muted);"> · '+esc(f.datum)+' · '+esc(f.nummer)+'</span></span><span style="white-space:nowrap;"><b>'+eur(f.totaal)+'</b> <button class="fact-pdf" data-fpdf="'+f.id+'" data-nr="'+esc(f.nummer)+'" style="background:none;border:1px solid var(--line);border-radius:8px;padding:0.15rem 0.45rem;color:var(--txt);font-size:0.68rem;cursor:pointer;">PDF</button></span></div>').join('')
      : '<div class="fineprint" style="margin-top:0.4rem;">'+T('fact.geenlid','U heeft nog geen facturen. Bij een aankoop op uw codenaam verschijnt hier automatisch de factuur.')+'</div>';
    h += '<div style="margin-top:0.55rem;border-top:1px solid var(--line);padding-top:0.5rem;"><div id="factLidAiOut"></div><div style="display:flex;gap:0.35rem;margin-top:0.35rem;"><input id="factLidAiIn" placeholder="'+T('fact.lidph','Vraag over uw facturen...')+'" '+inp+' style="flex:1;"><button id="factLidAiGo" style="background:var(--gold);border:none;border-radius:10px;padding:0.45rem 0.7rem;color:#000;font-weight:700;cursor:pointer;">'+T('fact.vraag','Vraag')+'</button></div></div>';
    h += '</div>';
    el.innerHTML = h;
    el.querySelectorAll('[data-fpdf]').forEach(b => b.addEventListener('click', () => downloadPdf('/facturen/pdf', { id: b.dataset.fpdf }, (b.dataset.nr||'factuur')+'.pdf')));
    renderKluisLid(el);
    const aiGo = document.getElementById('factLidAiGo'); if (aiGo){ const doe = async () => { const opdracht = document.getElementById('factLidAiIn').value.trim(); if (!opdracht) return; const out = document.getElementById('factLidAiOut'); out.innerHTML = '<div class="fineprint">…</div>'; try { const r = await API.call('/facturen/ai', { opdracht }); out.innerHTML = '<div class="fineprint" style="color:var(--txt);white-space:pre-wrap;">'+esc(r.antwoord)+'</div>'; document.getElementById('factLidAiIn').value=''; if (r.overzicht){ memberFacturen = r.overzicht; } } catch(e){ out.innerHTML = '<div class="fineprint" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = document.getElementById('factLidAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }
/* DIT SLUITHAAKJE HOORT HIER, EN NIET DRIE BESTANDEN VERDEROP.

   Het stond aan het begin van 54.js, waardoor renderFacturenLid() pas daar
   dichtging -- en alles wat er in 53b.js en 53c.js tussen stond, kwam daarmee
   BINNEN die functie te liggen. De Vooruit-kaart en de postvoorstellen waren
   daardoor niet zichtbaar voor boRender() in 55.js: "renderVooruit is not
   defined", en dus een lege kaart op het scherm terwijl elke API-toets groen
   stond. Gevonden door test/vooruitscherm.e2e.js, de eerste toets die die kaart
   ECHT opende.

   Wie hier weer een deelbestand tussenvoegt: knip op een plek waar de functie
   AL dicht is. scripts/kruisscan.js ziet dit niet -- die zoekt kale verwijzingen
   naar top-level namen van een zuster, en deze namen stonden helemaal niet op
   top-level. */

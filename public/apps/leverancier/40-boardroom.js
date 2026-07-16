  // ---- de eigen mini-boardroom van de zaak: functies + HR + marketing ----
  // ---- interactieve AI-agenda in de boardroom + ballon-badge op de Meer-tab ----
  let agendaSupData = null;
  function agendaBadgeSup(n){
    const tab = document.querySelector('#tabbar [data-tab="meer"]'); if (!tab) return;
    tab.style.position = 'relative';
    let b = tab.querySelector('.ag-ballon');
    if (n > 0){
      if (!b){ b = document.createElement('span'); b.className = 'ag-ballon'; b.setAttribute('aria-label', T('ag.badge','afspraken op de agenda')); tab.appendChild(b); }
      b.textContent = n > 9 ? '9+' : String(n);
      b.style.cssText = 'position:absolute;top:3px;left:50%;margin-left:6px;min-width:15px;height:15px;padding:0 3px;border-radius:8px;background:#E0736A;color:#fff;font-size:9px;font-weight:700;line-height:15px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.4);';
    } else if (b) b.remove();
  }
  async function laadAgendaSup(){ if (!API.live) return; try { agendaSupData = await API.call('/supplier/agenda/lijst', {}); } catch(e){ agendaSupData = { items:[], telling:0 }; } agendaBadgeSup(agendaSupData.telling||0); renderAgendaSup(); }
  function agendaToeSup(r){ if (r && r.items){ agendaSupData = r; agendaBadgeSup(r.telling||0); } renderAgendaSup(); }
  function agendaCardHtml(o, canEdit, prefix, aiPad){
    const dagLbl = d => { try { return new Date(d+'T12:00:00').toLocaleDateString(lang()==='en'?'en-GB':'nl-NL',{weekday:'short',day:'numeric',month:'short'}); } catch(e){ return d; } };
    const inp = 'style="background:var(--card,var(--bg));border:1px solid var(--line);border-radius:10px;padding:0.5rem 0.6rem;color:var(--txt);"';
    const items = o.items||[];
    return '<div class="card"><div class="tt-h">📅 '+T('ag.titel','Agenda')+(o.telling?' <span style="color:#E0736A;">('+o.telling+')</span>':'')+'</div>'+
      (items.length ? items.map(i => '<div class="mitem" data-agitem="'+i.id+'" style="opacity:'+(i.gedaan?'0.55':'1')+';"><div class="r1"><span class="nm">'+(i.gedaan?'✓ ':'')+esc(i.titel)+'</span><span class="pr" style="color:var(--soft);">'+esc(dagLbl(i.datum))+(i.tijd?' · '+esc(i.tijd):'')+'</span></div>'+
        (canEdit?'<div style="margin-top:0.35rem;display:flex;gap:0.4rem;">'+(!i.gedaan?'<button class="obtn" data-'+prefix+'done="'+i.id+'">'+T('ag.gedaan','Gedaan')+'</button>':'')+'<button class="rr-del" data-'+prefix+'del="'+i.id+'">✕</button></div>':'')+'</div>').join('')
        : '<div class="ds" style="margin-top:0.5rem;">'+T('ag.leeg','Nog niets gepland. Typ hieronder of laat de AI het inplannen.')+'</div>')+
      (canEdit ? '<div style="display:flex;gap:0.4rem;margin-top:0.7rem;flex-wrap:wrap;"><input id="'+prefix+'Titel" placeholder="'+T('ag.wat','Afspraak')+'" '+inp+' style="flex:1;min-width:8rem;"><input id="'+prefix+'Datum" type="date" '+inp+'><input id="'+prefix+'Tijd" type="time" '+inp+'><button class="obtn primary" id="'+prefix+'Add">+</button></div>'+
        '<div style="margin-top:0.6rem;border-top:1px solid var(--line);padding-top:0.6rem;"><div style="font-size:0.72rem;color:var(--soft);margin-bottom:0.3rem;">✨ '+T('ag.aihint','Of typ het in gewone taal:')+'</div><div id="'+prefix+'AiOut"></div><div style="display:flex;gap:0.4rem;margin-top:0.4rem;"><input id="'+prefix+'AiIn" placeholder="'+T('ag.aiph','bijv. vergadering morgen om 15u')+'" '+inp+' style="flex:1;"><button class="obtn primary" id="'+prefix+'AiGo">'+T('ag.plan','Plan')+'</button></div></div>' : '')+'</div>';
  }
  function renderAgendaSup(){
    const el = $('#agendaSupCard'); if (!el) return;
    if (!actor().manager){ el.innerHTML = ''; return; }
    if (!agendaSupData){ el.innerHTML = ''; laadAgendaSup(); return; }
    el.innerHTML = agendaCardHtml(agendaSupData, true, 'sag', '/supplier/agenda');
    el.querySelectorAll('[data-sagdone]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/wijzig', { id: b.dataset.sagdone, gedaan: true })); } catch(e){ toast(e.message); } }));
    el.querySelectorAll('[data-sagdel]').forEach(b => b.addEventListener('click', async () => { try { agendaToeSup(await API.call('/supplier/agenda/verwijder', { id: b.dataset.sagdel })); } catch(e){ toast(e.message); } }));
    const add = $('#sagAdd'); if (add) add.addEventListener('click', async () => { const titel = $('#sagTitel').value.trim(); const datum = $('#sagDatum').value; if (!titel||!datum){ toast(T('ag.vulin','Vul een afspraak en datum in.')); return; } try { agendaToeSup(await API.call('/supplier/agenda/toevoegen', { titel, datum, tijd: $('#sagTijd').value })); } catch(e){ toast(e.message); } });
    const aiGo = $('#sagAiGo'); if (aiGo){ const doe = async () => { const opdracht = $('#sagAiIn').value.trim(); if (!opdracht) return; const out = $('#sagAiOut'); out.innerHTML = '<div class="ds">…</div>'; try { const r = await API.call('/supplier/agenda/ai', { opdracht }); out.innerHTML = '<div class="ds" style="color:'+(r.gedaan?'#7EE0A3':'var(--txt)')+';">'+esc(r.antwoord)+'</div>'; $('#sagAiIn').value=''; agendaToeSup(r); } catch(e){ out.innerHTML = '<div class="ds" style="color:#E0736A;">'+esc(e.message)+'</div>'; } }; aiGo.addEventListener('click', doe); const i2 = $('#sagAiIn'); if (i2) i2.addEventListener('keydown', e => { if (e.key==='Enter') doe(); }); }
  }

  async function renderZaakBoard(){
    const el = $('#boardroomWrap'); if (!el) return;
    renderAgendaSup();
    let d; try { d = await API.call('/supplier/zaak/board'); } catch(e){ return; }
    const zbChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (d.functies||[]).map(f => '<button class="js-zbf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+
      '</div>';
    let h = funcBlok(T('zb.functies','Functies (aan/uit)'), d.functies||[], zbChips);
    // HR
    const hr = d.hr || {};
    h += '<div class="st-sec">👥 '+T('zb.hr','HR')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem;">'+
      zbCel(hr.teamAantal||0, T('zb.team','Team'))+zbCel(hr.ingeklokt||0, T('zb.ingeklokt','Ingeklokt'))+
      zbCel(hr.openVerlof||0, T('zb.verlof','Verlof/ziek'), hr.openVerlof)+zbCel(hr.openSollicitaties||0, T('zb.soll','Sollicitaties'), hr.openSollicitaties)+
      zbCel(hr.openVacatures||0, T('zb.vac','Vacatures'))+'</div>'+
      '<button class="js-zbnaar" data-tab="team" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarteam','Naar het team ›')+'</button>';
    // Marketing
    const mk = d.marketing || {};
    h += '<div class="st-sec">📣 '+T('zb.marketing','Marketing (De Salon)')+'</div><div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      zbCel(mk.volgers||0, T('zb.volgers','Volgers'))+zbCel(mk.posts||0, T('zb.posts','Posts'))+
      zbCel(mk.lopendeDeal?1:0, T('zb.deal','Actie'))+zbCel(mk.lopendePoll?1:0, T('zb.poll','Poll'))+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+(mk.salonActief? (mk.bioIngevuld&&mk.fotoIngevuld ? '✓ '+T('zb.compleet','profiel compleet, zichtbaar voor leden') : '⚠️ '+T('zb.onvolledig','profiel onvolledig, nog niet zichtbaar')) : '○ '+T('zb.salonuit','Salon-marketing staat uit'))+'</div>'+
      (mk.laatstePost? '<div class="sub">'+T('zb.laatste','Laatste post')+': '+esc(mk.laatstePost.text)+'</div>' : '')+
      '<button class="js-zbnaar" data-tab="page" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-top:0.5rem;">'+T('zb.naarsalon','Naar De Salon ›')+'</button>';
    // Rechtstreekse ontvangsten: geld dat direct van klanten binnenkwam (Face ID)
    let ont = null; try { ont = await API.call('/supplier/ontvangsten'); } catch(e){}
    if (ont){
      const e2 = n => '€ '+((n||0)/100).toLocaleString('nl-NL',{minimumFractionDigits:2,maximumFractionDigits:2});
      h += '<div class="st-sec">💸 '+T('zb.ontvangsten','Rechtstreekse ontvangsten')+'</div>'+
        '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.som)+'</div><div class="l">'+T('zb.binnen','Binnengekomen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v">'+(ont.aantal||0)+'</div><div class="l">'+T('zb.betalingen','Betalingen')+'</div></div>'+
        '<div class="b" style="flex:1;min-width:5rem;"><div class="v">'+e2(ont.saldo)+'</div><div class="l">'+T('zb.saldo','Uitbetaalbaar')+'</div></div></div>'+
        '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.directsub','Face ID-betalingen van klanten, rechtstreeks op uw rekening.')+'</div>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
        '<input id="bvCode" placeholder="'+T('zb.codenaam','codenaam klant')+'" style="width:9rem;">'+
        '<input id="bvBedrag" type="number" min="0.5" step="0.5" placeholder="'+T('zb.bedrag','bedrag €')+'" style="width:6.5rem;">'+
        '<input id="bvOms" placeholder="'+T('zb.waarvoor','waarvoor')+'" style="width:9rem;">'+
        '<button class="abtn" id="bvSend">'+T('zb.stuurverzoek','Stuur betaalverzoek')+'</button></div>'+
        (ont.openVerzoeken&&ont.openVerzoeken.length? '<div class="sub" style="margin-bottom:0.3rem;">'+T('zb.open','Openstaand')+':</div>'+ont.openVerzoeken.map(v=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;border-bottom:1px solid var(--line);padding:0.3rem 0;font-size:0.8rem;"><span>'+esc(v.naarCodename||'')+' · '+esc(v.omschrijving||'')+'</span><span>'+e2(v.bedrag)+' <button class="bev-plan" data-bvweg="'+v.ref+'">✕</button></span></div>').join(''):'')+
        (ont.betalingen&&ont.betalingen.length? '<div class="sub" style="margin:0.4rem 0 0.3rem;">'+T('zb.recent','Recent binnen')+':</div>'+ont.betalingen.slice(0,6).map(b=>'<div style="display:flex;justify-content:space-between;gap:0.5rem;font-size:0.8rem;padding:0.2rem 0;"><span>'+esc(b.codename||'')+' · '+esc(b.omschrijving||'')+'</span><b>'+e2(b.bedrag)+'</b></div>').join(''):'');
    }
    // Boerderij-KPI's: de boardroom van de boer (oogst, dieropbrengst, taken)
    if (has('boerderij')){
      let bo = boer; if (!bo){ try { bo = await API.call('/supplier/boerderij/overzicht', {}); boer = bo; } catch(e){} }
      if (bo){ const bst = bo.stats||{}; const bbr = bo.briefing||{ punten:[] };
        h += '<div class="st-sec">🚜 '+T('zb.boer','Boerderij')+(bo.typeLabel?' · '+esc(bo.typeLabel):'')+'</div>'+
          '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
          zbCel(bst.teOogsten||0, T('zb.oogstklaar','Oogstklaar'), bst.teOogsten)+
          zbCel((bst.hectare||0)+' ha', T('zb.areaal','Areaal'))+
          zbCel(bst.melkPerDag||0, T('zb.melk','L melk/dag'))+
          zbCel(bst.dieren||0, T('zb.dieren','Dieren'))+
          zbCel(bst.openTaken||0, T('zb.boertaken','Open taken'), bst.openTaken)+'</div>'+
          (bbr.punten.length ? '<div class="sub" style="margin-bottom:0.4rem;">'+esc(bbr.punten[0].tekst)+'</div>' : '')+
          '<button class="js-zbnaar" data-tab="boerderij" style="background:var(--card2);border:1px solid var(--line);border-radius:8px;padding:0.4rem 0.7rem;color:var(--txt);font-size:0.75rem;font-family:inherit;margin-bottom:1rem;">'+T('zb.naarboer','Naar de boerderij ›')+'</button>';
      }
    }
    // de belastingtool van de zaak: dezelfde motor als de Business Pass
    h += '<div class="st-sec">🧮 '+T('zb.bel','Belastingtool')+'</div>'+
      '<div class="sub" style="margin-bottom:0.4rem;">'+T('zb.bel.s','Vul de verwachte jaarwinst in voor een indicatie van de belasting, de nettowinst en wat u maandelijks opzij zet. Het land van de zaak is het vertrekpunt.')+'</div>'+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.5rem;">'+
      '<input id="zbBelWinst" type="number" min="1" placeholder="'+T('zb.bel.ph','jaarwinst €')+'" style="width:9rem;">'+
      '<button class="abtn" id="zbBelGo">'+T('zb.bel.reken','Reken')+'</button></div>'+
      '<div id="zbBelRes" style="display:none;border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.78rem;line-height:1.7;color:var(--muted);margin-bottom:0.8rem;"></div>';
    el.innerHTML = h;
    const zbGo = el.querySelector('#zbBelGo');
    if (zbGo) zbGo.addEventListener('click', async () => {
      const box = el.querySelector('#zbBelRes');
      box.style.display = 'block'; box.textContent = '…';
      try {
        const d2 = await API.call('/supplier/belasting', { winst: Number(el.querySelector('#zbBelWinst').value) });
        const rij = (l, v, sterk) => '<div style="display:flex;justify-content:space-between;gap:0.8rem;"><span>'+l+'</span><span style="flex-shrink:0;'+(sterk?'color:var(--txt);font-weight:600;':'')+'">'+v+'</span></div>';
        box.innerHTML = '<div style="font-size:0.58rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--gold);margin-bottom:0.35rem;">'+d2.regime+' · '+d2.landNaam+'</div>'+
          rij(T('zb.bel.winst','Jaarwinst'), eur(d2.winst))+
          d2.posten.map(p2 => rij(p2.label, (p2.bedrag<0?'- ':'')+eur(Math.abs(p2.bedrag)))).join('')+
          rij(T('zb.bel.betalen','Te betalen (indicatie)'), eur(d2.belasting), true)+
          rij(T('zb.bel.netto','Netto over'), eur(d2.netto), true)+
          '<div style="margin-top:0.5rem;color:var(--gold);">💡 '+T('zb.bel.zet','Zet ~')+d2.reserveerPct+'% '+T('zb.bel.opzij','opzij: ongeveer')+' '+eur(d2.perMaand)+' '+T('zb.bel.pm','per maand')+'.</div>'+
          '<div style="margin-top:0.4rem;font-size:0.64rem;color:var(--soft);">'+T('zb.bel.disc','Indicatie; dit is voorlichting, geen bindend fiscaal advies.')+'</div>';
      } catch(e){ box.textContent = e.message; }
    });
    wireFuncBlok(el);
    el.querySelectorAll('.js-zbf').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/zaak/functie', { id:b.dataset.id, aan: b.dataset.aan!=='true' }); await refresh(); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.js-zbnaar').forEach(b => b.addEventListener('click', () => openTab(b.dataset.tab)));
    const bvSend = $('#bvSend');
    if (bvSend) bvSend.addEventListener('click', async () => {
      const bedrag = Number(($('#bvBedrag')||{}).value);
      if (!(bedrag >= 0.5)) { toast(T('zb.bedragmin','Kies een bedrag van minstens € 0,50.')); return; }
      try { await API.call('/supplier/betaalverzoek', { codename: ($('#bvCode')||{}).value, bedrag, omschrijving: ($('#bvOms')||{}).value }); toast('💸 '+T('zb.verzoekgestuurd','Betaalverzoek verstuurd.')); renderZaakBoard(); }
      catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-bvweg]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/betaalverzoek/intrek', { ref:b.dataset.bvweg }); renderZaakBoard(); } catch(e){ toast(e.message); }
    }));
  }
  function zbCel(n, label, waarschuw){
    return '<div class="b" style="flex:1;min-width:4.5rem;"><div class="v'+(waarschuw?' a':'')+'">'+n+'</div><div class="l">'+label+'</div></div>';
  }
  /* Gedeeld met de Boardroom: vat een rij aan/uit-schakelaars samen tot een
     rustige, inklapbare kop "titel · X/Y aan". Alleen open als er iets uit staat
     (de uitzondering telt), of wanneer de gebruiker erop tikt. Zo lijken alle
     schakelpanelen op elkaar en oogt veel opties nooit slordig. */
  function funcBlok(titel, functies, chipsHTML){
    const totaal = functies.length;
    const aan = functies.filter(f => f.aan).length;
    const uit = totaal - aan;
    const afwijkt = uit > 0;
    return '<button type="button" class="func-kop" data-funcblok>'+
      '<span class="func-chev">'+(afwijkt?'▾':'▸')+'</span>'+
      '<span class="func-naam">'+esc(titel)+'</span>'+
      '<span class="func-tel'+(afwijkt?' let':'')+'">'+aan+'/'+totaal+' '+T('fb.aan','aan')+(uit?' · '+uit+' '+T('fb.uit','uit'):'')+'</span></button>'+
      '<div class="func-body"'+(afwijkt?'':' hidden')+'>'+chipsHTML+'</div>';
  }
  /* Klap elk funcBlok in een container open/dicht (chevron mee). */
  function wireFuncBlok(root){
    if (!root) return;
    root.querySelectorAll('[data-funcblok]').forEach(k => k.addEventListener('click', () => {
      const body = k.nextElementSibling; if (!body) return;
      const chev = k.querySelector('.func-chev');
      const dicht = body.hidden; body.hidden = !dicht;
      if (chev) chev.textContent = dicht ? '▾' : '▸';
    }));
  }

  /* ---- het beveiligings-commandocentrum ---- */
  let bevDatum = null; // gekozen roosterdag
  function bevVandaag(){ return new Date().toISOString().slice(0,10); }
  async function renderBeveiliging(){
    const el = $('#bevWrap'); if (!el) return;
    if (!has('beveiliging')) { el.innerHTML=''; return; }
    let cmd, roo;
    if (!bevDatum) bevDatum = bevVandaag();
    try { cmd = await API.call('/supplier/beveiliging/command'); } catch(e){ el.innerHTML='<div class="softline">'+esc(e.message)+'</div>'; return; }
    try { roo = await API.call('/supplier/beveiliging/rooster', { van: bevDatum, dagen: 1 }); } catch(e){ roo = { dagen: [] }; }
    const b = cmd.budget || {};
    // 1) momentopname
    let h = '<div class="stats" style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.8rem;">'+
      zbCel(cmd.opDienst.length, T('bev.opdienst','Op dienst'))+
      zbCel(cmd.team, T('bev.team','Bewakers'))+
      zbCel(cmd.posten, T('bev.posten','Posten'))+
      zbCel(cmd.openVandaag, T('bev.openvandaag','Open vandaag'), cmd.openVandaag)+
      zbCel(cmd.openAanvragen, T('bev.aanvragen','Aanvragen'), cmd.openAanvragen)+
      zbCel(cmd.incidentenOpen, T('bev.incidenten','Incidenten'), cmd.incidentenOpen)+'</div>';
    if (cmd.sosActief) h += '<div class="card" style="border:1px solid var(--rood);background:#3a1420;color:#F4B8C6;margin-bottom:0.8rem;font-weight:600;">🆘 '+T('bev.sos','Actieve SOS! Een bewaker heeft de noodknop ingedrukt. Bekijk het incident en stuur bijstand.')+'</div>';
    // 2) functies aan/uit
    const bevChips = '<div style="display:flex;flex-wrap:wrap;gap:0.4rem;">'+
      (cmd.functies||[]).map(f => '<button class="js-bevf" data-id="'+f.id+'" data-aan="'+f.aan+'" style="border:1px solid '+(f.aan?'#1f5637':'var(--rood)')+';background:'+(f.aan?'#12321f':'#3a1420')+';color:'+(f.aan?'#7EE0A3':'#F4B8C6')+';border-radius:999px;padding:0.34rem 0.75rem;font-size:0.74rem;font-weight:600;font-family:inherit;">'+(f.aan?'● ':'○ ')+esc(f.naam)+'</button>').join('')+'</div>';
    h += funcBlok(T('bev.func','Functies (aan/uit)'), cmd.functies||[], bevChips);
    // 3) budget
    if (b.budgetUren){
      const kleur = b.overschrijding ? 'var(--rood)' : (b.pct>=85?'#E0A93A':'#7EE0A3');
      h += '<div class="st-sec">💶 '+T('bev.budget','Budget & uren')+'</div>'+
        '<div class="card" style="margin-bottom:1rem;">'+
        '<div style="display:flex;justify-content:space-between;font-size:0.82rem;margin-bottom:0.3rem;"><span>'+b.urenGepland+' / '+b.budgetUren+' '+T('bev.uur','uur')+' ('+b.maand+')</span><b>€ '+b.bestedBedrag+' / € '+b.budgetBedrag+'</b></div>'+
        '<div style="height:8px;border-radius:99px;background:var(--card2);overflow:hidden;"><div style="height:100%;width:'+Math.min(100,b.pct)+'%;background:'+kleur+';"></div></div>'+
        '<div class="sub" style="margin-top:0.4rem;">'+esc(b.advies)+'</div>'+
        (b.perPost&&b.perPost.length? '<div class="sub" style="margin-top:0.4rem;">'+b.perPost.map(p=>esc(p.naam)+': '+p.uren+' u (€ '+p.bedrag+')').join(' · ')+'</div>':'')+
        '<div style="display:flex;gap:0.4rem;margin-top:0.6rem;flex-wrap:wrap;"><input id="bevBudUren" type="number" min="0" placeholder="'+T('bev.buduren','budget-uren/mnd')+'" value="'+b.budgetUren+'" style="width:9rem;">'+
        '<input id="bevBudTarief" type="number" min="0" placeholder="'+T('bev.tarief','tarief/uur')+'" value="'+b.tariefUur+'" style="width:8rem;">'+
        '<button class="abtn" id="bevBudSave">'+T('bev.opslaan','Opslaan')+'</button></div>'+
        '</div>';
    }
    // 4) rooster met AI-overname
    h += '<div class="st-sec">📋 '+T('bev.rooster','Rooster')+'</div>'+
      '<div style="display:flex;gap:0.4rem;align-items:center;margin-bottom:0.6rem;flex-wrap:wrap;">'+
      '<input id="bevDag" type="date" value="'+bevDatum+'" style="width:11rem;">'+
      '<button class="abtn" id="bevAI">✨ '+T('bev.ai','AI neemt het over')+'</button></div>';
    const dag = roo.dagen && roo.dagen[0];
    if (dag){
      h += '<div class="card" style="margin-bottom:1rem;">'+ (dag.posten.length? dag.posten.map(p =>
        '<div style="border-bottom:1px solid var(--line);padding:0.5rem 0;">'+
          '<div style="display:flex;justify-content:space-between;"><b>'+esc(p.post)+'</b>'+(p.open?'<span style="color:var(--rood);font-size:0.72rem;">'+p.open+' '+T('bev.open','open')+'</span>':'<span style="color:#7EE0A3;font-size:0.72rem;">'+T('bev.gedekt','gedekt')+'</span>')+'</div>'+
          p.shifts.map(sl => '<div class="sub" style="margin-top:0.2rem;">'+esc(sl.shift)+': '+
            (sl.bezet.length? sl.bezet.map(d=>'<span class="bev-chip'+(d.status==='ingeklokt'?' on':'')+'">'+esc(d.guardNaam||'?')+(d.status==='ingeklokt'?' ●':'')+' <a data-schrap="'+d.id+'">✕</a></span>').join(' ') : '')+
            (sl.open? ' <button class="bev-plan" data-post="'+p.postId+'" data-shift="'+sl.shiftId+'">+ '+T('bev.plan','plan')+'</button>':'')+
          '</div>').join('')+
        '</div>'
      ).join('') : '<div class="softline">'+T('bev.geenpost','Nog geen posten. Voeg hieronder objecten toe.')+'</div>')+'</div>';
    }
    // 5) inzetaanvragen
    h += '<div class="st-sec">🛡️ '+T('bev.inzet','Inzetaanvragen')+'</div>';
    const open = (cmd.functies||[]).find(f=>f.id==='aanvragen' && f.aan);
    h += '<div class="card" style="margin-bottom:1rem;"><div id="bevAvLijst"></div>'+
      (open? '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
        '<input id="bevAvKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
        '<input id="bevAvObject" placeholder="'+T('bev.object','object/locatie')+'" style="width:9rem;">'+
        '<input id="bevAvDatum" type="date" value="'+bevDatum+'" style="width:10rem;">'+
        '<input id="bevAvAantal" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.aantal','aantal bewakers')+'">'+
        '<button class="abtn" id="bevAvAdd">'+T('bev.avadd','Aanvraag toevoegen')+'</button></div>':'')+
      '</div>';
    // 6) posten beheren
    const posten = cmd.postenLijst || [];
    h += '<div class="st-sec">📍 '+T('bev.postbeheer','Posten & objecten')+'</div>'+
      '<div class="card" style="margin-bottom:1rem;">'+
      (posten.length? posten.map(p => '<div style="border-bottom:1px solid var(--line);padding:0.35rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
        '<span><b>'+esc(p.naam)+'</b>'+(p.klant?' · '+esc(p.klant):'')+' · '+(p.minMan||1)+' '+T('bev.man','man')+(p.orders?'<br><span class="sub">'+esc(p.orders)+'</span>':'')+'</span>'+
        '<button class="abtn ghost" data-postweg="'+p.id+'">✕</button></div>').join('') : '<div class="softline">'+T('bev.geenpost2','Nog geen posten.')+'</div>')+
      '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-top:0.5rem;">'+
      '<input id="bevPostNaam" placeholder="'+T('bev.postnaam','postnaam')+'" style="width:9rem;">'+
      '<input id="bevPostKlant" placeholder="'+T('bev.klant','klant')+'" style="width:8rem;">'+
      '<input id="bevPostMin" type="number" min="1" value="1" style="width:5rem;" title="'+T('bev.min','min. bezetting')+'">'+
      '<button class="abtn" id="bevPostAdd">'+T('bev.postadd','Post toevoegen')+'</button></div></div>';
    // 7) incidenten
    if (cmd.incidenten && cmd.incidenten.length){
      h += '<div class="st-sec">🚨 '+T('bev.incs','Incidenten')+'</div><div class="card" style="margin-bottom:0.5rem;">'+
        cmd.incidenten.map(x => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
          '<span><b'+(x.ernst==='kritiek'||x.ernst==='hoog'?' style="color:var(--rood);"':'')+'>'+(x.sos?'🆘 ':'')+esc(x.soort)+'</b> · '+esc(x.post)+' · '+esc(x.guardNaam||'')+'<br><span class="sub">'+esc(x.tekst)+'</span></span>'+
          '<button class="bev-inc" data-id="'+x.id+'" style="align-self:flex-start;">'+(x.status==='open'?T('bev.afh','Afhandelen'):T('bev.heropen','Heropen'))+'</button></div>').join('')+'</div>';
    }
    el.innerHTML = h;
    wireFuncBlok(el);
    // bindingen
    el.querySelectorAll('.js-bevf').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/functie', { id:x.dataset.id, aan: x.dataset.aan!=='true' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    const bind = (id, fn) => { const e2=$('#'+id); if (e2) e2.addEventListener('click', fn); };
    const dagInp = $('#bevDag'); if (dagInp) dagInp.addEventListener('change', () => { bevDatum = dagInp.value || bevVandaag(); renderBeveiliging(); });
    bind('bevAI', async () => { try { const r = await API.call('/supplier/beveiliging/planauto', { datum: bevDatum }); toast(r.uitleg); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevBudSave', async () => { try { await API.call('/supplier/beveiliging/budget', { periodeUren: $('#bevBudUren').value, tariefUur: $('#bevBudTarief').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevAvAdd', async () => { try { await API.call('/supplier/beveiliging/aanvraag', { klant:$('#bevAvKlant').value, object:$('#bevAvObject').value, datum:$('#bevAvDatum').value, aantal:$('#bevAvAantal').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    bind('bevPostAdd', async () => { try { await API.call('/supplier/beveiliging/post', { naam:$('#bevPostNaam').value, klant:$('#bevPostKlant').value, minMan:$('#bevPostMin').value }); renderBeveiliging(); } catch(e){ toast(e.message); } });
    el.querySelectorAll('.bev-plan').forEach(x => x.addEventListener('click', async () => {
      const gid = prompt(T('bev.wieplan','Welke bewaker? Typ de naam precies.')); if (!gid) return;
      const staff = (state.staff||[]).find(m => m.name.toLowerCase() === gid.trim().toLowerCase());
      if (!staff) { toast(T('bev.geenbewaker','Geen bewaker met die naam.')); return; }
      try { await API.call('/supplier/beveiliging/dienst', { postId:x.dataset.post, shiftId:x.dataset.shift, datum:bevDatum, guardId:staff.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-schrap]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/dienst/weg', { id:x.dataset.schrap }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('.bev-inc').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/incident/beslis', { id:x.dataset.id }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-postweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/post/weg', { id:x.dataset.postweg }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    // de aanvragenlijst los inladen (eigen endpoint met open + afgerond)
    bevLaadAanvragen();
  }
  async function bevLaadAanvragen(){
    const el = $('#bevAvLijst'); if (!el) return;
    let d; try { d = await API.call('/supplier/beveiliging/aanvragen'); } catch(e){ return; }
    if (!d.open.length && !d.afgerond.length){ el.innerHTML = '<div class="softline">'+T('bev.geenav','Nog geen inzetaanvragen.')+'</div>'; return; }
    el.innerHTML = d.open.map(a => '<div style="border-bottom:1px solid var(--line);padding:0.4rem 0;display:flex;justify-content:space-between;gap:0.5rem;">'+
      '<span><b>'+esc(a.klant)+'</b> · '+esc(a.object)+' · '+esc(a.datum)+' · '+a.aantal+'× '+esc(a.shiftId)+'</span>'+
      '<span style="display:flex;gap:0.3rem;"><button class="abtn" data-avplan="'+a.ref+'">'+T('bev.avplan','Inplannen')+'</button>'+
      '<button class="abtn ghost" data-avweg="'+a.ref+'">'+T('bev.avweg','Afwijzen')+'</button></span></div>').join('')+
      (d.afgerond.length? '<div class="sub" style="margin-top:0.4rem;">'+d.afgerond.slice(0,5).map(a=>esc(a.object)+' ('+esc(a.status)+')').join(' · ')+'</div>':'');
    el.querySelectorAll('[data-avplan]').forEach(x => x.addEventListener('click', async () => {
      try { const r = await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avplan, actie:'plan' }); toast(T('bev.ingepland','Ingepland en op het rooster gezet.')); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-avweg]').forEach(x => x.addEventListener('click', async () => {
      try { await API.call('/supplier/beveiliging/aanvraag/beslis', { ref:x.dataset.avweg, actie:'afwijzen' }); renderBeveiliging(); } catch(e){ toast(e.message); }
    }));
  }

  // alle overige functies als nette knoppen in het Meer-scherm
  function renderMeer(){
    const el = $('#meerWrap'); if (!el) return;
    // het afdelingenbord (dorp) is er voor kamers (hotel), de nachtzaak, restaurants en beachclubs
    const dorpKan = has('bookings') || ['bar', 'club', 'beachclub', 'restaurant'].includes(S && S.type);
    const keys = Object.keys(TABDEF).filter(k => !MAIN_TABS.includes(k) && (!TABDEF[k].cap || has(TABDEF[k].cap)) && (k !== 'bezorg' || !!(state && state.bezorg)) && (k !== 'dorp' || dorpKan));
    el.innerHTML = '<div class="meer-grid">' + keys.map(k =>
      '<button class="meer-btn" data-goto2="'+k+'"><svg viewBox="0 0 24 24">'+TABDEF[k].svg+'</svg><b>'+T('tab.'+k, TABDEF[k].label)+'</b></button>'
    ).join('') + '</div>';
    el.querySelectorAll('[data-goto2]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.goto2)));
  }

  function renderAll(){
    $('#supIcon').textContent = S.icon;
    $('#supName').textContent = S.name;
    $('#supType').textContent = tType(S.typeLabel) + ' · ' + S.city;
    renderActor();
    if (stationMode){ renderStation(); return; }
    renderHome(); renderOrders(); renderRides(); renderMenu(); renderPrice(); renderLocation(); renderKassa(); renderBezorg(); renderTickets(); renderVerhuur(); renderCharter(); renderVastgoed(); renderBoerderij(); renderCreator(); renderSamenwerking(); renderFacturen(); renderRtfMarkt(); renderRetail(); renderModeBezorg(); renderVerkoop(); renderGroothandel(); renderInkoop(); renderZaakBoard(); renderBeveiliging(); renderPaspoort(); renderContracten(); renderOnbCfg(); renderRooms(); renderDorp(); renderMinibar(); renderKlussen(); renderTafels(); renderBeheer(); renderDoors(); renderGasten(); renderGChat(); renderPage(); renderTeam(); renderBorden(); renderReviews(); renderVoorraad(); renderMeer(); renderAIChips();
    // Zorg dat het actieve tabblad ook echt zichtbaar is: de tabbar-knop staat al
    // op 'active', maar zonder deze aanroep krijgt geen enkele .view de active-klasse
    // en blijft het overzicht leeg bij de eerste render.
    if (!document.querySelector('.view.active')){
      const knop = document.querySelector('.tabbar button.active');
      openTab(knop ? knop.dataset.tab : 'home');
    }
  }

  function actor(){ return (state && state.actor) || { name:'Beheer', role:'manager', manager:true }; }
  function renderActor(){
    const a = actor();
    $('#actorAv').textContent = initials(a.name);
    $('#actorName').textContent = a.name;
  }


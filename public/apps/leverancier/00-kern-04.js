    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    pickCode = code;
    gateRoster = { supplier:{ name: code }, staff: [] };
    try { gateRoster = await API.call('/supplier/roster', { code }); } catch(e){}
    $('#spBiz').textContent = gateRoster.supplier.name;
    $('#spPin').classList.remove('open');
    renderRoles();
    $('#staffPick').classList.add('open');
  }
  // Stap 1: de rol
  function renderRoles(){
    spH2().textContent = T('sp.roleq','Wie bent u?');
    spDeck().textContent = T('sp.roledeck','Kies uw rol; u logt in met uw eigen pincode.');
    $('#spBack2') && $('#spBack2').remove();
    $('#spList').innerHTML = [
      ['personeel','',T('sp.r.staff','Personeel'),T('sp.r.staff.s','Bediening, keuken, receptie, chauffeurs...')],
      ['management','',T('sp.r.mgmt','Management'),T('sp.r.mgmt.s','Managers en chefs, volledige toegang met eigen pincode')],
      ['sollicit','',T('sp.r.apply','Solliciteren'),T('sp.r.apply.s','Werken bij ' + gateRoster.supplier.name + '? Solliciteer direct.')]
    ].map(r =>
      '<button class="sp-person" data-rol="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>'
    ).join('');
    // Vaste werkplekken. Horeca krijgt keuken, bar, bediening en events;
    // elk bedrijf krijgt een Kantoor waar het management alles regelt.
    // Een werkplek open je met je eigen naam en PIN.
    const gtype = (gateRoster.supplier && gateRoster.supplier.type) || TYPEOF[pickCode] || '';
    const horeca = ['restaurant','bar','club'].includes(gtype);
    const st = [];
    if (horeca){
      st.push(
        ['keuken','\uD83D\uDD25',T('st.keuken','Keuken-scherm'),T('st.keuken.s','Bontickets, bump-knoppen, allergieen groot in beeld')],
        ['bar','\uD83C\uDF78',T('st.bar','Bar-scherm'),T('st.bar.s','Drankjes klaarmelden, ophaalcodes groot in beeld')],
        ['bediening','\uD83E\uDDFE',T('st.bediening','Bedieningspost'),T('st.bediening.s','Uitserveren, tafels en de PDA op een plek')],
        ['events','\uD83C\uDF9F',T('st.events','Events-scherm'),T('st.events.s','Gastenlijst en check-in aan de deur')]
      );
    }
    if (gtype === 'zzp'){
      st.push(['agenda','\uD83D\uDDD3\uFE0F',T('st.agenda','Agenda'),T('st.agenda.s','Uw boekingen: bevestigen, leveren en afronden')]);
    }
    if (['taxi','jet'].includes(gtype)){
      st.push(['chauffeur', gtype==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98',
        gtype==='jet' ? T('st.crew','Crew-post') : T('st.chauffeur','Chauffeurspost'),
        T('st.chauffeur.s','Uw ritten, route en verdiensten; grote knoppen per ritfase')]);
    }
    st.push(['kantoor','\uD83D\uDDDD',T('st.kantoor','Kantoor'),
      horeca ? T('st.kantoor.s','Alles aanpassen: HR, keuken, bar, bediening en events (alleen management)')
             : T('st.kantoor.s2','Alles aanpassen: HR, marketing en het aanbod (alleen management)')]);
    $('#spList').innerHTML += '<div style="margin:0.9rem 0 0.4rem;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--soft);">'+T('st.h','Werkplekken')+'</div>' +
      st.map(r => '<button class="sp-person" data-station="'+r[0]+'"><span class="av">'+r[1]+'</span><span><b>'+r[2]+'</b><span>'+r[3]+'</span></span></button>').join('');
    $('#spList').querySelectorAll('[data-station]').forEach(b => b.addEventListener('click', () => {
      pendingStation = b.dataset.station;
      renderStationPersons();
    }));
    $('#spList').querySelectorAll('[data-rol]').forEach(b => b.addEventListener('click', () => {
      const r = b.dataset.rol;
      pendingStation = null;
      if (r === 'management') renderPersons(null, true);
      else if (r === 'personeel') renderFuncs();
      else renderApply();
    }));
  }

  // Werkplek openen: iedereen van het team mag dat, op eigen naam en PIN.
  function renderStationPersons(){
    let all = gateRoster.staff || [];
    if (pendingStation === 'kantoor') all = all.filter(m => m.role === 'manager');
    const naam = stationLabel(pendingStation);
    spH2().textContent = naam;
    spDeck().textContent = pendingStation === 'kantoor'
      ? T('st.pickmgr','Het Kantoor is voor eigenaren en managers. Kies uw naam en voer uw pincode in.')
      : T('st.pickname','Wie opent deze werkplek? Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (all.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(() => { pendingStation = null; renderRoles(); });
  }
  // Stap 2a: personeel kiest de functie
  function renderFuncs(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.funcq','Wat is uw functie?');
    spDeck().textContent = T('sp.funcdeck','Kies uw functie, daarna uw naam en pincode.');
    $('#spList').innerHTML = (FUNCS[type]||[]).map(f =>
      '<button class="sp-person" data-func="'+f.replace(/"/g,'&quot;')+'"><span class="av">'+f[0]+'</span><span><b>'+f+'</b></span></button>'
    ).join('') + backBtn();
    $('#spList').querySelectorAll('[data-func]').forEach(b => b.addEventListener('click', () => renderPersons(b.dataset.func, false)));
    bindBack(renderRoles);
  }
  // Stap 2b/3: personen (van een functie, of het management)
  function renderPersons(func, mgmt){
    const all = gateRoster.staff || [];
    let list = mgmt ? all.filter(m => m.role === 'manager')
      : all.filter(m => (m.func||'').toLowerCase() === String(func).toLowerCase());
    const fallback = !mgmt && !list.length;
    if (fallback) list = all;
    spH2().textContent = mgmt ? T('sp.r.mgmt','Management') : func;
    spDeck().textContent = fallback ? T('sp.nofunc','Nog niemand met deze functie; kies uw naam uit het team.') : T('sp.pickname','Kies uw naam en voer uw pincode in.');
    $('#spList').innerHTML = (list.map(m =>
      '<button class="sp-person" data-sid="'+m.id+'" data-name="'+m.name.replace(/"/g,'&quot;')+'" data-role="'+m.role+'">'+
        '<span class="av">'+initials(m.name)+'</span><span><b>'+m.name+'</b><span>'+(m.func||T('role.'+m.role, m.role==='manager'?'Manager':'Medewerker'))+'</span></span></button>'
    ).join('') || '<div class="empty" style="padding:1.2rem 0;">'+T('sp.nostaff','Nog geen persoonlijke accounts. Log in als Beheer en voeg je team toe.')+'</div>') + backBtn();
    $('#spList').querySelectorAll('.sp-person[data-sid]').forEach(b => b.addEventListener('click', () => openPin(b.dataset.sid, b.dataset.name, b.dataset.role)));
    bindBack(mgmt ? renderRoles : renderFuncs);
  }
  // Solliciteren: bij elk bedrijf hetzelfde formulier
  function renderApply(){
    const type = TYPEOF[pickCode] || 'restaurant';
    spH2().textContent = T('sp.applyh','Solliciteren');
    spDeck().textContent = T('sp.applydeck','Bij elke RTG-partner solliciteert u op dezelfde manier. Het bedrijf ziet uw sollicitatie direct in de app.');
    $('#spList').innerHTML =
      '<div class="field" style="margin-top:0.4rem;"><label>'+T('sp.a.name','Uw naam')+'</label><input id="apName"></div>'+
      '<div class="field"><label>'+T('sp.a.func','Functie')+'</label><select id="apFunc" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;">'+
        (FUNCS[type]||[]).map(f=>'<option>'+f+'</option>').join('')+'</select></div>'+
      '<div class="field"><label>'+T('sp.a.contact','Telefoon of e-mail')+'</label><input id="apContact"></div>'+
      '<div class="field"><label>'+T('sp.a.note','Korte motivatie (optioneel)')+'</label><textarea id="apNote" style="width:100%;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:0.8rem 1rem;font-size:0.9rem;color:var(--txt);outline:none;min-height:70px;resize:vertical;"></textarea></div>'+
      '<button class="bigbtn" id="apSend">'+T('sp.a.send','Verstuur sollicitatie')+'</button>' + backBtn();
    bindBack(renderRoles);
    $('#apSend').addEventListener('click', async () => {
      const name = $('#apName').value.trim(), contact = $('#apContact').value.trim();
      if (!name || !contact){ toast(T('sp.a.fill','Vul uw naam en telefoonnummer of e-mailadres in.')); return; }
      try {
        await API.call('/supplier/apply', { code: pickCode, name, func: $('#apFunc').value, contact, note: $('#apNote').value.trim() });
        toast(T('sp.a.sent','Verstuurd. ') + gateRoster.supplier.name + ' ' + T('sp.a.sent2','neemt contact met u op.'));
        renderRoles();
      } catch(e){ toast(e.message); }
    });
  }
  function backBtn(){ return '<button class="sp-biz-btn" id="spBack2" style="margin-top:0.9rem;">← '+T('sp.back','Terug')+'</button>'; }

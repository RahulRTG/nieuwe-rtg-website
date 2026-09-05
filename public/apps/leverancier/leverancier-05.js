/* aanmelden als medewerker bij een zaak */
    msg.textContent = T('enr.busy','Bezig met aanmelden...');
    try {
      const r = await API.call('/supplier/staff/join', { bedrijf, kassacode, login: login2, password });
      msg.className = 'enroll-msg ok';
      msg.textContent = T('enr.ok','Gelukt! U bent aangemeld. U wordt ingelogd...');
      await login({ login: login2, password, bedrijf: r.code }, false, true);
    } catch (err) {
      msg.className = 'enroll-msg err';
      msg.textContent = err.message || T('enr.fail','Aanmelden mislukt. Controleer de gegevens.');
    }
  }

  // Functies per genre: zo kiest personeel direct de eigen rol,
  // en solliciteert een kandidaat overal op dezelfde manier.
  const TYPEOF = { KIKUNOI:'restaurant', PONTO:'bar', HOSHI:'hotel', SAKURA:'apartment', MKKX:'taxi', JETAG:'jet', IBIZAIR:'helikopter', AYAKA:'zzp', KAITO:'zzp', CASTELL:'bouw', TALLER:'autogarage', BRILLA:'schoonmaak', VERDIA:'hovenier', LAVANDA:'wasserij', ESCOLA:'rijschool', FAUNA:'dierenarts', DENTAL:'tandarts', LUZ:'fotograaf', MUDANZA:'verhuizer', DIGITAL:'ithulp', ESVEDRA:'activiteit', MACE:'activiteit', ISLAREN:'verhuur', IBIZALIV:'vastgoed', MAISON:'retail', AZUL:'charter', LUNARA:'villa', TERRAMAR:'vracht', MERIDIAAN:'kantoorgebouw', SAROCA:'golfclub', FORTIA:'fitnessclub', VELVET:'beautysalon', AMICS:'petcare', NIDO:'kinderopvang', PORTELL:'marina', AURELIA:'weddingplanner', LEXNOVA:'professioneel', SEGUR:'verzekeringen', VALAURA:'wintersport' };
  const FUNCS = {
    restaurant: ['Bediening','Keuken','Gastheer/gastvrouw','Afwas'],
    bar:        ['Bediening','Bar','Keuken','Security'],
    club:       ['Bediening','Bar','Security'],
    hotel:      ['Receptie','Housekeeping','Roomservice','Onderhoud','Security'],
    apartment:  ['Beheer','Housekeeping','Onderhoud'],
    villa:      ['Beheer','Housekeeping','Onderhoud'],
    taxi:       ['Taxi centrale','Chauffeur'],
    jet:        ['Operations','Crew','Piloot'],
    helikopter: ['Operations','Piloot','Crew','Grondpersoneel'],
    activiteit: ['Gids','Security','Ticketbalie'],
    verhuur:    ['Balie','Monteur','Schoonmaak'],
    vastgoed:   ['Makelaar','Bezichtigingen','Backoffice'],
    vracht:     ['Expediteur','Planner','Douane-declarant','Loods'],
    kantoorgebouw: ['Receptie','Security','Facilitair','Concierge & jetset'],
    golfclub:   ['Club-secretaris','Golfpro','Caddiemaster','Greenkeeping'],
    fitnessclub: ['Clubmanager','Receptie & check-in','Trainer'],
    beautysalon: ['Salonmanager','Barbier','Stylist','Nagelstudio'],
    petcare:    ['Eigenaar','Dierverzorging','Uitlaatservice','Trimsalon'],
    kinderopvang: ['Locatiemanager','Pedagogisch medewerker','Nanny-coordinator'],
    marina:     ['Havenmeester','Steiger & brandstof','Service & helling','Marina-concierge'],
    weddingplanner: ['Weddingplanner','Dagcoordinatie','Styling & decor'],
    professioneel: ['Officemanager','Advocaat','Notaris','Fiscalist'],
    verzekeringen: ['Adviseur'],
    wintersport: ['Resortmanager','Skischool','Liften & pistes','Verhuur','Berggids & lawinedienst']
  };
  let pickCode = null, gateRoster = null, pendingStation = null, legacyPinUi = false;
  const spH2 = () => document.querySelector('#staffPick h2');
  const spDeck = () => document.querySelector('#staffPick .sp-deck');

  async function pickPartner(code){
    if (!API.enabled){ toast(T('sup.needserver','Start de server (npm start) om de leverancier-app te gebruiken.')); return; }
    if (!legacyPinUi) return toast(T('sp.accountonly','Log in met uw persoonlijke RTG-account.'));
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
    $('#spList').innerHTML += '<div style="margin:0.75rem 0 0.5rem;font-size:0.62rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--soft);">'+T('st.h','Werkplekken')+'</div>' +
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

  /* Live meekijken bij een SOS: het lid stuurt een WebRTC-aanbod via de office-
     stream ('ontmoeting-signaal'); wij openen het beeld en antwoorden terug. */
  let ontPc = null, ontLiveDate = null, ontIce = null;
  async function ontHaalIce(){ try { ontIce = (await (await fetch('/api/ice')).json()).iceServers; } catch(e){ ontIce = [{ urls:'stun:stun.l.google.com:19302' }]; } return ontIce; }
  function ontLiveWacht(dateId, naam){
    ontLiveDate = dateId;
    $('#ontLiveNaam').textContent = '' + naam;
    $('#ontLiveStatus').textContent = T('bo.ontwacht','Wachten op het camerabeeld van het lid…');
    $('#ontLiveVid').srcObject = null;
    $('#ontLiveScrim').style.display = 'flex';
  }
  function ontLiveSluit(){
    $('#ontLiveScrim').style.display = 'none';
    if (ontPc){ try { ontPc.close(); } catch(e){} ontPc = null; }
    ontLiveDate = null;
  }
  async function opOntSignaal(d){
    if (!d || !d.payload || (ontLiveDate && d.dateId !== ontLiveDate)) return;
    // een nieuw aanbod: open het scherm als dat nog niet openstaat
    if (d.payload.sdp && d.payload.sdp.type === 'offer'){
      ontLiveDate = d.dateId;
      if ($('#ontLiveScrim').style.display !== 'flex'){ $('#ontLiveNaam').textContent = '' + (d.codenaam||'SOS'); $('#ontLiveScrim').style.display = 'flex'; }
      await ontHaalIce();
      if (ontPc){ try { ontPc.close(); } catch(e){} }
      ontPc = new RTCPeerConnection({ iceServers: ontIce || [{ urls:'stun:stun.l.google.com:19302' }] });
      ontPc.ontrack = e => { $('#ontLiveVid').srcObject = e.streams[0]; $('#ontLiveStatus').textContent = T('bo.ontlivenu','Live beeld en geluid van het lid.'); };
      ontPc.onicecandidate = e => { if (e.candidate) call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { ice: e.candidate } }).catch(()=>{}); };
      await ontPc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      const ans = await ontPc.createAnswer();
      await ontPc.setLocalDescription(ans);
      await call('/office/ontmoeting/signaal', { dateId: d.dateId, naarKey: d.van, payload: { sdp: ontPc.localDescription } });
    } else if (d.payload.ice && ontPc){
      try { await ontPc.addIceCandidate(new RTCIceCandidate(d.payload.ice)); } catch(e){}
    }
  }
  document.getElementById('ontLiveClose').addEventListener('click', ontLiveSluit);

  let convData = [], convUser = null;
  async function loadConcierge(){
    try { convData = (await call('/office/conversations')).conversations || []; } catch(e){ return; }
    $('#concierge').innerHTML = convData.length ? convData.map(c =>
      '<div class="vrow" data-uid="'+c.userId+'"><div class="vi"><div class="nm">'+escHtml(c.codename)+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(c.tier)+'</span>'+
        (c.needsConcierge?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
        '<div class="sub">'+(c.lastFrom==='concierge'?'↩ ':'')+escHtml((c.last||'').slice(0,55))+'</div></div>'+
        '<button class="vbtn ok" data-open>'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.noconv','Nog geen gesprekken.')+'</div>';
    $('#concierge').querySelectorAll('.vrow').forEach(row =>
      row.querySelector('[data-open]').addEventListener('click', () => openThread(Number(row.dataset.uid))));
    if (convUser && $('#convScrim').classList.contains('open')) openThread(convUser);
  }
  // Vertrouwenslijn: personeel van partners bereikt hier vertrouwelijk de
  // vertrouwenspersoon van RTG; de werkgever ziet deze gesprekken nooit.
  let trustData = [], trustId = null;
  async function loadTrust(){
    try { trustData = (await call('/office/trust')).threads || []; } catch(e){ return; }
    $('#trustList').innerHTML = trustData.length ? trustData.map(t =>
      '<div class="vrow"><div class="vi"><div class="nm">'+escHtml(t.name)+' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+escHtml(t.company)+'</span>'+
      (t.open?' <span class="pill nieuw">'+T('bo.waiting','wacht')+'</span>':'')+'</div>'+
      '<div class="sub">'+escHtml(((t.messages[t.messages.length-1]||{}).text||'').slice(0,55))+'</div></div>'+
      '<button class="vbtn ok" data-trust="'+t.id+'">'+T('bo.open','Open')+'</button></div>'
    ).join('') : '<div class="empty">'+T('bo.notrust','Geen berichten. De vertrouwenslijn is er voor het personeel van partners; werkgevers zien hier niets van.')+'</div>';
    $('#trustList').querySelectorAll('[data-trust]').forEach(b => b.addEventListener('click', () => openTrustThread(b.dataset.trust)));
    if (trustId && $('#convScrim').classList.contains('open')) openTrustThread(trustId);
  }
  function openTrustThread(id){
    const t = trustData.find(x => x.id === id); if (!t) return;
    trustId = id; convUser = null;
    $('#convWho').textContent = '' + t.name + ' · ' + t.company;
    $('#convBody').innerHTML = t.messages.map(m =>
      '<div class="cmsg '+(m.from==='staff'?'in':'out')+'">'+escHtml(m.text)+'</div>').join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }

  function openThread(uid){
    const c = convData.find(x => x.userId === uid); if (!c) return;
    convUser = uid;
    trustId = null;
    $('#convWho').textContent = c.codename + ' · ' + c.tier;
    $('#convBody').innerHTML = c.messages.map(m =>
      '<div class="cmsg '+(m.from==='member'?'in':'out')+'">'+escHtml(m.text)+'</div>'
    ).join('');
    $('#convScrim').classList.add('open');
    setTimeout(()=>{ const b=$('#convBody'); b.scrollTop=b.scrollHeight; }, 30);
  }
  $('#convClose').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convScrim').addEventListener('click', () => { $('#convScrim').classList.remove('open'); trustId = null; });
  $('#convReply').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('#convText').value.trim(); if (!t) return;
    if (trustId){
      try { await call('/office/trust/reply', { id: trustId, text: t }); $('#convText').value=''; await loadTrust(); openTrustThread(trustId); refresh(); }
      catch(e2){ alert(e2.message); }
      return;
    }
    if (!convUser) return;
    try { convData = (await call('/office/reply', { userId: convUser, text: t })).conversations || convData; $('#convText').value=''; openThread(convUser); loadConcierge(); }
    catch(e2){ alert(e2.message); }
  });

  function render(){
    const st2 = state.stats || {};
    const alerts = state.alerts || [];
    // globale zoekfilter: een veld dat door alle lijsten heen zoekt
    const q = (($('#zoekInp')||{}).value || '').trim().toLowerCase();
    const past = function(){ return !q || [].slice.call(arguments).join(' ').toLowerCase().includes(q); };
    $('#stat').innerHTML =
      '<div class="b"><div class="l">'+T('bo.partners','Partners')+'</div><div class="v">'+state.suppliers.length+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.livenu','Nu onderweg')+'</div><div class="v">'+(st2.liveNu||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.today','Vandaag')+'</div><div class="v a">'+(st2.aantalVandaag||0)+' · '+eur(st2.omzetVandaag||0)+'</div></div>' +
      '<div class="b"><div class="l">'+T('bo.weekrev','Weekomzet')+'</div><div class="v g">'+eur(st2.omzetWeek||0)+'</div></div>' +
      '<div class="b"><div class="l">RTFoundation</div><div class="v g">'+eur(st2.foundation||0)+'</div></div>' +
      (st2.fondsAfdracht ? '<div class="b"><div class="l">'+T('bo.rtfteStorten','RTF af te dragen')+'</div><div class="v'+(st2.fondsAfdracht.teStorten>0 && !st2.fondsAfdracht.iban?' a':' g')+'">'+eur(st2.fondsAfdracht.teStorten||0)+'</div><div class="sub">'+(st2.fondsAfdracht.iban?(T('bo.rtfNaar','naar')+' '+escHtml(st2.fondsAfdracht.iban)):T('bo.rtfGeenIban','IBAN nog niet ingesteld'))+'</div></div>' : '') +
      (st2.muntOntvangst && st2.muntOntvangst.aan ? '<div class="b"><div class="l">'+T('bo.munt','Munten (in euro)')+'</div><div class="v g">'+eur(st2.muntOntvangst.ontvangen||0)+'</div>'+(st2.muntOntvangst.wacht?'<div class="sub">'+st2.muntOntvangst.wacht+' '+T('bo.muntWacht','openstaand')+'</div>':'')+'</div>' : '') +
      '<div class="b"><div class="l">'+T('bo.actions','Open acties')+'</div><div class="v'+(alerts.some(a=>a.level==='rood')?' a':'')+'">'+alerts.length+'</div></div>';

    // actiecentrum: vastgelopen zaken bovenaan, met een herinneringsknop
    $('#alertList').innerHTML = alerts.length ? alerts.map(a => {
      const koeling = a.nudgedAt && (Date.now() - new Date(a.nudgedAt)) < 10*60000;
      const knop = (a.kind === 'order' || a.kind === 'ride')
        ? (koeling ? '<span class="pill klaar">'+T('bo.nudged','herinnerd')+'</span>'
                   : '<button class="vbtn ok" data-nudge="'+a.ref+'" data-nkind="'+a.kind+'">'+T('bo.nudge','Stuur herinnering')+'</button>')
        : '';
      return '<div class="alert '+a.level+'"><span class="lv"></span><div class="tx">'+escHtml(a.text)+'</div>'+knop+'</div>';
    }).join('') : '<div class="empty">✓ '+T('bo.noalerts','Alles loopt. Vastgelopen bestellingen, wachtende leden en open beoordelingen verschijnen hier vanzelf.')+'</div>';
    $('#alertList').querySelectorAll('[data-nudge]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true;
      try { await call('/office/nudge', { ref: b.dataset.nudge, kind: b.dataset.nkind }); await refresh(); }
      catch(e){ alert(e.message); b.disabled = false; }
    }));

    // partnerprestaties: omzetranglijst met open werk en gemiddelde ritduur
    const perf = state.performance || [];
    const maxOmzet = Math.max.apply(null, perf.map(p=>p.omzet).concat([1]));
    const medaille = ['1.','2.','3.'];
    $('#perfList').innerHTML = perf.length ? perf.filter(p => past(p.name, p.code, p.type)).map((p, i) =>
      '<div class="row"><div class="r1"><div style="flex:1;min-width:0;"><div class="nm">'+(medaille[i]||'')+' '+p.name+
        ' <span style="color:var(--soft);font-weight:400;font-size:0.72rem;">· '+p.code+'</span></div>'+
        '<div class="sub">'+p.aantal+' '+T('bo.trans','transactie(s)')+' · '+p.openNu+' '+T('bo.opennow','nu open')+
        (p.gemMin!=null?' · Ø '+p.gemMin+' '+T('bo.minride','min per rit'):'')+'</div>'+
        '<div class="perfbar"><i style="width:'+Math.max(2, Math.round(p.omzet/maxOmzet*100))+'%;"></i></div></div>'+
        '<div class="amt g">'+eur(p.omzet)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noperf','Nog geen partnercijfers.')+'</div>';

    // omzet per dag: de laatste zeven dagen als staafjes, vandaag uitgelicht
    const wk = state.week || [];
    const maxDag = Math.max.apply(null, wk.map(d=>d.omzet).concat([1]));
    $('#weekChart').innerHTML = wk.map((d, i) =>
      '<div class="cb'+(i===wk.length-1?' vandaag':'')+'" title="'+d.aantal+' '+T('bo.trans','transactie(s)')+'">'+
      '<b>'+(d.omzet?eur(d.omzet):'·')+'</b><i style="height:'+Math.max(2, Math.round(d.omzet/maxDag*72))+'%;"></i><span>'+d.label+'</span></div>'
    ).join('');

    const live = (state.live || []).filter(g => past(g.codename, (g.dest&&g.dest.name)||'', (g.partners||[]).join(' ')));
    $('#liveList').innerHTML = live.length ? live.map(g =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(g.codename)+
        (g.dest?' <span style="color:var(--soft);font-weight:400;">· '+T('bo.to','naar')+' '+escHtml(g.dest.name)+'</span>':'')+'</div>'+
        '<div class="sub">'+(g.arrived?'✓ '+T('bo.arrived','gearriveerd'):T('bo.onthemove','onderweg')+' ('+T('bo.mode.'+g.mode, g.mode==='walking'?'lopend':g.mode==='flying'?'vliegend':'rijdend')+')')+
        ' · '+escHtml((g.partners||[]).join(', '))+'</div></div>'+
        '<span class="pill '+(g.arrived?'klaar':'bereiding')+'">'+(g.arrived?T('bo.arrived','gearriveerd'):T('bo.live','live'))+'</span></div></div>'
    ).join('') : '<div class="empty">'+T('bo.nolive','Niemand is nu onderweg. Zodra een lid een reis live zet, ziet u hier waar zij zijn en met welke partners.')+'</div>';

    const prijzen = state.prices.filter(p => past(p.supplierName, p.service));
    $('#prices').innerHTML = prijzen.length ? prijzen.map(p =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(p.supplierName)+'</div><div class="sub">'+escHtml(p.service)+' · '+timeAgo(p.at)+'</div></div><div class="amt g">'+eur(p.price)+'</div></div></div>'
    ).join('') : '<div class="empty">'+T('bo.noprices','Nog geen prijzen. Zodra een partner een dynamische prijs doorgeeft, verschijnt die hier live.')+'</div>';

    // tijdlijn (bestellingen & ritten) komt gepagineerd van de server
    renderTimeline();
    const totals = state.totals || {};
    $('#liveTot').textContent = totals.live > (state.live || []).length ? (state.live || []).length + ' ' + T('bo.van', 'van') + ' ' + totals.live : '';

    const apps = (state.applications || []).filter(x => past(x.name, x.func, x.company));
    $('#appsList').innerHTML = apps.length ? apps.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='aangenomen'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.ap.new','nieuw'):x.status==='aangenomen'?T('bo.ap.hired','aangenomen'):T('bo.ap.rejected','afgewezen');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.name)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.func)+'</span>'+
        (x.viaRTG?' <span style="font-size:0.58rem;letter-spacing:0.08em;color:var(--gold);border:1px solid var(--gold);border-radius:999px;padding:0.1rem 0.45rem;vertical-align:middle;">RTG</span>':'')+'</div>'+
        '<div class="sub">'+escHtml(x.company)+' · '+timeAgo(x.at)+'</div></div>'+
        '<span class="pill '+pc+'">'+st+'</span></div></div>';
    }).join('') : '<div class="empty">'+T('bo.noapps','Nog geen sollicitaties. Kandidaten solliciteren via de partner-apps, RTG-leden via de leden-app met hun cv.')+'</div>';

    const pas = (state.partnerApplications || []).filter(x => past(x.company, x.type, x.city, x.contactName,
      x.registratie && (x.registratie.nummer || x.registratie.kvkNummer), x.registratie && x.registratie.landNaam));
    $('#paList').innerHTML = pas.length ? pas.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='goedgekeurd'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.pa.new','nieuw'):x.status==='goedgekeurd'?T('bo.pa.ok','goedgekeurd'):T('bo.pa.no','afgewezen');
      const toel = x.toelating || null;
      const eisen = toel && Array.isArray(toel.eisen) ? toel.eisen : [];
      const eisKlaar = e => ['geverifieerd','niet_van_toepassing'].includes(e.status) &&
        !(e.gecontroleerd&&e.gecontroleerd.geldigTot&&Date.parse(e.gecontroleerd.geldigTot)<Date.now());
      const open = eisen.filter(e => !eisKlaar(e));
      const controleHtml = toel ? '<div style="display:grid;gap:.3rem;margin-top:.55rem;">'+eisen.map(e => {
        const klaar = eisKlaar(e);
        const verlopen = e.status==='geverifieerd'&&!klaar;
        const referentie = e.gecontroleerd && e.gecontroleerd.referentie || e.referentie || '';
        return '<div style="border-left:2px solid '+(klaar?'var(--green)':e.status==='afgekeurd'?'#df6b7d':'var(--gold)')+';padding-left:.55rem;">'+
          '<div class="sub"><b style="color:var(--text)">'+(klaar?'✓ ':e.status==='afgekeurd'?'✕ ':'○ ')+escHtml(e.label)+'</b> · '+escHtml(e.status)+
          (verlopen?' · verlopen':'')+(referentie?' · '+escHtml(referentie):'')+'</div>'+
          (x.status==='nieuw'&&!klaar?'<div style="display:flex;gap:.3rem;margin-top:.25rem;"><button class="vbtn ok" data-pactl="'+x.id+'" data-paeis="'+e.id+'">'+T('bo.pa.check','Controleren')+'</button>'+
            (e.magNietVanToepassing?'<button class="vbtn" data-panvt="'+x.id+'" data-paeis="'+e.id+'">N.v.t.</button>':'')+'</div>':'')+'</div>';
      }).join('')+'</div>' : '<div class="sub" style="color:#df6b7d;margin-top:.45rem;">Oude aanvraag zonder toelatingsdossier · opnieuw laten aanvragen</div>';
      const reg = x.registratie || {};
      const pre = reg.voorcontrole || {};
      const regNummer = reg.nummer || reg.kvkNummer || '';
      const regTitel = (reg.landNaam || (reg.kvkNummer ? 'Nederland' : '')) + (reg.regioOfStaat ? ' · ' + reg.regioOfStaat : '');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.company)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.type)+' · '+escHtml(x.city)+'</span></div>'+
        '<div class="sub">'+escHtml(x.contactName)+' · '+escHtml(x.email)+(x.phone?' · '+escHtml(x.phone):'')+' · '+timeAgo(x.at)+
          (regNummer?'<br>'+escHtml(regTitel)+' · registratie '+escHtml(regNummer)+(reg.vestigingsnummer?' · vestiging '+escHtml(reg.vestigingsnummer):'')+' · voorcontrole '+escHtml(pre.status||'handmatig'):'')+
          (reg.registerBron?'<br><a href="'+escHtml(reg.registerBron)+'" target="_blank" rel="noopener">Open officieel register</a>':'')+
          (x.note?'<br>"'+escHtml(x.note.slice(0,120))+'"':'')+(x.code?' · code '+escHtml(x.code):'')+'</div>'+controleHtml+'</div>'+
        (x.status==='nieuw'
          ? '<div style="display:flex;gap:0.4rem;flex-shrink:0;align-items:flex-start;">'+(toel&&open.length===0?'<button class="vbtn ok" data-paok="'+x.id+'">'+T('bo.pa.approve','Goedkeuren')+'</button>':'<span class="pill nieuw">'+(toel?open.length+' open':'geblokkeerd')+'</span>')+'<button class="vbtn" data-pano="'+x.id+'">'+T('bo.pa.reject','Afwijzen')+'</button></div>'
          : '<span class="pill '+pc+'">'+st+'</span>')+
        '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nopa','Nog geen aanvragen. Bedrijven melden zich aan via de pagina "Partner worden" op de site.')+'</div>';
    document.querySelectorAll('[data-pactl]').forEach(b => b.addEventListener('click', async () => {
      const referentie = prompt('Welke officiële bron, registerverwijzing of controle-uitkomst is geraadpleegd?');
      if (!referentie || referentie.trim().length < 3) return;
      const geldigTot = prompt('Geldig tot (JJJJ-MM-DD), of laat leeg als dit niet van toepassing is:') || '';
      try { await call('/office/partner/controle', { id:b.dataset.pactl, onderdeel:b.dataset.paeis, uitkomst:'geverifieerd', referentie, geldigTot }); await refresh(); }
      catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-panvt]').forEach(b => b.addEventListener('click', async () => {
      const reden = prompt('Waarom is dit controleonderdeel aantoonbaar niet van toepassing?');
      if (!reden || reden.trim().length < 3) return;
      try { await call('/office/partner/controle', { id:b.dataset.panvt, onderdeel:b.dataset.paeis, uitkomst:'niet_van_toepassing', referentie:reden }); await refresh(); }
      catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-paok]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await call('/office/partner/decide', { id: b.dataset.paok, action: 'goedkeuren' });
        const box = $('#paResult');
        box.style.display = 'block';
        box.innerHTML = '✓ '+T('bo.pa.done','Goedgekeurd. Geef dit eenmalig door (staat ook in de welkomstmail):')+
          '<br><b>'+T('bo.pa.code','Leverancierscode')+': '+d.code+'</b> · <b>'+T('bo.pa.pin','Manager-PIN')+': '+d.pin+'</b>';
        await refresh();
      } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-pano]').forEach(b => b.addEventListener('click', async () => {
      const reden = prompt('Waarom wordt deze aanvraag afgewezen? Dit komt in het beslisspoor en in de e-mail aan de aanvrager.');
      if (!reden || reden.trim().length < 3) return;
      try { await call('/office/partner/decide', { id: b.dataset.pano, action: 'afwijzen', reden }); await refresh(); } catch(e){ alert(e.message); }
    }));

    // schoolaanmeldingen: een school kan pas personeel toelaten en klassen maken
    // nadat RTG hem hier goedkeurt
    const scholen = (state.pendingSchools || []).filter(x => past(x.naam, x.code, x.plaats));
    $('#schoolList').innerHTML = scholen.length ? scholen.map(x =>
      '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.naam)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.plaats||'')+'</span></div>'+
        '<div class="sub">'+T('bo.sc.code','code')+' '+escHtml(x.code)+' · '+x.personeel+' '+T('bo.sc.staff','aanmelding(en) personeel')+' · '+timeAgo(x.at)+'</div></div>'+
        '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-scok="'+escHtml(x.code)+'">'+T('bo.sc.approve','Goedkeuren')+'</button><button class="vbtn" data-scno="'+escHtml(x.code)+'">'+T('bo.sc.reject','Afwijzen')+'</button></div>'+
      '</div></div>'
    ).join('') : '<div class="empty">'+T('bo.nosc','Geen wachtende schoolaanmeldingen. Scholen melden zich aan via de RTFoundation-app; hier keurt u ze goed voordat ze personeel en klassen kunnen aanmaken.')+'</div>';
    document.querySelectorAll('[data-scok]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scok, action: 'goedkeuren' }); await refresh(); } catch(e){ alert(e.message); }
    }));
    document.querySelectorAll('[data-scno]').forEach(b => b.addEventListener('click', async () => {
      try { await call('/office/school/decide', { code: b.dataset.scno, action: 'afwijzen' }); await refresh(); } catch(e){ alert(e.message); }
    }));
  }

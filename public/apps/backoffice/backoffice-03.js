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
                   : '<button class="vbtn ok" data-nudge="'+a.ref+'" data-nkind="'+a.kind+'">⏰ '+T('bo.nudge','Stuur herinnering')+'</button>')
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
    const medaille = ['🥇','🥈','🥉'];
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

    const pas = (state.partnerApplications || []).filter(x => past(x.company, x.type, x.city, x.contactName));
    $('#paList').innerHTML = pas.length ? pas.map(x => {
      const pc = x.status==='nieuw'?'nieuw':x.status==='goedgekeurd'?'klaar':'bereiding';
      const st = x.status==='nieuw'?T('bo.pa.new','nieuw'):x.status==='goedgekeurd'?T('bo.pa.ok','goedgekeurd'):T('bo.pa.no','afgewezen');
      return '<div class="row"><div class="r1"><div><div class="nm">'+escHtml(x.company)+' <span style="color:var(--soft);font-weight:400;">· '+escHtml(x.type)+' · '+escHtml(x.city)+'</span></div>'+
        '<div class="sub">'+escHtml(x.contactName)+' · '+escHtml(x.email)+(x.phone?' · '+escHtml(x.phone):'')+' · '+timeAgo(x.at)+(x.note?'<br>"'+escHtml(x.note.slice(0,120))+'"':'')+(x.code?' · code '+escHtml(x.code):'')+'</div></div>'+
        (x.status==='nieuw'
          ? '<div style="display:flex;gap:0.4rem;flex-shrink:0;"><button class="vbtn ok" data-paok="'+x.id+'">'+T('bo.pa.approve','Goedkeuren')+'</button><button class="vbtn" data-pano="'+x.id+'">'+T('bo.pa.reject','Afwijzen')+'</button></div>'
          : '<span class="pill '+pc+'">'+st+'</span>')+
        '</div></div>';
    }).join('') : '<div class="empty">'+T('bo.nopa','Nog geen aanvragen. Bedrijven melden zich aan via de pagina "Partner worden" op de site.')+'</div>';
    document.querySelectorAll('[data-paok]').forEach(b => b.addEventListener('click', async () => {
      try {
        const d = await call('/office/partner/decide', { id: b.dataset.paok, action: 'goedkeuren' });

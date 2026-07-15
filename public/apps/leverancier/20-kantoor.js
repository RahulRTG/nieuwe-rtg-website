  /* ---- het Kantoor: de eigenaar/manager past hier alles aan ---- */
  let kantoorSec = 'bo', kantoorMsg = '';
  let kantoorEdit = null;   // gerecht dat open staat in de kaart-bewerker
  // de AI-bedrijfsagent: vaste leverancier, inkoopvoorstellen en het AI-weekrooster
  let agentData = null, agentMarkt = null, agentBusy = false;
  async function laadAgent(){
    if (agentBusy) return;
    agentBusy = true;
    try { agentData = (await API.call('/supplier/agent', {})).agent; } catch(e){ agentData = { voorstellen: [], error: e.message }; }
    try { if (!agentMarkt) agentMarkt = (await API.call('/supplier/inkoop/markt', {})).groothandels || []; } catch(e){ agentMarkt = agentMarkt || []; }
    agentBusy = false;
    renderStation();
  }
  // eigen backoffice van de zaak: dagcijfers, weektrend, toppers en actiecentrum
  let boData = null, boBusy = false;
  async function laadBackoffice(){
    if (boBusy) return;
    boBusy = true;
    try { boData = await API.call('/supplier/backoffice', {}); }
    catch(e){ boData = { error: e.message }; }
    boBusy = false;
    renderStation();
  }
  // open uitnodigingen (kassacodes) van het team, voor de HR-sectie
  let invData = null, invBusy = false;
  async function laadInvites(){
    if (invBusy) return;
    invBusy = true;
    try { invData = await API.call('/supplier/staff/invites', {}); }
    catch(e){ invData = { invites: [] }; }
    invBusy = false;
    renderStation();
  }
  // boekhouding: btw per genre, personeelskosten en cadeaukaarten, per land
  let finData = null, finBusy = false, finMsg = '', accAntwoord = '';
  // Salon-bedrijfsprofiel: volgers, aanbiedingen, polls en cijfers
  let mktData = null, mktBusy = false, mktMsg = '';
  async function laadMarketing(){
    if (mktBusy) return;
    mktBusy = true;
    try { mktData = await API.call('/supplier/salon/stats', {}); }
    catch(e){ mktData = { error: e.message }; }
    mktBusy = false;
    renderStation();
  }
  // Een bestand (PDF/CSV) ophalen met het token en als download aanbieden.
  async function dlBestand(pad, body, filename){
    if (!API.token) return;
    try {
      const res = await fetch('/api' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + API.token }, body: JSON.stringify(body || {}) });
      if (!res.ok) throw new Error('fout');
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch(e){ toast(T('fn.dlfout','Exporteren lukte niet.')); }
  }
  async function laadFinance(){
    if (finBusy) return;
    finBusy = true;
    try { finData = await API.call('/supplier/finance', {}); }
    catch(e){ finData = { error: e.message }; }
    finBusy = false;
    renderStation();
  }
  // ritgeschiedenis komt gepagineerd van de server (schaalvast bij miljoenen ritten)
  let histData = null, histPage = 1, histQ = '', histBusy = false;
  async function laadHistorie(){
    if (histBusy) return;
    histBusy = true;
    try { histData = await API.call('/supplier/ride/history', { page: histPage, q: histQ }); }
    catch(e){ histData = { items: [], total: 0, page: 1, pages: 1, omzet: 0 }; }
    histBusy = false;
    renderStation();
  }
  function renderKantoor(){
    // Elk bedrijf heeft HR en Marketing; de rest van de secties hangt af van
    // de sector: horeca beheert de kaart en events, een hotel de kamers en
    // minibar, een appartement de deuren, vervoer de prijzen aan RTG.
    const type = (S && S.type) || 'restaurant';
    const horeca = ['restaurant','bar','club'].includes(type);
    const secs = [
      ['bo','\uD83D\uDCCA',T('kt.bo','Backoffice')],
      ['fin','\uD83D\uDCDA',T('kt.fin','Boekhouding')],
      ['hr','\uD83D\uDC65',T('kt.hr','HR & team')]
    ];
    if (horeca) secs.push(
      ['keuken','\uD83D\uDD25',T('kt.keuken','Keuken')],
      ['bar','\uD83C\uDF78','Bar'],
      ['bediening','\uD83E\uDDFE',T('kt.bediening','Bediening')],
      ['events','\uD83C\uDF9F','Events']
    );
    if (type === 'hotel') secs.push(
      ['kamers','\uD83D\uDECF',T('kt.kamers','Kamers')],
      ['minibar','\uD83E\uDDCA','Minibar']
    );
    if (type === 'apartment') secs.push(
      ['kamers','\uD83C\uDFE1',T('kt.units','Verblijven')],
      ['deuren','\uD83D\uDEAA',T('kt.deuren','Deuren')]
    );
    if (type === 'taxi' || type === 'jet') secs.push(
      ['ritten','\uD83D\uDDFA',T('kt.ritten','Ritten')],
      ['historie','\uD83D\uDCD2',T('kt.historie','Historie')],
      ['vloot', type==='jet' ? '\u2708\uFE0F' : '\uD83D\uDE98', T('kt.vloot','Vloot')],
      ['tarief','\uD83E\uDDEE',T('kt.tarief','Tarief')],
      ['prijzen','\uD83D\uDCB6',T('kt.prijzen','Prijzen')]
    );
    if (type === 'zzp') secs.push(['diensten','\uD83D\uDDC2\uFE0F',T('kt.diensten','Aanbod')]);
    secs.push(['marketing','\uD83D\uDCE3','Marketing']);
    if (!secs.some(s2 => s2[0] === kantoorSec)) kantoorSec = 'bo';
    let html = '<div class="st-chips">'+secs.map(s2 =>
      '<button data-ksec="'+s2[0]+'"'+(kantoorSec===s2[0]?' class="on"':'')+'>'+s2[1]+' '+s2[2]+'</button>').join('')+'</div>';
    if (kantoorMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+kantoorMsg+'</div>'; }

    if (kantoorSec === 'bo'){
      // de eigen backoffice van de zaak, met dezelfde patronen als het
      // RTG-controlecentrum maar dan uitsluitend over dit bedrijf
      if (!boData){
        laadBackoffice();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (boData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📊 '+T('kt.bo','Backoffice')+'</h3><div class="tkc-who">'+boData.error+'</div></div>';
      } else {
        const b = boData;
        html += '<div class="tkc" style="grid-column:1/-1;">'+
          '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(125px,1fr));gap:0.55rem;">'+
          [[T('bz.today','Omzet vandaag'), eur(b.stats.omzetVandaag)],
           [T('bz.trans','Transacties'), b.stats.transactiesVandaag],
           [T('bz.kassa','Waarvan kassa'), eur(b.stats.kassaVandaag)],
           [T('bz.week','Weekomzet'), eur(b.stats.omzetWeek)],
           [T('bz.binnen','Nu ingeklokt'), b.stats.binnenNu],
           [T('bz.acties','Open acties'), b.stats.openActies]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.7rem 0.8rem;">'+
            '<div style="font-size:0.54rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--soft);">'+x[0]+'</div>'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.2rem;color:var(--gold);margin-top:0.15rem;">'+x[1]+'</div></div>').join('')+'</div>'+
          '<div class="tkc-who" style="margin-top:0.5rem;">'+T('bz.nulcom','RTG rekent 0% commissie: deze omzet is volledig van u.')+'</div>'+
          '<button class="obtn" id="boBrief" style="align-self:flex-start;">📋 '+T('bz.brief','Dagbriefing')+'</button>'+
          '<div id="boBriefTxt" style="display:none;border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;"></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎯 '+T('bz.actie','Actiecentrum van de zaak')+'</h3>'+
          (b.alerts.length ? b.alerts.map(a =>
            '<div class="st-row"><span>'+(a.level==='rood'?'🔴':a.level==='amber'?'🟠':'🟢')+' '+a.text+'</span></div>').join('')
            : '<div class="tkc-who">✓ '+T('bz.niks','Alles loopt. Vastgelopen bestellingen, wachtende gasten en open personeelszaken verschijnen hier vanzelf.')+'</div>')+'</div>';
        // baas over uw zaak: elke functie aan of uit; alleen app-betalen heeft
        // bewust geen knop, wel kiest u het moment (vooraf of achteraf)
        const caps2 = (S && S.caps) || [];
        const inst = state.settings || {};
        const optAan = k => !inst.opties || inst.opties[k] !== false;
        const rijen = [];
        if (caps2.includes('menu') || caps2.includes('rooms')){
          rijen.push(['ordersOpen', T('sw.orders','Bestellen via de app'), T('sw.orders.s','Leden kunnen bij u bestellen'), inst.ordersOpen !== false]);
          rijen.push(['reservationsOpen', T('sw.res','Reserveringen'), T('sw.res.s','Nieuwe reserveringen aannemen'), inst.reservationsOpen !== false]);
        }
        rijen.push(['betaalVooraf', T('sw.vooraf','Vooraf betalen'), T('sw.vooraf.s','Uit = gasten betalen achteraf. Betalen zelf gaat altijd via de app.'), optAan('betaalVooraf')]);
        rijen.push(['gastchat', T('sw.chat','Gastchat'), T('sw.chat.s','Gasten kunnen uw team berichten sturen'), optAan('gastchat')]);
        if (caps2.includes('rides')) rijen.push(['ritten', T('sw.ritten','Ritaanvragen'), T('sw.ritten.s','Nieuwe ritten aannemen via de app'), optAan('ritten')]);
        if (caps2.includes('doors')) rijen.push(['deurenGast', T('sw.deuren','Digitale gastsleutel'), T('sw.deuren.s','Gearriveerde gasten openen zelf de voordeur'), optAan('deurenGast')]);
        if (horeca) rijen.push(['events', T('sw.events','Event-aanmeldingen'), T('sw.events.s','Leden kunnen zich aanmelden voor uw events'), optAan('events')]);
        const swRows = rijen.map(r =>
          '<div class="st-row"><span>'+r[1]+'<span class="sub">'+r[2]+'</span></span>'+
          '<button class="obtn'+(r[3]?' primary':' warn')+'" data-kopt="'+r[0]+'" data-val="'+(r[3]?'0':'1')+'">'+(r[3]?T('sw.aan','Aan'):T('sw.uit','Uit'))+'</button></div>').join('');
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎛 '+T('sw.h','Baas over uw zaak')+'</h3>'+
          '<div class="tkc-who">'+T('sw.s','Zet elke functie aan of uit wanneer u dat wilt. Alleen betalen via de app staat altijd aan; het moment (vooraf of achteraf) bepaalt u zelf.')+'</div>'+
          funcBlok(T('sw.blok','Schakelaars'), rijen.map(r => ({ aan: r[3] })), swRows)+
          '<div class="st-row"><span>'+T('sw.apppay','Betalen via de app')+'<span class="sub">'+T('sw.apppay.s','Vast onderdeel van elk RTG-partnerschap')+'</span></span>'+
          '<span class="pill klaar">'+T('sw.altijd','Altijd aan')+'</span></div></div>';
        const maxD = Math.max.apply(null, b.week.map(d => d.omzet).concat([1]));
        html += '<div class="tkc"><h3>📈 '+T('bz.weekh','Omzet per dag')+'</h3>'+
          '<div style="display:flex;align-items:flex-end;gap:0.45rem;height:120px;margin-top:0.4rem;">'+
          b.week.map((d, i) =>
            '<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:0.2rem;height:100%;min-width:0;">'+
            '<span style="font-size:0.54rem;color:var(--soft);white-space:nowrap;">'+(d.omzet?eur(d.omzet):'·')+'</span>'+
            '<i style="display:block;width:100%;max-width:32px;border-radius:5px 5px 2px 2px;min-height:2px;height:'+Math.max(2, Math.round(d.omzet/maxD*70))+'%;background:'+(i===6?'var(--burgundy)':'var(--gold)')+';"></i>'+
            '<span style="font-size:0.52rem;color:var(--soft);text-transform:uppercase;">'+d.label+'</span></div>').join('')+'</div></div>';
        html += '<div class="tkc"><h3>🏆 '+T('bz.top','Toppers')+'</h3>'+
          (b.toppers.length ? b.toppers.map((t2, i) =>
            '<div class="st-row"><span>'+(['🥇','🥈','🥉'][i]||'')+' '+t2.naam+'<span class="sub">'+t2.aantal+'x '+T('bz.verkocht','verkocht')+'</span></span><b style="color:var(--gold);">'+eur(t2.omzet)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('bz.geentop','Nog geen verkopen. Zodra er via de app of de kassa verkocht wordt, staan de toppers hier.')+'</div>')+'</div>';
      }
    }
    if (kantoorSec === 'fin'){
      // de boekhouding van de zaak: btw per genre, personeelskosten uit de
      // klokuren en een boekhoudkundig correcte cadeaukaartenadministratie
      if (!finData){
        laadFinance();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (finData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📚 '+T('kt.fin','Boekhouding')+'</h3><div class="tkc-who">'+finData.error+'</div></div>';
      } else {
        const f = finData;
        if (finMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+finMsg+'</div>'; }
        // De onderste streep bovenaan: wat blijft er deze maand over? Omzet min de
        // af te dragen btw en de loonkosten. RTG houdt niets in (0% commissie).
        const omzetMaand = (f.btw || []).reduce((s2, r) => s2 + (r.omzet || 0), 0);
        const loonTot = (f.personeel && f.personeel.totaal) || 0;
        const nettoOver = Math.round((omzetMaand - (f.btwTotaal || 0) - loonTot) * 100) / 100;
        html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);"><h3>💶 '+T('fn.netto','Wat u overhoudt')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.omzetmaand','Omzet deze maand')+'<span class="sub">'+T('fn.nulcom','RTG rekent 0% commissie')+'</span></span><b>'+eur(omzetMaand)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minbtw','Af te dragen btw')+'</span><b style="color:var(--burgundy);">- '+eur(f.btwTotaal || 0)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.minloon','Loonkosten')+'</span><b style="color:var(--burgundy);">- '+eur(loonTot)+'</b></div>'+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.overhoudt','Blijft over (indicatie)')+'</b></span><b style="color:var(--gold);font-size:1.05rem;">'+eur(nettoOver)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.netto.s','Indicatie vóór inkoop, huur en overige kosten. Uw omzet is volledig van u; RTG houdt niets in.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.6rem;">'+
          '<button class="obtn" id="fnPdf">⤓ '+T('fn.exportpdf','Overzicht (PDF)')+'</button>'+
          '<button class="obtn" id="fnCsv">⤓ '+T('fn.exportcsv','Boekhouding (CSV)')+'</button></div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🌍 '+T('fn.land','Land & uurloon')+'</h3>'+
          '<div class="tkc-who">'+T('fn.land.s','Het land bepaalt de btw-tarieven, werkgeverslasten en aangifteregels; het uurloon voedt de personeelskosten.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">'+
          '<select class="st-in" id="fnLand" style="flex:2;min-width:130px;">'+f.landen.map(l=>'<option value="'+l.code+'"'+(l.code===f.land?' selected':'')+'>'+l.naam+'</option>').join('')+'</select>'+
          '<input class="st-in" id="fnUur" type="number" step="0.5" value="'+f.personeel.uurloon+'" style="flex:1;min-width:80px;" placeholder="€/uur">'+
          '<button class="obtn primary" id="fnSave">'+T('fn.save','Opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🧾 '+T('fn.btw','Btw deze maand')+' ('+f.maand+')</h3>'+
          (f.btw.length ? f.btw.map(r =>
            '<div class="st-row"><span>'+r.label+'<span class="sub">'+T('fn.omzet','omzet')+' '+eur(r.omzet)+' · '+T('fn.grondslag','grondslag')+' '+eur(r.grondslag)+' · '+r.tarief+'%</span></span>'+
            '<b style="color:var(--gold);">'+eur(r.btw)+'</b></div>').join('')
            : '<div class="tkc-who">'+T('fn.geenomzet','Nog geen omzet deze maand.')+'</div>')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.afdragen','Af te dragen btw')+'</b></span><b style="color:var(--gold);">'+eur(f.btwTotaal)+'</b></div></div>';
        html += '<div class="tkc"><h3>👥 '+T('fn.personeel','Personeelskosten')+' ('+f.maand+')</h3>'+
          '<div class="st-row"><span>'+T('fn.uren','Geklokte uren')+' × € '+f.personeel.uurloon+'<span class="sub">'+f.personeel.uren+' '+T('fn.uur','uur')+'</span></span><b>'+eur(f.personeel.bruto)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.lasten','Werkgeverslasten')+'<span class="sub">~'+f.personeel.lastenPct+'% ('+f.landNaam+')</span></span><b>'+eur(f.personeel.lasten)+'</b></div>'+
          (f.personeel.vakantiegeld ? '<div class="st-row"><span>'+T('fn.vak','Vakantiegeldreserve')+'<span class="sub">'+f.personeel.vakantiegeldPct+'%</span></span><b>'+eur(f.personeel.vakantiegeld)+'</b></div>' : '')+
          '<div class="st-row" style="border-top:1px solid var(--line);"><span><b>'+T('fn.totaal','Totale loonkosten')+'</b></span><b style="color:var(--gold);">'+eur(f.personeel.totaal)+'</b></div>'+
          '<div class="tkc-who">'+T('fn.minuur','Indicatie minimumuurloon')+': € '+f.personeel.uurloonMin+'</div></div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🎁 '+T('fn.gc','Cadeaukaarten')+'</h3>'+
          '<div class="st-row"><span>'+T('fn.gcverkocht','Verkocht deze maand')+'<span class="sub">'+T('fn.gcv.s','nog geen omzet, geen btw')+'</span></span><b>'+eur(f.giftcards.verkocht)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcin','Ingewisseld deze maand')+'<span class="sub">'+T('fn.gci.s','omzet + btw-moment')+'</span></span><b>'+eur(f.giftcards.ingewisseld)+'</b></div>'+
          '<div class="st-row"><span>'+T('fn.gcopen','Openstaand saldo')+'<span class="sub">'+T('fn.gco.s','verplichting op de balans')+' · '+f.giftcards.aantal+' '+T('fn.kaarten','kaart(en)')+'</span></span><b style="color:var(--gold);">'+eur(f.giftcards.open)+'</b></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.4rem;">'+
          '<input class="st-in" id="gcBedrag" type="number" placeholder="€ 50" style="flex:1;min-width:80px;">'+
          '<button class="obtn primary" id="gcSell">🎁 '+T('fn.gcsell','Verkoop kaart')+'</button></div>'+
          '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">'+
          '<input class="st-in" id="gcCode" placeholder="RTG-GC-XXXXXX" style="flex:2;min-width:130px;">'+
          '<input class="st-in" id="gcInBedrag" type="number" placeholder="€" style="flex:1;min-width:70px;">'+
          '<button class="obtn" id="gcRedeem">'+T('fn.gcredeem','In te wisselen')+'</button></div></div>';
        html += '<div class="tkc"><h3>📜 '+T('fn.regels','Regels in ')+f.landNaam+'</h3>'+
          f.regels.map(r => '<div class="tkc-who" style="line-height:1.5;">• '+r+'</div>').join('')+'</div>';
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>🤖 '+T('fn.ai','AI-boekhouder')+'</h3>'+
          '<div class="tkc-who">'+T('fn.ai.s2','Kent uw branche, uw cijfers en de regels. Stel een vraag, of laat hem u proactief bijsturen met adviezen op uw eigen cijfers.')+'</div>'+
          '<div id="accVragen" style="display:flex;gap:0.4rem;flex-wrap:wrap;margin:0.5rem 0;"></div>'+
          '<div class="row-gap"><input class="st-in" id="accQ" placeholder="'+T('fn.ai.ph','Bijv. hoeveel btw draag ik deze maand af?')+'" style="flex:1;">'+
          '<button class="obtn primary" id="accGo">'+T('fn.vraag','Vraag')+'</button></div>'+
          '<div id="accA" style="display:'+(accAntwoord?'block':'none')+';border:1px solid var(--gold);border-radius:12px;padding:0.7rem 0.9rem;font-size:0.82rem;line-height:1.6;margin-top:0.5rem;">'+accAntwoord+'</div>'+
          '<button class="obtn" id="accAdvies" style="margin-top:0.6rem;">✨ '+T('fn.adviezen','Stuur mij bij, geef adviezen')+'</button>'+
          '<div id="accAdv"></div></div>';
      }
    }
    if (kantoorSec === 'hr'){
      // het AI-weekrooster: voorstel op de verwachte drukte, de gemachtigde stelt vast
      if (!agentData) laadAgent();
      const rp = agentData && agentData.rooster;
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗓 '+T('ag2.rooster','AI-weekrooster')+'</h3>'+
        '<div class="tkc-who">'+T('ag2.rooster.deck','De AI plant de week op de verwachte drukte per dag: drukke dagen iedereen op de vloer, rustige dagen om de beurt vrij.')+'</div>'+
        (rp ? rp.days.map(d=>'<div class="st-row"><span><b>'+d.label+'</b> <span class="sub">'+d.date+'</span></span>'+
            '<span class="sub" style="text-align:right;">'+d.staff.map(m=>m.name.split(' ')[0]+': '+m.shift.split(' ')[0]).join(' · ')+'</span></div>').join('')+
          (rp.status==='voorstel'
            ? '<div class="tkc-act"><button class="tkc-ready" id="agRoosterOk">✔ '+T('ag2.rooster.ok','Stel vast')+'</button><button class="obtn warn" id="agRoosterNee" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>'
            : '<div class="tkc-who">✔ '+T('ag2.rooster.vast','Vastgesteld; het rooster in de PDA volgt dit plan.')+'</div>')
        : '<div class="tkc-act"><button class="tkc-start" id="agRooster">✨ '+T('ag2.rooster.stel','Stel het weekrooster voor')+'</button></div>')+'</div>';
      const apps = (state.applications||[]).filter(x=>x.status==='nieuw');
      html += '<div class="tkc"><h3>'+T('kt.sollicitaties','Sollicitaties')+(apps.length?' ('+apps.length+')':'')+'</h3>'+
        (apps.length ? apps.map(x=>'<div class="st-row"><span>'+x.name+' \u00b7 '+x.func+(x.viaRTG?' \u00b7 RTG':'')+'<span class="sub">'+x.contact+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-khire="'+x.id+'">'+T('ap.hire','Aannemen')+'</button><button class="obtn warn" data-kno="'+x.id+'">'+T('ap.reject','Afwijzen')+'</button></span></div>').join('')
        : '<div class="tkc-who">'+T('kt.noapps','Geen open sollicitaties.')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.team','Team & uitnodigingen')+'</h3>'+
        (state.staff||[]).map(m=>'<div class="st-row" style="flex-wrap:wrap;"><span>'+m.name+'<span class="sub">'+(m.func||'')+' \u00b7 '+(m.role==='manager'?'Manager':T('kt.staff','Medewerker'))+(m.lid?' \u00b7 '+T('kt.lid','RTG-lid'):'')+'</span></span>'+
          '<span class="acts">'+(m.id!==actor().staffId
            ? '<button class="obtn" data-kreset="'+m.id+'">'+T('kt.reset','Reset code')+'</button><button class="obtn warn" data-kdel="'+m.id+'">'+T('kt.ontslag','Ontslag')+'</button>'
            : '')+'</span></div>').join('')+
        '<div class="tkc-who" style="margin-top:0.55rem;line-height:1.5;">'+T('kt.invite.intro','Nodig uit; de medewerker meldt zich zelf aan met bedrijfsnaam + kassacode en een eigen RTG-account.')+'</div>'+
        '<div class="st-form"><input class="st-in" id="ktName" placeholder="'+T('kt.name.opt','Naam (optioneel)')+'"><input class="st-in" id="ktFunc" placeholder="'+T('kt.func','Functie (bijv. Bediening)')+'">'+
        '<select class="st-in" id="ktRole"><option value="staff">'+T('kt.staff','Medewerker')+'</option><option value="manager">Manager</option></select>'+
        '<button class="bigbtn" id="ktInvite" style="margin-top:0.2rem;">'+T('kt.invite','Nodig uit, kassacode verschijnt')+'</button></div></div>';
      // open kassacodes: teruglezen en intrekken
      if (!invData) laadInvites();
      const openInv = (invData && invData.invites) || [];
      html += '<div class="tkc"><h3>\ud83c\udf9f '+T('kt.openinv','Open kassacodes')+(openInv.length?' ('+openInv.length+')':'')+'</h3>'+
        (invData
          ? (openInv.length ? openInv.map(i =>
              '<div class="st-row"><span><span style="font-family:monospace;letter-spacing:0.14em;color:var(--gold);">'+escT(i.kassacode)+'</span>'+
              '<span class="sub">'+(i.naam?escT(i.naam)+' \u00b7 ':'')+(i.func?escT(i.func)+' \u00b7 ':'')+(i.role==='manager'?'Manager \u00b7 ':'')+T('kt.geldigtot','geldig t/m')+' '+new Date(i.expires).toLocaleDateString()+'</span></span>'+
              '<span class="acts"><button class="obtn warn" data-kinv="'+escT(i.kassacode)+'">'+T('kt.intrek','Trek in')+'</button></span></div>').join('')
            : '<div class="tkc-who">'+T('kt.geeninv','Geen open uitnodigingen.')+'</div>')
          : '<div class="tkc-who">'+T('kt.laden','Laden...')+'</div>')+'</div>';
      html += '<div class="tkc"><h3>'+T('kt.oproep','Hele team oproepen')+'</h3><div class="tkc-who">'+T('kt.oproep.s','Laat alle telefoons trillen, bijvoorbeeld bij een briefing.')+'</div>'+
        '<button class="obtn" id="ktBuzz" style="margin-top:0.4rem;">\uD83D\uDCE2 '+T('kt.buzzall','Buzz iedereen')+'</button></div>';
      // personeelszaken: verlofaanvragen beslissen en zien wie er nu is ingeklokt
      const verlofOpen = (state.verlof || []).filter(v => v.status === 'nieuw');
      const verlofRest = (state.verlof || []).filter(v => v.status !== 'nieuw').slice(0, 8);
      html += '<div class="tkc"><h3>\uD83C\uDF34 '+T('kt.verlof','Verlof & ziek')+(verlofOpen.length ? ' ('+verlofOpen.length+')' : '')+'</h3>'+
        (verlofOpen.length ? verlofOpen.map(v =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+v.name+'<span class="sub">'+v.van+' t/m '+(v.tot||'')+(v.reden?' \u00B7 '+v.reden:'')+'</span></span>'+
          '<span class="acts"><button class="obtn primary" data-kvja="'+v.id+'">'+T('kt.vja','Goedkeuren')+'</button><button class="obtn warn" data-kvnee="'+v.id+'">'+T('kt.vnee','Afwijzen')+'</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenverlof','Geen open aanvragen. Personeel vraagt verlof aan via de PDA; ziekmeldingen komen hier ook binnen.')+'</div>')+
        (verlofRest.length ? verlofRest.map(v =>
          '<div class="st-row"><span>'+v.name+'<span class="sub">'+(v.soort==='ziek'?T('kt.ziek','ziek gemeld')+' '+v.van:v.van+' t/m '+(v.tot||''))+'</span></span>'+
          '<span class="sub" style="text-transform:uppercase;font-size:0.6rem;letter-spacing:0.06em;">'+(v.status==='goedgekeurd'?'\u2705 '+T('kt.vok','goedgekeurd'):v.status==='afgewezen'?'\u2715 '+T('kt.vno','afgewezen'):'\uD83E\uDD12 '+T('kt.vzm','gemeld'))+'</span></div>').join('') : '')+'</div>';
      const klok2 = state.klok || { vandaag: [], binnen: [] };
      html += '<div class="tkc"><h3>\u23F1 '+T('kt.klok','Nu ingeklokt')+' ('+klok2.binnen.length+')</h3>'+
        (klok2.binnen.length ? klok2.binnen.map(n => '<div class="st-row"><span>\uD83D\uDFE2 '+n+'</span></div>').join('')
          : '<div class="tkc-who">'+T('kt.niemandin','Niemand is nu ingeklokt.')+'</div>')+
        (klok2.vandaag.length ? '<div class="tkc-who" style="margin-top:0.4rem;">'+T('kt.klokv','Vandaag geklokt')+': '+klok2.vandaag.length+' '+T('kt.klokr','registratie(s)')+' \u00B7 '+[...new Set(klok2.vandaag.map(e=>e.name))].length+' '+T('kt.klokp','personen')+'</div>' : '')+'</div>';
    }
    if (kantoorSec === 'keuken' || kantoorSec === 'bar'){
      const stn = kantoorSec;
      const items = (state.menu||[]).filter(m=>(m.station==='bar')===(stn==='bar'));
      const KANTEN = { warm:'Warme kant', koud:'Koude kant', snack:'Snacks', dessert:'Desserts' };
      // de kaart-bewerker: de chef past alles per gerecht aan, ook het vuurplan
      const bewerker = x => '<div class="st-form" data-kedit-form="'+x.id+'" style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin:0.3rem 0 0.5rem;">'+
        '<input class="st-in" data-kf="name" value="'+escT(x.name)+'" placeholder="'+T('menu.name','Naam')+'">'+
        '<div class="row-gap"><input class="st-in" data-kf="cat" value="'+escT(x.cat||'')+'" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" data-kf="price" type="number" inputmode="decimal" value="'+x.price+'" placeholder="\u20ac" style="flex:1;"></div>'+
        '<input class="st-in" data-kf="desc" value="'+escT(x.desc||'')+'" placeholder="'+T('kt.m.desc','Omschrijving (voor gast en keuken)')+'">'+
        (stn==='keuken'
          ? '<div class="row-gap"><select class="st-in" data-kf="sectie" style="flex:2;">'+Object.keys(KANTEN).map(k=>'<option value="'+k+'"'+((x.sectie||'warm')===k?' selected':'')+'>'+T('ks.'+k, KANTEN[k])+'</option>').join('')+'</select>'+
            '<input class="st-in" data-kf="prepMin" type="number" inputmode="numeric" value="'+(x.prepMin||'')+'" placeholder="'+T('kt.m.vuur','vuurplan-min')+'" style="flex:1;" title="'+T('kt.m.vuur.t','Bereidingstijd in minuten voor het vuurplan; leeg = de standaardtijd van de kant')+'"></div>'
          : '')+
        '<input class="st-in" data-kf="allergens" value="'+escT((x.allergens||[]).join(', '))+'" placeholder="'+T('kt.m.alg','Allergenen, met komma ertussen')+'">'+
        '<div class="row-gap"><button class="bigbtn" data-ksave="'+x.id+'" style="flex:1;">'+T('kt.m.save','Opslaan')+'</button>'+
        '<button class="obtn" data-kedit="'+x.id+'">'+T('kt.m.klaar','Klaar')+'</button></div></div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(stn==='bar'?'\uD83C\uDF78 Bar':'\uD83D\uDD25 '+T('kt.keuken','Keuken'))+' \u00b7 '+items.length+' '+T('kt.items','items op de kaart')+'</h3>'+
        (items.length ? items.map(x=>'<div class="st-row"><span>'+x.name+(x.uitverkocht?' <b style="color:#FF8589;">86</b>':'')+
          '<span class="sub">'+x.cat+' \u00b7 '+eur(x.price)+(stn==='keuken'?' \u00b7 '+T('ks.'+(x.sectie||'warm'), KANTEN[x.sectie||'warm'])+(x.prepMin?' \u00b7 \uD83D\uDD25 '+x.prepMin+' min':''):'')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(kantoorEdit===x.id?' primary':'')+'" data-kedit="'+x.id+'">\u270E</button><button class="obtn" data-kst="'+x.id+'">\u21c4 '+(stn==='bar'?T('kt.tokeuken','naar keuken'):T('kt.tobar','naar bar'))+'</button><button class="obtn warn" data-kmdel="'+x.id+'">\u2715</button></span></div>'+
          (kantoorEdit===x.id ? bewerker(x) : '')).join('')
        : '<div class="tkc-who">'+T('kt.noitems','Nog niets op de kaart voor deze werkplek.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktMn" placeholder="'+T('menu.name','Naam')+'"><div class="row-gap"><input class="st-in" id="ktMc" placeholder="'+T('menu.cat','Categorie')+'" style="flex:2;"><input class="st-in" id="ktMp" type="number" inputmode="decimal" placeholder="\u20ac" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktMAdd" style="margin-top:0.2rem;">'+T('kt.addcard','Zet op de kaart bij ')+(stn==='bar'?'de bar':T('kt.dekitchen','de keuken'))+'</button></div></div>';
      if (stn === 'keuken'){
        // de AI-inkoop: vaste leverancier koppelen, voorstellen goedkeuren of aanpassen
        if (!agentData){
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3><div class="tkc-who">\u2026</div></div>';
          laadAgent();
        } else {
          const A = agentData;
          html += '<div class="tkc" style="grid-column:1/-1;"><h3>\ud83e\udde0 '+T('ag2.h','AI-inkoop')+'</h3>'+
            '<div class="tkc-who">'+T('ag2.deck','De AI stelt de inkoop voor op de verkoop, de mise en place en de verwachte drukte. De gemachtigde keurt goed, past aan of wijst af; pas dan wordt er echt besteld bij de vaste leverancier.')+'</div>'+
            '<div class="row-gap"><select class="st-in" id="agGh" style="flex:2;"><option value="">'+T('ag2.kies','Kies een vaste leverancier...')+'</option>'+
              (agentMarkt||[]).map(g=>'<option value="'+g.code+'"'+(A.partnerCode===g.code?' selected':'')+'>'+g.name+'</option>').join('')+'</select>'+
              '<label style="display:flex;align-items:center;gap:0.35rem;font-size:0.72rem;color:var(--muted);"><input type="checkbox" id="agAuto"'+(A.auto?' checked':'')+'>'+T('ag2.auto','automatisch na de MEP-voorspelling')+'</label></div>'+
            '<div class="tkc-act"><button class="tkc-start" id="agKoppel">'+T('ag2.koppel','Koppel')+'</button>'+
            (A.partnerCode?'<button class="tkc-ready" id="agStel">\u2728 '+T('ag2.stel','Stel inkoop voor')+'</button>':'')+'</div>'+
            (A.voorstellen||[]).slice(0,3).map(v=>{
              const wacht = v.status === 'wacht-op-goedkeuring';
              return '<div style="border:1px solid var(--line);border-radius:12px;padding:0.7rem;margin-top:0.5rem;">'+
                '<div class="tkc-top"><span style="font-weight:600;">'+(v.groothandelNaam||'')+' \u00b7 \u20ac '+v.totaal+'</span><span class="tkc-age">'+(wacht?'\u23f3 '+T('ag2.wacht','wacht op de gemachtigde'):v.status+(v.ref?' \u00b7 '+v.ref:''))+'</span></div>'+
                '<div class="tkc-who">'+v.uitleg+'</div>'+
                (v.regels||[]).slice(0,10).map(r=>'<div class="st-row"><span>'+r.naam+'<span class="sub">'+(r.reden||'')+' \u00b7 \u20ac '+r.prijs+' / '+(r.eenheid||'st')+'</span></span>'+
                  (wacht?'<input class="st-in" style="width:4.5rem;flex:none;" type="number" min="1" value="'+r.aantal+'" data-agr="'+v.id+'" data-pid="'+r.productId+'">':'<span class="sub">'+r.aantal+'\u00d7</span>')+'</div>').join('')+
                (wacht?'<div class="tkc-act"><button class="tkc-ready" data-agok="'+v.id+'">\u2714 '+T('ag2.ok','Keur goed en bestel')+'</button><button class="obtn warn" data-agnee="'+v.id+'" style="margin-left:0.5rem;">'+T('ag2.nee','Wijs af')+'</button></div>':'')+
              '</div>';
            }).join('')+'</div>';
        }
      }
    }
    if (kantoorSec === 'bediening'){
      const st2 = state.settings || {};
      html += '<div class="tkc"><h3>'+T('kt.open','Open of dicht')+'</h3>'+
        '<div class="st-row"><span>'+T('bh.orders','Bestellingen')+'<span class="sub">'+T('kt.orders.s','Leden kunnen bestellen via de app')+'</span></span><button class="obtn'+(st2.ordersOpen!==false?' primary':' warn')+'" data-ktoggle="ordersOpen">'+(st2.ordersOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div>'+
        '<div class="st-row"><span>'+T('bh.res','Reserveringen')+'<span class="sub">'+T('kt.res.s','Nieuwe reserveringen aannemen')+'</span></span><button class="obtn'+(st2.reservationsOpen!==false?' primary':' warn')+'" data-ktoggle="reservationsOpen">'+(st2.reservationsOpen!==false?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button></div></div>';
      html += '<div class="tkc"><h3>'+T('kt.tafels','Tafelindeling')+'</h3>'+
        (state.tables||[]).map(t=>'<div class="st-row"><span>'+t.name+'<span class="sub">'+t.seats+' '+T('tbl.pers','pers.')+' \u00b7 '+tTbl(t.status)+'</span></span>'+
          '<span class="acts"><button class="obtn" data-sttbl="'+t.id+'" data-cur="'+t.status+'">\u21bb</button><button class="obtn warn" data-ktdel="'+t.id+'">\u2715</button></span></div>').join('')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="ktTn" placeholder="'+T('kt.tafelnaam','Tafelnaam')+'" style="flex:2;"><input class="st-in" id="ktTs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktTAdd" style="margin-top:0.2rem;">'+T('kt.tafeladd','Tafel toevoegen')+'</button></div></div>';
    }
    if (kantoorSec === 'events'){
      const evs = state.events || [];
      html += '<div class="tkc"><h3>'+T('kt.newevent','Nieuw event')+'</h3><div class="st-form">'+
        '<input class="st-in" id="kEvName" placeholder="'+T('kt.ev.name','Naam, bijv. Jazz & sake night')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvDate" type="date" style="flex:2;"><input class="st-in" id="kEvTime" type="time" style="flex:1;"></div>'+
        '<input class="st-in" id="kEvDesc" placeholder="'+T('kt.ev.desc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="kEvCap" type="number" placeholder="'+T('kt.ev.cap','Capaciteit')+'" style="flex:1;"><input class="st-in" id="kEvPrice" type="number" placeholder="'+T('kt.ev.price','Prijs p.p. (0 = gratis)')+'" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kEvAdd" style="margin-top:0.2rem;">'+T('kt.ev.add','Maak aan als concept')+'</button></div></div>';
      html += evs.map(e=>{
        const taken=(e.guests||[]).reduce((n,g)=>n+g.qty,0);
        const rs = e.runsheet || [];
        const stOpts = [['keuken','\uD83D\uDD25 '+T('kt.keuken','Keuken')],['bar','\uD83C\uDF78 Bar'],['bediening','\uD83E\uDDFE '+T('kt.bediening','Bediening')],['party','\uD83C\uDF9F Party manager'],['alle','\uD83D\uDCE2 '+T('rs.all','Iedereen')]];
        return '<div class="tkc'+(e.published?'':' dim')+'" style="grid-column:1/-1;"><div class="tkc-top"><span style="font-weight:600;">'+e.name+'</span><span class="tkc-age">'+e.date+(e.time?' \u00b7 '+e.time:'')+'</span></div>'+
        '<div class="tkc-who">'+taken+' / '+e.capacity+' '+T('ev.signedup','aangemeld')+(e.price?' \u00b7 '+eur(e.price)+' p.p.':'')+(e.published?'':' \u00b7 '+T('ev.concept','concept'))+'</div>'+
        '<h3 style="margin-top:0.4rem;">\uD83D\uDC68\u200D\uD83C\uDF73 '+T('ek.h','Event-keuken')+'</h3>'+
        '<div class="st-form"><select class="st-in" id="kcm'+e.id+'">'+
          '<option value="geen"'+(e.catering.mode==='geen'?' selected':'')+'>'+T('ek.none','Geen eten / n.v.t.')+'</option>'+
          '<option value="menu"'+(e.catering.mode==='menu'?' selected':'')+'>'+T('ek.menu','Vast menu')+'</option>'+
          '<option value="alacarte"'+(e.catering.mode==='alacarte'?' selected':'')+'>\u00c0 la carte</option></select>'+
        '<div style="display:flex;gap:0.4rem;flex-wrap:wrap;">'+(state.menu||[]).filter(m=>m.station!=='bar').map(m=>
          '<button class="mn-station'+(e.catering.itemIds.includes(m.id)?'" style="border-color:var(--gold);color:var(--gold);':'"')+'" data-kdish="'+m.id+'" data-ev="'+e.id+'">'+m.name+'</button>').join('')+'</div>'+
        '<button class="obtn" data-kcat="'+e.id+'">'+T('ek.save','Bewaar de eventkeuken')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.5rem;">'+
        ((e.allergies||[]).map(a=>'<div class="st-row"><span>\u26a0 '+a.allergen+' ('+a.count+'\u00d7)'+
          (a.alternative?'<span class="sub">\u2192 '+a.alternative.name+'</span>':'')+'</span>'+
          '<span class="acts">'+(!a.alternative?'<button class="obtn primary" data-kalt="'+e.id+'" data-al="'+a.id+'">\u2728 '+T('ek.alt','Vervangend gerecht')+'</button>':'')+
          '<button class="obtn warn" data-kaldel="'+e.id+'" data-al="'+a.id+'">\u2715</button></span></div>').join(''))+
        '<div class="row-gap"><input class="st-in" id="kaN'+e.id+'" placeholder="'+T('ek.allergen','Allergeen, bijv. noten')+'" style="flex:2;"><input class="st-in" id="kaC'+e.id+'" type="number" placeholder="1\u00d7" style="flex:1;"></div>'+
        '<button class="obtn" data-kaladd="'+e.id+'">'+T('ek.addal','Allergeen registreren')+'</button>'+
        '<button class="obtn primary" data-kmep="'+e.id+'">\u2728 '+T('ek.mep','Organiseer de mise en place')+'</button></div>'+
        '<h3 style="margin-top:0.6rem;">\uD83D\uDCCB '+T('rs.h','Draaiboek')+' ('+rs.length+')</h3>'+
        (rs.length ? rs.map(it=>'<div class="st-row"><span>'+(it.daysBefore?'<span style="font-size:0.6rem;letter-spacing:0.06em;color:var(--soft);margin-right:0.4rem;">D-'+it.daysBefore+'</span>':'')+'<b style="color:var(--gold);font-variant-numeric:tabular-nums;margin-right:0.6rem;">'+it.time+'</b>'+(RUN_ICON[it.station]||'')+' '+it.text+(it.done?' <span class="sub" style="display:inline;">\u2713 '+(it.doneBy||'')+'</span>':'')+'</span>'+
          '<button class="obtn warn" data-krdel="'+e.id+'" data-item="'+it.id+'">\u2715</button></div>').join('')
          : '<div class="tkc-who">'+T('rs.none','Nog geen draaiboek. Voer regels in, plak een bestaand draaiboek, of laat de AI er een opstellen.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" type="time" id="krT'+e.id+'" style="flex:1;">'+
        '<select class="st-in" id="krD'+e.id+'" style="flex:1;"><option value="0">'+T('rs.d0','Dag zelf')+'</option><option value="1">D-1</option><option value="2">D-2</option><option value="3">D-3</option></select>'+
        '<select class="st-in" id="krS'+e.id+'" style="flex:1.4;">'+stOpts.map(o=>'<option value="'+o[0]+'">'+o[1]+'</option>').join('')+'</select></div>'+
        '<input class="st-in" id="krX'+e.id+'" placeholder="'+T('rs.what','Wat moet er gebeuren?')+'">'+
        '<button class="obtn" data-kradd="'+e.id+'">'+T('rs.add','Regel toevoegen')+'</button></div>'+
        '<div class="st-form" style="margin-top:0.7rem;">'+
        '<textarea class="st-in" id="krP'+e.id+'" placeholder="'+T('rs.paste','Plak hier een bestaand draaiboek (per regel een tijd en taak), of kies een bestand...')+'" style="min-height:64px;resize:vertical;"></textarea>'+
        '<div style="display:flex;gap:0.5rem;flex-wrap:wrap;">'+
        '<label class="obtn" style="cursor:pointer;">\uD83D\uDCC4 '+T('rs.upload','Upload bestand')+'<input type="file" accept=".txt,.csv,.md,text/plain" data-krfile="'+e.id+'" style="display:none;"></label>'+
        '<button class="obtn" data-krimp="'+e.id+'">'+T('rs.import','Verwerk met AI')+'</button>'+
        '<button class="obtn primary" data-krai="'+e.id+'">\u2728 '+T('rs.suggest','Laat de AI een draaiboek opstellen')+'</button></div></div>'+
        '<div class="tkc-act" style="margin-top:0.7rem;"><button class="'+(e.published?'tkc-start':'tkc-ready')+'" data-kevpub="'+e.id+'">'+(e.published?T('kt.ev.offline','Haal offline'):T('kt.ev.publish','Publiceer voor leden'))+'</button>'+
        '<button class="tkc-start" data-kevdel="'+e.id+'" style="flex:0 0 auto;">\u2715</button></div></div>';
      }).join('');
    }
    if (kantoorSec === 'kamers'){
      const rooms = state.rooms || [];
      const unit = type === 'apartment' ? T('kt.unit','verblijf') : T('kt.kamer','kamer');
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(type==='apartment'?'🏡 '+T('kt.units','Verblijven'):'🛏 '+T('kt.kamers','Kamers'))+' ('+rooms.length+')</h3>'+
        (rooms.length ? rooms.map(r => {
          const hk = (r.hk && r.hk.status) || 'schoon';
          return '<div class="st-row"><span>'+r.name+(r.available?'':' · '+T('kt.offline','offline'))+
            '<span class="sub">'+eur(r.price)+' '+T('sup.pernight','p.n.')+' · '+tHk(hk)+(hk==='defect'&&r.hk&&r.hk.note?' · ⚠ '+r.hk.note:'')+'</span></span>'+
            '<span class="acts"><button class="obtn'+(r.available?' primary':' warn')+'" data-kmrt="'+r.id+'">'+(r.available?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
            '<button class="obtn" data-kmhk="'+r.id+'" data-cur="'+hk+'">🧹 '+tHk(hk)+'</button>'+
            '<button class="obtn warn" data-kmrd="'+r.id+'">✕</button></span></div>';
        }).join('') : '<div class="tkc-who">'+T('sup.norooms','Nog geen kamers. Voeg uw eerste kamer toe.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kRmN" placeholder="'+T('sup.roomname','Kamernaam')+'" style="flex:2;"><input class="st-in" id="kRmP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kRmAdd" style="margin-top:0.2rem;">'+(type==='apartment'?T('kt.unitadd','Verblijf toevoegen'):T('kt.kameradd','Kamer toevoegen'))+'</button></div>'+
        '<div class="tkc-who">'+T('kt.hknote','Tik op de bezem om de housekeeping-status door te schakelen; Dicht = direct onzichtbaar voor gasten.')+'</div></div>';
    }
    if (kantoorSec === 'minibar'){
      const cat = (state.minibar && state.minibar.catalog) || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🧊 '+T('kt.mbcat','Minibar-catalogus')+' ('+cat.length+')</h3>'+
        (cat.length ? cat.map(m=>'<div class="st-row"><span>'+m.name+'<span class="sub">'+eur(m.price)+'</span></span>'+
          '<button class="obtn warn" data-kmbd="'+m.id+'">✕</button></div>').join('')
        : '<div class="tkc-who">'+T('kt.nomb','Nog geen artikelen in de minibar.')+'</div>')+
        '<div class="st-form"><div class="row-gap"><input class="st-in" id="kMbN" placeholder="'+T('mb.newitem','Nieuw artikel')+'" style="flex:2;"><input class="st-in" id="kMbP" type="number" inputmode="decimal" placeholder="€" style="flex:1;"></div>'+
        '<button class="bigbtn" id="kMbAdd" style="margin-top:0.2rem;">'+T('team.add','Toevoegen')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.mbnote','De telling per kamer doet housekeeping in het tabblad Minibar; hier beheert u het assortiment en de prijzen.')+'</div></div>';
    }
    if (kantoorSec === 'deuren'){
      const doors = state.doors || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🚪 '+T('kt.deuren','Deuren')+'</h3>'+
        (doors.length ? doors.map(d=>'<div class="st-row"><span>'+(d.locked?'🔒':'🔓')+' '+d.name+
          '<span class="sub">'+(d.locked?T('door.locked','Vergrendeld'):T('door.open','OPEN, vergrendelt zichzelf'))+(d.lastBy?' · '+T('door.lastby','laatst:')+' '+d.lastBy:'')+'</span></span>'+
          '<button class="obtn'+(d.locked?' primary':' warn')+'" data-kdoor="'+d.id+'">'+(d.locked?T('door.openbtn','Open 10 sec'):T('door.lockbtn','Vergrendel nu'))+'</button></div>').join('')
        : '<div class="tkc-who">'+T('door.none','Nog geen digitale deuren gekoppeld.')+'</div>')+
        '<div class="tkc-who">'+T('door.note','Elke opening komt in de activiteitenfeed: wie, welke deur, wanneer. Gearriveerde gasten kunnen de voordeur zelf openen via hun app.')+'</div></div>';
    }
    if (kantoorSec === 'ritten'){
      // dispatch: open ritten toewijzen (slim voorstel met een tik), lopende ritten volgen
      const ritten = state.rides || [];
      const straks2 = r => r.plannedFor && (new Date(r.plannedFor) - Date.now()) > 45 * 60000;
      const alleOpenK = ritten.filter(r => r.status === 'aangevraagd' && !r.driver);
      const open = alleOpenK.filter(r => !straks2(r));
      const geplandK = alleOpenK.filter(straks2);
      const bezig = ritten.filter(r => !RIT_KLAAR(r.status) && (r.driver || r.status !== 'aangevraagd'));
      const chauffeurs = (state.staff||[]);
      const wagens = (state.fleet||[]).filter(v=>v.active);
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗺 '+T('kt.openritten','Open aanvragen')+' ('+open.length+')</h3>'+
        (open.length ? open.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+r.when+'</span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">✨ '+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenopen','Geen open aanvragen.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>📅 '+T('kt.gepland','Gepland')+' ('+geplandK.length+')</h3>'+
        (geplandK.length ? geplandK.map(r =>
          '<div class="st-row" style="flex-wrap:wrap;"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · <b>'+r.when+'</b></span></span>'+
          '<span class="acts" style="flex-wrap:wrap;">'+
            '<select class="st-in" data-ktch="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+chauffeurs.map(m=>'<option value="'+m.id+'">'+m.name+'</option>').join('')+'</select>'+
            '<select class="st-in" data-ktvg="'+r.ref+'" style="width:auto;padding:0.45rem 0.6rem;">'+wagens.map(v=>'<option value="'+v.id+'">'+v.name+'</option>').join('')+'</select>'+
            '<button class="obtn primary" data-ktwijs="'+r.ref+'">'+T('kt.wijs','Wijs toe')+'</button>'+
            '<button class="obtn" data-ktslim="'+r.ref+'">✨ '+T('kt.slim','Slim')+'</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.nietsgepland','Geen geplande ritten. Leden kunnen ritten dagen vooruit boeken.')+'</div>')+'</div>';
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+T('kt.lopend','Lopend')+' ('+bezig.length+')</h3>'+
        (bezig.length ? bezig.map(r =>
          '<div class="st-row"><span>'+r.customerCodename+' · '+tStatus(r.status)+
          '<span class="sub">'+(r.driver?r.driver.name:'?')+(r.vehicle?' · '+r.vehicle.name:'')+' · '+(r.to||'?')+' · '+(r.quote?eur(r.quote):'')+'</span></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenlopend','Niets onderweg.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'historie'){
      // ritgeschiedenis: gepagineerd en doorzoekbaar via de server, zodat dit
      // scherm er hetzelfde uitziet met tien of tien miljoen afgeronde ritten
      if (!histData){
        laadHistorie();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📒 '+T('kt.historie','Historie')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else {
        const h = histData;
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>📒 '+T('kt.historie','Historie')+' ('+h.total+')</h3>'+
          '<div class="tkc-who">'+T('kt.omzet','Totale ritomzet')+': <b style="color:var(--gold);">'+eur(h.omzet)+'</b> · '+T('kt.nulcom','RTG rekent 0% commissie.')+'</div>'+
          '<div style="display:flex;gap:0.5rem;margin:0.5rem 0;"><input class="st-in" id="ktHz" placeholder="'+T('kt.zoekrit','Zoek op gast, referentie of chauffeur')+'" value="'+histQ.replace(/"/g,'&quot;')+'" style="flex:1;">'+
          '<button class="obtn" id="ktHzGo">🔍 '+T('kt.zoek','Zoek')+'</button></div>'+
          (h.items.length ? h.items.map(r =>
            '<div class="st-row"><span>'+r.customerCodename+'<span class="sub">'+(r.from||'')+' → '+(r.to||'?')+' · '+ritRegel(r)+' · '+String(r.finishedAt||r.at).slice(0,16).replace('T',' ')+(r.driver?' · '+r.driver.name:'')+'</span></span>'+
            '<b style="color:var(--gold);">'+(r.quote?eur(r.quote):'')+'</b></div>'
          ).join('') : '<div class="tkc-who">'+(histQ ? T('kt.nietsgevonden','Niets gevonden voor deze zoekopdracht.') : T('kt.geenhistorie','Nog geen afgeronde ritten.'))+'</div>')+
          (h.pages > 1 ? '<div style="display:flex;align-items:center;justify-content:center;gap:0.9rem;margin-top:0.6rem;">'+
            '<button class="obtn" data-khist="-1"'+(h.page<=1?' disabled':'')+'>‹</button>'+
            '<span class="tkc-who" style="margin:0;">'+T('kt.pagina','Pagina')+' '+h.page+' / '+h.pages+'</span>'+
            '<button class="obtn" data-khist="1"'+(h.page>=h.pages?' disabled':'')+'>›</button></div>' : '')+
          (h.total ? '<div class="st-form"><button class="bigbtn" id="ktCsv">⬇ '+T('kt.csv','Exporteer alles als CSV')+' ('+h.total+')</button></div>' : '')+'</div>';
      }
    }
    if (kantoorSec === 'vloot'){
      const wagens = state.fleet || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>'+(type==='jet'?'✈️ '+T('kt.vloot','Vloot'):'🚘 '+T('kt.vloot','Vloot'))+' ('+wagens.length+')</h3>'+
        (wagens.length ? wagens.map(v =>
          '<div class="st-row"><span>'+v.name+(v.active?'':' · '+T('kt.offline','offline'))+'<span class="sub">'+(v.plate||'')+' · '+v.seats+' '+T('tbl.pers','pers.')+'</span></span>'+
          '<span class="acts"><button class="obtn'+(v.active?' primary':' warn')+'" data-ktvt="'+v.id+'">'+(v.active?T('kt.isopen','Open'):T('kt.isclosed','Dicht'))+'</button>'+
          '<button class="obtn warn" data-ktvd="'+v.id+'">✕</button></span></div>'
        ).join('') : '<div class="tkc-who">'+T('kt.geenvloot','Nog geen voertuigen.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="ktVn" placeholder="'+T('kt.vnaam','Naam, bijv. Mercedes S-klasse')+'">'+
        '<div class="row-gap"><input class="st-in" id="ktVp" placeholder="'+T('kt.kenteken','Kenteken / registratie')+'" style="flex:2;"><input class="st-in" id="ktVs" type="number" placeholder="4" style="flex:1;"></div>'+
        '<button class="bigbtn" id="ktVAdd" style="margin-top:0.2rem;">'+T('kt.vadd','Voertuig toevoegen')+'</button></div></div>';
    }
    if (kantoorSec === 'tarief'){
      const t2 = (state.settings && state.settings.tarief) || {};
      html += '<div class="tkc"><h3>🧮 '+T('kt.tarief','Tarief')+'</h3>'+
        '<div class="tkc-who">'+T('kt.tarief.s','Elke aanvraag krijgt hiermee direct een vaste nettoprijs voor het lid; u houdt 100%.')+'</div>'+
        '<div class="st-form">'+
        '<label class="soft-xs">'+T('kt.start','Starttarief (€)')+'</label><input class="st-in" id="ktTa" type="number" step="0.1" value="'+(t2.start||0)+'">'+
        '<label class="soft-xs">'+T('kt.perkm','Per kilometer (€)')+'</label><input class="st-in" id="ktTb" type="number" step="0.1" value="'+(t2.perKm||0)+'">'+
        '<label class="soft-xs">'+T('kt.min','Minimumprijs (€)')+'</label><input class="st-in" id="ktTc" type="number" step="1" value="'+(t2.minimum||0)+'">'+
        '<button class="bigbtn" id="ktTSave" style="margin-top:0.2rem;">'+T('kt.tsave','Tarief opslaan')+'</button></div></div>';
    }
    if (kantoorSec === 'diensten'){
      // het aanbod van de zelfstandige: diensten en producten, eigen beheer
      const sv = state.services || [];
      html += '<div class="tkc" style="grid-column:1/-1;"><h3>🗂️ '+T('kt.aanbod','Uw diensten en producten')+' ('+sv.length+')</h3>'+
        (sv.length ? sv.map(x =>
          '<div class="st-row"><span>'+(x.soort==='product'?'📦':'🗓️')+' '+x.name+'<span class="sub">'+(x.desc||'')+(x.duurMin?' · '+x.duurMin+' min':'')+'</span></span>'+
          '<span class="acts"><b style="color:var(--gold);margin-right:0.4rem;">'+eur(x.price)+'</b><button class="obtn warn" data-svdel="'+x.id+'">✕</button></span></div>').join('')
          : '<div class="tkc-who">'+T('kt.geenaanbod','Nog geen aanbod. Voeg hieronder uw eerste dienst of product toe.')+'</div>')+
        '<div class="st-form"><input class="st-in" id="svNaam" placeholder="'+T('kt.svnaam','Naam, bijv. Personal styling')+'">'+
        '<input class="st-in" id="svDesc" placeholder="'+T('kt.svdesc','Korte omschrijving')+'">'+
        '<div class="row-gap"><input class="st-in" id="svPrijs" type="number" placeholder="€" style="flex:1;">'+
        '<input class="st-in" id="svDuur" type="number" placeholder="'+T('kt.svduur','min.')+'" style="flex:1;">'+
        '<select class="st-in" id="svSoort" style="flex:1;"><option value="dienst">'+T('kt.svdienst','Dienst')+'</option><option value="product">'+T('kt.svproduct','Product')+'</option></select></div>'+
        '<button class="bigbtn" id="svAdd" style="margin-top:0.2rem;">'+T('kt.svadd','Zet in de RTG-app')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.svnote','Leden zien dit direct in de app en boeken met datum en tijd; u houdt 100% van de prijs.')+'</div></div>';
    }
    if (kantoorSec === 'prijzen'){
      const h = state.prices || [];
      html += '<div class="tkc"><h3>💶 '+T('kt.newprice','Prijs doorgeven aan RTG')+'</h3>'+
        '<div class="st-form"><input class="st-in" id="kPrS" placeholder="'+T('kt.service','Dienst, bijv. Luchthaven, centrum')+'">'+
        '<input class="st-in" id="kPrP" type="number" inputmode="decimal" placeholder="€">'+
        '<button class="bigbtn" id="kPrSend" style="margin-top:0.2rem;">'+T('kt.sendprice','Verstuur naar RTG')+'</button></div>'+
        '<div class="tkc-who">'+T('kt.pricenote','RTG-leden betalen uw nettoprijs; u ontvangt altijd het volledige bedrag, RTG rekent 0% commissie.')+'</div></div>';
      html += '<div class="tkc"><h3>'+T('sup.pricehist','Eerder doorgegeven')+'</h3>'+
        (h.length ? h.slice(0,10).map(p=>'<div class="st-row"><span>'+p.service+'<span class="sub">'+timeAgo(p.at)+'</span></span><b style="color:var(--gold);">'+eur(p.price)+'</b></div>').join('')
        : '<div class="tkc-who">'+T('sup.noprices','Nog geen prijzen doorgegeven.')+'</div>')+'</div>';
    }
    if (kantoorSec === 'marketing'){
      const photos = state.photos || [];
      html += '<div class="tkc"><h3>📷 '+T('sup.photos','Foto\'s op uw pagina')+' ('+photos.length+'/6)</h3>'+
        '<div class="ph-grid" style="margin-top:0.5rem;">'+
        photos.map((p,i)=>'<div class="ph"><img src="'+p+'" alt=""><button data-kphd="'+i+'">✕</button></div>').join('')+
        (photos.length<6?'<label class="ph add">+<input type="file" id="kPhFile" accept="image/jpeg,image/png,image/webp" style="display:none;"></label>':'')+
        '</div><div class="tkc-who">'+T('sup.photonote','Gasten zien deze foto\'s in de RTG-app bij uw pagina, direct na plaatsen.')+'</div></div>';
      html += '<div class="tkc"><h3>📣 '+T('sup.salonpub','Publiceer op De Salon')+'</h3>'+
        '<div class="st-form"><textarea class="st-in" id="kSpText" placeholder="'+T('kt.salonph','Vertel RTG-leden over uw nieuwste aanbod, suite of avond...')+'" style="min-height:70px;resize:vertical;"></textarea>'+
        (photos.length?'<div class="ph-pick">'+photos.map((p,i)=>'<img src="'+p+'" data-kpick="'+i+'" alt="">').join('')+'</div>':'')+
        '<button class="bigbtn" id="kSpPost">'+T('sup.salonpost','Publiceer als RTG-partner')+'</button></div>'+
        '<div class="tkc-who">'+T('sup.salonnote','Uw bericht staat er direct, zonder wachttijd (de 7-dagen-regel geldt alleen voor leden). Alle leden zien het met uw bedrijfsnaam als partner; uw volgers krijgen een melding.')+'</div></div>';
      // het verplichte Salon-bedrijfsaccount met marketinggereedschap en cijfers
      if (!mktData){
        laadMarketing();
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+T('kt.laden','Laden...')+'</div></div>';
      } else if (mktData.error){
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3><div class="tkc-who">'+mktData.error+'</div></div>';
      } else {
        const mk = mktData;
        if (mktMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+mktMsg+'</div>'; }
        html += '<div class="tkc" style="grid-column:1/-1;"><h3>✦ '+T('mk.salon','Uw Salon-bedrijfsaccount')+'</h3>'+
          '<div class="tkc-who">'+T('mk.salon.s','Vast onderdeel van uw RTG-partnerschap: leden volgen uw zaak en krijgen een melding bij elk bericht.')+'</div>'+
          '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:0.55rem;">'+
          [[T('mk.volgers','Volgers'), mk.volgers], [T('mk.posts','Berichten'), mk.posts], ['Likes', mk.likes], [T('mk.reacties','Reacties'), mk.reacties]]
          .map(x => '<div style="background:rgba(255,255,255,0.04);border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.7rem;text-align:center;">'+
            '<div style="font-family:\'Bodoni Moda\',serif;font-size:1.25rem;color:var(--gold);">'+x[1]+'</div>'+
            '<div style="font-size:0.54rem;letter-spacing:0.1em;text-transform:uppercase;color:var(--soft);margin-top:0.1rem;">'+x[0]+'</div></div>').join('')+'</div>'+
          '<div class="st-form"><textarea class="st-in" id="mkBio" placeholder="'+T('mk.bioph','Uw bio op De Salon, bijv. aan zee sinds 1998, drie generaties.')+'" style="min-height:52px;resize:vertical;">'+(mk.bio||'')+'</textarea>'+
          '<button class="obtn primary" id="mkBioSave" style="align-self:flex-start;">'+T('mk.biosave','Bio opslaan')+'</button></div></div>';
        html += '<div class="tkc"><h3>🎁 '+T('mk.deal','Exclusieve aanbieding')+'</h3>'+
          '<div class="tkc-who">'+T('mk.deal.s','Alleen voor leden; zij claimen met een persoonlijke code die u aan de kassa verzilvert. Pure klantbinding.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkDt" placeholder="'+T('mk.dealtitel','Titel, bijv. Amuse van het huis')+'">'+
          '<input class="st-in" id="mkDx" placeholder="'+T('mk.dealtekst','Tekst, bijv. Bij elk diner deze maand')+'">'+
          '<input class="st-in" id="mkDg" type="date">'+
          '<button class="bigbtn" id="mkDealGo">'+T('mk.dealgo','Zet op De Salon')+'</button></div>'+
          (mk.deals.length ? mk.deals.map(d2 =>
            '<div class="st-row"><span>'+d2.titel+'<span class="sub">'+(d2.geldigTot?'t/m '+d2.geldigTot+' · ':'')+d2.claims+' '+T('mk.claims','geclaimd')+' · '+d2.verzilverd+' '+T('mk.verzilverd','verzilverd')+'</span></span></div>').join('') : '')+
          '<div style="display:flex;gap:0.5rem;margin-top:0.4rem;"><input class="st-in" id="mkCode" placeholder="RTG-D-XXXXXX" style="flex:1;">'+
          '<button class="obtn" id="mkRedeem">'+T('mk.innen','Verzilver')+'</button></div></div>';
        html += '<div class="tkc"><h3>📊 '+T('mk.poll','Vraag het uw leden (poll)')+'</h3>'+
          '<div class="tkc-who">'+T('mk.poll.s','Marketinginzicht: laat leden kiezen en zie live de uitslag.')+'</div>'+
          '<div class="st-form"><input class="st-in" id="mkPv" placeholder="'+T('mk.pollvraag','Vraag, bijv. welk menu in december?')+'">'+
          '<input class="st-in" id="mkP1" placeholder="'+T('mk.optie','Optie')+' 1"><input class="st-in" id="mkP2" placeholder="'+T('mk.optie','Optie')+' 2"><input class="st-in" id="mkP3" placeholder="'+T('mk.optie','Optie')+' 3 ('+T('mk.optioneel','optioneel')+')">'+
          '<button class="bigbtn" id="mkPollGo">'+T('mk.pollgo','Plaats de poll')+'</button></div>'+
          (mk.polls.length ? mk.polls.map(pl =>
            '<div style="margin-top:0.4rem;"><div class="tkc-who" style="color:var(--txt);">'+pl.vraag+'</div>'+
            pl.opties.map(o => '<div class="st-row" style="padding:0.3rem 0;"><span class="sub">'+o.tekst+'</span><b style="color:var(--gold);">'+o.stemmen+'</b></div>').join('')+'</div>').join('') : '')+'</div>';
      }
    }
    return html;
  }

  function bindKantoor(el){
    el.querySelectorAll('[data-ksec]').forEach(b => b.addEventListener('click', () => { kantoorSec = b.dataset.ksec; kantoorMsg=''; histData = null; histPage = 1; boData = null; finData = null; finMsg = ''; mktData = null; mktMsg = ''; invData = null; renderStation(); }));
    // Salon-bedrijfsaccount: bio, aanbiedingen (plaatsen en verzilveren) en polls
    const mkB = el.querySelector('#mkBioSave'); if (mkB) mkB.addEventListener('click', async () => {
      try { await API.call('/supplier/salon/bio', { bio: el.querySelector('#mkBio').value }); mktMsg = '✅ '+T('mk.bioklaar','Bio opgeslagen.'); mktData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const mkD = el.querySelector('#mkDealGo'); if (mkD) mkD.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/deal', { titel: el.querySelector('#mkDt').value, text: el.querySelector('#mkDx').value, geldigTot: el.querySelector('#mkDg').value });
        mktMsg = '🎁 '+T('mk.dealklaar','Aanbieding staat op De Salon; uw volgers hebben een melding gekregen.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkR = el.querySelector('#mkRedeem'); if (mkR) mkR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/salon/deal/redeem', { code: el.querySelector('#mkCode').value });
        mktMsg = '✅ '+T('mk.geind','Verzilverd:')+' <b>'+d.titel+'</b> · '+d.codename;
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const mkP = el.querySelector('#mkPollGo'); if (mkP) mkP.addEventListener('click', async () => {
      try {
        await API.call('/supplier/salon/poll', { vraag: el.querySelector('#mkPv').value,
          opties: [el.querySelector('#mkP1').value, el.querySelector('#mkP2').value, el.querySelector('#mkP3').value].filter(x => x && x.trim()) });
        mktMsg = '📊 '+T('mk.pollklaar','Poll staat op De Salon.');
        mktData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    // boekhouding: land en uurloon opslaan, cadeaukaarten en de AI-boekhouder
    const fnS = el.querySelector('#fnSave'); if (fnS) fnS.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { land: el.querySelector('#fnLand').value, uurloon: Number(el.querySelector('#fnUur').value) });
        finData = null; finMsg = '';
        await refresh();
      } catch(e){ toast(e.message); }
    });
    const fnP = el.querySelector('#fnPdf'); if (fnP) fnP.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'pdf' }, 'RTG-boekhouding.pdf'));
    const fnC = el.querySelector('#fnCsv'); if (fnC) fnC.addEventListener('click', () => dlBestand('/supplier/finance/export', { formaat: 'csv' }, 'RTG-boekhouding.csv'));
    const gS = el.querySelector('#gcSell'); if (gS) gS.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/sell', { bedrag: Number(el.querySelector('#gcBedrag').value) });
        finMsg = '🎁 '+T('fn.gcklaar','Cadeaukaart verkocht. Geef deze code mee:')+' <b style="color:var(--gold);">'+d.kaart.code+'</b> (€ '+d.kaart.bedrag+')';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const gR = el.querySelector('#gcRedeem'); if (gR) gR.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/giftcard/redeem', { code: el.querySelector('#gcCode').value, bedrag: Number(el.querySelector('#gcInBedrag').value) });
        finMsg = '✅ '+T('fn.gcgeind','Ingewisseld. Restsaldo op de kaart:')+' <b style="color:var(--gold);">€ '+d.saldo+'</b>';
        finData = null;
        renderStation();
      } catch(e){ toast(e.message); }
    });
    const aG = el.querySelector('#accGo'); if (aG) aG.addEventListener('click', async () => {
      const q = el.querySelector('#accQ').value.trim();
      if (!q) return;
      accAntwoord = '…';
      renderStation();
      try { accAntwoord = esc((await API.call('/supplier/accountant', { question: q })).answer); }
      catch(e){ accAntwoord = esc(e.message); }
      renderStation();
    });
    const aQ = el.querySelector('#accQ'); if (aQ) aQ.addEventListener('keydown', e => { if (e.key === 'Enter' && aG) aG.click(); });
    // branchevragen als klikbare chips
    const vBox = el.querySelector('#accVragen');
    if (vBox) API.call('/supplier/accountant/vragen', {}).then(d => {
      vBox.innerHTML = (d.vragen || []).map(q => '<button class="obtn js-accv" style="font-size:0.72rem;padding:0.3rem 0.7rem;">' + esc(q) + '</button>').join('');
      vBox.querySelectorAll('.js-accv').forEach(b => b.addEventListener('click', () => { const q = el.querySelector('#accQ'); q.value = b.textContent; if (aG) aG.click(); }));
    }).catch(() => {});
    // proactieve adviezen op de eigen cijfers
    const adv = el.querySelector('#accAdvies');
    if (adv) adv.addEventListener('click', async () => {
      const box = el.querySelector('#accAdv');
      box.innerHTML = '<div class="tkc-who" style="margin-top:0.6rem;">' + T('fn.advbezig', 'Ik kijk naar uw cijfers…') + '</div>';
      try {
        const d = await API.call('/supplier/accountant/adviezen', {});
        box.innerHTML = (d.intro ? '<div style="font-size:0.82rem;margin:0.6rem 0;line-height:1.6;">' + esc(d.intro) + '</div>' : '') +
          (d.adviezen || []).map(a => '<div style="border:1px solid var(--line);border-radius:12px;padding:0.6rem 0.8rem;margin-top:0.5rem;"><b style="color:var(--gold);font-size:0.8rem;">' + esc(a.titel) + '</b><div style="font-size:0.8rem;color:var(--soft);margin-top:0.2rem;line-height:1.5;">' + esc(a.tekst) + '</div></div>').join('');
      } catch(e){ box.innerHTML = '<div class="tkc-who">' + esc(e.message) + '</div>'; }
    });
    // schakelaars van de zaak: elke functie aan of uit, direct doorgevoerd
    wireFuncBlok(el);
    el.querySelectorAll('[data-kopt]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.kopt, v = b.dataset.val === '1';
      b.disabled = true;
      try {
        if (k === 'ordersOpen' || k === 'reservationsOpen') await API.call('/supplier/settings', { [k]: v });
        else await API.call('/supplier/settings', { opties: { [k]: v } });
        boData = null;
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    const bb = el.querySelector('#boBrief'); if (bb) bb.addEventListener('click', () => {
      const t2 = el.querySelector('#boBriefTxt');
      if (!t2) return;
      t2.textContent = (boData && boData.briefing) || '';
      t2.style.display = t2.style.display === 'none' ? 'block' : 'none';
    });
    el.querySelectorAll('[data-khire]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/apply/decide', { id: b.dataset.khire, action: 'aannemen' });
        kantoorMsg = '\u2705 '+T('kt.hired','Aangenomen.')+' <b>'+escT(d.invite.naam)+'</b> '+T('kt.hired.geef','meldt zich zelf aan met bedrijfsnaam')+' <b>'+escT(d.bedrijf)+'</b> + '+T('kt.invite.code','Kassacode')+' <b style="color:var(--gold);font-family:monospace;letter-spacing:0.14em;">'+escT(d.invite.kassacode)+'</b>';
        invData = null;
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kreset]').forEach(b => b.addEventListener('click', async () => {
      try { const d = await API.call('/supplier/staff/reset-pin', { staffId: b.dataset.kreset });
        kantoorMsg = '\ud83d\udd11 '+T('kt.resetdone','Code gereset voor')+' <b>'+escT(d.staff.name)+'</b> \u00b7 '+T('kt.newpin','nieuwe pincode')+': <b style="color:var(--gold);">'+escT(d.pin)+'</b> ('+T('kt.pinonce','geef eenmalig door')+')';
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kinv]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/invite/intrek', { kassacode: b.dataset.kinv });
        invData = null; toast(T('kt.ingetrokken','Uitnodiging ingetrokken.')); renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kno]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/apply/decide', { id: b.dataset.kno, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/staff/remove', { staffId: b.dataset.kdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktInvite = el.querySelector('#ktInvite'); if (ktInvite) ktInvite.addEventListener('click', async () => {
      try {
        const d = await API.call('/supplier/staff/invite', { name: el.querySelector('#ktName').value.trim(), func: el.querySelector('#ktFunc').value.trim(), role: el.querySelector('#ktRole').value });
        kantoorMsg = T('kt.invite.done','Uitnodiging klaar. Geef deze twee dingen door aan uw medewerker:')+'<br>'+
          '<b>'+T('kt.invite.biz','Bedrijfsnaam')+':</b> '+escT(d.bedrijf)+'<br>'+
          '<b>'+T('kt.invite.code','Kassacode')+':</b> <span style="font-family:monospace;font-size:1.25rem;letter-spacing:0.18em;color:var(--gold);">'+escT(d.invite.kassacode)+'</span><br>'+
          '<span class="sub">'+T('kt.invite.note','Eenmalig, 30 dagen geldig.')+'</span>';
        toast(T('kt.invite.toast','Kassacode aangemaakt.'));
        invData = null; laadInvites();
      } catch(e){ toast(e.message); }
    });
    const ktBuzz = el.querySelector('#ktBuzz'); if (ktBuzz) ktBuzz.addEventListener('click', async () => {
      try { await API.call('/supplier/team/buzz', { all: true }); toast(T('kt.buzzed','Iedereen opgeroepen.')); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kst]').forEach(b => b.addEventListener('click', async () => {
      const menu = (state.menu||[]).map(x => x.id === b.dataset.kst ? { ...x, station: x.station === 'bar' ? 'keuken' : 'bar' } : x);
      try { await API.call('/supplier/menu', { menu }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // de kaart-bewerker openen/sluiten en opslaan (alles per gerecht, ook het vuurplan)
    el.querySelectorAll('[data-kedit]').forEach(b => b.addEventListener('click', () => {
      kantoorEdit = kantoorEdit === b.dataset.kedit ? null : b.dataset.kedit;
      renderStation();
    }));
    el.querySelectorAll('[data-ksave]').forEach(b => b.addEventListener('click', async () => {
      const form = el.querySelector('[data-kedit-form="'+b.dataset.ksave+'"]'); if (!form) return;
      const v = k => { const inp = form.querySelector('[data-kf="'+k+'"]'); return inp ? inp.value : null; };
      const menu = (state.menu||[]).map(x => {
        if (x.id !== b.dataset.ksave) return x;
        const naam = (v('name')||'').trim();
        return { ...x,
          name: naam || x.name,
          cat: (v('cat')||'').trim() || x.cat,
          price: Number(v('price')) > 0 ? Number(v('price')) : x.price,
          desc: (v('desc')||'').trim(),
          sectie: v('sectie') != null ? v('sectie') : x.sectie,
          prepMin: v('prepMin') != null ? (parseInt(v('prepMin'), 10) || 0) : x.prepMin,
          allergens: v('allergens') != null ? v('allergens').split(',').map(a=>a.trim()).filter(Boolean) : x.allergens
        };
      });
      try { await API.call('/supplier/menu', { menu }); kantoorEdit = null; toast(T('kt.m.saved','Kaart bijgewerkt; het vuurplan rekent er direct mee.')); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/menu', { menu: (state.menu||[]).filter(x=>x.id!==b.dataset.kmdel) }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktM = el.querySelector('#ktMAdd'); if (ktM) ktM.addEventListener('click', async () => {
      const name = el.querySelector('#ktMn').value.trim(), price = Number(el.querySelector('#ktMp').value);
      if (!name || !(price>0)){ toast(T('menu.fill','Vul een naam en prijs in.')); return; }
      const item = { id: 'm'+Date.now().toString(36), cat: el.querySelector('#ktMc').value.trim()||T('menu.other','Overig'), name, desc:'', price, allergens:[], station: kantoorSec };
      try { await API.call('/supplier/menu', { menu: [...(state.menu||[]), item] }); await refresh(); } catch(e){ toast(e.message); }
    });
    // de AI-bedrijfsagent: koppelen, inkoop voorstellen, goedkeuren/aanpassen/afwijzen, rooster
    const agK = el.querySelector('#agKoppel'); if (agK) agK.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/koppel', { groothandelCode: el.querySelector('#agGh').value, auto: el.querySelector('#agAuto').checked }); agentData = null; toast(T('ag2.gekoppeld','Vaste leverancier bijgewerkt.')); renderStation(); } catch(e){ toast(e.message); }
    });
    const agS = el.querySelector('#agStel'); if (agS) agS.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-agok]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.agok;
      const regels = [...el.querySelectorAll('[data-agr="'+id+'"]')].map(inp => ({ productId: inp.dataset.pid, aantal: inp.value }));
      try { const d = await API.call('/supplier/agent/beslis', { id, actie: 'akkoord', regels }); toast('✔ '+T('ag2.besteld','Besteld bij de leverancier')+(d.order?' ('+d.order.ref+')':'')); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-agnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/agent/beslis', { id: b.dataset.agnee, actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    }));
    const agR = el.querySelector('#agRooster'); if (agR) agR.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/voorstel', {}); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    const agRok = el.querySelector('#agRoosterOk'); if (agRok) agRok.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'akkoord' }); agentData = null; toast(T('ag2.rooster.vastok','Weekrooster vastgesteld.')); renderStation(); } catch(e){ toast(e.message); }
    });
    const agRnee = el.querySelector('#agRoosterNee'); if (agRnee) agRnee.addEventListener('click', async () => {
      try { await API.call('/supplier/rooster/beslis', { actie: 'afwijzen' }); agentData = null; renderStation(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-ktoggle]').forEach(b => b.addEventListener('click', async () => {
      const k = b.dataset.ktoggle, cur = (state.settings||{})[k] !== false;
      try { const body = {}; body[k] = !cur; await API.call('/supplier/settings', body); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/table/remove', { id: b.dataset.ktdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktT = el.querySelector('#ktTAdd'); if (ktT) ktT.addEventListener('click', async () => {
      const name = el.querySelector('#ktTn').value.trim(); if(!name){ toast(T('kt.filltafel','Geef de tafel een naam.')); return; }
      try { await API.call('/supplier/table/add', { name, seats: Number(el.querySelector('#ktTs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    const kEv = el.querySelector('#kEvAdd'); if (kEv) kEv.addEventListener('click', async () => {
      const name = el.querySelector('#kEvName').value.trim(), date = el.querySelector('#kEvDate').value;
      if (!name || !date){ toast(T('kt.ev.fill','Vul minimaal een naam en datum in.')); return; }
      try { await API.call('/supplier/event', { action:'add', event: { name, date, time: el.querySelector('#kEvTime').value, desc: el.querySelector('#kEvDesc').value.trim(), capacity: Number(el.querySelector('#kEvCap').value)||50, price: Number(el.querySelector('#kEvPrice').value)||0 } });
        kantoorMsg = '\u2705 '+T('kt.ev.made','Event aangemaakt als concept. Publiceer hem zodra hij af is.');
        await refresh(); } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-kevpub]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'publish', id: b.dataset.kevpub }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kevdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event', { action:'remove', id: b.dataset.kevdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // draaiboek: regel toevoegen / weghalen / plakken / uploaden / AI
    el.querySelectorAll('[data-kradd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kradd;
      const text = el.querySelector('#krX'+id).value.trim();
      if (!text){ toast(T('rs.fill','Omschrijf wat er moet gebeuren.')); return; }
      try { await API.call('/supplier/event/runsheet', { id, action:'add', item: { time: el.querySelector('#krT'+id).value || '00:00', station: el.querySelector('#krS'+id).value, text, daysBefore: Number(el.querySelector('#krD'+id).value)||0 } }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // eventkeuken: gerechten aan/uit tikken en bewaren
    el.querySelectorAll('[data-kdish]').forEach(b => b.addEventListener('click', () => {
      const aan = b.style.borderColor !== '';
      b.style.borderColor = aan ? '' : 'var(--gold)';
      b.style.color = aan ? '' : 'var(--gold)';
    }));
    el.querySelectorAll('[data-kcat]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kcat;
      const itemIds = [...el.querySelectorAll('[data-kdish][data-ev="'+id+'"]')].filter(x => x.style.borderColor !== '').map(x => x.dataset.kdish);
      try { await API.call('/supplier/event/catering', { id, mode: el.querySelector('#kcm'+id).value, itemIds });
        kantoorMsg = '\u2705 '+T('ek.saved','Eventkeuken bewaard; de keuken ziet het direct op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaladd]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.kaladd;
      const allergen = el.querySelector('#kaN'+id).value.trim();
      if (!allergen){ toast(T('ek.fillallergen','Vul het allergeen in.')); return; }
      try { await API.call('/supplier/event/allergy', { id, action:'add', allergen, count: Number(el.querySelector('#kaC'+id).value)||1 }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kaldel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/allergy', { id: b.dataset.kaldel, action:'remove', allergyId: b.dataset.al }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kalt]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.thinking','De chef denkt na...');
      try { const d = await API.call('/supplier/event/allergy/alt', { id: b.dataset.kalt, allergyId: b.dataset.al });
        kantoorMsg = '\u2728 '+T('ek.altmade','Vervangend gerecht')+': <b>'+d.alternative.name+'</b>'+(d.alternative.desc?' \u00b7 '+d.alternative.desc:'');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-kmep]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('ek.busy','De mise en place wordt georganiseerd...');
      try { const d = await API.call('/supplier/event/mep', { id: b.dataset.kmep });
        kantoorMsg = '\u2705 '+d.added+' '+T('ek.planned2','MEP-taken ingepland (') + d.covers + ' couverts); '+T('ek.onscreen','de keuken ziet ze dagen vooruit op het keukenscherm.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/event/runsheet', { id: b.dataset.krdel, action:'remove', itemId: b.dataset.item }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-krfile]').forEach(inp => inp.addEventListener('change', () => {
      const f = inp.files && inp.files[0]; if (!f) return;
      const rd = new FileReader();
      rd.onload = () => { el.querySelector('#krP'+inp.dataset.krfile).value = String(rd.result || '').slice(0, 6000); toast(T('rs.loaded','Bestand ingeladen, klik op Verwerk met AI.')); };
      rd.readAsText(f);
    }));
    el.querySelectorAll('[data-krimp]').forEach(b => b.addEventListener('click', async () => {
      const id = b.dataset.krimp;
      const text = el.querySelector('#krP'+id).value.trim();
      if (!text){ toast(T('rs.pastefirst','Plak eerst een draaiboek of upload een bestand.')); return; }
      b.disabled = true;
      try { const d = await API.call('/supplier/event/runsheet/ai', { id, mode:'import', text });
        kantoorMsg = '\u2705 '+d.added+' '+T('rs.imported','regels in het draaiboek gezet, verdeeld over de werkplekken.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    el.querySelectorAll('[data-krai]').forEach(b => b.addEventListener('click', async () => {
      b.disabled = true; b.textContent = T('rs.thinking','De AI stelt het draaiboek op...');
      try { const d = await API.call('/supplier/event/runsheet/ai', { id: b.dataset.krai, mode:'suggest' });
        kantoorMsg = '\u2728 '+d.added+' '+T('rs.suggested','regels voorgesteld. Pas aan wat niet past en publiceer het event.');
        await refresh(); } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // kamers of verblijven: open/dicht, housekeeping doorschakelen, toevoegen
    el.querySelectorAll('[data-kmrt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/toggle', { id: b.dataset.kmrt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmhk]').forEach(b => b.addEventListener('click', async () => {
      const volg = { schoon:'vuil', vuil:'bezig', bezig:'bezet', bezet:'defect', defect:'schoon' };
      try { await API.call('/supplier/room/hk', { id: b.dataset.kmhk, status: volg[b.dataset.cur] || 'schoon' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kmrd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/room/remove', { id: b.dataset.kmrd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kRm = el.querySelector('#kRmAdd'); if (kRm) kRm.addEventListener('click', async () => {
      const name = el.querySelector('#kRmN').value.trim(), price = Number(el.querySelector('#kRmP').value);
      if (!name || !(price>0)){ toast(T('sup.roomfill','Vul een kamernaam en prijs in.')); return; }
      try { await API.call('/supplier/room/add', { name, price }); kantoorMsg = '\u2705 '+T('sup.roomadded','Kamer toegevoegd en direct zichtbaar.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // minibar-assortiment
    el.querySelectorAll('[data-kmbd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/minibar/item/remove', { id: b.dataset.kmbd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kMb = el.querySelector('#kMbAdd'); if (kMb) kMb.addEventListener('click', async () => {
      const name = el.querySelector('#kMbN').value.trim(), price = Number(el.querySelector('#kMbP').value);
      if (!name || !(price>0)){ toast(T('mb.fill','Vul een artikel en prijs in.')); return; }
      try { await API.call('/supplier/minibar/item/add', { name, price }); await refresh(); } catch(e){ toast(e.message); }
    });
    // deuren
    el.querySelectorAll('[data-kdoor]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/door/toggle', { id: b.dataset.kdoor }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // aanbodbeheer van de zelfstandige
    const svA = el.querySelector('#svAdd'); if (svA) svA.addEventListener('click', async () => {
      try {
        await API.call('/supplier/service', { action: 'add',
          name: el.querySelector('#svNaam').value, desc: el.querySelector('#svDesc').value,
          price: Number(el.querySelector('#svPrijs').value), duurMin: Number(el.querySelector('#svDuur').value),
          soort: el.querySelector('#svSoort').value });
        kantoorMsg = '✅ '+T('kt.svklaar','In de app gezet; leden kunnen direct boeken.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    el.querySelectorAll('[data-svdel]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/service', { action: 'remove', id: b.dataset.svdel }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // verlofaanvragen beslissen
    el.querySelectorAll('[data-kvja]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvja, action: 'goedkeuren' }); kantoorMsg = '✅ '+T('kt.vgedaan','Verlof goedgekeurd; het staflid ziet dit direct op de PDA.'); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-kvnee]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/leave/decide', { id: b.dataset.kvnee, action: 'afwijzen' }); await refresh(); } catch(e){ toast(e.message); }
    }));
    // ritgeschiedenis: bladeren, zoeken en de volledige export van de server
    const ktCsv = el.querySelector('#ktCsv'); if (ktCsv) ktCsv.addEventListener('click', () => {
      window.open('/api/supplier/rides.csv?token=' + encodeURIComponent(API.token), '_blank');
    });
    el.querySelectorAll('[data-khist]').forEach(b => b.addEventListener('click', () => {
      histPage = Math.max(1, histPage + Number(b.dataset.khist));
      histData = null;
      renderStation();
    }));
    const ktHzoek = () => {
      histQ = (el.querySelector('#ktHz') ? el.querySelector('#ktHz').value : '').trim();
      histPage = 1;
      histData = null;
      renderStation();
    };
    const hzGo = el.querySelector('#ktHzGo'); if (hzGo) hzGo.addEventListener('click', ktHzoek);
    const hzIn = el.querySelector('#ktHz'); if (hzIn) hzIn.addEventListener('keydown', e => { if (e.key === 'Enter') ktHzoek(); });
    // dispatch: toewijzen met de hand of met het slimme voorstel
    el.querySelectorAll('[data-ktwijs]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktwijs;
      try {
        await API.call('/supplier/ride/assign', { ref, staffId: Number(el.querySelector('[data-ktch="'+ref+'"]').value), vehicleId: el.querySelector('[data-ktvg="'+ref+'"]') ? el.querySelector('[data-ktvg="'+ref+'"]').value : null });
        kantoorMsg = '✅ '+T('kt.gewezen','Rit toegewezen; de gast en de chauffeur zijn op de hoogte.');
        await refresh();
      } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktslim]').forEach(b => b.addEventListener('click', async () => {
      const ref = b.dataset.ktslim;
      b.disabled = true;
      try {
        const s2 = await API.call('/supplier/ride/suggest', { ref });
        if (!s2.staffId){ toast(T('kt.niemandvrij','Iedereen is bezet.')); b.disabled = false; return; }
        await API.call('/supplier/ride/assign', { ref, staffId: s2.staffId, vehicleId: s2.vehicleId });
        kantoorMsg = '✨ '+T('kt.slimgewezen','Slim toegewezen:')+' <b>'+s2.staffName+'</b>'+(s2.vehicleName?' · '+s2.vehicleName:'');
        await refresh();
      } catch(e){ toast(e.message); b.disabled = false; }
    }));
    // vloot
    el.querySelectorAll('[data-ktvt]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'toggle', id: b.dataset.ktvt }); await refresh(); } catch(e){ toast(e.message); }
    }));
    el.querySelectorAll('[data-ktvd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/fleet', { action: 'remove', id: b.dataset.ktvd }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const ktV = el.querySelector('#ktVAdd'); if (ktV) ktV.addEventListener('click', async () => {
      const name = el.querySelector('#ktVn').value.trim();
      if (!name){ toast(T('kt.vnaamleeg','Geef het voertuig een naam.')); return; }
      try { await API.call('/supplier/fleet', { action: 'add', name, plate: el.querySelector('#ktVp').value.trim(), seats: Number(el.querySelector('#ktVs').value)||4 }); await refresh(); } catch(e){ toast(e.message); }
    });
    // tarief
    const ktT2 = el.querySelector('#ktTSave'); if (ktT2) ktT2.addEventListener('click', async () => {
      try {
        await API.call('/supplier/settings', { tarief: { start: Number(el.querySelector('#ktTa').value), perKm: Number(el.querySelector('#ktTb').value), minimum: Number(el.querySelector('#ktTc').value) } });
        kantoorMsg = '✅ '+T('kt.tklaar','Tarief opgeslagen; nieuwe aanvragen krijgen direct de nieuwe prijs.');
        await refresh();
      } catch(e){ toast(e.message); }
    });
    // prijzen aan RTG
    const kPr = el.querySelector('#kPrSend'); if (kPr) kPr.addEventListener('click', async () => {
      const service = el.querySelector('#kPrS').value.trim(), price = Number(el.querySelector('#kPrP').value);
      if (!service || !(price>0)){ toast(T('sup.fillprice','Vul een dienst en prijs in.')); return; }
      try { await API.call('/supplier/price', { service, price }); kantoorMsg = '\u2705 '+T('sup.pricesent','Prijs verstuurd naar RTG.'); await refresh(); } catch(e){ toast(e.message); }
    });
    // marketing: foto's en een Salon-bericht
    el.querySelectorAll('[data-kphd]').forEach(b => b.addEventListener('click', async () => {
      try { await API.call('/supplier/photo/remove', { index: Number(b.dataset.kphd) }); await refresh(); } catch(e){ toast(e.message); }
    }));
    const kPh = el.querySelector('#kPhFile'); if (kPh) kPh.addEventListener('change', () => {
      const file = kPh.files && kPh.files[0]; if (!file) return;
      if (file.size > 1024*1024){ toast(T('sup.phtoobig','Foto te groot (max 1 MB).')); return; }
      fileToDataURL(file, async url => {
        try { await API.call('/supplier/photo/add', { image: url }); kantoorMsg = '\u2705 '+T('sup.phadded','Foto geplaatst.'); await refresh(); } catch(e){ toast(e.message); }
      });
    });
    let kPicked = null;
    el.querySelectorAll('[data-kpick]').forEach(img => img.addEventListener('click', () => {
      kPicked = kPicked === Number(img.dataset.kpick) ? null : Number(img.dataset.kpick);
      el.querySelectorAll('[data-kpick]').forEach(x => x.classList.toggle('sel', Number(x.dataset.kpick) === kPicked));
    }));
    const kSp = el.querySelector('#kSpPost'); if (kSp) kSp.addEventListener('click', async () => {
      const text = el.querySelector('#kSpText').value.trim();
      if (!text){ toast(T('sup.salonempty','Schrijf eerst een tekst.')); return; }
      try { await API.call('/supplier/salon/post', { text, photoIndex: kPicked });
        kantoorMsg = '\u2705 '+T('sup.salondone','Gepubliceerd op De Salon.');
        await refresh(); } catch(e){ toast(e.message); }
    });
  }

  async function refresh(){ try { applyState((await API.call('/supplier/state')).state); renderAll(); } catch(e){} }


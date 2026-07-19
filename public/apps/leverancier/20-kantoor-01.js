  /* ---- het Kantoor: de eigenaar/manager past hier alles aan ---- */
  let kantoorSec = 'bo', kantoorMsg = '';
  let kantoorEdit = null;   // gerecht dat open staat in de kaart-bewerker
  // de AI-bedrijfsagent: vaste leverancier, inkoopvoorstellen en het AI-weekrooster
  let agentData = null, agentMarkt = null, agentBusy = false;
  // de urenregistratie: iedereen klokt via de PDA, het kantoor ziet het beeld
  let klokOverzicht = null, klokBusy = false;
  async function laadKlok(){
    if (klokBusy) return;
    klokBusy = true;
    try { klokOverzicht = (await API.call('/staff/klok/overzicht', {})).rows; } catch(e){ klokOverzicht = []; }
    klokBusy = false;
    renderStation();
  }
  async function laadAgent(){
    if (agentBusy) return;
    agentBusy = true;
    try { agentData = (await API.call('/supplier/agent', {})).agent; } catch(e){ agentData = { voorstellen: [], error: e.message }; }
    try { if (!agentMarkt) agentMarkt = (await API.call('/supplier/inkoop/markt', {})).groothandels || []; } catch(e){ agentMarkt = agentMarkt || []; }
    agentBusy = false;
    renderStation();
  }
  // eigen backoffice van de zaak: dagcijfers, weektrend, toppers en actiecentrum
  let boData = null, boBusy = false, vwData = null, synData = null;
  async function laadBackoffice(){
    if (boBusy) return;
    boBusy = true;
    try { boData = await API.call('/supplier/backoffice', {}); }
    catch(e){ boData = { error: e.message }; }
    // de voorspeller kijkt mee: wat komt er morgen waarschijnlijk?
    try { vwData = await API.call('/supplier/voorspel', {}); } catch(e){ vwData = null; }
    // synergie: deals en pakketten samen met andere zaken
    try { synData = await API.call('/supplier/synergie', {}); } catch(e){ synData = null; }
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
  // het vakwerk-dashboard (zzp, chef, wellness): vandaag-bord, aanvragen, KPI's en AI
  let vakData = null, vakBusy = false, vakAiMsg = '', vakAiBusy = false;
  async function laadVakwerk(){
    if (vakBusy) return;
    vakBusy = true;
    try { vakData = await API.call('/supplier/vak/bord', {}); }
    catch(e){ vakData = { error: e.message }; }
    vakBusy = false;
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
    if (type === 'apartment' || type === 'villa') secs.push(
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
    // de dienstverlenende genres (zelfstandige, privechef, wellness) krijgen
    // hun eigen vandaag-bord en aanbodbeheer
    if (['zzp','chef','wellness'].includes(type)) secs.push(
      ['vandaag','\u2600\uFE0F',T('kt.vandaag','Vandaag')],
      ['diensten','\uD83D\uDDC2\uFE0F',T('kt.diensten','Aanbod')]
    );
    secs.push(['marketing','\uD83D\uDCE3','Marketing']);
    if (!secs.some(s2 => s2[0] === kantoorSec)) kantoorSec = 'bo';
    let html = '<div class="st-chips">'+secs.map(s2 =>
      '<button data-ksec="'+s2[0]+'"'+(kantoorSec===s2[0]?' class="on"':'')+'>'+s2[1]+' '+s2[2]+'</button>').join('')+'</div>';
    if (kantoorMsg){ html += '<div class="tkc" style="grid-column:1/-1;border-color:var(--gold);">'+kantoorMsg+'</div>'; }


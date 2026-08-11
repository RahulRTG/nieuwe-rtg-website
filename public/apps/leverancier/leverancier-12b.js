  // het vakwerk-dashboard (dienstverlenende genres): vandaag-bord, aanvragen, KPI's en AI
  let vakData = null, vakBusy = false, vakAiMsg = '', vakAiBusy = false, vakUren = null, vakPro = null;
  async function laadVakwerk(){
    if (vakBusy) return;
    vakBusy = true;
    try { vakData = await API.call('/supplier/vak/bord', {}); }
    catch(e){ vakData = { error: e.message }; }
    try { vakUren = (await API.call('/supplier/vak/uren', {})).uren; } catch(e){ vakUren = null; }
    // de pro-laag: offertes, klantenboek, werkbonnen en onderhoud
    try { vakPro = await API.call('/supplier/vak/pro', {}); } catch(e){ vakPro = null; }
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
      ['hr','\uD83D\uDC65',T('kt.hr','HR & team')],
      // hosts horen bij de leveranciers: elke zaak host op RTG Thuis
      ['thuis','\u2302',T('kt.thuis','RTG Thuis')],
      // de werkvloer: het andere scherm, de tafellijst en de checklijsten
      ['werkvloer','\u21C4',T('kt.werkvloer','Werkvloer')]
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

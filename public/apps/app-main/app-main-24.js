    // veiligheid en verbinding: vier apps op een gedeelde kern
    ik:          { naam: 'Wie ben ik',   url: '/apps/ik.html' },
    thuiswacht:  { naam: 'Thuiswacht',   url: '/apps/thuiswacht.html' },
    codewoord:   { naam: 'Codewoord',    url: '/apps/codewoord.html' },
    vitaal:      { naam: 'Vitaal',       url: '/apps/vitaal.html' },
    thuisrust:   { naam: 'Thuisrust',    url: '/apps/thuisrust.html' },
    ov:          { naam: 'OV',           url: '/apps/ov.html' },
    stad:        { naam: 'Mijn Stad',    url: '/apps/stad.html' },
    clips:       { naam: 'Clips',        url: '/apps/clips.html' },
    office:      { naam: 'RTG Office',   url: '/apps/office.html' },
    sitemaker:   { naam: 'Website-maker', url: '/apps/sitemaker.html' },
    browser:     { naam: 'RTG Browser',  url: '/apps/browser.html' },
    vonk:        { naam: 'Vonk',         url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       url: '/apps/balans.html' },
    rechterhand: { naam: 'De Rechterhand', url: '/apps/lifestyle.html' },
    reisboek:    { naam: 'Reisboek',      url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       url: '/apps/cellier.html' },
    table:       { naam: 'Table',         url: '/apps/table.html' },
    maison:      { naam: 'Maison',        url: '/apps/maison.html' },
    garderobe:   { naam: 'Garde-robe',    url: '/apps/garderobe.html' },
    mecenaat:    { naam: 'Mecenaat',      url: '/apps/mecenaat.html' },
    labfonds:    { naam: 'Lab-fonds',     url: '/apps/labfonds.html' },
    rtgcode:     { naam: 'RTG-code',      url: '/apps/rtgcode.html' },
    nalatenschap:{ naam: 'Nalatenschap',  url: '/apps/nalatenschap.html' },
    logboek:     { naam: 'Logboek',       url: '/apps/logboek.html' },
    cercle:      { naam: 'Cercle',        url: '/apps/cercle.html' },
    pulse:       { naam: 'Pulse',         url: '/apps/pulse.html' },
    nieuws:      { naam: 'Nieuws',        url: '/apps/nieuws.html' },
    krant:       { naam: 'RTG Krant',     url: '/apps/krant.html' },
    vluchten:    { naam: 'Vluchten',      url: '/apps/vluchten.html' },
    sport:       { naam: 'Sport',         url: '/apps/sport.html' },
    berichten:   { naam: 'Berichten',     url: '/apps/berichten.html' },
    hangar:      { naam: 'Hangar',        url: '/apps/hangar.html' },
    entourage:   { naam: 'Entourage',     url: '/apps/entourage.html' },
    attenties:   { naam: 'Attenties',     url: '/apps/attenties.html' },
    rendezvous:  { naam: 'Rendez-vous',   url: '/apps/rendezvous.html' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  const OSAPPS = {
    bellen:      { naam: 'Bellen' },
    videobellen: { naam: 'Videobellen' },
    snaps:       { naam: 'Snaps' },
    rtf:         { naam: 'RTFoundation' },
    store:       { naam: 'App Store' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', sub: 'ouders en verzorgers' }
  ];
  /* ---------- de ROS als telefoon: alleen de basis + de App Store ----------
     Standaard staan alleen de "telefoon-apps", de RTFoundation en de App Store
     op het beginscherm; de drie RTG-kern-tabs (Betalen, Rahul, De Salon) zitten
     in het dock. Al het andere leeft in de App Store en verschijnt op pagina 2
     zodra je het installeert (keuze per pas in localStorage). */
  const STANDAARD = ['os:bellen', 'os:videobellen', 'os:snaps', 'link:berichten',
    'link:camera', 'link:navigatie', 'link:muziek', 'os:rtf', 'os:store'];
  // pagina 1 = de vaste basis; pagina 2 = geïnstalleerde apps (begint leeg,
  // wordt door bouw() gevuld uit de installatiekeuze).
  const INDELING = [STANDAARD.slice(), []];

  /* De App Store-catalogus: alle diensten die je erbij kunt zetten, netjes
     gegroepeerd. De Store filtert zelf op wat echt bestaat (itemZichtbaar) en,
     voor de premium-suite, op de pas. */
  const WINKEL_GROEPEN = [
    { titel: 'Reizen & onderweg', items: ['tab:reizen', 'link:ov', 'link:vluchten', 'link:flits', 'link:stad', 'tab:terplaatse'] },
    { titel: 'Bestellen & geld', items: ['tab:bestellen', 'link:wbw', 'link:bank', 'link:rtgcode', 'link:office'] },
    { titel: 'Sociaal & media', items: ['link:pulse', 'link:vrienden', 'link:spelen', 'link:clips', 'link:podium', 'link:theater', 'link:vonk', 'link:nieuws', 'link:krant', 'link:sport'] },
    { titel: 'Het huis & diensten', items: ['link:ontdek', 'tab:zorg', 'tab:assets', 'tab:gezin', 'link:balans', 'link:labfonds', 'link:juridisch', 'link:passkeys', 'os:werk'] },
    { titel: 'Onderneem: eigen website & het RTG-web', items: ['link:sitemaker', 'link:browser'] },
    { titel: 'De Rechterhand · Lifestyle & Business', pas: ['lifestyle', 'business'],
      items: ['link:rechterhand', 'link:reisboek', 'link:cellier', 'link:table', 'link:maison', 'link:garderobe', 'link:mecenaat', 'link:nalatenschap', 'link:logboek', 'link:cercle', 'link:hangar', 'link:entourage', 'link:attenties', 'link:rendezvous'] }
  ];

  /* ---------- Werk op het OS + de algemene pin ----------
     De werk-apps zijn gewone apps op het RTG-OS: een tik op "Werk" toont de
     werkplekken die aan het ene RTG-account gekoppeld zijn (bevoegdheid), en
     openen gaat met de algemene pin (het bewijs), dezelfde pin die de
     privacygevoelige apps op dit OS beschermt. Onder water munt
     /api/account/start de werksessie, dus alle regels (zoals het werkvenster
     van de werkgever) blijven gewoon gelden. Deelt de OS-IIFE-scope:
     OSAPPS/INDELING/LINKS komen uit 25-os-01.js, de kiezer-scrim uit 01b. */
  OSAPPS.werk = { naam: 'Werk' };
  // Werk zit in de App Store (categorie "Het huis & diensten"); installeer je
  // het, dan verschijnt het op pagina 2 en opent het met de algemene pin.
  // deze apps zijn prive: openen kan pas na de algemene pin (5 min geldig)
  for (const pk of ['berichten', 'vonk', 'rendezvous', 'wbw']) { if (LINKS[pk]) LINKS[pk].prive = true; }

  let pinOkTot = 0; // de pin blijft vijf minuten geldig, zoals op een telefoon
  // de werkplek-zone kan om een positie vragen: dan een keer ophalen en
  // opnieuw proberen; de server vergelijkt en bewaart er niets van
  const vraagPositie = () => new Promise(af => {
    if (!navigator.geolocation) return af(null);
    navigator.geolocation.getCurrentPosition(
      p => af({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => af(null), { enableHighAccuracy: true, timeout: 8000 });
  });
  const WERKDOEL = {
    personeel: { glyf: 'navigatie', app: 'Personeel (PDA)', url: '/apps/personeel.html', bewaar: (t, r) => { localStorage.setItem('rtg_pda_token', t); localStorage.setItem('rtg_pda_code', r.code || ''); } },
    zaak:      { glyf: 'maison', app: 'Leverancier',    url: '/apps/leverancier.html', bewaar: (t) => { localStorage.setItem('rtg_sup_token', t); } },
    kantoor:   { glyf: 'office', app: 'Backoffice',     url: '/apps/backoffice.html', bewaar: (t) => { localStorage.setItem('rtg_office_token', t); } }
  };

  /* vraag de algemene pin (of zet hem eerst) en geef hem door aan af(pin) */
  function metAlgPin(af) {
    if (Date.now() < pinOkTot) return af(null);

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
    school:      { naam: 'RTG School',    url: '/apps/rtgschool.html' },
    berichten:   { naam: 'Berichten',     url: '/apps/berichten.html' },
    hangar:      { naam: 'Hangar',        url: '/apps/hangar.html' },
    entourage:   { naam: 'Entourage',     url: '/apps/entourage.html' },
    attenties:   { naam: 'Attenties',     url: '/apps/attenties.html' },
    rendezvous:  { naam: 'Rendez-vous',   url: '/apps/rendezvous.html' },
    // De wallet draagt je ledenpas; hij staat in de functierij onder de klok.
    wallet:      { naam: 'Wallet',        url: '/apps/wallet.html' }
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
    rtf:         { naam: 'RTFoundation' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', sub: 'ouders en verzorgers' }
  ];
  /* ---------- de functierij, onder de klok ----------
     Bellen, berichten, videobellen en je wallet: de vier dingen die je zonder
     nadenken moet kunnen pakken. Ze staan vast en kunnen niet uit. */
  const FUNCTIES = ['os:bellen', 'link:berichten', 'os:videobellen', 'link:wallet'];

  /* ---------- de mappen, boven de klok ----------
     Vier mappen, en daar zit alles in waar je pas je recht op geeft. Niets
     installeren: het staat er al. Wil je iets niet zien, dan zet je het uit
     in de Boardroom (die zet het uit, hij hoeft het niet aan te zetten).

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). */
  const MAPPEN = [
    { sleutel: 'map-reizen', naam: 'Reizen', items: [
      'tab:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie', 'link:maison'] },
    { sleutel: 'map-geld', naam: 'Geld', items: [
      'tab:betalen', 'tab:bestellen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'tab:assets', 'link:labfonds', 'link:mecenaat', 'link:nalatenschap', 'link:logboek'] },
    { sleutel: 'map-salon', naam: 'De Salon', items: [
      'tab:salon', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera', 'link:clips',
      'link:muziek', 'link:podium', 'link:theater', 'link:spelen', 'link:vonk', 'link:nieuws',
      'link:krant', 'link:sport', 'link:cercle', 'link:entourage', 'link:rendezvous',
      'link:attenties', 'link:table', 'link:cellier', 'link:garderobe'] },
    { sleutel: 'map-huis', naam: 'Het Huis', items: [
      'link:ontdek', 'os:rtf', 'link:school', 'tab:zorg', 'tab:gezin', 'link:rechterhand',
      'link:office', 'link:browser', 'link:sitemaker', 'link:juridisch', 'link:passkeys',
      'link:ik', 'link:thuiswacht', 'link:codewoord', 'link:vitaal', 'link:thuisrust', 'os:werk'] }
  ];

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';

  /* ---------- Werk op het OS + de algemene pin ----------
     De werk-apps zijn gewone apps op het RTG-OS: een tik op "Werk" toont de
     werkplekken die aan het ene RTG-account gekoppeld zijn (bevoegdheid), en
     openen gaat met de algemene pin (het bewijs), dezelfde pin die de
     privacygevoelige apps op dit OS beschermt. Onder water munt
     /api/account/start de werksessie, dus alle regels (zoals het werkvenster
     van de werkgever) blijven gewoon gelden. Deelt de OS-IIFE-scope:
     OSAPPS/MAPPEN/LINKS komen uit 25-os-01.js, de kiezer-scrim uit 01b. */
  OSAPPS.werk = { naam: 'Werk' };
  // Werk staat in de map "Het Huis" en opent met de algemene pin.
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

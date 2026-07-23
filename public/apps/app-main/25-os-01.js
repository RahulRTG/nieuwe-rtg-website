/* ============================== RTG OS-schil ==============================
   De leden-app als telefoon-besturingssysteem: meerdere hoofdschermen
   (scroll-snap + stippen), apps in mappen, een zoekpil (Spotlight), een
   bedieningspaneel (thema, taal, push, helderheid, uitloggen) en iconen
   herschikken met een lange druk (wiebel-modus, volgorde in localStorage).

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  const grids = [$('#osGrid'), $('#osGrid2')];
  const dock = $('#osDock'), pages = $('#osPages'), dots = $('#osDots');
  if (!tabbar || !app || !grids[0] || !grids[1] || !dock || !pages) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';
  // De Butler in het midden van het dock, als grotere gouden orb: hij is het
  // hart van het OS en doet alles wat je hem vraagt. Het dock houdt de drie
  // RTG-kern-tabs vast; de overige diensten komen uit de App Store.
  const DOCK = ['betalen', 'ai', 'salon'];

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  const LINKS = {
    ontdek:      { naam: 'Het Huis',     icoon: '📖', url: '/apps/rtg.html' },
    spelen:      { naam: 'Spelen',       icoon: '🎲', url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     icoon: '💬', url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    icoon: '📜', url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       icoon: '📸', url: '/apps/camera.html' },
    muziek:      { naam: 'RTG Sound',    icoon: '🎧', url: '/apps/muziek.html' },
    podium:      { naam: 'Podium',       icoon: '🎬', url: '/apps/podium.html' },
    flits:       { naam: 'Flits',        icoon: '🛣️', url: '/apps/flits.html' },
    navigatie:   { naam: 'Navigatie',    icoon: '🧭', url: '/apps/navigatie.html' },
    theater:     { naam: 'Theater',      icoon: '🎞️', url: '/apps/theater.html' },
    wbw:         { naam: 'Wie betaalt wat', icoon: '💶', url: '/apps/wbw.html' },
    passkeys:    { naam: 'Passkeys',     icoon: '🔑', url: '/apps/passkeys.html' },
    ov:          { naam: 'OV',           icoon: '🚌', url: '/apps/ov.html' },
    stad:        { naam: 'Mijn Stad',    icoon: '🏙️', url: '/apps/stad.html' },
    clips:       { naam: 'Clips',        icoon: '🎥', url: '/apps/clips.html' },
    office:      { naam: 'RTG Office',   icoon: '📊', url: '/apps/office.html' },
    vonk:        { naam: 'Vonk',         icoon: '💘', url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       icoon: '🌿', url: '/apps/balans.html' },
    rechterhand: { naam: 'De Rechterhand', icoon: '🎩', url: '/apps/lifestyle.html' },
    reisboek:    { naam: 'Reisboek',      icoon: '🧳', url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       icoon: '🍷', url: '/apps/cellier.html' },
    table:       { naam: 'Table',         icoon: '🍽️', url: '/apps/table.html' },
    maison:      { naam: 'Maison',        icoon: '🏛️', url: '/apps/maison.html' },
    garderobe:   { naam: 'Garde-robe',    icoon: '🧥', url: '/apps/garderobe.html' },
    mecenaat:    { naam: 'Mecenaat',      icoon: '🤲', url: '/apps/mecenaat.html' },
    nalatenschap:{ naam: 'Nalatenschap',  icoon: '🗝️', url: '/apps/nalatenschap.html' },
    logboek:     { naam: 'Logboek',       icoon: '⚓', url: '/apps/logboek.html' },
    cercle:      { naam: 'Cercle',        icoon: '🎟️', url: '/apps/cercle.html' },
    pulse:       { naam: 'Pulse',         icoon: '⚡', url: '/apps/pulse.html' },
    nieuws:      { naam: 'Nieuws',        icoon: '📰', url: '/apps/nieuws.html' },
    vluchten:    { naam: 'Vluchten',      icoon: '✈️', url: '/apps/vluchten.html' },
    sport:       { naam: 'Sport',         icoon: '⚽', url: '/apps/sport.html' },
    berichten:   { naam: 'Berichten',     icoon: '✉️', url: '/apps/berichten.html' },
    hangar:      { naam: 'Hangar',        icoon: '🛩️', url: '/apps/hangar.html' },
    entourage:   { naam: 'Entourage',     icoon: '👥', url: '/apps/entourage.html' },
    attenties:   { naam: 'Attenties',     icoon: '🎁', url: '/apps/attenties.html' },
    rendezvous:  { naam: 'Rendez-vous',   icoon: '💞', url: '/apps/rendezvous.html' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  const OSAPPS = {
    bellen:      { naam: 'Bellen',       icoon: '📞' },
    videobellen: { naam: 'Videobellen',  icoon: '🎥' },
    snaps:       { naam: 'Snaps',        icoon: '📷' },
    rtf:         { naam: 'RTFoundation', icoon: '🕊️' },
    store:       { naam: 'App Store',    icoon: '🛍️' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      icoon: '🧸', sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      icoon: '🎒', sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    icoon: '🛹', sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      icoon: '🚀', sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', icoon: '🧑', sub: 'ouders en verzorgers' }
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
    { titel: 'Bestellen & geld', items: ['tab:bestellen', 'link:wbw', 'link:bank', 'link:office'] },
    { titel: 'Sociaal & media', items: ['link:pulse', 'link:vrienden', 'link:spelen', 'link:clips', 'link:podium', 'link:theater', 'link:vonk', 'link:nieuws', 'link:sport'] },
    { titel: 'Het huis & diensten', items: ['link:ontdek', 'tab:zorg', 'tab:assets', 'tab:gezin', 'link:balans', 'link:juridisch', 'link:passkeys', 'os:werk'] },
    { titel: 'De Rechterhand · Lifestyle & Business', pas: ['lifestyle', 'business'],
      items: ['link:rechterhand', 'link:reisboek', 'link:cellier', 'link:table', 'link:maison', 'link:garderobe', 'link:mecenaat', 'link:nalatenschap', 'link:logboek', 'link:cercle', 'link:hangar', 'link:entourage', 'link:attenties', 'link:rendezvous'] }
  ];


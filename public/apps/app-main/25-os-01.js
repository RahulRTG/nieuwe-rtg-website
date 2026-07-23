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
  // hart van het OS en doet alles wat je hem vraagt.
  const DOCK = ['betalen', 'bestellen', 'ai', 'salon', 'terplaatse'];

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  const LINKS = {
    ontdek:      { naam: 'Ontdek RTG',   icoon: '📖', url: '/apps/rtg.html' },
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
    rtf:         { naam: 'RTFoundation', icoon: '🕊️' }
  };
  const RTF_GROEPEN = [
    { g: 'mini',   naam: 'RTF Mini',      icoon: '🧸', sub: '0 t/m 4 jaar' },
    { g: 'kind',   naam: 'RTF Kids',      icoon: '🎒', sub: '5 t/m 11 jaar' },
    { g: 'tiener', naam: 'RTF Tiener',    icoon: '🛹', sub: '12 t/m 15 jaar' },
    { g: 'jong',   naam: 'RTF Jong',      icoon: '🚀', sub: '16 t/m 21+' },
    { g: 'volw',   naam: 'RTF Volwassen', icoon: '🧑', sub: 'ouders en verzorgers' }
  ];
  const INDELING = [
    ['tab:reizen', 'tab:betalen', 'tab:bestellen', 'tab:ai', 'tab:salon', 'tab:terplaatse',
      { sleutel: 'map-diensten', naam: 'Diensten', items: ['tab:zorg', 'tab:assets', 'tab:gezin'] }],
    ['link:ontdek',
      { sleutel: 'map-sociaal', naam: 'Sociaal', items: ['link:berichten', 'link:pulse', 'link:vrienden', 'os:bellen', 'os:videobellen', 'os:snaps', 'link:spelen'] },
      'link:nieuws',
      'link:bank',
      'link:navigatie',
      'link:ov',
      'link:vluchten',
      'link:sport',
      'link:stad',
      'os:rtf',
      'link:camera',
      'link:muziek',
      'link:podium',
      'link:clips',
      'link:vonk',
      'link:balans',
      'link:flits',
      'link:theater',
      'link:wbw',
      'link:office',
      'link:passkeys',
      'link:juridisch']
  ];
  // De Rechterhand is de premium suite van de Lifestyle Pass (Business erft mee);
  // hij verschijnt alleen op het springboard van die passen, vooraan op pagina twee.
  if (['lifestyle', 'business'].includes(pas)) INDELING[1].splice(1, 0, 'link:rechterhand', 'link:reisboek', 'link:cellier', 'link:table', 'link:maison', 'link:garderobe', 'link:mecenaat', 'link:nalatenschap', 'link:logboek', 'link:cercle', 'link:hangar', 'link:entourage', 'link:attenties', 'link:rendezvous');


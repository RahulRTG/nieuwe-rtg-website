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
    /* Hier stond een losse "Werk OS"-tegel naast "Mijn werkplekken": twee
       tegels met hetzelfde koffertje, en erger, twee INLOGS. De ene ging via
       het ene RTG-account, de andere vroeg opnieuw om een werkruimtecode en
       een lid-token. Dat is precies wat "een account voor alles" niet mag
       betekenen. De werkruimte is nu een sleutel aan diezelfde bos, dus er is
       nog een deur: Mijn werkplekken. Wie er voor het eerst in moet, vindt de
       werkruimte-inlog onderaan diezelfde kiezer. */
    sitemaker:   { naam: 'Website-maker', url: '/apps/sitemaker.html' },
    browser:     { naam: 'RTG Browser',  url: '/apps/browser.html' },
    vonk:        { naam: 'Vonk',         url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       url: '/apps/balans.html' },
    /* Mijn loon staat bij Geld en niet bij Werk: het is uw geld, niet iets van
       uw werkgever. Wie nergens werkt vindt een lege lijst met de zin die dat
       uitlegt -- dat is beter dan een tegel die verdwijnt zodra u van baan
       wisselt. Prive: dit scherm draagt uw loon en uw inzagespoor. */
    loonstrook:  { naam: 'Mijn loon',    url: '/apps/loonstrook.html' },
    rechterhand: { naam: 'Het Privekantoor', url: '/apps/lifestyle.html' },
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
      'link:flits', 'link:stad', 'link:residentie'] },
    { sleutel: 'map-geld', naam: 'Geld', items: [
      'tab:betalen', 'tab:bestellen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'link:loonstrook', 'tab:assets', 'link:labfonds'] },
    { sleutel: 'map-salon', naam: 'De Salon', items: [
      'tab:salon', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera', 'link:clips',
      'link:muziek', 'link:podium', 'link:theater', 'link:spelen', 'link:vonk', 'link:nieuws',
      'link:krant', 'link:sport'] },
    { sleutel: 'map-huis', naam: 'Het Huis', items: [
      'link:ontdek', 'os:rtf', 'link:school', 'tab:zorg', 'tab:gezin', 'link:rechterhand',
      'link:office', 'link:browser', 'link:sitemaker', 'link:juridisch', 'link:passkeys',
      'link:ik', 'link:thuiswacht', 'link:codewoord', 'link:vitaal', 'link:thuisrust', 'os:werk'] }
  ];

  /* De premium-suite bestaat alleen voor Lifestyle en Business. De registry kent
     de apps voor iedereen; hier staat wie ze mag zien, zodat een RTG-pas ze niet
     in zijn mappen of in Spotlight tegenkomt.

     Sinds Het Privekantoor staat hiervan nog EEN in de mappen: 'rechterhand',
     dat /apps/lifestyle.html opent. De andere dertien zijn geen tegels meer maar
     KAMERS binnen die app -- je komt er via de plattegrond, en de app legt de
     verbanden die je zelf moest leggen toen het dertien losse tegels waren.
     Ze blijven wel in deze lijst: de pagina's bestaan nog, worden gelinkt vanuit
     het kantoor en zijn nog in Spotlight te vinden. Een oude link mag niets
     opleveren is de regel; uit de mappen halen is iets anders dan opheffen. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';


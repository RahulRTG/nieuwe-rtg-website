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
    /* EEN app voor alle communicatie (kern/comm + apps/comm.html). Hier
       stonden er vier op het beginscherm -- Berichten, Bellen, Videobellen en
       Snaps -- voor iets dat een mens als EEN ding ziet: contact met iemand.
       Bellen en videobellen zijn nu twee knoppen in de kop van het gesprek
       waar je toch al bent; de oude /apps/berichten.html blijft bestaan als
       pad, want er kan naar gelinkt zijn. */
    berichten:   { naam: 'Berichten',     url: '/apps/comm.html' },
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
  /* De functierij onder de klok. Bellen en videobellen stonden hier als eigen
     app; ze zitten nu in Berichten, bij het gesprek. De vrijgekomen plek gaat
     naar Camera -- de andere manier waarop je iets met iemand deelt -- zodat de
     rij vier dingen houdt die je zonder nadenken moet kunnen pakken. */
  const FUNCTIES = ['link:berichten', 'os:snaps', 'link:camera', 'link:wallet'];

  /* ---------- de mappen, boven de klok ----------
     Zeven mappen, een rij van vier en een rij van drie, en daar zit alles in
     waar je pas je recht op geeft. Niets installeren: het staat er al. Wil je
     iets niet zien, dan zet je het uit in de Boardroom (die zet het uit, hij
     hoeft het niet aan te zetten).

     WAAROM ZEVEN, EN NIET VIER OF ACHT.

     Het waren er VIER, en dat leek rustig tot je ze opendeed: De Salon droeg
     eenentwintig apps en Het Huis zeventien. Een map met eenentwintig tegels
     is geen map maar een lade waar je in graait, en het verschil tussen
     "muziek" en "een vriend appen" was er niet meer aan af te zien.

     Toen werden het er ACHT, en dat was één te veel -- maar dat zag je alleen
     als je op de goede pas keek. De tegels tellen namelijk niet voor iedereen
     hetzelfde: veertien apps zijn Lifestyle/Business (zie PREMIUM hieronder)
     en vallen voor een RTG-pas vanzelf weg. Het Huis had ik gevuld met Maison,
     Table, Cellier, Garde-robe en De Rechterhand -- alle vijf premium -- dus
     een Business-lid zag daar acht tegels en een RTG-lid drie. Dezelfde map,
     half zo vol, precies onderaan. Dat is exact wat de merkregel verbiedt: de
     instappas mag nooit budget aanvoelen.

     Nageteld over alle 62 items is er materiaal voor ZEVEN mappen die op
     allebei de passen gevuld staan, en niet voor acht. De zorgkant is daarom
     terug in Het Huis -- waar zorg, gezin en rust ook horen -- en de tweede
     rij telt drie mappen in plaats van vier. Een rij van drie is geen
     halfvolle rij van vier: hij staat gecentreerd onder de eerste (zie
     .os-mappen in apps/app.html), dus het leest als een vorm en niet als een
     gat.

     Tellingen per pas, gemeten en niet geschat (RTG / Business):
     Reizen 8/10, Geld 7/10, De Salon 6/10, Het Huis 6/12,
     Media 8/8, Werk 7/7, Veilig 4/4.

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). Een app staat in precies EEN map:
     twee plekken voor hetzelfde is precies waarom je hem nergens meer vindt. */
  const MAPPEN = [
    /* --- eerste rij --- */
    { sleutel: 'map-reizen', naam: 'Reizen', items: [
      'tab:reizen', 'tab:terplaatse', 'link:vluchten', 'link:ov', 'link:navigatie',
      'link:flits', 'link:stad', 'link:reisboek', 'link:hangar', 'link:residentie'] },
    { sleutel: 'map-geld', naam: 'Geld', items: [
      'tab:betalen', 'link:wallet', 'link:bank', 'link:wbw', 'link:rtgcode',
      'link:balans', 'tab:assets', 'link:labfonds', 'link:mecenaat',
      'link:nalatenschap', 'link:logboek'] },
    /* De Salon is weer De Salon: mensen en wat je met ze deelt. Wat je in je
       eentje kijkt of luistert staat bij Media. */
    { sleutel: 'map-salon', naam: 'De Salon', items: [
      'tab:salon', 'link:pulse', 'link:vrienden', 'os:snaps', 'link:camera',
      'link:vonk', 'link:cercle', 'link:entourage', 'link:rendezvous', 'link:attenties'] },
    /* Het Huis is het huishouden in de brede zin: waar je woont, wat er op
       tafel komt, wat er in de kast hangt -- en hoe het met de mensen erin
       gaat. Die laatste helft (zorg, gezin, vitaal, rust) stond even in een
       eigen map Zorg; die is hier terug, want zonder haar was Het Huis op een
       RTG-pas een map met drie tegels. De kantoorkant zit bij Werk. */
    { sleutel: 'map-huis', naam: 'Het Huis', items: [
      'link:ontdek', 'os:rtf', 'tab:bestellen', 'tab:zorg', 'tab:gezin',
      'link:vitaal', 'link:thuisrust', 'link:rechterhand',
      'link:maison', 'link:table', 'link:cellier', 'link:garderobe'] },

    /* --- tweede rij, gecentreerd --- */
    { sleutel: 'map-media', naam: 'Media', items: [
      'link:muziek', 'link:podium', 'link:theater', 'link:clips', 'link:spelen',
      'link:nieuws', 'link:krant', 'link:sport'] },
    { sleutel: 'map-werk', naam: 'Werk', items: [
      'link:office', 'os:werk', 'link:loonstrook', 'link:school',
      'link:browser', 'link:sitemaker', 'link:juridisch'] },
    /* Veilig: wie je bent en wie er over je waakt. Vier apps op dezelfde kern
       (zie de opmerking bij LINKS), plus de sleutels waarmee je binnenkomt.
       Vier is hier geen tekort maar de hele set -- dit is de enige map die op
       elke pas even groot is. */
    { sleutel: 'map-veilig', naam: 'Veilig', items: [
      'link:ik', 'link:thuiswacht', 'link:codewoord', 'link:passkeys'] }
  ];

  /* De premium-suite (De Rechterhand) bestaat alleen voor Lifestyle en
     Business. De registry kent de apps voor iedereen; hier staat wie ze mag
     zien, zodat een RTG-pas ze niet in zijn mappen of in Spotlight tegenkomt. */
  const PREMIUM = new Set(['rechterhand', 'reisboek', 'cellier', 'table', 'maison', 'garderobe',
    'mecenaat', 'nalatenschap', 'logboek', 'cercle', 'hangar', 'entourage', 'attenties', 'rendezvous']);
  const premiumPas = pas === 'lifestyle' || pas === 'business';


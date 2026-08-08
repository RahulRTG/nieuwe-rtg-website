    // veiligheid en verbinding: vier apps op een gedeelde kern
    ik:          { naam: 'Wie ben ik',   url: '/apps/ik.html' },
    thuiswacht:  { naam: 'Thuiswacht',   url: '/apps/thuiswacht.html' },
    codewoord:   { naam: 'Codewoord',    url: '/apps/codewoord.html' },
    vitaal:      { naam: 'Vitaal',       url: '/apps/vitaal.html' },
    thuisrust:   { naam: 'Thuisrust',    url: '/apps/thuisrust.html' },
    ov:          { naam: 'Openbaar vervoer',           url: '/apps/ov.html' },
    stad:        { naam: 'Stad',    url: '/apps/stad.html' },
    clips:       { naam: 'Video',        url: '/apps/clips.html' },
    /* RTG Media staat NAAST Video, Sound, Theater en Podium en niet in plaats
       daarvan: het is de laag die ze tot een wereld maakt, en wie recht naar de
       studio of de zaal wil, hoort daar gewoon heen te kunnen.

       De NAMEN komen van deze kant en de app van de andere: deze ronde
       hernoemde de tegels naar gewone woorden ("Video" in plaats van "Clips"),
       en een tak die daarvoor aftakte kent die keuze nog niet. */
    mediaos:     { naam: 'RTG Media',    url: '/apps/media.html' },
    office:      { naam: 'Documenten',   url: '/apps/office.html' },
    /* Hier stond een losse "Werk OS"-tegel naast "Mijn werkplekken": twee
       tegels met hetzelfde koffertje, en erger, twee INLOGS. De ene ging via
       het ene RTG-account, de andere vroeg opnieuw om een werkruimtecode en
       een lid-token. Dat is precies wat "een account voor alles" niet mag
       betekenen. De werkruimte is nu een sleutel aan diezelfde bos, dus er is
       nog een deur: Mijn werkplekken. Wie er voor het eerst in moet, vindt de
       werkruimte-inlog onderaan diezelfde kiezer. */
    sitemaker:   { naam: 'Website', url: '/apps/sitemaker.html' },
    browser:     { naam: 'Web',  url: '/apps/browser.html' },
    vonk:        { naam: 'Daten',         url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       url: '/apps/balans.html' },
    /* Mijn loon staat bij Geld en niet bij Werk: het is uw geld, niet iets van
       uw werkgever. Wie nergens werkt vindt een lege lijst met de zin die dat
       uitlegt -- dat is beter dan een tegel die verdwijnt zodra u van baan
       wisselt. Prive: dit scherm draagt uw loon en uw inzagespoor. */
    loonstrook:  { naam: 'Loon',    url: '/apps/loonstrook.html' },
    rechterhand: { naam: 'Privekantoor', url: '/apps/lifestyle.html' },
    reisboek:    { naam: 'Reisboek',      url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       url: '/apps/cellier.html' },
    table:       { naam: 'Table',         url: '/apps/table.html' },
    maison:      { naam: 'Maison',        url: '/apps/maison.html' },
    garderobe:   { naam: 'Garde-robe',    url: '/apps/garderobe.html' },
    mecenaat:    { naam: 'Mecenaat',      url: '/apps/mecenaat.html' },
    labfonds:    { naam: 'Fonds',     url: '/apps/labfonds.html' },
    rtgcode:     { naam: 'Betaalcode',      url: '/apps/rtgcode.html' },
    nalatenschap:{ naam: 'Nalatenschap',  url: '/apps/nalatenschap.html' },
    logboek:     { naam: 'Logboek',       url: '/apps/logboek.html' },
    cercle:      { naam: 'Cercle',        url: '/apps/cercle.html' },
    pulse:       { naam: 'Vandaag',         url: '/apps/pulse.html' },
    nieuws:      { naam: 'Nieuws',        url: '/apps/nieuws.html' },
    krant:       { naam: 'Krant',     url: '/apps/krant.html' },
    vluchten:    { naam: 'Vluchten',      url: '/apps/vluchten.html' },
    sport:       { naam: 'Sport',         url: '/apps/sport.html' },
    school:      { naam: 'School',    url: '/apps/rtgschool.html' },
    berichten:   { naam: 'Berichten',     url: '/apps/berichten.html' },
    /* EEN app voor alle communicatie (kern/comm + apps/comm.html). Hier
       stonden er vier op het beginscherm -- Berichten, Bellen, Videobellen en
       Snaps -- voor iets dat een mens als EEN ding ziet: contact met iemand.
       Bellen en videobellen zijn nu twee knoppen in de kop van het gesprek
       waar je toch al bent; de oude /apps/berichten.html blijft bestaan als
       pad, want er kan naar gelinkt zijn. */
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
     De vier dingen die je zonder nadenken moet kunnen pakken. Ze staan vast en
     kunnen niet uit.

     Bellen en videobellen stonden hier als eigen app; ze zitten nu in
     Berichten, bij het gesprek -- dat waren vier iconen voor iets dat een mens
     als EEN ding ziet (RTG Communication Core, e67be4d). De vrijgekomen plek
     gaat naar Camera, de andere manier waarop je iets met iemand deelt, zodat
     de rij er vier houdt.

     Ook deze regel is door een merge teruggezet naar de oude vier, samen met
     de rest van het beginscherm; zie de opmerking bij .os-aibalk in
     apps/app.html. test/comm.e2e.js bewaakt hem. */
  const FUNCTIES = ['link:berichten', 'os:snaps', 'link:camera', 'link:wallet'];

  /* ---------- de mappen, boven de klok ----------
     Vier mappen, en daar zit alles in waar je pas je recht op geeft. Niets
     installeren: het staat er al. Wil je iets niet zien, dan zet je het uit
     in de Boardroom (die zet het uit, hij hoeft het niet aan te zetten).

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). */

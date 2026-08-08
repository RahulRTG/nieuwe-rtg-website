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


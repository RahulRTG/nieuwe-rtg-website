    /* Veiligheid en verbinding. Hier stonden VIER tegels -- Thuiswacht,
       Codewoord, Vitaal en Thuisrust -- op een gedeelde kern. Ze zijn nu vier
       standen van een app (/apps/veilig.html), want een systeem dat een systeem
       is, hoort niet als vier losse deuren op een beginscherm te staan: wie de
       Thuiswacht kende, had het Codewoord daardoor vaak nooit gezien. De oude
       paden leiden met een hash naar hun eigen stand, dus een bladwijzer of een
       geinstalleerde PWA komt nog steeds uit waar hij hoort. */
    ik:          { naam: 'Wie ben ik',   url: '/apps/ik.html' },
    veilig:      { naam: 'RTG Veilig',   url: '/apps/veilig.html' },
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
    rtgone:      { naam: 'RTG One',      url: '/apps/rtgone.html' },
    rtmail:      { naam: 'RTMail',       url: '/apps/rtmail.html' },
    magnaat:     { naam: 'Magnaat',      url: '/apps/magnaat.html' },
    /* Hier stond een losse "Werk OS"-tegel naast "Mijn werkplekken": twee
       tegels met hetzelfde koffertje, en erger, twee INLOGS. De ene ging via
       het ene RTG-account, de andere vroeg opnieuw om een werkruimtecode en
       een lid-token. Dat is precies wat "een account voor alles" niet mag
       betekenen. De werkruimte is nu een sleutel aan diezelfde bos, dus er is
       nog een deur: Mijn werkplekken. Wie er voor het eerst in moet, vindt de
       werkruimte-inlog onderaan diezelfde kiezer. */
    /* Het Ondernemers-OS stond hier NIET, en dat was een gat waar de hele
       ondernemersweg in verdween: /apps/onderneming.html bestond, werkte en had
       zelfs een hulptekst in de appgids -- maar hij stond in geen enkele
       registry en in geen enkele map, dus niemand kon hem vinden. Een scherm dat
       nergens vandaan te bereiken is, is geen scherm.

       Eén tegel, niet twee. De concern-laag (CONCERN.md) krijgt geen eigen
       tegel maar hangt achter deze: dat is PLATFORM.md paragraaf 0 -- een
       onderdeel binnen een app, geen tweede adres in de bibliotheek. */
    onderneming: { naam: 'Onderneming', url: '/apps/onderneming.html' },
    sitemaker:   { naam: 'Website', url: '/apps/sitemaker.html' },
    browser:     { naam: 'Web',  url: '/apps/browser.html' },
    vonk:        { naam: 'Daten',         url: '/apps/vonk.html' },
    balans:      { naam: 'Balans',       url: '/apps/geld.html#balans' },
    /* Mijn loon staat bij Geld en niet bij Werk: het is uw geld, niet iets van
       uw werkgever. Wie nergens werkt vindt een lege lijst met de zin die dat
       uitlegt -- dat is beter dan een tegel die verdwijnt zodra u van baan
       wisselt. Prive: dit scherm draagt uw loon en uw inzagespoor. */
    loonstrook:  { naam: 'Loon',    url: '/apps/loonstrook.html' },
    rechterhand: { naam: 'Privekantoor', url: '/apps/lifestyle.html' },
    // "voor organisaties" (PLATFORM.md); kantoor.html staat er los naast
    werkos:      { naam: 'RTG Werk OS', url: '/apps/werk.html' },
    reisboek:    { naam: 'Reisboek',      url: '/apps/reisboek.html' },
    cellier:     { naam: 'Cellier',       url: '/apps/cellier.html' },
    table:       { naam: 'Table',         url: '/apps/table.html' },
    maison:      { naam: 'Maison',        url: '/apps/maison.html' },
    garderobe:   { naam: 'Garde-robe',    url: '/apps/garderobe.html' },
    mecenaat:    { naam: 'Mecenaat',      url: '/apps/geld.html#mecenaat' },
    labfonds:    { naam: 'Fonds',     url: '/apps/geld.html#labfonds' },
    rtgcode:     { naam: 'Betaalcode',      url: '/apps/geld.html#rtgcode' },
    nalatenschap:{ naam: 'Nalatenschap',  url: '/apps/geld.html#nalatenschap' },
    logboek:     { naam: 'Logboek',       url: '/apps/geld.html#logboek' },
    cercle:      { naam: 'Cercle',        url: '/apps/cercle.html' },
    pulse:       { naam: 'Vandaag',         url: '/apps/pulse.html' },
    nieuws:      { naam: 'Nieuws',        url: '/apps/nieuws.html' },
    krant:       { naam: 'Krant',     url: '/apps/krant.html' },
    /* RTG Reizen staat NAAST Vluchten, Verblijven, Reisbureau en Hangar en niet
       in plaats daarvan -- net als RTG Media naast Video, Sound, Theater en
       Podium. Het is de laag die er een wereld van maakt (PLATFORM.md, laag 2);
       wie recht naar het inchecken of de hangar wil, hoort daar gewoon heen te
       kunnen. */
    /* "RTG Reizen" en niet "Reizen": de map draagt al een OS-tab die Reizen
       heet (tab:reizen, het boeken zelf), en twee tegels met dezelfde naam in
       een map is voor een gebruiker een raadsel en voor test/appmenu.e2e.js een
       fout -- die toets bewaakt dat een app in precies EEN map staat en meet dat
       op het label. De bibliotheek noemt hem ook RTG Reizen. */
    reizen:      { naam: 'Reizen & Veilig', url: '/apps/reizen-veilig.html' },
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
    wallet:      { naam: 'Wallet',        url: '/apps/geld.html#wallet' },
    /* Bank ONTBRAK, en dat was stil. `link:bank` stond wel in MAPPEN, maar
       zonder deze regel geeft itemDef() undefined, wordt itemZichtbaar() false
       en tekent RTG zich gewoon een tegel kleiner -- zonder fout, zonder lege
       plek. De stand zelf bestond al die tijd (apps/geld/bankc.js, id 'bank').
       test/wereldregister.test.js vangt dit soort gaten nu. */
    bank:        { naam: 'Bank',          url: '/apps/geld.html#bank' }
  };
  /* Elke functie zijn eigen app: Bellen, Videobellen en Snaps zijn eigen
     OS-apps die een kiezer openen en dan meteen doen wat u koos, via de
     sociale laag van de leden-app (WebRTC-bellen, snaps op codenaam).
     RTFoundation is EEN app: een tik toont de leeftijdskeuze en opent dan
     de hub in de passende jas (?groep= zet de bril op). */
  /* WERK STOND ER WEL EN BESTOND ER NIET. `os:werk` staat in RTG Kantoor en
     openOsApp() heeft er een eigen tak voor (openWerkKiezer), maar de wacht
     bovenaan die functie -- `const app = OSAPPS[naam]; if (!app) return;` --
     kwam daarvoor. Zonder deze regel was de werkplekkiezer dus onbereikbaar EN
     was de tegel onzichtbaar: twee gaten die elkaar verborgen. */
  const OSAPPS = {
    werk:        { naam: 'Werk' },
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
  /* LEEG, EN DAT IS DE BEDOELING. Het beginscherm toont alleen nog de acht
     werelden: dat is de hele afspraak van PLATFORM.md par. 0, en een rij losse
     apps eronder is precies de uitzondering die de afspraak weer uitholt.

     De vier zijn niet weg, ze staan waar ze horen: Berichten en Camera in
     Sociaal, de Wallet IS de Geld-wereld (geld.html laadt wallet.js), en Snaps
     zit in Berichten sinds de vier contact-apps er een werden. De lijst blijft
     als lege lijst bestaan zodat de rij later opnieuw te vullen is zonder de
     tekenlaag aan te raken -- en zodat hier staat waarom hij leeg is. */
  const FUNCTIES = [];

  /* ---------- de mappen, boven de klok ----------
     Vier mappen, en daar zit alles in waar je pas je recht op geeft. Niets
     installeren: het staat er al. Wil je iets niet zien, dan zet je het uit
     in de Boardroom (die zet het uit, hij hoeft het niet aan te zetten).

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). */


  /* Afgesplitst van app-main-24.js, dat over de 10 KB ging toen er een tegel
     bijkwam. De snede loopt langs een echte grens: hierboven staat WAT er is
     (de registry van alle apps), hieronder WAAR het hangt (de mappen), en hier
     ertussen staat waarom die mappen zo werken. Dat het maar een blok
     commentaar is, maakt het niet minder de juiste plek -- de uitleg hoort bij
     de MAPPEN in app-main-24a2.js en niet bij de registry ervoor. */
  /* ---------- de mappen, boven de klok ----------
     Vier mappen, en daar zit alles in waar je pas je recht op geeft. Niets
     installeren: het staat er al. Wil je iets niet zien, dan zet je het uit
     in de Boardroom (die zet het uit, hij hoeft het niet aan te zetten).

     Een map heeft een vaste sleutel (waar je eigen naam onder bewaard wordt),
     een standaardnaam en zijn apps. Apps die voor jouw pas niet bestaan
     vallen er vanzelf uit (itemZichtbaar). */
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

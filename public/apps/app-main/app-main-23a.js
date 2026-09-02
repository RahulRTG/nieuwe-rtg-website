/* ============================== RTG OS-schil ==============================
   De leden-app als besturingssysteem. Het beginscherm is één scherm met vier
   lagen, van boven naar beneden:

     1. de mappen met apps
     2. de ronde RTG-klok, in het midden
     3. de functierij: bellen, berichten, videobellen, je wallet
     4. de balk van Rahul

   Verder is er een bedieningspaneel (thema, taal, push, helderheid,
   uitloggen), Spotlight-zoeken en herschikken met een lange druk
   (wiebel-modus, volgorde in localStorage). Geen tweede beginscherm, geen
   dock, geen App Store: alles waar je pas je recht op geeft staat er al, en
   in de Boardroom zet je uit wat je niet wilt zien.

   De (verborgen) tabbar blijft het model: alle bestaande logica schakelt daar
   tabs, zichtbaarheid (gast-modus, Assets, Gezin) en badges. Deze laag
   SPIEGELT dat model; kliks op tab-iconen lopen terug het model in
   (button.click()), dus er is een navigatiepad en geen drift. */
(() => {
  const $ = s => document.querySelector(s);
  const tabbar = $('#tabbar'), app = $('#app'), content = $('#content');
  // rij 0 = de mappen boven de klok, rij 1 = de functies eronder
  const rijen = [$('#osMappen'), $('#osFuncties')];
  if (!tabbar || !app || !rijen[0] || !rijen[1]) return;

  const pas = new URLSearchParams(location.search).get('pas') || 'rtg';

  /* ---------- de indeling: tab-apps, link-apps en mappen ----------
     Link-apps zijn losse leden-pagina's die als eigen app openen. */
  // Elke app kent zijn eigen huisstijl-glyf (shared/glyf.js) op naam van de
  // sleutel; de tegel tekent die als dunne lijn-icoon (geen emoji meer).
  const LINKS = {
    ontdek:      { naam: 'Ontdekken',     url: '/apps/rtg.html' },
    /* De cockpit van LivingOS (WERELDEN.md). Het bestand heet nog living-os,
       want een bestandsnaam is geen merknaam; de APP heette dat ook, en dat
       botste vier regels ver in de bank met de WERELD LivingOS. */
    vooruitzicht:{ naam: 'Het Vooruitzicht', url: '/apps/living-os.html' },
    /* De STICHTING, en niet het gezin eromheen. Onder /apps/foundation/ staan
       71 schermen; negen daarvan gaan over RTFoundation als organisatie en de
       rest over het leven van een kind (WERELDEN.md). Deze twee zijn de deuren
       naar die negen: het portaal (donateur, vrijwilliger, deelnemer) en de
       publieke kant. Foundation OS zelf (os.html) staat er niet bij: dat vraagt
       een kantoortoken en is geen deur voor een lid. */
    rtfportaal:  { naam: 'RTFoundation portaal', url: '/apps/foundation/os-portaal.html' },
    /* DE TWAALF UIT DE SOFTWARE-RIJ, en dit blok is de reden dat die rij weg is.
       De bank had onder de werelden een tweede kopje, Software, met twaalf apps
       die in geen enkele wereld hingen. Dat is precies de vraag die WERELDEN.md
       wil afschaffen: 'staat dit in een wereld of in de lijst ernaast?' Een app
       hoort in de context waarin een mens hem gebruikt, en anders nergens.
       Negen kregen hier een sleutel; Reizen & Veilig, Gastdossier en Het
       Vooruitzicht hingen al ergens. shared/command/catalog.js houdt zijn lijst
       -- die is Rahuls routeertabel en de bron van werkbladtitels -- maar tekent
       geen bank-sectie meer. test/wereldregister.test.js bewaakt dat elke app
       uit die catalogus ook echt in een wereld hangt. */
    vandaag:     { naam: 'Vandaag',        url: '/apps/vandaag.html' },
    leven:       { naam: 'Mijn leven',     url: '/apps/leven.html' },
    sociaal:     { naam: 'Sociaal',        url: '/apps/sociaal.html' },
    /* De WERELDLAAG (README: server/kern/wereld/) -- een LEESLAAG over vijf
       contexten met een schakelaar Alles / Lifestyle / Business / Communities /
       Prive. Hij bezit die domeinen niet en plaatsen loopt er nooit langs; wie
       in Lifestyle plaatst, plaatst in De Salon.

       Hij stond hier niet, en niets in het huis linkte ernaar: een scherm van
       23 KB dat gebouwd, gedocumenteerd en onbereikbaar was (gevonden met
       scripts/lib/bereik.js op 19 augustus 2026). Hij hangt in LivingOS en niet
       in een van de vijf werelden die hij toont, want de contextvraag van
       WERELDEN.md gaat over de MENS: wie zijn eigen tijdlijn leest, is bezig
       met zijn dagelijks leven. */
    wereldlaag:  { naam: 'Alles bij elkaar', url: '/apps/wereld.html' },
    geldcommand: { naam: 'Geld',           url: '/apps/geld-command.html' },
    commerce:    { naam: 'Commerce',       url: '/apps/commerce.html' },
    /* HIER STONDEN INSTANTREALITY EN PRIVATEOFFICE, en die zijn 19 augustus 2026
       samengevoegd met de sleutel ernaast (WERELDEN.md, "de twee dubbele
       paren"). Instant Reality en Het Vooruitzicht (link:vooruitzicht) beloofden
       allebei een intentie in drie werelden met twee beslissingen; Private
       Office en het Privekantoor (link:rechterhand) allebei een directietafel.
       Vier ingangen naar twee dingen. Wie de oude sleutel nog gebruikt, komt
       niets tegen: een onbekende sleutel levert geen tegel op, en beide adressen
       bestaan niet meer. */
    horeca:      { naam: 'Horeca',         url: '/apps/horeca.html' },
    partnernetwerk:{ naam: 'Partner Network', url: '/apps/partner-network.html' },
    rtfbuurt:    { naam: 'RTFoundation in jouw buurt', url: '/apps/foundation/os-publiek.html' },
    klimaat:     { naam: 'Klimaatfonds', url: '/apps/foundation/klimaatfonds.html' },
    buurtruil:   { naam: 'Buurtruil', url: '/apps/foundation/buurtruil.html' },
    geven:       { naam: 'Geven', url: '/apps/foundation/geven.html' },
    rtfwinkel:   { naam: 'Winkel van de RTFoundation', url: '/apps/foundation/winkel.html' },
    spelen:      { naam: 'Spelen',       url: '/apps/spelen.html?pas=' + encodeURIComponent(pas) },
    vrienden:    { naam: 'Vrienden',     url: '/apps/foundation/vrienden.html' },
    juridisch:   { naam: 'Juridisch',    url: '/apps/juridisch.html' },
    camera:      { naam: 'Camera',       url: '/apps/camera.html' },
    muziek:      { naam: 'Muziek',    url: '/apps/muziek.html' },
    podium:      { naam: 'Live',       url: '/apps/podium.html' },
    flits:       { naam: 'Verkeer',           url: '/apps/flits.html' },
    navigatie:   { naam: 'Navigatie',    url: '/apps/navigatie.html' },
    theater:     { naam: 'Films en series',      url: '/apps/theater.html' },
    residentie:  { naam: 'Verblijven', url: '/apps/residentie.html' },
    wbw:         { naam: 'Samen betalen', url: '/apps/geld.html#wbw' },
    passkeys:    { naam: 'Passkeys',     url: '/apps/passkeys.html' },
    sessies:     { naam: 'Waar ben ik aanwezig', url: '/apps/mijn-sessies.html' },
    relaties:    { naam: 'Wie heeft toegang tot mij', url: '/apps/mijn-relaties.html' },
    gegevens:    { naam: 'Wat weet RTG van mij', url: '/apps/mijn-gegevens.html' },
    post:        { naam: 'Post van RTG', url: '/apps/mijn-post.html' },

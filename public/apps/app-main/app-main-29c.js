  /* ---------- de werelden aanreiken aan de bank van RTG Command ----------
     WAAR DIT VANDAAN KOMT. Hier stond de aanreiking aan shared/wereld.js: het
     beginscherm als kring om de klok, met de werelden als merken op een bezel.
     Dat beginscherm is weg -- de werktafel van RTG Command is het geworden -- en
     de klok is met hem meegegaan. De werelden niet. Ze staan nu bovenaan de
     bank, en dit blok is de plek waar ze daarheen gaan.

     De regel eromheen is niet veranderd: shared/command.js weet met opzet NIETS
     over welke werelden er zijn en welke onderdelen bij jouw pas horen. Dat
     staat hier al -- in MAPPEN, itemZichtbaar en mapNaam -- en wordt van hieruit
     doorgegeven. Wie daar ooit een eigen lijst werelden ziet ontstaan, heeft de
     fout te pakken waar LAT.md regel 4 over gaat.

     WAT ER PER WERELD MEEGAAT, en wat bewust niet. Naam, huis en teken: genoeg
     om een deur te zijn. De onderdelen gaan NIET mee. Ze horen bij de wereld en
     staan op het huis zelf (/apps/rtg.html en de andere twee dragen ze alle drie
     compleet); ze een tweede keer in de bank hangen zou een rail van veertig
     regels maken en de vraag oproepen welke van de twee lijsten de echte is.

     Ontbreekt de schil (een pagina zonder shared/command.js, een oude
     service-worker-cache), dan gebeurt er niets. Een beginscherm dat leeg blijft
     omdat een aanreiking niet aankwam is erger dan een bank zonder kopje. */

  /* Wordt aan het eind van bouw() aangeroepen, dus op precies het moment dat
     ook de tegels worden bijgewerkt. De schil vergelijkt zelf niets, maar
     opnieuw vullen kost een rij knoppen -- en het houdt de bank gelijk met een
     pas die intussen veranderd is. */
  function wereldBij() {
    if (!window.RTGCommand || !RTGCommand.werelden) return;
    RTGCommand.werelden(MAPPEN.filter(function (m) {
      return m.wereld && m.items.some(itemZichtbaar);
    }).map(function (m) {
      return {
        sleutel: m.sleutel,
        naam: mapNaam(m),
        url: m.wereld,
        /* De glyf van de wereld: hetzelfde teken als op zijn huis, uit dezelfde
           bron. Een tweede tekenset zou twee werelden geven die anders heten. */
        teken: function () { return (window.RTGGlyf && RTGGlyf.svg(m.glyf)) || null; }
      };
    }));
  }

  /* ---------- het bedieningspaneel aanreiken aan de voet van de bank ----------
     HET SPRINGBOARD IS ALS SCHERM VERDWENEN, EN DIT MOEST BLIJVEN.

     Het bedieningspaneel hing achter de knop rechtsboven op dat scherm, en
     draagt alles wat geen wereld is: thema, helderheid, taal, achtergrond, en de
     tegels scannen, je Zegel, je backoffice, de Boardroom, de algemene pin,
     push, zoeken, meldingen en uitloggen. Zonder een nieuwe deur was dat met het
     scherm meegegaan -- inclusief de enige uitlogknop die een lid heeft.

     Een deur en niet zestien. Het paneel is al de plek waar deze dingen samen
     staan; ze los in de bank hangen zou dezelfde lijst een tweede keer maken, op
     een plek die er niet over gaat.

     We klikken de bestaande knop aan in plaats van het paneel zelf te openen.
     Die knop draagt het gedrag (app-main-27b.js) en blijft de enige plek waar
     dat staat -- ook nu hij zelf niet meer in beeld komt. */
  function systeemBij() {
    if (!window.RTGCommand || !RTGCommand.systeem) return;
    var lijst = [], knop = $('#osCcBtn');
    /* EN RAHUL, want die was op het beginscherm nergens meer.

       Zijn balk stond onderaan het springboard. Dat scherm is weg, en de drie
       andere plekken waar hij woont haalden het geen van alle: de console van de
       werktafel wordt verborgen door shared/rahul-tab/style-base.js, de tab die
       daarvoor in de plaats komt vindt op deze pagina geen gastheer, en de
       handenvrij-balk hangt bewust weg tot je hem roept. Gemeten in de browser:
       nul zichtbare ingangen naar Rahul op het beginscherm.

       RTGRahul.open() is de manier waarop de rest van het huis hem roept -- de
       pill, het zoekscherm, de mond. Deze deur gebruikt dezelfde, dus er komt
       geen tweede manier bij; er komt alleen een knop bij waar er geen was.

       De vraag "bestaat RTGRahul al?" stellen we bij de KLIK en niet hier. Hij
       wordt door metgezel.js/mond.js nagelaadt en is op het moment dat de bank
       gevuld wordt vaak nog niet binnen -- gemeten: dan verscheen de deur
       helemaal niet. Wachten op iets dat er zo aankomt is geen reden om een
       knop weg te laten die het huis altijd heeft. */
    lijst.push({ naam: 'Rahul', teken: 'mens',
      doe: function () { if (window.RTGRahul && RTGRahul.open) RTGRahul.open(); } });
    if (knop) lijst.push({ naam: T('os.cc', 'Bedieningspaneel'), teken: 'instel',
      doe: function () { knop.click(); } });
    RTGCommand.systeem(lijst);
  }

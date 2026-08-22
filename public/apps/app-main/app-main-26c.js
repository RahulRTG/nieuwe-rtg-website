  /* Afgesplitst van app-main-26b.js toen dat over de 10 KB ging (regel 13).
     De snede loopt langs een echte grens: hierboven wordt het beginscherm
     GETEKEND (tegels, mappen, functies, bouw()), hier wordt er iets mee GEDAAN
     -- een map openen en een map hernoemen. */

  /* ---------- mappen openen ---------- */
  const mapScrim = $('#osMapScrim'), mapGrid = $('#osMapGrid'), mapTitel = $('#osMapTitel');
  /* HIER STOND EEN SECTIE-INDELING, EN DIE WERD NOOIT GEBRUIKT.

     De opzet was: een brede map opent in kopjes ("Betalen", "Rekeningen")
     in plaats van een raster losse merknamen. Alleen las deze functie
     `map.secties` en zette NIEMAND dat ooit -- MAPPEN in 24a2.js draagt alleen
     `items`, van de bewaarde indeling wordt alleen de NAAM onthouden
     (rtg_os_mapnamen_*), en de server bemoeit zich er niet mee. Elke map liep
     dus altijd door de terugvaltak. `.os-sectiekop` had bovendien nergens CSS:
     was er ooit een kopje verschenen, dan als kale h4 met browsermarges.

     Dat is precies de rommel waar deze codebase elders een naam voor heeft: een
     klasse zonder element, en hier een tak zonder aanroeper. Hij leest als een
     feature die bestaat, dus niemand durft eraan te komen. Weg dus -- en met
     hem de reden dat de tegels over elkaar heen lagen: de sectie-lus maakte
     RIJEN, die rijen kregen zelf een raster, en ze hingen in een #osMapGrid dat
     ook al een raster was. Nu is er een raster en liggen de tegels er direct
     in.

     Komt de indeling terug, geef de rijen dan een eigen wikkel en haal het
     raster van #osMapGrid af -- niet twee rasters in elkaar.
     test/appmenu.e2e.js meet de meetkunde en zakt als dat weer gebeurt. */
  function openMap(map) {
    /* DRIE WERELDEN (PLATFORM.md par. 0). Een wereld is een APP en geen map:
       tikken opent hem, en er komt geen tussenscherm met tegels. De `items`
       blijven staan zolang de onderdelen nog eigen pagina's zijn -- Spotlight
       indexeert ze en zonder die index is er halverwege de verhuizing van
       alles onvindbaar. Naarmate een wereld zijn secties opslokt, loopt die
       lijst vanzelf leeg. */
    if (map.wereld) { location.href = map.wereld; return; }
    /* INSTELLINGEN IS GEEN WERELD MAAR OOK GEEN TEGELVELD (WERELDEN.md): het is
       het zichtbare gezicht van RTG Core, en dat gezicht bestaat al -- het
       bedieningspaneel in de voet van de bank. Een map met `paneel` opent die
       knop in plaats van een eigen scherm.

       EN DAAROM IS HET GEEN TWEEDE INGANG. De vier identiteits-apps horen niet
       in LivingOS, maar ze los uit MAPPEN halen zou ze uit Spotlight halen, en
       dat is verbergen (ADAPTIEF.md). Ze staan nu in een eigen map: Spotlight
       indexeert ze, en de map zelf gaat naar de ENE plek waar ze wonen. */
    if (map.paneel) { const knop = $(map.paneel); if (knop) { knop.click(); return; } }
    mapTitel.textContent = mapNaam(map);
    mapGrid.textContent = '';
    const zicht = map.items.filter(itemZichtbaar);
    /* Een brede app met maar EEN deur opent die deur. Het Privekantoor is zo'n
       geval -- het is zelf al een app met kamers, dus een tussenscherm met een
       enkele tegel erop zou een extra tik zijn die niets kiest. Dit geldt ook
       als een lid de rest van een map heeft uitgezet in zijn boardroom. */
    if (zicht.length === 1) { openItem(zicht[0]); return; }
    for (const item of zicht) {
      const el = maakAppIcoon(item);
      // alleen de map zelf dicht: een os-app (Bellen) opent hierna zijn kiezer
      el.addEventListener('click', () => mapScrim.classList.remove('open'));
      mapGrid.appendChild(el);
    }
    mapScrim.classList.add('open');
  }

  /* ---------- map hernoemen (wiebel-modus of Rahul) ---------- */
  const hernoemScrim = $('#osHernoemScrim'), hernoemIn = $('#osHernoemIn');
  const hernoemOk = $('#osHernoemOk'), hernoemReset = $('#osHernoemReset');
  let hernoemDoel = null;
  function openHernoem(map) {
    if (!hernoemScrim) return;
    hernoemDoel = map;
    hernoemIn.value = mapNaam(map);
    hernoemScrim.classList.add('open');

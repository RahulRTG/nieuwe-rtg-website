/* DE LEVENDE WERELD -- het beginscherm als ruimte in plaats van een rooster.

   WAAROM DIT BESTAAT. Het beginscherm toonde losse domeintegels boven een klok. Dat
   werkt, en het is volstrekt inwisselbaar: elk toestel ter wereld opent met een
   rooster met icoontjes, dus het rooster zegt niets over wie dit huis is. Wat
   wel eigen is, stond er al -- de klok. Die is hier geen widget meer maar de
   KERN: de drie hoofdwerelden hangen als merken op een bezel om hem heen, je DRAAIT
   eraan om te reizen, en je stapt een wereld binnen zonder de cirkel te
   verlaten.

   WAT DIT BESTAND NIET WEET, EN NIET MAG WETEN. De werelden zelf staan in
   MAPPEN (apps/app-main/app-main-24a2.js) -- dat is de enige lijst, en hij
   bepaalt ook de rasterstand. Deze module krijgt ze aangereikt en houdt geen
   eigen kopie (LAT.md regel 4). Ze weet ook niet hoe je een app opent: dat doet
   de aanroeper, want die kent openItem() al. Wie hier een tweede lijst werelden
   of een tweede navigatiepad ziet ontstaan, heeft de fout te pakken die dit
   commentaar probeert te voorkomen.

   DE BEDIENING, en elk gebaar heeft een toets-equivalent -- dit scherm is de
   voordeur, dus het mag nooit alleen met een vinger te bedienen zijn:

     slepen over de ring   reizen naar een andere wereld
     pijl links / rechts   idem, een wereld per aanslag
     tik op een merk       reizen ernaartoe; nog een tik opent de wereld
     tik op de klok        INZOOMEN: de merken worden de onderdelen van deze
                           wereld, in dezelfde cirkel
     tik op de klok (diep) weer uitzoomen
     lang drukken / w      het Command Wheel: Regel, Zoek, Analyseer, Maak,
                           Automatiseer
     Escape                uitzoomen, of het wiel sluiten

   BEWEGING IS EEN VOORKEUR, GEEN VERSIERING. Alles wat hier beweegt leest
   window.RTGBeweging (de schuif "Beweging" in het bedieningspaneel) en
   prefers-reduced-motion. Op stil staat de wereld stil -- hij blijft volledig
   bedienbaar, er beweegt alleen niets meer. */
(function (w) {
  'use strict';
  if (w.RTGWereld) return;

  var d = w.document;
  var RUSTIG = false;
  try { RUSTIG = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* De standen op de bezel. Ze staan hier als HOEK en niet als lijst
     werelden: hoeveel werelden er zijn bepaalt de aanroeper, en de ring rekent
     zijn verdeling daaruit uit. Zet iemand er ooit een negende bij, dan klopt
     de bezel vanzelf -- dat is het verschil tussen een verdeling en een vast
     overgetikte hoeken. */
  var st = {
    aan: false,          // staat de wereldstand aan?
    werelden: [],        // wat de aanroeper aanreikte
    actief: 0,           // wat er op twaalf uur staat, geteld IN DE HUIDIGE RING
    wereldIdx: 0,        // in welke wereld we zijn ingezoomd (alleen als diep)
    diep: false,         // staan we IN een wereld (ingezoomd)?
    hoek: 0,             // waar de ring nu staat, in graden
    doel: 0,             // waar hij heen eased
    merken: [],          // de knoppen op de ring
    gesleept: false,     // is de laatste aanraking een sleep geweest? (dan geen tik)
    haak: null           // de rAF-lus, als hij loopt
  };

  // de aanroeper vult deze in via start(); zonder aanroeper doet de module niets
  var api = { openUrl: null, openDeel: null, zegRahul: null };

  /* Waar de ring naar kijkt. Bovenin zijn dat de werelden; ingezoomd zijn het
     de onderdelen van EEN wereld. Twee tellingen die makkelijk door elkaar
     lopen, dus ze hebben elk een eigen veld: st.actief telt in de ring die je
     NU ziet, st.wereldIdx onthoudt waar je in bent gestapt. Eén teller voor
     allebei leek korter en gaf een ring die na uitzoomen op de verkeerde
     wereld stond. */
  function ringItems() {
    if (!st.werelden.length) return [];
    if (!st.diep) return st.werelden;
    return (st.werelden[st.wereldIdx] && st.werelden[st.wereldIdx].delen) || [];
  }
  function huidige() { return ringItems()[st.actief] || null; }

  /* ---------- de kring bouwen ----------
     Hij komt in het vak waar de klok al stond (.os-klokvak) en neemt de klok
     op in zijn midden. DEZELFDE klok: er wordt er geen tweede gemaakt, want dan
     zou de tijd op twee plekken vandaan komen en op een dag uit elkaar lopen.
     De rasterstand krijgt hem zo ook gewoon terug als je terugschakelt. */
  var el = { vak: null, scherm: null, klok: null, kring: null, bezel: null, boog: null,
    kern: null, naam: null, sub: null, wiel: null, rahul: null, grond: null,
    momenten: null, momentKaart: null };

  function bouwKring() {
    if (el.kring) return el.kring;

    var kring = d.createElement('div');
    kring.className = 'os-wereldkring';
    kring.setAttribute('data-diep', 'nee');

    /* De bezel: een fijne gouden haarlijn met streepjes, en op twaalf uur het
       vaste merkteken. Dat teken staat STIL en de ring draait eronderdoor --
       zo lees je de stand af aan een vast punt, net als op een horloge. Een
       meedraaiende wijzer zou je juist laten zoeken. */
    var bezel = d.createElement('div');
    bezel.className = 'os-bezel';
    bezel.setAttribute('aria-hidden', 'true');
    /* DE MEETKUNDE VAN DE BEZEL, EN WAAROM ZE IS ZOALS ZE IS.

       De merken staan op straal 41 (zie STRAAL in deel 2) en zijn zelf zo'n 5
       breed, dus ze beslaan de band van 36 tot 46. Alles wat de bezel tekent
       hoort DAARBUITEN te vallen, anders loopt er een lijn dwars door een glyf.

       Dat ging hier eerst mis, en het was op een stilstaand scherm nauwelijks te
       zien: de haarlijn stond op precies 41 (dus midden door alle
       glyfschijven) en het merkteken op twaalf uur liep van 40,6 tot 45,4 --
       precies over het merk dat er net onder was komen te staan. Je zag geen
       aanwijzer boven een wereld maar een streepje IN een wereld.

       Nu: de haarlijn is de buitenrand (48,5), de scheidingen staan TUSSEN de
       werelden in (niet erop, dus ze kunnen ook niets raken) en het merkteken is
       een gouden driehoek die naar binnen wijst, met zijn punt op 46,4 -- net
       boven de merken en nergens overheen. */
    bezel.innerHTML =
      '<svg viewBox="0 0 100 100" fill="none">' +
        '<circle cx="50" cy="50" r="48.5" stroke="var(--line)" stroke-width="0.4"/>' +
        '<g class="os-bezel-boog"></g>' +
        // het merkteken op twaalf uur: een gouden index die naar binnen wijst
        '<path d="M50 3.6 L48.4 0.4 L51.6 0.4 Z" fill="var(--gold)"/>' +
      '</svg>';
    kring.appendChild(bezel);

    el.vak.insertBefore(kring, el.klok);
    kring.appendChild(el.klok);           // de klok verhuist naar het midden

    el.kring = kring;
    el.bezel = bezel;
    el.boog = bezel.querySelector('.os-bezel-boog');
    return kring;
  }

  /* De naam van de wereld waar je staat, en eronder EEN geteld feit. Geen
     verzonnen stand: CANVAS.md is er hard over dat een stand die niet gemeten
     kan worden, niet getoond hoort te worden. Wat we wel weten is hoeveel
     onderdelen deze wereld voor JOUW pas draagt, en dat staat er dan ook. */
  function bouwNaam() {
    if (el.naam) return;
    var naam = d.createElement('p');
    naam.className = 'os-wereld-naam';
    naam.id = 'osWereldNaam';
    naam.setAttribute('role', 'status');
    naam.setAttribute('aria-live', 'polite');
    var sub = d.createElement('p');
    sub.className = 'os-wereld-sub';
    sub.id = 'osWereldSub';
    el.vak.parentNode.insertBefore(naam, el.vak.nextSibling);
    naam.parentNode.insertBefore(sub, naam.nextSibling);
    el.naam = naam; el.sub = sub;
  }

  /* ---------- de merken op de ring ----------
     Elk merk is een ECHTE knop. Dat is geen nettigheid: dit is de voordeur van
     het hele platform, en een voordeur die alleen met een vinger opengaat is
     voor een deel van de leden geen voordeur. Tabben, Enter en een schermlezer
     werken dus allemaal, en elk gebaar hieronder heeft verderop een toets die
     hetzelfde doet.

     De merken hangen NIET in de draaiende bezel maar los in de kring, en hun
     plaats wordt per beeld uitgerekend. Dat scheelt een tegendraai per merk (de
     glyf moet rechtop blijven; een gekantelde glyf is een sierletter en geen
     teken dat je in een oogopslag herkent) en het houdt de meetkunde op EEN
     plek: plaats(). */
  var STRAAL = 41;     // procent van de kring -- gelijk aan de haarlijn in de svg

  function maakMerk(item, i) {
    var b = d.createElement('button');
    b.type = 'button';
    b.className = 'os-wm';
    b.dataset.i = String(i);
    /* De sleutel meegeven, net als de tegels in het rooster (.os-app[data-sleutel]).
       Dat is dezelfde afspraak op twee weergaven van dezelfde lijst: wie wil weten
       WELKE app hier hangt, leest overal hetzelfde attribuut en niet de zichtbare
       naam -- die verandert met het beleid mee ("Video" en niet "Clips"), en dan
       wijst alles wat op de naam leunt ineens nergens meer heen. */
    if (item.sleutel) b.dataset.sleutel = item.sleutel;
    merkLicht(b, item);
    b.setAttribute('aria-label', item.naam);
    /* WAT ER BINNENKOMT IS NIET ALTIJD EEN TEKEN.

       tegelInhoud() levert drie soorten: een glyf-svg, de svg van een tabblad,
       of -- als er geen van beide is -- een kaal opsommingsteken als TEKSTKNOOP.
       Dat laatste is op een tegel met een naam eronder prima, maar een merk op
       de ring heeft geen naam eronder: dan hangt er een lege schijf waar je
       niets aan af kunt lezen. Twee daarvan stonden er, en een lege knop is
       erger dan een lelijke.

       Een tekstknoop is bovendien "truthy", dus de oude terugval sloeg juist bij
       dit geval niet aan. We eisen daarom een ELEMENT; komt dat er niet, dan
       maken we het monogram zelf. */
    var teken = item.teken && item.teken();
    if (teken && teken.nodeType === 1) b.appendChild(teken);
    else {
      var mono = d.createElement('span');
      mono.className = 'os-monogram';
      mono.textContent = String(item.naam || '?').replace(/^RTG /, '').slice(0, 2);
      b.appendChild(mono);
    }
    /* Tikken doet twee dingen, en welke hangt af van waar je staat. Op een merk
       dat NIET op twaalf uur staat reis je ernaartoe -- dat is wat je bedoelt
       als je een ander merk aanwijst. Staat het er al, dan open je het. Zo is
       er geen aparte "open"-knop nodig en kost reizen nooit per ongeluk een
       paginawissel. */
    b.addEventListener('click', function () {
      /* EEN SLEEP EINDIGT NIET IN EEN TIK. Laat je de ring los met je vinger op
         een merk, dan stuurt de browser daar netjes een click achteraan -- en
         dan draai je even aan de bezel en sta je ineens in een andere app. De
         sleeplaag zet st.gesleept, en die geldt voor ELKE knop in de kring, niet
         alleen voor de kern. Dit stond eerst alleen op de kern, en dat was de
         helft van de maatregel. */
      if (st.gesleept) return;
      if (Number(b.dataset.i) !== st.actief) { naar(Number(b.dataset.i)); return; }
      open();
    });
    return b;
  }

  /* De ring opnieuw vullen: bij het aanzetten, en bij elke wissel tussen de
     werelden en de onderdelen van een wereld. */
  function vulRing() {
    var items = ringItems();
    st.merken.forEach(function (m) { m.remove(); });
    st.merken = items.map(function (item, i) {
      var m = maakMerk(item, i);
      el.kring.appendChild(m);
      return m;
    });
    tekenStreepjes(items.length);
    plaats();
  }

  /* De scheidingen op de bezel: een TUSSEN elke twee werelden, en ze draaien
     mee. Tussen en niet op, want op de standen zelf staan de merken -- daar zou
     een streepje door een glyf lopen. Zo krijgt elke wereld bovendien een eigen
     vak op de ring, en dat is precies wat je van een bezel verwacht.

     Ze worden hier GETEKEND naar het aantal standen en niet als een vast aantal
     overgetikt: komt er ooit een negende wereld bij, dan klopt de verdeling
     vanzelf. */
  function tekenStreepjes(n) {
    if (!el.boog) return;
    el.boog.textContent = '';
    if (!n) return;
    var ns = 'http://www.w3.org/2000/svg';
    for (var i = 0; i < n; i++) {
      var a = ((i + 0.5) * (360 / n) - 90) * Math.PI / 180;
      var p = d.createElementNS(ns, 'line');
      p.setAttribute('x1', (50 + 44 * Math.cos(a)).toFixed(2));
      p.setAttribute('y1', (50 + 44 * Math.sin(a)).toFixed(2));
      p.setAttribute('x2', (50 + 48.5 * Math.cos(a)).toFixed(2));
      p.setAttribute('y2', (50 + 48.5 * Math.sin(a)).toFixed(2));
      p.setAttribute('stroke', 'var(--line)');
      p.setAttribute('stroke-width', '0.4');
      p.setAttribute('stroke-linecap', 'round');
      el.boog.appendChild(p);
    }
  }

  /* De enige plek waar de meetkunde staat. Alles wat draait leest hier zijn
     positie uit st.hoek, dus er is geen tweede plaats waar "waar staat merk
     drie" beantwoord wordt. */
  function plaats() {
    var n = st.merken.length;
    if (!n || !el.kring) return;
    var stap = 360 / n;
    for (var i = 0; i < n; i++) {
      var a = (i * stap + st.hoek - 90) * Math.PI / 180;
      var m = st.merken[i];
      m.style.left = (50 + STRAAL * Math.cos(a)).toFixed(3) + '%';
      m.style.top = (50 + STRAAL * Math.sin(a)).toFixed(3) + '%';
      m.style.transform = 'translate(-50%,-50%)';
    }
    if (el.boog) el.boog.setAttribute('transform', 'rotate(' + st.hoek.toFixed(2) + ' 50 50)');

    /* Welke wereld staat er op twaalf uur? Dat volgt uit de hoek en wordt niet
       apart bijgehouden: twee plekken die dezelfde waarheid bewaren lopen uit
       elkaar zodra iemand er een vergeet bij te werken (LAT.md regel 4). */
    var nieuw = ((-Math.round(st.hoek / stap)) % n + n) % n;
    if (nieuw !== st.actief) { st.actief = nieuw; toonNaam(); }
    for (var j = 0; j < n; j++) st.merken[j].dataset.actief = (j === st.actief ? 'ja' : 'nee');
  }

  /* De naam onder de klok, en eronder EEN geteld feit. Wat er staat is echt
     geteld en niet verzonnen: hoeveel onderdelen deze wereld voor JOUW pas
     draagt. CANVAS.md is er hard over dat een stand die niet gemeten kan
     worden, niet getoond hoort te worden -- dus hier geen "Operationeel" dat
     altijd groen is. */
  function toonNaam() {
    var it = huidige();
    if (!el.naam || !it) return;
    el.naam.textContent = it.naam;
    if (!el.sub) return;
    if (st.diep) {
      el.sub.textContent = (st.werelden[st.wereldIdx] || {}).naam || '';
    } else {
      var n = (it.delen || []).length;
      el.sub.textContent = n ? (n + (n === 1 ? ' onderdeel' : ' onderdelen')) : '';
    }
  }

  /* ---------- draaien ----------
     De ring eased naar zijn doel in EEN rAF-lus, en die lus draagt ook de
     levende grond (zie deel 4). Twee lussen naast elkaar zouden hetzelfde
     beeldframe twee keer betalen. */
  function loop() {
    st.haak = null;
    var verschil = st.doel - st.hoek;
    if (Math.abs(verschil) < 0.04) { st.hoek = st.doel; plaats(); }
    else { st.hoek += verschil * 0.2; plaats(); vraagFrame(); }
    grondFrame();
  }
  function vraagFrame() { if (!st.haak && st.aan) st.haak = w.requestAnimationFrame(loop); }

  // naar een stand toe. Bewegingsarm springt hij er meteen heen: de stand
  // veranderen is de functie, het draaien is de versiering.
  function naar(i) {
    var n = st.merken.length;
    if (!n) return;
    var stap = 360 / n;
    /* De KORTSTE weg, en niet altijd met de klok mee. Zonder deze stap draait
       de ring van stand 7 naar stand 0 helemaal terug langs alle zes ertussen,
       terwijl je buurman naast je stond. */
    var rondjes = Math.round(st.doel / 360);
    var kandidaten = [-i * stap + rondjes * 360, -i * stap + (rondjes + 1) * 360, -i * stap + (rondjes - 1) * 360];
    st.doel = kandidaten.reduce(function (a, b) {
      return Math.abs(b - st.hoek) < Math.abs(a - st.hoek) ? b : a;
    });
    if (RUSTIG || sleepStil()) { st.hoek = st.doel; plaats(); grondFrame(); }
    else vraagFrame();
  }
  function sleepStil() { return !!(w.RTGBeweging && w.RTGBeweging.factor && w.RTGBeweging.factor() === 0); }

  /* ---------- de kern: de klok als knop ----------
     De klok zelf blijft van shared/klok.js -- die tekent hem en houdt de tijd
     bij, en dat blijft daar. Wat er hier bij komt is een doorzichtige knop
     eroverheen, want de kern moet aantikbaar EN aantabbaar zijn, en een <div>
     met een clicklistener is geen van beide. */
  function bouwKern() {
    if (el.kern) return;
    var k = d.createElement('button');
    k.type = 'button';
    k.className = 'os-wereld-kern';
    k.id = 'osWereldKern';
    el.kring.appendChild(k);
    el.kern = k;
    k.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (st.gesleept) return;
      /* Staat er een moment open, dan is de klok DAT moment; een tik brengt je
         eerst terug naar de klok. Meteen doorzoomen zou betekenen dat een tik
         twee dingen tegelijk doet, en dan weet je na afloop niet waar je bent. */
      if (momentStaatOpen()) { sluitMoment(); return; }
      zoom(!st.diep);
    });
    // rechtsklikken is op een muis wat lang drukken op een vinger is
    k.addEventListener('contextmenu', function (ev) { ev.preventDefault(); wiel(true); });
  }

  /* ---------- in- en uitzoomen ----------
     Dit is het hart van het idee: je opent geen nieuw scherm, je gaat een
     niveau dieper in DEZELFDE cirkel. De merken worden de onderdelen van de
     wereld waar je in stapt; de klok blijft in het midden staan. Uitzoomen zet
     de ring terug op precies de wereld waar je vandaan kwam -- vandaar dat
     st.wereldIdx bestaat naast st.actief. */
  function zoom(naarBinnen) {
    if (!st.werelden.length) return;
    if (naarBinnen && (!st.werelden[st.actief] || !(st.werelden[st.actief].delen || []).length)) return;
    if (!naarBinnen && !st.diep) return;
    // eerst wegvliegen, dan pas wisselen: anders wisselt de inhoud terwijl de
    // oude nog in beeld staat, en dat is geen vlucht maar een flikkering
    vlieg(naarBinnen, function () { zoomNu(naarBinnen); });
  }
  function zoomNu(naarBinnen) {
    if (naarBinnen) {
      var wereld = st.werelden[st.actief];
      if (!wereld || !(wereld.delen || []).length) return;   // niets om in te zoomen
      st.wereldIdx = st.actief;
      st.diep = true;
      st.actief = 0; st.hoek = 0; st.doel = 0;
    } else {
      if (!st.diep) return;
      st.diep = false;
      st.actief = st.wereldIdx;
      st.hoek = -st.wereldIdx * (360 / (st.werelden.length || 1));
      st.doel = st.hoek;
    }
    el.kring.setAttribute('data-diep', st.diep ? 'ja' : 'nee');
    vulRing();
    tekenMomenten();
    toonNaam();
    kernLabel();
    grondKies();
  }

  /* Wat de kernknop belooft, klopt met wat hij doet. Een knop die "Open" heet
     en inzoomt is precies het soort kleine leugen waar een schermlezer als
     enige tegenaan loopt. */
  function kernLabel() {
    if (!el.kern) return;
    var it = huidige();
    el.kern.setAttribute('aria-label', st.diep
      ? 'Terug naar alle werelden'
      : ('Bekijk wat er in ' + ((it && it.naam) || 'deze wereld') + ' zit'));
  }

  /* Openen: bovenin gaat een merk naar de wereld zelf, ingezoomd opent het het
     onderdeel. Allebei doet de AANROEPER, want die kent de routes al -- deze
     module houdt geen tweede navigatiepad bij. */
  function open() {
    var it = huidige();
    if (!it) return;
    if (st.diep) { if (api.openDeel) api.openDeel(it.sleutel); return; }
    if (it.url && api.openUrl) api.openUrl(it.url);
  }

  /* ---------- slepen: de wereld draait ----------
     Het gebaar is hoekig en niet horizontaal: je pakt de ring beet waar je hem
     aanraakt en draait hem, zoals aan een bezel. Een horizontale veeg zou op
     twaalf uur precies andersom voelen dan op zes uur. */
  var sleep = null;
  function bindSleep() {
    var k = el.kring;
    k.addEventListener('pointerdown', function (ev) {
      if (ev.button != null && ev.button !== 0) return;
      var vak = k.getBoundingClientRect();
      sleep = {
        id: ev.pointerId, vak: vak,
        begin: hoekVan(ev, vak), hoek0: st.hoek,
        x: ev.clientX, y: ev.clientY, ver: false
      };
      st.gesleept = false;
      try { k.setPointerCapture(ev.pointerId); } catch (e) {}
      /* Het wiel komt op als je je vinger op de KLOK houdt, niet ergens op de
         ring. Dat verschil is geen muggenzifterij: een merk vasthouden voelt
         als "deze wil ik", en dan is een menu dat opengaat een verrassing. */
      if (bijDeKern(ev, vak)) langIn();
    });
    k.addEventListener('pointermove', function (ev) {
      if (!sleep || ev.pointerId !== sleep.id) return;
      if (!sleep.ver && Math.hypot(ev.clientX - sleep.x, ev.clientY - sleep.y) > 6) {
        sleep.ver = true; st.gesleept = true; langUit();
      }
      if (!sleep.ver) return;
      var nu = hoekVan(ev, sleep.vak);
      st.hoek = sleep.hoek0 + wikkel(nu - sleep.begin);
      st.doel = st.hoek;
      plaats(); grondFrame();
    });
    var los = function (ev) {
      if (!sleep || (ev.pointerId != null && ev.pointerId !== sleep.id)) return;
      var was = sleep.ver;
      sleep = null; langUit();
      if (!was) { st.gesleept = false; return; }
      // loslaten klikt vast op de dichtstbijzijnde stand: een bezel blijft niet
      // tussen twee standen in hangen
      var n = st.merken.length || 1, stap = 360 / n;
      st.doel = Math.round(st.hoek / stap) * stap;
      if (RUSTIG || sleepStil()) { st.hoek = st.doel; plaats(); grondFrame(); } else vraagFrame();
      // de klik die na pointerup komt, hoort niet ook nog eens te openen
      w.setTimeout(function () { st.gesleept = false; }, 0);
    };
    k.addEventListener('pointerup', los);
    k.addEventListener('pointercancel', los);
  }
  // ligt dit punt op de wijzerplaat, of op de ring eromheen? De kernknop is 52%
  // breed (zie wereld.css), dus de helft daarvan is zijn straal.
  function bijDeKern(ev, vak) {
    var dx = ev.clientX - (vak.left + vak.width / 2);
    var dy = ev.clientY - (vak.top + vak.height / 2);
    return Math.hypot(dx, dy) <= vak.width * 0.26;
  }
  function hoekVan(ev, vak) {
    return Math.atan2(ev.clientY - (vak.top + vak.height / 2),
      ev.clientX - (vak.left + vak.width / 2)) * 180 / Math.PI;
  }
  // een hoekverschil terug naar (-180, 180]: zonder dit springt de ring een
  // heel rondje zodra je met je vinger over de -180/180-naad gaat
  function wikkel(g) { g = (g + 180) % 360; if (g < 0) g += 360; return g - 180; }

  /* ---------- lang drukken ----------
     Het Command Wheel komt waar je duim al ligt. Bewegen breekt het af: wie
     draait, wil draaien. */
  var langTimer = null;
  function langIn() {
    langUit();
    langTimer = w.setTimeout(function () { langTimer = null; sleep = null; wiel(true); }, 480);
  }
  function langUit() { if (langTimer) { w.clearTimeout(langTimer); langTimer = null; } }

  /* ---------- toetsen ----------
     Elk gebaar hierboven heeft hier zijn tegenhanger. Zonder dit blok is de
     wereldstand een scherm dat je alleen met een vinger kunt bedienen, en dan
     is hij als voordeur niet af. */
  function bindToetsen() {
    el.kring.setAttribute('tabindex', '-1');
    d.addEventListener('keydown', function (ev) {
      if (!st.aan) return;
      // niet meesturen terwijl iemand in de balk van Rahul typt
      var t = ev.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      var n = st.merken.length || 1;
      if (ev.key === 'ArrowRight') { ev.preventDefault(); naar((st.actief + 1) % n); }
      else if (ev.key === 'ArrowLeft') { ev.preventDefault(); naar((st.actief - 1 + n) % n); }
      else if (ev.key === 'Escape') { if (wielOpen()) wiel(false); else if (momentStaatOpen()) sluitMoment(); else if (st.diep) zoom(false); }
      else if (ev.key === 'w' || ev.key === 'W') { ev.preventDefault(); wiel(!wielOpen()); }
    });
  }

  /* ---------- het Command Wheel ----------
     Geen menu met functies maar vijf WERKWOORDEN, en ze komen op waar je duim
     al ligt. Het verschil is niet cosmetisch: een menu vraagt je eerst te
     bedenken in welke app iets hoort, een werkwoord vraagt alleen wat je wilt.
     De wereld waar je staat is de context, dus "Regel" op Reizen betekent iets
     anders dan "Regel" op Geld -- en dat hoef je nergens in te vullen.

     Ze doen ook echt iets: de keuze gaat naar de balk van Rahul, met de wereld
     erbij waar je hem vandaan haalde. Een wiel dat mooi opengaat en daarna niets
     doet, is een animatie en geen bediening. */
  var WERKWOORDEN = ['Regel', 'Zoek', 'Analyseer', 'Maak', 'Automatiseer'];

  function bouwWiel() {
    if (el.wiel) return;
    var wl = d.createElement('div');
    wl.className = 'os-wiel';
    wl.id = 'osWiel';
    wl.setAttribute('data-open', 'nee');
    wl.setAttribute('role', 'menu');
    wl.setAttribute('aria-label', 'Wat wil je doen');

    var doek = d.createElement('div');
    doek.className = 'os-wiel-doek';
    doek.addEventListener('click', function () { wiel(false); });
    wl.appendChild(doek);

    WERKWOORDEN.forEach(function (woord, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'os-wiel-knop';
      b.setAttribute('role', 'menuitem');
      b.textContent = woord;
      // vijf standen op een cirkel, bovenaan beginnend
      var a = (i * (360 / WERKWOORDEN.length) - 90) * Math.PI / 180;
      b.style.left = (50 + 34 * Math.cos(a)) + '%';
      b.style.top = (50 + 34 * Math.sin(a)) + '%';
      b.style.transform = 'translate(-50%,-50%)';
      b.style.animationDelay = (i * 40) + 'ms';
      b.addEventListener('click', function () {
        wiel(false);
        var it = huidige();
        if (api.zegRahul) api.zegRahul(woord + ' ' + ((it && it.naam) || '').replace(/^RTG /, ''));
      });
      wl.appendChild(b);
    });

    el.kring.appendChild(wl);
    el.wiel = wl;
  }

  function wielOpen() { return !!(el.wiel && el.wiel.getAttribute('data-open') === 'ja'); }
  function wiel(open) {
    if (!el.wiel) return;
    el.wiel.setAttribute('data-open', open ? 'ja' : 'nee');
    if (open) {
      var eerste = el.wiel.querySelector('.os-wiel-knop');
      if (eerste) eerste.focus();
    } else if (el.kern) el.kern.focus();
  }

  /* ---------- de ring van Rahul ----------
     Hij is er niet, tot hij iets heeft. Geen vaste balk die altijd "Goedemorgen"
     zegt -- die leest na drie dagen als behang -- maar een gouden ring die
     opkomt met EEN zin op het moment dat er werkelijk iets is.

     De zin komt niet van hier. Hij komt uit de draad die Rahul al vult
     (app-main-29b.js, uit /fluister/profiel, /voorspel en /spar/lijst), en die
     roept rahulZei() aan. Zo staat er nooit iets in de ring wat hij niet echt
     gezegd heeft: er wordt hier niets verzonnen om het scherm te vullen. */
  function bouwRahul() {
    if (el.rahul) return;
    var r = d.createElement('button');
    r.type = 'button';
    r.className = 'os-wereld-rahul';
    r.id = 'osWereldRahul';
    r.setAttribute('data-toon', 'nee');
    r.setAttribute('data-soort', 'rahul');
    r.innerHTML = '<b aria-hidden="true"></b><span></span>';
    /* De ring draagt twee soorten. Wat RAHUL zegt komt van de server en opent
       het gesprek; wat het RITME zegt komt van dit toestel en draait de bezel
       naar de wereld die je normaal nu opent. Een knop die er hetzelfde uitziet
       en twee dingen doet, hoort dat aan een attribuut af te lezen en niet aan
       de volgorde waarin hij toevallig gevuld is. */
    r.addEventListener('click', function () {
      if (r.getAttribute('data-soort') === 'ritme') { ritmeVolg(); return; }
      r.setAttribute('data-toon', 'nee');
      draadOpen();
    });
    // onder de naam, boven de balk van Rahul
    if (el.sub && el.sub.parentNode) el.sub.parentNode.insertBefore(r, el.sub.nextSibling);
    el.rahul = r;
  }

  function rahulZei(tekst, leeg) {
    if (!st.aan || !el.rahul || !tekst) return;
    // staat het gesprek al open, dan LEEST hij daar al mee; dan is de ring
    // erbij precies de dubbeling die hij hoort te voorkomen
    if (draadStaatOpen()) return;
    /* Zegt hij dat er niets is, dan HEEFT hij niets -- en dan mag je gewoonte de
       ring hebben. Zonder deze tak wint zijn beleefde niets-zin het altijd van
       het ritme en zie je dat nooit. */
    /* "ER LIGT NIETS DRINGENDS" KRIJGT DE RING NIET.

       De hele afspraak van deze ring is: hij is er niet, tot Rahul iets HEEFT.
       Zijn terugvalzin is per definitie het tegenovergestelde -- dat is hem die
       netjes meldt dat er niets is. Die zin in een gouden ring zetten is precies
       het behang dat we van dit scherm af hebben gehaald.

       Het bleef ook niet bij lelijk. Tik je het ritme weg, dan kwam zijn lege
       zin er meteen voor in de plaats: je zegt "laat maar" en krijgt er iets
       anders voor terug. Nu biedt een lege zin de ring alleen aan het ritme aan;
       is dat er niet, dan blijft de ring dicht. In de DRAAD staat zijn zin
       gewoon, voor wie het gesprek opent -- hij wordt niet ingeslikt, hij komt
       alleen niet ongevraagd in beeld. */
    if (leeg === true) { toonRitme(); return; }
    el.rahul.querySelector('span').textContent = String(tekst);
    el.rahul.setAttribute('data-soort', 'rahul');
    el.rahul.setAttribute('data-toon', 'ja');
  }

  /* Het gesprek openklappen. Gebeurt als je de ring aantikt en als je zelf gaat
     typen -- allebei betekenen ze "ik wil dit gesprek zien", en daarna blijft
     het staan. De draad zelf is DEZELFDE draad als op het rooster; hier wordt
     alleen bepaald of hij in beeld is. */
  function draadStaatOpen() {
    return !!(el.scherm && el.scherm.getAttribute('data-os-draad') === 'open');
  }
  function draadOpen() {
    if (!el.scherm) return;
    el.scherm.setAttribute('data-os-draad', 'open');
    var draad = d.getElementById('osAiDraad');
    if (draad && draad.children.length) { draad.hidden = false; draad.scrollTop = draad.scrollHeight; }
  }

  /* ---------- de levende grond ----------
     Achter alles ligt een canvas dat per wereld een ander motief ademt: golven
     bij Reizen, bouwlijnen bij Kantoor, geometrie bij Geld, stadslichten bij
     Media. Het staat bewust op de rand van zichtbaar. Dat is de bedoeling --
     je hoort het pas na een week te merken, en dan als "die achtergrond klopt
     bij waar ik ben", niet als "kijk, een animatie".

     DRIE REGELS DIE HIER NIET ONDERHANDELBAAR ZIJN:
     1. Het draagt geen betekenis. Alles wat je moet WETEN staat in tekst; deze
        laag is sfeer. Daarom is het canvas voor een schermlezer niet aanwezig
        en vangt het geen tikken.
     2. Het luistert naar de schuif Beweging (window.RTGBeweging) en naar
        prefers-reduced-motion. Op stil wordt er EEN beeld getekend en verder
        niets -- geen lus die stilletjes door blijft draaien.
     3. Het staat stil zodra het tabblad weg is. Een achtergrond die op een
        onzichtbare pagina batterij verstookt, is geen sfeer maar een lek. */
  var grond = { cv: null, ctx: null, motief: null, t: 0, laatst: 0, tik: null, kleur: '#C9A24B' };

  /* DE STERRENHEMEL VAN DE POORT, OP HET BEGINSCHERM.

     Precies dezelfde laag als op de inlogpoort (app-main-04b.js hangt hem daar
     op), met dezelfde sterrenbeelden op dezelfde plek aan de hemel. Dat is de
     hele bedoeling: je logt in onder een firmament en je komt binnen onder
     hetzelfde firmament. Een eigen namaakhemel hiernaast zou twee hemels zijn
     die na de eerste wijziging uit elkaar lopen.

     De module wordt bijgeladen als hij er nog niet is; lukt dat niet, dan is er
     gewoon geen sterrenhemel en verandert er verder niets. */
  /* EN HIJ WORDT PAS OPGEHANGEN ALS HET SCHERM EEN MAAT HEEFT.

     shared/sterren.js meet zijn doel met Math.max(1, breedte). Dat is voor de
     inlogpoort prima -- die staat in beeld op het moment dat hij wordt
     opgehangen -- maar het beginscherm wordt opgebouwd terwijl de poort er nog
     overheen ligt. Dan is de maat nul, wordt het doek 1 bij 1 pixel, en rekt
     het blad die ene pixel uit tot een egaal vlak over het hele scherm. Wat je
     ziet is geen sterrenhemel maar een crèmekleurige lap over je hele
     beginscherm -- en niets in de console zegt er iets over.

     Dezelfde les als bij de gloed hieronder, en daarom hier hetzelfde middel:
     wachten tot het scherm werkelijk een maat heeft, en dan pas ophangen. */
  var hemel = null, hemelMaat = '', hemelWacht = null, hemelLaadt = false;

  /* Nog eens kijken op het volgende beeld, met een bodem eronder: een animatie
     die om wat voor reden ook nooit eindigt, mag geen lus worden die blijft
     draaien zolang de app openstaat. */
  var hemelBeurten = 0;
  function hemelStraks() {
    if (hemelBeurten > 120) return;            // ~2 seconden, dan is het klaar
    hemelBeurten++;
    w.requestAnimationFrame(function () { hangHemel(); });
  }

  function bouwHemel() {
    if (!el.scherm) return;
    hemelBeurten = 0;
    hangHemel();
    if (hemelWacht) return;
    try {
      if (w.ResizeObserver) {
        hemelWacht = new w.ResizeObserver(function () { hangHemel(); });
        hemelWacht.observe(el.scherm);
      }
    } catch (e) { /* geen waarnemer: dan blijft het bij de eerste meting */ }
  }

  /* De hemel hangt op de maat die het scherm NU heeft, en blijft dat volgen.
     Twee keer meten is hier geen luxe:

     1. Bij het opbouwen heeft het scherm vaak nog helemaal geen maat (de poort
        ligt er nog overheen), en dan wordt het doek 1 bij 1 -- zie hierboven.
     2. Ook daarna klopt de eerste meting niet meteen. Gemeten: 368 bij 737
        terwijl het scherm 393 bij 788 werd. Het doek wordt dan door het blad
        uitgerekt, en een uitgerekte sterrenhemel is een WAZIGE sterrenhemel --
        precies het soort verschil dat je niet als fout herkent maar als
        "goedkoop".

     shared/sterren.js meet alleen bij het ophangen en bij een venster-resize,
     dus dat laatste vangt hij niet. Vandaar dat we hem bij een echte
     maatverandering opnieuw ophangen; hij ruimt zichzelf netjes op met stop(). */
  function hangHemel() {
    var b = el.scherm.getBoundingClientRect();
    var lb = el.scherm.clientWidth, lh = el.scherm.clientHeight;
    /* Een ResizeObserver is een extra vangnet, geen voorwaarde. In een drukke
       browser kan de eerste nulmaat precies tussen observerregistratie en de
       eerste melding vallen. Zonder eigen herpoging blijft die sessie dan
       voorgoed zonder hemel. */
    if (lb < 40 || lh < 40) { hemelStraks(); return false; }
    /* NIET OPHANGEN TERWIJL HET SCHERM NOG BINNENKOMT.

       Het beginscherm heeft een openingsanimatie die hem van 0,98 naar 1
       schaalt (osThuis, zie app.html). shared/sterren.js meet met
       getBoundingClientRect(), en die geeft de GESCHAALDE maat -- dus wie
       midden in die animatie ophangt, krijgt een doek van 386 bij 773 dat het
       blad daarna uitrekt naar 393 bij 788. Dat is geen fout die je herkent,
       het is een sterrenhemel die net iets wazig is: het soort verschil dat
       niet als kapot leest maar als goedkoop.

       Een ResizeObserver ziet dit niet -- een transform verandert de
       indelingsmaat niet -- dus wachten we tot de getekende maat en de
       indelingsmaat weer gelijk zijn, en kijken tot die tijd elk beeld opnieuw. */
    if (Math.abs(b.width - lb) > 1 || Math.abs(b.height - lh) > 1) { hemelStraks(); return false; }
    var maat = lb + 'x' + lh;
    if (maat === hemelMaat) return true;
    hemelMaat = maat;
    var doe = function () {
      if (!w.RTGSterren) return;
      if (hemel && hemel.stop) { try { hemel.stop(); } catch (e) {} }
      hemel = w.RTGSterren.hang(el.scherm, { helderheid: 0.62, dichtheid: 0.8 });
    };
    if (w.RTGSterren) { doe(); return true; }
    if (hemelLaadt) return true;               // al onderweg; niet twee keer laden
    hemelLaadt = true;
    var s = d.createElement('script');
    s.src = '/shared/sterren.js'; s.async = true;
    s.onload = function () { hemelLaadt = false; hemelMaat = ''; hangHemel(); };
    /* Een tijdelijk afgebroken statische aanvraag mag de hemel niet voor de
       hele sessie uitschakelen. Geef de begrensde bestaande herprobeerlus de
       kans opnieuw te laden; verwijder eerst het mislukte script-element. */
    s.onerror = function () {
      hemelLaadt = false; hemelMaat = '';
      if (s.parentNode) s.parentNode.removeChild(s);
      hemelStraks();
    };
    (d.head || d.documentElement).appendChild(s);
    return true;
  }

  function bouwGrond() {
    if (grond.cv) return;
    var cv = d.createElement('canvas');
    cv.className = 'os-wereld-grond';
    cv.setAttribute('aria-hidden', 'true');
    el.scherm.insertBefore(cv, el.scherm.firstChild);
    grond.cv = cv;
    grond.ctx = cv.getContext && cv.getContext('2d');
    el.grond = cv;
    /* DE MAAT VOLGT HET ELEMENT, NIET EEN MOMENT.

       Hier stond een eenmalige meting plus een resize-listener, en dat is een
       klassieke halve maatregel: op het moment dat het canvas wordt aangemaakt
       heeft de indeling nog niet gedraaid, dus clientWidth is 0 en het canvas
       werd 2 bij 2 pixels. Daarna kwam er geen resize meer -- het venster
       veranderde immers niet -- en bleef het zo. Gemeten: nul getekende pixels,
       een achtergrond die er wel was en niets deed.

       Een waarnemer op het element zelf heeft dat probleem niet: hij vuurt
       zodra de indeling het canvas een maat geeft, en daarna bij elke wijziging
       (venster, toetsenbord dat opkomt, de wingpanelen die openschuiven). */
    try {
      if (w.ResizeObserver) { new w.ResizeObserver(grondMaat).observe(cv); }
      else w.addEventListener('resize', grondMaat);
    } catch (e) { try { w.addEventListener('resize', grondMaat); } catch (e2) {} }
    grondMaat();
    try { d.addEventListener('visibilitychange', function () { if (!d.hidden) grondStart(); }); } catch (e) {}
  }

  function grondMaat() {
    if (!grond.cv) return;
    var r = Math.min(2, w.devicePixelRatio || 1);
    var b = grond.cv.clientWidth, h = grond.cv.clientHeight;
    if (!b || !h) return;                 // nog geen indeling: dan ook niet meten
    var nb = Math.round(b * r), nh = Math.round(h * r);
    if (nb === grond.cv.width && nh === grond.cv.height) return;
    grond.cv.width = nb; grond.cv.height = nh;
    grondFrame();
  }

  // welk motief hoort bij de wereld waar je staat? Ingezoomd blijft het motief
  // van de wereld staan -- je bent er nog steeds, alleen dieper.
  function grondKies() {
    var sleutel = st.diep
      ? (st.werelden[st.wereldIdx] || {}).sleutel
      : ((huidige() || {}).sleutel);
    grond.motief = MOTIEVEN[sleutel] || MOTIEVEN['map-reizen'];
    grondFrame();
  }

  function beweegFactor() {
    if (RUSTIG) return 0;
    try { if (w.RTGBeweging && w.RTGBeweging.factor) return w.RTGBeweging.factor(); } catch (e) {}
    return 0.6;
  }

  /* Afgesplitst van wereld-05.js, dat over de 10 KB ging. De snede loopt
     langs een echte grens: hierboven staat de BEDRADING van de grond (het
     doek, zijn maat, welke wereld aan de beurt is, de lus), hieronder het
     LICHT zelf -- welke gloeden een wereld heeft en hoe je er een tekent.
     Wie de sfeer van een wereld wil bijstellen, hoeft alleen hier te zijn. */
  /* ELKE WERELD IS EEN LICHT, GEEN TEKENING.

     Hier stonden domeinspecifieke LIJNTEKENINGEN: golfjes, een skyline van rechthoekjes,
     een raster bolletjes. Naast de inlogpoort -- een diepe sterrenhemel met een
     ademende dagkleur -- zag dat er precies uit als wat het was: draadwerk op
     een vlakke ondergrond. Een luxemerk tekent geen diagram op de achtergrond.

     Wat er nu staat is licht: twee tot vier grote, zachte gloeden die heel
     langzaam over de grond drijven. Per wereld verschillen hun plek, hun kleur
     en hun ritme -- Reizen ademt breed en traag als een horizon, Geld staat
     strak en rechtop, Media flakkert als een stad. Je ziet geen vorm die je kunt
     benoemen; je merkt dat het ergens anders naar rúikt. Dat is het verschil
     tussen sfeer en illustratie.

     De sterren komen niet van hier maar van shared/sterren.js -- hetzelfde
     firmament als op de inlogpoort, met dezelfde sterrenbeelden op dezelfde
     plek. Een tweede sterrenhemel naast die van de poort zou twee hemels zijn
     die uit elkaar lopen. */
  var TINT = { goud: [201, 162, 75], wijn: [194, 58, 94], parel: [237, 231, 218], koel: [120, 150, 190] };

  /* Per wereld: welke gloeden, waar ze hangen (in eenheden van het scherm),
     hoe groot, welke tint, en hoe snel ze ademen. Meer dan vier is geen sfeer
     meer maar een lavalamp. */
  var MOTIEVEN = {
    // Reizen: een brede, lage horizon die traag op en neer gaat
    'map-reizen': [[0.5, 0.16, 0.95, TINT.koel, 0.35], [0.22, 0.72, 0.75, TINT.goud, 0.22], [0.85, 0.55, 0.6, TINT.parel, 0.28]],
    // Geld: rechtop en beheerst, twee kolommen licht die nauwelijks bewegen
    'map-geld': [[0.28, 0.3, 0.6, TINT.goud, 0.12], [0.74, 0.62, 0.66, TINT.goud, 0.16], [0.5, 0.95, 0.8, TINT.parel, 0.1]],
    // Sociaal: warm, dicht bij elkaar, alsof er mensen staan
    'map-salon': [[0.32, 0.42, 0.62, TINT.wijn, 0.4], [0.62, 0.3, 0.55, TINT.goud, 0.34], [0.5, 0.82, 0.7, TINT.wijn, 0.26]],
    // Leven: een haard -- een midden dat rustig doorademt
    'map-huis': [[0.5, 0.5, 0.9, TINT.goud, 0.2], [0.5, 0.9, 0.7, TINT.wijn, 0.15]],
    // Media: een stad die aanstaat, met een snellere flakker
    'map-media': [[0.18, 0.62, 0.6, TINT.wijn, 0.8], [0.5, 0.35, 0.5, TINT.koel, 0.95], [0.82, 0.7, 0.62, TINT.goud, 0.7]],
    // Kantoor: hoog en koel, licht dat van boven binnenvalt
    'map-werk': [[0.5, 0.02, 1.05, TINT.koel, 0.14], [0.2, 0.5, 0.5, TINT.parel, 0.18], [0.8, 0.45, 0.5, TINT.parel, 0.18]],
    // Veilig: een enkele rustige wacht, gelijkmatig en zonder haast
    'map-veilig': [[0.5, 0.42, 1.0, TINT.koel, 0.1], [0.5, 0.98, 0.6, TINT.parel, 0.12]],
    // RTFoundation: organisch, twee gloeden die om elkaar heen bewegen
    'map-rtf': [[0.35, 0.55, 0.8, TINT.goud, 0.3], [0.68, 0.38, 0.7, TINT.parel, 0.24], [0.5, 0.9, 0.75, TINT.goud, 0.18]]
  };

  function grondFrame() {
    if (!grond.ctx || !grond.motief) return;
    var cv = grond.cv, ctx = grond.ctx;
    var W = cv.width, H = cv.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    /* Bij elkaar optellen in plaats van overschilderen: waar twee gloeden
       elkaar raken wordt het licht sterker, zoals licht zich gedraagt. Met de
       gewone tekenstand krijg je randen waar de een over de ander valt, en dan
       zie je de vorm van de gloed -- precies wat hier niet mag. */
    ctx.globalCompositeOperation = 'lighter';
    /* De dekking is laag EN hangt aan de schuif: wie Beweging op stil zet, wil
       geen bewegingloze-maar-wel-opvallende achtergrond, hij wil rust. */
    var kracht = 0.05 + 0.045 * Math.min(1, beweegFactor());
    var maat = Math.max(W, H);
    try {
      for (var i = 0; i < grond.motief.length; i++) gloed(ctx, W, H, maat, grond.motief[i], i, kracht);
      // binnen een wereld sta je ergens: dan komt de horizon erbij
      horizon(ctx, W, H, grond.t);
    } catch (e) { /* een motief mag het scherm nooit kosten */ }
    ctx.restore();
  }

  /* EEN gloed: een grote, zachte lichtbel die heel langzaam ademt en drijft.
     De beweging is bewust klein (een paar procent van het scherm) -- je hoort
     het niet te ZIEN bewegen, je hoort het pas te merken als je terugkomt.

     De stop van de verloop loopt naar volledig doorzichtig in drie stappen en
     niet in een; met een enkele stap krijg je een zichtbare rand waar de bel
     ophoudt, en dan is het geen gloed meer maar een cirkel. */
  function gloed(c, W, H, maat, m, i, kracht) {
    var x = m[0], y = m[1], grootte = m[2], tint = m[3], tempo = m[4];
    var f = grond.t * tempo;
    var px = W * (x + Math.sin(f + i * 1.7) * 0.035);
    var py = H * (y + Math.cos(f * 0.8 + i * 2.3) * 0.03);
    var r = maat * grootte * (0.55 + 0.05 * Math.sin(f * 1.3 + i));
    var adem = 0.75 + 0.25 * Math.sin(f * 1.1 + i * 0.9);
    var a = kracht * adem;
    var kleur = function (deel) {
      return 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + (a * deel).toFixed(4) + ')';
    };
    var g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, kleur(1));
    g.addColorStop(0.35, kleur(0.45));
    g.addColorStop(0.7, kleur(0.12));
    g.addColorStop(1, 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function grondStart() {
    if (grond.tik || !st.aan) return;
    if (beweegFactor() === 0) { grondFrame(); return; }   // stil: EEN beeld, geen lus
    var stap = function (nu) {
      grond.tik = null;
      if (!st.aan || d.hidden || beweegFactor() === 0) return;
      // ~20 beelden per seconde is voor deze traagheid ruim genoeg, en scheelt
      // twee derde van het werk tegenover een volle rAF-lus
      if (nu - grond.laatst > 48) {
        grond.laatst = nu;
        grond.t += 0.006 * beweegFactor();
        grondFrame();
      }
      grond.tik = w.requestAnimationFrame(stap);
    };
    grond.tik = w.requestAnimationFrame(stap);
  }
  function grondStop() { if (grond.tik) { w.cancelAnimationFrame(grond.tik); grond.tik = null; } }

  /* ---------- de momenten van vandaag, op de wijzerplaat ----------

     De klok droeg werelden. Nu draagt hij ook TIJD -- en dat is waar hij als
     enige element goed in is: 09:30, 14:00, 19:00 staan op de plek waar ze
     horen te staan, en je tikt ze aan om te zien wat er dan is.

     ZE DRAAIEN NIET MEE, en dat is de hele reden dat ze een eigen laag hebben.
     De bezel met werelden draait als je reist; een tijdstip dat meedraait is
     geen tijdstip meer maar een versiering. Ze liggen daarom in een laag die
     nooit roteert, tussen de wijzerplaat (straal 31) en de wereldmerken
     (36 tot 46) in -- op straal 34, waar ze allebei niet raken.

     ER WORDT HIER NIETS VERZONNEN. De momenten komen uit /agenda/mijn, dezelfde
     bron als het dagprogramma bij je reis (app-main-45.js). Heeft een lid
     vandaag niets, dan staan er GEEN stipjes -- geen lege ring met streepjes om
     te suggereren dat er een dag is. Dat is dezelfde regel als bij de stand:
     wat niet gemeten kan worden, wordt niet getoond (CANVAS.md). */
  var momenten = [];        // [{tijd:'14:00', uur, min, titel, sub}]
  var momentOpen = null;

  /* Een tijd op de wijzerplaat is een hoek op een twaalfuursverdeling: elk uur
     dertig graden, elke minuut een halve. 14:00 landt dus op twee uur, precies
     waar de wijzer zou staan. */
  function momentHoek(uur, min) { return (uur % 12) * 30 + min * 0.5; }

  function bouwMomenten() {
    if (el.momenten || !el.kring) return;
    var laag = d.createElement('div');
    laag.className = 'os-momenten';
    laag.id = 'osMomenten';
    // tussen de klok en de merken in: de klok mag hem niet afdekken
    el.kring.appendChild(laag);
    el.momenten = laag;

    var kaart = d.createElement('div');
    kaart.className = 'os-moment-kaart';
    kaart.id = 'osMomentKaart';
    kaart.setAttribute('role', 'status');
    kaart.setAttribute('aria-live', 'polite');
    kaart.hidden = true;
    el.kring.appendChild(kaart);
    el.momentKaart = kaart;
  }

  /* De momenten (opnieuw) aanreiken. Zelfde vorm als werelden(): de aanroeper
     haalt ze op en deze laag tekent ze. Verandert er niets, dan gebeurt er
     niets -- anders knippert de ring bij elke ronde. */
  var vorigeMomenten = null;
  function zetMomenten(lijst) {
    lijst = (lijst || []).filter(function (m) { return m && typeof m.uur === 'number'; });
    var vinger = lijst.map(function (m) { return m.uur + ':' + m.min + '~' + m.titel; }).join('|');
    if (vinger === vorigeMomenten) return;
    vorigeMomenten = vinger;
    momenten = lijst;
    if (st.aan) tekenMomenten();
  }

  function tekenMomenten() {
    if (!el.momenten) return;
    el.momenten.textContent = '';
    sluitMoment();
    /* Ingezoomd in een wereld hoort de klok bij DIE wereld; de dag van vandaag
       eroverheen zou twee verhalen door elkaar zijn. */
    if (st.diep || !momenten.length) return;
    momenten.forEach(function (m, i) {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'os-moment';
      b.dataset.i = String(i);
      b.setAttribute('aria-label', m.tijd + ' ' + m.titel);
      var a = (momentHoek(m.uur, m.min) - 90) * Math.PI / 180;
      b.style.left = (50 + 34 * Math.cos(a)).toFixed(3) + '%';
      b.style.top = (50 + 34 * Math.sin(a)).toFixed(3) + '%';
      b.innerHTML = '<i></i><span>' + m.tijd + '</span>';
      b.addEventListener('click', function (ev) {
        ev.stopPropagation();
        if (st.gesleept) return;
        openMoment(Number(b.dataset.i));
      });
      el.momenten.appendChild(b);
    });
  }

  /* ---------- de klok WORDT dat moment ----------
     Niet een popup ernaast maar de wijzerplaat zelf: de klok zakt weg en het
     moment staat in dezelfde cirkel. Zo blijf je op je plek -- je hebt niets
     geopend, je kijkt naar een ander uur van dezelfde dag. */
  function openMoment(i) {
    var m = momenten[i];
    if (!m || !el.momentKaart) return;
    momentOpen = i;
    el.momentKaart.innerHTML =
      '<b class="os-moment-tijd">' + esc(m.tijd) + '</b>' +
      '<span class="os-moment-titel">' + esc(m.titel) + '</span>' +
      (m.sub ? '<span class="os-moment-sub">' + esc(m.sub) + '</span>' : '');
    el.momentKaart.hidden = false;
    el.kring.setAttribute('data-moment', 'ja');
    for (var j = 0; j < el.momenten.children.length; j++) {
      el.momenten.children[j].dataset.actief = (j === i ? 'ja' : 'nee');
    }
    if (el.kern) el.kern.setAttribute('aria-label', 'Terug naar de klok');
  }

  function sluitMoment() {
    momentOpen = null;
    if (el.momentKaart) el.momentKaart.hidden = true;
    if (el.kring) el.kring.setAttribute('data-moment', 'nee');
    if (el.momenten) {
      for (var j = 0; j < el.momenten.children.length; j++) el.momenten.children[j].dataset.actief = 'nee';
    }
    kernLabel();
  }
  function momentStaatOpen() { return momentOpen != null; }

  // tekst uit de agenda is tekst en geen opmaak: hij komt van buiten
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* ---------- Rahul kent je ritme ----------

     "Normaal open je om deze tijd RTG Kantoor." Dat is een van de mooiste
     zinnen uit het ontwerp en tegelijk de gevaarlijkste, want er zit gedrag van
     een mens onder. Vier grenzen daarom, en ze staan hier omdat een grens die
     alleen in een document staat over drie maanden weg is:

     1. HET BLIJFT OP HET TOESTEL. De telling woont in localStorage, naast de
        gebruiksteller die het OS al had (rtg_os_gebruik_*). Er gaat niets over
        dit lid naar de server -- niet zijn ritme, niet zijn uren, niets. Dat is
        dezelfde regel als de codenamen: wat je niet verstuurt, kan ook niet
        uitlekken.

     2. HET OPENT, HET STUURT NIET. Er is geen badge, geen teller, geen "je hebt
        dit al drie dagen niet gedaan", geen streak. Het is een aanbod dat je
        kunt negeren, en negeren kost niets. CLAUDE.md verbiedt verslavende
        patronen, en een ritme dat je eraan HERINNERT dat je iets normaal doet,
        is precies zo'n patroon.

     3. PAS ALS HET ECHT EEN PATROON IS. Een keer om tien uur Kantoor openen is
        geen ritme. Er moet een duidelijke koploper zijn in dit uur, en die moet
        het vaak genoeg gedaan hebben (DREMPEL). Tot die tijd zegt hij niets --
        liever stil dan een gok die als inzicht klinkt.

     4. HIJ BELOOFT NIETS WAT HIJ NIET DOET. Het ontwerp zei "Ik heb het alvast
        voorbereid". Dat zou hier een leugen zijn: er wordt niets voorbereid.
        Wat hij WEL kan, doet hij ook echt -- de ring zet klaar wat je normaal
        opent, en tikken draait je er meteen heen. */
  var ritme = null;         // { sleutel, naam } of null
  var ritmeWeg = false;     // vandaag weggetikt? dan zwijgt hij

  function heeftRitme() { return !!ritme && !ritmeWeg; }

  function zetRitme(v) {
    ritme = (v && v.sleutel && v.naam) ? v : null;
    toonRitme();
  }

  /* De ring van Rahul draagt hoogstens EEN ding. Wat hij zelf te melden heeft
     gaat voor: dat is nieuws, en dit is een gewoonte. Zegt hij niets, dan mag
     het ritme de ring hebben. */
  function toonRitme() {
    if (!st.aan || !el.rahul || !ritme || ritmeWeg) return;
    /* Zijn NIEUWS gaat voor -- dat is nieuws, dit is een gewoonte. Zijn lege zin
       komt hier nooit terecht (zie rahulZei), dus als de ring bezet is door
       'rahul' staat er echt iets in. */
    if (el.rahul.getAttribute('data-soort') === 'rahul' &&
        el.rahul.getAttribute('data-toon') === 'ja') return;
    if (draadStaatOpen()) return;
    el.rahul.querySelector('span').textContent = 'Normaal open je nu ' + ritme.naam;
    el.rahul.setAttribute('data-soort', 'ritme');
    el.rahul.setAttribute('data-toon', 'ja');
  }

  /* Tikken draait de bezel naar die wereld -- en opent hem NIET. Het verschil
     is de hele afspraak: hij zet klaar, jij besluit. Meteen openen zou van een
     aanbod een handeling maken die je niet hebt gedaan. */
  function ritmeVolg() {
    if (!ritme) return;
    var i = -1;
    for (var j = 0; j < st.werelden.length; j++) {
      if (st.werelden[j].sleutel === ritme.sleutel) { i = j; break; }
    }
    ritmeSluit();
    if (i >= 0) { if (st.diep) zoom(false); naar(i); }
  }

  /* Weggetikt is weg, voor vandaag. Niet voor altijd -- morgen is het weer een
     nieuwe dag en misschien klopt het dan wel. Maar hem dezelfde dag opnieuw
     laten opkomen is zeuren, en dat is precies wat grens 2 verbiedt. */
  function ritmeSluit() {
    ritmeWeg = true;
    if (el.rahul) {
      el.rahul.setAttribute('data-toon', 'nee');
      el.rahul.setAttribute('data-soort', 'rahul');
    }
  }

  /* ---------- planeten, en de vlucht ernaartoe ----------

     Het ontwerp vroeg om werelden als planeten die om de klok draaien, en om
     inzoomen dat voelt als vliegen in plaats van openen. Allebei zijn ze hier
     gebouwd, maar niet zoals ze op papier stonden -- en dat verschil is een
     besluit dat uitleg verdient.

     WAT ER NIET GEBEURT: de merken gaan niet vrij in banen om de klok draaien.
     Een bezel leest zijn stand af aan een VAST punt (de gouden index op twaalf
     uur); merken die elk hun eigen baan hebben, hebben geen stand meer, en dan
     is het geen horloge maar een mobiel. Dat zou ook de meting breken die
     bewaakt dat ze op EEN cirkel liggen -- en die meting bewaakt een echte
     fout, geen smaak.

     WAT ER WEL GEBEURT, en wat het idee eigenlijk vraagt:

     1. Elke wereld krijgt zijn EIGEN LICHT. De merken waren identieke grijze
        schijven; nu draagt elk de tint van zijn eigen wereld
        (dezelfde tint als zijn gloed op de grond, uit MOTIEVEN). Daardoor lees
        je de ring als een stelsel van lichamen in plaats van als een rij
        knoppen -- en je herkent een wereld aan zijn kleur voordat je de glyf
        leest.

     2. Inzoomen is een VLUCHT. De andere werelden schieten naar buiten weg
        alsof je er langs komt, en pas als ze weg zijn staan de onderdelen er.
        Uitzoomen is dezelfde beweging terug. Het is een overgang en geen tweede
        scherm: er komt geen stand bij, alleen tijd tussen twee standen.

     3. Binnen een wereld krijgt de grond een HORIZON die meeschuift als je
        draait. Dat is wat "een stad" hier kan betekenen zonder er een te
        tekenen: je merkt dat je je ergens doorheen beweegt in plaats van door
        een lijst te bladeren. */

  // de tint van een wereld: dezelfde als zijn gloed, uit de tabel in deel 5b
  function wereldTint(sleutel) {
    var m = MOTIEVEN[sleutel];
    return (m && m[0] && m[0][3]) || TINT.goud;
  }

  /* Het licht van een merk. Staat als custom property op de knop zelf, zodat
     het blad hem kan gebruiken zonder dat hier kleuren worden geschilderd --
     schilderen doet de CSS, hier staat alleen WELKE. */
  function merkLicht(b, item) {
    if (!item || !item.sleutel) return;
    var t = wereldTint(item.sleutel);
    if (!t) return;
    b.style.setProperty('--planeet', t[0] + ',' + t[1] + ',' + t[2]);
  }

  /* ---------- de vlucht ----------
     Twee stappen met een pauze ertussen: eerst wegschieten, dan pas de nieuwe
     ring. Zonder die pauze wisselt de inhoud terwijl de oude nog in beeld is,
     en dan is het geen vlucht maar een flikkering.

     Bewegingsarm slaat de vlucht over. Wie geen beweging wil, wil hem ook hier
     niet -- en de FUNCTIE (je staat in de wereld) is dezelfde. */
  var VLUCHT_MS = 300;
  var vluchtBezig = null;

  function vlieg(naarBinnen, klaar) {
    if (!el.kring) { klaar(); return; }
    if (RUSTIG || sleepStil()) { klaar(); return; }
    if (vluchtBezig) { w.clearTimeout(vluchtBezig); vluchtBezig = null; }
    el.kring.setAttribute('data-vlucht', naarBinnen ? 'in' : 'uit');
    vluchtBezig = w.setTimeout(function () {
      vluchtBezig = null;
      klaar();
      /* Het attribuut moet ER NOG STAAN als de nieuwe merken worden gemaakt,
         anders beginnen ze niet aan de rand maar staan ze er meteen. Een frame
         later halen we hem weg; dan speelt de terugkomst. */
      w.requestAnimationFrame(function () {
        w.requestAnimationFrame(function () {
          if (el.kring) el.kring.setAttribute('data-vlucht', 'nee');
        });
      });
    }, VLUCHT_MS);
  }

  /* ---------- de horizon binnen een wereld ----------
     Een band onderin die met de ring meeschuift. Hij is er alleen als je IN een
     wereld staat: buiten kijk je naar het stelsel, binnen sta je ergens. */
  function horizon(c, W, H, t) {
    if (!st.diep) return;
    var tint = wereldTint((st.werelden[st.wereldIdx] || {}).sleutel);
    var schuif = (st.hoek / 360) * W * 0.5;
    var basis = H * 0.78;
    c.save();
    c.globalCompositeOperation = 'lighter';
    /* Drie lagen op verschillende diepte, zodat de dichtstbije het hardst
       meeschuift. Dat is wat je van een plek verwacht als je erlangs beweegt --
       en het is hetzelfde parallax-idee als bij de sterren, alleen dichterbij. */
    for (var laag = 0; laag < 3; laag++) {
      var diep = 0.35 + laag * 0.32;
      var hoogte = H * (0.05 + laag * 0.022);
      var a = (0.05 - laag * 0.012) * (0.6 + 0.4 * Math.sin(t * 0.4 + laag));
      c.fillStyle = 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + a.toFixed(4) + ')';
      c.beginPath();
      c.moveTo(0, H);
      for (var x = 0; x <= W; x += W / 24) {
        var u = (x + schuif * diep) / W;
        var y = basis + laag * H * 0.03 - hoogte * (0.5 + 0.5 * Math.sin(u * 6.28 * 1.5 + laag * 2.1));
        c.lineTo(x, y);
      }
      c.lineTo(W, H);
      c.closePath();
      c.fill();
    }
    c.restore();
  }

  /* ---------- aanzetten, uitzetten ----------
     ER ZIJN GEEN TWEE BEGINSCHERMEN. Dat is de belangrijkste regel van dit
     blok, en de reden dat het zo weinig doet: omschakelen verplaatst de KLOK en
     zet een attribuut. De passregel, de balk van Rahul, de draad, de klok en de
     lijst werelden zijn in beide standen letterlijk dezelfde onderdelen. Wie
     hier ooit een tweede opbouw naast zet, krijgt twee schermen die langzaam
     uit elkaar lopen -- precies wat LAT.md regel 4 verbiedt.

     Vandaar ook dat de rasterstand hier niets hoeft te herstellen behalve de
     klok: hij is nooit weg geweest, hij stond alleen onder display:none. */
  var SLEUTEL = 'rtg_os_wereld';

  function bewaard() {
    try {
      var v = localStorage.getItem(SLEUTEL);
      if (v === 'aan' || v === 'uit') return v;
    } catch (e) {}
    return null;
  }

  function zet(aan, bewaren) {
    if (!el.vak || !el.scherm) return;
    st.aan = !!aan;
    if (bewaren !== false) { try { localStorage.setItem(SLEUTEL, st.aan ? 'aan' : 'uit'); } catch (e) {} }
    el.scherm.setAttribute('data-os-wereld', st.aan ? 'aan' : 'uit');

    if (st.aan) {
      /* DEZELFDE GROND ALS DE POORT. data-inlogkleur is geen versiering maar een
         koppeling: shared/inlogkleur.js verft elk vlak dat hem draagt met de
         levende dagkleur -- de boog van de dag, het seizoen, de dag van het
         jaar. De inlogpoort draagt hem al. Zet je hem hier ook op, dan loop je
         letterlijk dezelfde lucht binnen als waar je onder inlogde, en blijft
         het EEN kleur die op EEN plek wordt uitgerekend.
         In de rasterstand gaat hij er weer af: daar hoort de wallpaper die het
         lid zelf koos (os-wall-*) het te winnen. */
      el.scherm.setAttribute('data-inlogkleur', '');
      if (w.Inlogkleur && w.Inlogkleur.verf) { try { w.Inlogkleur.verf(); } catch (e) {} }
      bouwKring(); bouwNaam(); bouwKern(); bouwMomenten(); bouwWiel(); bouwRahul(); bouwHemel(); bouwGrond();
      if (!gebonden) { bindSleep(); bindToetsen(); gebonden = true; }
      el.kring.hidden = false;
      el.naam.hidden = false; el.sub.hidden = false;
      if (el.grond) el.grond.hidden = false;
      if (el.klok && el.klok.parentNode !== el.kring) el.kring.appendChild(el.klok);
      vulRing(); tekenMomenten(); toonNaam(); kernLabel(); grondKies(); grondMaat(); grondStart();
      toonRitme();
    } else {
      wiel(false);
      grondStop();
      /* DE STERRENHEMEL BLIJFT, OOK IN DE RASTERSTAND.
         Hij hoort bij het BEGINSCHERM en niet bij de wereldstand: je logt in
         onder een hemel, dus je hoort er ook onder thuis te komen -- of je nu
         naar een kring of naar een rooster met tegels kijkt. Wat wel weggaat is
         de gloed van de wereld (die hoort bij een wereld die je hier niet ziet)
         en de dagkleur, want in de rasterstand hoort de achtergrond die het lid
         zelf koos (os-wall-*) te winnen. */
      bouwHemel();
      el.scherm.removeAttribute('data-inlogkleur');
      if (el.klok && el.vak && el.klok.parentNode !== el.vak) el.vak.appendChild(el.klok);
      if (el.kring) el.kring.hidden = true;
      if (el.naam) el.naam.hidden = true;
      if (el.sub) el.sub.hidden = true;
      if (el.rahul) el.rahul.setAttribute('data-toon', 'nee');
      if (el.grond) el.grond.hidden = true;
    }
    try { w.dispatchEvent(new Event('rtg-wereld')); } catch (e) {}
  }
  var gebonden = false;

  /* ---------- de aanroeper reikt de wereld aan ----------
     Alles wat deze module NIET zelf mag weten komt hier binnen: welke werelden
     er zijn (uit MAPPEN), hoe je er een opent, hoe je een onderdeel opent, en
     hoe je iets in de balk van Rahul zet.

     WAAROM DIT IN TWEE STAPPEN GAAT. start() bedraadt, werelden() vult. Bij het
     laden van de pagina IS de lijst namelijk nog leeg: welke onderdelen jouw
     pas draagt hangt aan je boardroom-instellingen, en die komen van de server.
     De tegels hebben dat probleem ook, en lossen het al op -- bouw() tekent ze
     opnieuw zodra er iets verandert. De ring hangt daarom aan diezelfde
     bouw(), en niet aan een eigen moment: twee lijsten die op verschillende
     momenten worden bijgewerkt, zijn twee lijsten die uit elkaar lopen.

     Dit is precies de fout die deze opmerking documenteert: de eerste versie
     vulde de ring bij het laden, kreeg nul zichtbare onderdelen terug en toonde
     een leeg beginscherm. */
  function start(o) {
    if (!o || !o.vak || !o.scherm || !o.klok) return false;
    el.vak = o.vak; el.scherm = o.scherm; el.klok = o.klok;
    api.openUrl = o.openUrl || null;
    api.openDeel = o.openDeel || null;
    api.zegRahul = o.zegRahul || null;

    // de schuif Beweging raakt zowel de grond als het draaien
    try {
      w.addEventListener('rtg-beweging', function () {
        if (!st.aan) return;
        if (beweegFactor() === 0) { grondStop(); grondFrame(); } else grondStart();
      });
    } catch (e) {}

    /* Zelf beginnen te typen is ook "laat dat gesprek maar zien". Zonder dit
       zou je een vraag stellen en je eigen zin nergens terugzien -- alleen het
       antwoord, in de ring. Dat leest als een AI die je niet gehoord heeft. */
    var balk = d.getElementById('osAiBalk');
    if (balk) balk.addEventListener('submit', draadOpen);

    werelden(o.werelden || []);
    return true;
  }

  /* De lijst werelden (opnieuw) aanreiken. Wordt bij elke bouw() aangeroepen,
     dus meestal verandert er niets -- en dan hoort er ook niets te gebeuren.
     Zonder deze vergelijking bouwt de ring zichzelf een paar keer per seconde
     opnieuw op en springt hij terug naar de eerste wereld, precies terwijl je
     eraan draait. */
  var vorigeLijst = null, begonnen = false;
  function werelden(lijst) {
    if (!el.vak) return;
    lijst = lijst || [];
    var vinger = lijst.map(function (x) {
      return x.sleutel + '~' + x.naam + '~' + (x.delen || []).length;
    }).join('|');
    if (vinger === vorigeLijst) return;
    vorigeLijst = vinger;
    st.werelden = lijst;

    // een wereld die verdwijnt (uitgezet in de boardroom) mag de ring niet op
    // een stand laten staan die niet meer bestaat
    if (st.actief >= lijst.length) { st.actief = 0; st.hoek = 0; st.doel = 0; }
    if (st.wereldIdx >= lijst.length) { st.wereldIdx = 0; st.diep = false; }

    if (!lijst.length) return;
    if (!begonnen) {
      begonnen = true;
      /* DE STANDAARD IS DE LEVENDE WERELD. Dat is een besluit en geen toeval:
         het beginscherm HOORT dit te zijn, en de schakelaar bestaat om terug te
         kunnen, niet om het aan te moeten zetten. Wie ooit terugschakelt, houdt
         die keuze -- vandaar dat bewaard() voorrang heeft. */
      var stand0 = bewaard();
      zet(stand0 ? stand0 === 'aan' : true, false);
      return;
    }
    if (st.aan) { vulRing(); toonNaam(); kernLabel(); grondKies(); }
  }

  /* Wat er nu op het scherm staat, als leesbaar feit. Dit bestaat voor de
     toetsen: een e2e-toets die de stand uit pixels moet afleiden meet vooral
     zijn eigen aannames, en zakt op de verkeerde momenten. */
  function stand() {
    var it = huidige();
    return {
      aan: st.aan,
      diep: st.diep,
      actief: st.actief,
      naam: (it && it.naam) || null,
      wereld: st.diep ? (st.werelden[st.wereldIdx] || {}).naam || null : (it && it.naam) || null,
      merken: st.merken.length,
      momenten: momenten.length,
      moment: momentStaatOpen(),
      wiel: wielOpen()
    };
  }

  w.RTGWereld = {
    start: start,
    werelden: werelden,
    zet: function (aan) { zet(!!aan, true); },
    aan: function () { return st.aan; },
    naar: naar,
    zoom: zoom,
    wiel: wiel,
    rahulZei: rahulZei,
    momenten: zetMomenten,
    ritme: zetRitme,
    stand: stand
  };
})(window);

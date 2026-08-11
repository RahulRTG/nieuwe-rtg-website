/* DE LEVENDE WERELD -- het beginscherm als ruimte in plaats van een rooster.

   WAAROM DIT BESTAAT. Het beginscherm toonde acht tegels boven een klok. Dat
   werkt, en het is volstrekt inwisselbaar: elk toestel ter wereld opent met een
   rooster met icoontjes, dus het rooster zegt niets over wie dit huis is. Wat
   wel eigen is, stond er al -- de klok. Die is hier geen widget meer maar de
   KERN: de acht werelden hangen als merken op een bezel om hem heen, je DRAAIT
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

  /* De acht standen op de bezel. Ze staan hier als HOEK en niet als lijst
     werelden: hoeveel werelden er zijn bepaalt de aanroeper, en de ring rekent
     zijn verdeling daaruit uit. Zet iemand er ooit een negende bij, dan klopt
     de bezel vanzelf -- dat is het verschil tussen een verdeling en acht
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
    kern: null, naam: null, sub: null, wiel: null, rahul: null, grond: null };

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
       zien: de haarlijn stond op precies 41 (dus midden door alle acht de
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
    b.setAttribute('aria-label', item.naam);
    var teken = item.teken && item.teken();
    if (teken) b.appendChild(teken);
    else {
      var mono = d.createElement('span');
      mono.textContent = item.naam.replace(/^RTG /, '').slice(0, 2);
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

     Ze worden hier GETEKEND naar het aantal standen en niet als vaste acht
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
      else if (ev.key === 'Escape') { if (wielOpen()) wiel(false); else if (st.diep) zoom(false); }
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
    r.innerHTML = '<b aria-hidden="true"></b><span></span>';
    r.addEventListener('click', function () {
      r.setAttribute('data-toon', 'nee');
      draadOpen();
    });
    // onder de naam, boven de balk van Rahul
    if (el.sub && el.sub.parentNode) el.sub.parentNode.insertBefore(r, el.sub.nextSibling);
    el.rahul = r;
  }

  function rahulZei(tekst) {
    if (!st.aan || !el.rahul || !tekst) return;
    // staat het gesprek al open, dan LEEST hij daar al mee; dan is de ring
    // erbij precies de dubbeling die hij hoort te voorkomen
    if (draadStaatOpen()) return;
    el.rahul.querySelector('span').textContent = String(tekst);
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
  var MOTIEVEN = {
    'map-reizen': golven,
    'map-geld': geometrie,
    'map-salon': verbindingen,
    'map-huis': ringen,
    'map-media': stadslichten,
    'map-werk': bouwlijnen,
    'map-veilig': raster,
    'map-rtf': organisch
  };
  var grond = { cv: null, ctx: null, motief: null, t: 0, laatst: 0, tik: null, kleur: '#C9A24B' };

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
    grond.motief = MOTIEVEN[sleutel] || golven;
    try {
      var g = getComputedStyle(d.documentElement).getPropertyValue('--gold').trim();
      if (g) grond.kleur = g;
    } catch (e) {}
    grondFrame();
  }

  function beweegFactor() {
    if (RUSTIG) return 0;
    try { if (w.RTGBeweging && w.RTGBeweging.factor) return w.RTGBeweging.factor(); } catch (e) {}
    return 0.6;
  }

  function grondFrame() {
    if (!grond.ctx || !grond.motief) return;
    var cv = grond.cv, ctx = grond.ctx;
    var W = cv.width, H = cv.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.strokeStyle = grond.kleur;
    ctx.fillStyle = grond.kleur;
    ctx.lineWidth = Math.max(1, W / 620);
    /* De dekking is laag EN hangt aan de schuif: wie Beweging op stil zet, wil
       geen bewegingloze-maar-wel-opvallende achtergrond, hij wil rust. */
    ctx.globalAlpha = 0.05 + 0.05 * Math.min(1, beweegFactor());
    try { grond.motief(ctx, W, H, grond.t); } catch (e) { /* een motief mag het scherm nooit kosten */ }
    ctx.restore();
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

  /* ---------- de acht motieven ----------
     Elk is een handvol lijnen. Ze hoeven niet mooi te zijn als je ernaar kijkt;
     ze horen te kloppen als je er NIET naar kijkt. */
  function golven(c, W, H, t) {                    // Reizen: water en afstand
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      for (var x = 0; x <= W; x += W / 60) {
        var y = H * (0.36 + i * 0.09) + Math.sin(x / (W / 5) + t + i * 0.7) * H * 0.022;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
  }
  function geometrie(c, W, H, t) {                 // Geld: orde, opbouw, ritme
    var n = 7, b = W / (n + 1);
    for (var i = 0; i < n; i++) {
      var h = H * (0.14 + 0.1 * ((i * 3 + 1) % 5)) * (1 + 0.06 * Math.sin(t + i));
      c.strokeRect(b * (i + 0.5), H * 0.72 - h, b * 0.5, h);
    }
  }
  function verbindingen(c, W, H, t) {              // Sociaal: mensen en lijnen
    var p = [];
    for (var i = 0; i < 9; i++) {
      p.push([W * (0.12 + 0.76 * ((i * 7) % 9) / 8) + Math.sin(t + i) * W * 0.012,
        H * (0.2 + 0.6 * ((i * 5) % 9) / 8) + Math.cos(t * 0.8 + i) * H * 0.012]);
    }
    for (var a = 0; a < p.length; a++) {
      c.beginPath(); c.arc(p[a][0], p[a][1], W / 300, 0, 6.284); c.fill();
      var b2 = p[(a + 2) % p.length];
      c.beginPath(); c.moveTo(p[a][0], p[a][1]); c.lineTo(b2[0], b2[1]); c.stroke();
    }
  }
  function ringen(c, W, H, t) {                    // Leven: een haard, van binnenuit
    for (var i = 0; i < 5; i++) {
      c.beginPath();
      c.arc(W / 2, H * 0.52, W * (0.1 + i * 0.11) * (1 + 0.02 * Math.sin(t + i)), 0, 6.284);
      c.stroke();
    }
  }
  function stadslichten(c, W, H, t) {              // Media: een stad die aanstaat
    for (var i = 0; i < 46; i++) {
      var x = W * ((i * 37) % 100) / 100, y = H * (0.3 + 0.62 * ((i * 53) % 100) / 100);
      var a = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i));
      c.save(); c.globalAlpha *= a;
      c.fillRect(x, y, W / 210, W / 210);
      c.restore();
    }
  }
  function bouwlijnen(c, W, H, t) {                // Kantoor: structuur en verdieping
    var v = 6;
    for (var i = 0; i <= v; i++) {
      var y = H * (0.2 + i * 0.1) + Math.sin(t * 0.5 + i) * 1.5;
      c.beginPath(); c.moveTo(W * 0.08, y); c.lineTo(W * 0.92, y); c.stroke();
    }
    for (var j = 0; j <= 4; j++) {
      var x2 = W * (0.08 + j * 0.21);
      c.beginPath(); c.moveTo(x2, H * 0.2); c.lineTo(x2, H * 0.8); c.stroke();
    }
  }
  function raster(c, W, H, t) {                    // Veilig: een rustige wacht
    var s = W / 9;
    for (var x = s / 2; x < W; x += s) {
      for (var y = s / 2; y < H; y += s) {
        var r = s * 0.13 * (1 + 0.25 * Math.sin(t * 1.2 + (x + y) / s));
        c.beginPath(); c.arc(x, y, r, 0, 6.284); c.stroke();
      }
    }
  }
  function organisch(c, W, H, t) {                 // RTFoundation: groei, geen raster
    for (var i = 0; i < 6; i++) {
      c.beginPath();
      for (var s2 = 0; s2 <= 1.001; s2 += 0.05) {
        var x = W * (0.1 + 0.8 * s2);
        var y = H * (0.5 + 0.26 * Math.sin(s2 * 3.1 + i * 1.05 + t * 0.7) * (1 - s2 * 0.45));
        if (s2 === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
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
      bouwKring(); bouwNaam(); bouwKern(); bouwWiel(); bouwRahul(); bouwGrond();
      if (!gebonden) { bindSleep(); bindToetsen(); gebonden = true; }
      el.kring.hidden = false;
      el.naam.hidden = false; el.sub.hidden = false;
      if (el.grond) el.grond.hidden = false;
      if (el.klok && el.klok.parentNode !== el.kring) el.kring.appendChild(el.klok);
      vulRing(); toonNaam(); kernLabel(); grondKies(); grondMaat(); grondStart();
    } else {
      wiel(false);
      grondStop();
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
    stand: stand
  };
})(window);

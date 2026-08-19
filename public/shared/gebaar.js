/* RTG Gebaren -- deel 1: de kern, de tekens en het licht.

   WAT DEZE LAAG IS. Een regel in dit huis is een plank met twee laden eronder.
   Veeg naar links en de rechterlade komt tevoorschijn, veeg naar rechts en de
   linker. Veeg door en de eerste actie van die lade gebeurt. Houd vast, klik
   rechts of druk de menutoets en je krijgt dezelfde acties als lijst.

   WAAROM HIJ GEDEELD IS EN NIET PER SCHERM. Acht werelden die elk hun eigen
   veeg verzinnen, zijn acht bedieningen die net anders zijn -- en een gebaar dat
   per scherm iets anders betekent is erger dan geen gebaar (LAT.md regel 4). De
   drempel, de haptiek, de terugweg en de toetsenbordweg staan hier EEN keer.

   WAT EEN SCHERM ZELF DOET: zeggen WELKE acties een regel draagt. Niets meer.

     RTGGebaar.zet(rij, { titel:'Nieuw document', links:[...], rechts:[...] });
     RTGGebaar.lijst(container, '.reis', function (rij) { return {...}; });

   Een actie is { naam, teken, sig, doe, borg }. doe(rij) mag een functie
   teruggeven; dat is de TERUGWEG, en die verschijnt dan als terugdraai-melding.
   borg:true betekent: deze gaat nooit op een veeg, alleen op vasthouden.

   IN RUST DOET DEZE LAAG NIETS. Geen element erbij, geen stijl erover. Alles
   wordt gemaakt op het moment dat een hand of een toets erom vraagt, en weer
   opgeruimd als de lade dichtgaat. */
(function () {
  'use strict';
  if (window.RTGGebaar) return;

  var d = document;
  var rustig = function () {
    try {
      return matchMedia('(prefers-reduced-motion: reduce)').matches ||
        d.documentElement.classList.contains('rtg-stil');
    } catch (e) { return false; }
  };
  var en = function () {
    try {
      return (localStorage.getItem('rtg_lang') || d.documentElement.lang || 'nl').indexOf('en') === 0;
    } catch (e) { return false; }
  };
  /* Twee talen zonder een taaltabel op te tuigen: deze laag heeft acht woorden.
     Staat RTGi18n er wel, dan wint die -- de laag is geen tweede taalrail. */
  function T(sleutel, nl, eng) {
    if (window.RTGi18n && window.RTGi18n.t) return window.RTGi18n.t(sleutel, nl);
    return en() ? eng : nl;
  }

  /* Het blad hoort bij de laag en niet bij de pagina: een scherm dat gebaren
     wil, hoeft geen <link> te onthouden. Een keer, en alleen als hij er nog
     niet staat. */
  if (!d.querySelector('link[href="/shared/gebaar.css"]')) {
    var l = d.createElement('link');
    l.rel = 'stylesheet'; l.href = '/shared/gebaar.css';
    (d.head || d.documentElement).appendChild(l);
  }

  /* ------------------------------------------------------------- tekens --
     Eigen set, 24x24 grid, een lijndikte (ONTWERP.md par. 13). Ze staan hier en
     niet in shared/glyf.js omdat die set over APPS gaat (bellen, salon, wallet)
     en deze over HANDELINGEN. Twee sets met elk een eigen onderwerp is geen
     dubbeling; dezelfde handeling in twee sets tekenen zou dat wel zijn. */
  var TEKEN = {
    openen:   '<path d="M5 12h14M13 6l6 6-6 6"/>',
    kenmerk:  '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>',
    delen:    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>',
    uitstel:  '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gereed:   '<path d="M20 6L9 17l-5-5"/>',
    rahul:    '<path d="M12 3l2.1 5.4L19.5 10l-5.4 2.1L12 17.5 9.9 12.1 4.5 10l5.4-1.6z"/>',
    archief:  '<rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4"/>',
    ingrijp:  '<path d="M12 9v4M12 17h.01M10.3 3.9L2.4 17.5A2 2 0 0 0 4.1 20.5h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/>',
    meer:     '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>'
  };
  function svg(naam) {
    var p = TEKEN[naam] || TEKEN.openen;
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  }

  /* ---------------------------------------------------------- de kaartenbak --
     WeakMap en geen data-attribuut: een actie is een FUNCTIE, en die past niet
     in een attribuut zonder hem in een string te persen en later te evalueren.
     Weak, dus een rij die uit het scherm verdwijnt neemt zijn acties mee. */
  var boek = new WeakMap();
  var lijsten = [];   // {wortel, kiezer, bouwer}

  function actiesVan(rij) {
    if (boek.has(rij)) return boek.get(rij);
    for (var i = 0; i < lijsten.length; i++) {
      var s = lijsten[i];
      if (s.wortel.contains(rij) && rij.matches(s.kiezer)) {
        var a = normaliseer(s.bouwer(rij));
        if (a) boek.set(rij, a);
        return a;
      }
    }
    return null;
  }

  /* Een lade zonder acties is een lege lade, en die hoort niet open te gaan.
     Hier valt hij weg, en niet drie lagen dieper met een halve animatie. */
  function schoon(l) {
    return (l || []).filter(function (a) { return a && a.naam && typeof a.doe === 'function'; });
  }
  function normaliseer(a) {
    if (!a) return null;
    var links = schoon(a.links), rechts = schoon(a.rechts);
    if (!links.length && !rechts.length) return null;
    return { titel: a.titel || '', links: links, rechts: rechts };
  }

  /* De klasse moet er staan VOOR de eerste aanraking: touch-action wordt door de
     browser gelezen op het moment dat de vinger neerkomt, niet daarna. Een rij
     die zijn klasse pas bij pointerdown krijgt, veegt die ene keer dus niet --
     en dat is precies het soort fout dat je zelf nooit ziet omdat de tweede
     poging wel werkt. */
  function merk(wortel, kiezer) {
    var r = wortel.querySelectorAll(kiezer);
    for (var i = 0; i < r.length; i++) merkEen(r[i]);   // merkEen staat in deel 4
  }

  /* --------------------------------------------------- licht volgt de hand --
     MATERIAAL.md: licht is een eigenschap van het materiaal, geen effect. Onder
     een fijne aanwijzer weet het vlak waar de hand is, en het blad zet daar EEN
     lichtpunt neer -- geborsteld metaal heeft een richting, glitter heeft er
     tien. Dit is geen tweede truc naast de veeg maar dezelfde gedachte: het
     materiaal reageert op licht, of dat licht nu een vinger is of een muis.

     Een luisteraar op het document en niet honderd op de knoppen, gedempt op
     een animatieframe. Op een telefoon staat hij helemaal uit: daar hangt geen
     hand boven het glas, en dan is dit alleen batterij. */
  var fijn = false;
  try { fijn = matchMedia('(hover:hover) and (pointer:fine)').matches; } catch (e) {}
  if (fijn) {
    var wacht = false, laatst = null;
    d.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse' || rustig()) return;
      laatst = e;
      if (wacht) return;
      wacht = true;
      requestAnimationFrame(function () {
        wacht = false;
        var t = laatst && laatst.target;
        var el = t && t.closest && t.closest('.rtg-knop,.knop,.gb-rij');
        if (!el) return;
        var r = el.getBoundingClientRect();
        if (!r.width || !r.height) return;
        el.style.setProperty('--gb-lx', ((laatst.clientX - r.left) / r.width * 100).toFixed(1) + '%');
        el.style.setProperty('--gb-ly', ((laatst.clientY - r.top) / r.height * 100).toFixed(1) + '%');
      });
    }, { passive: true });
  }
/* Vervolg van gebaar-01: WAT ER ONDER EEN REGEL LIGT -- de lade zelf, het
   openen en sluiten, het uitvoeren en de weg terug. Hoe een hand daar bij komt
   staat in gebaar-02b. Alle delen zitten in EEN gesloten IIFE, dus wat in het
   ene deel staat is in het andere gewoon bekend.

   DE DRIE MATEN. Ze staan hier bij elkaar omdat ze samen bepalen hoe het VOELT,
   en dat is geen som van drie losse keuzes: een lade van 84 breed met een
   drempel op 40% veegt heel anders dan dezelfde lade met een drempel op 70%. */
  var KNOP = 84;        // px per actie -- ruim genoeg voor een woord in kapitalen
  var RICHTING = 8;     // px voordat we weten of dit een veeg of een scroll is
  var STIL = 6;         // px waarboven de klik erna wordt ingeslikt

  var g = null;         // het lopende gebaar
  /* De lade die openstaat. Hij heet BEWUST niet `open`: dat is de naam van
     window.open, en een gedeelde laag die die naam in zijn eigen scope
     wegneemt, zet een val voor de volgende die hier iets bijschrijft. */
  var openLade = null;
  /* DE KLIK NA DE VEEG, EN WAAROM DIT GEEN VLAG MET EEN TIMER IS.

     Hier stond `netGeveegd = true` met een setTimeout van 60 ms erachter. Dat
     leek onschuldig en was het niet, om twee redenen die pas in een echte
     browser zichtbaar werden:

     1. ZOLANG HIJ AAN STOND SLIKTE DE LAAG ELKE KLIK OP DE PAGINA -- ook een
        klik op de terugdraai-melding, die nergens in de buurt van de geveegde
        regel staat. Een laag die een gebaar afhandelt, hoort niets te doen met
        knoppen die er niets mee te maken hebben.
     2. EEN TIMER VAN 60 MS IS GEEN 60 MS. Een tabblad dat niet zichtbaar is,
        krijgt zijn timers vertraagd; gemeten in een schermtoets duurde die 60 ms
        ruim een seconde, en in dat gat verdween precies de klik die het gebaar
        moest kunnen terugdraaien. De toets zakte de ene keer wel en de andere
        keer niet -- het klassieke teken dat er tijd in de logica zit die er
        niet in hoort.

     Wat er nu staat is EENMALIG en gebonden aan de REGEL: precies de eerstvolgende
     klik, en alleen als hij op de geveegde regel valt. Geen tijd, geen gok. */
  var slikRij = null;

  function px(el, naam, waarde) { el.style.setProperty(naam, waarde); }
  function tik(patroon) {
    if (rustig()) return;
    try {
      if (window.RTGWauw && window.RTGWauw.tik) window.RTGWauw.tik(patroon || 6);
      else if (navigator.vibrate) navigator.vibrate(patroon || 6);
    } catch (e) {}
  }

  /* ------------------------------------------------------------- de lade --
     ARIA-HIDDEN, EN DAT IS EEN BESLUIT EN GEEN VERGETELHEID. Bijna elke regel
     in dit huis is zelf een <a>; een <button> daarbinnen is ongeldige HTML en
     levert een schermlezer een knop IN een link op. De lade is daarom de weg
     voor een HAND (vinger, muis), en de weg voor een toets of een schermlezer
     is de actielade uit deel 3 -- met echte knoppen, in de bovenlaag, met
     dezelfde acties. Twee oppervlakken, een bediening; niet twee bedieningen. */
  function bouwLade(rij, kant, lijst, max) {
    var lade = d.createElement('span');
    lade.className = 'gb-lade';
    lade.setAttribute('data-kant', kant);
    lade.setAttribute('aria-hidden', 'true');
    var binnen = d.createElement('span');
    binnen.className = 'gb-binnen';
    lijst.forEach(function (a, i) {
      var b = d.createElement('span');
      b.className = 'gb-doe' + (i === 0 ? ' gb-eerste' : '');
      b.setAttribute('data-i', String(i));
      if (a.sig) b.setAttribute('data-sig', a.sig);
      b.innerHTML = svg(a.teken) + '<span>' + String(a.naam).replace(/[&<>]/g, '') + '</span>';
      binnen.appendChild(b);
    });
    lade.appendChild(binnen);
    rij.appendChild(lade);
    /* DE LADE IS ZO BREED ALS ZIJN WOORDEN. Een vaste maat per knop leek genoeg
       tot er een actie langskwam die 'Plan met Rahul' heet: die stond half in
       beeld, en een half woord op een knop is geen knop. Hier krijgt hij een tel
       lang zijn natuurlijke breedte, wordt hij gemeten, en daarna binnen de grens
       gehouden -- want een lade die de halve regel opeet is ook geen lade. */
    binnen.style.width = 'max-content';
    /* EN ALLEEN WAT ER HEEL OP PAST. De grens hierboven knipte tot vandaag de
       LADE af terwijl de knoppen hun eigen breedte hielden (flex:1 0 auto), dus
       de laatste actie stond half in beeld: op de post las 'Overnemen' als
       'OVER'. Precies de fout die de opmerking hierboven al beschrijft, een laag
       hoger. Wat er niet bij past gaat er dus UIT -- en dat kost niets, want de
       actielade (vasthouden, menutoets, de greep) toont ze alle drie. De eerste
       blijft altijd staan: dat is de actie die een volle veeg uitvoert. */
    var breed = [], i;
    for (i = 0; i < binnen.children.length; i++) breed.push(binnen.children[i].offsetWidth);
    var houd = 1, som = breed[0] || 0;
    while (houd < breed.length && som + breed[houd] <= max) { som += breed[houd]; houd++; }
    while (binnen.children.length > houd) binnen.removeChild(binnen.lastChild);
    var vol = Math.round(Math.min(Math.max(houd * KNOP, som), max));
    binnen.style.width = '';
    px(lade, '--gb-vol', vol + 'px');
    lade.vol = vol;
    return lade;
  }

  function sluit(rij, meteen) {
    if (!rij) return;
    var lade = rij.querySelector(':scope > .gb-lade');
    px(rij, '--gb-duur', meteen || rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
    px(rij, '--gb-x', '0px');
    if (lade) {
      px(lade, '--gb-duur', meteen || rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(lade, '--gb-lade', '0px');
      lade.removeAttribute('data-gereed');
    }
    if (openLade && openLade.rij === rij) openLade = null;
    /* Pas opruimen als de beweging klaar is: een lade die halverwege uit de DOM
       verdwijnt springt dicht in plaats van te sluiten. */
    setTimeout(function () {
      if (rij.querySelector(':scope > .gb-lade[data-gereed]')) return;
      if (openLade && openLade.rij === rij) return;
      var l = rij.querySelector(':scope > .gb-lade');
      if (l) l.remove();
      rij.removeAttribute('data-gb');
      var vast = rij.querySelectorAll('[data-gb-vast]');
      for (var i = 0; i < vast.length; i++) vast[i].removeAttribute('data-gb-vast');
      rij.style.removeProperty('--gb-x');
      rij.style.removeProperty('--gb-duur');
    }, meteen || rustig() ? 0 : 200);
  }
  function sluitAlles(meteen) { if (openLade) sluit(openLade.rij, meteen); }

  /* ---------------------------------------------------------- uitvoeren --
     DOORVEGEN VOERT UIT, dus er hoort een weg terug te zijn. Een actie die iets
     teruggeeft, geeft daarmee zijn terugweg: een functie wordt de knop
     'Terugdraaien', een tekst wordt een rustige bevestiging. Geeft hij niets
     terug, dan gebeurt er ook niets zichtbaars -- een 'Openen' die navigeert
     hoort geen melding achter te laten op een scherm dat je net verliet. */
  function voerUit(actie, rij) {
    if (!actie || typeof actie.doe !== 'function') return;
    var uit;
    try { uit = actie.doe(rij); } catch (e) { uit = null; }
    if (typeof uit === 'function') melding(actie.melding || actie.naam, uit);
    else if (typeof uit === 'string' && uit) melding(uit, null);
  }

  var toost = null;
  function melding(tekst, terug) {
    if (toost) { toost.remove(); toost = null; }
    var t = d.createElement('div');
    t.className = 'gb-terug';
    t.setAttribute('role', 'status');
    var s = d.createElement('span'); s.textContent = tekst; t.appendChild(s);
    if (typeof terug === 'function') {
      var b = d.createElement('button');
      b.type = 'button';
      b.textContent = T('gebaar.terug', 'Terugdraaien', 'Undo');
      b.addEventListener('click', function () {
        try { terug(); } catch (e) {}
        t.remove(); if (toost === t) toost = null;
      });
      t.appendChild(b);
    }
    d.body.appendChild(t);
    toost = t;
    setTimeout(function () { if (t.parentNode) t.remove(); if (toost === t) toost = null; }, 7000);
  }

/* Vervolg van gebaar-02: HET SLEPEN ZELF. Apart bestand omdat het een eigen
   onderwerp is (en omdat de maat van check.js regel 13 dat afdwong): hierboven
   staat WAT er onder een regel ligt en wat er gebeurt als je erop tikt, hier
   staat hoe een hand daar bij komt -- de richtingsvergrendeling, de weerstand,
   de drempel en het loslaten. */
  /* ---------------------------------------------------------- het slepen -- */
  function opNeer(e) {
    if (e.button != null && e.button !== 0) return;      // rechts is de actielade
    /* Op een OPEN lade begint geen nieuw gebaar: daar wordt getikt. De greep
       staat wel in de weg van de hand -- hij zit precies aan de rand waar een
       veeg naar links begint -- dus daar mag je gewoon vandaan vegen. Blijft de
       hand stilstaan, dan is het een klik en opent hij de actielade. */
    if (e.target.closest('.gb-lade')) return;
    var t = e.target;
    if (t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    var rij = t.closest && t.closest('.gb-rij');
    if (!rij) { sluitAlles(); return; }
    if (openLade && openLade.rij !== rij) sluitAlles();
    var acties = actiesVan(rij);
    if (!acties) return;
    g = {
      rij: rij, acties: acties, x0: e.clientX, y0: e.clientY,
      dx: 0, vast: false, dood: false, kant: null, lade: null,
      breed: 0, drempel: 0, gereed: false, pid: e.pointerId
    };
  }

  function opBeweeg(e) {
    if (!g || g.dood || e.pointerId !== g.pid) return;
    var dx = e.clientX - g.x0, dy = e.clientY - g.y0;
    if (!g.vast) {
      /* DE RICHTINGSVERGRENDELING. Zonder deze stap steelt elke veeg het
         verticaal scrollen van de pagina, want de eerste paar pixels van een
         scroll zien er precies zo uit als het begin van een veeg. */
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > RICHTING) { g.dood = true; return; }
      if (Math.abs(dx) < RICHTING) return;
      var kant = dx < 0 ? 'rechts' : 'links';
      var lijst = g.acties[kant];
      if (!lijst || !lijst.length) { g.dood = true; return; }
      g.vast = true; g.kant = kant;
      /* WAT ABSOLUUT STAAT, SCHUIFT NIET MEE. De stip van een tijdlijn en het
         bolletje van een signaalrail zijn geen inhoud van de regel maar van de
         LIJN waar hij aan hangt; die horen te blijven staan terwijl de regel
         eronder wegschuift. Zonder deze stap veegt de tijdlijn zichzelf weg. */
      var kind = g.rij.children;
      for (var i = 0; i < kind.length; i++) {
        var pos = getComputedStyle(kind[i]).position;
        if (pos === 'absolute' || pos === 'fixed') kind[i].setAttribute('data-gb-vast', '');
      }
      /* DE RONDING VAN DE REGEL, ZODAT DE SNEDE HEM VOLGT. De lade is een
         rechthoek en de regel heeft ronde hoeken; zonder deze maat eindigt een
         open lade in een scherpe hoek naast een ronde regel -- op post viel dat
         meteen op. CSS kan een border-radius niet zelf in een clip-path lezen,
         dus wordt hij hier gemeten en doorgegeven. De lade krijgt hem een pixel
         kleiner: zij ligt BINNEN de rand van de regel en een gelijke ronding
         puilt daar net overheen. */
      var cs = getComputedStyle(g.rij);
      var buiten = parseFloat(kant === 'rechts' ? cs.borderTopRightRadius : cs.borderTopLeftRadius) || 0;
      var rand = parseFloat(kant === 'rechts' ? cs.borderRightWidth : cs.borderLeftWidth) || 0;
      px(g.rij, '--gb-rond', buiten + 'px');
      px(g.rij, '--gb-rond-lade', Math.max(0, buiten - rand) + 'px');
      g.rij.setAttribute('data-gb', kant);
      px(g.rij, '--gb-duur', '0ms');
      g.lade = bouwLade(g.rij, kant, lijst, g.rij.offsetWidth * 0.72);
      px(g.lade, '--gb-duur', '0ms');
      g.breed = g.lade.vol;
      /* De drempel ligt voorbij de volle lade EN voorbij de helft van de regel:
         wie alleen de lade wil zien, komt er nooit per ongeluk overheen. */
      g.drempel = Math.max(g.breed + 52, g.rij.offsetWidth * 0.55);
      try { g.rij.setPointerCapture(e.pointerId); } catch (err) {}
    }
    var breedte = Math.abs(dx);
    /* Voorbij de drempel wordt het zwaar. Dat is geen decoratie: weerstand is
       hoe een hand voelt dat er iets verandert, nog voor het oog het ziet. */
    if (breedte > g.drempel) breedte = g.drempel + (breedte - g.drempel) * 0.35;
    breedte = Math.min(breedte, g.rij.offsetWidth);
    g.dx = g.kant === 'rechts' ? -breedte : breedte;
    px(g.rij, '--gb-x', Math.round(g.dx) + 'px');
    px(g.lade, '--gb-lade', Math.round(breedte) + 'px');
    var gereed = breedte >= g.drempel && !g.acties[g.kant][0].borg;
    if (gereed !== g.gereed) {
      g.gereed = gereed;
      if (gereed) { g.lade.setAttribute('data-gereed', ''); tik(9); }
      else g.lade.removeAttribute('data-gereed');
    }
  }

  function opLos(e) {
    if (!g) return;
    var h = g; g = null;
    if (!h.vast) return;
    slikRij = h.rij;      // de klik die hier zo achteraan komt is de staart van dit gebaar
    try { h.rij.releasePointerCapture(h.pid); } catch (err) {}
    var lijst = h.acties[h.kant];
    if (h.gereed) {
      /* Doorgeveegd: de eerste actie gebeurt. De lade sluit METEEN -- open laten
         staan zou suggereren dat er nog iets moet gebeuren. */
      h.lade.removeAttribute('data-gereed');
      sluit(h.rij, true);
      voerUit(lijst[0], h.rij);
      return;
    }
    if (Math.abs(h.dx) >= h.breed * 0.45) {
      px(h.rij, '--gb-duur', rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(h.lade, '--gb-duur', rustig() ? '0ms' : 'var(--rtg-tijd-paneel,180ms)');
      px(h.rij, '--gb-x', (h.kant === 'rechts' ? -h.breed : h.breed) + 'px');
      px(h.lade, '--gb-lade', h.breed + 'px');
      openLade = { rij: h.rij, kant: h.kant };
      return;
    }
    sluit(h.rij);
  }
/* Vervolg van gebaar-02: DE TIK, DE GREEP EN DE TOETSEN -- alle wegen naar
   dezelfde acties die geen veeg zijn.

   WCAG 2.5.7 zegt het kortst: geen enkele handeling mag ALLEEN met slepen te
   doen zijn. Dat is hier geen vinkje maar de reden dat dit deel bestaat. */

  /* --------------------------------------------------------- de tik erop --
     In de VANG-fase, want bijna elke regel is zelf een <a>: doen we dit later,
     dan is de pagina al aan het navigeren voor de actie is uitgevoerd. */
  d.addEventListener('click', function (e) {
    var doe = e.target.closest && e.target.closest('.gb-doe');
    if (doe) {
      e.preventDefault(); e.stopPropagation();
      var rij = doe.closest('.gb-rij');
      var lade = doe.closest('.gb-lade');
      var acties = rij && actiesVan(rij);
      if (!acties || !lade) return;
      var lijst = acties[lade.getAttribute('data-kant')] || [];
      var a = lijst[Number(doe.getAttribute('data-i')) || 0];
      sluit(rij, true);
      if (a && a.borg) vraagBorg(a, rij);
      else voerUit(a, rij);
      return;
    }
    /* De klik die op een veeg volgt is geen klik maar de staart van het gebaar.
       Zonder dit slikje opent elke veeg over een regel ook nog de regel zelf.
       EENMALIG en op de REGEL: de verwijzing gaat weg bij de eerstvolgende klik,
       wat er ook gebeurt, en alleen een klik OP die regel wordt geslikt. Zie de
       toelichting bij slikRij in gebaar-02.js voor wat hier eerst stond. */
    if (slikRij) {
      var vanDeVeeg = e.target.closest && e.target.closest('.gb-rij') === slikRij;
      slikRij = null;
      if (vanDeVeeg) { e.preventDefault(); e.stopPropagation(); return; }
    }
    if (openLade && !(e.target.closest && e.target.closest('.gb-rij') === openLade.rij)) sluitAlles();
  }, true);

  /* ------------------------------------------------------------ de greep --
     Een gebaar dat je niet ziet, bestaat niet voor wie het niet toevallig
     probeert. Bij aanwijzen en bij focus komt daarom een greep in beeld naar
     dezelfde acties.

     TWEE VORMEN, EN DAT IS GEEN SLORDIGHEID. Is de regel zelf een link of een
     knop, dan wordt de greep een <span> zonder tabstop: een knop in een link is
     ongeldige HTML, en een schermlezer krijgt daar een knop-in-een-link van.
     Die regel is met de TOETSEN te bedienen (hieronder), en de greep is dan
     alleen het zichtbare teken dat er iets te halen valt. Is de regel geen
     link, dan is de greep een echte knop met een echte naam. */
  function interactief(rij) {
    return /^(A|BUTTON)$/.test(rij.tagName) || rij.hasAttribute('href') ||
      rij.getAttribute('role') === 'button' || rij.getAttribute('role') === 'link';
  }
  function zetGreep(rij) {
    if (!rij || rij.querySelector(':scope > .gb-greep')) return;
    if (!actiesVan(rij)) return;
    var el;
    if (interactief(rij)) {
      el = d.createElement('span');
      el.setAttribute('aria-hidden', 'true');
    } else {
      el = d.createElement('button');
      el.type = 'button';
      el.setAttribute('aria-label', T('gebaar.acties', 'Acties voor deze regel', 'Actions for this row'));
      el.setAttribute('aria-haspopup', 'dialog');
    }
    el.className = 'gb-greep';
    el.innerHTML = svg('meer');
    el.addEventListener('click', function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      opendActielade(rij);
    });
    rij.appendChild(el);
  }
  function wegGreep(rij) {
    var el = rij && rij.querySelector(':scope > .gb-greep');
    if (el && el !== d.activeElement) el.remove();
  }
  d.addEventListener('pointerover', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij) zetGreep(rij);
  }, { passive: true });
  d.addEventListener('pointerout', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij && !rij.contains(e.relatedTarget)) wegGreep(rij);
  }, { passive: true });
  d.addEventListener('focusin', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij) zetGreep(rij);
  });
  d.addEventListener('focusout', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (rij && !rij.contains(e.relatedTarget)) wegGreep(rij);
  });

  /* ---------------------------------------------------------- de toetsen --
     Pijl links en pijl rechts openen de acties van die kant; de menutoets (of
     Shift+F10, of een rechtermuisklik) opent ze allemaal. Escape sluit.

     De pijlen openen de ACTIELADE en niet de zichtbare lade. Dat is met opzet:
     een lade die je met een toets openschuift, laat je vervolgens met dezelfde
     toets door onbereikbare elementen lopen -- want de lade is aria-hidden en
     hoort dat te blijven. De actielade heeft echte knoppen en echte focus. */
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (openLade) { sluitAlles(true); } return; }
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    var t = e.target;
    if (t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]')) return;
    var rij = t && t.closest && t.closest('.gb-rij');
    if (!rij) return;
    var acties = actiesVan(rij);
    if (!acties) return;
    if (e.key === 'ArrowLeft' && acties.rechts.length) { e.preventDefault(); opendActielade(rij, 'rechts'); }
    else if (e.key === 'ArrowRight' && acties.links.length) { e.preventDefault(); opendActielade(rij, 'links'); }
    else if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) { e.preventDefault(); opendActielade(rij); }
  });
  d.addEventListener('contextmenu', function (e) {
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (!rij || !actiesVan(rij)) return;
    e.preventDefault();
    opendActielade(rij);
  });

  /* DE VEEG DIE DE BROWSER AFPAKT. Bijna elke regel hier is een <a>, en een
     ingedrukte muis die over een link beweegt is voor de browser het begin van
     een sleepactie: hij stuurt dragstart, kaapt de aanwijzer en stuurt ons een
     pointercancel. Het gevolg is een veeg die na twee pixels dooft -- en die
     precies zo lang leek te werken dat je hem in een demo niet ziet.

     Dit is geen scherm-eigenaardigheid maar de oorzaak zelf, dus hij staat hier
     en niet als draggable="false" op tweehonderd regels (LAT.md regel 1). Alleen
     terwijl er ECHT een gebaar loopt: buiten een gebaar mag een link gewoon
     versleepbaar blijven. */
  d.addEventListener('dragstart', function (e) {
    if (g && e.target.closest && e.target.closest('.gb-rij')) e.preventDefault();
  });

  /* Scrollen sluit een openstaande lade. Een lade die tien regels verderop nog
     openstaat is geen geheugen maar een vergeten venster. */
  addEventListener('scroll', function () { if (openLade) sluitAlles(true); }, { passive: true, capture: true });

/* Vervolg van gebaar-03: VASTHOUDEN, in zijn twee betekenissen. Lang drukken
   opent de acties als lijst; vasthouden op een borg-actie voert hem uit. Apart
   bestand omdat de maat het vroeg (check.js regel 13) en omdat het een eigen
   onderwerp is: alles hierboven gaat over EEN tik of EEN toets, hier gaat het
   over de tijd die een vinger ergens blijft. */
  /* ------------------------------------------------------- vasthouden --
     Lang drukken opent dezelfde acties als lijst. Niet alleen via contextmenu:
     die gebeurtenis komt op een <a> in iOS Safari niet, en juist daar is bijna
     elke regel een <a>. Een eigen teller is hier eerlijker dan vertrouwen op
     een gebeurtenis die op de helft van de toestellen uitblijft. */
  var langTimer = 0;
  d.addEventListener('pointerdown', function (e) {
    clearTimeout(langTimer);
    if (e.button != null && e.button !== 0) return;
    var rij = e.target.closest && e.target.closest('.gb-rij');
    if (!rij || !actiesVan(rij)) return;
    if (e.target.closest('.gb-lade,.gb-greep')) return;
    langTimer = setTimeout(function () {
      if (g && g.vast) return;                 // dit is een veeg, geen vasthouden
      g = null;
      slikRij = rij;                           // de klik erna is de staart hiervan
      tik(9);
      opendActielade(rij);
    }, 520);
  }, { passive: true });
  d.addEventListener('pointermove', function (e) {
    if (!langTimer) return;
    if (g && !g.vast && Math.abs(e.clientX - g.x0) < 8 && Math.abs(e.clientY - g.y0) < 8) return;
    clearTimeout(langTimer); langTimer = 0;
  }, { passive: true });
  ['pointerup', 'pointercancel'].forEach(function (n) {
    d.addEventListener(n, function () { clearTimeout(langTimer); langTimer = 0; }, { passive: true });
  });

  /* ------------------------------------------------- vasthouden om te doen --
     Wat niet terug te draaien is, gaat niet op een tik en niet op een veeg. Je
     houdt hem vast en ziet de rand vollopen; laat je los, dan gebeurt er niets.
     Dit is LIFE.md in een knop: klaarzetten mag de machine, bevestigen doet de
     mens. Een borg-actie kan daarom NOOIT door een doorveeg worden geraakt
     (gebaar-02 sluit hem uit de drempel uit) en een tik erop in de lade leidt
     naar de actielade, waar een echte knop staat om vast te houden. */
  var BORGTIJD = 800;
  function vraagBorg(actie, rij) { opendActielade(rij, null, actie); }

  function houdVast(knop, klaar) {
    var t0 = 0, bezig = false, raf = 0;
    function stop() {
      bezig = false; cancelAnimationFrame(raf);
      knop.style.setProperty('--gb-borg', '0%');
    }
    function stap(nu) {
      if (!bezig) return;
      var p = Math.min(1, (nu - t0) / BORGTIJD);
      knop.style.setProperty('--gb-borg', (p * 100).toFixed(1) + '%');
      if (p >= 1) { stop(); tik([9, 40, 9]); klaar(); return; }
      raf = requestAnimationFrame(stap);
    }
    knop.classList.add('gb-borg');
    knop.addEventListener('pointerdown', function (e) {
      if (bezig) return;
      bezig = true; t0 = performance.now();
      try { knop.setPointerCapture(e.pointerId); } catch (err) {}
      raf = requestAnimationFrame(stap);
    });
    knop.addEventListener('pointerup', stop);
    knop.addEventListener('pointercancel', stop);
    knop.addEventListener('pointerleave', stop);
    /* Met een toets is vasthouden geen gebaar maar een tweede druk: spatie of
       Enter zet hem op scherp, dezelfde toets erna voert uit. */
    var scherp = false;
    knop.addEventListener('click', function (ev) {
      ev.preventDefault();
      if (ev.detail > 0) return;               // dit was de muis; die hield al vast
      if (!scherp) { scherp = true; knop.setAttribute('data-scherp', ''); return; }
      knop.removeAttribute('data-scherp'); klaar();
    });
  }
/* Slot van de gebarenlaag: DE ACTIELADE en de deur naar buiten.

   De actielade is het oppervlak waar de acties gewoon als LIJST staan: met
   echte knoppen, echte namen en echte focus. Hij gaat open bij vasthouden, bij
   een rechtermuisklik, met de menutoets, met de pijltjes en via de greep -- vijf
   wegen naar hetzelfde. Dat is geen stapeling: het is dezelfde deur, die op elk
   toestel anders heet.

   EEN <dialog> MET showModal() EN GEEN ZWEVEND PANEELTJE. De bovenlaag van de
   browser staat buiten elke stackingcontext, dus hij werkt ook binnen een
   voorouder met een transform -- en dat is op deze schermen geen zeldzaamheid.
   Escape, de achtergrond en het opsluiten van de focus zijn er gratis bij. */

  var blad = null, vanRij = null;

  function knopVoor(a, rij) {
    var b = d.createElement('button');
    b.type = 'button';
    if (a.sig) b.setAttribute('data-sig', a.sig);
    b.innerHTML = svg(a.teken);
    var s = d.createElement('span');
    s.textContent = a.borg
      ? a.naam + ' · ' + T('gebaar.houd', 'houd vast', 'hold')
      : a.naam;
    b.appendChild(s);
    if (a.borg) houdVast(b, function () { sluitBlad(); voerUit(a, rij); });
    else b.addEventListener('click', function () { sluitBlad(); voerUit(a, rij); });
    return b;
  }

  function groep(titel, lijst, rij) {
    if (!lijst.length) return null;
    var wrap = d.createDocumentFragment();
    var k = d.createElement('div'); k.className = 'gb-kant'; k.textContent = titel;
    wrap.appendChild(k);
    var m = d.createElement('menu');
    lijst.forEach(function (a) {
      var li = d.createElement('li');
      li.appendChild(knopVoor(a, rij));
      m.appendChild(li);
    });
    wrap.appendChild(m);
    return wrap;
  }

  function opendActielade(rij, kant, alleen) {
    var acties = actiesVan(rij);
    if (!acties) return;
    sluitAlles(true);
    sluitBlad();
    vanRij = rij;
    blad = d.createElement('dialog');
    blad.className = 'gb-blad';
    var h = d.createElement('h2');
    h.textContent = alleen
      ? T('gebaar.bevestig', 'Bevestigen', 'Confirm')
      : T('gebaar.acties2', 'Acties', 'Actions');
    blad.appendChild(h);
    var titel = acties.titel || (rij.textContent || '').trim().split('\n')[0].slice(0, 90);
    if (titel) {
      var t = d.createElement('span'); t.className = 'gb-titel'; t.textContent = titel;
      blad.appendChild(t);
    }
    if (alleen) {
      var g1 = groep(T('gebaar.nietterug', 'Dit is niet terug te draaien', 'This cannot be undone'), [alleen], rij);
      if (g1) blad.appendChild(g1);
    } else {
      /* De kant heet naar het GEBAAR en niet naar de lade: "veeg naar links" is
         wat een hand doet, "de rechterlade" is hoe de code het noemt. */
      if (kant !== 'links') {
        var g2 = groep(T('gebaar.naarlinks', 'Veeg naar links', 'Swipe left'), acties.rechts, rij);
        if (g2) blad.appendChild(g2);
      }
      if (kant !== 'rechts') {
        var g3 = groep(T('gebaar.naarrechts', 'Veeg naar rechts', 'Swipe right'), acties.links, rij);
        if (g3) blad.appendChild(g3);
      }
    }
    blad.addEventListener('close', function () {
      if (blad) blad.remove();
      blad = null;
      /* De focus terug naar de regel waar hij vandaan kwam. Zonder deze regel
         valt een toetsenbordgebruiker terug naar het begin van het document --
         het klassieke gat na een dialoog. */
      try { if (vanRij && vanRij.isConnected) vanRij.focus({ preventScroll: true }); } catch (e) {}
      vanRij = null;
    });
    d.body.appendChild(blad);
    if (blad.showModal) blad.showModal(); else blad.setAttribute('open', '');
    var eerste = blad.querySelector('button');
    if (eerste) try { eerste.focus(); } catch (e) {}
  }
  function sluitBlad() { if (blad) { try { blad.close(); } catch (e) { blad.remove(); blad = null; } } }

/* Slot van de gebarenlaag, deel twee: WAT EEN SCHERM ERVAN ZIET. De uitleg die
   aan elke regel hangt, de vier kant-en-klare acties die overal hetzelfde
   betekenen, en de publieke deur. Hierboven staat de actielade zelf.
   (Geknipt op de maat van check.js regel 13; de naad zat hier al.) */
  /* ---------------------------------------------------------- de uitleg --
     EEN zin, EEN keer in het document, waar elke gebarenregel naar wijst. Zo
     hoort een schermlezer bij de regel zelf dat er acties aan hangen en hoe je
     erbij komt -- in plaats van dat het gebaar alleen bestaat voor wie het
     toevallig probeert. */
  var UITLEG = 'gbUitleg';
  function uitlegElement() {
    var el = d.getElementById(UITLEG);
    if (el) return el;
    el = d.createElement('p');
    el.id = UITLEG;
    el.textContent = T('gebaar.uitleg',
      'Deze regel draagt acties. Veeg naar links of rechts, of open ze met de menutoets of de pijltoetsen.',
      'This row carries actions. Swipe left or right, or open them with the menu key or the arrow keys.');
    el.style.cssText = 'position:absolute;width:1px;height:1px;padding:0;margin:-1px;' +
      'overflow:hidden;clip-path:inset(50%);white-space:nowrap;border:0;';
    (d.body || d.documentElement).appendChild(el);
    return el;
  }
  /* Gehesen naar deel 1: merk() roept dit aan. */
  function merkEen(rij) {
    rij.classList.add('gb-rij');
    uitlegElement();
    var b = rij.getAttribute('aria-describedby') || '';
    if (b.split(/\s+/).indexOf(UITLEG) < 0) {
      rij.setAttribute('aria-describedby', (b ? b + ' ' : '') + UITLEG);
    }
    rij.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
  }

  /* ------------------------------------------------------- kant-en-klaar --
     Vier acties die op bijna elke regel hetzelfde betekenen. Ze staan HIER en
     niet drie keer in drie schermen: anders staat "kenmerk kopieren" straks op
     drie plekken met drie meldingen en twee bugs (LAT.md regel 4).

     Alle vier geven iets TERUG, en dat is wat de melding oproept. Alleen
     'openen' niet: die navigeert weg, en een bevestiging achterlaten op een
     scherm dat je net verliet is een melding voor niemand. */
  function kopieer(tekst, gedaan) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(tekst);
    } catch (e) {}
    return gedaan;
  }
  function alsTekst(rij) { return (rij.textContent || '').trim().replace(/\s+/g, ' '); }

  var KLAAR = {
    openen: function (href, naam) {
      return { naam: naam || T('gebaar.openen', 'Openen', 'Open'), teken: 'openen',
        doe: function () { if (href) location.href = href; } };
    },
    delen: function (o) {
      return { naam: T('gebaar.delen', 'Delen', 'Share'), teken: 'delen',
        doe: function (rij) {
          var data = {
            title: (o && o.titel) || d.title,
            text: (o && o.tekst) || '',
            url: (o && o.url) || location.href
          };
          if (navigator.share) { try { navigator.share(data).catch(function () {}); } catch (e) {} return; }
          return kopieer((data.title ? data.title + ' - ' : '') + data.url,
            T('gebaar.gekopieerd', 'Gekopieerd; klaar om te plakken.', 'Copied; ready to paste.'));
        } };
    },
    kenmerk: function (code) {
      if (!code) return null;
      return { naam: T('gebaar.kenmerk', 'Kenmerk', 'Reference'), teken: 'kenmerk',
        doe: function () { return kopieer(code, code + ' - ' + T('gebaar.gekopieerd2', 'gekopieerd', 'copied')); } };
    },
    overnemen: function (tekst) {
      /* HET KOPIEER-TEKEN EN NIET HET ARCHIEF-TEKEN. Hier stond 'archief', en op
         het notitiebord kwam die actie naast Archiveren te liggen: twee knoppen
         naast elkaar met precies hetzelfde plaatje en een ander gevolg. Kenmerk
         en Overnemen doen allebei hetzelfde -- iets op het klembord zetten -- dus
         die delen hun teken, en dat is de bedoeling. */
      return { naam: T('gebaar.overnemen', 'Overnemen', 'Copy'), teken: 'kenmerk',
        doe: function (rij) {
          var t = typeof tekst === 'function' ? tekst(rij) : (tekst || alsTekst(rij));
          return kopieer(t, T('gebaar.overgenomen', 'De regel staat op uw klembord.', 'The row is on your clipboard.'));
        } };
    },
    /* De regel heeft zelf al een knop; de veeg drukt hem in. Zo blijft er EEN
       waarheid over wat die knop doet, en niet een tweede kopie ernaast.

       EN DE LAAG SLIKTE ZIJN EIGEN KLIK OP. Na een gebaar staat slikRij op de
       regel, want de ECHTE klik die achter een veeg aankomt is de staart van dat
       gebaar en hoort niet door te lekken naar de link eronder. Maar de klik die
       we hier ZELF sturen komt uit diezelfde regel, dus die werd net zo hard
       tegengehouden -- en dan doet de veeg niets. Gemeten op De Salon: bewaren
       bereikte de server nooit.

       Daarom wordt de onderdrukking precies om deze ene klik heen opgetild, en
       daarna teruggezet: de naklik van de vinger wordt nog steeds geslikt. Dat
       kan omdat .click() synchroon is -- er zit geen ander gebaar tussen. */
    eigenKnop: function (naam, teken, kiezer) {
      return { naam: naam, teken: teken || 'openen',
        doe: function (rij) {
          var b = rij.querySelector(kiezer);
          if (!b) return;
          var bewaar = slikRij; slikRij = null;
          try { b.click(); } finally { slikRij = bewaar; }
        } };
    }
  };

  /* ------------------------------------------------- het wereldregister --
     DRIE SCHERMEN, EEN BOUWER. Kantoor, Sociaal en Reizen tekenen alledrie
     dezelfde regel: .reis met een stip, een datumkolom, een titel, een status,
     een kenmerk en een bron. Die vorm woont in shared/rtg-wereld.css en niet in
     een van de drie schermen -- dus hoort ook de vraag "welke acties draagt zo'n
     regel" op EEN plek te staan. De eerste versie hiervan stond in kantoor.html;
     dat was na twee schermen al twee kopieen (LAT.md regel 4).

     .reis is met naam GELEEND, net als .knop in het blad. Deze laag mag geen
     klassen van schermen gaan raden; wat hij leent, leent hij zichtbaar.

     De acties komen uit de REGEL zelf en niet uit een tweede kopie van de data:
     het register wordt opnieuw getekend zodra er iets binnenkomt, en een tweede
     lijst die dan niet meeloopt is precies de dubbele waarheid waar dit tegen
     beschermt. Staat er geen kenmerk, dan valt die actie vanzelf weg. */
  function tekstVan(el) { return el ? el.textContent.trim().replace(/\s+/g, ' ') : ''; }

  function wereldregister(wortel) {
    if (!wortel) return false;
    return window.RTGGebaar.lijst(wortel, '.reis[href]', function (rij) {
      var h = rij.querySelector('h3');
      /* De bestemming staat IN de h3 als eigen span (Reizen). textContent plakt
         die aan de titel vast -- "Ibiza-weekIbiza" -- dus hij wordt er hier
         afgehaald en als eigen deel behandeld. */
      var plaatsEl = h && h.querySelector('.rtg-plaats');
      var plaats = tekstVan(plaatsEl);
      var titel = tekstVan(h);
      if (plaats && titel.slice(-plaats.length) === plaats) titel = titel.slice(0, -plaats.length).trim();
      var refEl = rij.querySelector('.rtg-ref');
      var ref = refEl ? refEl.getAttribute('data-ref') : '';
      var href = rij.getAttribute('href');
      return {
        titel: titel + (plaats ? ' \u00b7 ' + plaats : ''),
        rechts: [KLAAR.openen(href), KLAAR.delen({ titel: titel, url: location.origin + href })],
        links: [
          KLAAR.kenmerk(ref),
          KLAAR.overnemen([titel, plaats, tekstVan(rij.querySelector('.dag')), ref,
            tekstVan(rij.querySelector('.bron'))].filter(Boolean).join(' \u00b7 '))
        ]
      };
    });
  }

  /* ------------------------------------------------------------- de deur -- */
  window.RTGGebaar = {
    /* Een regel met eigen acties. Geeft false terug als er niets bruikbaars in
       zat -- een lege lade opent niet, en dat hoort de aanroeper te weten. */
    zet: function (rij, acties) {
      var a = normaliseer(acties);
      if (!rij || !a) return false;
      boek.set(rij, a);
      merkEen(rij);
      return true;
    },
    /* Een LIJST die zichzelf opnieuw tekent. De acties worden pas gemaakt als
       een hand of een toets erom vraagt, dus een regel die net vervangen is
       heeft meteen de goede. De waarnemer is er alleen voor de KLASSE: die moet
       op de regel staan voordat de vinger neerkomt, want touch-action wordt
       door de browser gelezen op het moment van aanraken en niet daarna. */
    lijst: function (wortel, kiezer, bouwer) {
      if (!wortel || !kiezer || typeof bouwer !== 'function') return false;
      /* EERST OPRUIMEN. Een scherm met panelen (reizen-veilig) meldt zijn
         lijst per paneel aan, en die panelen komen en gaan. Zonder deze stap
         groeit de aanmeldlijst met elk paneel en houdt hij de weggehaalde DOM
         vast -- een lek dat je pas ziet na een uur werken. */
      for (var i = lijsten.length - 1; i >= 0; i--) {
        if (lijsten[i].wortel.isConnected) continue;
        if (lijsten[i].oog) try { lijsten[i].oog.disconnect(); } catch (e) {}
        lijsten.splice(i, 1);
      }
      var post = { wortel: wortel, kiezer: kiezer, bouwer: bouwer, oog: null };
      lijsten.push(post);
      merk(wortel, kiezer);
      try {
        post.oog = new MutationObserver(function () { merk(wortel, kiezer); });
        post.oog.observe(wortel, { childList: true, subtree: true });
      } catch (e) {}
      return true;
    },
    weg: function (rij) {
      if (!rij) return;
      boek.delete(rij);
      rij.classList.remove('gb-rij');
      rij.removeAttribute('aria-keyshortcuts');
      sluit(rij, true);
    },
    open: opendActielade,
    melding: melding,
    klaar: KLAAR,
    wereldregister: wereldregister,
    sluit: function () { sluitAlles(true); sluitBlad(); }
  };

/* Slot van de gebarenlaag, deel drie: DE VEEG DIE DE SERVER RAAKT.

   Tot hier deed elke actie iets in de browser -- openen, delen, kopieren. Dit
   deel is voor de acties die echt iets veranderen aan de andere kant, en dat is
   een ander soort belofte: als de regel wegschuift, is hij ook echt weg.

   OPTIMISTISCH, MET EEN WEG TERUG (ONTWERP.md par. 6). De regel verdwijnt
   meteen en de server volgt. Snelheid is wat een veeg beter maakt dan een knop;
   die weggeven maakt hem zinloos. De prijs is dat er drie dingen geregeld
   moeten zijn, en ze staan HIER en niet in elk scherm opnieuw:

     1. de regel gaat meteen weg, met een korte inklap zodat de lijst niet
        springt;
     2. gaat het mis aan de andere kant, dan komt hij TERUG en zegt waarom --
        stil falen is hier de ergste uitkomst, want het lid denkt dat het gelukt
        is en het staat er morgen weer;
     3. lukt het wel, dan staat de weg terug klaar -- en die roept de omgekeerde
        route aan, niet een kopie van de administratie.

   WAT DIT NIET DOET: verzinnen dat iets omkeerbaar is. Een actie zonder `terug`
   krijgt geen terugdraai-knop maar een borg: die gaat alleen op vasthouden.
   Dat is geen strengheid maar de enige eerlijke uitkomst -- een knop
   'Terugdraaien' die niets terugdraait is erger dan geen knop. */

  /* De inklap. Hij zet een vaste hoogte voordat hij naar nul gaat, want een
     element klapt niet in vanaf `auto`. Geeft een functie terug die hem
     terugzet, en die is het vangnet van punt 2 hierboven. */
  function verberg(rij) {
    var h = rij.offsetHeight;
    var oud = { hoogte: rij.style.height, marge: rij.style.marginTop, over: rij.style.overflow };
    rij.style.height = h + 'px';
    rij.style.overflow = 'hidden';
    /* een frame ertussen, anders ziet de browser alleen de eindstand */
    requestAnimationFrame(function () {
      if (!rij.isConnected) return;
      rij.classList.add('gb-weg');
      rij.style.height = '0px';
    });
    return function terugzetten() {
      rij.classList.remove('gb-weg');
      rij.style.height = oud.hoogte; rij.style.marginTop = oud.marge; rij.style.overflow = oud.over;
    };
  }

  /* Een actie die de server raakt. doe() en terug() geven een Promise terug;
     alles daaromheen -- inklappen, terugzetten bij een fout, de melding, de
     knop Terugdraaien -- doet deze laag. */
  KLAAR.server = function (o) {
    if (!o || typeof o.doe !== 'function') return null;
    return {
      naam: o.naam, teken: o.teken, sig: o.sig,
      /* melding MOET mee. Hij stond eerst alleen in de o hierboven, en voerUit()
         leest hem van de ACTIE -- dus de melding was "Prullenbak" in plaats van
         "Contract-2026.txt ligt in de prullenbak". Gevonden in een echte
         browser, niet met lezen: het verschil is een woord op een toast. */
      melding: o.melding,
      /* Geen terugweg betekent vasthouden. Zie de kop hierboven. */
      borg: o.borg || typeof o.terug !== 'function',
      doe: function (rij) {
        var terugzetten = verberg(rij);
        var klaar = function () { if (typeof o.na === 'function') try { o.na(); } catch (e) {} };
        var gelukt = true;
        var fouttekst = function (f, sl, nl, en) {
          return (f && f.message) || T(sl, nl, en);
        };
        /* De heenweg wordt VASTGEHOUDEN, en dat is niet netjesheid maar een
           gemeten fout. De melding met Terugdraaien staat er meteen -- dat is
           wat optimistisch betekent -- dus een snelle hand drukt hem in terwijl
           de eerste aanvraag nog onderweg is. Zonder deze ketting racen 'weg' en
           'herstel' met elkaar, en wie het laatst aankomt wint: het bestand
           bleef weg terwijl het scherm zei dat het terug was. Betrapt door een
           toets die de ene keer zakte en de andere keer niet. */
        var heenweg = Promise.resolve()
          .then(function () { return o.doe(rij); })
          .then(klaar, function (fout) {
            gelukt = false;
            terugzetten();
            melding(fouttekst(fout, 'gebaar.mislukt', 'Dat lukte niet; de regel staat er nog.',
              'That did not work; the row is still there.'), null);
          });
        if (typeof o.terug !== 'function') return o.melding || o.naam;
        return function () {
          heenweg.then(function () {
            /* Ging de heenweg mis, dan staat de regel er al weer en valt er
               niets terug te draaien. Alsnog terug gaan zou een tweede,
               tegengestelde opdracht sturen voor iets dat nooit gebeurd is. */
            if (!gelukt) return;
            return Promise.resolve(o.terug(rij)).then(function () { terugzetten(); klaar(); },
              function (fout) {
                melding(fouttekst(fout, 'gebaar.terugmislukt', 'Terugdraaien lukte niet.',
                  'Undo did not work.'), null);
              });
          });
        };
      }
    };
  };

  /* De laag laadt zonder haast (shared/basis.js zet hem op async), dus een
     scherm dat zijn regels wil ophangen kan er niet vanuit gaan dat hij er al
     is. Dit sein zegt: nu wel. Wie eerder klaar is dan de laag, luistert;
     wie later komt, ziet window.RTGGebaar gewoon staan. */
  try { d.dispatchEvent(new CustomEvent('rtg-gebaar')); } catch (e) {}

  d.addEventListener('pointerdown', opNeer);
  d.addEventListener('pointermove', opBeweeg);
  d.addEventListener('pointerup', opLos);
  d.addEventListener('pointercancel', opLos);
})();

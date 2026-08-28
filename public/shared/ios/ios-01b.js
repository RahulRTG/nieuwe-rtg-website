/* ======================= De iOS-laag, deel 1b: DE BALK =======================

   Uit ./ios-01.js geknipt op de 10 kB-grens, en op de naad die daar al in
   stond: deel 1 gaat over het MERK (wat er van RTG weg moet in een
   iOS-schil), dit deel over de BALK (wat ervoor terugkomt). Ze veranderen
   om verschillende redenen. Zie de kop van ios-01.js voor het geheel. */
  /* ------------------------------------------------------- 2. de balk */
  function isTerug(node) {
    if (!node) return false;
    if (node.matches('.terug, #terug, .os-terug, #osTerug')) return true;
    var l = (node.getAttribute('aria-label') || '') + ' ' + (node.getAttribute('title') || '');
    if (/\bterug\b/i.test(l)) return true;
    /* Een link die met een pijl begint IS de terugknop, hoe hij ook heet.
       De juridische pagina's schrijven "← Juridisch", de meldkamer "←" en
       niets meer; zonder deze regel belanden ze rechts tussen de acties. */
    if (node.tagName === 'A' && /^\s*[←<]/.test(node.textContent || '')) return true;
    var h = node.getAttribute('href') || '';
    return /\/apps\/(index|app|bureau)\.html$/.test(h);
  }

  function zoekTerug(kop) {
    var alle = kop.querySelectorAll('a, button');
    for (var i = 0; i < alle.length; i++) if (isTerug(alle[i])) return alle[i];
    return null;
  }

  /* Waar de terugknop naartoe gaat, in gewone taal. iOS zet daar de naam van
     het scherm waar je vandaan komt, niet het woord "terug".

     Twee dingen worden geweigerd. Een MERKNAAM ("RTG OS" stond als terug-link
     op de schoolpagina) -- dat is precies het woordmerk dat hier weg moet.
     En een BROKSTUK: uit aria-label "Terug naar de app" bleef "app" over, en
     een chevron met "app" ernaast zegt niets. Allebei worden "Home", want dat
     is waar ze naartoe gaan. */
  function bruikbaarLabel(t) {
    if (!t) return null;
    t = t.trim();
    if (!t || t.length > 18) return null;
    if (/\brtg\b/i.test(t)) return null;
    if (/^(de|het|een|app|pagina|scherm|hub|overzicht)$/i.test(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function terugLabel(node) {
    var uitTekst = bruikbaarLabel((node.textContent || '').replace(/^\s*[←<]\s*/, ''));
    if (uitTekst) return uitTekst;
    var h = node.getAttribute('href') || '';
    if (/\/apps\/(index|app|bureau)\.html$/.test(h)) return 'Home';
    var uitLabel = bruikbaarLabel((node.getAttribute('aria-label') || '')
      .replace(/^terug\s*(naar\s*)?(de|het)?\s*/i, ''));
    return uitLabel || 'Home';
  }

  /* Bedienbaar = iets waarmee je wat doet. Een <span> met een teller of een
     <h1> is dat niet, en die houden een balk dus niet in leven.

     VERBORGEN TELT MEE. Dat lijkt vreemd, en het is precies waar dit eerst op
     stukging: de kop van Berichten draagt een zoekveld, een taalkiezer en een
     filterrij die allemaal `hidden` zijn tot je bent ingelogd. Wie die
     overslaat, ziet een kop zonder bediening, gooit hem weg -- en gooit het
     zoekveld mee weg. De app zoekt daarna naar #zoekveld, vindt niets, en
     Berichten heeft geen zoekfunctie meer zonder dat er iets rood wordt. */
  /* MAAR EEN KNOP IN ANDERMANS DICHTE PANEEL IS GEEN BALKACTIE, en dat is iets
     anders dan de regel hierboven.

     Het verschil zit in WIE er verborgen is. Berichten heeft een zoekveld dat
     zelf `hidden` is tot je inlogt: dat veld is een balkactie die nog moet
     verschijnen, en die moet meetellen. Maar de RTFoundation-balk heeft een
     profielmenu -- een dropdown met `hidden` erop -- en daarin staan Gezin
     beheren, Ander profiel en Gezin uitloggen. Die drie zijn geen balkacties;
     ze horen bij de knop die dat menu opent, en die knop staat er al.

     Zonder dit onderscheid tilde bouwBalk() ze uit hun eigen menu de balk in,
     waar ze hun opmaak kwijtraakten (het menu styleert zijn eigen links) en
     als drie blauwe onderstreepte links over de titel heen kwamen te staan. Op
     een telefoon liepen ze gewoon van het scherm af. Dat is precies hoe het
     eruitzag op de foto waarmee dit gemeld werd.

     De regel is dus: het element zelf verborgen -> meetellen. Een VOOROUDER
     onder de kop dicht -> overslaan, want dan zit het in een paneel dat zijn
     eigen opener heeft. Een <dialog> die niet open is en een <details> die
     dicht is zijn hetzelfde geval met een andere spelling. */
  function inGeslotenPaneel(node, kop) {
    for (var p = node.parentElement; p && p !== kop; p = p.parentElement) {
      if (p.hasAttribute && p.hasAttribute('hidden')) return true;
      if (p.getAttribute && p.getAttribute('aria-hidden') === 'true') return true;
      if (p.tagName === 'DIALOG' && !p.open) return true;
      if (p.tagName === 'DETAILS' && !p.hasAttribute('open')) return true;
    }
    return false;
  }

  function bedienbaar(kop) {
    var kandidaten = kop.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"]');
    var uit = [];
    for (var i = 0; i < kandidaten.length; i++) {
      if (isTerug(kandidaten[i])) continue;
      if (inGeslotenPaneel(kandidaten[i], kop)) continue;
      uit.push(kandidaten[i]);
    }
    return uit;
  }

  /* De titel komt UIT DE KOP, of nergens vandaan. <title> is geen paginakop:
     daar staat "Privacybeleid, Rahul Travel Group" terwijl de pagina zelf al
     een <h1> heeft, en dan zet je er een tweede bovenop. */
  function kopTitel(kop) {
    var h = kop && kop.querySelector('h1, h2');
    var t = h && h.textContent.trim();
    return t ? { tekst: t, element: h } : null;
  }

  /* DE VAL WAAR DIT OP STUKGING. Een kop draagt meer dan knoppen: #tel telt
     ongelezen berichten, #titel krijgt de naam van de dienst, #wie de
     ingelogde eenheid, #filters wordt pas na het inloggen gevuld. Die zijn
     geen bediening, dus ze hielden de balk niet in leven -- en werden met de
     kop weggegooid. Daarna schrijft de app-code er gewoon nooit meer iets in:
     geen foutmelding, geen rode toets, alleen een teller die eeuwig leeg
     blijft. Alles met een id blijft daarom staan, altijd. */
  function draagtId(node) {
    if (!node || node.nodeType !== 1) return false;
    return !!(node.id || node.querySelector('[id]'));
  }

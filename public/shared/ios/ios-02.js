
  /* Zoekvelden en filterrijen horen niet op de balk zelf maar eronder -- dat
     is waar Mail en Berichten ze zetten. */
  function naarTweedeRij(node) {
    if (node.matches('input[type=search], input[type=text], input:not([type])')) return true;
    var p = node.parentElement;
    return !!(p && p.matches('.filters, .tabs, [role="group"], [role="tablist"], nav'));
  }

  /* HOUD DE WIKKEL BIJ EEN GROEP. Knoppen worden los verplaatst, en dat gaat
     goed tot een pagina ze via hun OUDER selecteert. Precies dat gebeurde op
     apps/payroll.html: de tabs stonden in een <nav> en het scherm zocht ze met
     `nav [data-tab]`. Na het omvormen stonden de knoppen in .ios-nav-acties, de
     <nav> was weg, en de tabwissel deed niets meer -- zonder foutmelding, want
     querySelectorAll levert gewoon een lege lijst.

     Mijn eerdere controle keek naar id's en zag dit dus niet: deze knoppen
     hebben er geen, ze worden via hun container gevonden. Vandaar deze regel:
     hoort een knop bij een GROEP (nav, tablist, filterrij), dan verhuist de
     groep als geheel en blijft de kiezer van de pagina werken. */
  function groepVan(node) {
    var p = node.parentElement;
    return (p && p.matches('.filters, .tabs, [role="group"], [role="tablist"], nav')) ? p : null;
  }

  /* DE BALK HEEFT EEN BOVENGRENS, en die stond nergens opgeschreven.

     bouwBalk() hieronder verplaatst ELKE bedienbare knop naar .ios-nav-acties.
     Dat gaat goed bij twee of drie acties en het gaat stuk bij zeven: op
     foundation/vrienden.html stonden Samen, Rahul, de avatar, de naam, Gezin
     beheren, Ander profiel en Gezin uitloggen naast elkaar, samen 666px in een
     scherm van 390. De balk werd niet te vol -- de PAGINA werd te breed, en
     alles schoof zijwaarts. De tweede rij bestond al (naarTweedeRij), maar die
     kiest op SOORT (een zoekveld, een tabrij) en nooit op RUIMTE. Dat is het
     gat: er was geen regel die zei hoeveel er in een balk past.

     Hier is die regel, en hij MEET in plaats van te tellen. Een vaste
     bovengrens ("hoogstens drie") is net zo fout: drie lange labels passen
     niet en vier pictogrammen wel.

     ios.css houdt daarnaast de kolom zelf krimpbaar. Die twee doen niet
     hetzelfde: het blad garandeert dat de pagina niet meer verbreedt, deze
     functie zorgt dat de acties daarbij leesbaar blijven in plaats van
     samengeperst. Zonder het blad schuift de pagina; zonder deze functie
     staan er zeven knoppen op de ruimte van drie.

     Twee dingen blijven altijd staan. De menuknop van appmenu.js (.amn-knop),
     want dat is de uitweg zelf -- die wegzetten is de deur achter je
     dichttrekken. En de terugknop, die staat in kolom 1 en komt hier niet
     langs.

     Wat naar beneden gaat is niet weg: appmenu.js leest .ios-nav-extra al even
     goed als .ios-nav-acties (zie uitKnoppen daar), dus een uitgeweken actie
     staat nog steeds in het menu. En de weg terug is er ook: wordt het venster
     breder, dan gaat alles eerst terug naar de balk en meet hij opnieuw. */
  var UITGEWEKEN = 'data-ios-uitgeweken';

  function overloopVak(kop) {
    var extra = kop.querySelector('.ios-nav-extra');
    if (!extra) {
      extra = el('div', 'ios-nav-extra');
      var eersteRij = kop.querySelector('.ios-nav-rij');
      kop.insertBefore(extra, eersteRij ? eersteRij.nextSibling : kop.firstChild);
    }
    var vak = extra.querySelector('.ios-nav-overloop');
    if (!vak) { vak = el('div', 'ios-nav-overloop'); extra.appendChild(vak); }
    return vak;
  }

  function pasActiesIn(kop) {
    var acties = kop.querySelector('.ios-nav-acties');
    if (!acties) return;

    /* Eerst alles terug. Anders zakt de balk bij elke resize verder leeg: hij
       zou wel kunnen uitplaatsen en nooit meer terughalen. */
    var terug = kop.querySelectorAll('[' + UITGEWEKEN + ']');
    for (var i = terug.length - 1; i >= 0; i--) {
      terug[i].removeAttribute(UITGEWEKEN);
      acties.appendChild(terug[i]);
    }

    /* HET BUDGET. Meten op overloop alleen is niet genoeg, en dat bleek pas op
       een echte telefoon. De balk van vrienden.html liep namelijk NIET over:
       de kolommen kregen 82 + 11 + 264 op 390 en pasten precies. Maar die 11
       is de titelkolom, tot een streep geknepen, en de acties namen 68% van de
       balk. Technisch klopte alles; het zag eruit alsof er zes dingen over
       elkaar heen stonden, en dat was de melding.

       Een navigatiebalk is navigatie en geen werkbalk. Meer dan 45% aan acties
       betekent dat er geen balk meer is maar een rij knoppen met een pijl
       ervoor. Vandaar twee voorwaarden: hij wijkt uit als het NIET PAST, en
       ook als het wel past maar te vol staat. */
    var BUDGET = 0.45;
    var rij = acties.parentElement;
    function teVol() {
      if (acties.scrollWidth > acties.clientWidth + 1) return true;
      if (!rij || !rij.clientWidth) return false;
      return acties.getBoundingClientRect().width > rij.clientWidth * BUDGET;
    }

    var vak = null, rem = 40;
    while (teVol() && rem--) {
      var kandidaat = null;
      for (var j = acties.children.length - 1; j >= 0; j--) {
        var k = acties.children[j];
        if (k.className && String(k.className).indexOf('amn-knop') >= 0) continue;
        kandidaat = k; break;
      }
      if (!kandidaat) break;
      if (!vak) vak = overloopVak(kop);
      kandidaat.setAttribute(UITGEWEKEN, '');
      vak.insertBefore(kandidaat, vak.firstChild);
    }

    /* Een lege wikkel is het behang waar dit bestand elders vanaf wil. */
    var oud = kop.querySelector('.ios-nav-overloop');
    if (oud && !oud.children.length) oud.remove();
  }

  function bouwBalk(kop) {
    merkWegChrome(kop);

    var acties = bedienbaar(kop);
    var titel = kopTitel(kop);
    /* NU verzamelen, niet straks: de herbouw hieronder haalt de kop uit elkaar
       en dan is niet meer te zien wat er bij de titel hoorde. */
    if (titel) titel.bij = bijregelsVan(kop, titel);
    var oudeTerug = zoekTerug(kop);

    /* De balk die niets doet: geen terugweg, geen bediening, en niets wat de
       app aanspreekt. Dat is behang -- weg ermee, de titel komt groot boven
       de inhoud, zoals iOS een scherm zonder navigatie opent. */
    if (!acties.length && !oudeTerug) {
      /* Ook de kop ZELF kan de drager zijn. Foundation bouwt twee lege
         <header id="balk">-elementen later pas op vanuit de sessie. Die kop
         verwijderen maakt de daaropvolgende initialisatie stilletjes dood. */
      var houdt = draagtId(kop);
      for (var q = 0; q < kop.children.length; q++) {
        if (titel && kop.children[q] === titel.element) continue;
        if (draagtId(kop.children[q])) { houdt = true; break; }
      }
      if (!houdt) {
        if (titel) grooteTitel(titel, null);
        kop.remove();
        return;
      }
    }

    var rij = el('div', 'ios-nav-rij');
    // de acties krijgen hun ondergrens van de component zelf, want niet elk
    // scherm dat ios.js laadt laadt ook ios.css (zie navStijlEenmalig)
    navStijlEenmalig();
    var actieVak = el('div', 'ios-nav-acties');
    var extra = el('div', 'ios-nav-extra');

    if (oudeTerug) {
      var label = terugLabel(oudeTerug);
      oudeTerug.classList.add('ios-terug');
      oudeTerug.textContent = '';
      oudeTerug.appendChild(chevron());
      oudeTerug.appendChild(el('span', null, label));
      rij.appendChild(oudeTerug);
    } else {
      rij.appendChild(el('span'));
    }

    rij.appendChild(el('span', 'ios-nav-titel', titel ? titel.tekst : ''));

    for (var j = 0; j < acties.length; j++) {
      var a = acties[j];
      var groep = groepVan(a);
      if (naarTweedeRij(a)) {
        var blok = groep || a;
        if (blok.parentElement !== extra) extra.appendChild(blok);
      } else if (groep) {
        // de groep als geheel, zodat een kiezer als `nav [data-tab]` blijft werken
        if (groep.parentElement !== actieVak) actieVak.appendChild(groep);
      } else {
        actieVak.appendChild(a);
      }
    }
    rij.appendChild(actieVak);

    /* Wat er nu nog in de kop staat is geen bediening meer. De ELEMENTEN MET
       EEN ID verhuizen naar de tweede rij, want die spreekt de app aan; de
       rest was opmaak en mag weg. De titel slaan we over: die krijgt hieronder
       zijn eigen plek.

       Let op het verschil tussen een drager en zijn WIKKEL. Berichten zet zijn
       teller in `<div class="kop">…<span id="tel" hidden></span></div>`. Nam ik
       die div in zijn geheel mee, dan stond er een lege, niet-verborgen wikkel
       in de balk -- en die houdt de balk 70 punten hoog en zichtbaar, ook als
       er niets in staat. Precies het behang dat hier weg moest. Dus: de
       dragers eruit, de wikkel niet. */
    var over = [].slice.call(kop.childNodes);
    for (var k = 0; k < over.length; k++) {
      var n = over[k];
      if (n === rij || n === extra) continue;
      if (titel && n === titel.element) continue;
      if (n.nodeType === 1 && n.id) { extra.appendChild(n); continue; }
      if (draagtId(n)) {
        var dragers = n.querySelectorAll('[id]');
        for (var m = 0; m < dragers.length; m++) extra.appendChild(dragers[m]);
      }
      if (n.parentNode === kop) kop.removeChild(n);
    }

    kop.insertBefore(rij, kop.firstChild);
    if (extra.childNodes.length) kop.insertBefore(extra, rij.nextSibling);
    kop.classList.add('ios-nav');
    kop.setAttribute('role', 'banner');

    if (titel) grooteTitel(titel, kop);
  }

  function chevron() {
    var svg = d.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    svg.setAttribute('aria-hidden', 'true');
    var p = d.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', 'M15 4l-8 8 8 8');
    svg.appendChild(p);
    return svg;
  }

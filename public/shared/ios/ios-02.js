
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
      var houdt = false;
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


  /* -------------------------------------------------- de eigen functies */
  /* Wat een app kan, staat al op zijn scherm. Vier bronnen, van beste naar
     minst goede, en we stoppen zodra er genoeg is. De volgorde is niet
     willekeurig: een delenbalk is door de pagina zelf als navigatie bedoeld,
     een kopje in de inhoud is dat pas bij gebrek aan beter. */
  var GEZET = [];        // wat een app zelf heeft opgegeven (RTGAppMenu.zet)
  var MAX = 8;

  function labelVan(node) {
    var t = (node.getAttribute('aria-label') || node.getAttribute('title') || node.textContent || '')
      .replace(/\s+/g, ' ').trim();
    /* Een pijl of kruisje is geen functie, en een zin ook niet: wat niet in
       twee, drie woorden te zeggen is hoort niet in een menu thuis. */
    if (!t || t.length < 2 || t.length > 28) return null;
    if (/^[^\wÀ-ɏ]+$/.test(t)) return null;
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function uitKnoppen(kiezer, uit, gezien) {
    var alle = d.querySelectorAll(kiezer);
    for (var i = 0; i < alle.length && uit.length < MAX; i++) {
      var k = alle[i];
      /* Onszelf niet opnemen. De hamburger hangt in .ios-nav-acties -- precies
         een van de plekken waar hieronder gezocht wordt -- dus zonder deze
         regel stond in elk app-menu een tegel "Menu" die het menu opent dat je
         net had geopend. En erger: die ene tegel maakte de lijst niet-leeg,
         waardoor de terugval op de kopjes van de inhoud nooit aan bod kwam en
         apps zonder tabs een menu kregen met alleen zichzelf erin. */
      if (k === knop || k.closest('.amn-blad')) continue;
      if (k.disabled || k.hidden) continue;
      var l = labelVan(k);
      if (!l || gezien[l.toLowerCase()]) continue;
      gezien[l.toLowerCase()] = true;
      uit.push({ label: l, knop: k });
    }
  }

  /* DE SCHAKELRIJ, op vorm herkend en niet op klassenaam.

     Bijna elke app heeft er een: "Alle / Hotels / Appartementen / Villa's" in
     Verblijven, "alles / nieuws / reizen / lifestyle / zaken" in Nieuws. Maar
     ze heten allemaal anders -- .chips, .rubrieken, .filters, en op de meeste
     pagina's een naam die maar één keer voorkomt. Een lijst klassenamen
     bijhouden is hetzelfde probleem als elk menu met de hand: die lijst loopt
     achter zodra er een app bijkomt.

     De VORM is wel overal gelijk: een vakje waarvan de directe kinderen op één
     na allemaal knoppen zijn, drie tot acht stuks, elk met een kort label. Dat
     is precies wat een schakelrij is en wat een lijst met inhoud niet is (die
     heeft lange labels, of één kind, of tientallen). We nemen de eerste die we
     zo tegenkomen -- de bovenste op het scherm is de hoofdschakelaar. */
  function uitSegment(uit, gezien) {
    var wortel = d.querySelector('main') || d.getElementById('main') || d.body;
    var vakken = wortel.querySelectorAll('div, nav, section, ul, p');
    for (var i = 0; i < vakken.length && i < 400; i++) {
      var vak = vakken[i], kids = vak.children;
      if (kids.length < 3 || kids.length > 8) continue;
      var labels = [], goed = true;
      for (var j = 0; j < kids.length; j++) {
        var k = kids[j];
        if (k === knop || (k.tagName !== 'BUTTON' && k.tagName !== 'A')) { goed = false; break; }
        if (k.disabled || k.hidden) { goed = false; break; }
        var l = labelVan(k);
        if (!l || l.length > 22 || gezien[l.toLowerCase()]) { goed = false; break; }
        labels.push({ label: l, knop: k });
      }
      if (!goed) continue;
      for (var m = 0; m < labels.length && uit.length < MAX; m++) {
        gezien[labels[m].label.toLowerCase()] = true;
        uit.push(labels[m]);
      }
      return;
    }
  }

  function eigenFuncties() {
    var uit = [], gezien = {};
    for (var g = 0; g < GEZET.length && uit.length < MAX; g++) {
      var it = GEZET[g];
      if (!it || !it.label) continue;
      gezien[String(it.label).toLowerCase()] = true;
      uit.push(it);
    }
    /* De naam van de app staat al boven het menu. Stond hij ook nog eens als
       enige tegel eronder (Reisboek, Table, Cellier hadden dat: hun <h2> is de
       titel van de pagina), dan leek het menu een functie te hebben die het
       niet heeft. Eén keer noemen is genoeg. */
    gezien[titel().toLowerCase()] = true;
    uitKnoppen('.rtgdeel-balk button', uit, gezien);
    /* De tweede rij van de navigatiebalk: daar zet shared/ios.js de filter- en
       tabrijen van de app neer ("Alles / Mensen / Werk / Officieel / Archief"
       in Berichten, "Feed / Ontdekken / Plaatsen" in De Salon). Dat IS wat die
       app doet, dus het is de beste bron die er is -- beter dan de kopjes van
       de inhoud, en op deze twee apps de enige. */
    uitKnoppen('.ios-nav-extra button, .ios-nav-extra a[href]', uit, gezien);
    uitKnoppen('[role="tab"], [data-tab], .tabs button', uit, gezien);
    uitKnoppen('.ios-nav-acties button, .ios-nav-acties a[href]', uit, gezien);
    if (!uit.length) uitSegment(uit, gezien);
    if (!uit.length) {
      /* Niets bedienbaars gevonden: dan maar de kopjes van de inhoud, als
         springpunten. Beter een inhoudsopgave dan een leeg menu. */
      var main = d.querySelector('main') || d.getElementById('main');
      var koppen = main ? main.querySelectorAll('h2, h3.sec') : [];
      for (var j = 0; j < koppen.length && uit.length < 6; j++) {
        var kop = koppen[j], t = labelVan(kop);
        if (!t || gezien[t.toLowerCase()]) continue;
        gezien[t.toLowerCase()] = true;
        uit.push({ label: t, spring: kop });
      }
    }
    return uit;
  }


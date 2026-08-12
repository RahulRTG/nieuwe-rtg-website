
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
    if (leeg === true && heeftRitme()) { toonRitme(); return; }
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

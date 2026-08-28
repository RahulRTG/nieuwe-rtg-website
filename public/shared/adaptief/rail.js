/* DE TRUST RAIL: de strook boven het dock die zegt hoe je werk ervoor staat.

   WAAROM DIT GEEN STATUSBALK HEET. Een statusbalk telt woorden. Deze strook
   beantwoordt de vier vragen die een mens in bedrijfssoftware stilletjes stelt
   en zelden hardop:

     Is dit opgeslagen?     Is dit veilig?
     Wie ziet dit?          Is de synchronisatie gelukt?

   Wie daar geen antwoord op krijgt, gaat het zelf controleren -- opnieuw
   opslaan, nog eens verversen, een collega bellen. Het antwoord staat hier dus
   continu, en zo rustig dat je het pas leest als je het zoekt.

   DRIE REGELS DIE HIER NIET MOGEN SNEUVELEN.

   1. ALLEEN GEMETEN TOESTAND. Wat hier staat komt van een bron die het echt
      weet: het scherm dat opslaat, de browser die de verbinding kent, de
      classificatie die aan het stuk hangt. Een geruststellend "alles in orde"
      dat niemand heeft gemeten is erger dan niets -- dan liegt de strook precies
      op het moment dat het ertoe doet (CANVAS.md).

   2. STATUS NOOIT OP KLEUR ALLEEN. Elk onderdeel draagt een woord. Goud betekent
      hier "vraagt aandacht" en is nooit de enige drager (ONTWERP.md par. 5).

   3. HIJ STOORT NIET. Rustig is de normale stand: klein, grijs, geen beweging.
      Wie typt ziet hem inzakken. Alleen iets wat aandacht vraagt komt naar
      voren, en dan één ding tegelijk.

   EN HIJ IS EEN INGANG. Tik op "Opgeslagen" en je krijgt te zien wanneer, welke
   versie, en of herstel beschikbaar is. Tik op "Privé" en je ziet wie het kan
   zien. De strook is dus niet dood -- hij is de verklaring achter de toestand,
   en dat is precies wat bedrijfssoftware zelden geeft.

   Levert window.RTGRail. */
(function (w, d) {
  'use strict';
  if (w.RTGRail) return;
  var A = w.RTGAdaptief;

  var rail = null, eigen = [], melding = null, klok = 0;

  function root() { return d.getElementById('rtgCommand'); }

  /* De strook hangt zichzelf op boven de balk, en hangt zichzelf opnieuw op als
     de werktafel is herbouwd (dat gebeurt zodra de stand wisselt: gesloten ->
     open na het inloggen). Zonder die tweede vraag wijst `rail` naar DOM die net
     is weggehaald -- dezelfde fout die de praat-laag hier ooit maakte. */
  function hecht() {
    var r = root();
    if (!r) { rail = null; return null; }
    if (rail && rail.parentNode && r.contains(rail)) return rail;
    var balk = r.querySelector('.cmd-balk');
    if (!balk) { rail = null; return null; }
    rail = d.createElement('div');
    rail.className = 'cmd-rail';
    rail.setAttribute('role', 'status');
    rail.setAttribute('aria-live', 'polite');
    balk.parentNode.insertBefore(rail, balk);
    return rail;
  }

  /* --------------------------------------------------- wat de rail zelf weet --
     Precies één ding: of er verbinding is. Dat is het enige wat deze laag zelf
     kan METEN; al het andere hoort van het scherm te komen dat het weet.

     En het staat er alleen als er IETS aan de hand is. "Online" bij elke pagina
     is ruis; "Offline · lokaal opgeslagen" is een antwoord op een vraag die je
     op dat moment echt hebt. */
  function verbinding() {
    if (w.navigator && w.navigator.onLine === false) {
      return { sleutel: 'verbinding', tekst: 'Offline', staat: 'aandacht',
        uitleg: ['Uw wijzigingen blijven op dit toestel staan.',
          'Zodra er weer verbinding is, wordt er gesynchroniseerd.'] };
    }
    return null;
  }

  /* -------------------------------------------------------------- tekenen -- */
  function teken() {
    var r = hecht();
    if (!r) return;
    var ctx = A ? A.context() : null;
    var uit = (ctx && Array.isArray(ctx.rail) ? ctx.rail : []).slice();
    eigen.forEach(function (x) { uit.push(x); });
    var v = verbinding();
    if (v) uit.push(v);
    uit = uit.filter(function (x) { return x && x.tekst; });

    r.textContent = '';
    r.hidden = !uit.length && !melding;
    if (melding) { r.appendChild(meldingRegel()); r.dataset.staat = 'melding'; return; }
    r.dataset.staat = uit.some(function (x) { return x.staat === 'aandacht'; }) ? 'aandacht' : 'rustig';
    uit.forEach(function (x, i) {
      if (i) r.appendChild(scheiding());
      r.appendChild(deel(x));
    });
  }

  function scheiding() {
    var s = d.createElement('span');
    s.className = 'rail-scheiding';
    s.setAttribute('aria-hidden', 'true');
    s.textContent = '·';
    return s;
  }

  /* Een onderdeel is een KNOP als er uitleg achter zit en anders een woord. Een
     knop die niets doet is erger dan tekst: hij belooft een verklaring die er
     niet is. */
  function deel(x) {
    var heeftUitleg = !!(x.uitleg && x.uitleg.length);
    var e = d.createElement(heeftUitleg ? 'button' : 'span');
    e.className = 'rail-deel' + (x.staat === 'aandacht' ? ' aandacht' : '') +
      (x.staat === 'bezig' ? ' bezig' : '');
    if (heeftUitleg) {
      e.type = 'button';
      e.setAttribute('aria-label', x.tekst + ', toon uitleg');
      e.onclick = function () { toonUitleg(x); };
    }
    /* Het teken staat VOOR het woord en nooit in plaats daarvan: een vinkje
       alleen is een kleur met een vorm eromheen, en dat leest niemand die
       kleuren niet ziet (ONTWERP.md par. 5). */
    if (x.teken) {
      var t = d.createElement('span');
      t.className = 'rail-teken';
      t.setAttribute('aria-hidden', 'true');
      t.textContent = x.teken;
      e.appendChild(t);
    }
    e.appendChild(d.createTextNode(x.tekst));
    return e;
  }

  function toonUitleg(x) {
    if (!w.RTGLagen) return;
    w.RTGLagen.lade({ titel: x.tekst, inhoud: function (lijf) {
      (x.uitleg || []).forEach(function (regel) {
        var p = d.createElement('p');
        p.className = 'rail-uitleg';
        p.textContent = regel;
        lijf.appendChild(p);
      });
      (x.acties || []).forEach(function (a) {
        if (!a || !a.naam || typeof a.doe !== 'function') return;
        var b = d.createElement('button');
        b.type = 'button'; b.className = 'lg-rij';
        b.textContent = a.naam;
        b.onclick = function () { w.RTGLagen.sluit(); a.doe(); };
        lijf.appendChild(b);
      });
    } });
  }

  /* ------------------------------------------------------------- meldingen --
     ONGEDAAN MAKEN WOONT HIER, en dat is geen plaatsgebrek maar de bedoeling.
     "Gearchiveerd · Ongedaan maken" is een TOESTAND van je werk, net als
     "Opgeslagen" -- en het staat op de plek waar je die toestand toch al leest,
     in plaats van in een blokje dat over je scherm heen schuift.

     De melding verdringt de rest van de strook zolang hij staat. Dat is met
     opzet: er is één ding aan de hand en dat is dit. */
  function meldingRegel() {
    var vak = d.createElement('div');
    vak.className = 'rail-melding';
    var t = d.createElement('span');
    t.textContent = melding.tekst;
    vak.appendChild(t);
    if (typeof melding.ongedaan === 'function') {
      var b = d.createElement('button');
      b.type = 'button';
      b.className = 'rail-ongedaan';
      b.textContent = melding.knop || 'Ongedaan maken';
      b.onclick = function () {
        var f = melding.ongedaan;
        wisMelding();
        try { f(); } catch (e) {}
      };
      vak.appendChild(b);
    }
    return vak;
  }
  function wisMelding() {
    if (klok) { w.clearTimeout(klok); klok = 0; }
    melding = null;
    teken();
  }
  /* De melding blijft staan zolang de weg terug er is, en verdwijnt daarna
     vanzelf. Acht seconden: lang genoeg om te lezen en te bedenken dat het toch
     niet de bedoeling was, kort genoeg om geen tweede statusregel te worden. */
  function meld(spec) {
    if (!spec || !spec.tekst) return;
    if (klok) w.clearTimeout(klok);
    melding = spec;
    teken();
    klok = w.setTimeout(function () { klok = 0; melding = null; teken(); }, spec.duur || 8000);
  }

  /* Een scherm dat zelf iets over zijn toestand te zeggen heeft (opgeslagen,
     classificatie, meelezers) meldt dat hier. Op sleutel, zodat een tweede
     melding over hetzelfde onderwerp de eerste vervangt en er nooit twee keer
     "Opgeslagen" naast elkaar komt te staan. */
  function zet(x) {
    if (!x || !x.sleutel) return;
    eigen = eigen.filter(function (y) { return y.sleutel !== x.sleutel; });
    if (x.tekst) eigen.push(x);
    teken();
  }

  if (A) A.opContext(teken);
  ['online', 'offline'].forEach(function (n) { w.addEventListener(n, teken); });

  w.RTGRail = { teken: teken, zet: zet, meld: meld, wis: wisMelding,
    staat: function () { return { eigen: eigen.slice(), melding: melding }; } };
})(window, document);

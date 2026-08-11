
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

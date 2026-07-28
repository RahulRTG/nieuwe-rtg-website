  /* Deel 2 van het bedieningspaneel: de rijen, het blad en de ingang.
     Deel 1 (bediening-01.js) opent de module en levert stijl(). */
  var scrim = null, blad = null;

  function rij(label, sub) {
    var r = d.createElement('div'); r.className = 'bdn-rij';
    var l = d.createElement('span');
    l.textContent = label;
    if (sub) { var s = d.createElement('small'); s.textContent = sub; l.appendChild(s); }
    var doe = d.createElement('span'); doe.className = 'bdn-do';
    r.appendChild(l); r.appendChild(doe);
    blad.appendChild(r);
    return doe;
  }

  function knopje(tekst, aan, doe) {
    var b = d.createElement('button'); b.type = 'button'; b.textContent = tekst;
    if (aan) b.className = 'actief';
    b.addEventListener('click', doe);
    return b;
  }

  /* ---- de rijen: elke laag die er is, krijgt er een ---- */
  function vulTaal() {
    if (!w.RTGi18n || !w.RTGi18n.openModal) return;
    var doe = rij(T('bdn.taal', 'Taal'), T('bdn.taal.sub', 'Typ of zeg in welke taal u dit scherm wilt lezen.'));
    doe.appendChild(knopje((w.RTGi18n.lang || 'nl').toUpperCase(), false, function () {
      sluit(); w.RTGi18n.openModal();
    }));
  }

  function vulThema() {
    if (!w.RTGRosThema || !w.RTGRosThema.themas) return;
    var doe = rij(T('bdn.thema', 'Weergave'), T('bdn.thema.sub', 'Uw keuze reist mee naar al uw RTG-schermen.'));
    w.RTGRosThema.themas.forEach(function (t) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'bdn-stip' + (w.RTGRosThema.huidig() === t.id ? ' actief' : '');
      b.style.background = t.stip; b.title = t.naam; b.setAttribute('aria-label', T('bdn.thema', 'Weergave') + ': ' + t.naam);
      b.addEventListener('click', function () {
        w.RTGRosThema.zet(t.id);
        doe.querySelectorAll('.bdn-stip').forEach(function (x) { x.classList.remove('actief'); });
        b.classList.add('actief');
      });
      doe.appendChild(b);
    });
  }

  function vulBeweging() {
    if (!w.RTGBeweging || !w.RTGBeweging.standen) return;
    var doe = rij(T('bdn.beweging', 'Beweging'), T('bdn.beweging.sub', 'Hoeveel het scherm mag leven. Stil is het rustigst.'));
    var teken = function () {
      doe.textContent = '';
      w.RTGBeweging.standen.forEach(function (s) {
        doe.appendChild(knopje(T('bdn.bw.' + s.n.toLowerCase(), s.n), Math.abs(w.RTGBeweging.waarde() - s.w) <= 8,
          function () { w.RTGBeweging.zet(s.w); teken(); }));
      });
    };
    teken();
  }

  /* Beeld draaien en volledig scherm: twee handelingen die over het scherm
     zelf gaan, dus ze horen in dit paneel en niet als losse pil in de hoek. */
  function vulBeeld() {
    if (!w.RTGscherm || !w.RTGscherm.draai) return;
    var doe = rij(T('bdn.beeld', 'Beeld'), T('bdn.beeld.sub', 'Draai het beeld een kwartslag, of vul het hele scherm.'));
    doe.appendChild(knopje(T('bdn.draai', 'Draaien'), false, function () { w.RTGscherm.draai(); }));
    var vol = knopje(T('bdn.vol', 'Volledig'), !!(w.RTGscherm.volledigAan && w.RTGscherm.volledigAan()), function () {
      w.RTGscherm.volledig();
      setTimeout(function () {
        vol.classList.toggle('actief', !!(w.RTGscherm.volledigAan && w.RTGscherm.volledigAan()));
      }, 120);
    });
    doe.appendChild(vol);
  }

  function vulUitleg() {
    if (!w.RTGUitleg || !w.RTGUitleg.open) return;
    var doe = rij(T('bdn.uitleg', 'Uitleg over dit scherm'), T('bdn.uitleg.sub', 'Wat u hier kunt doen, in gewone taal.'));
    doe.appendChild(knopje(T('bdn.open', 'Openen'), false, function () { sluit(); w.RTGUitleg.open(); }));
  }

  /* ---- het paneel ---- */
  function bouwBlad() {
    if (scrim) return;
    stijl();
    scrim = d.createElement('div'); scrim.className = 'bdn-scrim';
    blad = d.createElement('section');
    blad.className = 'bdn-blad'; blad.setAttribute('role', 'dialog');
    blad.setAttribute('aria-modal', 'true'); blad.setAttribute('aria-label', T('bdn.kop', 'Instellingen'));
    var kop = d.createElement('div'); kop.className = 'bdn-kop';
    var titel = d.createElement('b'); titel.textContent = T('bdn.kop', 'Instellingen');
    var x = d.createElement('button');
    x.type = 'button'; x.className = 'bdn-x'; x.textContent = '✕';
    x.setAttribute('aria-label', T('bdn.sluit', 'Sluiten'));
    x.addEventListener('click', sluit);
    kop.appendChild(titel); kop.appendChild(x);
    blad.appendChild(kop);
    var uit = d.createElement('p'); uit.className = 'bdn-uit';
    uit.textContent = T('bdn.uit', 'Alles wat u aan dit scherm kunt instellen, bij elkaar. Uw keuzes blijven op dit toestel.');
    blad.appendChild(uit);
    vulTaal(); vulThema(); vulBeweging(); vulBeeld(); vulUitleg();
    scrim.appendChild(blad);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) sluit(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluit(); });
    d.body.appendChild(scrim);
  }

  function open() { bouwBlad(); scrim.classList.add('open'); var f = blad.querySelector('button'); if (f) f.focus(); }
  function sluit() { if (scrim) scrim.classList.remove('open'); }


  /* Geen eigen ingang meer. Het paneel wordt opgeroepen zoals een
     besturingssysteem dat doet: slepen vanaf de bovenrand van het scherm
     (shared/randen.js). Een knop die permanent in beeld staat om iets te
     openen dat je zelden nodig hebt, is precies wat we hier aan het opruimen
     waren. Menu's en zoekschermen kunnen RTGBediening.open() aanroepen. */

  function start() {
    // het leden-OS heeft zijn eigen bedieningspaneel; daar niets bijbouwen
    if (d.getElementById('osCcScrim')) { w.RTGBediening = { open: function () {}, aanwezig: false }; return; }
    w.RTGBediening = { open: open, sluit: sluit, aanwezig: true };
  }

  // na de andere lagen, zodat we weten welke rijen er te maken zijn
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(start, 0); });
  else setTimeout(start, 0);
})(window, document);

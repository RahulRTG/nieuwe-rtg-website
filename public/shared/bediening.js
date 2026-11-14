/* HET BEDIENINGSPANEEL -- één plek voor de instellingen van dit scherm.

   Er dreven zes losse knopjes over elk scherm. Linksonder vier, waarvan drie
   boven op elkaar: de bewegingspil ("Rustig"), de themakiezer, de taalknop en
   het vraagteken van de app-gids. Rechtsboven nog twee: beeld draaien en
   volledig scherm. Ze horen bij elkaar, dus staan ze nu bij elkaar: in één
   paneel, achter één ingang. Het leden-OS had dit al -- daar zit alles in het
   bedieningspaneel -- en dit is datzelfde idee voor elk ander scherm.

   Er is geen knop om hem te openen: je haalt hem van de bovenrand omlaag,
   zoals een besturingssysteem dat doet (shared/randen.js). Op het leden-OS
   bouwt deze module niets -- daar bestaat het bedieningspaneel al, en de
   bovenrand opent dat.

   Elke rij verschijnt alleen als de bijbehorende laag echt geladen is. */
(function (w, d) {
  'use strict';
  if (w.RTGBediening) return;
  var T = function (k, nl) { return (w.RTGi18n && w.RTGi18n.t) ? w.RTGi18n.t(k, nl) : nl; };
  function laadBedieningStijl(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return;
    if (document.getElementById('rtgDsRuntimeCss')) return;
    var bedieningStijlLink = document.createElement('link');
    bedieningStijlLink.id = 'rtgDsRuntimeCss';
    bedieningStijlLink.rel = 'stylesheet';
    bedieningStijlLink.href = pad;
    document.head.appendChild(bedieningStijlLink);
  }
  function stijl() { laadBedieningStijl('/ds/rtg-ds.css'); }

  // deel 2 zet de rijen, het paneel en de ingang; zie bediening-02.js
  /* Deel 2 van het bedieningspaneel: de rijen, het blad en de ingang.
     Deel 1 (bediening-01.js) opent de module en levert stijl(). */
  var scrim = null, blad = null, terugFocus = null;

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
    var taalKnop = knopje((w.RTGi18n.lang || 'nl').toUpperCase(), false, function () {
      sluit(); w.RTGi18n.openModal();
    });
    // Een taalcode is een identificatie, geen vertaalbare zin ("EN" is ook
    // het Nederlandse woord "en"). De huidige taal blijft herkenbaar.
    taalKnop.setAttribute('translate', 'no');
    doe.appendChild(taalKnop);
  }

  function vulThema() {
    if (!w.RTGRosThema || !w.RTGRosThema.themas) return;
    var doe = rij(T('bdn.thema', 'Weergave'), T('bdn.thema.sub', 'Uw keuze reist mee naar al uw RTG-schermen.'));
    w.RTGRosThema.themas.forEach(function (t) {
      var b = d.createElement('button');
      b.type = 'button'; b.className = 'bdn-stip' + (w.RTGRosThema.huidig() === t.id ? ' actief' : '');
      b.textContent = t.naam;
      b.title = t.naam; b.setAttribute('aria-label', T('bdn.thema', 'Weergave') + ': ' + t.naam);
      b.setAttribute('aria-pressed', String(w.RTGRosThema.huidig() === t.id));
      b.addEventListener('click', function () {
        w.RTGRosThema.zet(t.id);
        doe.querySelectorAll('.bdn-stip').forEach(function (x) { x.classList.remove('actief'); x.setAttribute('aria-pressed', 'false'); });
        b.classList.add('actief'); b.setAttribute('aria-pressed', 'true');
      });
      doe.appendChild(b);
    });
  }

  function vulBeweging() {
    if (!w.RTGBeweging || !w.RTGBeweging.standen) return;
    var doe = rij(T('bdn.beweging', 'Beweging'), T('bdn.beweging.sub', 'Hoeveel het scherm mag leven. Stil is het rustigst.'));
    var teken = function (focusWaarde) {
      doe.textContent = '';
      w.RTGBeweging.standen.forEach(function (s) {
        var aan = Math.abs(w.RTGBeweging.waarde() - s.w) <= 8;
        var b = knopje(T('bdn.bw.' + s.n.toLowerCase(), s.n), aan,
          function () { w.RTGBeweging.zet(s.w); teken(s.w); });
        b.setAttribute('aria-pressed', String(aan)); doe.appendChild(b);
        if (focusWaarde === s.w) b.focus();
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

  /* Vul het scherm: het kader waar de app in staat laten vallen. Hoort bij
     Beeld, maar krijgt een eigen rij omdat het over de app gaat en niet over
     het toestel -- en omdat het overal geldt, niet alleen hier. */
  function vulVol() {
    if (!w.RTGVol || !w.RTGVol.mogelijk || !w.RTGVol.mogelijk()) return;
    var doe = rij(T('bdn.vol.kop', 'Vul het scherm'),
      T('bdn.vol.sub', 'De app rekt op tot de randen van uw beeldscherm. Uw keuze geldt voor alle apps.'));
    var k = knopje(T('bdn.vol.aan', 'Rand tot rand'), w.RTGVol.aan(), function () {
      if (!w.RTGVol.mogelijk()) return;
      w.RTGVol.wissel();
      k.classList.toggle('actief', w.RTGVol.aan());
      k.setAttribute('aria-pressed', String(w.RTGVol.aan()));
    });
    k.setAttribute('aria-pressed', String(w.RTGVol.aan()));
    doe.appendChild(k);
  }

  function vulUitleg() {
    if (!w.RTGGids || !w.RTGGids.open) return;
    var doe = rij(T('bdn.uitleg', 'Uitleg over dit scherm'), T('bdn.uitleg.sub', 'Wat u hier kunt doen, in gewone taal.'));
    doe.appendChild(knopje(T('bdn.open', 'Openen'), false, function () { sluit(); w.RTGGids.open(); }));
  }

  /* ---- het paneel ---- */
  function bouwBlad() {
    if (scrim && scrim.isConnected) return;
    stijl();
    scrim = d.createElement('dialog'); scrim.className = 'bdn-scrim ds-instellingen';
    blad = d.createElement('section');
    blad.className = 'bdn-blad ds-dialoog';
    var dialoog = scrim;
    dialoog.setAttribute('role', 'dialog'); dialoog.setAttribute('aria-modal', 'true');
    dialoog.setAttribute('aria-label', T('bdn.kop', 'Instellingen'));
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
    vulTaal(); vulThema(); vulBeweging(); vulBeeld(); vulVol(); vulUitleg();
    scrim.appendChild(blad);
    scrim.addEventListener('click', function (e) { if (e.target === scrim) sluit(); });
    scrim.addEventListener('cancel', function (e) { e.preventDefault(); sluit(); });
    d.body.appendChild(scrim);
  }

  function open() {
    if (scrim && scrim.isConnected && scrim.classList.contains('open')) return;
    // Lees bij een nieuwe opening de actuele keuzes bij dezelfde eigenaren.
    // Geen tweede voorkeurcache; een open paneel behoudt zijn focus/toestand.
    if (scrim) { scrim.remove(); scrim = null; blad = null; }
    bouwBlad();
    terugFocus = d.activeElement;
    scrim.classList.add('open');
    scrim.showModal(); // De browser beheert modaliteit, focus en inert.
    var f = blad.querySelector('button'); if (f) f.focus();
  }
  function sluit() {
    if (!scrim || !scrim.classList.contains('open')) return;
    scrim.classList.remove('open');
    if (scrim.open) scrim.close();
    if (terugFocus && terugFocus.isConnected) terugFocus.focus({ preventScroll: true });
    terugFocus = null;
  }


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

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
  function stijl() {
    if (d.getElementById('bdnCss')) return;
    var s = d.createElement('style'); s.id = 'bdnCss';
    s.textContent =
      '.bdn-scrim{position:fixed;inset:0;z-index:9995;display:none;align-items:flex-end;justify-content:center;' +
        'background:rgba(6,5,5,.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}' +
      '.bdn-scrim.open{display:flex;}' +
      '.bdn-blad{width:min(430px,100%);max-height:86vh;overflow-y:auto;' +
        'background:linear-gradient(180deg,#151312,#0C0C0B);color:#F4F1EC;' +
        'border:1px solid var(--line,rgba(255,255,255,.14));border-bottom:none;' +
        'border-radius:20px 20px 0 0;padding:1rem 1.1rem calc(env(safe-area-inset-bottom,0px) + 1.1rem);' +
        'font-family:Inter,system-ui,sans-serif;box-shadow:0 -18px 50px rgba(0,0,0,.5);}' +
      '@media (min-width:640px){.bdn-scrim{align-items:center;}' +
        '.bdn-blad{border-radius:20px;border-bottom:1px solid var(--line,rgba(255,255,255,.14));}}' +
      '.bdn-kop{display:flex;align-items:center;justify-content:space-between;margin-bottom:.2rem;}' +
      '.bdn-kop b{font-family:"Bodoni Moda",Georgia,serif;font-weight:500;font-size:1.18rem;letter-spacing:-.01em;}' +
      '.bdn-x{background:none;border:none;color:#8A8680;font-size:1rem;cursor:pointer;padding:.3rem .1rem;}' +
      '.bdn-x:hover{color:#F4F1EC;}' +
      '.bdn-uit{color:#8A8680;font-size:.73rem;line-height:1.5;margin:0 0 .7rem;}' +
      '.bdn-rij{display:flex;align-items:center;justify-content:space-between;gap:.8rem;' +
        'padding:.72rem 0;border-top:1px solid var(--line,rgba(255,255,255,.1));}' +
      '.bdn-rij > span{font-size:.86rem;}' +
      '.bdn-rij small{display:block;color:#8A8680;font-size:.7rem;line-height:1.45;margin-top:.12rem;}' +
      '.bdn-do{flex:0 0 auto;display:flex;gap:.35rem;align-items:center;}' +
      '.bdn-do button{background:rgba(255,255,255,.05);border:1px solid var(--line,rgba(255,255,255,.14));' +
        'color:#F4F1EC;border-radius:999px;padding:.4rem .8rem;font:600 .74rem Inter,system-ui,sans-serif;cursor:pointer;}' +
      '.bdn-do button:hover,.bdn-do button.actief{border-color:var(--gold,#A98F1C);}' +
      '.bdn-do button.actief{color:var(--gold,#A98F1C);}' +
      '.bdn-stip{width:22px;height:22px;border-radius:999px;padding:0;border:2px solid transparent;}' +
      '@media print{.bdn-scrim{display:none !important;}}';
    (d.head || d.documentElement).appendChild(s);
  }

  // deel 2 zet de rijen, het paneel en de ingang; zie bediening-02.js
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

  /* Vul het scherm: het kader waar de app in staat laten vallen. Hoort bij
     Beeld, maar krijgt een eigen rij omdat het over de app gaat en niet over
     het toestel -- en omdat het overal geldt, niet alleen hier. */
  function vulVol() {
    if (!w.RTGVol || !w.RTGVol.mogelijk || !w.RTGVol.mogelijk()) return;
    var doe = rij(T('bdn.vol.kop', 'Vul het scherm'),
      T('bdn.vol.sub', 'De app rekt op tot de randen van uw beeldscherm. Uw keuze geldt voor alle apps.'));
    var k = knopje(T('bdn.vol.aan', 'Rand tot rand'), w.RTGVol.aan(), function () {
      w.RTGVol.wissel();
      k.classList.toggle('actief', w.RTGVol.aan());
    });
    doe.appendChild(k);
  }

  /* Widgets op het bureaublad: hier stond een losse plus-knop voor te zweven. */
  function vulWidgets() {
    if (!w.RTGBureau || !w.RTGBureau.mogelijk || !w.RTGBureau.mogelijk()) return;
    var doe = rij(T('bdn.widgets', 'Widgets'), T('bdn.widgets.sub', 'Kaarten naast het scherm neerzetten of terugleggen.'));
    doe.appendChild(knopje(T('bdn.kiezen', 'Kiezen'), false, function () { sluit(); w.RTGBureau.kiezer(); }));
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
    vulTaal(); vulThema(); vulBeweging(); vulBeeld(); vulVol(); vulWidgets(); vulUitleg();
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

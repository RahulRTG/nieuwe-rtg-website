/* ================= DE WERELDSCHIL: het gedrag =================================

   Hoort bij shared/wereldschil.css. Eén vaste navigatie voor een hele wereld:
   onderaan op een telefoon, langs de zijkant op een desktop, met een tweede
   paneel waar het scherm breed genoeg is.

   DE WERELD LEVERT ZIJN BESTEMMINGEN, DEZE LAAG KENT ZE NIET. Net als de
   spatial shell (shared/rtg-schil.js) weet deze laag niet wat een bestemming
   betekent -- het is een naam, een pictogram, een adres en een lijst schermen
   die eronder vallen. Zodra deze laag zou weten wat "Campus" is, kruipt
   domeinkennis in de navigatielaag en kan een tweede wereld hem niet meer
   gebruiken.

     window.RTGWereld = {
       sleutel: 'rtf',
       bestemmingen: [
         { id:'thuis', naam:'Thuis', href:'index.html', glyf:'rtf',
           schermen:['index'] },
         ...
       ]
     };

   WAT DEZE LAAG BEWUST NIET DOET: routeren. Een tik op een bestemming is een
   gewone link naar een gewoon adres. Er komt geen router bij, geen
   history-manipulatie en geen tweede waarheid over "waar ben ik" -- dat weet
   de URL al. De actieve bestemming wordt dan ook uit de URL afgelezen en
   nergens bewaard.

   window.RTGWereldSchil = { hand, zetHand, opendNaast } */
(function (w, d) {
  'use strict';
  if (w.RTGWereldSchil) return;

  var HAND_SLEUTEL = 'rtg_hand';
  var wereld = w.RTGWereld;
  if (!wereld || !wereld.bestemmingen || !wereld.bestemmingen.length) return;

  /* EEN SCHIL HOORT NIET IN ZIJN EIGEN PANEEL. Het tweede paneel is een iframe,
     en dat frame is smaller dan 900px -- dus bouwde deze laag daarbinnen
     vrolijk de telefoonvariant op: een onderbalk in een paneel dat al naast een
     rail staat, met dezelfde zes bestemmingen. Twee navigaties in beeld die
     hetzelfde doen is erger dan een navigatie te weinig, want nu moet je kiezen
     welke je gelooft. shared/ios.js maakt dezelfde afweging voor zijn
     home-indicator; dit is dezelfde vraag met hetzelfde antwoord. */
  var inFrame = false;
  try { inFrame = w.self !== w.top; } catch (e) { inFrame = true; }
  if (inFrame) return;

  /* EN EEN SCHERM MAG HEM WEIGEREN. `<body data-ws-uit>` -- dezelfde spelling
     als data-ios-uit in shared/ios.js, want het is dezelfde soort uitzondering.
     Nodig voor schermen die de sessielaag toevallig dragen maar niet voor het
     gezin zijn: het Clubportaal vraagt om een clubcode en spreekt de bezoeker
     met u aan; een tab "Elke dag" met de gezinsagenda erachter hoort daar niet
     te staan. Liever een expliciet attribuut op dat ene scherm dan een lijst
     uitzonderingen in de kaart, want die lijst leest niemand meer terug. */
  if (d.body && d.body.hasAttribute('data-ws-uit')) return;

  /* ------------------------------------------------------------ handigheid */
  /* Links is de standaard, want een nieuwe gebruiker heeft geen instelling en
     de conventie is links. Wie wisselt, wisselt voor het hele huis: de sleutel
     draagt geen wereldnaam, zodat je hem niet in elke wereld opnieuw hoeft te
     zetten. Een voorkeur over je eigen hand is niet per app anders. */
  function leesHand() {
    try { return localStorage.getItem(HAND_SLEUTEL) === 'rechts' ? 'rechts' : 'links'; }
    catch (e) { return 'links'; }
  }
  function zetHand(hand) {
    var h = hand === 'rechts' ? 'rechts' : 'links';
    d.documentElement.setAttribute('data-hand', h);
    try { localStorage.setItem(HAND_SLEUTEL, h); } catch (e) {}
    meetRuimte();
    return h;
  }

  /* --------------------------------------------------- waar ben ik nu ----- */
  /* Uit de URL, en nergens anders vandaan. Een bestemming die zijn schermen
     niet noemt, dekt alleen zijn eigen href -- dan valt een scherm buiten de
     balk en licht er niets op, wat eerlijker is dan de verkeerde laten
     oplichten. */
  function huidigScherm() {
    var m = /\/([^\/?#]+)\.html?$/.exec(w.location.pathname);
    return m ? m[1].toLowerCase() : 'index';
  }
  function actieveBestemming() {
    var nu = huidigScherm();
    var lijst = wereld.bestemmingen;
    for (var i = 0; i < lijst.length; i++) {
      var b = lijst[i];
      var schermen = b.schermen || [];
      for (var j = 0; j < schermen.length; j++) {
        if (String(schermen[j]).toLowerCase() === nu) return b.id;
      }
    }
    return null;
  }

  /* ------------------------------------------------------------- pictogram */
  function glyfIn(ouder, naam) {
    var vak = d.createElement('span');
    vak.setAttribute('aria-hidden', 'true');
    vak.setAttribute('data-glyf', naam || '');
    ouder.appendChild(vak);
    try { if (w.RTGGlyf) w.RTGGlyf.vul(ouder); } catch (e) {}
    return vak;
  }

  /* --------------------------------------------------------------- de balk */
  var balk = null, paneel = null, naastAan = false, splitsKnop = null;

  function bouw() {
    balk = d.createElement('nav');
    balk.className = 'ws-balk';
    balk.setAttribute('aria-label', wereld.naam ? ('Navigatie ' + wereld.naam) : 'Hoofdnavigatie');

    var actief = actieveBestemming();
    wereld.bestemmingen.forEach(function (b) {
      var a = d.createElement('a');
      a.className = 'ws-doel';
      a.href = b.href;
      if (b.id === actief) a.setAttribute('aria-current', 'page');
      glyfIn(a, b.glyf);
      var lab = d.createElement('span');
      lab.textContent = b.naam;
      a.appendChild(lab);
      /* Gewapend om ernaast te openen? Dan is deze tik geen navigatie maar een
         paneel. De link blijft een link, dus zonder JS en met een middelklik
         werkt hij gewoon zoals hij eruitziet. */
      a.addEventListener('click', function (e) {
        if (!naastAan) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        openNaast(b.href, b.naam);
        wapen(false);
      });
      balk.appendChild(a);
    });

    var voet = d.createElement('div');
    voet.className = 'ws-voet';

    splitsKnop = d.createElement('button');
    splitsKnop.type = 'button';
    splitsKnop.className = 'ws-splits';
    splitsKnop.setAttribute('aria-pressed', 'false');
    splitsKnop.title = 'Open de volgende bestemming in een tweede paneel';
    glyfIn(splitsKnop, 'paneel');
    var sl = d.createElement('span'); sl.textContent = 'Naast'; splitsKnop.appendChild(sl);
    splitsKnop.addEventListener('click', function () {
      if (paneel) { sluitNaast(); return; }
      wapen(!naastAan);
    });
    voet.appendChild(splitsKnop);

    var handKnop = d.createElement('button');
    handKnop.type = 'button';
    handKnop.className = 'ws-hand';
    handKnop.title = 'Zet de balk aan de andere kant';
    glyfIn(handKnop, 'navigatie');
    var hl = d.createElement('span'); hl.textContent = 'Kant'; handKnop.appendChild(hl);
    handKnop.addEventListener('click', function () {
      var nu = d.documentElement.getAttribute('data-hand');
      zetHand(nu === 'rechts' ? 'links' : 'rechts');
    });
    voet.appendChild(handKnop);

    balk.appendChild(voet);
    d.body.appendChild(balk);
    d.body.setAttribute('data-ws', wereld.sleutel || '');
  }

  function wapen(aan) {
    naastAan = !!aan;
    if (splitsKnop) splitsKnop.setAttribute('aria-pressed', naastAan ? 'true' : 'false');
  }

  /* ------------------------------------------------------- tweede paneel -- */
  function openNaast(href, naam) {
    sluitNaast();
    paneel = d.createElement('aside');
    paneel.className = 'ws-paneel';
    paneel.setAttribute('aria-label', 'Tweede paneel: ' + naam);

    var kop = d.createElement('div');
    kop.className = 'ws-paneel-kop';
    var t = d.createElement('b'); t.textContent = naam; kop.appendChild(t);
    var x = d.createElement('button');
    x.type = 'button'; x.className = 'ws-paneel-dicht';
    x.setAttribute('aria-label', 'Sluit het tweede paneel');
    x.textContent = '×';
    x.addEventListener('click', sluitNaast);
    kop.appendChild(x);
    paneel.appendChild(kop);

    var f = d.createElement('iframe');
    if (window.RTGMedia && window.RTGMedia.kader) window.RTGMedia.kader(f);  // camera/microfoon doorgeven
    f.src = href;
    f.title = naam;
    paneel.appendChild(f);

    d.body.appendChild(paneel);
    d.body.setAttribute('data-ws-split', '');
    if (splitsKnop) splitsKnop.setAttribute('aria-pressed', 'true');
    meetRuimte();
  }

  function sluitNaast() {
    if (paneel) { paneel.remove(); paneel = null; }
    d.body.removeAttribute('data-ws-split');
    wapen(false);
    meetRuimte();
  }

  /* ----------------------------------------------------------- de ruimte -- */
  /* De balk staat vast en neemt dus nergens ruimte in. Zonder deze meting ligt
     hij over de laatste regels van elke pagina -- dezelfde fout die de
     cookiemelding hier al eens maakte. Op een breed scherm staat hij naast de
     inhoud en is de hoogte nul. */
  function meetRuimte() {
    if (!balk) return;
    var breed = w.matchMedia && w.matchMedia('(min-width:900px)').matches;
    var h = breed ? 0 : Math.ceil(balk.getBoundingClientRect().height);
    d.documentElement.style.setProperty('--ws-ruimte', h + 'px');
  }

  /* ------------------------------------------------------------- opstarten */
  function start() {
    if (!d.body) return;
    zetHand(leesHand());
    bouw();
    meetRuimte();
    if (w.requestAnimationFrame) w.requestAnimationFrame(meetRuimte);
    w.addEventListener('resize', meetRuimte);
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start);
  else start();

  w.RTGWereldSchil = {
    hand: leesHand,
    zetHand: zetHand,
    opendNaast: function () { return !!paneel; }
  };
})(window, document);

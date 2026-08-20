/* De wereldschil van de RTFoundation: welke bestemmingen er zijn, en welk
   scherm onder welke valt.

   WAAROM DIT HIER STAAT EN NIET IN 59 BESTANDEN. shared/wereldschil.js kent
   geen enkele wereld -- het is een naam, een pictogram, een adres en een lijst
   schermen. De invulling hoort bij de wereld, en deze bundel (sessie.js) zit
   al op elk gezinsscherm van de Foundation. Dat maakt dit de ene plek waar de
   kaart staat; zou elk scherm zijn eigen balk krijgen, dan zijn het over drie
   maanden 59 balken die net iets van elkaar verschillen.

   DE ZES BESTEMMINGEN ZIJN NIET BEDACHT. Het zijn de secties die de hub zelf
   al had ("Voor de kleinsten", "Leren en groeien", "Elke dag", "Ook hier voor
   je"), samengevat tot zes koppen. Elk van de 56 tegels op de hub viel al
   onder precies een ervan, dus er is niets verplaatst en niets verzonnen --
   alleen wat een lange lijst met koppen was, is nu een vaste balk.

   WAT ER BEWUST NIET IN ZIT. De professionele en bestuurlijke schermen van de
   Foundation (os-bestuur, os-donateur, os-vrijwilliger, kantoor, partner,
   clubswerk) dragen deze bundel niet en krijgen dus geen gezinsbalk. Dat is
   geen omissie: een bestuurder in het donateursportaal heeft niets aan een tab
   "Elke dag" met de gezinsagenda erachter. PLATFORM.md noemt die drie niveaus
   -- individu, professional, organisatie -- en dit is het eerste.

   EEN SCHERM DAT HIER NIET STAAT licht nergens op. Dat is met opzet: dan zie je
   dat het ontbreekt, terwijl een verkeerde tab die oplicht je de verkeerde kant
   op stuurt zonder dat iemand het merkt. */
(function (w, d) {
  'use strict';
  if (w.RTGWereld) return;

  var KAART = {
    sleutel: 'rtf',
    naam: 'RTFoundation',
    bestemmingen: [
      { id: 'thuis', naam: 'Thuis', href: 'index.html', glyf: 'rtf',
        schermen: ['index'] },

      { id: 'campus', naam: 'Campus', href: 'campus.html', glyf: 'diploma',
        schermen: ['campus', 'school', 'klas', 'leren', 'overhoren', 'schrijven',
          'schrift', 'projecten', 'toetsen', 'presenteren', 'studie', 'cv', 'werk',
          'beroepen', 'leerpaspoort', 'schoolbieb', 'bieb', 'geloofbieb', 'magazine',
          'bord', 'tellen', 'kleuren', 'memorie', 'verhaaltje', 'liedjes',
          'speeltuin', 'speelhal', 'arena', 'societeit'] },

      { id: 'dag', naam: 'Elke dag', href: 'agenda.html', glyf: 'agenda',
        schermen: ['agenda', 'keuken', 'ochtend', 'verjaardagen', 'klusjes',
          'gezondheid', 'babyboek', 'oppasinfo', 'reis', 'zakgeld', 'budget', 'geld'] },

      { id: 'samen', naam: 'Samen', href: 'vrienden.html', glyf: 'vrienden',
        schermen: ['vrienden', 'markt', 'contact', 'dromen', 'mijnbanden'] },

      { id: 'steun', naam: 'Steun', href: 'kompas.html', glyf: 'hart',
        schermen: ['kompas', 'rust', 'gevoel', 'veilig', 'pesten', 'steun',
          'hulpwijzer', 'opvoeden', 'rechten', 'mediawijs'] },

      { id: 'beheer', naam: 'Beheer', href: 'beheer.html', glyf: 'gear',
        schermen: ['beheer'] }
    ]
  };

  /* EEN WERELD CLAIMT ALLEEN ZIJN EIGEN SCHERMEN.

     Deze bundel zit op elk scherm in de Foundation-map dat een gezinssessie
     draagt -- en dat zijn er een paar die geen gezinsscherm ZIJN. Het
     Clubportaal is het duidelijkste geval: het vraagt om een clubcode, spreekt
     de bezoeker met u aan, en hoort bij de kantoorset in schil-os.js. Zonder
     deze controle zette dit bestand daar toch de gezinswereld neer, en omdat
     schil-os.js netjes afhaakt zodra er al een wereld staat, won de verkeerde
     van de twee -- met zes tabs die niet over zijn werk gaan en geen enkele
     die oplicht.

     De regel is dus dezelfde als in schil-os.js: staat dit scherm niet in mijn
     eigen kaart, dan is het niet van mij, en laat ik het aan de volgende. Een
     scherm dat in geen enkele kaart staat krijgt geen balk, en dat is eerlijker
     dan de verkeerde. */
  var m = /\/([^\/?#]+)\.html?$/.exec(w.location.pathname);
  var nu = m ? m[1].toLowerCase() : '';
  var vanMij = KAART.bestemmingen.some(function (b) {
    return (b.schermen || []).indexOf(nu) >= 0;
  });
  if (!vanMij) return;
  w.RTGWereld = KAART;

  /* Het blad en het gedrag erbij halen. Zelfde patroon als de verbindingslaag
     en de glyfen in sessie-00: de component brengt mee wat hij nodig heeft,
     zodat een scherm er niets voor hoeft te doen. De volgorde luistert niet --
     een script dat hier wordt ingehangen draait pas nadat deze bundel klaar is,
     en dan staat RTGWereld er dus al. */
  try {
    if (!d.querySelector('link[href="/shared/wereldschil.css"]')) {
      var blad = d.createElement('link');
      blad.rel = 'stylesheet';
      blad.href = '/shared/wereldschil.css';
      (d.head || d.documentElement).appendChild(blad);
    }
    if (!d.querySelector('script[src="/shared/wereldschil.js"]')) {
      var s = d.createElement('script');
      s.src = '/shared/wereldschil.js';
      (d.head || d.documentElement).appendChild(s);
    }
  } catch (e) {}
})(window, document);

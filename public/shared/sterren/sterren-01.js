/* RTG Sterrenhemel: een diepe, levende sterrenkoepel in huisstijl - de rust van
   een Rolls-Royce Starlight-hemel, maar dan een heel firmament, en op de plek
   waar je echt bent.

   - Een vast, heel dicht stofveld van duizenden minuscule punten geeft de
     indruk van ontelbaar veel sterren; daaroverheen draait heel traag een bol
     met helderder punten, met echte diepte.
   - Sterren lichten af en toe kort op; af en toe trekt een vallende ster over.
   - En de echte sterrenbeelden staan waar ze op DIT moment vanaf JOUW plek aan
     de hemel staan: met je locatie (na toestemming) en de tijd rekenen we per
     beeld de hoogte en het kompaskwadrant uit. Wat onder de horizon staat, laten
     we weg; wie op het zuidelijk halfrond kijkt, ziet het Zuiderkruis, wie in
     het noorden kijkt de Grote Beer. Zonder locatie vallen we terug op een
     schatting uit je tijdzone.

   Gebruik:  RTGSterren.hang(elementOfSelector, { dichtheid, helderheid });
   Geen afhankelijkheden, geen extern beeld. */
(function () {
  if (window.RTGSterren) return;
  var RAD = Math.PI / 180;

  var KLEUREN = [
    { c: [237, 231, 218], w: 0.70 },
    { c: [201, 162, 75], w: 0.22 },
    { c: [194, 58, 94], w: 0.08 }
  ];
  function kies(r) { var s = 0; for (var i = 0; i < KLEUREN.length; i++) { s += KLEUREN[i].w; if (r <= s) return KLEUREN[i].c; } return KLEUREN[0].c; }

  /* De echte sterrenbeelden: hun plek aan de hemel (ra in uren, dec in graden,
     J2000) en hun herkenbare vorm als genormaliseerde 2D-punten (0..1) met de
     verbindingslijnen. De vorm wordt op het scherm gezet rond de berekende
     hoogte/azimut; "grootte" is de hoogte in graden aan de hemel. */
  var BEELDEN = [
    { naam: 'Orion', ra: 5.55, dec: 2, grootte: 22,
      s: [[0.75,0.13],[0.28,0.18],[0.62,0.49],[0.50,0.52],[0.38,0.55],[0.70,0.86],[0.30,0.88],[0.52,0.02]],
      l: [[1,0],[0,7],[1,7],[1,2],[2,3],[3,4],[4,0],[2,5],[4,6],[5,6]] },
    { naam: 'Grote Beer', ra: 11.3, dec: 54, grootte: 26,
      s: [[0.08,0.22],[0.10,0.44],[0.30,0.46],[0.32,0.29],[0.53,0.23],[0.73,0.17],[0.93,0.10]],
      l: [[0,1],[1,2],[2,3],[3,0],[3,4],[4,5],[5,6]] },
    { naam: 'Cassiopeia', ra: 0.9, dec: 62, grootte: 16,
      s: [[0.05,0.42],[0.28,0.13],[0.50,0.47],[0.72,0.13],[0.95,0.42]],
      l: [[0,1],[1,2],[2,3],[3,4]] },
    { naam: 'Leeuw', ra: 10.6, dec: 16, grootte: 22,
      s: [[0.92,0.30],[0.74,0.24],[0.60,0.30],[0.60,0.52],[0.30,0.58],[0.08,0.66],[0.44,0.70],[0.74,0.40]],
      l: [[0,1],[1,2],[2,3],[3,7],[7,1],[3,4],[4,6],[6,5],[4,5]] },
    { naam: 'Schorpioen', ra: 16.8, dec: -30, grootte: 24,
      s: [[0.14,0.08],[0.24,0.14],[0.36,0.16],[0.46,0.26],[0.52,0.44],[0.56,0.62],[0.66,0.76],[0.80,0.82],[0.90,0.72],[0.86,0.58]],
      l: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8],[8,9]] },
    { naam: 'Zwaan', ra: 20.6, dec: 42, grootte: 20,
      s: [[0.5,0.05],[0.5,0.42],[0.5,0.7],[0.5,0.95],[0.18,0.34],[0.82,0.5]],
      l: [[0,1],[1,2],[2,3],[4,1],[1,5]] },
    { naam: 'Zuiderkruis', ra: 12.45, dec: -60, grootte: 9,
      s: [[0.50,0.04],[0.50,0.96],[0.14,0.52],[0.86,0.48]],
      l: [[0,1],[2,3]] }
  ];

  // sterrentijd en hoogte/azimut: waar staat een ra/dec nu, vanaf lat/lon?
  function lstGraden(lon, nu) {
    var jd = nu.getTime() / 86400000 + 2440587.5;
    var d = jd - 2451545.0;
    var gmst = 280.46061837 + 360.98564736629 * d;
    return ((gmst + lon) % 360 + 360) % 360;
  }
  function altAz(raUur, decGr, latGr, lonGr, nu) {
    var ha = (lstGraden(lonGr, nu) - raUur * 15) * RAD;
    var dec = decGr * RAD, lat = latGr * RAD;
    var alt = Math.asin(Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha));
    var az = Math.atan2(-Math.cos(dec) * Math.sin(ha), Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(ha));
    return { alt: alt / RAD, az: ((az / RAD) % 360 + 360) % 360 };
  }

  function hang(doel, opts) {
    doel = typeof doel === 'string' ? document.querySelector(doel) : doel;
    if (!doel) return null;
    opts = opts || {};
    var rustig = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    var cv = document.createElement('canvas');
    cv.className = 'rtg-sterren';
    cv.setAttribute('aria-hidden', 'true');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;display:block;';
    if (getComputedStyle(doel).position === 'static') doel.style.position = 'relative';
    doel.insertBefore(cv, doel.firstChild);
    var g = cv.getContext('2d');
    /* HIER STOND EEN TWEEDE DOEK voor het stofveld: duizenden puntjes werden er
       een keer in gebakken en daarna elk beeld met drawImage overgezet. Dat doek
       is weg, en daarmee de reden dat het overgrote deel van de hemel stilstond
       -- het stof beweegt nu zelf mee (zie zaaiStof/verfStof in deel 2). */

    var sterren = [], stofGroepen = [], meteoren = [], flonkers = [];
    var breedte = 0, hoogte = 0, straal = 0, cx = 0, cy = 0;
    var CAM = 2.4, helder = (opts.helderheid == null ? 1 : opts.helderheid);


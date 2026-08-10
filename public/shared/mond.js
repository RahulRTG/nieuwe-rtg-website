/* De RTG-signatuurmond: EEN mond voor het hele systeem, nu in 3D. Duizenden
   lichtpuntjes op een eigen canvas (geen extern beeld): bordeaux als basis, goud
   erdoorheen geweven, een enkel wit puntje als glinstering, en een gouden
   lichtgolf die om de paar seconden door de lippen trekt. De onderlip beweegt
   mee als Rahul "praat".

   Nieuw: waar WebGL kan, leeft de mond echt. Dezelfde puntenwolk krijgt diepte
   (de lippen bollen naar je toe), een zachte parallax die met de muis/kanteling
   meebeweegt, en additief oplichtende puntjes. Kan het toestel geen WebGL of
   wil de bezoeker minder beweging (prefers-reduced-motion), dan valt hij netjes
   terug op exact het bestaande 2D-beeld. Zelfde API, zelfde gezicht.

   Het puntenveld zelf (de lipvorm + diepte) is een pure functie die ook in Node
   draait en los getoetst is (test/mond.test.js).

   Gebruik: geef een <canvas width="440" height="200"> mee; het CSS bepaalt de
   getoonde maat. RTGMond.maak(canvas) tekent en geeft { praat(ms) } terug om de
   onderlip kort te laten bewegen. Het tekenen pauzeert zodra het canvas uit
   beeld is (offsetParent === null), dus het is goedkoop als het niet zichtbaar is. */
(function (root) {
  'use strict';

  /* ---- de pure kern: het puntenveld met diepte (ook in Node) ----
     De lipvormen als functies: de middellijn met cupidoboog, de boog van de
     bovenlip en de boog van de onderlip (mondhoeken op x=50 en x=170). Elk punt
     krijgt een z: de lippen bollen naar de kijker toe, de middellijn ligt terug. */
  function puntenVeld(rand) {
    var rnd = rand || Math.random;
    var PUNTEN = [];
    var midden = function (x) { return 52 - 6 * Math.exp(-Math.pow(x - 110, 2) / 98); };
    var boven = function (x) { var t = (x - 110) / 60; return 52 - 24 * Math.pow(Math.max(0, 1 - t * t), 0.8) + 7 * Math.exp(-Math.pow(x - 110, 2) / 72); };
    var onder = function (x) { var t = (x - 110) / 60; return 52 + 27 * Math.pow(Math.max(0, 1 - t * t), 0.9); };
    var bult = function (x) { return Math.exp(-Math.pow(x - 110, 2) / 2600); };   // lipvolume naar het midden toe
    for (var i = 0; i < 2400; i++) {
      var lip = rnd() < 0.45 ? 'b' : 'o';
      var x = 50 + rnd() * 120;
      var y1 = lip === 'b' ? boven(x) : midden(x), y2 = lip === 'b' ? midden(x) : onder(x);
      if (y2 - y1 < 0.8) continue;
      var r = rnd();
      var diep = (y2 - y1) > 0 ? (((y1 + (y2 - y1) / 2) - y1) / (y2 - y1)) : 0;
      // z: de bovenlip iets naar voren, de onderlip iets voller; puntjes aan de
      // rand van de lip liggen wat verder terug dan het midden van de lip
      var lipMidden = 1 - Math.abs((0.5 - ((((y1 + (y2 - y1) / 2)) - y1) / Math.max(0.001, y2 - y1))) * 2);
      var z = (lip === 'b' ? 0.20 : 0.26) * bult(x) * (0.55 + 0.45 * lipMidden);
      PUNTEN.push({ x: x, y: y1 + rnd() * (y2 - y1), lip: lip,
        fase: rnd() * Math.PI * 2, maat: 0.5 + rnd() * 0.9,
        kleur: r < 0.62 ? '#9E1C40' : (r < 0.9 ? '#C9A24B' : '#FFFFFF'),
        diep: diep, z: z });
    }
    // de gouden middellijn loopt door tot voorbij de mondhoeken en vervaagt; ligt terug
    for (var j = 0; j < 420; j++) {
      var mx = 14 + rnd() * 192;
      PUNTEN.push({ x: mx, y: midden(Math.min(170, Math.max(50, mx))) + (rnd() - 0.5) * 1.6,
        lip: 'm', fase: rnd() * Math.PI * 2, maat: 0.4 + rnd() * 0.7,
        kleur: '#C9A24B', rand: Math.min(1, Math.min(mx - 14, 206 - mx) / 55), diep: 0, z: -0.05 });
    }

    /* DE TEKENING IN HET MIDDEN VAN ZIJN EIGEN DOEK.

       Beide tekenaars gebruiken y=52 als draaipunt: WebGL rekent -(y-52)/60 en
       de 2D-terugval schaalt om diezelfde lijn. Maar de mond zelf loopt van
       ongeveer 35 tot 79, dus zijn werkelijke midden ligt op 57 -- vijf eenheden
       LAGER dan het draaipunt. Gevolg: de mond hing in zijn doek naar beneden,
       met bovenin een strook leegte. Op de poort was dat te zien als een gat
       tussen de wijzerplaat en de lippen: de dozen overlapten keurig 10px,
       maar de INKT begon pas 21px onder de klok. Twee keer heb ik dat aan de
       doos gemeten en niet aan wat er staat.

       Het midden wordt hier UITGEREKEND en niet ingetikt, zodat het klopt
       blijft als iemand de lipvormen aanpast. Meteen wordt het draaipunt van
       de "breed"-vervorming het echte midden, dus die duwt de mond nu ook niet
       meer scheef. */
    var laag = Infinity, hoog = -Infinity;
    for (var q = 0; q < PUNTEN.length; q++) {
      if (PUNTEN[q].lip === 'm') continue;          // de vervagende middellijn telt niet mee
      if (PUNTEN[q].y < laag) laag = PUNTEN[q].y;
      if (PUNTEN[q].y > hoog) hoog = PUNTEN[q].y;
    }
    if (laag < hoog) {
      var schuif = 52 - (laag + hoog) / 2;
      for (var w = 0; w < PUNTEN.length; w++) PUNTEN[w].y += schuif;
    }
    return PUNTEN;
  }

  /* ---- de spraakmotor: hoe een echte mond beweegt ----

     Een sinus op de onderlip leest als een pratende brievenbus. Een echte mond
     doet drie dingen tegelijk, en juist de combinatie maakt het levend:

       kaak     de onderlip zakt met de kaak mee -- traag, want een kaak heeft
                massa. Dit is de grootste beweging en loopt achter op de rest.
       spreiding een "ie" trekt de mondhoeken breed en maakt de lippen dun; een
                "oe" duwt ze samen en vooruit. Dat is een aparte spier en dus
                een aparte, snellere golf.
       ronding  de tuit: lippen naar voren, mondhoeken naar binnen.

     Die drie samen zijn in de praktijk wat animators visemen noemen. We wekken
     ze met drie trage ruisgolven van verschillende snelheid, zodat er nooit een
     herkenbaar patroon ontstaat -- spraak is onregelmatig, en precies dat
     onregelmatige overtuigt. Er zit ook stilte in: tussen twee lettergrepen valt
     de mond even bijna dicht, en aan het eind van een zin sluit hij helemaal.

     Alles is een pure functie van de tijd, dus zowel WebGL als 2D gebruiken hem
     en hij is in Node te toetsen. */
  function golfje(t, snelheid, zaad) {   // vloeiende pseudo-ruis, [0,1]
    var x = t * snelheid + zaad;
    return 0.5 + 0.5 * (Math.sin(x) * 0.6 + Math.sin(x * 1.7 + 1.3) * 0.3 + Math.sin(x * 2.9 + 2.7) * 0.1);
  }
  /* De stand van de mond op tijdstip t, gegeven hoe lang er nog gepraat wordt.
     Geeft: kaak (0..1 open), breed (-1 getuit .. +1 gespreid), duw (0..1 naar
     voren), scheef (kleine asymmetrie: geen mens is symmetrisch). */
  function mondStand(t, praatTot) {
    var over = praatTot - t;
    if (over <= 0) return { kaak: 0, breed: 0, duw: 0, scheef: 0 };
    // in- en uitloop: een zin begint en eindigt niet met een klap
    var aan = Math.min(1, Math.max(0, over / 180));                  // laatste 180ms: dichtvallen
    var lettergreep = golfje(t, 0.011, 0);                           // ~2,5 per seconde: het ritme
    var stilte = Math.max(0, 1 - Math.pow(Math.max(0, lettergreep - 0.28) / 0.72, 0.7));
    var kaak = Math.max(0, lettergreep - 0.26) / 0.74;               // onder de drempel is de mond dicht
    kaak = Math.pow(kaak, 1.35) * (1 - stilte * 0.55) * aan;         // niet-lineair: dicht blijft dicht
    var breed = (golfje(t, 0.0072, 11.3) - 0.5) * 2 * (0.35 + 0.65 * kaak) * aan;
    var duw = Math.max(0, -breed) * 0.8 * aan;                       // getuit = naar voren
    var scheef = (golfje(t, 0.0041, 27.1) - 0.5) * 0.22 * aan;
    return { kaak: kaak, breed: breed, duw: duw, scheef: scheef };
  }

  var api = { puntenVeld: puntenVeld, mondStand: mondStand };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }

  /* ---- vanaf hier: alleen in de browser ---- */
  if (root.RTGMond) return;
  var RUSTIG = root.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hex(h) { return [parseInt(h.substr(1, 2), 16) / 255, parseInt(h.substr(3, 2), 16) / 255, parseInt(h.substr(5, 2), 16) / 255]; }

  /* ---- 3D: de puntenwolk als levend beeld met diepte + parallax ---- */
  var VERT =
    'attribute vec3 aPos; attribute vec3 aKleur; attribute vec4 aExtra; attribute float aRand;' +
    'uniform float uTijd, uGolf, uYaw, uPitch, uDpr;' +
    'uniform float uKaak, uBreed, uDuw, uScheef;' +
    'varying vec3 vKleur; varying float vAlpha;' +
    'void main(){' +
    ' float maat=aExtra.x, fase=aExtra.y, lip=aExtra.z, diep=aExtra.w;' +
    ' vec3 p=aPos;' +
    /* De mond als spierstelsel in plaats van een scharnier:
       - de kaak trekt de onderlip omlaag, het sterkst in het midden en bijna
         niet aan de mondhoeken (die zitten vast aan het gezicht);
       - de bovenlip komt een fractie mee omhoog -- dat is wat je tanden laat
         vermoeden zonder ze te tekenen;
       - spreiden maakt de mond breder EN dunner, tuiten juist smaller, voller
         en naar voren. Dat is het verschil tussen "ie" en "oe".
       - een scheve trek van een paar procent haalt het laatste robotachtige
         eruit; echte gezichten zijn nooit symmetrisch. */
    ' float hoek=1.0-clamp(abs(p.x),0.0,1.0);' +                       // 1 in het midden, 0 aan de mondhoek
    ' float mid=smoothstep(0.0,1.0,hoek);' +
    ' float open=uKaak*mid;' +
    ' if(lip>0.5){ p.y -= open*(0.30+0.34*diep); p.z += open*0.14; }' + // onderlip zakt en puilt
    ' else if(lip<0.5 && aRand>0.99){ p.y += open*0.055*mid; }' +       // bovenlip licht mee omhoog
    ' p.x *= 1.0 + uBreed*0.12*(1.0-mid*0.4);' +                        // spreiden/tuiten in de breedte
    ' p.y *= 1.0 - uBreed*0.13*mid;' +                                  // gespreid = dunner, getuit = voller
    ' p.z += uDuw*0.16*mid;' +                                          // de tuit komt naar je toe
    ' p.y += uScheef*mid*(0.5+0.5*sign(p.x));' +                        // asymmetrie: één hoek net iets hoger
    ' float cy=cos(uYaw), sy=sin(uYaw), cx=cos(uPitch), sx=sin(uPitch);' +
    ' vec3 a=vec3(cy*p.x+sy*p.z, p.y, -sy*p.x+cy*p.z);' +
    ' vec3 b=vec3(a.x, cx*a.y-sx*a.z, sx*a.y+cx*a.z);' +
    ' float persp=1.7/(1.7-b.z*0.6);' +
    ' gl_Position=vec4(b.x*persp, b.y*persp, 0.0, 1.0);' +
    ' gl_PointSize=maat*persp*4.2*uDpr;' +
    ' float mx=aPos.x*110.0+110.0;' +                                    // terug naar mond-x voor de golf
    /* De glansveeg, getemd: /420 + 0,9 alpha + 85% naar wit gaf een uitgeblazen
       witte veeg over de halve mond. Glans die je OPMERKT is plastic
       (MATERIAAL.md). mond-02.js draagt dezelfde getallen. */
    ' float dg=mx-uGolf; float golf=exp(-(dg*dg)/150.0);' +              // geen pow() met mogelijk negatieve basis (undefined in GLSL)
    ' float twinkel=0.45+0.4*sin(fase+uTijd/700.0);' +
    ' vAlpha=min(1.0, twinkel*aRand + golf*0.30);' +
    ' vKleur=mix(aKleur, vec3(0.96,0.90,0.72), clamp(golf*0.45,0.0,0.26));' +
    '}';
  var FRAG =
    'precision mediump float; varying vec3 vKleur; varying float vAlpha;' +
    'void main(){ vec2 d=gl_PointCoord-0.5; float r=length(d); if(r>0.5) discard;' +
    // zacht rond puntje; premultiplied kleur (rgb*a) voor additieve gloed op een doorzichtig canvas
    ' float a=vAlpha*(1.0-r*1.9); if(a<=0.0) discard; gl_FragColor=vec4(vKleur*a, a); }';

  function schaduw(gl, type, bron) { var s = gl.createShader(type); gl.shaderSource(s, bron); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }

  function maak3D(canvas, PUNTEN) {
    var gl = null;
    // premultiplied (standaard) voor nette gloed; preserveDrawingBuffer houdt het
    // laatste beeld staan als de rAF-lus even pauzeert (geen flikkering)
    try { gl = canvas.getContext('webgl', { alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { gl = null; }
    if (!gl) return null;
    var vs = schaduw(gl, gl.VERTEX_SHADER, VERT), fs = schaduw(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return null;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    // buffers vullen (normaliseer x,y naar [-1,1]-achtig; z is al klein)
    var n = PUNTEN.length;
    var pos = new Float32Array(n * 3), kol = new Float32Array(n * 3), ext = new Float32Array(n * 4), rnd = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var p = PUNTEN[i];
      pos[i * 3] = (p.x - 110) / 110; pos[i * 3 + 1] = -(p.y - 52) / 60; pos[i * 3 + 2] = p.z;
      var c = hex(p.kleur); kol[i * 3] = c[0]; kol[i * 3 + 1] = c[1]; kol[i * 3 + 2] = c[2];
      ext[i * 4] = p.maat; ext[i * 4 + 1] = p.fase; ext[i * 4 + 2] = p.lip === 'o' ? 1 : 0; ext[i * 4 + 3] = p.diep || 0;
      rnd[i] = p.rand == null ? 1 : p.rand;
    }
    function buf(data, comp, naam) {
      var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, naam); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, comp, gl.FLOAT, false, 0, 0);
    }
    buf(pos, 3, 'aPos'); buf(kol, 3, 'aKleur'); buf(ext, 4, 'aExtra'); buf(rnd, 1, 'aRand');
    var U = {}; ['uTijd', 'uGolf', 'uYaw', 'uPitch', 'uDpr', 'uKaak', 'uBreed', 'uDuw', 'uScheef'].forEach(function (u) { U[u] = gl.getUniformLocation(prog, u); });
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);   // additief (premultiplied): de puntjes gloeien op, ook doorzichtig
    var dpr = Math.min(2, root.devicePixelRatio || 1);
    // muis/kanteling voor de parallax
    var muisX = 0, muisY = 0;
    canvas.addEventListener('pointermove', function (e) { var r = canvas.getBoundingClientRect(); muisX = (e.clientX - r.left) / r.width - 0.5; muisY = (e.clientY - r.top) / r.height - 0.5; });
    if (root.DeviceOrientationEvent) root.addEventListener('deviceorientation', function (e) { if (e.gamma != null) { muisX = Math.max(-0.5, Math.min(0.5, e.gamma / 45)); muisY = Math.max(-0.5, Math.min(0.5, (e.beta - 40) / 45)); } }, true);
    /* De kaak heeft massa: hij haalt de doelstand niet meteen, en hij komt ook
       niet meteen tot stilstand. Een simpele veerdemping per frame doet dat
       werk -- dat is het verschil tussen een pratende mond en een knipperlicht.
       De lipspieren zijn lichter en volgen sneller. */
    var kaak = 0, kaakV = 0, breed = 0, duw = 0, scheef = 0, vorigeT = 0;
    return {
      teken: function (t, praatTot) {
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        var dt = vorigeT ? Math.min(0.05, (t - vorigeT) / 1000) : 0.016; vorigeT = t;
        var doel = mondStand(t, praatTot);
        // veer-demper voor de kaak (stijfheid 260, demping bijna kritisch: geen wiebel)
        kaakV += (doel.kaak - kaak) * 260 * dt - kaakV * 26 * dt;
        kaak += kaakV * dt;
        var volg = Math.min(1, dt * 14);                       // lippen: sneller, zonder veergedrag
        breed += (doel.breed - breed) * volg;
        duw += (doel.duw - duw) * volg;
        scheef += (doel.scheef - scheef) * volg;
        var golf = ((t / 4200) % 1) * 260 - 20;
        var yaw = Math.sin(t / 2600) * 0.18 + muisX * 0.5;
        var pitch = Math.sin(t / 3400) * 0.06 + muisY * 0.3;
        gl.uniform1f(U.uTijd, t); gl.uniform1f(U.uGolf, golf);
        gl.uniform1f(U.uKaak, kaak); gl.uniform1f(U.uBreed, breed);
        gl.uniform1f(U.uDuw, duw); gl.uniform1f(U.uScheef, scheef);
        gl.uniform1f(U.uYaw, yaw); gl.uniform1f(U.uPitch, pitch); gl.uniform1f(U.uDpr, dpr);
        gl.drawArrays(gl.POINTS, 0, n);
      },
      // stil genoeg om te mogen stoppen met tekenen? (mond dicht en in rust)
      rust: function () { return kaak < 0.004 && Math.abs(kaakV) < 0.02 && Math.abs(breed) < 0.01; }
    };
  }

  function maak(canvas) {
    if (!canvas || canvas.dataset.rtgMondActief) return { praat: function () {} };
    canvas.dataset.rtgMondActief = '1';
    var PUNTEN = puntenVeld();
    var praatTot = 0;
    var praat = function (ms) { praatTot = performance.now() + ms; };

    /* Doortekenen kost stroom, dus alleen doen als het ergens toe leidt: het
       canvas moet in beeld zijn (IntersectionObserver in plaats van een
       eeuwige setTimeout-poll), het tabblad zichtbaar, en de mond mag niet al
       stilstaan. Staat hij stil, dan wacht hij op de eerstvolgende praat().
       Zonder dit bleef de poort-mond na het inloggen voorgoed rekenen. */
    var inBeeld = true, loopt = false;
    if (root.IntersectionObserver) {
      inBeeld = false;
      new IntersectionObserver(function (rijen) {
        inBeeld = rijen.some(function (r) { return r.isIntersecting; });
        if (inBeeld) wek();
      }, { threshold: 0.01 }).observe(canvas);
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) wek(); });
    var wek = function () {};   // wordt hieronder gevuld zodra de tekenaar bekend is

    // de levende 3D-mond waar het kan; anders het vertrouwde 2D-beeld
    var d3 = RUSTIG ? null : maak3D(canvas, PUNTEN);
    if (d3) {
      var lus3 = function () {
        loopt = true;
        if (!inBeeld || document.hidden) { loopt = false; return; }
        var t = performance.now();
        d3.teken(t, praatTot);
        if (t > praatTot && d3.rust()) { loopt = false; return; }   // klaar met praten en uitgetrild
        requestAnimationFrame(lus3);
      };
      wek = function () { if (!loopt && inBeeld && !document.hidden) requestAnimationFrame(lus3); };
      var praat3 = function (ms) { praat(ms); wek(); };
      requestAnimationFrame(lus3);
      return { praat: praat3 };
    }

    /* ---- 2D-terugval: hetzelfde gezicht, dezelfde spraak, zonder WebGL ----
       Ook hier is de tekenlus opnieuw opgezet: kleuren worden gegroepeerd
       getekend (één fillStyle per kleur in plaats van per puntje) en de alpha
       gaat in vier stappen. Dat scheelt duizenden statewissels per frame --
       precies wat een oudere telefoon liet stotteren. */
    var mctx = canvas.getContext('2d');
    if (!mctx) return { praat: praat };
    var dpr2 = Math.min(2, root.devicePixelRatio || 1);
    canvas.width = 440 * (dpr2 / 2) * 2; canvas.height = 200 * (dpr2 / 2) * 2;
    var GROEP = {};                              // kleur -> [punten], alpha in 4 banden
    for (var gi = 0; gi < PUNTEN.length; gi++) { var gp = PUNTEN[gi]; (GROEP[gp.kleur] = GROEP[gp.kleur] || []).push(gp); }
    var kleuren = Object.keys(GROEP);
    var k2 = 0, kv2 = 0, br2 = 0, du2 = 0, sc2 = 0, vorig2 = 0;
    function verf(t) {
      var dt = vorig2 ? Math.min(0.05, (t - vorig2) / 1000) : 0.016; vorig2 = t;
      var doel = mondStand(t, praatTot);
      kv2 += (doel.kaak - k2) * 260 * dt - kv2 * 26 * dt; k2 += kv2 * dt;
      var volg = Math.min(1, dt * 14);
      br2 += (doel.breed - br2) * volg; du2 += (doel.duw - du2) * volg; sc2 += (doel.scheef - sc2) * volg;
      mctx.setTransform(1, 0, 0, 1, 0, 0);
      mctx.clearRect(0, 0, canvas.width, canvas.height);
      mctx.scale(canvas.width / 220, canvas.height / 100);
      /* De WebGL-tekenaar draait om y=52, deze om het midden van 0..100 (dus
         50). Zonder deze twee eenheden staat dezelfde mond in de terugval twee
         eenheden hoger dan in de hoofdweg -- klein, maar dan is het niet meer
         dezelfde mond. */
      mctx.translate(0, -2);
      var golf = ((t / 4200) % 1) * 260 - 20;
      for (var ki = 0; ki < kleuren.length; ki++) {
        var lijst = GROEP[kleuren[ki]];
        for (var band = 0; band < 4; band++) {
          mctx.globalAlpha = 0.25 + band * 0.25;
          mctx.fillStyle = kleuren[ki];
          var begonnen = false;
          for (var i = 0; i < lijst.length; i++) {
            var p = lijst[i];
            /* Zelfde veeg als in de WebGL-weg (mond-01b.js): smaller (/150) en een
               derde van de alpha. Wijkt deze af, dan heeft dezelfde mond twee
               gezichten -- en dan zie je op een oud toestel iets anders. */
            var gloed = Math.exp(-Math.pow(p.x - golf, 2) / 150);
            if (gloed > 0.45) continue;                       // die zitten in de gloed-pas hieronder
            var a = Math.min(1, (0.45 + 0.4 * Math.sin(p.fase + t / 700)) * (p.rand == null ? 1 : p.rand) + gloed * 0.30);
            if (Math.min(3, Math.floor(a * 4)) !== band) continue;
            var hoek = 1 - Math.min(1, Math.abs(p.x - 110) / 60), mid = hoek * hoek * (3 - 2 * hoek);
            var open = k2 * mid;
            var x = 110 + (p.x - 110) * (1 + br2 * 0.12 * (1 - mid * 0.4));
            var y = 52 + (p.y - 52) * (1 - br2 * 0.13 * mid) + sc2 * mid * 6 * (p.x > 110 ? 1 : 0.2);
            if (p.lip === 'o') y += open * (16 + 18 * p.diep);
            mctx.fillRect(x, y, p.maat, p.maat);
            begonnen = true;
          }
          if (!begonnen) continue;
        }
      }
      // de gouden lichtgolf als aparte, korte pas (weinig punten, dus goedkoop)
      mctx.globalAlpha = 0.26; mctx.fillStyle = '#F5E6B8';
      for (var j = 0; j < PUNTEN.length; j++) {
        var q = PUNTEN[j];
        if (Math.exp(-Math.pow(q.x - golf, 2) / 150) <= 0.45) continue;
        var h2 = 1 - Math.min(1, Math.abs(q.x - 110) / 60), m2 = h2 * h2 * (3 - 2 * h2);
        var qy = 52 + (q.y - 52) * (1 - br2 * 0.13 * m2);
        if (q.lip === 'o') qy += k2 * m2 * (16 + 18 * q.diep);
        mctx.fillRect(110 + (q.x - 110) * (1 + br2 * 0.12 * (1 - m2 * 0.4)), qy, q.maat, q.maat);
      }
      mctx.globalAlpha = 1;
    }
    if (RUSTIG) { verf(0); return { praat: praat }; }
    var lus2 = function () {
      loopt = true;
      if (!inBeeld || document.hidden) { loopt = false; return; }
      var t = performance.now();
      verf(t);
      if (t > praatTot && k2 < 0.004 && Math.abs(kv2) < 0.02) { loopt = false; return; }
      requestAnimationFrame(lus2);
    };
    wek = function () { if (!loopt && inBeeld && !document.hidden) requestAnimationFrame(lus2); };
    requestAnimationFrame(lus2);
    return { praat: function (ms) { praat(ms); wek(); } };
  }

  /* De mond als knop-icoon: HET vaste gezicht van Rahul, overal hetzelfde. Geef
     een knop mee; er komt een klein mond-canvas in (met een toegankelijk label
     op de knop zelf). Geeft { praat } terug zodat de knop kan "meepraten". */
  function fab(knop, hoogte) {
    if (!knop || knop.dataset.rtgMondFab) return { praat: function () {} };
    knop.dataset.rtgMondFab = '1';
    var c = document.createElement('canvas');
    c.width = 440; c.height = 200;
    c.style.cssText = 'display:block;width:' + (hoogte ? hoogte * 2.2 : 3.4) + 'rem;height:auto;pointer-events:none;';
    c.setAttribute('aria-hidden', 'true');
    knop.textContent = '';
    knop.appendChild(c);
    return maak(c);
  }

  root.RTGMond = { maak: maak, fab: fab, puntenVeld: puntenVeld, mondStand: mondStand };
})(typeof self !== 'undefined' ? self : this);

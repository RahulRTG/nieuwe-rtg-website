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


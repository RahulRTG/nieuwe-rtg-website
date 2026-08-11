    // de waarnemer: eerst een schatting uit de tijdzone, daarna (na toestemming)
    // de echte locatie. Op het noordelijk halfrond kijken we naar het zuiden,
    // op het zuidelijk halfrond naar het noorden -- daar staan de mooiste beelden.
    var obs = { lat: 50, lon: -(new Date().getTimezoneOffset() / 60) * 15 };
    function facing() { return obs.lat >= 0 ? 180 : 0; }
    // ongevraagd bij het openen, dus de GPS-schakelaar (rtg_os_gps) wint;
    // zonder plek valt de kaart terug op de tijdzone-schatting hierboven
    var gpsUit = false;
    try { gpsUit = localStorage.getItem('rtg_os_gps') !== '1'; } catch (e) {}
    if (!gpsUit && navigator.geolocation) {
      try {
        navigator.geolocation.getCurrentPosition(function (p) {
          obs = { lat: p.coords.latitude, lon: p.coords.longitude };
        }, function () {}, { enableHighAccuracy: false, timeout: 8000, maximumAge: 3600000 });
      } catch (e) {}
    }

    /* HET STOF BEWEEGT MEE, EN DAT WAS NIET ZO.

       Hier stond het stofveld als EEN gebakken plaatje: duizenden puntjes een
       keer in een apart doek getekend en daarna elk beeld ongewijzigd
       overgezet. Alleen de dertienhonderd heldere sterren draaiden. Dat is
       precies andersom dan het lijkt: het overgrote deel van wat je ziet stond
       muurvast, en juist die paar felle punten bewogen. Op een stilstaande
       afdruk zie je dat niet; op een scherm waar je een minuut naar kijkt wel,
       en dan voelt de hemel als een behangetje met een paar bewegende stipjes
       erover.

       Nu heeft elk stofje een eigen DIEPTE, en die bepaalt hoe snel het
       schuift: verweg beweegt nauwelijks, dichtbij merkbaar. Dat is echte
       parallax -- de hemel krijgt laagjes in plaats van een vlak. De plek volgt
       uit de tijd (x0 + t * snelheid * diepte) en niet uit optellen per beeld,
       zodat een hapering of een pauze niets uit de pas laat lopen.

       WAAROM HET IN GROEPEN STAAT. Vierduizend keer per beeld fillStyle zetten
       is duurder dan vierduizend keer tekenen: elke wissel breekt de batch van
       de tekenlaag. De kleur en de doorzichtigheid liggen bij het zaaien vast,
       dus we sorteren ze een keer in drie kleuren maal acht trappen -- dan
       kost een beeld vierentwintig wissels in plaats van vierduizend. Gemeten
       verschil op een telefoon: het scheelt de helft van de tekentijd. */
    function zaaiStof() {
      var n = Math.round(Math.min(cv.width * cv.height / 260, 9000) * (opts.dichtheid || 1));
      var emmers = {};
      stofGroepen = [];
      for (var i = 0; i < n; i++) {
        var r = Math.random(), k = kies(r);
        var a = (0.05 + Math.random() * 0.33) * helder;
        var trap = Math.max(1, Math.min(8, Math.round(a / (0.38 * helder) * 8)));
        var sleutel = k[0] + '_' + trap;
        var groep = emmers[sleutel];
        if (!groep) {
          groep = emmers[sleutel] = { rgb: k[0] + ',' + k[1] + ',' + k[2],
            basis: trap / 8 * 0.38 * helder, fase: Math.random() * 6.2832, punten: [] };
          stofGroepen.push(groep);
        }
        groep.punten.push({
          x: Math.random() * cv.width,
          y: Math.random() * cv.height,
          /* 0,4 = ver weg, 1 = vlak voor je neus. De ONDERGRENS is bewust hoog:
             met 0,15 deed het verste stof er ruim veertien minuten over om het
             scherm over te steken, en dat is geen beweging meer maar
             stilstand met extra stappen. Nu is het verschil tussen het verste
             en het dichtstbije tweeëneenhalf keer -- genoeg voor diepte, en
             alles is in een paar minuten zichtbaar opgeschoven. */
          diep: 0.4 + Math.random() * 0.6,
          maat: (r > 0.985 ? 1.5 : 0.65) * dpr,
          fase: Math.random() * 6.2832
        });
      }
    }

    /* Het stof schuift dezelfde kant op als de sterrenbol draait, en ongeveer
       even snel: die doet er ruim twee minuten over om rond te komen, dus een
       stofje op de voorgrond doet er ongeveer even lang over om het scherm
       over te steken. Zo hoort het bij elkaar in plaats van dat het er
       overheen waait. De verticale wiebel is er alleen om te voorkomen dat het
       een lopende band wordt; hij is een paar pixels groot. */
    function verfStof(t) {
      if (!stofGroepen.length) return;
      var W = cv.width, H = cv.height;
      var vx = W / 130000;
      var bob = 2.2 * dpr;
      for (var gi = 0; gi < stofGroepen.length; gi++) {
        var grp = stofGroepen[gi], pts = grp.punten;
        /* EN ZE ADEMEN OOK, per groep. Schuiven alleen is voor het verste stof
           een paar pixels per minuut; dan beweegt het wel, maar zie je het
           niet. Elke groep heeft daarom een eigen trage ademhaling met een
           eigen fase, zodat het veld in lagen op- en afzwelt in plaats van als
           geheel te pulseren. Per punt zou het mooier zijn en onbetaalbaar:
           dat is vierduizend keer fillStyle per beeld in plaats van
           vierentwintig. */
        var puls = rustig ? 1 : (0.72 + 0.28 * Math.sin(t * 0.0006 + grp.fase));
        g.fillStyle = 'rgba(' + grp.rgb + ',' + (grp.basis * puls).toFixed(3) + ')';
        for (var j = 0; j < pts.length; j++) {
          var p = pts[j];
          var x = p.x + t * vx * p.diep;
          x %= W; if (x < 0) x += W;
          var y = p.y + Math.sin(t * 0.00008 + p.fase) * bob * p.diep;
          if (y < -2) y += H; else if (y > H + 2) y -= H;
          g.fillRect(x, y, p.maat, p.maat);
        }
      }
    }
    function zaai() {
      var n = Math.round(Math.min(breedte * hoogte / 1100, 1300) * (opts.dichtheid || 1));
      sterren = [];
      for (var i = 0; i < n; i++) {
        var u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u), r = Math.random();
        sterren.push({ x: s * Math.cos(th), y: u, z: s * Math.sin(th), kleur: kies(r),
          mag: 0.35 + Math.random() * (r > 0.94 ? 1.5 : 0.7), fase: Math.random() * Math.PI * 2, flonker: 0.5 + Math.random() * 0.9 });
      }
    }
    function meet() {
      var r = doel.getBoundingClientRect();
      breedte = Math.max(1, r.width); hoogte = Math.max(1, r.height);
      cv.width = Math.round(breedte * dpr); cv.height = Math.round(hoogte * dpr);
      cx = cv.width / 2; cy = cv.height / 2;
      straal = Math.hypot(cv.width, cv.height) * 0.62;
      zaai(); zaaiStof();
    }

    var rotCa = 1, rotSa = 0, TILT = 0.32, ct = Math.cos(TILT), stt = Math.sin(TILT);
    function projSter(p) {
      var x1 = p[0] * rotCa + p[2] * rotSa, z1 = -p[0] * rotSa + p[2] * rotCa;
      var y2 = p[1] * ct - z1 * stt, z2 = p[1] * stt + z1 * ct, d = CAM - z2;
      return { x: cx + (x1 / d) * straal, y: cy + (y2 / d) * straal, z: z2 };
    }
    // een hoogte/azimut naar een schermpunt: azimut om de kijkrichting, hoogte
    // van (bijna) horizon onderin tot zenit bovenin
    var FOV = 230;
    function projHemel(alt, az) {
      var rel = ((az - facing() + 540) % 360) - 180;
      if (Math.abs(rel) > FOV / 2 || alt < 2) return null;
      return { x: cv.width * (0.5 + rel / FOV), y: cv.height * (0.93 - 0.86 * Math.min(1, alt / 90)) };
    }

    function spawnMeteoor() {
      var vanaf = Math.random(), x = (0.1 + Math.random() * 0.8) * cv.width, y = Math.random() * 0.35 * cv.height;
      var hoek = Math.PI / 4 + (Math.random() - 0.5) * 0.5, snel = (7 + Math.random() * 6) * dpr;
      meteoren.push({ x: x, y: y, vx: Math.cos(hoek) * snel * (vanaf < 0.5 ? 1 : -1), vy: Math.sin(hoek) * snel, leven: 0, duur: 42 + Math.random() * 26, lengte: (90 + Math.random() * 80) * dpr });
    }
    var volgendeMeteoor = 90 + Math.random() * 260;

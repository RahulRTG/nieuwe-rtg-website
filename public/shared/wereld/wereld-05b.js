
  /* Afgesplitst van wereld-05.js, dat over de 10 KB ging. De snede loopt
     langs een echte grens: hierboven staat de BEDRADING van de grond (het
     doek, zijn maat, welke wereld aan de beurt is, de lus), hieronder het
     LICHT zelf -- welke gloeden een wereld heeft en hoe je er een tekent.
     Wie de sfeer van een wereld wil bijstellen, hoeft alleen hier te zijn. */
  /* ELKE WERELD IS EEN LICHT, GEEN TEKENING.

     Hier stonden acht LIJNTEKENINGEN: golfjes, een skyline van rechthoekjes,
     een raster bolletjes. Naast de inlogpoort -- een diepe sterrenhemel met een
     ademende dagkleur -- zag dat er precies uit als wat het was: draadwerk op
     een vlakke ondergrond. Een luxemerk tekent geen diagram op de achtergrond.

     Wat er nu staat is licht: twee tot vier grote, zachte gloeden die heel
     langzaam over de grond drijven. Per wereld verschillen hun plek, hun kleur
     en hun ritme -- Reizen ademt breed en traag als een horizon, Geld staat
     strak en rechtop, Media flakkert als een stad. Je ziet geen vorm die je kunt
     benoemen; je merkt dat het ergens anders naar rúikt. Dat is het verschil
     tussen sfeer en illustratie.

     De sterren komen niet van hier maar van shared/sterren.js -- hetzelfde
     firmament als op de inlogpoort, met dezelfde sterrenbeelden op dezelfde
     plek. Een tweede sterrenhemel naast die van de poort zou twee hemels zijn
     die uit elkaar lopen. */
  var TINT = { goud: [201, 162, 75], wijn: [194, 58, 94], parel: [237, 231, 218], koel: [120, 150, 190] };

  /* Per wereld: welke gloeden, waar ze hangen (in eenheden van het scherm),
     hoe groot, welke tint, en hoe snel ze ademen. Meer dan vier is geen sfeer
     meer maar een lavalamp. */
  var MOTIEVEN = {
    // Reizen: een brede, lage horizon die traag op en neer gaat
    'map-reizen': [[0.5, 0.16, 0.95, TINT.koel, 0.35], [0.22, 0.72, 0.75, TINT.goud, 0.22], [0.85, 0.55, 0.6, TINT.parel, 0.28]],
    // Geld: rechtop en beheerst, twee kolommen licht die nauwelijks bewegen
    'map-geld': [[0.28, 0.3, 0.6, TINT.goud, 0.12], [0.74, 0.62, 0.66, TINT.goud, 0.16], [0.5, 0.95, 0.8, TINT.parel, 0.1]],
    // Sociaal: warm, dicht bij elkaar, alsof er mensen staan
    'map-salon': [[0.32, 0.42, 0.62, TINT.wijn, 0.4], [0.62, 0.3, 0.55, TINT.goud, 0.34], [0.5, 0.82, 0.7, TINT.wijn, 0.26]],
    // Leven: een haard -- een midden dat rustig doorademt
    'map-huis': [[0.5, 0.5, 0.9, TINT.goud, 0.2], [0.5, 0.9, 0.7, TINT.wijn, 0.15]],
    // Media: een stad die aanstaat, met een snellere flakker
    'map-media': [[0.18, 0.62, 0.6, TINT.wijn, 0.8], [0.5, 0.35, 0.5, TINT.koel, 0.95], [0.82, 0.7, 0.62, TINT.goud, 0.7]],
    // Kantoor: hoog en koel, licht dat van boven binnenvalt
    'map-werk': [[0.5, 0.02, 1.05, TINT.koel, 0.14], [0.2, 0.5, 0.5, TINT.parel, 0.18], [0.8, 0.45, 0.5, TINT.parel, 0.18]],
    // Veilig: een enkele rustige wacht, gelijkmatig en zonder haast
    'map-veilig': [[0.5, 0.42, 1.0, TINT.koel, 0.1], [0.5, 0.98, 0.6, TINT.parel, 0.12]],
    // RTFoundation: organisch, twee gloeden die om elkaar heen bewegen
    'map-rtf': [[0.35, 0.55, 0.8, TINT.goud, 0.3], [0.68, 0.38, 0.7, TINT.parel, 0.24], [0.5, 0.9, 0.75, TINT.goud, 0.18]]
  };

  function grondFrame() {
    if (!grond.ctx || !grond.motief) return;
    var cv = grond.cv, ctx = grond.ctx;
    var W = cv.width, H = cv.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    /* Bij elkaar optellen in plaats van overschilderen: waar twee gloeden
       elkaar raken wordt het licht sterker, zoals licht zich gedraagt. Met de
       gewone tekenstand krijg je randen waar de een over de ander valt, en dan
       zie je de vorm van de gloed -- precies wat hier niet mag. */
    ctx.globalCompositeOperation = 'lighter';
    /* De dekking is laag EN hangt aan de schuif: wie Beweging op stil zet, wil
       geen bewegingloze-maar-wel-opvallende achtergrond, hij wil rust. */
    var kracht = 0.05 + 0.045 * Math.min(1, beweegFactor());
    var maat = Math.max(W, H);
    try {
      for (var i = 0; i < grond.motief.length; i++) gloed(ctx, W, H, maat, grond.motief[i], i, kracht);
    } catch (e) { /* een motief mag het scherm nooit kosten */ }
    ctx.restore();
  }

  /* EEN gloed: een grote, zachte lichtbel die heel langzaam ademt en drijft.
     De beweging is bewust klein (een paar procent van het scherm) -- je hoort
     het niet te ZIEN bewegen, je hoort het pas te merken als je terugkomt.

     De stop van de verloop loopt naar volledig doorzichtig in drie stappen en
     niet in een; met een enkele stap krijg je een zichtbare rand waar de bel
     ophoudt, en dan is het geen gloed meer maar een cirkel. */
  function gloed(c, W, H, maat, m, i, kracht) {
    var x = m[0], y = m[1], grootte = m[2], tint = m[3], tempo = m[4];
    var f = grond.t * tempo;
    var px = W * (x + Math.sin(f + i * 1.7) * 0.035);
    var py = H * (y + Math.cos(f * 0.8 + i * 2.3) * 0.03);
    var r = maat * grootte * (0.55 + 0.05 * Math.sin(f * 1.3 + i));
    var adem = 0.75 + 0.25 * Math.sin(f * 1.1 + i * 0.9);
    var a = kracht * adem;
    var kleur = function (deel) {
      return 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',' + (a * deel).toFixed(4) + ')';
    };
    var g = c.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, kleur(1));
    g.addColorStop(0.35, kleur(0.45));
    g.addColorStop(0.7, kleur(0.12));
    g.addColorStop(1, 'rgba(' + tint[0] + ',' + tint[1] + ',' + tint[2] + ',0)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  function grondStart() {
    if (grond.tik || !st.aan) return;
    if (beweegFactor() === 0) { grondFrame(); return; }   // stil: EEN beeld, geen lus
    var stap = function (nu) {
      grond.tik = null;
      if (!st.aan || d.hidden || beweegFactor() === 0) return;
      // ~20 beelden per seconde is voor deze traagheid ruim genoeg, en scheelt
      // twee derde van het werk tegenover een volle rAF-lus
      if (nu - grond.laatst > 48) {
        grond.laatst = nu;
        grond.t += 0.006 * beweegFactor();
        grondFrame();
      }
      grond.tik = w.requestAnimationFrame(stap);
    };
    grond.tik = w.requestAnimationFrame(stap);
  }
  function grondStop() { if (grond.tik) { w.cancelAnimationFrame(grond.tik); grond.tik = null; } }

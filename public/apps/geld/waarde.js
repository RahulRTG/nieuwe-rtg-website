/* Stand Waarde, deel 1 van 2: de portefeuille en waar het geld heen ging.

   Dit bestand registreert GEEN stand; het zet de gedeelde stukken op
   w.RTGGeldDeel.waarde en waardeb.js (dat erna laadt) doet de registratie. De
   splitsing bestaat alleen om onder de 10 KB te blijven -- het is samen een
   stand.

   WAAROM DEZE STAND ER IS. De andere geldstanden tonen een SALDO. Sinds een lid
   ook een maaltijdbudget van zijn werkgever of een gemeentetegoed kan hebben, is
   "wat heb ik" geen getal meer maar een lijst met regels erbij: 40 euro dat
   vrijdag vervalt en alleen in de horeca geldt, plus 12 euro eigen geld. Die
   twee optellen tot 52 beantwoordt de vraag verkeerd -- 52 euro suggereert dat
   hij ervoor kan tanken, en dat kan hij niet.

   Daarom staan de posities hier NAAST elkaar, met twee eerlijke totalen
   (vrij besteedbaar en gebonden) en met opzet geen derde dat ze optelt. Dat is
   geen ontwerpkeuze van dit scherm maar de regel uit WAARDE.md par. 4; de server
   levert de twee getallen al zo en telt ze ook daar niet op.

   Bodoni staat hier op precies EEN plek: het bedrag dat vrij besteedbaar is
   (.rtg-kpi). Dat is de dominante KPI van dit scherm. Al het andere is Inter --
   ONTWERP.md par. 1: een serif die overal staat is geen signatuur meer. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var G = w.Geld;

  /* De klassen die geld.html levert dekken kaarten, knoppen en velden. Wat deze
     stand echt eigen heeft is de POSITIEBALK: een positie moet in een oogopslag
     laten zien hoeveel er staat, hoeveel daarvan bruikbaar is, en waaraan hij
     gebonden is. Alleen daarvoor een eigen stukje stijl, met een id-wacht zodat
     het maar een keer in het document komt.

     De kleuren komen uit de materialenleer (rtg-materiaal.css) en niet uit
     eigen hexcodes: een kopie loopt uit de pas zodra de bron verandert. */
  function stijl() {
    if (d.getElementById('wdStijl')) return;
    var st = d.createElement('style');
    st.id = 'wdStijl';
    st.textContent =
      '#paneel .wd-pos{border:1px solid var(--rtg-line);border-radius:12px;padding:.9rem 1rem;margin:.6rem 0;}' +
      '#paneel .wd-pos.gebonden{border-left:3px solid var(--gold-rand);}' +
      '#paneel .wd-kop{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;}' +
      '#paneel .wd-bedrag{font-variant-numeric:var(--rtg-cijfers);font-weight:600;}' +
      '#paneel .wd-meta{font-size:.78rem;color:var(--rtg-soft);margin-top:.35rem;}' +
      '#paneel .wd-merk{display:inline-block;font-size:.66rem;letter-spacing:.12em;text-transform:uppercase;' +
        'border:1px solid var(--rtg-line);border-radius:999px;padding:.12rem .5rem;color:var(--rtg-soft);}' +
      '#paneel .wd-rij{display:flex;justify-content:space-between;gap:1rem;padding:.4rem 0;' +
        'border-bottom:1px solid var(--rtg-line);font-variant-numeric:var(--rtg-cijfers);}' +
      '#paneel .wd-rij:last-child{border-bottom:0;}' +
      '#paneel .wd-twee{display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:1rem;}';
    d.head.appendChild(st);
  }

  var KLASSE = {
    PERSONAL_FUNDED: 'Eigen saldo',
    EMPLOYER_BUDGET: 'Van uw werkgever',
    MUNICIPAL: 'Van de gemeente',
    LOYALTY: 'Door RTG toegekend',
    GIFT: 'Cadeaukaart',
    PARTNER_SETTLEMENT: 'Saldo van een zaak'
  };

  /* HET JAAR STAAT ERBIJ ZODRA HET AFWIJKT, en dat is geen netheid. Zonder jaar
     las een werkgeversbudget dat over twaalf maanden vervalt als "vervalt 24
     aug" -- dus als vandaag. Dat is precies de verkeerde kant om te vergissen:
     een lid dat denkt dat zijn tegoed vandaag afloopt, gaat het haastig
     opmaken. Binnen hetzelfde jaar blijft het jaartal weg, want daar voegt het
     niets toe en kost het alleen ruimte. */
  function datum(ms) {
    if (!ms) return '';
    try {
      var x = new Date(ms);
      var opties = { day: 'numeric', month: 'short' };
      if (x.getFullYear() !== new Date().getFullYear()) opties.year = 'numeric';
      return x.toLocaleDateString('nl-NL', opties);
    } catch (e) { return ''; }
  }

  /* Waaraan is deze positie gebonden? In gewone taal en niet in veldnamen -- een
     lid leest geen `bestedingsgebied`. Wat er niet is, wordt niet genoemd: een
     regel "geen tijdvenster" is ruis. */
  function gebondenAan(p) {
    var uit = [];
    var b = p.beleid || {};
    if (b.genres && b.genres.length) uit.push('alleen bij ' + G.esc(b.genres.join(', ')));
    if (b.venster) uit.push('tussen ' + G.esc(b.venster).replace('-', ' en '));
    if (b.dagMaxCenten) uit.push('max ' + G.euro(b.dagMaxCenten) + ' per dag');
    if (p.vervaltOp) uit.push('vervalt ' + datum(p.vervaltOp));
    if (p.uitgever && p.klasse !== 'PERSONAL_FUNDED') uit.push('van ' + G.esc(p.uitgever));
    return uit;
  }

  /* EEN POSITIE. Het grote getal is wat er BRUIKBAAR is en niet wat er staat --
     dat is het bedrag waar een lid iets aan heeft. Staat er iets vast, dan zegt
     de regel eronder hoeveel en waarvan.

     Hier stond eerst een voortgangsbalkje dat hetzelfde uitdrukte. Dat is eruit:
     het herhaalde de zin die er toch al staat, en een balkje met een berekende
     breedte vraagt een inline stijl -- een CSP-gaatje voor decoratie. CLAUDE.md
     par. "Design-principes": een signatuurelement, geen stapeling van trucjes. */
  function positie(p) {
    var eigen = p.klasse === 'PERSONAL_FUNDED';
    var vast = (p.gereserveerd || 0) + (p.apartGezet || 0);
    var band = gebondenAan(p);
    return '<div class="wd-pos' + (eigen ? '' : ' gebonden') + '">' +
      '<div class="wd-kop"><span class="wd-merk">' + G.esc(KLASSE[p.klasse] || p.klasseNaam || p.klasse) + '</span>' +
        '<span class="wd-bedrag">' + G.euro(p.beschikbaar) + '</span></div>' +
      '<div class="wd-meta">' +
        (vast > 0 ? 'Van ' + G.euro(p.saldo) + ' staat ' + G.euro(vast) + ' vast. ' : '') +
        (band.length ? band.join(' · ') : (eigen ? 'Overal binnen RTG te besteden.' : '')) +
      '</div></div>';
  }

  /* De twee totalen, met de uitleg die het verschil draagt. Er is met opzet geen
     derde getal dat ze optelt: "totaal beschikbaar" wordt gelezen als "dit kan
     ik uitgeven", en dat is gebonden waarde niet. */
  function totalen(p) {
    return '<div class="wd-twee">' +
      '<div><div class="kop">Vrij besteedbaar</div>' +
        '<p class="rtg-kpi">' + G.euro(p.vrijBesteedbaar) + '</p>' +
        '<p class="stil">Overal binnen RTG.</p></div>' +
      '<div><div class="kop">Gebonden</div>' +
        '<p class="wd-bedrag">' + G.euro(p.gebonden) + '</p>' +
        '<p class="stil">Alleen waar de verstrekker het voor bedoeld heeft. Deze twee worden niet opgeteld.</p></div>' +
      '</div>';
  }

  /* WAT ER VASTSTAAT, en door wie. Dit hoort op het scherm van degene bij wie het
     vastzit: geld dat een lid niet kan uitgeven zonder dat hij weet waarom, is
     erger dan geld dat weg is. */
  function reserveringen(lijst) {
    if (!lijst || !lijst.length) return '';
    var rijen = lijst.map(function (r) {
      return '<div class="wd-rij"><span>' + G.esc(r.doel || 'Vastgezet') +
        (r.door ? ' <span class="stil">· ' + G.esc(r.door) + '</span>' : '') +
        '</span><span>' + G.euro(r.centen) + ' <span class="stil">tot ' + datum(r.tot) + '</span></span></div>';
    }).join('');
    return '<div class="kaart"><div class="kop">Wat er vaststaat</div>' + rijen +
      '<p class="stil h-mt40">Een zaak heeft dit bedrag vastgezet voor iets dat nog loopt &mdash; een borg, een open rekening, een rit waarvan de prijs nog niet vast is. Het is niet afgeschreven; u kunt het alleen even niet uitgeven.</p></div>';
  }

  /* DE WAARDEGRAAF: waar ging het heen. Alles hier is afgeleid uit het
     grootboek; er wordt niets apart geteld (WAARDE.md par. 1). Een lege lijst
     krijgt een zin en geen leeg vak: leegte leest als een storing. */
  function graaf(g) {
    if (!g || !g.bestemmingen) return '';
    var rijen = g.bestemmingen.length
      ? g.bestemmingen.map(function (b) {
        return '<div class="wd-rij"><span>' + G.esc(b.naar) +
          ' <span class="stil">· ' + b.aantal + '&times;</span></span><span>' + G.euro(b.centen) + '</span></div>';
      }).join('')
      : '<p class="stil">In deze periode is er niets uitgegeven.</p>';
    return '<div class="kaart"><div class="kop">Waar uw geld heen ging</div>' +
      '<p class="stil">Laatste ' + (g.sindsDagen || 30) + ' dagen · ' + G.euro(g.uitgegeven) + ' uitgegeven, ' +
        G.euro(g.binnengekomen) + ' binnengekomen.</p>' + rijen + '</div>';
  }

  Deel.waarde = {
    stijl: stijl, positie: positie, totalen: totalen,
    reserveringen: reserveringen, graaf: graaf, datum: datum, KLASSE: KLASSE
  };
})(window, document);

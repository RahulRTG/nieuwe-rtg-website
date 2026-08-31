/* RTG Command, deel 21: het bezitsbewijs -- hoeveel zware verzoeken zouden er
   vandaag worden geweigerd als we het aanzetten.

   WAAROM DIT BORD BESTAAT. De handhaving van het bezitsbewijs
   (server/kern/identiteit/bezitsbewijs.js) begint in de stand `schaduw`: hij
   rekent wel uit wat er zou gebeuren maar weigert nooit. Dat is de regel van
   CONTROLPLANE.md -- je kunt niet afdwingen wat nooit in de schaduw heeft
   gelopen. Maar een schaduw waar niemand naar kijkt, blijft een schaduw: dan
   staat de stand over twee jaar nog op schaduw omdat niemand wist wat het zou
   kosten. Dit scherm is dat kijken.

   ER STAAT GEEN KNOP OP. De stand komt uit RTG_BEZITSBEWIJS bij het opstarten,
   en dat is bewust een besluit van wie de omgeving beheert. Een schakelaar die
   stilletjes de betalingen van elk gebonden lid kan weigeren, hoort niet naast
   een grafiek te staan.

   EN HET ZEGT NIET OF HET MAG. Er staat nergens "klaar om aan te zetten": dat
   zou het ene groene cijfer zijn dat LAT-regel 11 en check.js regel 48
   verbieden, en het zou de drempel -- een besluit van de eigenaar -- in code
   verstoppen. Het bord levert het getal; de drempel komt van een mens.

   DEZELFDE DERDE STAND ALS BIJ DE SERVICEDOELEN (deel 10): "niets gemeten" is
   geen nul. Een vers proces zonder zwaar verkeer op 0% dekking tonen leest als
   "niets werkt", terwijl het "wij weten het niet" is -- en dat is precies
   andersom. */
(function () {
  'use strict';
  var C = window.RTGCommand, esc = C.esc, api = C.api, S = C.S;

  var STANDTEKST = {
    schaduw: 'Weigert niets. Rekent alleen uit wat er zou gebeuren.',
    aanbevolen: 'Weigert een zware handeling uit een sessie die WEL een sleutelbinding heeft en geen bewijs meestuurt.',
    verplicht: 'Weigert ook zware handelingen uit sessies zonder gebonden toestel.'
  };

  C.TEKENAARS.bezitsbewijs = function (el) {
    el.innerHTML = '<h2 class="ckop">Bezitsbewijs</h2>' +
      '<p class="lead">Een sessietoken is een dragersbewijs: wie hem onderschept, is die persoon. ' +
      'Bij zware handelingen kan RTG eisen dat de client bewijst dat hij de sleutel van het toestel bezit. ' +
      'Dit bord zegt wat dat vandaag zou kosten als we het aanzetten.</p>' +
      '<div id="bbUit"><div class="leeg">Meten…</div></div>';
    api('bezitsbewijs').then(function (d) {
      if (d.nietGebouwd) {
        document.querySelector('#bbUit').innerHTML = '<div class="leeg">' + esc(d.nietGebouwd) + '</div>';
        return;
      }
      var u = '';

      /* De stand bovenaan, want zonder die te weten betekent geen enkel getal
         eronder iets: dezelfde meting hoort bij schaduw en bij verplicht een
         totaal ander gesprek. */
      u += '<div class="kaart"><h3>Stand: ' + esc(d.stand.stand) + '</h3>' +
        '<p>' + esc(STANDTEKST[d.stand.stand] || '') + '</p>' +
        '<p class="meta">Ingesteld met RTG_BEZITSBEWIJS bij het opstarten (' + esc(d.stand.reden) + '). ' +
        'Er staat hier met opzet geen knop: een schakelaar die stilletjes de betalingen van elk gebonden ' +
        'lid kan weigeren, hoort niet naast een grafiek te staan.</p></div>';

      /* DE DEKKING, of eerlijk gezegd dat hij er niet is. Dit is het enige
         getal waar het besluit op rust, en het heeft drie standen en niet twee. */
      var dek = d.dekking == null ? 'niets gemeten' : d.dekking + '%';
      var dekKleur = d.dekking == null ? 'gold' : (d.dekking >= 99 ? 'groen' : 'acc');
      u += '<div class="rooster">' +
        tegel('Dekking', dek, dekKleur,
          d.dekking == null ? 'geen zwaar verkeer sinds de start' : 'van de verzoeken uit een gebonden sessie') +
        tegel('Zware verzoeken', d.zwareVerzoeken, '', 'sinds ' + kort(d.sinds)) +
        tegel('Zou nu weigeren', (d.perUitkomst.geweigerd || 0) + (d.perUitkomst.schaduw || 0),
          ((d.perUitkomst.geweigerd || 0) + (d.perUitkomst.schaduw || 0)) ? 'acc' : '', 'bij de stand aanbevolen') +
        tegel('Onbeschermd', d.onbeschermd, d.onbeschermd ? 'gold' : '', 'sessies zonder sleutelbinding') +
        '</div>';

      u += '<div class="kaart"><h3>Wat dekking betekent</h3><p class="meta">' + esc(d.uitleg) + '</p>' +
        '<p class="meta"><b>Wat dit niet meet:</b> ' + esc(d.nietGemeten) + '</p></div>';

      u += perPad(d.perPad);

      /* De uitkomsten los, want ze zijn niet allemaal even erg. `onbeschermd`
         is geen fout maar een sessie die nog niet gebonden is; `geweigerd` in
         schaduw bestaat niet en `schaduw` is precies de weigering-die-niet-was. */
      u += '<div class="kaart"><h3>Per uitkomst</h3><div class="schuif"><table class="ctab"><thead><tr>' +
        '<th>Uitkomst</th><th>Aantal</th><th>Wat het betekent</th></tr></thead><tbody>' +
        rij('bewezen', d.perUitkomst.bewezen, 'Bewijs meegestuurd en gecontroleerd.') +
        rij('schaduw', d.perUitkomst.schaduw, 'Zou zijn geweigerd. Nu doorgelaten omdat de stand schaduw is.') +
        rij('geweigerd', d.perUitkomst.geweigerd, 'Werkelijk geweigerd.') +
        rij('onbeschermd', d.perUitkomst.onbeschermd, 'Sessie zonder sleutelbinding; raakt pas iets bij de stand verplicht.') +
        '</tbody></table></div></div>';

      u += '<div class="kaart"><h3>Wat dit bord NIET zegt</h3>' +
        '<p class="meta">Of de stand omhoog mag. Dat is een besluit van de eigenaar en geen uitkomst van een ' +
        'meting: een percentage dat "klaar" heet, verstopt de afweging tussen bescherming en een geweigerde ' +
        'betaling in code. Wat hier staat is het getal waarop dat besluit rust.</p>' +
        '<p class="meta">De dekking gaat alleen over sessies die een bewijs KONDEN sturen. Sessies zonder ' +
        'gebonden toestel staan apart als "onbeschermd"; die worden pas geraakt door de stand verplicht, en ' +
        'die stap is dus een tweede besluit en niet hetzelfde.</p></div>';

      document.querySelector('#bbUit').innerHTML = u;
    }).catch(function (e) {
      if (!e.stil) document.querySelector('#bbUit').innerHTML = '<div class="leeg">' + esc(e.message) + '</div>';
    });
  };

  function perPad(pp) {
    var paden = Object.keys(pp || {});
    if (!paden.length) {
      return '<div class="kaart"><h3>Per pad</h3><p class="meta">Er is nog geen zwaar verkeer langsgekomen ' +
        'sinds dit proces startte. Dat is iets anders dan dat alles goed gaat.</p></div>';
    }
    paden.sort(function (a, b) { return totaal(pp[b]) - totaal(pp[a]); });
    return '<div class="kaart"><h3>Per pad</h3>' +
      '<p class="meta">Waar het schuurt zie je hier het eerst: een pad met veel schaduw-weigeringen is een ' +
      'scherm dat de kop nog niet meestuurt.</p>' +
      '<div class="schuif"><table class="ctab"><thead><tr><th>Pad</th><th>Bewezen</th><th>Zou weigeren</th>' +
      '<th>Onbeschermd</th></tr></thead><tbody>' +
      paden.map(function (p) {
        var v = pp[p];
        return '<tr><td><code>' + esc(p) + '</code></td><td>' + (v.bewezen || 0) + '</td><td>' +
          ((v.geweigerd || 0) + (v.schaduw || 0)) + '</td><td>' + (v.onbeschermd || 0) + '</td></tr>';
      }).join('') + '</tbody></table></div></div>';
  }

  function totaal(v) {
    var n = 0;
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) n += v[k];
    return n;
  }

  function rij(naam, n, uitleg) {
    return '<tr><td>' + esc(naam) + '</td><td>' + (n || 0) + '</td><td class="meta">' + esc(uitleg) + '</td></tr>';
  }

  function tegel(l, v, k, u) {
    return '<div class="tegel"><div class="l">' + esc(l) + '</div><div class="v ' + (k || '') + '">' + v + '</div>' +
      (u ? '<div class="u">' + esc(u) + '</div>' : '') + '</div>';
  }

  function kort(iso) {
    if (!iso) return 'onbekend';
    var d = new Date(iso);
    return isNaN(d) ? 'onbekend' : d.toLocaleString('nl-NL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  }

  /* Bij "Spiegel" en niet bij "Zien", om dezelfde reden als de servicedoelen:
     dit is een scherm waarop deze opzet zichzelf kan tegenspreken. De teller
     toont wat er nu zou stuklopen -- nul is hier geen prestatie maar vaak
     gewoon "er is niets langsgekomen". */
  C.WERKPLEKKEN.push(
    { id: 'bezitsbewijs', naam: 'Bezitsbewijs', sec: 'Spiegel',
      teller: function (s) { return s.bezitsbewijs && s.bezitsbewijs.perUitkomst
        ? (s.bezitsbewijs.perUitkomst.schaduw || 0) + (s.bezitsbewijs.perUitkomst.geweigerd || 0) : 0; } });
  void S;
})();

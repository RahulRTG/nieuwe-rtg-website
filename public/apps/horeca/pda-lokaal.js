/* RTG Horeca (scherm): OPNEMEN ZONDER LIJN.

   Het derde venster van de PDA, en met opzet een EIGEN venster en niet een
   stand van het tafelvenster. Die twee doen namelijk iets verschillends: het
   tafelvenster bewerkt een rekening die op de server staat, dit bouwt een
   PAKKET dat er nog heen moet. Ze in elkaar schuiven zou betekenen dat een tik
   soms een server raakt en soms niet, en dat is precies het soort scherm waar
   een bediening niet meer op durft te vertrouwen.

   WAAROM DIT HET ENIGE IS WAT OFFLINE MOET WERKEN, staat in apps/horeca/edge.js:
   van alles wat een bediening doet is het OPNEMEN het enige waarbij een
   netwerkstoring de bestelling wérkelijk kwijtmaakt. Een gang vrijgeven zonder
   keuken is zinloos, een verzoek komt niet binnen als de telefoon van de gast
   ook offline is, en betalen is een eigen besluit.

   DRIE DINGEN DIE HIER ZICHTBAAR BLIJVEN:

   1. DE KAART KOMT VAN DIT TOESTEL. Zonder lijn is er geen kaart bij de server,
      dus wordt hij bewaard zodra hij er wel is (pda-tafel.js). Wat u ziet kan
      de kaart van vanochtend zijn, en dat staat er ook bij -- oneindig veel
      beter dan niets, maar geen belofte dat het klopt.
   2. DE ALLERGIE STAAT ER GEWOON. Een bestelling die zonder lijn is opgenomen
      komt binnen als "besteld" en niet als "geserveerd", juist zodat de keuken
      hem nog maakt -- en dan moet de allergie mee. Zonder dat veld is dit een
      offline-vangnet dat een gast in gevaar brengt.
   3. ER WORDT NIETS VRIJGEGEVEN EN NIETS BETAALD. De bestelling landt op een
      rekening en blijft daar staan tot de zaal hem doorstuurt. Tussen het
      opnemen en het terugkeren van de lijn kan er van alles veranderd zijn. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  var esc = K.esc, euro = K.euro, meld = K.meld;
  var LIJST = [], KLAAR = function () {};

  function $(id) { return document.getElementById(id); }

  function tekenKaart() {
    var kaart = window.RTGPdaTafel.kaart();
    if (!kaart || !kaart.length) {
      $('lKaart').innerHTML = '<p class="pda-leeg">Dit toestel heeft nog geen kaart bewaard. ' +
        'Open eenmalig een tafel terwijl er verbinding is; daarna kan het ook zonder.</p>';
      return;
    }
    $('lKaart').innerHTML = kaart.map(function (g) {
      return '<div class="pda-cat">' + esc(g.cat) + '</div><div class="pda-items">' +
        g.items.map(function (i) {
          return '<button type="button" data-litem="' + esc(i.id) + '">' + esc(i.naam) +
            '<em>' + euro(i.centen) + (i.uitverkocht ? ' &middot; op' : '') + '</em></button>';
        }).join('') + '</div>';
    }).join('');
    K.bind($('lKaart'), 'litem', function (b) {
      var id = b.getAttribute('data-litem');
      var item = null;
      kaart.forEach(function (g) { g.items.forEach(function (i) { if (i.id === id) item = i; }); });
      if (!item) return;
      LIJST.push({ naam: item.naam, centen: item.centen, aantal: 1,
        gang: Number($('lGang').value) || 0, station: item.station || null,
        stoel: $('lStoel').value.trim() || null,
        allergie: $('lAllergie').value.trim() || null });
      tekenLijst();
    });
  }

  function tekenLijst() {
    $('lLijst').innerHTML = LIJST.length ? '<ul class="pda-borden">' + LIJST.map(function (r, i) {
      return '<li><span>' + esc(r.aantal + 'x ' + r.naam) + '</span><em>' +
        esc('gang ' + r.gang + (r.stoel ? ' · ' + r.stoel : '') + (r.allergie ? ' · ' + r.allergie : '')) +
        '</em><button class="knop" data-lweg="' + i + '" aria-label="Haal ' + esc(r.naam) + ' eraf">Eraf</button></li>';
    }).join('') + '</ul>' : '<p class="pda-som">Nog niets opgenomen.</p>';
    K.bind($('lLijst'), 'lweg', function (b) {
      LIJST.splice(Number(b.getAttribute('data-lweg')), 1);
      tekenLijst();
    });
    $('lTotaal').textContent = LIJST.length
      ? LIJST.length + ' regel(s), samen ' + euro(LIJST.reduce(function (n, r) { return n + r.centen * r.aantal; }, 0))
      : '';
  }

  function opnemen() {
    var tafel = $('lTafel').value.trim();
    if (!tafel) return meld('Welke tafel of plek?');
    if (!LIJST.length) return meld('Er staat nog niets op.');
    /* DE SLEUTEL WORDT HIER GEMAAKT EN NERGENS ANDERS MEER. Hij hoort bij DEZE
       bestelling, niet bij deze poging: gaat het pakket de wachtrij in, dan
       reist dezelfde sleutel mee en herkent de server de herhaling
       (offline/sync ontdubbelt op clientId). */
    var pakket = {
      clientId: RTGId('pda'),
      kanaal: 'tafel', tafel: tafel,
      gasten: Math.max(1, parseInt($('lGasten').value, 10) || 1),
      at: new Date().toISOString(),
      regels: LIJST.slice()
    };
    window.RTGHorecaEdge.neemOp(pakket).then(function (r) {
      if (r && r.gewacht) {
        meld('Geen lijn. De bestelling staat op dit toestel en gaat vanzelf weg zodra de verbinding terug is.');
      } else {
        meld('Opgenomen. De bestelling staat op de rekening en wacht op vrijgave door de zaal.');
      }
      LIJST = [];
      $('lTafel').value = '';
      tekenLijst();
      KLAAR();
    }, function (e) { meld(e.message || 'Er ging iets mis.'); });
  }

  window.RTGPdaLokaal = {
    toon: function (klaar) {
      KLAAR = klaar || function () {};
      if (!window.RTGPdaLokaal._gebonden) {
        window.RTGPdaLokaal._gebonden = true;
        $('lOpnemen').addEventListener('click', opnemen);
      }
      tekenKaart();
      tekenLijst();
    }
  };
})();

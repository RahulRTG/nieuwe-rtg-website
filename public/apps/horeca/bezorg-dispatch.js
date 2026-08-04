/* RTG Horeca (scherm): de bezorgdispatch -- zones, tijdsloten en de rit-volgorde.

   De vraag die dit scherm beantwoordt is niet "waar is de bezorger", maar de
   drie ervoor: MAG het hier bezorgd worden, VOOR hoeveel, en KAN het in dit
   tijdslot nog. Daarom staat de adrescheck bovenaan en niet onderaan.

   Twee dingen die het antwoord hier letterlijk laat zien:

   - EEN NEE DRAAGT ZIJN REDEN. Buiten het gebied staat er niet "gaat niet"
     maar welke postcode of hoeveel kilometer. Wie een adres intikt, hoort te
     weten waarom het niet kan.
   - DE SLOTCAPACITEIT STAAT IN KEUKENMINUTEN. Tien pizza's zijn geen tien
     diners; een teller op bestellingen loopt op de drukste avond precies
     verkeerd. */
(function () {
  'use strict';
  var K = window.RTGHoreca;
  function $(id) { return document.getElementById(id); }
  var esc = K.esc;
  var zones = [];
  var stops = [];

  function toonZones() {
    $('bZones').innerHTML = zones.map(function (z) {
      return K.rij('<b>' + esc(z.naam) + '</b> <span class="stil">· ' +
        (z.postcodes.length ? z.postcodes.join(', ') : (z.straalKm || 0) + ' km') + ' · ' + z.minuten + ' min</span>',
      K.euro(z.kostenCenten) + (z.minimumCenten ? ' · min. ' + K.euro(z.minimumCenten) : '') +
        (z.gratisVanafCenten ? ' · gratis vanaf ' + K.euro(z.gratisVanafCenten) : ''));
    }).join('') || '<p class="stil">Er zijn nog geen zones. Zonder zone kan er niets bezorgd worden.</p>';
  }

  function neem(d) {
    zones = d.zones || [];
    $('bOpen').checked = d.open !== false;
    $('bReden').value = d.redenDicht || '';
    toonZones();
  }

  /* Lezen is een lege body: wie bij het openen van de pagina de schakelaar
     meestuurt, zet een gesloten bezorging stilletjes weer open. */
  function laadZones() {
    K.api('/bezorg/zone', {}).then(function (r) { if (!r.body.error) neem(r.body); });
  }

  function zetZones(nieuw) {
    K.api('/bezorg/zone', { zones: nieuw, open: $('bOpen').checked, reden: $('bReden').value.trim() })
      .then(function (r) {
        if (r.body.error) return K.meld(r.body.error);
        neem(r.body);
        K.meld(r.body.open ? 'De bezorging staat open.' : 'De bezorging is dicht.');
      });
  }

  function sloten(nieuw) {
    K.api('/bezorg/sloten', nieuw ? { sloten: nieuw, datum: $('bDatum').value.trim() } : { datum: $('bDatum').value.trim() })
      .then(function (r) {
        var d = r.body;
        if (d.error) return K.meld(d.error);
        $('bSloten').innerHTML = (d.sloten || []).map(function (s) {
          return K.rij('<b>' + esc(s.tijd) + '</b> <span class="tag' + (s.vol ? ' laat' : ' aan') + '">' +
            s.gebruiktMinuten + ' van ' + s.capaciteitMinuten + ' min</span>',
          s.vol ? 'vol' : s.vrij + ' min vrij');
        }).join('') || '<p class="stil">Nog geen tijdsloten ingesteld.</p>';
      });
  }

  function toonStops() {
    $('bStops').innerHTML = stops.map(function (s, i) {
      return K.rij((i + 1) + '. ' + esc(s.adres), s.lat + ', ' + s.lng +
        (s.kmVanVorige != null ? ' · ' + s.kmVanVorige + ' km' : ''));
    }).join('') || '<p class="stil">Nog geen stops. Twee is het minimum om een volgorde uit te rekenen.</p>';
  }

  if (!K.poort()) return;

  $('bZoneZet').addEventListener('click', function () {
    var naam = $('bZoneNaam').value.trim();
    if (!naam) return K.meld('Hoe heet de zone?');
    zetZones(zones.concat([{ naam: naam,
      postcodes: $('bZonePost').value.split(',').map(function (x) { return x.trim(); }).filter(Boolean),
      straalKm: Number($('bZoneKm').value) || null,
      kosten: Number($('bZoneKosten').value) || 0,
      minimum: Number($('bZoneMin').value) || 0,
      minuten: Number($('bZoneMinuten').value) || 30 }]));
    $('bZoneNaam').value = ''; $('bZonePost').value = '';
  });
  $('bOpenZet').addEventListener('click', function () { zetZones(zones); });

  $('bCheck').addEventListener('click', function () {
    K.api('/bezorg/check', { postcode: $('bCheckPost').value.trim(), bedrag: Number($('bCheckBedrag').value) || 0 })
      .then(function (r) {
        var d = r.body;
        if (d.error) return K.meld(d.error);
        $('bCheckUit').textContent = d.bezorgbaar
          ? 'Ja: zone ' + d.zone.naam + ', ' + (d.kostenCenten ? K.euro(d.kostenCenten) : 'gratis') +
            ', ongeveer ' + d.zone.minuten + ' minuten.' +
            (d.haaltMinimum ? '' : ' Het minimum wordt niet gehaald: nog ' + K.euro(d.tekort) + ' te gaan.')
          : 'Nee: ' + (d.reden || d.redenDicht);
      });
  });

  $('bSlotZet').addEventListener('click', function () {
    var tijd = $('bSlotTijd').value.trim();
    var cap = Number($('bSlotCap').value) || 0;
    if (!/^\d{2}:\d{2}$/.test(tijd) || !cap) return K.meld('Geef een tijd als 18:30 en een capaciteit in minuten.');
    var set = {};
    set[tijd] = cap;
    sloten(set);
  });
  $('bSlotToon').addEventListener('click', function () { sloten(null); });
  $('bSlotNeem').addEventListener('click', function () {
    K.api('/bezorg/reserveer-slot', { datum: $('bDatum').value.trim(), tijd: $('bSlotTijd').value.trim(),
      minuten: Number($('bSlotMin').value) || 15 }).then(function (r) {
      var d = r.body;
      K.meld(d.error ? d.error + (d.eerstvolgende ? ' ' + d.let : '') : 'Gereserveerd: ' + d.gereserveerd + ' minuten om ' + d.tijd + '.');
      sloten(null);
    });
  });

  $('bStopVoeg').addEventListener('click', function () {
    var adres = $('bStopAdres').value.trim();
    var lat = Number($('bStopLat').value), lng = Number($('bStopLng').value);
    if (!adres || !Number.isFinite(lat) || !Number.isFinite(lng)) return K.meld('Adres, breedte- en lengtegraad zijn alle drie nodig.');
    stops.push({ adres: adres, lat: lat, lng: lng, minuten: Number($('bStopMin').value) || 0 });
    $('bStopAdres').value = ''; $('bStopLat').value = ''; $('bStopLng').value = '';
    toonStops();
  });
  $('bRoute').addEventListener('click', function () {
    K.api('/bezorg/route', { stops: stops }).then(function (r) {
      var d = r.body;
      if (d.error) return K.meld(d.error);
      stops = d.route;
      toonStops();
      $('bRouteUit').textContent = d.stops + ' stops, ' + d.totaalKm + ' km (' + d.heuristiek + '). ' + d.let;
    });
  });

  laadZones();
  sloten(null);
  toonStops();
})();

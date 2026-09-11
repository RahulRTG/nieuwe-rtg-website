/* DE MEEGELEVERDE TAALSCHIL -- vertaling zonder netwerk.

   WAT DIT OPLOST. De automatische laag hieronder schraapt tekst van het scherm
   en vraagt hem op bij /api/vertaal/ui. Dat werkt goed zolang er verbinding is;
   wie voor het EERST offline binnenkomt, kreeg Nederlands, ook als hij zijn
   taal allang had gekozen. De kast (i18n-00.js) hielp daar niet: die vult zich
   pas door eerder bezoek. Deze laag levert de tekst van de app-schil mee als
   bestand, gebouwd door scripts/taalschil.js en voorgecachet door sw.js.

   DE VOLGORDE IS KAST, DAN SCHIL, DAN NET, en die is niet willekeurig. De kast
   is VERSER (hij bevat wat deze bezoeker werkelijk zag, inclusief schermen
   buiten de schil) en staat daarom voorop. De schil is BREDER bij een koude
   start. Het net is de laatste, want dat is de enige stap die iets kost.

   WAT DEZE LAAG NIET DOET. Hij keurt niets. De keuring staat in
   server/kern/taalkeuring.js en heeft bij het BOUWEN al beslist wat er in het
   bestand mag; alleen `goed` haalt het. Hier nog eens keuren zou een tweede,
   zwakkere kopie van dat oordeel in de browser zetten -- precies de dubbeling
   waar LAT.md regel 4 tegen is.

   EEN ONTBREKENDE SCHIL IS GEEN STORING. Talen buiten de elf hebben geen
   bestand, en dat hoort: zij werken zoals altijd, via het net. Een mislukte
   ophaalpoging wordt daarom ONTHOUDEN en niet herhaald -- anders doet elke
   DOM-wijziging een nieuw verzoek dat toch niets oplevert. */
(function (w, d) {
  if (w.RTGTaalSchil) return;
  var MAP = '/shared/taalschil';
  var LEEG = new Map();
  var geladen = {};   // taal -> Map met de regels
  var bezig = {};     // taal -> lopende belofte
  var mislukt = {};   // taal -> we hebben het geprobeerd, het kwam er niet

  /* De schil staat op dezelfde plek als de andere gedeelde bestanden. Op de
     publieke verhaalpagina's ligt de webroot een paar mappen hoger; die dragen
     daarvoor `rtg-asset-base`, net als i18n-01.js. */
  function basis() {
    var m = d.querySelector && d.querySelector('meta[name="rtg-asset-base"]');
    return String((m && m.getAttribute('content')) || '').replace(/\/+$/, '');
  }

  /* Een taalcode komt uit een keuzelijst, maar hij komt ook uit localStorage en
     uit een URL. Alles wat geen kale code is, wordt hier een pad -- dus eerst
     de vorm afdwingen en pas dan een adres bouwen. */
  function veilig(taal) {
    return /^[a-z]{2,3}$/.test(String(taal || '')) ? String(taal) : null;
  }

  function alsMap(regels) {
    var m = new Map();
    if (!regels || typeof regels !== 'object') return m;
    /* Via Object.keys en een Map, zodat een sleutel als `__proto__` in het
       bestand nooit iets aan een object kan veranderen. */
    Object.keys(regels).forEach(function (k) {
      var v = regels[k];
      if (typeof v === 'string' && v) m.set(k, v);
    });
    return m;
  }

  function van(taal) {
    taal = veilig(taal);
    return (taal && geladen[taal]) || LEEG;
  }

  function laad(taal) {
    taal = veilig(taal);
    if (!taal) return Promise.resolve(LEEG);
    if (geladen[taal]) return Promise.resolve(geladen[taal]);
    if (mislukt[taal]) return Promise.resolve(LEEG);
    if (bezig[taal]) return bezig[taal];
    if (typeof fetch !== 'function') { mislukt[taal] = true; return Promise.resolve(LEEG); }
    bezig[taal] = fetch(basis() + MAP + '/' + taal + '.json', { credentials: 'omit' })
      .then(function (r) { if (!r.ok) throw new Error('schil ' + r.status); return r.json(); })
      .then(function (j) {
        var m = alsMap(j && j.regels);
        geladen[taal] = m;
        delete bezig[taal];
        return m;
      })
      .catch(function () {
        mislukt[taal] = true;
        delete bezig[taal];
        return LEEG;
      });
    return bezig[taal];
  }

  /* Voor de meter en voor een mens die wil weten waar zijn tekst vandaan komt. */
  function stand() {
    var uit = {};
    Object.keys(geladen).forEach(function (t) { uit[t] = geladen[t].size; });
    return { geladen: uit, mislukt: Object.keys(mislukt) };
  }

  w.RTGTaalSchil = { van: van, laad: laad, stand: stand, MAP: MAP };
})(window, document);

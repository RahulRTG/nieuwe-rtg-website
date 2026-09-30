/* Leerhuis: aan het werk -- bewijs vastleggen en een beoordeling aanvragen,
   op de kaart van een leerling bij zijn trainer (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. De vaardigheden, de bewijssoorten en de sterktes komen uit
   de trainercockpit van de server (kern/leerhuis/zicht.js), en of een trainer
   dit mag zetten zegt bewijsVastleggen: de sterkte volgt uit WIE het schrijft.
   Elke knop gaat via `h.doe` van leerhuis-werk.js, met zijn sleutel en zijn
   navraag bij "onbekend"; hier is geen eigen weg naar de server.

   Van een beoordeling toont de kaart alleen OF hij loopt, nooit de uitslag of
   de criteria: dat is het werk van de assessor. */
'use strict';
window.RTGLeerhuisBewijs = function (h) {
  var maak = h.maak, knop = h.knop, doe = h.doe;
  var leesbaar = function (s) { return String(s || '').toLowerCase().replace(/_/g, ' '); };

  function kies(label, opties) {
    var s = maak('select', 'veld');
    s.setAttribute('aria-label', label);
    opties.forEach(function (o) {
      var e = maak('option', null, o[1]);
      e.value = o[0];
      s.appendChild(e);
    });
    return s;
  }

  return function (k, x, t) {
    var vs = x.vaardigheden || [];
    if (!vs.length) return;
    var loopt = vs.filter(function (v) { return v.loopt; }).map(function (v) { return v.naam; });
    if (loopt.length) k.appendChild(maak('p', 'meta', 'Er loopt een beoordeling voor: ' + loopt.join(', ') + '.'));

    var blok = maak('details', 'bewijs');
    blok.appendChild(maak('summary', null, 'Bewijs of beoordeling'));
    var vaardigheid = kies('Vaardigheid', vs.map(function (v) { return [v.id, v.naam]; }));
    var soort = kies('Soort bewijs', (t.bewijsSoorten || []).map(function (s) { return [s, leesbaar(s)]; }));
    var sterkte = kies('Hoe u het weet', (t.sterktes || []).map(function (s) {
      return [s, s === 'OBSERVED' ? 'ik zag het gebeuren' : s === 'DOCUMENTED' ? 'ik zag een stuk' : leesbaar(s)];
    }));
    var bron = maak('input', 'veld');
    bron.setAttribute('aria-label', 'Waar u het zag of welk stuk');
    bron.placeholder = 'Waar u het zag of welk stuk';
    [vaardigheid, soort, sterkte, bron].forEach(function (e) { blok.appendChild(e); });

    var rij = maak('div', 'rij');
    var naam = function () { return vaardigheid.options[vaardigheid.selectedIndex].textContent; };
    rij.appendChild(knop('Bewijs vastleggen', false, function () {
      doe('bewijs:' + x.persoon + ':' + vaardigheid.value + ':' + soort.value + ':' + sterkte.value, 'bewijsVastleggen',
        { persoon: x.persoon, vaardigheid: vaardigheid.value, soort: soort.value, sterkte: sterkte.value, bron: bron.value.trim() },
        'Bewijs vastgelegd voor ' + naam() + '.');
    }));
    rij.appendChild(knop('Beoordeling aanvragen', true, function () {
      doe('aanvraag:' + x.persoon + ':' + vaardigheid.value, 'beoordelingAanvragen',
        { persoon: x.persoon, vaardigheid: vaardigheid.value }, 'Beoordeling aangevraagd voor ' + naam() + '.');
    }));
    blok.appendChild(rij);
    k.appendChild(blok);
  };
};

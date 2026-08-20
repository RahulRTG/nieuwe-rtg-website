/* Stand Mecenaat, deel 1 van 2. Was /apps/mecenaat.html: uw filantropie op
   orde. Per gift het doel, het thema, het bedrag, toegezegd of al betaald, en
   of hij via de RTFoundation loopt (die 30% van de bijdragen naar
   liefdadigheid brengt).

   Dit bestand registreert GEEN stand: het zet het tekenwerk en de meeneembron
   op w.RTGGeldDeel.mecenaat, en mecenaatb.js (dat erna laadt) doet de
   handelingen en de registratie. De splitsing bestaat alleen om de maatregel
   van de repo (bestanden onder de 10 KB) te halen; het is samen een stand. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var M = Deel.mecenaat = { stand: null }; // het laatst geladen dossier

  /* Alleen wat geld.html en de UI-kit niet al hebben: het gouden en het
     bordeauxrode label (betaald en RTFoundation, kleur als betekenis), de
     kleine tekstknop bij een rij, en het antwoordvak van de adviseur. Een
     keer injecteren, met id-wacht, want tien standen delen dit document. */
  M.stijl = function () {
    if (d.getElementById('mcStijl')) return;
    var s = d.createElement('style');
    s.id = 'mcStijl';
    s.textContent =
      '#paneel .mc-tx{flex:1;min-width:0;}' +
      '#paneel .mc-tx .badge{margin-left:.35rem;}' +
      '#paneel .mc-zg{color:var(--gold-tekst);border-color:var(--gold-rand);}' +
      '#paneel .mc-fd{color:var(--rtg-leesrood,var(--rtg-rood,#C23A5E));border-color:rgba(194,58,94,.4);}' +
      '#paneel .mc-mini{background:none;border:0;color:var(--gold-tekst);font-size:.75rem;' +
        'cursor:pointer;padding:0;text-decoration:underline;font-family:inherit;}' +
      '#paneel .mc-rechts{text-align:right;flex-shrink:0;}' +
      '#paneel .mc-half{display:flex;gap:.4rem;margin-top:.4rem;}' +
      '#paneel .mc-half>*{flex:1;min-width:0;}' +
      '#paneel .mc-vraag{display:flex;gap:.5rem;margin-top:.4rem;}' +
      '#paneel .mc-vraag input{flex:1;width:auto;}' +
      '#paneel .mc-uit{border:1px solid var(--rtg-line);border-radius:12px;padding:.6rem .8rem;' +
        'margin-top:.6rem;font-size:.85rem;line-height:1.55;white-space:pre-wrap;}';
    d.head.appendChild(s);
  };

  /* Bedragen in dit dossier zijn hele euro's, zo bewaart de kern ze. Geld.euro
     rekent in centen, dus EEN keer maal honderd hier en nergens anders. */
  M.eu = function (bedrag) { return w.Geld.euro(Math.round((Number(bedrag) || 0) * 100)); };

  function giftRij(g) {
    var Geld = w.Geld, esc = Geld.esc;
    var meta = [g.thema, g.periode !== 'eenmalig' ? 'per ' + g.periode : '',
      g.datum ? Geld.datum(g.datum) : ''].filter(Boolean).join(' · ');
    return '<div class="rij"><div class="mc-tx"><b>' + esc(g.doel) + '</b>' +
      '<span class="badge' + (g.betaald ? ' mc-zg' : '') + '">' + (g.betaald ? 'betaald' : 'toegezegd') + '</span>' +
      (g.foundation ? '<span class="badge mc-fd">RTFoundation</span>' : '') +
      '<div class="sub">' + esc(meta) + '</div></div>' +
      '<div class="mc-rechts"><div class="bedrag">' + M.eu(g.bedrag) + '</div>' +
      '<button class="mc-mini" type="button" data-mcbet="' + esc(g.id) + '" data-nu="' + (g.betaald ? '1' : '0') +
        '">' + (g.betaald ? 'naar toegezegd' : 'naar betaald') + '</button> ' +
      '<button class="mc-mini" type="button" data-mcweg="' + esc(g.id) + '" aria-label="Verwijder ' +
        esc(g.doel) + '">weg</button></div></div>';
  }

  M.teken = function (dd) {
    var esc = w.Geld.esc, eu = M.eu;
    var opts = function (l) {
      return (l || []).map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    };
    d.getElementById('mcVak').innerHTML =
      '<div class="kpis">' +
        '<div class="kpi"><b class="bedrag">' + eu(dd.betaald) + '</b><small>Betaald</small></div>' +
        '<div class="kpi"><b class="bedrag">' + eu(dd.toegezegd) + '</b><small>Toegezegd</small></div>' +
        '<div class="kpi"><b class="bedrag">' + eu(dd.viaFoundation) + '</b><small>Via RTFoundation</small></div>' +
      '</div>' +
      '<div class="kaart"><p class="stil">De <b>RTFoundation</b> brengt 30% van de bijdragen naar ' +
        'liefdadigheid. Giften die u via de foundation laat lopen, komen hier samen.</p></div>' +
      '<h2>Gift toevoegen</h2>' +
      '<form class="kaart" id="mcGForm">' +
        '<label class="stil lbl" for="mcGDoel">Goed doel</label>' +
        '<input id="mcGDoel" maxlength="100" placeholder="Bijvoorbeeld het jeugdorkest">' +
        '<div class="mc-half">' +
          '<select id="mcGThema" aria-label="Thema">' + opts(dd.themas) + '</select>' +
          '<select id="mcGPeriode" aria-label="Periode">' + opts(dd.perioden) + '</select>' +
        '</div>' +
        '<div class="mc-half">' +
          '<input id="mcGBedrag" type="number" min="0" placeholder="bedrag in euro" aria-label="Bedrag in euro">' +
          '<input id="mcGDatum" type="date" aria-label="Datum">' +
        '</div>' +
        /* De twee vinkjes van de pagina zijn hier chips die goud oplichten:
           dezelfde keuze, maar in de vormtaal die dit scherm al heeft. */
        '<div class="chips" style="margin:.7rem 0 0;">' +
          '<button type="button" id="mcGBet" aria-pressed="false">al betaald</button>' +
          '<button type="button" id="mcGFound" aria-pressed="false">via RTFoundation</button>' +
        '</div>' +
        '<button class="knop hoofd h-mt70" type="submit">Vastleggen</button>' +
      '</form>' +
      '<h2>Uw giften</h2>' +
      '<div class="kaart" id="mcLijst">' +
        ((dd.giften || []).length ? dd.giften.map(giftRij).join('')
          : '<p class="stil">Nog geen giften vastgelegd.</p>') +
      '</div>' +
      '<h2>Vraag de adviseur</h2>' +
      '<div class="kaart">' +
        '<div class="mc-uit" id="mcAiUit" hidden aria-live="polite"></div>' +
        '<form class="mc-vraag" id="mcAiForm">' +
          '<input id="mcAiIn" placeholder="Bijv. spreid ik mijn giften goed over de thema\'s?" ' +
            'aria-label="Uw vraag aan de adviseur" autocomplete="off">' +
          '<button class="knop hoofd" type="submit">Vraag</button>' +
        '</form>' +
      '</div>';
  };

  /* Meenemen (shared/uitvoer.js): het dossier is een register van giften met
     echte velden, doel, thema, bedrag, periode, datum. Dat gaat mee, niet de
     zin van de kaart. Zelfde kolommen als de oude pagina. */
  M.bron = function () {
    if (!M.stand) return null;
    return { naam: 'giften',
      kolommen: ['doel', 'thema', 'bedrag', 'periode', 'datum', 'status', 'via foundation'],
      rijen: (M.stand.giften || []).map(function (g) {
        return [g.doel || '', g.thema || '', g.bedrag || 0, g.periode || '', g.datum || '',
          g.betaald ? 'betaald' : 'toegezegd', g.foundation ? 'ja' : 'nee'];
      }) };
  };
})(window, document);

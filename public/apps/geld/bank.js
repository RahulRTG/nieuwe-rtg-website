/* Stand -- Bank, deel 1: de opbouw. Was /apps/bank.html (RTG Rekening).
   Dit bestand tekent alleen; bankb.js haalt de data, bindt de knoppen,
   luistert naar de eventstream en registreert de stand. Gesplitst omdat de
   repo elk bestand onder de 10 KB houdt; samen zijn ze een stand. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var B = Deel.bank = { ov: null, hart: null, stil: false };

  /* Idempotentie-sleutel uit de CSPRNG. Niet via shared/id.js: geld.html
     laadt dat bestand niet en deze stand mag de pagina niet aanraken, dus
     de sleutel komt hier rechtstreeks uit dezelfde bron. Zonder sleutel zou
     een dubbeltik op Storten dubbel kunnen boeken. */
  B.sleutel = function (voor) {
    var b = new Uint8Array(16);
    crypto.getRandomValues(b);
    return voor + '-' + Array.prototype.map.call(b, function (x) {
      return ('0' + x.toString(16)).slice(-2);
    }).join('');
  };

  /* De vormen die geld.html niet kent en die dit paneel onleesbaar maken als
     ze ontbreken: de rekeningregel, de afschriftregel met bronlabel en het
     staafje van de inzichten. Een keer injecteren, met id-wacht. */

  // de bank staat nog niet aan: eerlijk zeggen, en wijzen op wat wel werkt
  B.offline = function () {
    return '<div class="kaart s-1opwjnf"><strong>Binnenkort</strong>' +
      '<p class="stil h-mt50">RTG Rekening opent hier zodra RTG hem live zet. ' +
      'Je RTG Pay-wallet werkt gewoon door.</p></div>';
  };

  B.akkoordVraag = function () {
    return '<div class="kaart s-1opwjnf"><strong>Open je RTG Rekening</strong>' +
      '<p class="stil h-mt50">Je eigen rekening binnen RTG: een echt IBAN, met tegoedrente van ' +
      w.Geld.esc(String(B.ov.spaarrentePct)) + '%, passen en meer. Gebouwd op hetzelfde grootboek als RTG Pay. ' +
      'Alle premium functies zijn inbegrepen, gratis. Heb je de Business Pass, dan komt je zakelijke rekening er ' +
      'automatisch bij. Ga je akkoord, dan openen we meteen je betaalrekening.</p>' +
      '<button class="knop hoofd h-mt100" id="bkAkk">Ik ga akkoord en open mijn rekening</button></div>';
  };

  B.rekSelect = function (id) {
    var Geld = w.Geld;
    return '<select id="' + id + '">' + (B.ov.rekeningen || []).map(function (r) {
      return '<option value="' + Geld.esc(r.iban) + '">' + Geld.esc(r.soortLabel || r.soort) +
        ' · ' + Geld.euro(r.saldoCenten) + '</option>';
    }).join('') + '</select>';
  };

  B.rekHtml = function (r) {
    var Geld = w.Geld;
    return '<div class="bk-rek"><div>' +
      '<div class="bk-sald">' + Geld.euro(r.saldoCenten) + '</div>' +
      '<div class="bk-soort">' + Geld.esc(r.soortLabel || r.soort) + (r.bevroren ? ' · bevroren' : '') + '</div>' +
      '<div class="bk-iban">' + Geld.esc(r.iban) + '</div></div>' +
      '<div class="bk-rij">' +
        '<button class="knop bk-mini" data-bkstort="' + Geld.esc(r.iban) + '">Storten</button>' +
        '<button class="knop bk-mini" data-bkwallet="' + Geld.esc(r.iban) + '">Naar wallet</button>' +
        '<button class="knop bk-mini" data-bkpas="' + Geld.esc(r.iban) + '">Pas</button>' +
        (r.soort === 'spaar' ? '<button class="knop bk-mini" data-bkdoel="' + Geld.esc(r.iban) + '">Spaardoel</button>' : '') +
        '<button class="knop bk-mini" data-bkaf="' + Geld.esc(r.iban) + '">Afschrift</button>' +
        '<button class="knop bk-mini" data-bkcsv="' + Geld.esc(r.iban) + '" title="Download het afschrift als CSV-bestand">CSV</button>' +
      '</div>' +
      '<div class="bk-blad stil s-1xp41ko" data-bkblad="' + Geld.esc(r.iban) + '" hidden ' +
        '></div></div>';
  };

  // een regel van het financiele hart: omschrijving, bronlabel, datum, bedrag
  B.hrow = function (r) {
    var Geld = w.Geld;
    return '<div class="bk-hrow"><div><span>' + Geld.esc(r.oms || r.soort) + '</span>' +
      '<span class="bk-pil' + (r.bron === 'RTG Rekening' || r.bron === 'RTG Pay' ? ' bk-rtg' : '') + '">' +
        Geld.esc(r.bron) + '</span>' +
      '<div class="bk-sub">' + new Date(r.at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }) +
        ' · ' + Geld.esc(r.tegen) + '</div></div>' +
      '<div class="bk-bed">' + (r.af ? '−' : '+') + ' ' + Geld.euro(r.centen) + '</div></div>';
  };

  B.vrow = function (l) {
    var Geld = w.Geld;
    return '<div class="bk-hrow"><div><span>' + Geld.esc(l.oms || l.tegen) + '</span>' +
      '<div class="bk-sub">' + Geld.esc(l.tegen) + ' · ' + l.maanden + ' maanden gezien</div></div>' +
      '<div class="bk-bed">' + Geld.euro(l.centen) + '</div></div>';
  };

  B.inzicht = function (i) {
    var Geld = w.Geld;
    var top = (i.perSoort || []).slice(0, 6);
    var max = top.length ? top[0].centen : 1;
    return '<p class="stil">' + Geld.esc(i.maand) + ' · ' + i.posten + ' posten · totaal ' +
      Geld.euro(i.uitgavenCenten) + '</p>' +
      (top.length ? top.map(function (s) {
        return '<div class="s-v8b87u">' + Geld.esc(s.soort) + ' · ' + Geld.euro(s.centen) +
          '<div class="bk-staaf"><i style="width:' + Math.max(4, Math.round(100 * s.centen / max)) + '%;"></i></div></div>';
      }).join('') : '<p class="leeg">Nog geen uitgaven deze maand.</p>');
  };

  /* Het volledige afschrift van een rekening als CSV-download. De ene plek
     met een eigen fetch, want Geld.api leest JSON en dit antwoord is een
     bestand (blob). Het token komt wel uit Geld.token() en gaat in de
     Authorization-header, nooit in een URL. */
  B.csv = async function (iban) {
    var Geld = w.Geld;
    try {
      var r = await fetch('/api/bank/afschrift.csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (Geld.token() || '') },
        body: JSON.stringify({ iban: iban })
      });
      if (!r.ok) {
        var f = await r.json().catch(function () { return {}; });
        throw new Error(f.error || 'Export mislukt.');
      }
      /* Gebruik hier bewust de native documentbinding. De statische
         laadgraaf kan daardoor bewijzen dat dit een downloadanker is en geen
         verborgen stylesheet- of scriptloader. */
      var downloadAnker = document.createElement('a');
      downloadAnker.href = URL.createObjectURL(await r.blob());
      downloadAnker.download = 'rtg-afschrift-' + iban + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      document.body.appendChild(downloadAnker); downloadAnker.click(); downloadAnker.remove();
      setTimeout(function () { URL.revokeObjectURL(downloadAnker.href); }, 5000);
    } catch (e) { Geld.melding(e.message); }
  };
})(window, document);

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
  B.stijl = function () {
    if (d.getElementById('bkStijl')) return;
    var s = d.createElement('style');
    s.id = 'bkStijl';
    s.textContent =
      '#paneel .bk-rij{display:flex;gap:.5rem;flex-wrap:wrap;align-items:flex-end;}' +
      '#paneel .bk-rij select,#paneel .bk-rij input{width:auto;}' +
      '#paneel .bk-mini{font-size:.75rem;padding:.32rem .6rem;}' +
      '#paneel .bk-rek{display:flex;justify-content:space-between;align-items:center;gap:.6rem;' +
        'padding:.7rem 0;border-bottom:1px solid var(--rtg-line);flex-wrap:wrap;}' +
      '#paneel .bk-rek:last-child{border-bottom:0;}' +
      '#paneel .bk-sald{font-size:1.25rem;color:var(--gold-tekst);font-variant-numeric:var(--rtg-cijfers);}' +
      '#paneel .bk-iban{font-size:.72rem;color:var(--rtg-soft);letter-spacing:.04em;}' +
      '#paneel .bk-soort{font-size:.7rem;color:var(--rtg-soft);text-transform:uppercase;letter-spacing:.08em;}' +
      '#paneel .bk-hrow{display:flex;justify-content:space-between;align-items:baseline;gap:.6rem;' +
        'padding:.5rem 0;border-bottom:1px solid var(--rtg-line);font-size:.82rem;}' +
      '#paneel .bk-hrow:last-child{border-bottom:0;}' +
      '#paneel .bk-sub{color:var(--rtg-soft);font-size:.7rem;margin-top:.1rem;}' +
      '#paneel .bk-bed{white-space:nowrap;font-variant-numeric:var(--rtg-cijfers);}' +
      '#paneel .bk-pil{display:inline-block;border:1px solid var(--rtg-line);border-radius:0;' +
        'padding:.06rem .5rem;font-size:.62rem;letter-spacing:.06em;text-transform:uppercase;' +
        'color:var(--rtg-soft);margin-left:.4rem;vertical-align:middle;}' +
      '#paneel .bk-pil.bk-rtg{color:var(--gold-tekst);border-color:var(--gold-rand);}' +
      '#paneel .bk-staaf{height:6px;background:var(--rtg-line);border-radius:0;overflow:hidden;margin-top:.25rem;}' +
      '#paneel .bk-staaf i{display:block;height:100%;background:var(--gold-basis);}' +
      '#paneel .bk-snel{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.7rem;}';
    d.head.appendChild(s);
  };

  // de bank staat nog niet aan: eerlijk zeggen, en wijzen op wat wel werkt
  B.offline = function () {
    return '<div class="kaart" style="text-align:center;padding:1.6rem;"><strong>Binnenkort</strong>' +
      '<p class="stil h-mt50">RTG Rekening opent hier zodra RTG hem live zet. ' +
      'Je RTG Pay-wallet werkt gewoon door.</p></div>';
  };

  B.akkoordVraag = function () {
    return '<div class="kaart" style="text-align:center;padding:1.6rem;"><strong>Open je RTG Rekening</strong>' +
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
      '<div class="bk-blad stil" data-bkblad="' + Geld.esc(r.iban) + '" hidden ' +
        'style="flex-basis:100%;line-height:1.7;font-size:.78rem;"></div></div>';
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
        return '<div style="margin-top:0.5rem;font-size:.78rem;">' + Geld.esc(s.soort) + ' · ' + Geld.euro(s.centen) +
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
      var a = d.createElement('a');
      a.href = URL.createObjectURL(await r.blob());
      a.download = 'rtg-afschrift-' + iban + '-' + new Date().toISOString().slice(0, 10) + '.csv';
      d.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    } catch (e) { Geld.melding(e.message); }
  };
})(window, document);

/* Stand Waarde, deel 2 van 3: terugstorten naar de eigen rekening.

   Leunt op w.RTGGeldDeel.waarde uit waarde.js. Zet zijn eigen stukken op
   w.RTGGeldDeel.waardeTerug; waardec.js doet de registratie.

   Routes: /api/pay/terugstand (wat kan er, en wat mist er nog),
   /api/pay/rekening (de bestemming) en /api/pay/terug (het geld terugvragen).

   TWEE DINGEN DIE DIT SCHERM ANDERS DOET DAN EEN GEWOON BETAALSCHERM.

   Er staat nooit een knop uitgegrijsd zonder uitleg. `terugstand` geeft de
   blokkades terug MET hun reden, en die reden komt hier woordelijk op het
   scherm. Bij geld belt iemand niet over een knop die niet werkt -- hij
   vertrouwt het niet meer.

   En het verschil tussen "kan even niet" en "doen we niet" wordt vastgehouden.
   Staat de terugstorting op `gesloten` (een besluit van RTG, zie WAARDE.md par.
   9), dan zegt dit scherm dat het een keuze is en geen storing. Wie leest
   "hiervoor is een vergunning nodig" gaat wachten op iets dat niet komt. */
(function (w, d) {
  'use strict';
  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  var G = w.Geld;
  var $ = function (s) { return d.querySelector(s); };
  var D = (w.RTGGeldDeel || {}).waarde || {};

  function vul(id, html) { var e = $(id); if (e) e.innerHTML = html; }

  /* ---------- de portefeuille ---------- */
  async function laadPortefeuille() {
    try {
      var p = await G.api('/api/pay/portefeuille');
      var posities = (p.posities || []).filter(function (x) { return x.waardepositie; });
      vul('#wdTotalen', D.totalen(p));
      vul('#wdPosities', posities.length
        ? posities.map(D.positie).join('')
        : '<p class="stil">Er staat nog niets op uw naam.</p>');
      var vast = [];
      posities.forEach(function (x) { (x.reserveringen || []).forEach(function (r) { vast.push(r); }); });
      vul('#wdVast', D.reserveringen(vast));
    } catch (e) {
      vul('#wdTotalen', '<p class="stil">De portefeuille kon niet worden geladen: ' + G.esc(e.message) + '</p>');
    }
  }

  async function laadGraaf() {
    try { vul('#wdGraaf', D.graaf(await G.api('/api/pay/graaf', { dagen: 30 }))); }
    catch (e) { vul('#wdGraaf', ''); }
  }

  /* ---------- terugstorten ---------- */
  /* De blokkades komen van de server met een reden per stuk. Ze worden hier
     getoond zoals ze zijn -- niet samengevat tot "niet beschikbaar", want dan
     is de uitleg die de server met zorg meestuurt onderweg weggegooid. */
  function blokkadeRegel(b) {
    var kop = { stand: 'Dit doet RTG niet', bevoegdheid: 'Nog niet toegestaan',
      rekening: 'Geen rekening bekend', wachttijd: 'Er loopt een wachttijd',
      bedrag: 'Geen bedrag beschikbaar' }[b.wat] || 'Kan niet';
    return '<div class="wd-rij"><span><b>' + G.esc(kop) + '</b><br><span class="stil">' +
      G.esc(b.uitleg || '') + '</span></span></div>';
  }

  function tekenTerug(s) {
    var r = s.rekening;
    var html = '<div class="wd-twee"><div><div class="kop">Beschikbaar om terug te storten</div>' +
      '<p class="wd-bedrag">' + G.euro(s.beschikbaar) + '</p>' +
      (s.gereserveerd ? '<p class="stil">' + G.euro(s.gereserveerd) + ' staat vast en gaat niet mee.</p>' : '') +
      '</div><div><div class="kop">Uw rekening</div>' +
      (r ? '<p class="wd-bedrag">' + G.esc(r.iban) + '</p><p class="stil">' + G.esc(r.naam) +
            (r.bruikbaar ? '' : ' · kan nog niet ontvangen') + '</p>'
         : '<p class="stil">Nog niet ingesteld.</p>') +
      '</div></div>';

    if (s.blokkades && s.blokkades.length) {
      html += '<div class="kaart h-mt50"><div class="kop">Wat er nog mist</div>' +
        s.blokkades.map(blokkadeRegel).join('') + '</div>';
    }
    /* Het bedragveld en de knop staan er alleen als het ook kan. Een invoerveld
       dat je mag vullen bij een handeling die niet doorgaat, is een belofte. */
    if (s.kan) {
      html += '<label class="lbl" for="wdBedrag">Bedrag in euro\'s</label>' +
        '<input id="wdBedrag" type="text" inputmode="decimal" placeholder="0,00" ' +
        'aria-describedby="wdTerugUit">' +
        '<p class="stil" id="wdTerugUit">Het bedrag gaat meteen van uw saldo af en staat daarna klaar om verstuurd te worden. Wanneer het op uw rekening staat, bepaalt uw bank.</p>' +
        '<button class="knop hoofd h-mt40" id="wdTerugGa" type="button">Terugstorten</button>';
    }
    html += '<h2>De rekening</h2>' +
      '<label class="lbl" for="wdIban">IBAN</label><input id="wdIban" placeholder="NL00 BANK 0000 0000 00" autocomplete="off">' +
      '<label class="lbl" for="wdNaam">Op naam van</label><input id="wdNaam" placeholder="Uw naam" autocomplete="off">' +
      '<button class="knop h-mt40" id="wdIbanGa" type="button">Rekening opslaan</button>' +
      '<p class="stil h-mt40">De eerste rekening kan meteen ontvangen. Wijzigt u hem later, dan geldt er een wachttijd &mdash; dat is er om te voorkomen dat iemand die uw account overneemt uw saldo naar zijn eigen rekening stuurt.</p>';
    vul('#wdTerug', html);
    var ga = $('#wdTerugGa'); if (ga) ga.addEventListener('click', terugstorten);
    var ib = $('#wdIbanGa'); if (ib) ib.addEventListener('click', rekeningZet);
  }

  async function laadTerug() {
    try { tekenTerug(await G.api('/api/pay/terugstand')); }
    catch (e) {
      /* Een 503 hier is de bevoegdheidslaag: de handeling staat uit. Dat is
         geen storing van dit scherm en hoort ook niet als storing te lezen. */
      vul('#wdTerug', '<p class="stil">' + G.esc(e.message) + '</p>');
    }
  }

  async function rekeningZet() {
    var iban = ($('#wdIban') || {}).value || '';
    var naam = ($('#wdNaam') || {}).value || '';
    try {
      var r = await G.api('/api/pay/rekening', { iban: iban, naam: naam });
      G.melding(r.uitleg || 'De rekening staat klaar.');
      laadTerug();
    } catch (e) { G.melding(e.message); }
  }

  async function terugstorten() {
    var centen = G.centen(($('#wdBedrag') || {}).value);
    if (centen == null) { G.melding('Vul een bedrag in.'); return; }
    try {
      var r = await G.api('/api/pay/terug', { centen: centen, idem: w.RTGId ? w.RTGId('terug') : 'terug-' + Date.now() });
      G.melding(r.uitleg || 'Het bedrag staat klaar om verstuurd te worden.');
      laadTerug(); laadPortefeuille();
    } catch (e) {
      /* De server stuurt bij een weigering de REDEN mee (opheffbaar, wachttijd,
         beschikbaar). Die staat al in het bericht; wat hier telt is dat het
         scherm daarna de nieuwe stand toont in plaats van de oude te laten staan. */
      G.melding(e.message); laadTerug();
    }
  }

  Deel.waardeTerug = { laadPortefeuille: laadPortefeuille, laadGraaf: laadGraaf, laadTerug: laadTerug };
})(window, document);

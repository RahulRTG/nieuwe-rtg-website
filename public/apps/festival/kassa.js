/* RTG Festival, het scherm: HET BLAD "KASSA".

   DE VOLGORDE OP HET SCHERM IS DE VOLGORDE IN DE KERN, en dat is geen toeval.
   Eerst de plek vastzetten, dan pas betalen. Wie deze twee omdraait -- eerst
   afrekenen en dan kijken of er nog plek is -- verkoopt de laatste plek twee
   keer aan twee mensen die allebei hebben betaald, en dan mag er iemand aan de
   poort uitleggen wie er niet naar binnen mag (kern/festival/verkoop.js).

   Het scherm laat die twee stappen daarom ZIEN. Na "zet vast" staat er wat er
   vastligt en wat het kost; pas daarna verschijnen de betaalknoppen. En er
   staat een knop "laat los", want een klant die zich bedenkt hoort de plek niet
   een kwartier te blokkeren.

   DE PASCODE KOMT GROOT IN BEELD. Dat is het enige wat de klant meeneemt; hij
   moet hem kunnen overschrijven of fotograferen, ook in de zon en ook als hij
   hem net heeft horen voorlezen. */
(function () {
  'use strict';
  var F = window.RTGFestival;
  if (!F) return;

  var $ = function (s) { return document.querySelector(s); };
  var kop = $('#kassaZin'), aanbod = $('#kassaAanbod'), koper = $('#kassaKoper');
  var open = $('#kassaOpen'), openZin = $('#kassaOpenZin');
  var pasVak = $('#kassaPas'), pasCode = $('#kassaPasCode'), pasBij = $('#kassaPasBij');
  var gekozen = null, lopend = null;

  function meld(t) { kop.textContent = t; }

  function toonAanbod(lijst) {
    aanbod.textContent = '';
    if (!lijst.length) {
      var leeg = document.createElement('div');
      leeg.className = 'fp-regel';
      leeg.textContent = 'Er staat nog geen product klaar. Zet er een bij op Inrichten.';
      aanbod.appendChild(leeg);
      return;
    }
    lijst.forEach(function (p) {
      var d = document.createElement('button');
      d.type = 'button';
      /* De vorm komt uit .fp-regel; hier alleen wat een KNOP anders maakt dan
         een regel. Inline stijlen die de klasse herhalen, lopen bij de eerste
         wijziging uit de pas met de klasse. */
      d.className = 'fp-regel';
      d.style.cursor = 'pointer';
      if (gekozen === p.id) d.setAttribute('data-sig', 'hoog');
      var naam = document.createElement('span');
      /* De ruimte staat erbij als FEIT en niet als aansporing: "3" en niet
         "nog maar 3!" (CLAUDE.md verbiedt kunstmatige urgentie). */
      naam.textContent = p.naam + ' · € ' + Number(p.prijs).toFixed(2).replace('.', ',');
      d.appendChild(naam);
      var rechts = document.createElement('span');
      rechts.className = 'rek';
      /* De krapste schakel wordt alleen genoemd als het een ANDER product is:
         "1 vrij (Weekend)" bij het product Weekend is ruis, "1 vrij (Camping)"
         bij een bundel is precies wat de kassamedewerker moet weten. */
      rechts.textContent = p.ruimte === null ? 'geen grens'
        : p.ruimte + ' vrij' + (p.krapste && p.krapste !== p.naam ? ' (' + p.krapste + ')' : '');
      d.appendChild(rechts);
      d.addEventListener('click', function () { gekozen = p.id; laad(); });
      aanbod.appendChild(d);
    });
  }

  function laad() {
    F.api('/api/festival/producten', { festival: F.staat.fid, editie: F.staat.eid })
      .then(function (r) {
        var lijst = (r.body || {}).producten || [];
        toonAanbod(lijst);
        var p = lijst.filter(function (x) { return x.id === gekozen; })[0];
        meld(p ? p.naam : 'Kies wat u verkoopt.');
      })
      .catch(function () { meld('Geen verbinding.'); });
  }

  function toonLopend(v) {
    lopend = v;
    open.hidden = !v;
    if (!v) return;
    openZin.textContent = 'Vastgezet voor ' + v.koper + ' · € '
      + Number(v.prijs).toFixed(2).replace('.', ',');
  }

  function rond(methode, payCode) {
    if (!lopend) return;
    F.api('/api/festival/verkoop/rond', { festival: F.staat.fid, editie: F.staat.eid,
      id: lopend.id, methode: methode, payCode: payCode })
      .then(function (r) {
        var b = r.body || {};
        if (!b.ok) {
          /* De plek is dan al losgelaten door de server; het scherm hoort dat te
             zeggen en niet stil terug te vallen op "er ging iets mis". */
          meld(b.error || 'De betaling ging niet door.');
          if (b.losgelaten) { toonLopend(null); laad(); }
          return;
        }
        toonLopend(null);
        pasVak.hidden = false;
        pasCode.textContent = b.pas.code;
        pasBij.textContent = b.pas.drager + ' · ' + b.verkoop.betaald.methode
          + ' · € ' + (b.verkoop.betaald.centen / 100).toFixed(2).replace('.', ',');
        koper.value = '';
        laad();
      })
      .catch(function () { meld('Geen verbinding; er is niets afgerekend.'); });
  }

  $('#kassaForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    if (!gekozen) { meld('Kies eerst een product.'); return; }
    var wie = koper.value.trim();
    if (!wie) { meld('Op wiens codenaam komt deze plek?'); return; }
    pasVak.hidden = true;
    F.api('/api/festival/verkoop', { festival: F.staat.fid, editie: F.staat.eid,
      product: gekozen, koper: wie })
      .then(function (r) {
        var b = r.body || {};
        if (!b.ok) { meld(b.error || 'Kon niet vastzetten.'); laad(); return; }
        toonLopend(b.verkoop);
        laad();
      })
      .catch(function () { meld('Geen verbinding.'); });
  });

  $('#kassaContant').addEventListener('click', function () { rond('contant', null); });
  $('#kassaPay').addEventListener('click', function () {
    rond('rtgpay', $('#kassaPayCode').value.trim().toUpperCase());
  });
  $('#kassaLos').addEventListener('click', function () {
    if (!lopend) return;
    F.api('/api/festival/verkoop/los', { festival: F.staat.fid, editie: F.staat.eid, id: lopend.id })
      .then(function () { toonLopend(null); meld('Losgelaten; de plek is weer vrij.'); laad(); })
      .catch(function () { meld('Geen verbinding.'); });
  });

  F.opBlad('kassa', laad);
})();

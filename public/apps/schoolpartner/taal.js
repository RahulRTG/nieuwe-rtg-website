/* RTG School Partner: de taallaag -- het vakbeleid en de poort naar het gezin.

   HET VAKBELEID. Per vak staat er wat er aan thuistaalsteun mag, met de reden
   erbij. Bij een taalvak staat "volledig" er niet als keuze -- dat is geen
   instelling maar de meting zelf: wie de opgave van Nederlands volledig
   vertaalt, meet niets meer en merkt dat pas bij het examen.

   DE POORT. Een bericht aan een gezin gaat eerst heen en weer: u ziet de
   vertaling EN de terugvertaling, met de betekenisverschillen erbij. Is er iets
   verschoven in een ontkenning, een verplichting, een getal of een datum, dan
   is bevestigen niet genoeg -- dan zegt u apart dat u het gezien heeft.

   Het bonnetje staat erbij en niet in een logboek dat niemand opent: welk
   model, wat er wel en niet in ging, wanneer en op wiens naam. Zonder bon gaat
   er niets naar een gezin.

   Zelfde SPart-patroon; app.js roept SPart.taal() aan. */
window.SPart = window.SPart || {};
window.SPart.taal = function () {
  var P = window.SPart, kl = P.kl, esc = P.esc, meld = P.meld;
  var q = function (id) { return document.getElementById(id); };
  var LAATST = null;

  function beleid() {
    var vak = q('taalbeleidVorm');
    if (!vak) return;
    kl('/school/taalbeleid').then(function (r) {
      if (r.body.error) { vak.innerHTML = '<p class="stil">' + esc(r.body.error) + '</p>'; return; }
      vak.innerHTML = r.body.vakken.map(function (v) {
        return '<div class="item" style="align-items:flex-start;"><span><b>' + esc(v.vak) + '</b> ' +
          '<span class="stil">' + esc(v.steun) + (v.maximum !== 'volledig' ? ' (hoogstens ' + esc(v.maximum) + ')' : '') + '</span>' +
          '<br><span class="stil">' + esc(v.reden) + '</span></span></div>';
      }).join('') + '<p class="stil">' + esc(r.body.uitleg) + '</p>';
    });
  }

  function poort() {
    var vak = q('berichtVorm');
    if (!vak) return;
    vak.innerHTML =
      '<div class="rij">' +
      '<input class="veld" id="btTaal" maxlength="8" placeholder="Taal van het gezin (bijv. en)" aria-label="Taal van het gezin">' +
      '<button class="knop" id="btKijk" type="button">Controleer</button></div>' +
      '<textarea class="veld" id="btTekst" rows="3" maxlength="1200" placeholder="Uw bericht in het Nederlands" aria-label="Uw bericht"></textarea>' +
      '<div id="btUit" class="stil" style="margin-top:.5rem;"></div>';

    q('btKijk').addEventListener('click', function () {
      var tekst = q('btTekst').value.trim(), taal = q('btTaal').value.trim().toLowerCase();
      if (!tekst || !taal) return meld('Geef de tekst en de taal van het gezin.');
      kl('/school/bericht/controleer', { tekst: tekst, taal: taal }).then(function (r) {
        if (r.body.error) return meld(r.body.error);
        LAATST = r.body; LAATST.tekst = tekst;
        q('btUit').innerHTML =
          '<div><b>Vertaling:</b> ' + esc(r.body.vertaling) + '</div>' +
          '<div><b>Terugvertaald:</b> ' + esc(r.body.terug) + '</div>' +
          (r.body.verschillen.length
            ? '<div style="margin-top:.4rem;"><b>Verschoven:</b><br>' + r.body.verschillen.map(function (v) {
                return '&bull; ' + esc(v.wat) + ' <span class="stil">(' + esc(v.soort) + ', ' + esc(v.ernst) + ')</span>';
              }).join('<br>') + '</div>'
            : '') +
          '<div style="margin-top:.4rem;">' + esc(r.body.uitleg) + '</div>' +
          '<div class="stil" style="margin-top:.4rem;"><b>Bon:</b> model ' + esc(r.body.bon.model) +
          ' &middot; wel gebruikt: ' + r.body.bon.gebruikt.map(esc).join(', ') +
          ' &middot; niet gebruikt: ' + r.body.bon.nietGebruikt.map(esc).join(', ') + '</div>' +
          '<div class="rij" style="margin-top:.5rem;">' +
          '<input class="veld" id="btDoor" maxlength="60" placeholder="Uw naam" aria-label="Uw naam">' +
          (r.body.moetGezien ? '<label class="stil"><input type="checkbox" id="btGezien"> Ik heb de verschoven betekenis gezien</label>' : '') +
          '<button class="knop p" id="btStuur" type="button">Versturen</button></div>';
        q('btStuur').addEventListener('click', versturen);
      });
    });
  }

  function versturen() {
    if (!LAATST) return;
    var door = q('btDoor').value.trim();
    if (!door) return meld('Zet uw naam erbij; een bericht aan een gezin gaat op naam de deur uit.');
    var gezien = q('btGezien');
    if (LAATST.moetGezien && (!gezien || !gezien.checked))
      return meld('Er is iets verschoven in een ontkenning, verplichting, getal of datum. Bevestig apart dat u dat hebt gezien.');
    kl('/school/bericht/verstuur', { bevestigd: true, verschillenGezien: !!(gezien && gezien.checked),
      door: door, tekst: LAATST.tekst, vertaling: LAATST.vertaling, taal: LAATST.taal,
      verschillen: LAATST.verschillen, model: LAATST.bon.model })
      .then(function (r) {
        if (r.body.error) return meld(r.body.error);
        meld(r.body.uitleg);
        LAATST = null;
        poort();
      });
  }

  beleid();
  poort();
};

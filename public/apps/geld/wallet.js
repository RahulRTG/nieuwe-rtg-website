/* Stand Wallet, deel 1 van 2. Was /apps/wallet.html.

   Dit bestand registreert GEEN stand: het zet de gedeelde stukken van de
   wallet op w.RTGGeldDeel.wallet en walletb.js (dat erna laadt) doet de
   registratie. De splitsing bestaat alleen om de maatregel van de repo
   (bestanden onder de 10 KB) te halen; het is samen een stand.

   Hier staat wat de wallet echt eigen heeft: de ledenpas met QR, het
   oplichtende codescherm, en de stijl daarvoor. */
(function (w, d) {
  'use strict';
  var $ = function (s) { return d.querySelector(s); };
  var TIER = { rtg: 'RTG Pass', lifestyle: 'Lifestyle Pass', business: 'Business Pass', guest: 'Gratis account' };

  /* De ledenpas en het codescherm kan geen enkele klasse van geld.html
     leveren; alleen daarvoor een eigen stukje stijl, met een id-wacht zodat
     het maar een keer in het document komt. Het codescherm is met opzet
     licht: goed afleesbaar aan elke balie. */

  /* Onze eigen QR-codec (shared/qr.js + qrteken.js), geen extern pakket. */
  function pasQr(tekst) {
    if (!w.RTGQRteken) return null;
    try {
      var cv = w.RTGQRteken.teken(String(tekst), { schaal: 4, quiet: 2 });
      cv.setAttribute('role', 'img');
      cv.setAttribute('aria-label', 'QR met lidnummer ' + tekst);
      return cv;
    } catch (e) { return null; }
  }

  /* Het grote codescherm: elk item in de wallet kan erop. */
  function toon(it) {
    $('#waToonTitel').textContent = it.titel;
    $('#waToonCode').textContent = it.code || '';
    $('#waToonSub').textContent = it.soort === 'munt' ? 'Saldo: ' + it.saldo + ' munten'
      : it.geldigTot ? 'Geldig tot ' + it.geldigTot : '';
    $('#waScrim').classList.add('aan');
  }

  /* De ledenpas draagt bewust GEEN echte naam: codenaam, lidnummer en pas.
     De echte naam ligt in de gescheiden kluis (privacy by design). */
  function tekenPas(user) {
    var esc = w.Geld.esc;
    var vak = $('#waPas');
    /* De API kan antwoorden nadat de gebruiker al naar een andere Geld-stand
       ging. Dan is er niets meer te tekenen; een late reactie mag het nieuwe
       paneel niet met een null-fout vervuilen. */
    if (!vak) return;
    if (!user) { vak.innerHTML = RTGLeeg.html(RTGLeeg.inlogStand({
      ey: 'Wallet', wat: 'Uw pas hoort bij uw account en wordt niet zonder aanmelding getoond.' })); return; }
    vak.innerHTML =
      '<div class="wa-pas">' +
        '<div class="label">Uw codenaam, uw identiteit in onze systemen</div>' +
        '<div class="cn" id="waPasCn">' + esc(user.codename || '') + '</div>' +
        '<div class="row"><div>' +
          '<div class="mrow">Lidnummer<b>' + esc(user.number || 'nog niet toegekend') + '</b></div>' +
          '<div class="mrow">Pas<b>' + esc(TIER[user.tier] || user.tier || '') + '</b></div>' +
          (user.leeftijdsgroep ? '<div class="mrow">Leeftijd<b>' + esc(user.leeftijdsgroep) + ' · paspoort</b></div>' : '') +
        '</div><div class="qr" id="waPasQr"></div></div>' +
        '<button class="waarom" type="button" id="waPasWaarom">Waarom een codenaam? →</button>' +
        '<div class="wa-uitleg" id="waPasWaaromT"><b>Uw echte naam staat niet in onze reisdata.</b> ' +
          'Reserveringen, betalingen en Salon-activiteit staan op uw codenaam. Uw echte naam ligt in een ' +
          'gescheiden, versleutelde kluis en wordt pas bij ticketing en check-in eenmalig gekoppeld. Zou ' +
          'reisdata ooit gestolen worden, dan heeft de aanvaller nooit de juiste naam bij uw reizen.</div>' +
      '</div>';
    var qr = pasQr(user.number || user.codename || 'RTG');
    if (qr) $('#waPasQr').appendChild(qr); else $('#waPasQr').remove();
    $('#waPasWaarom').addEventListener('click', function () {
      var t = $('#waPasWaaromT');
      t.classList.toggle('open');
      $('#waPasWaarom').textContent = t.classList.contains('open') ? 'Sluiten ↑' : 'Waarom een codenaam? →';
    });
    /* Tik op de kaart zelf: hetzelfde grote codescherm als bij de andere passen. */
    $('#waPasCn').addEventListener('click', function () {
      toon({ titel: TIER[user.tier] || 'RTG', code: user.number || '', soort: 'pas', geldigTot: null });
    });
  }

  async function laadPas() {
    /* De pas komt uit /api/state, dezelfde route als de leden-app. Faalt die,
       dan werkt de rest van de wallet gewoon; daarom hier alleen stil melden
       en niet de hele stand blokkeren. */
    try {
      var r = await w.Geld.api('/api/state');
      tekenPas(r && r.state && r.state.user);
    } catch (e) {
      var vak = $('#waPas');
      if (vak) vak.innerHTML = RTGLeeg.html(RTGLeeg.vanFout(e, { ey: 'Wallet',
        titel: 'Uw pas is nu niet op te halen.' }));
    }
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.wallet = { toon: toon, laadPas: laadPas };
})(window, document);

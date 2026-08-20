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
  function stijl() {
    if (d.getElementById('waStijl')) return;
    var st = d.createElement('style');
    st.id = 'waStijl';
    st.textContent =
      '#paneel .wa-pas{background:linear-gradient(150deg,#241016,#150C0F 55%,#0C0C0B);' +
        'border:1px solid rgba(201,162,75,.34);border-radius:0;padding:1.3rem 1.35rem 1.2rem;' +
        'position:relative;overflow:hidden;margin:.6rem 0 1rem;}' +
      '#paneel .wa-pas .label{font-size:.6rem;letter-spacing:.2em;text-transform:uppercase;color:var(--rtg-soft);}' +
      '#paneel .wa-pas .cn{font-family:"Bodoni Moda",serif;font-weight:400;line-height:1.1;' +
        'font-size:clamp(1.7rem,7vw,2.35rem);margin:.45rem 0 .9rem;cursor:pointer;}' +
      '#paneel .wa-pas .row{display:flex;align-items:flex-end;justify-content:space-between;gap:1rem;}' +
      '#paneel .wa-pas .mrow{font-size:.56rem;letter-spacing:.14em;text-transform:uppercase;color:var(--rtg-soft);}' +
      '#paneel .wa-pas .mrow+.mrow{margin-top:.55rem;}' +
      '#paneel .wa-pas .mrow b{display:block;font-size:.78rem;color:var(--rtg-txt);font-weight:500;margin-top:.2rem;letter-spacing:.08em;}' +
      '#paneel .wa-pas .qr{background:#fff;padding:4px;border-radius:0;line-height:0;flex-shrink:0;}' +
      '#paneel .wa-pas .qr canvas{width:62px;height:62px;display:block;}' +
      /* padding en min-height: 14px hoog was onder de 24 van WCAG 2.5.8 */
      '#paneel .wa-pas .waarom{margin-top:1rem;background:none;border:0;padding:5px 0;min-height:24px;cursor:pointer;' +
        'color:var(--rtg-goud);font-size:.72rem;font-weight:600;text-align:left;font-family:inherit;}' +
      '#paneel .wa-uitleg{display:none;font-size:.72rem;line-height:1.6;color:var(--rtg-soft);margin-top:.7rem;}' +
      '#paneel .wa-uitleg.open{display:block;}' +
      '#paneel .wa-uitleg b{color:var(--rtg-txt);font-weight:600;}' +
      '#paneel .wa-rij{display:flex;align-items:center;gap:.6rem;padding:.55rem 0;border-bottom:1px solid var(--rtg-line);}' +
      '#paneel .wa-rij:last-child{border-bottom:0;}' +
      '#paneel .wa-rij .tekst{flex:1;min-width:0;background:none;border:0;color:inherit;text-align:left;cursor:pointer;font:inherit;padding:0;}' +
      '#paneel .wa-rij .tekst b{display:block;font-weight:600;}' +
      '#paneel .wa-rij .sub{display:block;font-size:.78rem;color:var(--rtg-soft);}' +
      '#paneel .wa-invoer{display:flex;gap:.5rem;flex-wrap:wrap;margin:.7rem 0 1rem;}' +
      '#paneel .wa-invoer>*{flex:1;min-width:7rem;}' +
      '#paneel .wa-invoer .knop{flex:0 0 auto;}' +
      '#paneel .knop.wa-weg{color:var(--rtg-rood,#C23A5E);border-color:rgba(194,58,94,.4);}' +
      '#waScrim{position:fixed;inset:0;z-index:80;background:#F4F1EC;color:#0C0C0B;display:none;' +
        'flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem;}' +
      '#waScrim.aan{display:flex;}' +
      '#waScrim .t{font-size:1rem;color:#4D4A45;}' +
      '#waScrim .c{font-family:"Bodoni Moda",serif;font-size:clamp(2.4rem,10vw,4.5rem);letter-spacing:.12em;margin:1rem 0;}' +
      '#waScrim .knop{background:#0C0C0B;color:#F4F1EC;border-color:#0C0C0B;margin-top:1.4rem;}';
    d.head.appendChild(st);
  }

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
    if (!user) { $('#waPas').innerHTML = '<p class="stil">Geen pas te tonen.</p>'; return; }
    $('#waPas').innerHTML =
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
    } catch (e) { $('#waPas').innerHTML = '<p class="stil">Geen pas te tonen.</p>'; }
  }

  var Deel = w.RTGGeldDeel = w.RTGGeldDeel || {};
  Deel.wallet = { stijl: stijl, toon: toon, laadPas: laadPas };
})(window, document);

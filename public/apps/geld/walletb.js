/* Stand Wallet, deel 2 van 2: de registratie. Leunt op w.RTGGeldDeel.wallet
   uit wallet.js (ledenpas, codescherm, stijl); hier staan de lijsten en de
   handelingen. Dezelfde routes als /apps/wallet.html, letterlijk:
   /api/wallet (lijst), /api/wallet/voeg, /api/wallet/weg,
   /api/wallet/munt/koop, /api/wallet/munt/wissel, en /api/state via deel 1. */
(function (w, d) {
  'use strict';
  var V = w.RTGGeld = w.RTGGeld || { standen: [] };
  var $ = function (s) { return d.querySelector(s); };
  var items = [];

  /* Een item als rij: naam vet, de code eronder klein, de acties rechts.
     Alleen een munt heeft een wisselknop; weghalen is de enige actie met een
     waarschuwende kleur. */
  function rij(it) {
    var esc = w.Geld.esc;
    var sub = it.soort === 'munt' ? 'saldo ' + it.saldo
      : [it.code, it.geldigTot ? 'tot ' + it.geldigTot : ''].filter(Boolean).join(' · ');
    return '<div class="wa-rij">' +
      '<button class="tekst" type="button" data-toon="' + esc(it.id) + '">' +
        '<b>' + esc(it.titel) + '</b><span class="sub">' + esc(sub) + '</span></button>' +
      (it.soort === 'munt' ? '<button class="knop" type="button" data-wissel="' + esc(it.id) + '">Wissel 1 in</button>' : '') +
      '<button class="knop wa-weg" type="button" data-weg="' + esc(it.id) + '" aria-label="Verwijder ' + esc(it.titel) + '">Weg</button>' +
    '</div>';
  }

  function vul(sel, lijst) {
    $(sel).innerHTML = (lijst || []).length ? lijst.map(rij).join('') : '<p class="stil">Nog leeg.</p>';
  }

  async function laad() {
    var Geld = w.Geld;
    try {
      var r = await Geld.api('/api/wallet');
      items = r.items || [];
      var p = r.perSoort || {};
      vul('#waLijstPas', p.pas); vul('#waLijstTicket', p.ticket); vul('#waLijstSleutel', p.sleutel);
      vul('#waLijstMunt', p.munt); vul('#waLijstKaart', p.klantenkaart);
      /* muntPrijs komt in euro's van de server; Geld.euro rekent in centen,
         dus EEN keer maal honderd hier en nergens anders. */
      $('#waMuntPrijs').textContent = 'Munten kosten ' + Geld.euro(Math.round(r.muntPrijs * 100)) +
        ' per stuk (demo). Kopen verhoogt het saldo, inwisselen verlaagt het.';
    } catch (e) {
      $('#waFout').innerHTML = RTGLeeg.html(RTGLeeg.vanFout({ status: 401, message: Geld.esc(e.message) }));
      var leeg = ['#waLijstPas', '#waLijstTicket', '#waLijstSleutel', '#waLijstMunt', '#waLijstKaart'];
      for (var i = 0; i < leeg.length; i++) $(leeg[i]).innerHTML = '<p class="stil">Niet geladen.</p>';
    }
  }

  async function koop() {
    var Geld = w.Geld;
    try {
      var r = await Geld.api('/api/wallet/munt/koop', { zaak: $('#waMuntZaak').value, aantal: $('#waMuntAantal').value });
      Geld.melding('Gekocht voor ' + Geld.euro(Math.round(r.prijs * 100)) + '; saldo ' + r.item.saldo + '.');
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function voeg() {
    var Geld = w.Geld;
    try {
      await Geld.api('/api/wallet/voeg', { soort: $('#waVoegSoort').value, titel: $('#waVoegTitel').value, code: $('#waVoegCode').value });
      $('#waVoegTitel').value = ''; $('#waVoegCode').value = '';
      Geld.melding('Toegevoegd.');
      laad();
    } catch (e) { Geld.melding(e.message); }
  }

  async function weg(id) {
    /* Weghalen is onomkeerbaar in de wallet; daarom als enige actie een
       bevestiging vooraf. */
    if (!w.confirm('Uit de wallet halen?')) return;
    try { await w.Geld.api('/api/wallet/weg', { id: id }); laad(); }
    catch (e) { w.Geld.melding(e.message); }
  }

  async function wissel(id) {
    try {
      var r = await w.Geld.api('/api/wallet/munt/wissel', { id: id, aantal: 1 });
      w.Geld.melding('Munt ingewisseld; saldo ' + r.item.saldo + '.');
      laad();
    } catch (e) { w.Geld.melding(e.message); }
  }

  /* Een gedelegeerde klik op de omhulling in plaats van knop voor knop: de
     lijsten worden bij elke verversing opnieuw getekend, en de omhulling
     verdwijnt netjes mee als de stand wisselt (dus geen stapeling). */
  function klik(e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'waToonDicht') { $('#waScrim').classList.remove('aan'); return; }
    if (b.id === 'waMuntKoop') { koop(); return; }
    if (b.id === 'waVoegBtn') { voeg(); return; }
    if (b.dataset.toon) {
      for (var i = 0; i < items.length; i++) {
        if (items[i].id === b.dataset.toon) { w.RTGGeldDeel.wallet.toon(items[i]); break; }
      }
      return;
    }
    if (b.dataset.wissel) { wissel(b.dataset.wissel); return; }
    if (b.dataset.weg) weg(b.dataset.weg);
  }

  function start() {
    var Deel = w.RTGGeldDeel.wallet;
    Deel.stijl();
    $('#waWrap').addEventListener('click', klik);
    Deel.laadPas();
    laad();
  }

  V.standen.push({
    id: 'wallet',
    naam: 'Wallet',
    uitleg: 'Alles wat u bij zich draagt: ledenpas, tickets, sleutels, feestmunten en klantenkaarten. Tik op een kaart voor het grote codescherm.',
    html:
      '<div id="waWrap">' +
        '<div id="waFout"></div>' +
        '<h2>Uw ledenpas</h2>' +
        '<div id="waPas"><p class="stil">Laden...</p></div>' +
        '<h2>Passen</h2>' +
        '<p class="stil">Passen die systemen voor u klaarleggen, zoals de zorgpas.</p>' +
        '<div class="kaart" id="waLijstPas"><p class="stil">Laden...</p></div>' +
        '<h2>Tickets</h2>' +
        '<div class="kaart" id="waLijstTicket"><p class="stil">Laden...</p></div>' +
        '<h2>Sleutels</h2>' +
        '<div class="kaart" id="waLijstSleutel"><p class="stil">Laden...</p></div>' +
        '<h2>Feestmunten</h2>' +
        '<p class="stil" id="waMuntPrijs"></p>' +
        '<div class="kaart" id="waLijstMunt"><p class="stil">Laden...</p></div>' +
        '<div class="wa-invoer">' +
          '<input id="waMuntZaak" maxlength="60" placeholder="Zaak of feest" aria-label="Zaak">' +
          '<input id="waMuntAantal" type="number" min="1" max="100" value="10" aria-label="Aantal">' +
          '<button class="knop hoofd" id="waMuntKoop" type="button">Koop munten</button>' +
        '</div>' +
        '<h2>Klantenkaarten</h2>' +
        '<p class="stil">Zelf toevoegen: een klantenkaart, een ticket of een sleutel.</p>' +
        '<div class="kaart" id="waLijstKaart"><p class="stil">Laden...</p></div>' +
        '<div class="wa-invoer">' +
          '<select id="waVoegSoort" aria-label="Soort">' +
            '<option value="klantenkaart">Klantenkaart</option>' +
            '<option value="ticket">Ticket</option>' +
            '<option value="sleutel">Sleutel</option>' +
          '</select>' +
          '<input id="waVoegTitel" maxlength="80" placeholder="Naam (bijv. de winkel)" aria-label="Naam">' +
          '<input id="waVoegCode" maxlength="40" placeholder="Code" aria-label="Code">' +
          '<button class="knop hoofd" id="waVoegBtn" type="button">Voeg toe</button>' +
        '</div>' +
        '<div id="waScrim" role="dialog" aria-label="Codescherm">' +
          '<div class="t" id="waToonTitel"></div>' +
          '<div class="c" id="waToonCode"></div>' +
          '<div class="t" id="waToonSub"></div>' +
          '<button class="knop" id="waToonDicht" type="button">Sluit</button>' +
        '</div>' +
      '</div>',
    start: start
  });
})(window, document);

/* Tussen ja en nee aan tafel, op het scherm van de ZAAK
   (kern/ervaring/tafeluitzondering.js, CONCIERGE.md par. 2.7-2.9).

   Een tafelaanvraag kende in de leverancier-app twee knoppen: Bevestig en
   Weiger. De server kende al twee antwoorden ertussen -- een andere tijd die een
   termijn wordt vastgehouden, en doorzetten naar een manager -- maar geen scherm
   riep ze aan. De rij van een reservering (apps/leverancier/leverancier-59.js)
   vraagt hier zijn extra regel op, en de knoppen worden hier gebonden
   (leverancier-60.js). Losstaand naast de bundel, zoals leverancier-kamer.js.

   Wat dit scherm NIET beslist: of een medewerker nog mag beslissen na
   doorzetten (de server weigert met 403; de rij laat de knoppen dan weg), of de
   andere tijd past (de server rekent de capaciteit), en of een tegenvoorstel nog
   geldt (verval is berekend, CON-09). Er komt geen urgentielabel en geen
   VIP-teken bij: een nee blijft een nee (CON-04). */
(function () {
  'use strict';

  function tekst(r, h) {
    var T = h.T, esc = h.esc, t = '';
    if (r.doorgezet && r.status === 'aangevraagd') t += T('res.doorgezet', 'Doorgezet: een manager beslist.') + ' ' + esc(r.doorgezet.reden);
    if (r.status === 'tegenvoorstel' && r.tegenvoorstel) {
      var tot = Date.parse(r.tegenvoorstel.geldigTot);
      t += T('res.tvaan', 'Aangeboden in plaats van') + ' ' + esc(r.gevraagdeTijd) + '; ' + (tot > Date.now()
        ? T('res.tvtot', 'vastgehouden tot') + ' ' + new Date(tot).toTimeString().slice(0, 5) + '. ' + T('res.tvwacht', 'Wacht op de gast.')
        : T('res.tvweg', 'verlopen: de tafel wordt niet meer vastgehouden.'));
    }
    return t ? '<span class="softline res-uitz">' + t + '</span>' : '';
  }

  function bind(el, id, doe, T) {
    var tv = el.querySelector('.js-restv');
    if (tv) tv.addEventListener('click', function () {
      var tijd = window.prompt(T('res.tvp', 'Welke tijd kunt u wel bieden? (uu:mm)'));
      if (!tijd) return;
      var min = window.prompt(T('res.tvmin', 'Hoeveel minuten houdt u die tafel vast?'), '15');
      if (min === null) return;
      doe('/supplier/reservering/tegenvoorstel', { id: id, tijd: tijd.trim(), geldigMin: Number(min) || 15 },
        T('res.tvtoast', 'Aangeboden; de gast beslist binnen de termijn.'));
    });
    var dz = el.querySelector('.js-resdoor');
    if (dz) dz.addEventListener('click', function () {
      var reden = window.prompt(T('res.doorp', 'Waarom vraagt dit een beslissing van een manager?'));
      if (reden && reden.trim()) doe('/supplier/reservering/doorzetten', { id: id, reden: reden.trim() }, T('res.doortoast', 'Doorgezet; een manager beslist.'));
    });
  }

  window.RTGTafelUitz = { tekst: tekst, bind: bind };
})();

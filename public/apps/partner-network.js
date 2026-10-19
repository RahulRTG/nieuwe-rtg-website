/* PARTNER NETWORK -- de netwerkkant van een partnerzaak.

   Tot 19 oktober 2026 toonde dit scherm vaste cijfers als live waarheid ("97
   network fit", "96% mutual fit", "marge 18,4%", een tijdlijn van 12:31 tot
   12:41) zonder enige bron. Besluit van de eigenaar: echt bouwen, en een getal
   staat er alleen als de server het uit echte gegevens rekent. Alles hieronder
   komt van /api/supplier/netwerk/overzicht (kern/partnernetwerk.js), met de
   bron bij elk getal; "niet gemeten" is geen nul. Reageren op een vraag gaat
   langs de bestaande route van de Mall. test/partnernetwerk-scherm.test.js
   zakt als een van de oude vaste getallen terugkomt. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  var HUIDIG = null;

  function api(pad, lijf) {
    return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (TOKEN || '') },
      body: JSON.stringify(lijf || {}) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) { var f = new Error(d.error || 'Er ging iets mis.'); f.status = r.status; throw f; }
        return d;
      });
    });
  }
  function meld(t) { var m = $('#pnMelding'); m.textContent = t; m.hidden = !t; }
  function maak(tag, klasse, tekst) { var e = document.createElement(tag); if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; }

  function tekenGetallen(getallen) {
    Object.keys(getallen).forEach(function (k) {
      var g = getallen[k], plek = document.querySelector('[data-getal="' + k + '"]'), bron = document.querySelector('[data-bron="' + k + '"]');
      if (!plek) return;
      if (g && g.waarde != null) { plek.textContent = String(g.waarde); if (bron) bron.textContent = 'Bron: ' + g.bron; }
      else { plek.textContent = 'niet gemeten'; if (bron) bron.textContent = (g && g.nietGemeten) || 'Geen bron.'; }
    });
  }

  function tekenAandacht(lijst) {
    var vragen = $('#pnIntenties'), rest = $('#pnAandacht');
    vragen.textContent = ''; rest.textContent = '';
    var intenties = lijst.filter(function (x) { return x.soort === 'intentie'; });
    var anders = lijst.filter(function (x) { return x.soort !== 'intentie'; });
    if (!intenties.length) vragen.appendChild(maak('p', 'pn-uitleg', 'Er wacht op dit moment geen vraag op uw reactie.'));
    intenties.forEach(function (x) {
      var s = maak('section', 'pn-intent');
      s.appendChild(maak('h2', null, x.titel));
      var d = maak('div');
      if (x.plek) d.appendChild(maak('span', null, x.plek));
      if (x.wanneer) d.appendChild(maak('span', null, x.wanneer));
      s.appendChild(d);
      var b = maak('button', null, 'Reageer');
      b.type = 'button';
      b.addEventListener('click', function () { openReageer(x); });
      var f = maak('footer'); f.appendChild(b); s.appendChild(f);
      vragen.appendChild(s);
    });
    if (!anders.length) rest.appendChild(maak('p', 'pn-uitleg', 'Niets dat vandaag om aandacht vraagt.'));
    anders.forEach(function (x) {
      var e = maak('div', 'pn-event');
      e.appendChild(maak('em', null, x.soort === 'klus' ? 'KLUS' : 'ONDERDEEL'));
      var p = maak('p'); p.appendChild(maak('b', null, x.titel)); p.appendChild(maak('small', null, 'Bron: ' + x.bron));
      e.appendChild(p);
      rest.appendChild(e);
    });
  }

  function tekenNietGebouwd(lijst) {
    var ul = $('#pnNietGebouwd'); ul.textContent = '';
    lijst.forEach(function (x) { var li = maak('li'); li.appendChild(maak('b', null, x.wat)); li.appendChild(maak('small', null, ' ' + x.reden)); ul.appendChild(li); });
  }

  function laad() {
    if (!TOKEN) {
      meld('Open Partner Network vanuit uw werkplek in de RTG-app; daar kiest u uw zaak.');
      $('#pnStand').textContent = 'Niet ingelogd';
      var a = maak('a', null, 'Naar de RTG-app'); a.href = '/apps/app.html'; $('#pnMelding').appendChild(document.createTextNode(' ')); $('#pnMelding').appendChild(a);
      return;
    }
    api('/api/supplier/netwerk/overzicht').then(function (d) {
      if (!(d && d.getallen && Array.isArray(d.aandacht) && Array.isArray(d.nietGebouwd))) throw new Error('Het antwoord was onvolledig, dus dit kon niet worden geladen.');
      $('#pnZaak').textContent = d.zaak.naam;
      $('#pnStand').textContent = 'Elk getal met zijn bron';
      tekenGetallen(d.getallen); tekenAandacht(d.aandacht); tekenNietGebouwd(d.nietGebouwd);
      meld('');
    }).catch(function (e) {
      if (e.status === 401) { try { localStorage.removeItem('rtg_sup_token'); } catch (x) {} location.href = '/apps/app.html'; return; }
      meld(e.message);
    });
  }

  /* Reageren gaat langs de route van de Mall (kern/mall/aanvragen.js): een zaak
     heeft per vraag een reactie, en wie zich bedenkt wijzigt die. */
  function openReageer(x) { HUIDIG = x; $('#pnReageerWat').textContent = x.titel; $('#pnReageerForm').reset(); $('#pnReageer').showModal(); }
  $('#pnReageerForm').addEventListener('submit', function (ev) {
    if (ev.submitter && ev.submitter.value === 'cancel') return;
    ev.preventDefault();
    var fd = new FormData(ev.target), knop = $('#pnReageerVerstuur');
    knop.disabled = true;
    api('/api/supplier/mall/aanvraag/reageer', { id: HUIDIG.id, versie: HUIDIG.versie, tekst: String(fd.get('tekst') || ''), prijs: Number(fd.get('prijs')) || undefined })
      .then(function () { $('#pnReageer').close(); meld('Uw reactie staat bij het lid.'); laad(); })
      .catch(function (e) { meld(e.message); })
      .then(function () { knop.disabled = false; });
  });

  /* De rail springt naar de kolom; focus gaat mee voor de schermlezer. */
  var ZONES = { intenties: '#kolomIntenties', beloften: '#kolomBeloften', aandacht: '#kolomAandacht' };
  document.querySelectorAll('[data-zone]').forEach(function (knop) {
    knop.addEventListener('click', function () {
      var doel = document.querySelector(ZONES[knop.dataset.zone]); if (!doel) return;
      document.querySelectorAll('[data-zone]').forEach(function (x) { x.classList.toggle('actief', x === knop); x.setAttribute('aria-current', x === knop ? 'true' : 'false'); });
      doel.setAttribute('tabindex', '-1'); doel.scrollIntoView({ behavior: 'smooth', block: 'start' }); doel.focus({ preventScroll: true });
    });
  });
  document.querySelectorAll('[data-link]').forEach(function (b) { b.addEventListener('click', function () { location.href = b.dataset.link; }); });
  laad();
})();

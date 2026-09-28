/* Mijn leerhuis: het ledenscherm van RTG Academy (ACADEMY.md, fase B-UI).

   HIJ REKENT NIETS UIT. Welke stap aan de beurt is, of een vaardigheid nog vers
   is en of een certificaat geldt, komt van de server (kern/leerhuis/zicht.js).
   Een scherm dat zelf gaat rekenen, zegt na de eerste kennisverandering iets
   anders dan het leerhuis, en dan gelooft een lid het scherm.

   HIJ LEEST ALLEEN. Leren, bewijs en beoordeling lopen via de trainer en de
   assessor; een knop hier die zegt "ik kan dit" zou precies de eigen verklaring
   zijn die het leerhuis niet als bewijs telt.

   HIJ TOONT GEEN CIJFER OP EEN MENS. Wat bewezen is, door wie en of het vers
   is -- en niets dat optelt tot een score.

   De code van de organisatie komt uit het adres (?org=) of uit wat het lid
   de vorige keer koos. Er is met opzet geen lijst van organisaties: welke
   leerhuizen er zijn, is niet iets wat een lid van een ander hoort te zien. */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var BEWAAR = 'rtg_leerhuis_org';
  var STAND = {
    ASSIGNED: 'toegewezen', LEARNING: 'aan het leren', PRACTICING: 'aan het oefenen', SIMULATING: 'in simulatie',
    SUPERVISED: 'onder begeleiding', READY_FOR_ASSESSMENT: 'klaar voor beoordeling', ASSESSING: 'wordt beoordeeld',
    PROVEN: 'bewezen', NOT_YET_PROVEN: 'nog niet bewezen', CERTIFIED: 'gecertificeerd',
    AUTHORITY_ELIGIBLE: 'komt in aanmerking', PRACTICING_IN_ROLE: 'in de rol',
    CURRENT: 'vers', AGING: 'wordt oud', STALE: 'verouderd',
    ACTIVE: 'geldig', EXPIRED: 'verlopen', REFRESH_REQUIRED: 'verversen nodig', SUSPENDED: 'opgeschort', REVOKED: 'ingetrokken'
  };
  var stand = function (s) { return STAND[s] || String(s || '').toLowerCase(); };

  function maak(tag, klas, tekst) {
    var e = document.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function zet(id, kaarten, leegTekst) {
    var doos = $(id);
    leeg(doos);
    if (!kaarten.length) { doos.appendChild(maak('p', 'leeg', leegTekst)); return; }
    kaarten.forEach(function (k) { doos.appendChild(k); });
  }
  function kaart(titel, standCode, regels) {
    var k = maak('div', 'kaart');
    var h = maak('h3', null, titel);
    if (standCode) h.appendChild(maak('span', 'stand', stand(standCode)));
    k.appendChild(h);
    (regels || []).forEach(function (r) { if (r) k.appendChild(maak('p', 'meta', r)); });
    return k;
  }
  function meld(tekst) { $('melding').textContent = String(tekst); }

  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}

  function lees(org, vraag) {
    return fetch('/api/leerhuis/lees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (TOKEN || '') },
      body: JSON.stringify({ org: org, vraag: vraag })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || (r.status === 401 ? 'U bent niet ingelogd.' : 'Het leerhuis antwoordde niet.'));
        return d.antwoord;
      });
    });
  }

  function toon(m) {
    zet('vandaag', (m.VANDAAG || []).map(function (x) {
      return kaart(x.titel || x.wat, x.stand, [x.waarom, x.volgende ? 'Volgende stap: ' + x.volgende : null]);
    }), 'Er staat vandaag niets voor u klaar.');
    zet('pad', (m.PAD || []).map(function (x) {
      return kaart(x.titel || x.curriculum, x.stand, [x.volgende ? 'Volgende stap: ' + x.volgende : null,
        x.trainer ? 'Uw trainer: ' + x.trainer : 'Nog geen trainer toegewezen.']);
    }), 'U volgt hier nog geen curriculum.');
    zet('oefenen', (m.OEFENEN || []).map(function (x) {
      return kaart(x.scenario, null, [x.domein ? 'Onderwerp: ' + x.domein : null, x.wat]);
    }), 'Er zijn nu geen oefeningen die bij uw leerpaden horen.');
    var v = m.VAARDIGHEDEN || {};
    var kan = (v.vaardigheden || []).map(function (x) {
      return kaart(x.naam || x.vaardigheid, x.versheid, [x.niveau ? 'Niveau: ' + x.niveau.toLowerCase() : null,
        x.sinds ? 'Vastgesteld op ' + String(x.sinds).slice(0, 10) : null]);
    }).concat((v.certificaten || []).map(function (c) {
      return kaart('Certificaat ' + c.id, c.stand, [(c.vaardigheden || []).join(', '),
        c.geldigTot ? 'Geldig tot ' + String(c.geldigTot).slice(0, 10) : null, c.reden || null]);
    }));
    zet('kan', kan, 'Er is nog niets op uw naam vastgesteld.');
  }

  function laad(org) {
    if (!org) return;
    try { localStorage.setItem(BEWAAR, org); } catch (e) {}
    meld('Leerhuis ' + org + ' wordt geladen.');
    lees(org, 'mijn').then(function (m) {
      toon(m || {});
      meld('Leerhuis ' + org + '.');
    }).catch(function (e) {
      ['vandaag', 'pad', 'oefenen', 'kan'].forEach(function (id) { zet(id, [], 'Niet te tonen: ' + e.message); });
      meld(e.message);
    });
  }

  function begin() {
    var org = '';
    try { org = new URLSearchParams(location.search).get('org') || localStorage.getItem(BEWAAR) || ''; } catch (e) {}
    $('org').value = org;
    $('kies').addEventListener('submit', function (ev) {
      ev.preventDefault();
      laad(String($('org').value || '').trim());
    });
    if (!TOKEN) { meld('Log eerst in met uw RTG-account; het leerhuis hoort bij uw eigen account.'); return; }
    laad(org);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();

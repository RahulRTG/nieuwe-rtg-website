/* Leerhuis: aan het werk. Het werkscherm van trainer, assessor en
   kenniseigenaar in RTG Academy (ACADEMY.md, fase B-UI).

   HIJ BESLIST NIETS. Of een knop iets mag, zegt de handeling op de server
   (kern/leerhuis/acties-*.js); dit scherm toont wat er klaarligt en geeft de
   weigering van de server in woorden door. Een knop die hier ontbreekt, is
   geen verbod: het werk ligt dan niet bij deze lezer.

   ELKE HANDELING DRAAGT EEN SLEUTEL, en die blijft staan tot de server hem
   heeft aangenomen. Een tweede klik op dezelfde kaart is zo dezelfde handeling
   en geen tweede. Antwoordt de server "onbekend" (503 bij een duurzame
   handeling), dan vraagt het scherm eerst de uitkomst na en probeert het pas
   daarna opnieuw met dezelfde sleutel.

   GEEN CIJFER OP EEN MENS, en mensen op codenaam (kern/leerhuis/namen.js). */
'use strict';
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var BEWAAR = 'rtg_leerhuis_org';
  var STAND = { SIMULATING: 'in simulatie', SUPERVISED: 'onder toezicht', READY_FOR_ASSESSMENT: 'klaar voor beoordeling',
    ASSESSING: 'wordt beoordeeld', REQUESTED: 'wacht op een assessor', DRAFT: 'concept', REVIEW: 'ter review',
    NOT_YET_PROVEN: 'nog niet bewezen', PROVEN: 'bewezen', ASSIGNED: 'toegewezen', LEARNING: 'aan het leren', PRACTICING: 'aan het oefenen' };
  var stand = function (s) { return STAND[s] || String(s || '').toLowerCase(); };
  var TOKEN = null;
  try { TOKEN = localStorage.getItem('rtg_member_token'); } catch (e) {}
  var ORG = '';
  var sleutels = {};

  function maak(tag, klas, tekst) {
    var e = document.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function meld(t) { $('melding').textContent = String(t); }
  /* Een sleutel per kaart en handeling, uit shared/id.js: blijft staan tot hij is aangenomen. */
  function sleutelVoor(naam) { return sleutels[naam] || (sleutels[naam] = window.RTGId('leerhuiswerk')); }

  function post(pad, lijf) {
    return fetch(pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (TOKEN || '') },
      body: JSON.stringify(lijf) }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { status: r.status, d: d }; });
    });
  }
  function lees(vraag, extra) {
    return post('/api/leerhuis/lees', Object.assign({ org: ORG, vraag: vraag }, extra || {})).then(function (x) {
      if (x.status >= 400) throw new Error(x.d.error || 'Het leerhuis antwoordde niet.');
      return x.d.antwoord;
    });
  }

  function doe(naam, actie, invoer, gelukt) {
    var sleutel;
    try { sleutel = sleutelVoor(naam); } catch (e) { meld(e.message); return Promise.resolve(); }
    meld('Bezig: ' + gelukt.toLowerCase());
    return post('/api/leerhuis/doe', { org: ORG, actie: actie, invoer: invoer, sleutel: sleutel }).then(function (x) {
      if (x.status === 503) {
        /* Onbekend: eerst navragen, niet blind opnieuw. */
        return lees('uitkomst', { sleutel: sleutel }).then(function (u) {
          if (u && u.bekend) { delete sleutels[naam]; return laad().then(function () { meld(gelukt + ' Dat was al vastgelegd.'); }); }
          meld('Het is niet zeker of dit is vastgelegd. Druk nog eens; het gaat met dezelfde sleutel, dus het gebeurt hooguit een keer.');
        });
      }
      if (x.status >= 400) { meld('Niet gelukt: ' + (x.d.error || 'onbekende fout') + (x.d.hoe ? ' (' + x.d.hoe + ')' : '')); return; }
      delete sleutels[naam];
      /* Eerst het werk opnieuw tonen, dan melden: wie het bericht hoort, vindt de kaarten al bijgewerkt. */
      return laad().then(function () { meld(gelukt); });
    }).catch(function () { meld('Het leerhuis antwoordde niet. Uw invoer staat er nog; druk nog eens.'); });
  }

  function knop(tekst, stil, fn) {
    var b = maak('button', 'knop' + (stil ? ' stil' : ''), tekst);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  }
  function kaart(titel, standCode, regels) {
    var k = maak('div', 'kaart');
    var h = maak('h3', null, titel);
    if (standCode) h.appendChild(maak('span', 'stand', stand(standCode)));
    k.appendChild(h);
    (regels || []).forEach(function (r) { if (r) k.appendChild(maak('p', 'meta', r)); });
    return k;
  }
  function zet(id, kaarten, leegTekst) {
    var doos = $(id);
    leeg(doos);
    if (!kaarten.length) { doos.appendChild(maak('p', 'leeg', leegTekst)); return; }
    kaarten.forEach(function (k) { doos.appendChild(k); });
  }
  var wie = function (x) { return x.naam || 'een lid zonder codenaam'; };
  var dag = function (t) { return t ? String(t).slice(0, 10) : ''; };

  /* De kaarten per rol staan in leerhuis-werk-kaarten.js; dit bestand is de deur. */
  var bewijs = window.RTGLeerhuisBewijs ? window.RTGLeerhuisBewijs({ maak: maak, knop: knop, doe: doe }) : null;
  var K = window.RTGLeerhuisKaarten({ $: $, maak: maak, knop: knop, kaart: kaart, zet: zet, doe: doe, wie: wie, dag: dag, bewijs: bewijs });

  function laad() {
    if (!ORG) return Promise.resolve();
    try { localStorage.setItem(BEWAAR, ORG); } catch (e) {}
    return Promise.all([lees('trainerCockpit'), lees('assessorWerk'), lees('kennisWerk')]).then(function (r) {
      var t = r[0], a = r[1], w = r[2];
      $('trainerBlok').hidden = !(t && t.ok); if (t && t.ok) K.trainer(t);
      $('assessorBlok').hidden = !(a && a.ok); if (a && a.ok) K.assessor(a);
      $('kennisBlok').hidden = !(w && w.ok); if (w && w.ok) K.kennis(w);
      $('geenRol').hidden = !!((t && t.ok) || (a && a.ok) || (w && w.ok));
      if (/^Bezig|^Leerhuis .* wordt geladen/.test($('melding').textContent)) meld('Leerhuis ' + ORG + '.');
    }).catch(function (e) {
      ['trainerBlok', 'assessorBlok', 'kennisBlok', 'geenRol'].forEach(function (id) { $(id).hidden = true; });
      meld(e.message);
    });
  }

  function begin() {
    try { ORG = new URLSearchParams(location.search).get('org') || localStorage.getItem(BEWAAR) || ''; } catch (e) {}
    $('org').value = ORG;
    $('kies').addEventListener('submit', function (ev) {
      ev.preventDefault();
      ORG = String($('org').value || '').trim();
      sleutels = {};
      meld('Leerhuis ' + ORG + ' wordt geladen.');
      laad();
    });
    if (!TOKEN) { meld('Log eerst in met uw RTG-account; het werk in het leerhuis hoort bij uw eigen account.'); return; }
    if (ORG) { meld('Leerhuis ' + ORG + ' wordt geladen.'); laad(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();

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
    NOT_YET_PROVEN: 'nog niet bewezen', PROVEN: 'bewezen', ACTIVE: 'actief', PILOT: 'pilot', MONITORED: 'gevolgd',
    IMPROVEMENT: 'in verbetering', SUPERSEDED: 'vervangen', RETIRED: 'uit gebruik', SUSPENDED: 'geschorst', REVOKED: 'ingetrokken',
    EXPIRING: 'verloopt binnenkort', EXPIRED: 'verlopen', REVIEW_REQUEST: 'bezwaar ingediend', INDEPENDENT_REVIEW: 'in review',
    INCONCLUSIVE: 'onbeslist', INVALIDATED: 'ongeldig', ASSIGNED: 'toegewezen', LEARNING: 'aan het leren', PRACTICING: 'aan het oefenen' };
  var stand = function (s) { return STAND[s] || String(s || '').toLowerCase(); };
  var ORG = '';

  function maak(tag, klas, tekst) {
    var e = document.createElement(tag);
    if (klas) e.className = klas;
    if (tekst != null) e.textContent = String(tekst);
    return e;
  }
  function leeg(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function meld(t) { $('melding').textContent = String(t); }
  /* De deur (sleutel, navragen bij onbekend, eerst laden dan melden) staat in
     leerhuis-deur.js, gedeeld met Mijn leerhuis. */
  var D = window.RTGLeerhuisDeur({ meld: meld, laad: function () { return laad(); }, org: function () { return ORG; }, voorvoegsel: 'leerhuiswerk' });
  var lees = D.lees, doe = D.doe;

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
  var S = window.RTGLeerhuisSchrijven ? window.RTGLeerhuisSchrijven({ $: $, maak: maak, knop: knop, doe: doe }) : null;
  var Q = window.RTGLeerhuisKwaliteit({ maak: maak, knop: knop, kaart: kaart, zet: zet, doe: doe, wie: wie, dag: dag });
  var A = window.RTGLeerhuisAutoriteit({ maak: maak, knop: knop, kaart: kaart, zet: zet, doe: doe, wie: wie, dag: dag });
  var I = window.RTGLeerhuisInrichten({ $: $, maak: maak, knop: knop, kaart: kaart, zet: zet, doe: doe, wie: wie });
  var K = window.RTGLeerhuisKaarten({ $: $, maak: maak, knop: knop, kaart: kaart, zet: zet, doe: doe, wie: wie, dag: dag, bewijs: bewijs });

  function laad() {
    if (!ORG) return Promise.resolve();
    try { localStorage.setItem(BEWAAR, ORG); } catch (e) {}
    return Promise.all([lees('trainerCockpit'), lees('assessorWerk'), lees('kennisWerk'), lees('managerCockpit'), lees('curriculumWerk'), lees('eigenaarWerk'),
      lees('certificaatWerk'), lees('trainerWerk'), lees('kwaliteitWerk')]).then(function (r) {
      var t = r[0], a = r[1], w = r[2], m = r[3], c = r[4], e = r[5], ca = r[6], ta = r[7], kw = r[8];
      /* De managercockpit kent geen `ok`: wie geen team heeft, heeft hier niets in te richten. */
      var team = !!(m && m.TEAM && m.TEAM.length);
      $('trainerBlok').hidden = !(t && t.ok); if (t && t.ok) K.trainer(t);
      $('assessorBlok').hidden = !(a && a.ok); if (a && a.ok) K.assessor(a);
      $('kennisBlok').hidden = !(w && w.ok); if (w && w.ok) K.kennis(w);
      $('managerBlok').hidden = !team; if (team) I.manager(m);
      $('curriculumBlok').hidden = !(c && c.ok); if (c && c.ok) { I.curriculum(c); if (S) S(c); }
      $('eigenaarBlok').hidden = !(e && e.ok); if (e && e.ok) I.eigenaar(e);
      $('certificaatBlok').hidden = !(ca && ca.ok); if (ca && ca.ok) A.certificaat(ca);
      $('trainerautoriteitBlok').hidden = !(ta && ta.ok); if (ta && ta.ok) A.trainer(ta);
      $('kwaliteitBlok').hidden = !(kw && kw.ok); if (kw && kw.ok) Q(kw);
      $('geenRol').hidden = !!((t && t.ok) || (a && a.ok) || (w && w.ok) || team || (c && c.ok) || (e && e.ok) || (ca && ca.ok) || (ta && ta.ok) || (kw && kw.ok));
      if (/^Bezig|^Leerhuis .* wordt geladen/.test($('melding').textContent)) meld('Leerhuis ' + ORG + '.');
    }).catch(function (e) {
      ['trainerBlok', 'assessorBlok', 'kennisBlok', 'managerBlok', 'curriculumBlok', 'eigenaarBlok', 'certificaatBlok', 'trainerautoriteitBlok', 'kwaliteitBlok', 'geenRol'].forEach(function (id) { $(id).hidden = true; });
      meld(e.message);
    });
  }

  function begin() {
    try { ORG = new URLSearchParams(location.search).get('org') || localStorage.getItem(BEWAAR) || ''; } catch (e) {}
    $('org').value = ORG;
    $('kies').addEventListener('submit', function (ev) {
      ev.preventDefault();
      ORG = String($('org').value || '').trim();
      D.vergeet();
      meld('Leerhuis ' + ORG + ' wordt geladen.');
      laad();
    });
    if (!D.token) { meld('Log eerst in met uw RTG-account; het werk in het leerhuis hoort bij uw eigen account.'); return; }
    if (ORG) { meld('Leerhuis ' + ORG + ' wordt geladen.'); laad(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
})();

/* Mijn leerhuis: het ledenscherm van RTG Academy (ACADEMY.md, fase B-UI).

   HIJ REKENT NIETS UIT. Welke stap aan de beurt is, of een vaardigheid nog vers
   is en of een certificaat geldt, komt van de server (kern/leerhuis/zicht.js).
   Een scherm dat zelf gaat rekenen, zegt na de eerste kennisverandering iets
   anders dan het leerhuis, en dan gelooft een lid het scherm.

   HIJ ZET ALLEEN DE EIGEN STAPPEN (leerhuis-mijn.js): beginnen, oefenen, een
   scenario spelen, een beoordeling aanvragen. Bewijs en oordeel lopen via de
   trainer en de assessor; een knop hier die zegt "ik kan dit" zou precies de
   eigen verklaring zijn die het leerhuis niet als bewijs telt.

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
    AUTHORITY_ELIGIBLE: 'komt in aanmerking', PRACTICING_IN_ROLE: 'in de rol', INCONCLUSIVE: 'onbeslist',
    REVIEW_REQUEST: 'ingediend', INDEPENDENT_REVIEW: 'in review', UPHELD: 'oordeel blijft staan', CHANGED: 'oordeel aangepast', REASSESSMENT: 'opnieuw beoordelen',
    EVIDENCE: 'bij de assessor', REVIEW: 'in beoordeling', ACCEPTED: 'erkend', PARTIAL: 'deels erkend', REJECTED: 'niet erkend',
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
  var ORG = '', IK = '';
  function knop(tekst, stil, fn) {
    var b = maak('button', 'knop' + (stil ? ' stil' : ''), tekst);
    b.type = 'button'; b.addEventListener('click', fn); return b;
  }
  /* De deur (sleutel, navragen, eerst laden dan melden) is gedeeld met het werkscherm. */
  var D = window.RTGLeerhuisDeur({ meld: meld, laad: function () { return laad(ORG); }, org: function () { return ORG; }, voorvoegsel: 'leerhuismijn' });
  var M = window.RTGLeerhuisMijn({ maak: maak, knop: knop, doe: D.doe, stand: stand, ik: function () { return IK; } });

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
    IK = m.IK || '';
    zet('pad', (m.PAD || []).map(function (x) {
      var k = kaart(x.titel || x.curriculum, x.stand, [x.volgende ? 'Volgende stap: ' + x.volgende : null,
        x.trainer ? 'U heeft een trainer voor dit leerpad.' : 'Nog geen trainer toegewezen.']);
      M.pad(k, x);
      return k;
    }), 'U volgt hier nog geen curriculum.');
    zet('oefenen', (m.OEFENEN || []).map(function (x) {
      var k = kaart(x.scenario, null, [x.domein ? 'Onderwerp: ' + x.domein : null, x.wat]);
      M.oefenen(k, x);
      return k;
    }), 'Er zijn nu geen oefeningen die bij uw leerpaden horen.');
    zet('uitslagen', (m.UITSLAGEN || []).map(function (x) {
      var k = kaart(x.vaardigheidNaam, x.stand, ['Beoordeeld op ' + String(x.sinds || '').slice(0, 10) + '.']);
      M.uitslag(k, x); return k;
    }), 'Er is nog geen beoordeling over u afgerond.');
    zet('evc', (m.EVC || []).map(function (x) { return kaart('EVC: ' + x.vaardigheidNaam, x.stand, [x.extern]); })
      .concat((m.EVC_KEUZE || []).length ? [M.evc(m.EVC_KEUZE)] : []), 'EVC vraagt een lopende relatie met deze organisatie.');
    zet('werk', (m.WERK || []).map(function (x) {
      var k = kaart(x.handeling, x.geschikt ? 'geschikt' : 'nog niet geschikt',
        [x.vastgelegd ? x.vastgelegd + ' keer vastgelegd, laatst op ' + String(x.laatste || '').slice(0, 10) + '.' : 'Nog geen werk vastgelegd.']);
      M.werk(k, x); return k;
    }), 'Er is hier nog geen goedgekeurd beleid voor werk.');
    /* Een eigen tabel: REJECTED is bij een EVC 'niet erkend', bij een voorstel 'afgewezen'. */
    var VS = { SUBMITTED: 'ingediend', TRIAGED: 'opgepakt', REVIEW: 'in review', EXPERIMENT: 'wordt geprobeerd', APPROVED: 'goedgekeurd',
      REJECTED: 'afgewezen', IMPLEMENTED: 'uitgevoerd', MEASURED: 'gemeten' };
    zet('voorstellen', (m.VOORSTELLEN || []).map(function (x) {
      return kaart('Voorstel: ' + (x.kennisTitel || 'algemeen'), VS[x.stand] || x.stand, [x.probleem, x.notitie ? 'Toelichting: ' + x.notitie : null]);
    }).concat(m.VOORSTEL_KEUZE ? [M.voorstel(m.VOORSTEL_KEUZE)] : []), 'Een voorstel vraagt een lopende relatie met deze organisatie.');
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

  /* De twee cockpits verschijnen alleen voor wie ze betreffen: een lid dat geen
     trainer is en geen team heeft, ziet geen leeg vak met "u bent geen trainer". */
  var wie = function (x) { return x.naam || 'een lid zonder codenaam'; };
  function cockpits(org) {
    lees(org, 'trainerCockpit').then(function (t) {
      var aan = !!(t && t.ok);
      $('trainerBlok').hidden = !aan;
      if (!aan) return;
      zet('trainer', (t.LEERLINGEN || []).map(function (x) {
        return kaart(wie(x), x.stand, ['Leerpad ' + x.curriculum, x.volgende ? 'Volgende stap: ' + x.volgende : null]);
      }), 'Er volgt nog niemand een leerpad bij u.');
      $('trainerNiet').textContent = t.nietZichtbaar ? 'Niet zichtbaar: ' + t.nietZichtbaar + '.' : '';
    }).catch(function () { $('trainerBlok').hidden = true; });
    lees(org, 'managerCockpit').then(function (m) {
      var team = (m && m.TEAM) || [];
      $('teamBlok').hidden = !team.length;
      if (!team.length) return;
      zet('team', team.map(function (x) {
        var regels = (x.gereed || []).map(function (g) {
          return 'Rol ' + g.rol + ': ' + (g.klaar ? 'gereed' : 'nog niet gereed' + (g.ontbreekt && g.ontbreekt.length ? ', ontbreekt ' + g.ontbreekt.join(', ') : '')) + (g.verloopt && g.verloopt.length ? '; let op: ' + g.verloopt.join(', ') : '');
        });
        return kaart(wie(x), null, regels.length ? regels : ['Nog geen rol toegewezen.']);
      }), '');
      $('teamNiet').textContent = m.nietZichtbaar ? 'Niet zichtbaar: ' + m.nietZichtbaar + '.' : '';
    }).catch(function () { $('teamBlok').hidden = true; });
  }

  function laad(org) {
    if (!org) return Promise.resolve();
    ORG = org;
    try { localStorage.setItem(BEWAAR, org); } catch (e) {}
    if (!/^Bezig/.test($('melding').textContent)) meld('Leerhuis ' + org + ' wordt geladen.');
    return lees(org, 'mijn').then(function (m) {
      toon(m || {});
      meld('Leerhuis ' + org + '.');
      cockpits(org);
    }).catch(function (e) {
      ['vandaag', 'pad', 'oefenen', 'uitslagen', 'evc', 'werk', 'voorstellen', 'kan'].forEach(function (id) { zet(id, [], 'Niet te tonen: ' + e.message); });
      $('trainerBlok').hidden = true; $('teamBlok').hidden = true;
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

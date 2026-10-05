/* MIJN GEZIN VIA HET RTG-ACCOUNT (server: foundation/gezinseigenaar.js).

   De derde ingang op het welkomscherm, naast "maak een gezin" en "inloggen met
   code en pincode". Hier is het RTG-account van de ouder de sleutel: wie is
   ingelogd als lid, opent zijn gezin zonder code of pincode, maakt het aan als
   er nog geen is, en voegt een kind toe of opent de sessie van een kind op dit
   toestel. Die laatste twee gaan pas open als RTG het paspoort van de ouder
   heeft gecontroleerd; tot dan zegt het scherm dat, met de weg erheen.

   Wie niet als lid is ingelogd, gaat naar de RTG-inlog en komt daarna terug:
   een gratis account is genoeg. */
(function () {
  'use strict';
  var $ = function (s) { return document.querySelector(s); };
  function lidToken() { try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; } }

  function vraag(pad, body) {
    return fetch('/api/rtf/eigen-gezin' + pad, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + lidToken() },
      body: JSON.stringify(body || {}) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (d) {
          if (!r.ok) { var e = new Error(d.error || 'Er ging iets mis.'); e.status = r.status; e.hoe = d.hoe; throw e; }
          return d;
        });
      });
  }
  function fout(t) { $('#aFout').textContent = t || ''; }
  /* Geen terugsprong-parameter: een adres dat na de inlog ergens heen stuurt
     is een open omleiding. Wie terugkomt, komt via de FoundationOS-wereld in
     de RTG-app of via #mijn-gezin hier, en dan opent dit venster vanzelf. */
  function naarInlog() {
    var dlg = $('#dlgAccount');
    try { if (!dlg.open) dlg.showModal(); } catch (e) {}
    ['#aMaak', '#aProfielen', '#aKind', '#aDoe'].forEach(function (s) { $(s).hidden = true; });
    $('#aTitel').textContent = 'Eerst inloggen';
    $('#aSub').textContent = '';
    var t = document.createElement('span');
    t.textContent = 'Log in of maak een gratis account in de RTG-app. Een gratis account is genoeg. ';
    var a = document.createElement('a');
    a.href = '/apps/app.html?pas=rtg'; a.textContent = 'Naar de RTG-app';
    $('#aSub').appendChild(t); $('#aSub').appendChild(a);
  }

  function openSessie(profielId) {
    fout('');
    return vraag('/sessie', profielId ? { profielId: profielId } : {}).then(function (d) {
      window.Sessie.zet({ code: d.code, token: d.token, gezin: d.gezin, profiel: d.profiel });
      location.hash = ''; location.reload();
    }).catch(function (e) { fout(e.message); });
  }

  function toonGezin(d) {
    $('#aMaak').hidden = true; $('#aDoe').hidden = true;
    $('#aTitel').textContent = d.gezin.naam;
    $('#aSub').textContent = 'Kies wie dit toestel gebruikt.';
    var lijst = $('#aProfielen'); lijst.textContent = ''; lijst.hidden = false;
    (d.profielen || []).filter(function (p) { return !p.gast; }).forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'knop grijs';
      var dicht = p.beschermd && !d.paspoortGecontroleerd;
      b.textContent = (p.id === d.beheerder ? 'Ik (' + p.naam + ')' : p.naam) + (dicht ? ' (na paspoortcontrole)' : '');
      b.disabled = dicht;
      if (dicht) b.title = 'Kinderfuncties gaan open zodra RTG uw paspoort heeft gecontroleerd.';
      b.addEventListener('click', function () { openSessie(p.id === d.beheerder ? null : p.id); });
      lijst.appendChild(b);
    });
    $('#aKind').hidden = false;
    var magKind = d.paspoortGecontroleerd === true;
    $('#aKindUitleg').textContent = magKind
      ? 'Een kind toevoegen: uw kind komt binnen via uw account.'
      : 'Een kind toevoegen kan zodra RTG uw paspoort heeft gecontroleerd. Dat regelt u in RTG iD in de RTG-app.';
    ['#aKNaam', '#aKGeboren', '#aKDoe'].forEach(function (s) { $(s).disabled = !magKind; });
  }

  function toonMaak(d) {
    $('#aProfielen').hidden = true; $('#aKind').hidden = true;
    $('#aTitel').textContent = 'Mijn gezin';
    if (!d.achttienPlus) {
      $('#aMaak').hidden = true; $('#aDoe').hidden = true;
      $('#aSub').textContent = 'Een gezin maken kan vanaf 18 jaar. Ben je jonger? Vraag je ouder of verzorger om je toe te voegen.';
      return;
    }
    $('#aSub').textContent = 'Er hangt nog geen gezin aan uw account. Maak het hier aan; FoundationOS blijft gratis.';
    $('#aMaak').hidden = false; $('#aDoe').hidden = false;
  }

  function laad() {
    fout('');
    return vraag('', {}).then(function (d) { if (d.gezin) toonGezin(d); else toonMaak(d); })
      .catch(function (e) { if (e.status === 401 || e.status === 403) naarInlog(); else fout(e.message); });
  }

  function start() {
    var knop = $('#bAccount'), dlg = $('#dlgAccount');
    if (!knop || !dlg) return;
    knop.addEventListener('click', function () {
      if (!lidToken()) return naarInlog();
      try { dlg.showModal(); } catch (e) {}
      laad();
    });
    $('#aDoe').addEventListener('click', function () {
      fout('');
      vraag('/maak', { gezinsnaam: $('#aGezin').value, naam: $('#aNaam').value,
        bevoegdGezin: $('#aBevoegd').checked, privacyAkkoord: $('#aPrivacy').checked })
        .then(function (d) {
          window.Sessie.zet({ code: d.code, token: d.token, gezin: d.gezin, profiel: d.profiel });
          location.hash = ''; location.reload();
        }).catch(function (e) { fout(e.message); });
    });
    $('#aKDoe').addEventListener('click', function () {
      fout('');
      vraag('/kind', { naam: $('#aKNaam').value, geboortedatum: $('#aKGeboren').value })
        .then(function () { $('#aKNaam').value = ''; $('#aKGeboren').value = ''; return laad(); })
        .catch(function (e) { fout(e.message); });
    });
    if (location.hash === '#mijn-gezin' && lidToken()) { try { dlg.showModal(); } catch (e) {} laad(); }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

/* De tab Besluiten in de boardroom: het beslisgeheugen (besluit C13) en de
   cadeaubon van RTG (besluit C14). Allebei bestonden ze aan de serverkant en
   hadden ze geen scherm.

   De server houdt de poort (boardroomAuth, een besluit op naam, de cadeaubon met
   een verse passkey); dit bestand is de etalage. Komt er een 401 of 403 terug,
   dan blijven de secties dicht. Wie iets vastlegde zet de server, nooit dit
   scherm. */
(function () {
  'use strict';
  var T = function (k, s) { return (window.RTGi18n && RTGi18n.t) ? RTGi18n.t(k, s) : s; };
  var $ = function (id) { return document.getElementById(id); };
  var RICHTING = { omhoog: 'omhoog', omlaag: 'omlaag', gelijk: 'gelijk' };
  function token() { try { return localStorage.getItem('rtg_member_token') || ''; } catch (e) { return ''; } }
  function kaal(pad, body) {
    return fetch(pad, { method: 'POST', body: JSON.stringify(body || {}),
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }
    }).then(function (r) { return r.json().catch(function () { return {}; })
      .then(function (d) { return { status: r.status, body: d }; }); });
  }
  function post(pad, body) {
    return kaal(pad, body).then(function (r) {
      if (r.status >= 400) throw new Error((r.body && r.body.error) || T('lr.mislukt', 'Dat lukte niet.'));
      return r.body;
    });
  }
  /* De cadeaubon omzetten is ZWAAR: de server vraagt een verse passkey, en
     /shared/zwaarstap.js laat de browser tekenen en probeert het een keer opnieuw. */
  function metVinger(pad, body) {
    if (!window.RTGZwaar) return post(pad, body);
    return window.RTGZwaar.metVinger(function (extra) { return kaal(pad, Object.assign({}, body, extra)); },
      function (actie) { return kaal('/api/office/boardroom/bevestig/opties', { actie: actie })
        .then(function (x) { return x.body; }); })
      .then(function (r) {
        if (r.status >= 400) throw new Error((r.body && r.body.error) || T('lr.mislukt', 'Dat lukte niet.'));
        return r.body;
      });
  }
  function zeg(t, soort) {
    var e = $('melder'); if (!e) return;
    e.textContent = t || '';
    e.className = 'rtg-melder' + (t ? ' zien' : '') + (soort ? ' ' + soort : '');
  }
  function el(tag, cls, tekst) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (tekst != null) e.textContent = tekst;
    return e;
  }
  function knop(tekst, doe) {
    var k = el('button', 'rtg-knop', tekst);
    k.type = 'button';
    k.addEventListener('click', function () { doe(k); });
    return k;
  }
  function rij(doel, naam, sub, extra) {
    var r = el('div', 'rtg-rij'), t = el('div', 'rtg-tekst');
    t.appendChild(el('div', 'rtg-naam', naam));
    (Array.isArray(sub) ? sub : [sub]).forEach(function (x) { if (x) t.appendChild(el('div', 'rtg-sub', x)); });
    r.appendChild(t);
    if (extra) r.appendChild(extra);
    doel.appendChild(r);
    return r;
  }
  function euro(c) { return (c / 100).toLocaleString(document.documentElement.lang || undefined, { style: 'currency', currency: 'EUR' }); }
  function datum(t) { try { return t ? new Date(t).toLocaleDateString(document.documentElement.lang || undefined) : ''; } catch (e) { return ''; } }

  /* ---- het beslisgeheugen ---- */
  var maten = [];
  function keuzeMaat() {
    var s = el('select', 'rtg-veld');
    s.setAttribute('aria-label', T('bg.maat', 'Bedrijfsmaat'));
    maten.forEach(function (m) { var o = el('option', null, m); o.value = m; s.appendChild(o); });
    return s;
  }
  function keuzeRichting() {
    var s = el('select', 'rtg-veld');
    s.setAttribute('aria-label', T('bg.richting', 'Verwachte richting'));
    Object.keys(RICHTING).forEach(function (r) { var o = el('option', null, T('bg.r.' + r, RICHTING[r])); o.value = r; s.appendChild(o); });
    return s;
  }
  function formulier() {
    var box = $('bgNieuw'); box.textContent = '';
    var tekst = el('textarea', 'rtg-veld');
    tekst.id = 'bgTekst'; tekst.maxLength = 500; tekst.rows = 3;
    tekst.setAttribute('aria-label', T('bg.besluit', 'Het besluit'));
    tekst.placeholder = T('bg.besluitPh', 'Wat besluit u, in 10 tot 500 tekens?');
    box.appendChild(tekst);
    var verwacht = el('div'); verwacht.id = 'bgVerwacht';
    box.appendChild(verwacht);
    function regel() {
      if (verwacht.children.length >= 8) return;
      var r = el('div', 'rtg-rij');
      r.appendChild(keuzeMaat()); r.appendChild(keuzeRichting());
      verwacht.appendChild(r);
    }
    regel();
    var onder = el('div', 'rtg-rij');
    var termijn = el('input', 'rtg-veld');
    termijn.id = 'bgTermijn'; termijn.type = 'number'; termijn.min = '30'; termijn.max = '366'; termijn.value = '90';
    termijn.setAttribute('aria-label', T('bg.termijn', 'Termijn in dagen (30 tot 366)'));
    onder.appendChild(termijn);
    onder.appendChild(knop(T('bg.meer', 'Nog een maat'), regel));
    onder.appendChild(knop(T('bg.leg', 'Leg vast, op mijn naam'), function (k) {
      var verwachting = Array.prototype.map.call(verwacht.children, function (r) {
        var s = r.querySelectorAll('select');
        return { maat: s[0].value, richting: s[1].value };
      });
      k.disabled = true;
      post('/api/office/beslisgeheugen/leg', { besluit: tekst.value, verwachting: verwachting, termijnDagen: Number(termijn.value) })
        .then(function (d) {
          zeg(d.ongewijzigd ? T('bg.stond', 'Dat besluit stond er al zo.') : T('bg.ok', 'Vastgelegd, met de getallen van nu.'), 'goed');
          tekst.value = '';
          return laadGeheugen();
        })
        .catch(function (e) { zeg(e.message, 'fout'); })
        .then(function () { k.disabled = false; });
    }));
    box.appendChild(onder);
  }
  function uitkomstRegels(b) {
    var u = b.uitkomst || {};
    if (u.stand === 'NOG_NIET') return [T('bg.nogniet', 'Te toetsen vanaf ') + datum(u.toetsOp)];
    return (u.perMaat || []).map(function (p) {
      var kern = p.maat + ': ' + T('bg.verwacht', 'verwacht ') + T('bg.r.' + p.verwacht, p.verwacht);
      if (p.klopt == null) return kern + ' · ' + (p.waarom || T('bg.geenoordeel', 'geen oordeel'));
      return kern + ' · ' + T('bg.gemeten', 'gemeten ') + T('bg.r.' + p.gemeten, p.gemeten) + ' (' + p.voor + ' → ' + p.na + ')' +
        ' · ' + (p.klopt ? T('bg.klopt', 'zoals verwacht') : T('bg.kloptniet', 'anders dan verwacht'));
    });
  }
  function intrekken(b) {
    var vak = el('div', 'rtg-rij');
    var reden = el('input', 'rtg-veld');
    reden.maxLength = 300;
    reden.placeholder = T('bg.redenPh', 'Reden van intrekken');
    reden.setAttribute('aria-label', T('bg.reden', 'Reden van intrekken'));
    vak.appendChild(reden);
    vak.appendChild(knop(T('bg.trekin', 'Trek in'), function (k) {
      k.disabled = true;
      post('/api/office/beslisgeheugen/intrek', { id: b.id, reden: reden.value })
        .then(function () { zeg(T('bg.ingetrokken', 'Ingetrokken; het besluit blijft staan.'), 'goed'); return laadGeheugen(); })
        .catch(function (e) { zeg(e.message, 'fout'); k.disabled = false; });
    }));
    return vak;
  }
  function laadGeheugen() {
    return post('/api/office/beslisgeheugen', {}).then(function (d) {
      $('bgSectie').hidden = false;
      var box = $('bgLijst'); box.textContent = '';
      var lijst = d.besluiten || [];
      if (!lijst.length) { box.appendChild(el('p', 'rtg-leeg', T('bg.leeg', 'Er staat nog geen besluit in het geheugen.'))); return; }
      lijst.forEach(function (b) {
        var kop = b.besluit;
        var sub = [T('bg.door', 'Door ') + b.wie + ' · ' + datum(b.op)].concat(uitkomstRegels(b));
        if (b.ingetrokken) sub.push(T('bg.isin', 'Ingetrokken door ') + b.ingetrokken.wie + ' · ' + datum(b.ingetrokken.op) + ' · ' + b.ingetrokken.reden);
        var r = rij(box, kop, sub, b.ingetrokken ? null : intrekken(b));
        r.setAttribute('data-besluit', b.id);
      });
    });
  }

  /* ---- de cadeaubon ---- */
  function laadCadeaubon() {
    return post('/api/office/cadeaubon', {}).then(function (d) {
      $('cbSectie').hidden = false;
      var box = $('cbStand'); box.textContent = '';
      var open = d.stand === 'open';
      var u = d.uitgifte || {};
      var k = knop(open ? T('cb.dicht', 'Zet dicht') : T('cb.open', 'Zet open'), function (kn) {
        kn.disabled = true;
        metVinger('/api/office/cadeaubon/stand', { stand: open ? 'gesloten' : 'open' })
          .then(function (r) { zeg(r.uitleg || T('rb.ok', 'Omgezet.'), 'goed'); return laadCadeaubon(); })
          .catch(function (e) { zeg(e.message, 'fout'); kn.disabled = false; });
      });
      k.id = 'cbSchakel';
      rij(box, T('cb.stand', 'De cadeaubon') + ' · ' + (open ? T('cb.isopen', 'open') : T('cb.isdicht', 'dicht')), [
        d.standDoor ? T('cb.door', 'Gezet door ') + d.standDoor + ' · ' + datum(d.standAt) : null,
        T('cb.uitgifte', 'Uitgifte: ') + (u.mag ? T('cb.mag', 'mag') : T('cb.magniet', 'mag niet') + (u.uitleg ? ' · ' + u.uitleg : '')),
        T('cb.verplichting', 'Verplichting uit verkochte bonnen: ') + euro((d.verplichting && d.verplichting.centen) || 0) +
          (d.verplichting && d.verplichting.reden ? ' · ' + d.verplichting.reden : ''),
        T('cb.niet', 'Niet gebouwd: ') + (d.nietGebouwd || []).join(', ') + '. ' + (d.waaromNiet || '')
      ], k);
    });
  }

  function start() {
    if (!token()) return;
    post('/api/office/bedrijfsmaat', {}).then(function (d) {
      maten = (d.maten || []).map(function (m) { return m.id; });
      formulier();
      return laadGeheugen();
    }).catch(function () { /* geen boardroom: de sectie blijft verborgen */ });
    laadCadeaubon().catch(function () { /* geen boardroom: de sectie blijft verborgen */ });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

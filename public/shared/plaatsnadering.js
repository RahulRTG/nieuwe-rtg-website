/* Arrival deelt uitsluitend een puls: GPS en pass blijven gescheiden. */
(function () {
  'use strict';
  if (window.RTGPlaatsNadering) return;

  var gevraagd = false, poging = null, verborgen = false;

  function pasToken() {
    /* arrival.html bewaart { p, tot }: de pass en zijn vervaltijd. Een
       verlopen pass wordt hier niet meer gebruikt. */
    try {
      var w = JSON.parse(localStorage.getItem('rtg_arrival_pass') || 'null');
      return w && w.p && Date.parse(w.tot) > Date.now() ? w.p : null;
    } catch (e) { return null; }
  }
  function lid() {
    try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; }
  }
  function api(pad, body, token) {
    var h = { 'Content-Type': 'application/json' };
    if (token) h.Authorization = 'Bearer ' + token;
    return fetch(pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.ok ? r.json().catch(function () { return null; }) : null; })
      .catch(function () { return null; });
  }

  /* Het aanbod. Zelfde vorm als shared/plek.js en shared/plaatsdienst.js: een
     rustige kaart onderin met een duidelijke "nu niet". De tekst zegt wat de
     zaak ziet EN wat ze niet ziet, want dat is precies waar iemand ja of nee op
     hoort te zeggen. */
  function bied(naam, g) {
    return new Promise(function (klaar) {
      var ds = document.documentElement.hasAttribute('data-ds'), gesloten = false, st = null;
      if (!document.documentElement.hasAttribute('data-ds')) {
      st = document.createElement('style');
      st.textContent =
        '.rtgnader{position:fixed;left:50%;transform:translateX(-50%);z-index:9983;' +
          'bottom:calc(env(safe-area-inset-bottom,0px) + 1.5rem);width:min(24rem,calc(100vw - 2rem));' +
          'background:var(--paneel,#151312);border:1px solid var(--line,var(--lijn,#2A2724));' +
          'border-radius:0;padding:1rem 1.1rem;color:var(--txt,#F7F5F1);' +
          'font-family:Inter,system-ui,sans-serif;box-shadow:0 14px 40px rgba(0,0,0,.45);}' +
        '.rtgnader p{margin:0 0 .8rem;font-size:.85rem;line-height:1.55;color:var(--muted,var(--zacht,#8A8680));}' +
        '.rtgnader .rij{display:flex;gap:.6rem;}' +
        '.rtgnader button{flex:1;border:none;border-radius:0;padding:.6rem;font:inherit;' +
          'font-size:.82rem;font-weight:600;cursor:pointer;}' +
        '.rtgnader .ja{background:var(--ds-accent,var(--gold,#857007));color:var(--ds-accent-inkt,#0C0C0B);}' +
        '.rtgnader .nee{background:none;color:var(--muted,#8A8680);font-weight:500;}';
      document.head.appendChild(st);
      }

      var doos = document.createElement('div');
      doos.className = 'rtgnader' + (ds ? ' ds-plek' : '');
      doos.setAttribute('role', 'dialog'); doos.setAttribute('aria-modal', 'false');
      doos.setAttribute('aria-label', 'Zelf melden dat je in de buurt bent');
      var p = document.createElement('p');
      p.textContent = 'Zal ik het zelf melden als je in de buurt van ' + naam + ' komt? ' +
        'Dan kunnen ze je tafel op tijd gereedmaken. ' + naam + ' ziet alleen dat je eraan komt, ' +
        'niet waar je bent. Je locatie blijft op je toestel, en je kunt het altijd zelf blijven doen.';
      var rij = document.createElement('div'); rij.className = 'rij';
      var ja = document.createElement('button'); ja.className = 'ja' + (ds ? ' ds-knop ds-knop--primair' : ''); ja.type = 'button'; ja.textContent = 'Ja, meld het zelf';
      var nee = document.createElement('button'); nee.className = 'nee' + (ds ? ' ds-knop ds-knop--stil' : ''); nee.type = 'button'; nee.textContent = 'Nu niet';
      rij.append(nee, ja);
      doos.append(p, rij);
      document.body.appendChild(doos);

      var vorigeFocus = document.activeElement;
      ja.focus();
      if (g) g.sluit = function () { sluit(false); };
      function sluit(a) {
        if (gesloten) return; gesloten = true;
        a = !!a && doos.isConnected && (!g || geldig(g));
        if (g) g.sluit = null;
        var herstel = doos.contains(document.activeElement);
        doos.remove(); if (st) st.remove();
        try { if (herstel && vorigeFocus && vorigeFocus.focus && document.contains(vorigeFocus)) vorigeFocus.focus({ preventScroll: true }); } catch (e) {}
        klaar(a);
      }
      doos.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { ev.preventDefault(); sluit(false); } });
      ja.addEventListener('click', function () { sluit(true); });
      nee.addEventListener('click', function () { sluit(false); });
    });
  }

  function stop() {
    var g = poging; poging = null;
    if (!g) return;
    if (g.sluit) g.sluit();
    if (g.af) g.af();
    if (g.motor && window.RTGPlaats) window.RTGPlaats.stop();
  }
  function geldig(g) {
    var ok = poging === g && !verborgen && lid() === g.actor && pasToken() === g.token &&
      window.RTGPlek === g.plek && g.plek.toestemmingVersie() === g.toestemming;
    if (!ok && poging === g) stop();
    return ok;
  }
  function bruikbaar(p, g) {
    return p && p.zaak && typeof p.zaak.code === 'string' && p.zaak.code &&
      Date.parse(p.vervaltAt) > Date.now() && (!g.zaak || p.zaak.code === g.zaak) &&
      !['in-de-buurt', 'gearriveerd', 'delen-gestopt'].includes(p.pulse);
  }
  async function pas(g) {
    if (!geldig(g)) return null;
    var r = await api('/api/arrival/pass', { pass: g.token }, g.actor);
    return geldig(g) && r && r.ok === true && !r.error && bruikbaar(r.pass, g) ? r.pass : null;
  }
  function gpsAan() { return window.RTGPlek && typeof window.RTGPlek.aan === 'function' && window.RTGPlek.aan() === true; }
  async function meld(g, w) {
    if (!gpsAan()) { if (poging === g) stop(); return; }
    if (!geldig(g) || g.gemeld || g.bezig || w.doel !== 'nadering' || w.hek !== g.hek || w.wat !== 'binnen') return;
    g.bezig = true;
    var p = await pas(g);
    if (!p || !geldig(g) || !gpsAan()) { if (poging === g) stop(); return; }
    g.gemeld = true;
    await api('/api/arrival/pulse', { pass: g.token, pulse: 'in-de-buurt' }, g.actor);
    if (poging === g) stop();
  }
  async function ronde() {
    if (poging) { if (geldig(poging)) return; }
    var plek = window.RTGPlek;
    if (gevraagd || verborgen || !window.RTGPlaats || !plek || typeof plek.toestemmingVersie !== 'function' || !lid() || !pasToken()) return;
    var g = { actor: lid(), token: pasToken(), zaak: null, motor: false,
      plek: plek, toestemming: plek.toestemmingVersie() }; poging = g;
    try {
    var p = await pas(g);
    if (!p || !geldig(g) || !document.body) { if (poging === g) stop(); return; }
    g.zaak = p.zaak.code; g.hek = 'leverancier:' + g.zaak; gevraagd = true;
    if (!await bied(p.zaak.naam || 'de zaak', g) || !geldig(g)) { if (poging === g) stop(); return; }
    p = await pas(g);
    if (!p || !geldig(g)) { if (poging === g) stop(); return; }
    var minuten = Math.max(1, Math.ceil((Date.parse(p.vervaltAt) - Date.now()) / 60000));
    var v = await api('/api/plaats/venster', { doel: 'nadering', bron: 'bezoek aan ' + g.zaak, hek: g.hek, minuten: minuten }, g.actor);
    if (!geldig(g) || !v || v.status !== 200 || v.error || v.ok === false) { if (poging === g) stop(); return; }
    g.af = window.RTGPlaats.opWissel(function (w) { meld(g, w); });
    g.motor = true;
    var resultaat = await window.RTGPlaats.start('nadering', {
      waarom: 'Om zelf te kunnen melden dat je in de buurt bent, zodat je tafel op tijd klaarstaat. Je locatie blijft op je toestel.',
      bijIntrekken: function () { if (poging === g) { g.motor = false; stop(); } }
    });
    if (!geldig(g) || !resultaat || resultaat.ok !== true) { if (poging === g) stop(); }
    } catch (e) {
      if (poging === g) { stop(); gevraagd = false; }
    }
  }
  function begin() { ronde(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin);
  else begin();
  window.addEventListener('pagehide', function () { verborgen = true; stop(); });
  window.addEventListener('storage', function () { if (poging) geldig(poging); });
  window.RTGPlaatsNadering = { ronde: ronde, _bied: bied, stop: stop };
})();

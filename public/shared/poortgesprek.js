/* Gegevenspoort: call() beheert tokens; adresvoorstellen vragen expliciet ja. */
((w) => {
  'use strict';
  if (w.RTGGegevensPoort) return;

  var esc = (t) => { return String(t == null ? '' : t).replace(/[&<>"']/g, (c) => { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };

  var waas = null, kaart = null, huidig = null, ds = false;

  function laadPoortgesprekPresentatie(pad) {
    if (document.documentElement.hasAttribute('data-ds')) return null;
    if (document.getElementById('rtgDsRuntimeCss')) return null;
    var poortgesprekStijlLink = document.createElement('link');
    poortgesprekStijlLink.setAttribute('id', 'rtgDsRuntimeCss');
    poortgesprekStijlLink.rel = 'stylesheet';
    poortgesprekStijlLink.href = pad;
    document.head.appendChild(poortgesprekStijlLink);
    return poortgesprekStijlLink;
  }

  var vind = selector => kaart.querySelector(selector);
  function actueel(g) {
    if (huidig === g && (!waas.isConnected || !kaart.isConnected)) klaar(false);
    return huidig === g;
  }

  function bouw() {
    ds = document.documentElement.hasAttribute('data-ds');
    if (!ds) laadPoortgesprekPresentatie('/ds/rtg-ds.css');
    waas = document.createElement('div');
    waas.className = 'rp-waas' + (ds ? '' : ' ds-poortgesprek-waas--overlay');
    waas.hidden = true;
    kaart = document.createElement(ds ? 'dialog' : 'div');
    kaart.className = 'rp-kaart ds-dialoog ds-poortgesprek';
    kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true');
    waas.appendChild(kaart);
    waas.addEventListener('click', (e) => { if (!ds && e.target === waas) klaar(false); });
    kaart.addEventListener('cancel', (e) => { e.preventDefault(); klaar(false); });
    kaart.addEventListener('close', () => { if (ds && !kaart.open) klaar(false); });
    kaart.addEventListener('click', (e) => {
      if (!ds || e.target !== kaart) return;
      var r = kaart.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) klaar(false);
    });
    document.body.appendChild(waas);
  }
  document.addEventListener('keydown', (e) => {
    if (!ds && huidig && e.key === 'Escape') klaar(false);
  });

  function vorm() {
    var kop = vind('h2'), vraag = vind('.rp-vraag');
    kop.id = 'rtgPoortTitel'; vraag.id = 'rtgPoortVraag';
    kaart.setAttribute('aria-labelledby', kop.id); kaart.setAttribute('aria-describedby', vraag.id);
    var invoer = vind('.rp-in'), uitleg = vind('.rp-uitleg');
    if (invoer) {
      invoer.setAttribute('aria-labelledby', vraag.id);
      if (uitleg) { uitleg.id = 'rtgPoortUitleg'; invoer.setAttribute('aria-describedby', uitleg.id); }
      invoer.classList.add('ds-invoer');
    }
    kaart.querySelectorAll('button').forEach((b) => {
      b.classList.add('ds-knop', b.classList.contains('rp-door') ? 'ds-knop--primair' : 'ds-knop--stil');
    });
    kaart.removeAttribute('aria-busy');
  }

  function bezig(g) {
    if (huidig !== g || g.bezig) return false;
    g.bezig = true; kaart.setAttribute('aria-busy', 'true');
    kaart.querySelectorAll('.rp-door, .rp-waarom').forEach((b) => { b.disabled = true; });
    var invoer = vind('.rp-in'); if (invoer) invoer.readOnly = true;
    return true;
  }

  function toon(tekst, veld, uitleg, waarde) {
    var g = huidig, invoer = veld && veld !== 'identiteit';
    huidig.vraag = tekst; huidig.veld = veld || null; huidig.bezig = false;
    kaart.innerHTML =
      '<h2>Nog een ding</h2>' +
      '<p class="rp-vraag">' + esc(tekst) + '</p>' +
      (invoer ? '<input type="text" class="rp-in" autocomplete="' + (veld === 'telefoon' ? 'tel' : 'street-address') +
        '" inputmode="' + (veld === 'telefoon' ? 'tel' : 'text') + '"' +
        (veld === 'adres' ? ' placeholder="Postcode en huisnummer mag ook"' : '') + '>' : '') +
      (uitleg ? '<p class="rp-uitleg">' + esc(uitleg) + '</p>' :
        (invoer ? '<button type="button" class="rp-waarom">Waarom vraag je dit?</button>' : '')) +
      '<div class="rp-rij">' +
      (invoer ? '<button type="button" class="rp-door">Doorgaan</button>' : '') +
      '<button type="button" class="rp-stop">' + (invoer ? 'Laat maar' : 'Sluiten') + '</button>' +
      '</div>';
    vorm();
    var in1 = vind('.rp-in');
    if (in1) {
      in1.value = waarde || '';
      in1.focus();
      in1.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && huidig === g) { e.preventDefault(); stuur(in1.value); }
      });
    }
    var d = vind('.rp-door'); if (d) d.addEventListener('click', () => { if (huidig === g) stuur(in1 ? in1.value : ''); });
    var wa = vind('.rp-waarom'); if (wa) wa.addEventListener('click', () => { if (huidig === g) stuur('waarom?', true); });
    vind('.rp-stop').addEventListener('click', () => { if (huidig === g) klaar(false); });
    if (!in1) vind('.rp-stop').focus();
  }

  function stuur(tekst, isWaarom) {
    if (!huidig || huidig.bezig || !String(tekst || '').trim()) return;
    if (!isWaarom && huidig.veld === 'adres' && w.RTGAdresvoorstel) {
      var gel = w.RTGAdresvoorstel.lees(tekst);
      if (gel) return opzoeken(gel);
    }
    verzend(tekst, isWaarom);
  }

  function opzoeken(gel) {
    var g = huidig, waarde = vind('.rp-in').value;
    if (!bezig(g)) return;
    Promise.resolve().then(() => actueel(g) && w.RTGAdresvoorstel.zoek(g.call, gel)).then((r) => {
      if (!actueel(g)) return;
      g.bezig = false;
      if (!r.voorstel) return toon(g.vraag, 'adres', r.tekst, waarde);
      bevestig(r.voorstel, g, waarde);
    }).catch((e) => { if (actueel(g)) toon(g.vraag, 'adres', e && e.message || 'Opzoeken lukt nu even niet.', waarde); });
  }

  function bevestig(zin, g, waarde) {
    w.RTGAdresvoorstel.kaart(kaart, esc, zin,
      () => { if (huidig === g) verzend(zin); },
      () => { if (huidig === g && !g.bezig) toon(g.vraag, 'adres', '', waarde); });
    vorm();
  }

  function verzend(tekst, isWaarom) {
    if (!huidig) return;
    var g = huidig, in1 = vind('.rp-in'), waarde = in1 ? in1.value : '';
    if (!bezig(g)) return;
    Promise.resolve().then(() => actueel(g) && g.call('/api/gegevens/zeg', { id: g.id, tekst: String(tekst) })).then((d) => {
      if (!actueel(g)) return;
      lees(d);
      if (d.klaar === true) return klaar(true);
      if (d.gestopt === true) return toon(d.tekst, null, '');
      if (isWaarom) return toon(g.vraag, d.veld, d.tekst, waarde);
      // 'adres' kan doorgaan naar een plaatsvraag met dezelfde veldnaam.
      toon(d.tekst, d.veld, '', g.veld === 'telefoon' && d.veld === g.veld ? waarde : '');
    }).catch((e) => fout(g, e));
  }

  function fout(g, e) { if (actueel(g)) toon(e && e.message || 'Dat lukte even niet.', null, ''); }

  function lees(d, start) {
    if (!d || d.error || d.ok === false || ['klaar', 'gestopt'].some(k => d[k] !== undefined && typeof d[k] !== 'boolean') ||
        (d.klaar === true && d.gestopt === true) || (d.klaar !== true &&
        (typeof d.tekst !== 'string' || !d.tekst || (!d.gestopt && typeof d.veld !== 'string') ||
        (start && (typeof d.id !== 'string' || !d.id))))) throw new Error(d && d.error || 'Geen geldig antwoord ontvangen.');
  }

  function klaar(gelukt) {
    if (!huidig) return;
    var g = huidig; huidig = null;
    if (ds && kaart.open) kaart.close();
    waas.hidden = true;
    if (g.terug && g.terug.isConnected && typeof g.terug.focus === 'function') g.terug.focus();
    g.af(!!gelukt);
  }

  function los(d, call) {
    var terug = document.activeElement;
    if (huidig) { if (kaart.contains(terug)) terug = huidig.terug; klaar(false); }
    if (waas && (!waas.isConnected || ds !== document.documentElement.hasAttribute('data-ds'))) {
      waas.remove(); waas = null;
    }
    if (!waas) bouw();
    return new Promise((af) => {
      var g = { call: call, af: af, id: null, terug: terug, bezig: false };
      huidig = g;
      waas.hidden = false;
      toon('Momentje...', null, '');
      if (ds) { kaart.showModal(); vind('.rp-stop').focus(); }
      bezig(g);
      Promise.resolve().then(() => actueel(g) && call('/api/gegevens/start', { soort: d && d.soort })).then((s) => {
        if (!actueel(g)) return;
        lees(s, true);
        if (s.klaar === true) return klaar(true);
        g.id = s.id;
        toon(s.tekst, s.veld, '');
      }).catch((e) => fout(g, e));
    });
  }

  function vang(d, status, opnieuw, call) {
    if (status !== 428 || !d || !d.ontbreekt || !d.ontbreekt.length) return null;
    return los(d, call).then((ok) => {
      if (!ok) throw new Error(d.error || 'Dan gaat het niet door.');
      return opnieuw();
    });
  }

  w.RTGGegevensPoort = { los: los, vang: vang };
})(window);

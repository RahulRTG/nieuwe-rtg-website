/* Het eigen hoofdbeeld van TravelOS (beeldplek travel/hoofd) op de ds-Cover.
   Dezelfde afspraak als shared/interface/personal-images.js op de nog niet
   gemigreerde wereldschermen: de voorkeur woont in /api/ik/beelden, de bytes
   blijven bij Bestanden (/api/bestanden/haal), en het raakt nooit media van
   een ander -- alleen deze ene beeldplek en alleen eigen bestanden.

   Het verschil zit in de vorm. De oude module zette object-position en
   transform als inline stijl op het <img>; een ds-scherm zet geen stijl uit
   een script. Hier wordt een gekozen foto een SVG-beeld (ds-cover__beeld)
   waarvan de plaatsing in de attributen x, y, width en height staat,
   uitgerekend zoals object-fit: cover met object-position x% y% en een
   vergroting rond datzelfde punt. Zonder keuze blijft het eigen RTG-beeld
   gewoon het <img> uit de HTML. */
(function (w, d) {
  'use strict';
  var SLOT = 'travel/hoofd', NS = 'http://www.w3.org/2000/svg';
  var voorkeuren = {}, bytes = new Map(), maten = new Map(), staat = new WeakMap();
  var epoch = 0, sleutel = '', laden = null, cover = null;
  var img = d.querySelector('img.ds-cover__beeld'), origineel = img ? img.getAttribute('src') : '';
  var waarnemer = 'ResizeObserver' in w ? new w.ResizeObserver(function (rijen) { rijen.forEach(function (r) { plaats(r.target); }); }) : null;

  function token() { try { return w.localStorage.getItem('rtg_member_token') || ''; } catch (_) { return ''; } }
  function api(pad, body) {
    var auth = token(), versie = epoch;
    if (!auth) return Promise.reject(new Error('Log in met uw RTG-account om eigen foto’s te bewaren.'));
    var basis = d.querySelector('meta[name="rtg-api-base"]');
    return w.fetch((basis ? basis.content.replace(/\/$/, '') : '') + pad, { method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + auth }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) {
        if (!r.ok || j.error) throw new Error(j.error || 'De wijziging kon niet worden opgeslagen.');
        if (versie !== epoch || auth !== token()) throw new Error('Uw account is gewijzigd. Open de foto opnieuw.');
        return j;
      }); });
  }
  function bestand(id) {
    if (!bytes.has(id)) bytes.set(id, api('/api/bestanden/haal', { id: id }).then(function (j) {
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(j.dataUrl)) throw new Error('Kies een JPG-, PNG- of WebP-foto.');
      return j.dataUrl;
    }).catch(function (e) { bytes.delete(id); throw e; }));
    return bytes.get(id);
  }
  /* De eigen maat van een foto, nodig om cover na te rekenen. */
  function maat(url) {
    if (!maten.has(url)) maten.set(url, new Promise(function (ok, mis) {
      var i = new w.Image(); i.onload = function () { ok({ b: i.naturalWidth || 1, h: i.naturalHeight || 1 }); }; i.onerror = mis; i.src = url;
    }));
    return maten.get(url);
  }
  function plaats(svg) {
    var s = staat.get(svg), r = svg.getBoundingClientRect();
    if (!s || !s.m || !r.width || !r.height) return;
    var c = s.snede, k = Math.max(r.width / s.m.b, r.height / s.m.h), bw = s.m.b * k, bh = s.m.h * k;
    var px = r.width * c.x / 100, py = r.height * c.y / 100;
    var x = px + ((r.width - bw) * c.x / 100 - px) * c.zoom, y = py + ((r.height - bh) * c.y / 100 - py) * c.zoom;
    svg.setAttribute('viewBox', '0 0 ' + r.width + ' ' + r.height);
    var beeld = svg.querySelector('image');
    [['x', x], ['y', y], ['width', bw * c.zoom], ['height', bh * c.zoom]].forEach(function (a) { beeld.setAttribute(a[0], a[1].toFixed(2)); });
  }
  /* Zet een foto met een uitsnede op een SVG-vlak (de Cover of het voorbeeld). */
  function zet(svg, url, snede) {
    var beeld = svg.querySelector('image');
    if (!beeld) { beeld = d.createElementNS(NS, 'image'); beeld.setAttribute('preserveAspectRatio', 'none'); svg.appendChild(beeld); }
    var s = { url: url, snede: { x: snede.x, y: snede.y, zoom: snede.zoom } }; staat.set(svg, s);
    beeld.setAttribute('href', url);
    if (waarnemer && !svg.dataset.dsGevolgd) { svg.dataset.dsGevolgd = 'ja'; waarnemer.observe(svg); }
    return maat(url).then(function (m) { if (staat.get(svg) === s) { s.m = m; plaats(svg); } });
  }
  function weergave() { return w.innerWidth < 1000 ? 'mobile' : 'desktop'; }
  function standaard() {
    if (cover) { if (waarnemer) waarnemer.unobserve(cover); cover.remove(); cover = null; }
    if (img) { img.hidden = false; img.closest('.ds-cover').removeAttribute('data-eigen-beeld'); }
  }
  function toon() {
    var keuze = voorkeuren[SLOT], versie = epoch;
    if (!keuze || !img) { standaard(); return; }
    bestand(keuze.file).then(function (url) {
      if (versie !== epoch || voorkeuren[SLOT] !== keuze) return;
      if (!cover) { cover = d.createElementNS(NS, 'svg'); cover.setAttribute('class', 'ds-cover__beeld'); cover.setAttribute('aria-hidden', 'true'); img.after(cover); }
      cover.setAttribute('data-snede', weergave());
      return zet(cover, url, keuze[weergave()]).then(function () {
        if (versie !== epoch || !cover) return;
        img.hidden = true; img.closest('.ds-cover').setAttribute('data-eigen-beeld', weergave());
      });
    }).catch(standaard);
  }
  function ververs() {
    if (laden) return laden;
    var versie = epoch;
    laden = api('/api/ik/beelden').then(function (j) {
      if (versie === epoch) { voorkeuren = j.images && typeof j.images === 'object' ? j.images : {}; toon(); }
    }).finally(function () { laden = null; });
    return laden;
  }
  /* Een ander account (of uitloggen) in dit of een ander tabblad: alles van
     de vorige weg, en een open editor gaat dicht. */
  function identiteit() {
    if (sleutel === token()) return;
    sleutel = token(); epoch++; laden = null; voorkeuren = {}; bytes.clear(); toon();
    d.dispatchEvent(new w.CustomEvent('rtg-beeld-wissel'));
    if (sleutel) ververs().catch(function () {});
  }

  w.RTGReizenBeeld = {
    SLOT: SLOT, origineel: origineel, api: api, bestand: bestand, zet: zet, weergave: weergave,
    keuze: function () { return voorkeuren[SLOT] || null; },
    ingelogd: function () { return !!token(); },
    bewaar: function (image) {
      return api('/api/ik/beelden/zet', { slot: SLOT, image: image }).then(function (j) {
        voorkeuren = j.images && typeof j.images === 'object' ? j.images : {}; toon();
      });
    }
  };
  identiteit();
  w.addEventListener('storage', identiteit); w.addEventListener('pageshow', identiteit);
  var klok = w.setInterval(identiteit, 1000);
  w.matchMedia('(min-width:1000px)').addEventListener('change', toon);
  w.addEventListener('pagehide', function () { w.clearInterval(klok); bytes.clear(); });
})(window, document);

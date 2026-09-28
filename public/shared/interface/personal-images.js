/* One personal image registry. Never edits another person's published media. */
(function (w, d) {
  'use strict';
  var slots = new Map(), preferences = {}, bytes = new Map(), epoch = 0, credential = '', loading;
  var world = d.body.dataset.publicPlatform === 'company' ? 'company' : d.body.dataset.rtgWorld || 'living';
  function family() { try { return JSON.parse(w.localStorage.getItem('rtf_sessie') || 'null'); } catch (_) { return null; } }
  function token() { try { if (world === 'foundation') { var f = family(); return f && f.token && f.profiel ? f.code + ':' + f.token : ''; } return w.localStorage.getItem('rtg_member_token') || ''; } catch (_) { return ''; } }
  function api(path, body) {
    var auth = token(), version = epoch, headers = { 'Content-Type': 'application/json' };
    if (!auth) return Promise.reject(new Error(world === 'foundation' ? 'Log in met uw eigen gezinsprofiel om foto’s te bewaren.' : 'Log in met uw RTG-account om eigen foto’s te bewaren.'));
    if (world === 'foundation') {
      var f = family(); body = Object.assign({}, body, { code: f.code, token: f.token });
      path = path.replace('/api/ik/beelden', '/api/foundation/gezin/beelden').replace('/api/bestanden/', '/api/foundation/gezin/beelden/');
    } else headers.Authorization = 'Bearer ' + auth;
    var base = d.querySelector('meta[name="rtg-api-base"]');
    return w.fetch((base ? base.content.replace(/\/$/, '') : '') + path, { method: 'POST', credentials: 'same-origin', headers: headers, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || j.error) throw new Error(j.error || 'De wijziging kon niet worden opgeslagen.');
        if (version !== epoch || auth !== token()) throw new Error('Uw account is gewijzigd. Open de foto opnieuw.'); return j; }); });
  }
  function file(id) {
    if (!bytes.has(id)) bytes.set(id, api('/api/bestanden/haal', { id: id }).then(function (j) {
      if (!/^data:image\/(jpeg|png|webp|gif);base64,/.test(j.dataUrl)) throw new Error('Kies een JPG-, PNG- of WebP-foto.'); return j.dataUrl;
    }).catch(function (e) { bytes.delete(id); throw e; }));
    return bytes.get(id);
  }
  function paint(record, source, crop) {
    record.nodes.forEach(function (img) {
      img.src = source; img.style.objectPosition = crop.x + '% ' + crop.y + '%';
      img.style.transform = 'scale(' + crop.zoom + ')'; img.style.transformOrigin = crop.x + '% ' + crop.y + '%';
    });
  }
  function apply(record) {
    var choice = preferences[record.id], version = epoch;
    if (!choice) { record.nodes.forEach(function (img) { img.src = record.original; img.style.objectPosition = ''; img.style.transform = ''; img.style.transformOrigin = ''; }); return; }
    file(choice.file).then(function (url) { if (version === epoch && preferences[record.id] === choice) paint(record, url, choice[w.innerWidth < 1000 ? 'mobile' : 'desktop']); }).catch(function () {
      record.nodes.forEach(function (img) { img.src = record.original; img.style.objectPosition = ''; img.style.transform = ''; img.style.transformOrigin = ''; });
    });
  }
  function register(img, id, label) {
    if (img.dataset.personalImageRegistered) return;
    img.dataset.personalImageRegistered = 'true';
    var full = world + '/' + id, record = slots.get(full);
    if (!record) { record = { id: full, label: label, original: img.getAttribute('src'), nodes: [] }; slots.set(full, record); }
    record.nodes.push(img); apply(record);
    var box = img.closest('.wp-photo,.wp-atmosphere,.wd-app-photo');
    if (box && !box.querySelector('.pi-change')) {
      var button = d.createElement('button'); button.type = 'button'; button.className = 'pi-change';
      button.appendChild(w.RTGDesktopUI.icon('camera')); if (id === 'hoofd') button.appendChild(d.createTextNode('Foto wijzigen')); button.setAttribute('aria-label', label + ' wijzigen');
      button.onclick = function (e) { e.preventDefault(); e.stopPropagation(); w.RTGPersonalImageEditor.open(full); }; box.appendChild(button);
    }
  }
  function hash(value) { var h = 2166136261; for (var i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(16).padStart(8, '0'); }
  function discover() {
    d.querySelectorAll('img').forEach(function (img) {
      var url = new URL(img.src, d.baseURI); if (url.origin !== w.location.origin || !/^\/(?:public\/)?images\//.test(url.pathname)) return;
      if (img.closest('[data-user-content],.pi-editor,.rtg-edge-chrome') || img.dataset.personalImageRegistered) return;
      register(img, 'beeld-' + hash(img.getAttribute('src')), img.alt || 'Beeld ' + (slots.size + 1));
    });
  }
  function refresh() {
    if (loading) return loading;
    var version = epoch;
    loading = api('/api/ik/beelden').then(function (j) { if (version === epoch) { preferences = j.images; slots.forEach(apply); } })
      .finally(function () { loading = null; }); return loading;
  }
  function identity() {
    if (credential === token()) return;
    credential = token(); epoch++; loading = null; preferences = {}; bytes.clear(); slots.forEach(apply);
    if (w.RTGPersonalImageEditor) w.RTGPersonalImageEditor.close();
    if (credential) refresh().catch(function () {});
  }
  function start() {
    discover(); identity();
    var scheduled = false, observer = new MutationObserver(function () { if (scheduled) return; scheduled = true; w.requestAnimationFrame(function () { scheduled = false; discover(); }); });
    observer.observe(d.body, { childList: true, subtree: true });
    w.addEventListener('storage', identity); w.addEventListener('pageshow', identity);
    var timer = w.setInterval(identity, 1000);
    w.matchMedia('(min-width:1000px)').addEventListener('change', function () { slots.forEach(apply); });
    w.addEventListener('pagehide', function () { observer.disconnect(); w.clearInterval(timer); bytes.clear(); });
  }
  w.RTGPersonalImages = { register: register, start: start, api: api, file: file,
    list: function () { return Array.from(slots.values()).filter(function (r) { return r.nodes.some(function (n) { return n.isConnected; }); }); },
    choice: function (id) { return preferences[id] || null; }, authenticated: function () { return !!token(); },
    save: function (slot, image) { return api('/api/ik/beelden/zet', { slot: slot, image: image }).then(function (j) { preferences = j.images; slots.forEach(apply); }); }
  };
})(window, document);

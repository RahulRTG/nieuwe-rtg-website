/* De ondernemer-poort in de partner-app: een nieuwe zaak loopt eerst de basis
   door voordat de deuren opengaan. Zolang de zaak offline staat, ziet de
   ondernemer een rustige melding bovenin met een knop naar de poort. In de
   poort staan drie stappen -- de Salon-pagina vullen en de rondleidingen door
   de kassa en de werk-apps -- en pas als alles klaar is, kan de zaak online.

   Bestaande zaken staan al online, dus dan is er niets te zien. Zelfstandig:
   alleen actief op de partner-app (leverancier.html) met een zaak-inlog. */
(function () {
  if (window.__poort) return; window.__poort = true;
  if (!/\/apps\/leverancier\.html$/.test(location.pathname)) return;
  var supTok = null;
  try { supTok = localStorage.getItem('rtg_sup_token'); } catch (e) {}
  if (!supTok) return;
  if (!document.documentElement.hasAttribute('data-ds') && !document.getElementById('rtgDsRuntimeCss')) {
    var link = document.createElement('link');
    link.id = 'rtgDsRuntimeCss'; link.rel = 'stylesheet'; link.href = '/ds/rtg-ds.css';
    document.head.appendChild(link);
  }

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  function api(pad, body) {
    return fetch('/api/supplier/poort' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + supTok }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  var band, waas, kaart, laatste = null, focusVoorOpen = null;

  function render(d) {
    laatste = d;
    if (band) band.hidden = !!d.online;                 // online -> geen melding
    if (!kaart) return;
    var stappen = (d.stappen || []).map(function (x) {
      return '<div class="p-stap' + (x.klaar ? ' klaar' : '') + '"><div class="p-vink">' + (x.klaar ? '✓' : '') + '</div>' +
        '<div class="p-tk"><b>' + esc(x.naam) + '</b><span>' + esc(x.tekst) + '</span></div></div>';
    }).join('');
    var ronden = (d.rondleidingen || []).map(function (r) {
      return '<div class="p-rond"><h3>' + esc(r.naam) + (r.klaar ? ' ✓' : '') + '</h3>' +
        '<ol>' + (r.stappen || []).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ol>' +
        (r.klaar ? '' : '<div class="poort-knoprij h-mt70"><button class="p-online" data-rond="' + esc(r.id) + '">Gevolgd, vink af</button></div>') +
        '</div>';
    }).join('');
    kaart.innerHTML =
      '<h2>De ondernemer-poort</h2>' +
      '<p class="p-sub">Nog even de basis, dan gaan de deuren open. Zodra alles klaar is, zet je je zaak online en ben je zichtbaar voor leden.</p>' +
      stappen + ronden +
      '<div class="p-melding" aria-live="polite"></div>' +
      '<div class="poort-knoprij">' +
      '<button class="p-online" data-online ' + (d.klaar ? '' : 'disabled') + '>' + (d.klaar ? 'Zet mijn zaak online' : 'Rond eerst de stappen af') + '</button>' +
      '<button class="p-sluit" data-sluit>Later</button></div>';
  }

  function meld(t) { var m = kaart && kaart.querySelector('.p-melding'); if (m) m.textContent = t || ''; }

  function open() {
    if (!waas) return;
    focusVoorOpen = document.activeElement;
    waas.hidden = false;
    verversDanRender().then(function () {
      var eerste = kaart && kaart.querySelector('button:not([disabled]),input:not([disabled]),select:not([disabled])');
      if (eerste) eerste.focus();
    });
  }
  function sluit() {
    if (waas) waas.hidden = true;
    var terug = focusVoorOpen; focusVoorOpen = null;
    if (terug && terug.isConnected && typeof terug.focus === 'function') terug.focus();
  }
  function verversDanRender() { return api('', {}).then(function (r) { render(r.d); }); }

  function klik(e) {
    var t = e.target;
    if (t.matches('[data-sluit]')) return sluit();
    if (t.matches('[data-rond]')) {
      var id = t.getAttribute('data-rond'); t.disabled = true;
      return api('/rondleiding', { id: id }).then(function (r) { if (r.ok) render(r.d); else { meld(r.d && r.d.error); t.disabled = false; } });
    }
    if (t.matches('[data-online]')) {
      t.disabled = true; meld('');
      return api('/online', { online: true }).then(function (r) {
        if (r.ok && r.d.online) { render(r.d); sluit(); toast('Je zaak staat online. Leden kunnen je nu vinden.'); }
        else { meld((r.d && r.d.error) || 'Nog niet gelukt.'); t.disabled = false; }
      });
    }
  }

  function toast(tekst) {
    var el = document.createElement('div'); el.className = 'poort-band poort-toast ds-ondernemerpoort';
    el.innerHTML = '<span><b>✓</b> ' + esc(tekst) + '</span>';
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 5000);
  }

  function bouw() {
    band = document.createElement('div'); band.className = 'poort-band ds-ondernemerpoort'; band.hidden = true;
    band.innerHTML = '<span>Je zaak staat nog <b>offline</b></span><button class="p-open" type="button">Open de poort</button>';
    band.querySelector('.p-open').addEventListener('click', open);
    waas = document.createElement('div'); waas.className = 'poort-waas ds-ondernemerpoort'; waas.hidden = true;
    kaart = document.createElement('div'); kaart.className = 'poort-kaart'; kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-modal', 'true'); kaart.setAttribute('aria-label', 'Ondernemer-poort');
    waas.appendChild(kaart);
    waas.addEventListener('click', function (e) { if (e.target === waas) sluit(); });
    waas.addEventListener('keydown', function (e) { if (e.key === 'Escape') sluit(); });
    kaart.addEventListener('click', klik);
    document.body.appendChild(band); document.body.appendChild(waas);
    // de eerste stand ophalen; bij offline meteen de poort tonen (eenmaal per sessie)
    api('', {}).then(function (r) {
      render(r.d);
      if (!r.d.online) { var al = sessionStorage.getItem('rtg_poort_gezien'); if (!al) { try { sessionStorage.setItem('rtg_poort_gezien', '1'); } catch (e) {} open(); } }
    }).catch(function () {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bouw); else bouw();
})();

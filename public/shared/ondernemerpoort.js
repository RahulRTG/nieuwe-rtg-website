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

  var esc = function (t) { return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]; }); };
  function api(pad, body) {
    return fetch('/api/supplier/poort' + pad, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + supTok }, body: JSON.stringify(body || {}) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); });
  }

  var CSS =
    '.poort-band{position:fixed;left:50%;transform:translateX(-50%);' +
    'top:calc(env(safe-area-inset-top,0px) + 3.4rem);z-index:36;max-width:min(30rem,92vw);' +
    'display:flex;align-items:center;gap:.7rem;background:#0C0C0B;border:1px solid var(--burgundy-on-dark,#C23A5E);' +
    'border-radius:999px;padding:.5rem .55rem .5rem .95rem;box-shadow:0 10px 30px rgba(0,0,0,.5);' +
    'font-family:Inter,system-ui,sans-serif;color:#F4F1EC;font-size:.84rem;}' +
    '.poort-band[hidden]{display:none;}' +
    '.poort-band b{color:var(--burgundy-on-dark,#C23A5E);font-weight:600;}' +
    '.poort-band .p-open{flex:0 0 auto;border:none;cursor:pointer;background:var(--burgundy,#7F1634);color:#fff;' +
    'font:inherit;font-weight:600;font-size:.8rem;border-radius:999px;padding:.4rem .85rem;}' +
    '.poort-band .p-open:hover{background:var(--burgundy-bright,#9E1C40);}' +
    '.poort-waas{position:fixed;inset:0;z-index:60;background:rgba(6,6,6,.72);backdrop-filter:blur(4px);' +
    'display:flex;align-items:center;justify-content:center;padding:1.2rem;}' +
    '.poort-waas[hidden]{display:none;}' +
    '.poort-kaart{width:min(34rem,100%);max-height:88vh;overflow-y:auto;background:#151312;' +
    'border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:1.4rem 1.4rem 1.2rem;' +
    'font-family:Inter,system-ui,sans-serif;color:#F4F1EC;box-shadow:0 24px 60px rgba(0,0,0,.6);}' +
    '.poort-kaart h2{font-family:"Bodoni Moda",Georgia,serif;font-weight:600;font-size:1.4rem;margin:0 0 .2rem;}' +
    '.poort-kaart .p-sub{color:#A79F92;font-size:.86rem;line-height:1.5;margin:0 0 1.1rem;}' +
    '.p-stap{display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;border-top:1px solid rgba(255,255,255,.08);}' +
    '.p-vink{flex:0 0 auto;width:1.4rem;height:1.4rem;border-radius:50%;display:flex;align-items:center;justify-content:center;' +
    'font-size:.8rem;border:1px solid rgba(255,255,255,.25);color:#8A8680;margin-top:.1rem;}' +
    '.p-stap.klaar .p-vink{background:var(--burgundy,#7F1634);border-color:var(--burgundy,#7F1634);color:#fff;}' +
    '.p-stap .p-tk{flex:1;min-width:0;}' +
    '.p-stap .p-tk b{display:block;font-weight:600;font-size:.92rem;}' +
    '.p-stap .p-tk span{display:block;color:#A79F92;font-size:.82rem;line-height:1.45;margin-top:.1rem;}' +
    '.p-stap .p-doe{flex:0 0 auto;align-self:center;border:1px solid var(--burgundy-on-dark,#C23A5E);background:transparent;' +
    'color:var(--burgundy-on-dark,#C23A5E);font:inherit;font-size:.78rem;font-weight:600;border-radius:999px;padding:.3rem .7rem;cursor:pointer;}' +
    '.p-stap .p-doe:hover{background:rgba(194,58,94,.12);}' +
    '.p-rond{margin:.5rem 0 0;background:#0C0C0B;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:.8rem 1rem;}' +
    '.p-rond h3{margin:0 0 .5rem;font-size:.95rem;font-weight:600;}' +
    '.p-rond ol{margin:0;padding-left:1.1rem;color:#CFC9BE;font-size:.85rem;line-height:1.6;}' +
    '.poort-knoprij{display:flex;gap:.6rem;margin-top:1.2rem;}' +
    '.poort-knoprij button{flex:1;border:none;cursor:pointer;font:inherit;font-weight:600;font-size:.9rem;border-radius:12px;padding:.7rem;}' +
    '.p-online{background:var(--burgundy,#7F1634);color:#fff;}' +
    '.p-online:hover{background:var(--burgundy-bright,#9E1C40);}' +
    '.p-online:disabled{background:#2a2724;color:#6b6862;cursor:not-allowed;}' +
    '.p-sluit{background:transparent;color:#CFC9BE;border:1px solid rgba(255,255,255,.2) !important;}' +
    '.p-melding{margin-top:.7rem;font-size:.82rem;color:#C23A5E;min-height:1rem;}' +
    '@media print{.poort-band,.poort-waas{display:none;}}';

  function stijl() { var s = document.createElement('style'); s.textContent = CSS; (document.head || document.documentElement).appendChild(s); }

  var band, waas, kaart, laatste = null;

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
        (r.klaar ? '' : '<div class="poort-knoprij" style="margin-top:.7rem"><button class="p-online" data-rond="' + esc(r.id) + '">Gevolgd, vink af</button></div>') +
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

  function open() { if (waas) { waas.hidden = false; verversDanRender(); } }
  function sluit() { if (waas) waas.hidden = true; }
  function verversDanRender() { api('', {}).then(function (r) { render(r.d); }); }

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
    var el = document.createElement('div'); el.className = 'poort-band'; el.style.top = 'auto';
    el.style.bottom = 'calc(env(safe-area-inset-bottom,0px) + 5rem)';
    el.innerHTML = '<span><b>✓</b> ' + esc(tekst) + '</span>';
    document.body.appendChild(el); setTimeout(function () { el.remove(); }, 5000);
  }

  function bouw() {
    stijl();
    band = document.createElement('div'); band.className = 'poort-band'; band.hidden = true;
    band.innerHTML = '<span>Je zaak staat nog <b>offline</b></span><button class="p-open" type="button">Open de poort</button>';
    band.querySelector('.p-open').addEventListener('click', open);
    waas = document.createElement('div'); waas.className = 'poort-waas'; waas.hidden = true;
    kaart = document.createElement('div'); kaart.className = 'poort-kaart'; kaart.setAttribute('role', 'dialog'); kaart.setAttribute('aria-label', 'Ondernemer-poort');
    waas.appendChild(kaart);
    waas.addEventListener('click', function (e) { if (e.target === waas) sluit(); });
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

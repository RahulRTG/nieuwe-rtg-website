(function () {
  'use strict';
  if (!location.hash.startsWith('#gast=')) return;
  const sleutel = location.hash.slice(6); // fragment gaat niet naar serverlogs of referrers
  document.body.classList.add('pr-gast');
  const el = document.createElement('main'); el.id = 'praktijkGast'; el.className = 'praktijk'; document.body.append(el);
  const e = window.RTGWerk.esc;
  // De link is een extra sleutel bij een account (eigenaarsbesluit 19 oktober 2026): eerst inloggen of gratis aanmelden, hier in het scherm.
  const deur = window.RTGAccountDeur;
  async function api(pad,b = {}) {
    const r = await fetch('/api/werk-gast/' + pad,{ method:'POST',cache:'no-store',headers:deur.kop({'Content-Type':'application/json'}),body:JSON.stringify({ ...b,sleutel }) });
    const d = await r.json(); if (r.status === 401) deur.vergeet(); if (!r.ok) throw Object.assign(new Error(d.error || 'Dit is niet gelukt.'),{ status:r.status }); return d;
  }
  async function laad() {
    await deur.eis(el,{ waarom:'Deze afspraak is met u gedeeld. Om hem te bekijken en te beantwoorden heeft u een RTG-account nodig; een gratis account is genoeg.' });
    el.textContent = 'Uw afspraak laden…';
    try {
      const d = await api('beeld');
      el.innerHTML = '<p>RTG · ' + e(d.organisatie) + '</p><h1>' + e(d.titel) + '</h1><p>' + e(d.omschrijving) + '</p><p>' + e(d.voorstel) + '</p>' +
        '<p><b>' + e(new Intl.NumberFormat(document.documentElement.lang || navigator.language,{style:'currency',currency:d.valuta}).format(d.bedragMinor/10**d.decimalen)) + '</b></p>' +
        '<p>' + e(d.stand) + (d.datum ? ' · ' + e(d.datum) + ' · ' + e(d.tijdzone) : '') + '</p><p>' + e(d.locatie) + '</p>' +
        (d.onderdelen.length ? '<h2>Onderdelen</h2><ul>' + d.onderdelen.map(t => '<li>' + e(t.titel) + ' · ' + e(t.stand) + (t.datum ? ' · ' + e(t.datum) : '') + ' · ' + e(t.herkomst) + '</li>').join('') + '</ul>' : '') +
        '<p>Deze link geeft alleen toegang tot deze afspraak. Akkoord met het voorstel is nog geen betaling.</p><div role="status"></div>' +
        window.RTGPraktijkBetalen.gast(d.betaling) +
        (d.magAntwoorden ? '<div class="pr-rij"><button class="knop p" data-keuze="akkoord">Akkoord met dit voorstel</button><button class="knop" data-keuze="afwijzen">Voorstel afwijzen</button></div>' : '');
      window.RTGPraktijkBetalen.bind(el,d,api,laad);
      el.querySelectorAll('[data-keuze]').forEach(k => k.addEventListener('click',async () => {
        const knoppen = el.querySelectorAll('button'); knoppen.forEach(b => b.disabled = true);
        try { await api('besluit',{ keuze:k.dataset.keuze,versie:d.versie }); await laad(); }
        catch (err) { el.querySelector('[role=status]').textContent = err.message; knoppen.forEach(b => b.disabled = false); }
      }));
    } catch (err) { if (err.status === 401) return laad(); el.textContent = err.message; }
  }
  laad();
})();

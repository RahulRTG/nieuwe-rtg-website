/* Presenteert zakelijk vervoer binnen het centrale designsysteem. */\n(() => {
  'use strict';
  /* Zakelijk vervoer op het RTG Design System (TRAVELOS-MIGRATIE.md, stroom
     D). Dezelfde zaakkern als ervoor: /api/supplier/mob/akkoord, /beleid en
     /zakelijk met het zaaktoken. Alleen de vorm komt nu uit /ds/, en bedragen
     volgen de taal van de gebruiker in plaats van vast nl-NL. */
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  const api = (pad, body) => fetch('/api/supplier/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const taal = () => document.documentElement.lang || 'nl';
  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('toon');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('toon'), 4600); };
  const eur = c => new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(c / 100);
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  const maak = (tag, klas, tekst) => { const e = document.createElement(tag); if (klas) e.className = klas;
    if (tekst != null) e.textContent = tekst; return e; };
  const p = (waar, tekst, klas) => { const e = maak(waar.tagName === 'UL' ? 'li' : 'p', klas || 'ds-meta', tekst); waar.appendChild(e); return e; };
  const ICOON = '<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M5 16V9l2-4h10l2 4v7M5 16h14M7 19v-3m10 3v-3M5 11h14"/></svg>';
  const DAGNAMEN = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  /* Een rij uit de lijst: icoon, titel met onderregel, en rechts een waarde of knoppen. */
  function rij(titel, sub, rechts) {
    const li = maak('li', 'ds-lijst__rij'); li.innerHTML = ICOON;
    const tekst = maak('span'); tekst.appendChild(maak('span', 'ds-lijst__titel', titel));
    if (sub) tekst.appendChild(maak('span', 'ds-lijst__tekst', sub));
    li.appendChild(tekst); li.appendChild(rechts || maak('span')); return li;
  }

  /* ---------------- de tabs ---------------- */
  const VLAKKEN = { akkoord: '#tAkkoord', beleid: '#tBeleid', overzicht: '#tOverzicht' };
  document.querySelectorAll('#tabs button').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#tabs button').forEach(x => x.setAttribute('aria-selected', String(x === b)));
    for (const [k, sel] of Object.entries(VLAKKEN)) $(sel).hidden = k !== b.dataset.tab;
    document.body.dataset.dsSchermtype = b.dataset.tab === 'beleid' ? 'taak' : 'collectie';
    /* Bij het openen van een tab meteen verse cijfers halen. Alleen de klok
       van 30 seconden laten werken betekent dat een werkgever die terugklikt
       naar "Op akkoord" een halve minuut naar een oude lijst kijkt. */
    if (b.dataset.tab === 'overzicht') haalOverzicht();
    if (b.dataset.tab === 'akkoord') haalWacht();
    if (b.dataset.tab === 'beleid') haalBeleid();
  }));

  /* ---------------- wat op akkoord wacht ---------------- */
  async function haalWacht() {
    const r = await api('akkoord', {});
    const waar = $('#lijstWacht'); leeg(waar);
    if (r.status !== 200) { p(waar, r.body.error || 'Geen toegang tot de goedkeuringen.'); return; }
    if (!(r.body.wachtend || []).length) { p(waar, r.body.uitleg || 'Er wacht niets op uw akkoord.'); return; }
    for (const w of r.body.wachtend) {
      const knoppen = maak('span', 'ds-veldgroep');
      const ja = maak('button', 'ds-knop ds-knop--primair ds-knop--klein', 'Akkoord'); ja.type = 'button';
      const nee = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'Weiger'); nee.type = 'button';
      ja.addEventListener('click', () => besluit(w.ref, true));
      nee.addEventListener('click', () => besluit(w.ref, false));
      knoppen.append(ja, nee);
      waar.appendChild(rij(w.van.label + ' → ' + w.naar.label,
        w.medewerker + ' · ' + eur(w.prijs) + ' · ' + w.km + ' km · ' + w.ritsoort +
        (w.kostenplaats ? ' · ' + w.kostenplaats : ' · zonder kostenplaats') +
        (w.drempel ? ' · drempel ' + eur(w.drempel) : ''), knoppen));
    }
  }
  async function besluit(ref, akkoord) {
    const r = await api('akkoord', { ref, akkoord });
    zeg(r.body.error || r.body.uitleg || 'Besluit genomen.');
    haalWacht();
  }


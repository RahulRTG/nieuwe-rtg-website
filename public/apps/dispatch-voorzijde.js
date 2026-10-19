/* RTG Dispatch op het RTG Design System (TRAVELOS-MIGRATIE.md par. 1b). Dit
   was het inline script van dispatch.html; de aanroepen, de zaak-inlog en de
   zinnen zijn dezelfde, alleen de vorm komt nu uit /ds/. Bedragen volgen de
   taal van de pagina via Intl. De meter per factor is een <progress>: zijn
   waarde is een attribuut en geen element.style, dus er zet geen script stijl. */
(() => {
  const $ = s => document.querySelector(s);
  const token = (() => { try { return localStorage.getItem('rtg_pda_token'); } catch (e) { return null; } })();
  const api = (pad, body) => fetch('/api/supplier/mob/' + pad, { method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body || {}) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  let meldT;
  const zeg = t => { const m = $('#melding'); m.textContent = t; m.classList.add('toon');
    clearTimeout(meldT); meldT = setTimeout(() => m.classList.remove('toon'), 4200); };
  const taal = () => document.documentElement.lang || 'nl';
  const eur = c => new Intl.NumberFormat(taal(), { style: 'currency', currency: 'EUR' }).format((Number(c) || 0) / 100);
  const leeg = el => { while (el.firstChild) el.removeChild(el.firstChild); };
  const maak = (tag, klasse, tekst) => { const e = document.createElement(tag);
    if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; };
  const ICOON = {
    rit: '<path d="M5 16V9l2-4h10l2 4v7M5 16h14M5 16v2m14-2v2M7.5 12.5h.01m9 0h.01"/>',
    wagen: '<rect x="3" y="9" width="18" height="7" rx="1"/><path d="M6 9l2-3h8l2 3M7 19v-3m10 3v-3"/>',
    papier: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5m-5 4h5"/>'
  };
  const icoon = n => '<svg class="ds-lijst__icoon" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4">' + ICOON[n] + '</svg>';
  const stil = (lijst, tekst) => lijst.appendChild(maak('li', 'ds-meta', tekst));
  /* Een rij: icoon, titel, onderregel, en rechts wat erbij hoort (knop of stand). */
  const rij = (soort, titel, sub, rechts) => {
    const li = maak('li', 'ds-lijst__rij'); li.innerHTML = icoon(soort);
    const t = maak('span'); t.appendChild(maak('span', 'ds-lijst__titel', titel));
    t.appendChild(maak('span', 'ds-lijst__tekst', sub || '')); li.appendChild(t);
    li.appendChild(rechts || maak('span'));
    return li;
  };

  /* Het voorstel van de matcher, met de rekensom zichtbaar. Dat is hier geen
     luxe: een dispatcher die niet ziet waarom de motor wagen 4 koos, gaat
     handmatig toewijzen en dan doet de motor niets meer. */
  async function toonVoorstel(ref, waar) {
    const r = await api('voorstel', { ref });
    leeg(waar);
    if (r.body.error) { waar.appendChild(maak('p', 'ds-meta', r.body.error)); return; }
    for (const k of (r.body.kandidaten || [])) {
      const d = maak('div', 'ds-paneel'); d.dataset.kandidaat = k.assetId;
      const kop = maak('div', 'ds-schermkop');
      kop.appendChild(maak('strong', 'ds-lijst__titel', k.naam + ' · score ' + k.score));
      const knop = maak('button', 'ds-knop ds-knop--primair ds-knop--klein', 'Wijs toe'); knop.type = 'button';
      knop.addEventListener('click', async () => {
        const t = await api('toewijzen', { ref, assetId: k.assetId });
        zeg(t.body.error || ('Toegewezen aan ' + k.naam + '.'));
        ververs();
      });
      kop.appendChild(knop); d.appendChild(kop);
      for (const f of k.factoren) {
        const b = maak('div', 'ds-veldlabel'); b.dataset.factor = f.naam;
        const t = maak('span', 'ds-meta'); t.appendChild(maak('b', '', f.naam));
        t.appendChild(document.createTextNode(' · ' + f.uitleg)); b.appendChild(t);
        const m = maak('progress', 'ds-voortgang');
        m.max = f.max || 1; m.value = f.max ? Math.max(0, Math.min(f.punten, f.max)) : 0;
        m.setAttribute('aria-label', f.naam + ': ' + f.punten + ' van ' + (f.max || 0));
        b.appendChild(m); d.appendChild(b);
      }
      waar.appendChild(d);
    }
    // ook wie NIET meedeed, en waarom; anders lijkt een lege lijst een storing
    for (const a of (r.body.afgewezen || [])) {
      const p = maak('p', 'ds-meta', 'niet ingezet: ' + a.naam + ' - ' + a.redenen.join('; '));
      p.dataset.afgewezen = a.naam; waar.appendChild(p);
    }
    if (!(r.body.kandidaten || []).length && !(r.body.afgewezen || []).length) {
      waar.appendChild(maak('p', 'ds-meta', 'Geen voertuigen in de vloot.'));
    }
  }

  let zaakCode = null;
  async function ververs() {
    const r = await api('dispatch');
    if (r.status !== 200) { $('#vPoort').hidden = false; $('#vBord').hidden = true; return; }
    $('#vBord').hidden = false;
    zaakCode = r.body.vervoerder;
    $('#zaakNaam').textContent = r.body.inzetbaar + ' van ' + r.body.vloot.length + ' inzetbaar';

    // openstaand, met het voorstel eronder
    const open = $('#lijstOpen'); leeg(open);
    if (!r.body.open.length) stil(open, 'Niets open.');
    for (const o of r.body.open) {
      const auto = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', 'Automatisch'); auto.type = 'button';
      auto.addEventListener('click', async () => {
        const t = await api('toewijzen', { ref: o.ref });
        zeg(t.body.error || ('Toegewezen aan ' + (t.body.gekozen ? t.body.gekozen.naam : 'een wagen') + '.'));
        ververs();
      });
      const d = rij('rit', o.van.label + ' → ' + o.naar.label,
        o.ref + ' · ' + o.ritsoort + ' · ' + o.reizigers + 'p · ' + o.km + ' km · ' + eur(o.prijs), auto);
      d.dataset.ref = o.ref;
      open.appendChild(d);
      const bak = maak('li', 'ds-paneel'); open.appendChild(bak);
      toonVoorstel(o.ref, bak);
    }

    // onderweg
    const lop = $('#lijstLopend'); leeg(lop);
    if (!r.body.lopend.length) stil(lop, 'Niets onderweg.');
    for (const o of r.body.lopend) {
      lop.appendChild(rij('rit', o.van.label + ' → ' + o.naar.label,
        o.ref + ' · ' + o.status + (o.chauffeur ? ' · ' + o.chauffeur : '') + (o.positie ? ' · live' : '')));
    }

    // de vloot: de stand staat in woorden naast de wagen, niet alleen als kleur
    const vl = $('#lijstVloot'); leeg(vl);
    if (!r.body.vloot.length) stil(vl, 'Nog geen voertuigen.');
    for (const a of r.body.vloot) {
      const d = rij('wagen', a.naam, a.categorieNaam + ' · ' + a.plaatsen + 'p' +
        (a.energieNiveau != null ? ' · ' + a.energieNiveau + '%' : '') +
        (a.inzetbaar ? '' : ' · ' + a.redenen.join('; ')),
      maak('span', 'ds-lijst__tijd', a.inzetbaar ? 'inzetbaar' : 'niet inzetbaar'));
      d.dataset.inzetbaar = a.inzetbaar ? 'ja' : 'nee';
      vl.appendChild(d);
    }

    // papieren die aandacht vragen
    const pa = $('#lijstPapieren'); leeg(pa);
    $('#papierenLeeg').hidden = r.body.papierenLet.length > 0;
    for (const a of r.body.papierenLet) {
      const tekst = (a.redenen || []).concat((a.bijnaOp || []).map(b => b.papier + ' verloopt over ' + b.dagen + ' dagen'));
      pa.appendChild(rij('papier', a.naam, tekst.join('; ')));
    }
  }

  /* De telefoonboeking. De bestemmingslijst komt uit de plekken van RTG zelf,
     dus de dispatcher kiest "Sal de Mar" en niet een adres dat hij intikt. */
  $('#knopTelefoon').addEventListener('click', async () => {
    const v = $('#telefoonVorm');
    v.hidden = !v.hidden;
    $('#knopTelefoon').setAttribute('aria-expanded', String(!v.hidden));
    document.body.dataset.dsSchermtype = v.hidden ? 'collectie' : 'taak';
    if (v.hidden || $('#telNaar').options.length > 1) return;
    const r = await api('plekken', {});
    if (r.body.error) return zeg(r.body.error);
    const sel = $('#telNaar');
    for (const p of (r.body.plekken || [])) {
      const o = maak('option', '', p.naam + (p.genre ? ' (' + p.genre + ')' : ''));
      o.value = p.soort + ':' + p.code;
      sel.appendChild(o);
    }
  });
  const plekUit = w => {
    const [soort, code] = String(w || '').split(':');
    if (soort === 'zaak') return { zaak: code };
    if (soort === 'halte') return { halte: code };
    return null;
  };
  $('#telBoek').addEventListener('click', async () => {
    const naam = $('#telNaam').value.trim();
    const naar = plekUit($('#telNaar').value);
    if (!naam) return zeg('Noteer de naam waaronder de rit staat.');
    if (!naar) return zeg('Kies een bestemming.');
    const r = await api('telefoon', { naamOpDeRit: naam, ritsoort: 'direct', categorie: 'taxi',
      van: { zaak: zaakCode }, naar });
    zeg(r.body.error || ('Opdracht ' + r.body.opdracht.ref + ' staat klaar.'));
    ververs();
  });

  if (!token) { $('#vPoort').hidden = false; return; }
  ververs();
  setInterval(ververs, 12000);
})();

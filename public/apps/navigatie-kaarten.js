/* RTG Navigatie: KAARTEN, welke gebieden RTG kan leveren en welke dit lid
   wil hebben (/api/nav/gebieden, gebied/kies, gebied/weg, gebied/pakket).

   DRIE STANDEN DIE NOOIT DOOR ELKAAR MOGEN LOPEN (kern/navigatie/gebieden.js):
   aangeboden, gebouwd en gekozen. Het scherm zet ze naast elkaar in plaats
   van er een groen vinkje van te maken, en een lid dat op een niet-gebouwde
   kaart tikt, leest dat zijn keuze het VERZOEK is. Het paneel is een dialoog
   (een systeemlaag), dus ook vanuit de poort bereikbaar. */
(() => {
  'use strict';
  const N = window.RTGNav, { $, api, zeg, token } = N;
  let kaartenStand = null, kaartenRuimte = '';
  const paneel = $('#kaartenPaneel');
  const kaartenAan = () => paneel.classList.contains('zien');
  const maak = (tag, klasse, tekst) => { const e = document.createElement(tag); if (klasse) e.className = klasse; if (tekst != null) e.textContent = tekst; return e; };

  function kaartenTeken() {
    const lijst = $('#kaartenLijst');
    const filter = String($('#kaartenFilter').value || '').trim().toLowerCase();
    lijst.textContent = '';
    if (!kaartenStand) return;
    if (kaartenStand.reden) { lijst.append(maak('p', 'leeg ds-meta', kaartenStand.reden)); return; }
    const rij = kaartenStand.gebieden.filter(g => !filter || g.naam.toLowerCase().includes(filter) || g.code.includes(filter));
    if (!rij.length) { lijst.append(maak('p', 'leeg ds-meta', filter ? 'Geen gebied met die naam.' : 'De catalogus is leeg.')); return; }
    /* Honderden landen horen niet allemaal tegelijk in de DOM; wie zoekt,
       ziet alles wat matcht. */
    for (const g of rij.slice(0, filter ? 200 : 60)) {
      const el = maak('div', 'kaartrij ds-vel__rij');
      const naam = maak('span', 'naam ds-vel__naam');
      naam.append(maak('b', null, g.naam), maak('small', null,
        g.waarom ? g.waarom : (g.licentie ? g.licentie + (g.naamsvermelding ? ' - ' + g.naamsvermelding : '') : g.code)));
      const stand = maak('span', 'stand ds-chip', g.gebouwd ? 'Gebouwd' : 'Aangeboden');
      const knop = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', g.gekozen ? 'Gekozen' : 'Kies');
      knop.type = 'button'; knop.dataset.code = g.code;
      knop.setAttribute('aria-pressed', g.gekozen ? 'true' : 'false');
      /* Een verhindering draagt altijd een reden (GRAMMATICA.md). */
      if (!g.teKiezen && !g.gekozen) { knop.disabled = true; knop.title = g.waarom || ''; }
      el.append(naam, stand, knop);
      /* De tweede knop bestaat alleen bij een GEBOUWD pakket, want alleen
         daar valt iets te halen. */
      if (g.gebouwd) {
        const t = kaartenToestel.get(g.code) || null, opHet = !!(t && t.op);
        const tk = maak('button', 'ds-knop ds-knop--stil ds-knop--klein', opHet ? 'Op dit toestel' : 'Naar toestel');
        tk.type = 'button'; tk.dataset.toestel = g.code;
        tk.setAttribute('aria-pressed', opHet ? 'true' : 'false');
        if (t && t.kan === false) { tk.disabled = true; tk.title = t.reden || ''; }
        else if (t && t.bijGebrek) tk.title = t.bijGebrek;
        else if (opHet && t.gehaaldOp) tk.title = 'Opgehaald op ' + t.gehaaldOp.slice(0, 10)
          + (t.bytes ? ' - ' + Math.round(t.bytes / 1024) + ' kB' : '')
          + (t.naamsvermelding ? ' - kaartgegevens: ' + t.naamsvermelding : '');
        el.append(tk);
      }
      lijst.append(el);
    }
    if (!filter && rij.length > 60) lijst.append(maak('p', 'leeg ds-meta', 'Nog ' + (rij.length - 60) + ' gebieden. Zoek op naam om ze te vinden.'));
  }

  /* WAT ER OP DIT TOESTEL STAAT, GEMETEN EN NIET ONTHOUDEN. De server kan dit
     niet weten, dus het scherm meet het bij elke keer openen, alleen voor
     gebouwde gebieden. */
  const kaartenToestel = new Map();
  async function toestelMeten() {
    kaartenToestel.clear();
    const P = window.RTGKaartPakket;
    if (!kaartenStand || !Array.isArray(kaartenStand.gebieden)) return;
    const gebouwd = kaartenStand.gebieden.filter(g => g.gebouwd);
    if (!P) {
      for (const g of gebouwd) kaartenToestel.set(g.code, { kan: false, op: false, reden: 'Deze pagina kan de opslag van dit toestel niet bereiken.' });
      return;
    }
    const m = P.kan();
    if (!m.ok) { for (const g of gebouwd) kaartenToestel.set(g.code, { kan: false, op: false, reden: m.reden }); return; }
    for (const g of gebouwd) {
      try { kaartenToestel.set(g.code, await P.stand(g.code)); }
      catch (e) { kaartenToestel.set(g.code, { kan: false, op: false, reden: 'De opslag is niet te lezen.' }); }
    }
  }

  async function kaartenLaad() {
    const r = await api('/api/nav/gebieden');
    if (r.status !== 200) { zeg(r.body.error || 'De kaarten zijn niet op te halen.'); return; }
    kaartenStand = r.body;
    await toestelMeten();
    const t = r.body.telling || {};
    const opDit = [...kaartenToestel.values()].filter(x => x && x.op).length;
    /* Eerst wat er IS, dan wat het toestel ervan heeft, en daarna wat de
       browser ervan belooft: opslag in een browser is niet van ons. */
    $('#kaartenUitleg').textContent = t.aangeboden
      ? t.aangeboden + ' gebieden aangeboden, ' + t.gebouwd + ' gebouwd, ' + t.gekozen + ' door u gekozen, '
        + opDit + ' op dit toestel. ' + (kaartenRuimte || r.body.opToestelWaarom || '')
      : 'De kaarten die RTG kan leveren. Kies wat u wilt hebben.';
    kaartenTeken();
  }

  /* De ruimte wordt EEN keer per opening gevraagd; `null` is onbekend en
     wordt dus niet als nul getoond. */
  async function ruimteMeten() {
    const P = window.RTGKaartPakket;
    kaartenRuimte = '';
    if (!P || !P.kan().ok) return;
    try {
      const r = await P.ruimte();
      const mb = (n) => Math.round(n / 1048576) + ' MB';
      const deel = r.quotum ? 'Van de opslag op dit toestel is ' + mb(r.gebruikt || 0) + ' van ' + mb(r.quotum) + ' in gebruik. ' : '';
      kaartenRuimte = deel + (r.blijft === true
        ? 'Uw browser bewaart deze kaarten totdat u ze weghaalt.'
        : r.blijft === false
          ? 'Uw browser mag deze kaarten opruimen als de opslag vol loopt; RTG kan dat niet beloven.'
          : 'Of uw browser deze kaarten bewaart, zegt hij niet.');
    } catch (e) { kaartenRuimte = ''; }
  }

  function kaartenDicht() {
    paneel.classList.remove('zien');
    if (paneel.open) paneel.close();
    $('#kaartenKnop').setAttribute('aria-expanded', 'false');
  }
  async function kaartenOpen() {
    if (kaartenAan()) { kaartenDicht(); return; }
    paneel.classList.add('zien');
    if (!paneel.open) paneel.showModal();
    $('#kaartenKnop').setAttribute('aria-expanded', 'true');
    await ruimteMeten();
    await kaartenLaad();
  }
  $('#kaartenKnop').addEventListener('click', kaartenOpen);
  $('#poortKaarten').addEventListener('click', kaartenOpen);
  $('#kaartenSluit').addEventListener('click', kaartenDicht);
  paneel.addEventListener('close', kaartenDicht);
  $('#kaartenFilter').addEventListener('input', kaartenTeken);

  /* DE TOESTELKNOP. Manifest vragen, delen halen, elk deel tegen zijn
     controlegetal houden en pas dan bewaren: dat zit in shared/kaartpakket.js.
     Hier staat alleen de knop, en een mislukking komt op het scherm met de
     reden van de laag zelf. */
  $('#kaartenLijst').addEventListener('click', async (e) => {
    const tk = e.target.closest('button[data-toestel]');
    if (!tk || tk.disabled) return;
    const P = window.RTGKaartPakket;
    if (!P) { zeg('Deze pagina kan de opslag van dit toestel niet bereiken.'); return; }
    const code = tk.dataset.toestel, erop = tk.getAttribute('aria-pressed') === 'true';
    tk.disabled = true;
    if (erop) {
      const uit = await P.weg(code);
      tk.disabled = false;
      zeg(uit && uit.weg ? 'De kaart staat niet meer op dit toestel.' : 'Er stond niets om weg te halen.');
      await kaartenLaad();
      return;
    }
    tk.textContent = 'Manifest...';
    const mf = await api('/api/nav/gebied/pakket', { code });
    if (mf.status !== 200) { tk.disabled = false; tk.textContent = 'Naar toestel'; zeg(mf.body.error || 'Deze kaart is niet op te halen.'); return; }
    const uit = await P.haal(code, { manifest: mf.body, token, opVoortgang: (v) => { tk.textContent = v.klaar + '/' + v.totaal; } });
    tk.disabled = false;
    if (uit.error) { tk.textContent = 'Naar toestel'; zeg(uit.error); await kaartenLaad(); return; }
    /* De naamsvermelding komt MEE op het scherm zodra de kaart er staat: ODbL
       vraagt hem zolang de gegevens er zijn. */
    zeg('De kaart van ' + code + ' staat op dit toestel (' + Math.round(uit.bytes / 1024) + ' kB). '
      + (mf.body.naamsvermelding ? 'Kaartgegevens: ' + mf.body.naamsvermelding + '. ' : '')
      + (uit.blijft === false ? 'Uw browser mag hem opruimen.' : ''));
    await ruimteMeten();
    await kaartenLaad();
  });
  $('#kaartenLijst').addEventListener('click', async (e) => {
    const knop = e.target.closest('button[data-code]');
    if (!knop || knop.disabled) return;
    const code = knop.dataset.code, gekozen = knop.getAttribute('aria-pressed') === 'true';
    knop.disabled = true;
    const r = await api(gekozen ? '/api/nav/gebied/weg' : '/api/nav/gebied/kies', { code });
    knop.disabled = false;
    if (r.status !== 200) { zeg(r.body.error || 'Dat lukte niet.'); return; }
    /* De hele stand opnieuw ophalen: de server weet of het pakket er ligt. */
    await kaartenLaad();
    if (!gekozen && r.body.wat) zeg(r.body.wat);
  });
})();

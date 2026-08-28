/* De gedeelde hulplaag van RTG Geld. Tien apps hadden elk hun eigen kopie van
   precies deze vier dingen: een api-aanroep met het lidtoken, een
   escape-functie, centen naar euro's, en een meldinkje. Tien kopieen die
   langzaam uit elkaar lopen is de fout uit LAT.md regel 4; hier staat het een
   keer, en elke stand gebruikt dit.

   Wat hier NIET in hoort: domeinkennis. Deze laag weet niet wat een saldo of
   een gift is -- hij praat met de server en maakt tekst netjes. Zodra hier
   iets over een specifiek gelddomein verschijnt, hoort dat in de stand thuis. */
(function (w, d) {
  'use strict';
  if (w.Geld) return;

  function token() {
    try { return localStorage.getItem('rtg_member_token'); } catch (e) { return null; }
  }

  /* VOLLE paden ('/api/bank/overzicht'), geen voorvoegsel. De tien standen
     praten met vijf verschillende routefamilies (wallet, bank, wbw, labfonds,
     rechterhand, metier); een gedeeld voorvoegsel zou hier een leugen zijn. */
  async function api(pad, body) {
    const r = await fetch(pad, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token() || '') },
      body: JSON.stringify(body || {})
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const e = new Error(data.error || 'Er ging iets mis.');
      e.status = r.status; e.data = data;
      throw e;
    }
    return data;
  }

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

  /* Centen worden hier EEN keer euro's. De kernen sturen centen rauw door;
     twee afrondlagen zijn een cent verschil die niemand kan verklaren. */
  function euro(centen) {
    const c = Math.round(Number(centen) || 0);
    return (c < 0 ? '−' : '') + '€ ' +
      (Math.abs(c) / 100).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* En de weg terug: wat een lid intikt, EEN keer naar centen. Hier stond
     eerst in elke stand een eigen regeltje `parseFloat(v.replace(',', '.'))`,
     en dat leest de Nederlandse schrijfwijze verkeerd: bij ons is de punt het
     DUIZENDTALTEKEN en de komma de decimaal, dus "1.000" werd een euro in
     plaats van duizend. In een beleidscherm zet dat een minimumbuffer duizend
     keer te laag, zonder een woord van waarschuwing, en Rahul rekent daarna
     met die drempel.

     Punten tussen groepen van drie zijn duizendtallen en gaan eruit; een
     komma is de decimaal. Een punt met een of twee cijfers erachter (1.50)
     laten we ook als decimaal gelden, want zo tikt een deel van de mensen
     het, en dubbelzinnig is het niet: 1.500 is duizendvijfhonderd, 1.50 is
     anderhalve euro. Onleesbaar levert null op, en null is geen nul: de
     aanroeper hoort erom te vragen in plaats van stil met nul te rekenen. */
  function naarCenten(v) {
    const s = String(v == null ? '' : v).trim().replace(/^€\s*/, '');
    if (!/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$|^\d+(?:[.,]\d{1,2})?$/.test(s)) return null;
    const punten = (s.match(/\.\d{3}(?!\d)/g) || []).length > 0;
    const kaal = punten ? s.replace(/\./g, '') : s;
    const [heel, deel] = kaal.replace(',', '.').split('.');
    const c = Number(heel) * 100 + Number((deel || '0').padEnd(2, '0'));
    return Number.isFinite(c) ? c : null;
  }

  function datum(dd) {
    const x = new Date(String(dd || '').slice(0, 10) + 'T00:00:00');
    if (isNaN(x)) return String(dd || '');
    return x.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  let meldT = null;
  function melding(t) {
    let el = d.getElementById('geldMelding');
    if (!el) {
      el = d.createElement('div');
      el.id = 'geldMelding';
      el.setAttribute('role', 'status');
      el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:5rem;z-index:70;' +
        'background:#151312;border:1px solid var(--gold-rand,rgba(192,165,68,.5));border-radius:0;' +
        'color:var(--rtg-txt,#F4F0E9);font:500 .84rem/1.4 var(--rtg-interface,Inter,system-ui,sans-serif);' +
        'padding:.55rem .95rem;max-width:92vw;display:none;';
      d.body.appendChild(el);
    }
    el.textContent = String(t || '');
    el.style.display = 'block';
    clearTimeout(meldT);
    meldT = setTimeout(() => { el.style.display = 'none'; }, 2600);
  }

  w.Geld = { token, api, esc, euro, naarCenten, datum, melding };
})(window, document);

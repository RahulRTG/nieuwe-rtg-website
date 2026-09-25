/* De veegronde van de betaalwaarheid (MONEY-012, de inkomende kant).

   Een inkomende betaling kan blijven hangen zonder dat iemand het ziet: het
   antwoord van de provider raakte kwijt (RTG kent geen providerreferentie, maar
   de kaart kan al belast zijn), of de provider meldde "in behandeling" en de
   webhook kwam nooit. Vóór deze ronde bleef zo'n betaling eeuwig staan -- of,
   in het oude kaartWachtend, werd hij boven de 20.000 rijen stil gewist.

   Deze ronde vraagt het opnieuw aan de provider, met DEZELFDE sleutel en
   DEZELFDE aanbieder als de eerste keer (`r.start`, vastgelegd vóór de externe
   aanroep). Een herhaling is daardoor een opzoeking en geen tweede betaling:
   had de provider hem al, dan krijgt RTG dezelfde betaling terug; had hij hem
   niet, dan wordt de oorspronkelijke opdracht van de klant alsnog precies een
   keer uitgevoerd.

   Twee dingen doet hij met opzet NIET:
     - een betaling starten die nooit is aangeboden (geen PROVIDER_START). Dan
       is er geen geld bewogen, en een machine die zelf een betaling begint
       namens iemand die afhaakte, beslist iets wat niet van haar is;
     - een betaling wissen of opgeven. Na MAX pogingen zonder uitsluitsel krijgt
       hij een ESCALATIE: zichtbaar in het overzicht, voor een mens. De stand
       blijft wat hij was, want "wij weten het niet" is geen "niet betaald". */
'use strict';

const WACHT_MS = Object.freeze([10 * 60 * 1000, 30 * 60 * 1000, 2 * 3600 * 1000, 6 * 3600 * 1000, 12 * 3600 * 1000, 24 * 3600 * 1000]);
const MAX = WACHT_MS.length;

module.exports = function maakHervat(ctx) {
  const { doos, save, nuIso, gebeurtenis, STATUS, definitiefBetaald, log } = ctx;
  const tijdVan = w => { const n = typeof w === 'number' ? w : Date.parse(String(w || '')); return Number.isFinite(n) ? n : 0; };
  const gestart = r => !!(r.providerId || (r.gebeurtenissen || []).some(g => g.soort === 'PROVIDER_START'));
  const onbekend = r => !r.providerId && gestart(r) && !definitiefBetaald(r.status);
  const WACHTEND = new Set([STATUS.AANGEMAAKT, STATUS.WACHT_OP_KLANT, STATUS.IN_BEHANDELING]);

  function magHervatten(r, grens) {
    if (!r || !WACHTEND.has(r.status) || r.escalatie || !gestart(r)) return false;
    const volgende = r.hervatVolgendeAt ? tijdVan(r.hervatVolgendeAt) : tijdVan(r.bijgewerktAt) + WACHT_MS[0];
    return volgende <= grens;
  }

  async function hervat({ begin, tot, limiet } = {}) {
    const grens = Number.isFinite(tot) ? tot : tijdVan(tot || nuIso());
    const lijst = Object.values(doos()).filter(r => magHervatten(r, grens))
      .slice(0, Math.min(100, Math.max(1, Number(limiet) || 25)));
    let afgerond = 0, wachtNog = 0, geescaleerd = 0;
    for (const r of lijst) {
      let fout = null;
      try { await begin(r.id, Object.assign({}, r.start || {}, { hervat: true })); }
      catch (e) { fout = e; }
      if (!WACHTEND.has(r.status)) { afgerond++; continue; }
      const n = (Number(r.hervatPogingen) || 0) + 1;
      r.hervatPogingen = n;
      if (n >= MAX) {
        r.escalatie = { at: nuIso(), status: r.status, onbekend: onbekend(r),
          reden: 'geen uitsluitsel van de provider na ' + n + ' hervattingen' +
            (fout ? ' (laatste fout: ' + String(fout.message || fout).slice(0, 120) + ')' : '') };
        gebeurtenis(r, 'ESCALATIE', { reden: r.escalatie.reden });
        geescaleerd++;
        if (log && log.warn) log.warn('betaalwaarheid: escalatie, een mens moet dit afstemmen', { id: r.id, status: r.status });
      } else {
        r.hervatVolgendeAt = new Date(grens + WACHT_MS[n]).toISOString();
        wachtNog++;
      }
      save();
    }
    return { bekeken: lijst.length, afgerond, wachtNog, geescaleerd };
  }

  /* Wat er nog niet rond is, voor de reconciliatie. Per stand, plus de twee
     die ertoe doen: onbekend (misschien belast, geen referentie) en escalatie. */
  function openstaand() {
    const uit = { aantal: 0, centen: 0, perStatus: {}, onbekend: 0, onbekendeCenten: 0,
      escalatie: 0, controleNodig: 0, oudsteAt: null };
    for (const r of Object.values(doos())) {
      if (!r) continue;
      if (r.status === STATUS.CONTROLE_NODIG) uit.controleNodig++;
      if (!WACHTEND.has(r.status) || !gestart(r)) continue;
      uit.aantal++; uit.centen += r.centen;
      uit.perStatus[r.status] = (uit.perStatus[r.status] || 0) + 1;
      if (onbekend(r)) { uit.onbekend++; uit.onbekendeCenten += r.centen; }
      if (r.escalatie) uit.escalatie++;
      if (!uit.oudsteAt || r.aangemaaktAt < uit.oudsteAt) uit.oudsteAt = r.aangemaaktAt;
    }
    return uit;
  }

  return { hervat, openstaand, onbekend };
};

module.exports.WACHT_MS = WACHT_MS;

/* De startopties die een hervatting nodig heeft om DEZELFDE betaling op te
   zoeken. Alleen velden die ertoe doen, en zonder lege waarden: undefined gaat
   niet naar de provider. */
module.exports.startVan = function startVan(o) {
  const uit = {};
  for (const k of ['aanbieder', 'methode', 'omschrijving', 'returnUrl', 'webhookUrl', 'bestemming'])
    if (o && o[k]) uit[k] = o[k];
  return uit;
};

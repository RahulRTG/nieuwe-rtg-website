/* EEN GRENS AAN WAT IEMAND MAG VERBRUIKEN -- en hij weigert echt.

   Een waarschuwing die nergens bijt, is een getal op een scherm. Deze grens
   doet twee dingen die van elkaar verschillen:

     waarschuwCenten   erboven staat er een melding bij het verbruik. Er
                       verandert niets aan wat er wel en niet kan.
     plafondCenten     erboven gaat de AI-weg DICHT voor deze gebruiker. Niet
                       de hele app: alles blijft werken in de regelgestuurde
                       werkmodus die dit huis toch al heeft voor als er geen
                       model is. Dat is het verschil tussen een grens en een
                       storing.

   TWEE SLOTEN, EN DE STRENGSTE WINT. Een lid kan een grens voor zichzelf
   zetten; het kantoor kan er een zetten voor een gebruiker (fair use). Die twee
   staan apart, want ze betekenen iets anders: het eerste is iemand die zijn
   eigen uitgaven in de hand houdt, het tweede is een afspraak van het huis. Een
   lid dat de kantoorgrens zou kunnen ophogen, heeft geen kantoorgrens.

   STANDAARD IS ER GEEN GRENS, en dat is met opzet. Geen grens ingesteld
   betekent geen grens -- niet "een standaardplafond dat wel meevalt". Een
   ingebouwd plafond dat niemand heeft gekozen, gaat op de dag dat het bijt over
   voor een storing.

   HET PLAFOND KIJKT NAAR WAT IEMAND TOT NU TOE DEZE MAAND KOST, inclusief het
   toegerekende deel. Dat laatste is een schatting, en dat staat in het antwoord:
   een deur die dichtgaat op een vermoeden hoort dat te zeggen. */
'use strict';

const MAX_CENTEN = 100000000;   // een miljoen euro: grens op het doel

module.exports = (ctx) => {
  const { d, save, nu, meter, overzicht } = ctx;

  function bak() {
    const k = d();
    if (!k.grenzen || typeof k.grenzen !== 'object') k.grenzen = {};
    return k.grenzen;
  }
  const rij = (drager) => bak()[String(drager || '')] || null;

  const bedrag = (x) => {
    if (x == null || x === '') return null;
    const n = Math.round(Number(x));
    return Number.isFinite(n) && n > 0 && n <= MAX_CENTEN ? n : undefined;   // undefined = ongeldig
  };

  function grensVoor(drager) {
    const r = rij(drager) || {};
    const slot = (s) => r[s] ? { waarschuwCenten: r[s].waarschuwCenten, plafondCenten: r[s].plafondCenten,
      gezetOp: r[s].gezetOp, door: r[s].door } : null;
    const zelf = slot('zelf'), kantoor = slot('kantoor');
    /* De strengste van de twee, per veld apart. Een kantoorplafond met een lagere
       eigen waarschuwing hoort allebei te gelden; wie er een van de twee laat
       vallen omdat de ander strenger is, gooit informatie weg. */
    const strengst = (veld) => {
      const a = zelf && zelf[veld], b = kantoor && kantoor[veld];
      if (a == null) return b == null ? null : { centen: b, door: 'kantoor' };
      if (b == null) return { centen: a, door: 'zelf' };
      return a <= b ? { centen: a, door: 'zelf' } : { centen: b, door: 'kantoor' };
    };
    return { drager, zelf, kantoor,
      waarschuw: strengst('waarschuwCenten'), plafond: strengst('plafondCenten') };
  }

  function grensZet(drager, { waarschuwCenten, plafondCenten }, slot, wie) {
    const dr = String(drager || '').trim();
    if (!dr) return { status: 400, error: 'Geen gebruiker opgegeven.' };
    if (slot !== 'zelf' && slot !== 'kantoor') return { status: 400, error: 'Een grens is van het lid zelf of van het kantoor.' };
    const w = bedrag(waarschuwCenten), p = bedrag(plafondCenten);
    if (w === undefined || p === undefined) return { status: 400, error: 'Geen geldig bedrag in centen.' };
    if (w == null && p == null) {
      const r = rij(dr);
      if (r) { delete r[slot]; save(); }
      return { status: 200, ok: true, grens: grensVoor(dr), weg: true };
    }
    if (w != null && p != null && w > p) {
      return { status: 400, error: 'De waarschuwing ligt boven het plafond; dan waarschuwt hij pas als de deur al dicht is.' };
    }
    const naam = String(wie || '').trim().slice(0, 80);
    if (!naam) return { status: 400, error: 'Zonder wie gebeurt dit niet.' };
    const r = bak()[dr] || (bak()[dr] = {});
    r[slot] = { waarschuwCenten: w, plafondCenten: p, gezetOp: nu(), door: naam };
    save();
    return { status: 200, ok: true, grens: grensVoor(dr) };
  }

  /* De stand van NU: hoeveel staat er, en wat betekent dat. Geeft altijd een
     antwoord, ook zonder grens -- dan is de stand 'geen-grens' en niet 'ruim',
     want die twee zijn niet hetzelfde. */
  function stand(drager) {
    const p = meter.periodeVan();
    const g = grensVoor(drager);
    const o = overzicht.voorDrager(p, drager);
    const nuCenten = o.totaal.centen;
    const basis = { drager, periode: p, verbruiktCenten: nuCenten, graad: o.totaal.graad,
      waarschuw: g.waarschuw, plafond: g.plafond,
      /* De deur kan dichtgaan op een bedrag waar een SCHATTING in zit (het
         toegerekende deel). Dat hoort erbij te staan, want een weigering op een
         vermoeden is iets anders dan een weigering op een meting. */
      zegtNiet: o.totaal.graad === 'vermoed'
        ? 'In dit bedrag zit een toegerekend deel; dat is een verdeling van een nota en geen meting.' : null };
    if (g.plafond && nuCenten >= g.plafond.centen) {
      return Object.assign(basis, { stand: 'dicht', ok: false,
        uitleg: 'Het verbruik van deze maand (' + (nuCenten / 100).toFixed(2) + ' euro) heeft het plafond van ' +
          (g.plafond.centen / 100).toFixed(2) + ' euro bereikt. De AI-weg staat dicht tot de volgende maand of tot de grens wordt verzet.' });
    }
    if (g.waarschuw && nuCenten >= g.waarschuw.centen) {
      return Object.assign(basis, { stand: 'waarschuwing', ok: true,
        uitleg: 'Het verbruik van deze maand ligt boven de ingestelde waarschuwing. Er verandert niets aan wat er kan.' });
    }
    return Object.assign(basis, { stand: g.plafond || g.waarschuw ? 'ruim' : 'geen-grens', ok: true, uitleg: null });
  }

  /* Voor de AI-weg (server/ai.js, via kern/kosten/haak.js). Zo licht mogelijk:
     zonder grens is dit een kaartopzoeking en verder niets, want deze functie
     zit in het pad van ELKE modelaanroep. */
  function magUitgeven(drager) {
    const g = grensVoor(drager);
    if (!g.plafond) return { ok: true };
    return stand(drager);
  }

  return { grensVoor, grensZet, stand, magUitgeven, MAX_CENTEN };
};

/* WAT EEN TREDE AAN AI BEVAT, EN WAT JE ERBIJ KUNT KOPEN.

   ../tegoed.js is de administratie: wat is er deze maand verbruikt, mag deze
   aanroep nog, wat gebeurt er aan het plafond. Dit bestand is het PRODUCT: de
   tabellen die zeggen wat een trede bevat en welke bundels er bestaan. Twee
   onderwerpen -- de een verandert als het aanbod verandert, de ander als de
   boekhouding verandert -- en ze horen niet in een bestand.

   EEN KLANT KOOPT CAPACITEIT, GEEN MODEL. Daarom staat er in geen enkele tabel
   hier een modelnaam of een tokenaantal: alleen credits en een omschrijving.
   "AI-tegoed deze maand: 72% gebruikt" is wat een mens te zien krijgt, nooit
   "je hebt nog 1.293.582 tokens".

   NUL EN NULL ZIJN NIET HETZELFDE. Nul betekent: deze trede heeft geen
   AI-tegoed, en dan is `mag()` altijd nee. `null` betekent contractueel -- de
   hoogte staat op het contract, en die staat hier dus niet.

   DE PRIJS VAN EEN BUNDEL ONTBREEKT MET OPZET. Die wordt gerekend uit de
   inkoopkant (./bundelprijs.js); een verzonnen bedrag hier zou precies de fout
   zijn die PRIJZEN.md par. 4.12 beschrijft. */
'use strict';

/* Het inbegrepen tegoed per trede, in credits per maand. Nul betekent: deze
   trede heeft geen AI-tegoed, en dan is `mag()` altijd nee -- niet "onbeperkt".
   `null` betekent contractueel: de hoogte staat op het contract. */
const INBEGREPEN = {
  gratis: 0,
  rtg: 2000,
  'business-lite': 20000,
  business: null,        // contractueel
  lifestyle: null        // contractueel
};

/* De bundels. Alleen capaciteit en een naam -- geen model, geen tokens. De
   prijs ontbreekt met opzet: die wordt gerekend uit de inkoopkant, en die laag
   bestaat nog niet. Een verzonnen bedrag hier zou precies de fout zijn die
   PRIJZEN.md par. 4.12 beschrijft. */
const BUNDELS = {
  'ai-s': { id: 'ai-s', naam: 'AI Extra S', credits: 5000, wat: 'een kleine aanvulling' },
  'ai-m': { id: 'ai-m', naam: 'AI Extra M', credits: 20000, wat: 'een normale zakelijke aanvulling' },
  'ai-l': { id: 'ai-l', naam: 'AI Extra L', credits: 100000, wat: 'zwaar gebruik' },
  'ai-xl': { id: 'ai-xl', naam: 'AI Enterprise', credits: null, wat: 'overeengekomen capaciteit' }
};

const BELEID = { STOP: 'STOP', VRAAG_MIJ: 'VRAAG_MIJ', AUTO_AANVULLEN: 'AUTO_AANVULLEN', CONTRACT: 'CONTRACT' };

// bij welk deel van het tegoed er gewaarschuwd wordt
const WAARSCHUWING = 0.8;

function inbegrepenVoor(pas) {
  const v = INBEGREPEN[String(pas || '')];
  return v === undefined ? 0 : v;
}

module.exports = { INBEGREPEN, BUNDELS, BELEID, WAARSCHUWING, inbegrepenVoor };

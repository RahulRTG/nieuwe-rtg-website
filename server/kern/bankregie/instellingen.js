/* Bankregie, deel "instellingen": de getallen waarmee de bank rekent -- de
   spaarrente, de standaard rood-staan-ruimte en de tarieven.

   Bewust naast de drie-standen-knop en niet erin. De knop verandert WAT RTG
   Bank is (en vraagt daarom vier ogen en een vergunning); dit verandert wat hij
   REKENT, en dat is dagelijks werk. Elke waarde heeft hier een bovengrens: een
   spaarrente of een tarief dat per ongeluk een factor honderd te hoog staat is
   geen instelling maar een storing. Krijgt de gedeelde ctx van
   kern/bankregie/index.js. */
'use strict';

const RENTE_BP_MAX = 2000;         // spaarrente tot 20% (basispunten); ruim, RTG stelt in
const ROOD_MAX_CENTEN = 5000000;   // rood staan tot 50.000 euro als bovengrens
const FOOI_MAX_CENTEN = 100000;    // een tarief is nooit meer dan 1000 euro

module.exports = (ctx) => {
  const { d, save } = ctx;

  function instellingenZet({ spaarrenteBp: rente, roodLimietEuro, tarieven }) {
    const b = d();
    if (rente != null) {
      const bp = Math.round(Number(rente));
      if (!Number.isFinite(bp) || bp < 0 || bp > RENTE_BP_MAX) return { status: 400, error: 'De spaarrente moet tussen 0 en 20% liggen.' };
      b.spaarrenteBp = bp;
    }
    if (roodLimietEuro != null) {
      const centen = Math.round(Number(roodLimietEuro) * 100);
      if (!Number.isFinite(centen) || centen < 0 || centen > ROOD_MAX_CENTEN) return { status: 400, error: 'De rood-staan-limiet moet tussen 0 en 50.000 euro liggen.' };
      b.roodLimietCenten = centen;
    }
    if (tarieven && typeof tarieven === 'object') {
      for (const naam of ['sepaUitCenten', 'spoedCenten', 'passenCenten']) {
        if (tarieven[naam] == null) continue;
        const c = Math.round(Number(tarieven[naam]));
        if (!Number.isFinite(c) || c < 0 || c > FOOI_MAX_CENTEN) return { status: 400, error: 'Een tarief moet tussen 0 en 1000 euro liggen.' };
        b.tarieven[naam] = c;
      }
    }
    save();
    return { ok: true, spaarrenteBp: b.spaarrenteBp, roodLimietCenten: b.roodLimietCenten, tarieven: { ...b.tarieven } };
  }

  return { instellingenZet };
};

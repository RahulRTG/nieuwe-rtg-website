/* DE PERSOONLIJKE BETAALCODE -- een ondoorzichtige verwijzing, geen naam.

   WAAROM. De Betaalcode-stand belooft "je persoonlijke code", maar elke
   ledencode was `pas|RTG`: een kassa wist dat het een RTG-pas was en niet van
   wie (scripts/lib/voltooi/rtgcode.js, open stap). De codenaam IN de code zetten
   kan niet: het lijf van een RTG1-token is base64 en dus leesbaar voor elke
   QR-lezer, en een codenaam naast een gezicht aan de kassa is precies wat de
   codenamen moeten voorkomen.

   BESLUIT VAN DE EIGENAAR (19 oktober 2026, optie b): elke code draagt een
   willekeurige, kortlevende verwijzing (128 bits). Alleen de server koppelt die
   aan de codenaam, hier, met een verlooptijd. Wie scant krijgt wat hij nodig
   heeft en niets meer: een kassa (zaak, personeel, kantoor) de codenaam om af
   te rekenen -- en daarmee is de code op, want EENMALIG is het veilige voor
   betalen; een ander lid niets persoonlijks.

   DUURZAAM, want een verwijzing die een herstart niet overleeft is een code die
   het scherm toont en de kassa weigert, en een verbruik dat een crash niet
   overleeft is een code die twee keer betaalt. */
'use strict';

const BEWAAR_NA_VERVAL_MS = 10 * 60000; // daarna ruimen: de code is toch al dood

module.exports = function maakBetaalcode({ db, save, bijeen, inBundel, crypto }) {
  const vastleggen = require('../lib/duurzaam')({ bijeen, save, inBundel, bron: 'betaalcode' });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/betaalcode', bezit: { betaalcodes: 'kaart' } });

  /* Een nieuwe verwijzing voor deze codenaam, geldig tot `exp`. */
  async function geef(codenaam, exp) {
    if (!codenaam) return { status: 403, error: 'Voor een persoonlijke code hoort een account bij deze sessie.' };
    const ref = crypto.randomBytes(16).toString('base64url');
    const mis = await vastleggen(() => {
      const bak = eigen.bak('betaalcodes');
      const grens = Date.now() - BEWAAR_NA_VERVAL_MS;
      for (const [k, v] of Object.entries(bak)) if (!v || v.exp < grens) delete bak[k];
      bak[ref] = { codenaam, exp, gebruikt: null };
    });
    return mis || { ok: true, ref };
  }

  /* Lezen zonder verbruik: bestaat hij, en is hij nog geldig? */
  function lees(ref) {
    const r = eigen.kijk('betaalcodes')[String(ref || '')];
    if (!r) return { status: 422, error: 'Dit is geen geldige RTG-code.' };
    if (Date.now() > r.exp) return { status: 410, error: 'Deze code is verlopen. Laat een verse code tonen.' };
    if (r.gebruikt) return { status: 409, error: 'Deze code is al gebruikt. Laat een verse code tonen.' };
    return { ok: true, record: r };
  }

  /* Verbruiken door een kassa: de controle en het merkteken in EEN synchrone
     mutatie, zodat twee kassa's die tegelijk scannen niet allebei slagen. */
  async function verbruik(ref, door) {
    let uit = null;
    const mis = await vastleggen(() => {
      const l = lees(ref);
      if (!l.ok) { uit = l; return; }
      l.record.gebruikt = { at: Date.now(), door: String(door || 'kassa').slice(0, 40) };
      uit = { ok: true, codenaam: l.record.codenaam };
    });
    return mis || uit;
  }

  return { betaalcode: { geef, lees, verbruik } };
};

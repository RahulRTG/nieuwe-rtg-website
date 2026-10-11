/* DE AUTORISATIE-AS VAN DE VRIJGAVEPOORT: mag RTG dit?

   Twee bronnen, en een capability kan er beide eisen (./register.js
   `bevoegdheid`): een VERMOGEN uit de bevoegdheidslaag (kern/bevoegdheid/, wat er
   in de boardroom over vergunningen en rails is vastgelegd) en een vastgelegd
   extern BESLUIT (./besluiten.js, met bron en hash in ./stand.js). Ontbreekt de
   bevoegdheidslaag, dan is het antwoord nee -- niet "dan maar ja".

   `sandboxActief` (./oordeel.js): de capability staat in een sandbox die hier
   MAG (./lokaal.js) en werkt op een rail zonder echt geld. Alleen dan valt een
   besluit weg dat een CONTRACT MET EEN ECHTE PROVIDER is (./besluiten.js
   PROVIDERCONTRACT): op een neprail bestaat die provider niet. Het vermogen en
   een besluit over RTG zelf (B3) blijven ook dan gevraagd. */
'use strict';
const { PROVIDERCONTRACT } = require('./besluiten');

module.exports = function maakAutorisatie({ st, k }) {
  return function autorisatie(cap, ctx, sandboxActief) {
    const b = cap.bevoegdheid || {};
    const delen = [];
    if (b.vermogen) {
      if (!k.bevoegd || typeof k.bevoegd.mag !== 'function')
        return { ok: false, code: 'niet-geautoriseerd', reden: 'bevoegdheidslaag-niet-gekoppeld' };
      let o;
      try { o = k.bevoegd.mag(b.vermogen, ctx.land ? { land: ctx.land } : {}); } catch (e) { o = null; }
      if (!o || o.mag !== true)
        return { ok: false, code: 'niet-geautoriseerd', reden: 'bevoegdheid:' + b.vermogen + ':' + ((o && o.reden) || 'onbekend') };
      delen.push('bevoegdheid:' + b.vermogen + ':' + (o.via || 'ja'));
    }
    if (b.besluit && sandboxActief === true && PROVIDERCONTRACT.includes(b.besluit)) {
      delen.push('besluit:' + b.besluit + ':niet-van-toepassing-op-neprail');
    } else if (b.besluit) {
      const vast = st.besluit(b.besluit);
      if (!vast) return { ok: false, code: 'compliance-ontbreekt', reden: 'besluit-ontbreekt:' + b.besluit };
      delen.push('besluit:' + b.besluit);
    }
    return { ok: true, reden: delen.join(',') };
  };
};

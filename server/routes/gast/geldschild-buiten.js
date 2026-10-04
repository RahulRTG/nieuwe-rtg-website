/* Het Geldschild naast een bestelling voor bezorgen of afhalen: legt het
   bedrag naast de geldplanning van een lid. Het signaleert alleen; betalen
   blijft de keuze van het lid, en uit een onvolledig beeld komt geen bedrag.
   Afgesplitst uit ./betalen-buiten.js, dat tegen de omvanggrens aan zat. */
'use strict';

const { NIVEAUS } = require('../../kern/geldbeleid/regels');

module.exports = function maakGeldschild(geldgraaf) {
  return function geldschildVan(req, centen) {
    if (!geldgraaf || req.session.tier === 'guest') return {
      niveau: 'onbeschikbaar', icoon: '◷', titel: 'Geldschild voor leden',
      uitleg: 'Log in als lid om deze bestelling naast je eigen geldplanning te leggen.' };
    try {
      const c = geldgraaf.cockpit(req.session.key);
      const stil = Array.isArray(c.stil) ? c.stil : [];
      const vrij = c.cijfers && Number(c.cijfers.vrijCenten);
      const einde = c.cijfers && Number(c.cijfers.eindeMaandCenten);
      const onvolledig = stil.length > 0 || !Number.isFinite(vrij);
      const aandacht = !onvolledig && (centen > vrij || (c.uitzonderingen || []).some(x => x.niveau === NIVEAUS.klaarzetten));
      return { niveau: onvolledig ? 'onvolledig' : aandacht ? 'aandacht' : 'rust',
        icoon: onvolledig ? '◷' : aandacht ? '!' : '✓',
        titel: onvolledig ? 'Beeld nog niet compleet' : aandacht ? 'Even bewust bekijken' : 'Past binnen je vrije ruimte',
        uitleg: onvolledig ? 'Niet alle geldbronnen zijn bereikbaar. RTG doet daarom geen stellige belofte.'
          : aandacht ? 'Je bevestigt altijd zelf; het Geldschild signaleert alleen.'
          : 'Na deze bestelling blijft er volgens de huidige geldbronnen vrije ruimte over.',
        // Toon alleen bedragen als alle bronnen compleet zijn. Een rekenkundig
        // getal uit een onvolledig beeld lijkt anders ten onrechte zekerheid.
        vrijNaCenten: !onvolledig && !aandacht && Number.isFinite(vrij) ? vrij - centen : null,
        eindeMaandNaCenten: !onvolledig && !aandacht && Number.isFinite(einde) ? einde - centen : null,
        vrijeRuimteCenten: !onvolledig && aandacht && Number.isFinite(vrij) ? Math.max(0, vrij) : null,
        verschilCenten: !onvolledig && aandacht && Number.isFinite(vrij) ? Math.max(0, centen - vrij) : null,
        bronnenCompleet: !onvolledig };
    } catch (e) {
      return { niveau: 'onvolledig', icoon: '◷', titel: 'Geldschild tijdelijk onvolledig',
        uitleg: 'Betalen blijft jouw keuze. Er wordt geen zekerheid verzonnen.' };
    }
  };
};

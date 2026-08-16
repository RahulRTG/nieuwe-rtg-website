'use strict';

/* Alleen de aparte HTTP-route gebruikt dit. Pad en body komen uit het
   servervoorstel, zodat een client ze na menselijke controle niet kan
   verwisselen. Het Symbol kan niet uit JSON of een model-call worden gemaakt. */
module.exports = ({ goedkeuring, stuurRoep, interneGoedkeuring }) =>
  async function stuurBevestig(req, id, wereld) {
    const vast = goedkeuring.neem(req, id, wereld);
    if (vast.error) return vast;
    return stuurRoep(req, vast.voorstel.pad, vast.voorstel.body, {
      wereld: vast.voorstel.wereld,
      goedgekeurd: interneGoedkeuring
    });
  };

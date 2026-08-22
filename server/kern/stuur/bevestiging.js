'use strict';
const { maakBon } = require('./bon');
const { beleidVoor } = require('./beleid');

/* Alleen de aparte HTTP-route gebruikt dit. Pad en body komen uit het
   servervoorstel, zodat een client ze na menselijke controle niet kan
   verwisselen. Het Symbol kan niet uit JSON of een model-call worden gemaakt.

   EN ELKE BEVESTIGDE HANDELING KRIJGT EEN BON (FABRIC.md par. 3.8): wat er is
   gebeurd, waarom het mocht, wat de bewijsstand eronder was, en wat we NIET
   hebben gemeten. De bon hangt naast de uitkomst en verandert er niets aan --
   een bestaande client die alleen `status` en `antwoord` leest, merkt hem niet
   eens. Bij een fout van de goedkeuring zelf (verlopen, andere sessie) is er
   geen handeling geweest en dus ook geen bon: een bon voor iets dat niet is
   gebeurd, is precies het soort papier dat vertrouwen ondermijnt. */
module.exports = ({ goedkeuring, stuurRoep, interneGoedkeuring }) =>
  async function stuurBevestig(req, id, wereld) {
    const vast = goedkeuring.neem(req, id, wereld);
    if (vast.error) return vast;
    const uitkomst = await stuurRoep(req, vast.voorstel.pad, vast.voorstel.body, {
      wereld: vast.voorstel.wereld,
      goedgekeurd: interneGoedkeuring
    });
    const bon = maakBon({
      pad: vast.voorstel.pad,
      wereld: vast.voorstel.wereld,
      niveau: beleidVoor(vast.voorstel.pad, vast.voorstel.wereld).niveau,
      voorstelId: id,
      status: uitkomst && uitkomst.status
    });
    return Object.assign({}, uitkomst, { bon });
  };

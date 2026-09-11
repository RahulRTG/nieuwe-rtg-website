/* DE BRONNEN VAN DE REISWERELD (hoort bij kern/reiswereld.js).

   Welk domein welke rij levert. Dat is iets anders dan wat de wereld met die
   rijen doet -- sorteren, oordelen, tellen -- en sinds de Invoerbalie erbij
   kwam past het ook niet meer in één bestand.

   Twee regels gelden hier voor elke bron, en ze staan allebei in wereldkern.js
   uitgelegd: een bron die stukgaat mag de andere niet meenemen EN mag niet stil
   verdwijnen (zijn naam belandt in `stil` en reist door tot op het scherm), en
   elke rij draagt zijn HERKOMST mee -- de bron weet waar de rij vandaan komt en
   de lagen erboven niet (REIZEN.md par. 2.2). */
'use strict';

/* De bronnen staan per HERKOMST in een eigen bestand -- de naad die elke rij
   toch al draagt -- en dit bestand roept ze in de vaste volgorde aan. De
   invoerbalie blijft hier: haar herkomst staat niet vast maar komt per rij mee. */
const partner = require('./reiswereld-bronnen-partner');
const rtg = require('./reiswereld-bronnen-rtg');

module.exports = function bronnen(ctx, key, uit, stil) {
  partner.verblijven(ctx, key, uit, stil);
  rtg.reisbureau(ctx, key, uit, stil);
  rtg.vluchten(ctx, key, uit, stil);
  partner.activiteiten(ctx, key, uit, stil);

  const { kern, regel, bron } = ctx;
  /* DE INVOERBALIE: wat het lid zelf invoerde uit een eigen document, foto of
     e-mail (kern/invoer.js). Een domein als elk ander -- het bezit zijn eigen
     rijen -- met dit verschil: de herkomst komt hier PER RIJ mee en staat niet
     vast. Een ingevoerde regel kan uit een document, een beeld of uit de hand
     komen, en dat verschil bepaalt straks wat ermee mag (REIZEN.md par. 2.2).

     Ontbreekt de module, dan gaat deze bron stuk en meldt hij zich in `stil` --
     precies zoals bedoeld. Een reis die stilletjes zonder uw eigen ingevoerde
     onderdelen wordt getoond, ziet er compleet uit en is het niet. */
  /* EN DE INVOERBALIE DRAAGT ER OOK GEEN. Wat uit een document, een foto of de
     hand komt, is per definitie vrije tekst -- de balie kent geen zaakcode.
     Blijft dus zonder plek, met de reden hierboven bij het reisbureau. */
  bron('ingevoerd', () => (kern.invoer.mijnRegels(key) || []).map(x => regel(x.soort, {
    titel: x.titel, bestemming: x.bestemming, van: x.van, tot: x.tot,
    status: x.status, kenmerk: x.kenmerk, herkomst: x.herkomst,
    app: 'Invoerbalie', link: '/apps/reizen.html'
  })), uit, stil);
};

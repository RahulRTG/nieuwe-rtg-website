/* EEN BERICHT TOEVOEGEN, en iedereen die het aangaat een seintje geven.

   Deze helft schrijft, en kent maar een waarheid: wat er getypt is, wanneer, en
   door wie. Hoe dat er voor EEN kijker uitziet, staat in ./tonen.js -- vandaar
   dat het sein hieronder om een `toon`-functie vraagt in plaats van het bericht
   rauw over de lijn te gooien. Twee deelnemers krijgen zo hetzelfde bericht in
   hun eigen vorm.

   De twee verhuisdeuren onderaan (berichtenVan, leesZet) zijn bewust smal: een
   oude voorraad moet MET zijn eigen tijdstempels naar binnen kunnen. Via
   bericht() zou alles op NU komen te staan -- een gesprek van twee jaar dat er
   ineens uitziet alsof het vanmiddag gebeurde. Wie niets te verhuizen heeft,
   gebruikt bericht(). */
'use strict';

const wie = require('./wie');

function maakBericht({ B, eis, nu, id, save, standZet, standVan, seinNaarDeRest, toon, MAX_TEKST, MAX_PER_GESPREK }) {
  function bericht(opties) {
    const o = opties || {};
    const g = eis(o.gesprekId, o.van);
    const tekst = String(o.tekst == null ? '' : o.tekst).slice(0, MAX_TEKST).trim();
    const bijlage = o.bijlage && typeof o.bijlage === 'object' ? o.bijlage : null;
    if (!tekst && !bijlage) throw new Error('Een leeg bericht versturen doet niets.');
    if (o.antwoordOp) {
      // antwoorden op een bericht uit een ander gesprek zou een citaat maken
      // van iets waar de lezer geen toegang toe heeft
      const bron = (B()[g.id] || []).find((m) => m.id === o.antwoordOp);
      if (!bron) throw new Error('Dat bericht staat niet in dit gesprek.');
    }
    const m = {
      id: id('brc'), van: o.van, at: nu(),
      /* Namens wie er geschreven wordt (`van`) en WIE het typte (`door`) zijn
         bij een zaak niet hetzelfde. Alleen ingevuld als het iemand uit
         dezelfde zaak is: `door` van een vreemde sleutel zou een manier zijn
         om een naam in andermans gesprek te zetten. */
      door: o.door && wie.zelfdeZaak(o.door, o.van) ? String(o.door) : null,
      tekst: tekst || null,
      soort: o.soort || (bijlage ? bijlage.soort || 'bijlage' : 'tekst'),
      antwoordOp: o.antwoordOp || null,
      bijlage: bijlage,
      /* De brontaal reist mee met het bericht en niet met de lezer. Dat lijkt
         een detail tot iemand van taal wisselt: dan moet een oud bericht nog
         steeds vertaald kunnen worden vanaf de taal waarin het GESCHREVEN is,
         en niet vanaf de taal die de schrijver vandaag toevallig heeft staan. */
      lang: o.lang || null,
      reacties: {}
    };
    const lijst = B()[g.id] = B()[g.id] || [];
    lijst.push(m);
    if (lijst.length > MAX_PER_GESPREK) lijst.splice(0, lijst.length - MAX_PER_GESPREK);
    g.laatst = m.at;
    // de afzender heeft zijn eigen bericht per definitie gelezen
    standZet(o.van, g.id, 'gelezen', m.at);
    standZet(o.van, g.id, 'concept', null);
    save();
    seinNaarDeRest(g, o.van, 'bericht', { gesprekId: g.id, bericht: toon(m, o.van) });
    return m;
  }

  const berichtenVan = (gesprekId) => (B()[gesprekId] = B()[gesprekId] || []);
  function leesZet(key, gesprekId, at) {
    if (!key || !at) return;
    const nuStand = standVan(key, gesprekId).gelezen || '';
    if (at > nuStand) standZet(key, gesprekId, 'gelezen', at);
  }

  return { bericht, berichtenVan, leesZet };
}

module.exports = { maakBericht };

/* ============================================================================
   DE SEINEN VAN HET OBSERVATORIUM -- de zes vragen die het bord stelt.

   Afgesplitst van ./observatorium.js toen die over de 10 KB-keuringsgrens ging,
   en langs een echte naad: hier staat WAT er per onderwerp wordt gepeild, daar
   hoe die uitslagen tot één bord worden opgeteld (de zwaarste wint) en wat het
   bord over zichzelf niet beweert. Wie er een sein bij wil, hoeft de optelling
   niet te lezen; wie de optelling verandert, raakt geen enkele meting.

   Elk sein hier geeft dezelfde vorm terug: code, naam, stand, bewijsgraad,
   datum, en daarnaast wat het zag. Een sein dat niet te peilen viel, geeft
   `niet vast te stellen` met de reden -- nooit een nul.
   ========================================================================== */
'use strict';

const conclusielijn = require('./conclusielijn');

module.exports = ({ S, nu, labfonds, sein, kort }) => {
  /* ---------- de seinen ---------- */

  function stilgelegd(studies) {
    const rij = studies.filter(s => s.dossier.ethiek.stilgelegd);
    return sein('stilgelegd', 'Stilgelegd door de toezichthouder',
      rij.length ? 'storing' : 'in orde', {
        aantal: rij.length,
        studies: rij.map(s => Object.assign(kort(s), { reden: s.dossier.ethiek.stilgelegd.reden })),
        wat: 'Een ethisch toezichthouder heeft dit onderzoek stilgelegd. Het loopt niet tot iemand het hervat.' });
  }

  function klachten(studies) {
    const rij = [];
    for (const s of studies)
      for (const k of s.dossier.ethiek.klachten) if (k.status === 'open') rij.push(Object.assign(kort(s), { klachtAt: k.at }));
    /* De TEKST van een klacht staat hier niet. Die gaat alleen naar de RTF-staf
       (./studie.js), want een klacht kan over het team zelf gaan. Het aantal
       hoort wel op het bord: het is de reden dat een onderzoek stilstaat. */
    return sein('klachten', 'Open klachten', rij.length ? 'storing' : 'in orde', {
      aantal: rij.length, studies: rij,
      wat: 'Een klacht die openstaat, wordt afgehandeld door een tekenbevoegde van het lab -- met een antwoord.' });
  }

  function ijking(labs, kalibratieStand) {
    if (typeof kalibratieStand !== 'function')
      return sein('ijking', 'Kalibratie van apparatuur', 'niet vast te stellen', {
        nietTeZeggen: 'De apparatuurlaag is hier niet beschikbaar, dus de ijkstanden zijn niet gepeild.' });
    const dag = nu().slice(0, 10);
    const ids = labs.map(l => l.id);
    const rij = (S().apparatuur || []).filter(a => ids.includes(a.labId)).map(a => {
      const k = kalibratieStand(a, dag);
      return k.nvt || k.geldig ? null : { apparaat: a.naam, lab: a.labId, reden: k.reden };
    }).filter(Boolean);
    return sein('ijking', 'Kalibratie van apparatuur', rij.length ? 'storing' : 'in orde', {
      aantal: rij.length, apparaten: rij,
      wat: 'Een meting met een verlopen ijking is geen meting. Het apparaat gaat niet mee naar buiten tot hij is herijkt.' });
  }

  function gezakt(studies) {
    const rij = [];
    for (const s of studies) for (const c of s.dossier.conclusies) {
      const v = conclusielijn.versies(c);
      const laatste = v.versies[v.versies.length - 1];
      const eerder = v.versies[v.versies.length - 2];
      if (laatste && eerder && laatste.graad !== eerder.graad)
        rij.push(Object.assign(kort(s), { conclusie: c.id, van: eerder.graad, naar: laatste.graad,
          waardoor: laatste.waardoor || [] }));
    }
    /* Zakken is GEEN storing. Een conclusie die meebeweegt met wat er nog onder
       staat, is precies wat de bewijsmotor hoort te doen -- een deelnemer trok
       zich terug, en dus zakt het plafond. Het hoort alleen niet ONGEMERKT te
       gebeuren, en daarom staat het hier. */
    return sein('gezakt', 'Conclusies die van graad veranderden', 'in orde', {
      aantal: rij.length, conclusies: rij,
      wat: 'Elke graadverandering draagt haar oorzaak (kern/livinglab/conclusielijn.js). Dit is geen storing maar een spoor.' });
  }

  function wachtend(studies, watNu) {
    if (typeof watNu !== 'function')
      return sein('wachtend', 'Wacht op een volgende stap', 'niet vast te stellen', {
        nietTeZeggen: 'De cycluspoort is hier niet beschikbaar.' });
    const rij = studies.filter(s => !s.besluit).map(s => {
      const w = watNu(s.id);
      return w && w.ok && w.volgende && w.gebreken.length
        ? Object.assign(kort(s), { volgende: w.volgendeNaam || w.volgende, gebreken: w.gebreken })
        : null;
    }).filter(Boolean);
    /* Wachten is normaal: onderzoek dat aan de eisen van de volgende stap werkt,
       is onderzoek dat loopt. Het staat op het bord omdat het de enige plek is
       waar zichtbaar wordt WAAROP het wacht. */
    return sein('wachtend', 'Wacht op een volgende stap', 'in orde', {
      aantal: rij.length, studies: rij,
      wat: 'De poort van de cyclus noemt per studie wat er nog moet gebeuren. Dezelfde poort laat de stap straks toe.' });
  }

  /* Het geld: twee bedragen die met opzet naast elkaar staan en nooit worden
     opgeteld. Het ene is door leden TOEGEZEGD in het fondsgrootboek, het andere
     is door de kostenmeter GETELD. Ontbreekt een van beide bronnen, dan zakt dit
     sein naar `niet vast te stellen` -- er komt geen nul op de plaats van een
     meter die niet meet. */
  function geld(studies, ledger) {
    const lf = labfonds();
    if (!lf || typeof ledger !== 'function')
      return sein('geld', 'Fondsgeld en gemeten kosten', 'niet vast te stellen', {
        nietTeZeggen: !lf ? 'Het Lab-fonds is hier niet beschikbaar.' : 'Het onderzoeksgrootboek is hier niet beschikbaar.' });
    let toegezegd = 0, centen = 0, graad = studies.length ? 'gemeten' : 'onbekend';
    for (const s of studies) {
      toegezegd += lf.financiering(s.id).toegezegd.bedrag;
      /* Het grootboek KAN er zijn en toch niets kunnen zeggen: de kostenmeter
         draait pas in een latere laag, en op een server zonder meter valt hier
         niets te tellen. Dat wordt gemeld en niet als nul weggeschreven -- een
         onderzoek waarvan de kosten onbekend zijn, is iets anders dan een
         onderzoek dat niets kostte. */
      let g = null;
      try { g = ledger(s.id); } catch (e) {
        return sein('geld', 'Fondsgeld en gemeten kosten', 'niet vast te stellen', {
          nietTeZeggen: 'De kostenmeter draait niet op deze server, dus het verbruik is niet gepeild.' });
      }
      if (g && g.ok) { centen += g.verbruik.totaal.centen; if (g.verbruik.totaal.graad === 'vermoed') graad = 'vermoed'; }
    }
    return sein('geld', 'Fondsgeld en gemeten kosten', 'in orde', {
      toegezegdEuro: Math.round(toegezegd * 100) / 100,
      gemetenCenten: centen, gemetenGraad: graad,
      wat: 'Toegezegd door leden en gemeten door de kostenmeter zijn twee boeken. Ze staan naast elkaar en worden niet opgeteld.' });
  }


  return { stilgelegd, klachten, ijking, gezakt, wachtend, geld };
};

/* Rekenprojectie van een individueel getekende prijs. Zowel de bestaande
   contractmotor als de factuurketen lezen hier, nooit een actuele catalogus. */
'use strict';
const btw = require('../btw');
function termijn(c, nr) {
  if (!Number.isSafeInteger(nr) || nr < 1 || !c.automatischAbonnement || !c.aanbod)
    throw new Error('Geen geldige automatische abonnementstermijn.');
  const { plusMaanden } = require('./verplichting');
  const jaar = c.aanbod.frequentie === 'jaar';
  if (jaar && nr > 1 && c.aanbod.voorwaarden.jaarVervolg !== 'maand')
    throw Error('Het getekende aanbod bevat geen maandelijkse vervolgafspraak na jaarbetaling.');
  // Een jaar vooraf is alleen de eerste termijn. Daarna volgt de getekende
  // maandprijs, zonder nieuwe jaarafschrijving of nieuwe minimumtermijn.
  const offset = jaar && nr > 1 ? 12 + nr - 2 : nr - 1;
  const van = plusMaanden(c.startAt, offset), volledigTot = plusMaanden(c.startAt, offset + (jaar && nr === 1 ? 12 : 1));
  const eind = Date.parse(c.eindigtOp), start = Date.parse(van), einde = Date.parse(volledigTot);
  const verkort = c.aanbod.voorwaarden.laatsteMaandNaarRato === true &&
    Number.isFinite(eind) && eind > start && eind < einde;
  const tot = verkort ? new Date(eind).toISOString() : volledigTot;
  const p = jaar && nr === 1 ? c.aanbod.prijs.jaar : c.aanbod.prijs.maand;
  // Een maand opzegtermijn kan midden in een factuurperiode eindigen. Alleen
  // de nog te maken laatste verplichting beslaat dan die werkelijke periode;
  // opgeslagen termijnen en provideropdrachten worden hier nooit aangepast.
  const bruto = verkort ? Number((BigInt(p.brutoCenten) * BigInt(eind - start) + BigInt(Math.floor((einde - start) / 2))) /
    BigInt(einde - start)) : p.brutoCenten;
  const eerder = jaar && nr > 1 ? c.aanbod.prijs.jaar.brutoCenten + (nr - 2) * p.brutoCenten
    : (nr - 1) * p.brutoCenten;
  const credit = Math.min(bruto, Math.max(0, (c.verrekening.creditCenten || 0) - eerder));
  const bedrag = bruto - credit;
  if (![p.brutoCenten, bruto, bedrag, credit].every(n => Number.isSafeInteger(n) && n >= 0))
    throw new Error('Ongeldige bedragen op de contractmomentopname.');
  const opbouw = btw.overBruto(bedrag, c.aanbod.prijs.btwProfiel);
  return { id: c.id + ':' + nr, nr, van, tot, brutoCenten: bedrag, creditCenten: credit,
    origineelBrutoCenten: bruto, frequentie: jaar && nr === 1 ? 'jaar' : 'maand',
    opbouw, invoiceId: 'ABO-' + c.id + '-' + nr };
}
function tussen(c, van, tot) {
  const uit = [];
  for (let nr = 1; nr <= 600; nr++) {
    if (nr > 1 && c.aanbod.frequentie === 'jaar' && c.aanbod.voorwaarden.jaarVervolg !== 'maand') break;
    const t = termijn(c, nr);
    if (Date.parse(t.van) >= Date.parse(tot) || c.eindigtOp && Date.parse(t.van) >= Date.parse(c.eindigtOp)) break;
    if (van && Date.parse(t.van) < Date.parse(van)) continue;
    uit.push({ ...t, termijn: nr, vervalt: t.van, centen: t.opbouw.nettoCenten, periode: 1 });
  }
  return uit;
}
module.exports = { termijn, tussen };

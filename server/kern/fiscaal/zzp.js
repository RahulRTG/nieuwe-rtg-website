/* De fiscale laag, deelbestand "zzp": de belastingtool. Een indicatieve
   jaarberekening voor ondernemers, per land. Wordt door de Business Pass (zzp-tool)
   EN door elke leverancier (Kantoor) gebruikt; een berekening, overal hetzelfde
   antwoord. Puur: geen database, alleen de tabellen uit ./landen en de centen-helper.
   De maandboekhouding en de AI-boekhouder wonen in index.js. */
const { FISCAAL_PEILJAAR, LANDEN, ZZP } = require('./landen');
const { centen } = require('../util');

function zzpBerekening(land, winstIn, opties) {
  const landCode = ZZP[land] ? land : 'NL';
  const Z = ZZP[landCode];
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(winstIn) || 0)));
  if (!winst) return { error: 'Vul de verwachte jaarwinst in.', status: 400 };
  const o = opties || {};
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [], regels: Z.regels.slice(), indicatie: true, peiljaar: FISCAAL_PEILJAAR };
  let belasting = 0, belastbaar = winst;
  if (landCode === 'NL') {
    const uren = o.urencriterium !== false;
    const za = uren ? Math.min(Z.zelfstandigenaftrek, winst) : 0;
    const sa = uren && o.starter ? Z.startersaftrek : 0;
    const rest = Math.max(0, winst - za - sa);
    const mkb = centen(rest * Z.mkbVrijstelling);
    belastbaar = centen(rest - mkb);
    out.posten.push(za ? { label: 'Zelfstandigenaftrek', bedrag: -za }
                       : { label: 'Zelfstandigenaftrek (urencriterium niet gehaald)', bedrag: 0 });
    if (sa) out.posten.push({ label: 'Startersaftrek', bedrag: -sa });
    out.posten.push({ label: 'MKB-winstvrijstelling (12,7%)', bedrag: -mkb });
    let vorige = 0, ib = 0;
    for (const [grens, tarief] of Z.schijven) {
      const deel = Math.max(0, Math.min(belastbaar, grens) - vorige);
      ib += deel * tarief;
      vorige = grens;
      if (belastbaar <= grens) break;
    }
    const ahk = Math.max(0, Z.ahk.max - Math.max(0, belastbaar - Z.ahk.afbouwVanaf) * Z.ahk.afbouw);
    const ak = Math.max(0, Z.arbeidskorting.max - Math.max(0, belastbaar - Z.arbeidskorting.afbouwVanaf) * Z.arbeidskorting.afbouw);
    const korting = Math.min(ib, ahk + ak);
    belasting = Math.max(0, centen(ib - korting));
    out.posten.push({ label: 'Inkomstenbelasting (schijven)', bedrag: centen(ib) });
    out.posten.push({ label: 'Heffingskortingen (indicatie)', bedrag: -centen(korting) });
    if (winst < Z.korGrens) out.regels.unshift('Met deze omzet komt u waarschijnlijk in aanmerking voor de KOR (btw-vrijstelling): minder administratie, geen btw-aangifte.');
  } else {
    belasting = centen(winst * Z.simpel);
    out.posten.push({ label: 'Indicatieve heffing (~' + Math.round(Z.simpel * 100) + '% effectief, incl. sociale lasten)', bedrag: belasting });
  }
  out.belastbaar = centen(belastbaar);
  out.belasting = belasting;
  out.netto = centen(winst - belasting);
  out.reserveerPct = Math.max(20, Math.min(50, Math.round(belasting / winst * 100) + 5));
  out.perMaand = centen(belasting / 12);
  out.regels.push('Indicatieve berekening op basis van de tarieven van ' + FISCAAL_PEILJAAR + '; controleer jaarlijks en raadpleeg voor uw aangifte een fiscalist.');
  return out;
}

module.exports = { zzpBerekening };

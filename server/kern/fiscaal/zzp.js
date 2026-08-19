/* De fiscale laag, deelbestand "zzp": de belastingtool. Een indicatieve
   jaarberekening voor ondernemers, per land. Wordt door de Business Pass (zzp-tool)
   EN door elke leverancier (Kantoor) gebruikt; een berekening, overal hetzelfde
   antwoord. Puur: geen database, alleen de tabellen uit ./landen en de centen-helper.
   De maandboekhouding en de AI-boekhouder wonen in index.js. */
const { FISCAAL_PEILJAAR, LANDEN, ZZP } = require('./landen');
const { centen } = require('../util');

/* Landen zonder eigen zzp-regime in de tabel (de wereldtabel) krijgen een
   eerlijke indicatie: effectieve heffing afgeleid van de werkgeverslasten
   van dat land plus een basisheffing, duidelijk als indicatie gelabeld. */
function regimeVan(landCode) {
  if (ZZP[landCode]) return ZZP[landCode];
  const L = LANDEN[landCode];
  return { regime: 'Zelfstandige (wereldtabel, indicatie)',
    simpel: Math.max(0.15, Math.min(0.45, 0.18 + (L.lasten || 0) * 0.6)),
    regels: ['Voor ' + L.naam + ' rekent de wereldtabel met een indicatieve effectieve heffing; het echte regime kent eigen drempels en aftrekposten.',
      'De Regelwacht werkt de tarieven van dit land automatisch bij.'] };
}

/* WAAROM HIER GEEN JAARGANG ONDER LIGT, en waarom dat er met zoveel woorden bij
   staat. De btw-tarieven, werkgeverslasten en minimumlonen worden sinds
   ./jaargangen.js per ingangsdatum bewaard, dus die zijn terug te rekenen. De
   ZZP-tabel hierboven (schijven, zelfstandigenaftrek, MKB-vrijstelling,
   heffingskortingen) is dat NIET: die staat als vaste data in ./landen.js op het
   peiljaar en de Regelwacht raakt hem niet aan.

   Deze functie zonder meer een jaartal laten aannemen zou dus een antwoord geven
   dat eruitziet als "de regels van 2023" en het niet is. Dat is precies de
   schijnzekerheid die je bij een fiscale tool niet wilt. Een jaar dat afwijkt
   van het peiljaar wordt daarom niet geweigerd -- de som blijft bruikbaar als
   indicatie -- maar hij zegt bovenaan wat er aan de hand is. */
function zzpBerekening(land, winstIn, opties) {
  const landCode = LANDEN[land] ? land : 'NL';
  const Z = regimeVan(landCode);
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(winstIn) || 0)));
  if (!winst) return { error: 'Vul de verwachte jaarwinst in.', status: 400 };
  const o = opties || {};
  const jaar = Number(o.jaar) || FISCAAL_PEILJAAR;
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [], regels: Z.regels.slice(), indicatie: true, peiljaar: FISCAAL_PEILJAAR, jaar };
  if (jaar !== FISCAAL_PEILJAAR) {
    out.buitenPeiljaar = true;
    out.regels.unshift('Let op: dit is gerekend met de tabellen van peiljaar ' + FISCAAL_PEILJAAR +
      ', niet met die van ' + jaar + '. De zzp-regimes (schijven, aftrekposten, heffingskortingen) worden nog niet per ingangsdatum bewaard, anders dan de btw-tarieven en de werkgeverslasten. Voor ' + jaar + ' zijn dit dus niet de regels die toen golden.');
  }
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

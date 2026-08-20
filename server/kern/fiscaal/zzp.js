/* De fiscale laag, deelbestand "zzp": de belastingtool. Een indicatieve
   jaarberekening voor ondernemers, per land. Wordt door de Business Pass (zzp-tool)
   EN door elke leverancier (Kantoor) gebruikt; een berekening, overal hetzelfde
   antwoord. Puur: geen database, alleen de tabellen uit ./landen en de centen-helper.
   De maandboekhouding en de AI-boekhouder wonen in index.js. */
const { FISCAAL_PEILJAAR, LANDEN, ZZP } = require('./landen');
const { centen } = require('../util');
const { zekerheid, zin } = require('./zekerheid');

/* Landen zonder eigen zzp-regime in de tabel (de wereldtabel) krijgen een
   eerlijke indicatie: effectieve heffing afgeleid van de werkgeverslasten
   van dat land plus een basisheffing, duidelijk als indicatie gelabeld. */
function regimeVan(landCode, gegeven) {
  /* Een TERUGGEHAALD regime (kern/fiscaal/zzpwacht.js, regimeOp) wint: dat is
     de tabel zoals hij op de gevraagde datum was, en dus preciezer dan de
     lopende. Zonder valt hij terug op de tabel van nu. */
  if (gegeven && gegeven.regime) return gegeven;
  if (ZZP[landCode]) return ZZP[landCode];
  const L = LANDEN[landCode];
  return { regime: 'Zelfstandige (wereldtabel, indicatie)',
    simpel: Math.max(0.15, Math.min(0.45, 0.18 + (L.lasten || 0) * 0.6)),
    regels: ['Voor ' + L.naam + ' rekent de wereldtabel met een indicatieve effectieve heffing; het echte regime kent eigen drempels en aftrekposten.',
      'De Regelwacht werkt de tarieven van dit land automatisch bij.'] };
}

/* EEN ANDER JAAR: MET REGELS ALS ZE ER ZIJN, EN ANDERS MET EEN WAARSCHUWING.

   Deze functie blijft PUUR: hij kent de zzp-wacht niet en zoekt niets op. Wie
   een ander jaar wil, geeft het regime van dat jaar mee in `opties.regime` --
   kern/fiscaal/zzpwacht.js haalt dat uit de jaargangen en `bereken()` daar doet
   het in een keer. Zo blijft deze som toetsbaar zonder database, en staat het
   opzoeken op de plek die de tijdlijn beheert.

   Krijgt hij GEEN regime en wijkt het jaar af van het peiljaar, dan rekent hij
   met de tabel van nu en zegt dat er uitdrukkelijk bij. Dat was er niet, en toen
   zag het antwoord eruit als "de regels van 2023" terwijl het de regels van nu
   waren. Een fiscale tool mag veel, maar dat niet. */
function zzpBerekening(land, winstIn, opties) {
  const landCode = LANDEN[land] ? land : 'NL';
  const Z = regimeVan(landCode, (opties || {}).regime);
  const winst = Math.max(0, Math.min(5000000, Math.round(Number(winstIn) || 0)));
  if (!winst) return { error: 'Vul de verwachte jaarwinst in.', status: 400 };
  const o = opties || {};
  const jaar = Number(o.jaar) || FISCAAL_PEILJAAR;
  const teruggehaald = !!(o.regime && o.regime.regime);
  const out = { land: landCode, landNaam: LANDEN[landCode].naam, regime: Z.regime, winst, posten: [],
    regels: (Z.regels || []).slice(), indicatie: true, peiljaar: FISCAAL_PEILJAAR, jaar, teruggehaald };
  if (jaar !== FISCAAL_PEILJAAR && !teruggehaald) {
    out.buitenPeiljaar = true;
    out.regels.unshift('Let op: dit is gerekend met de tabellen van peiljaar ' + FISCAAL_PEILJAAR +
      ', niet met die van ' + jaar + '. Voor ' + jaar + ' is er geen vastgelegde jaargang van dit regime, dus dit zijn niet de regels die toen golden.');
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
  out.zekerheid = zekerheid('zzp.berekening');
  out.regels.push('Berekend met de tarieven van ' + (teruggehaald ? jaar : FISCAAL_PEILJAAR) + '. ' + zin('zzp.berekening'));
  return out;
}

module.exports = { zzpBerekening };

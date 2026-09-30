/* DE MATEN OP HET BOEK VAN RTG (besluiten C8 tot en met C12) -- een deel
   van ./stand.js, apart omdat dat bestand tegen de omvanggrens aan zit.

   Operationele marge, liquiditeit, runway, CAC per kanaal en per campagne. Allemaal met de graad
   `vermoed`: ze rusten op bedragen die een mens overtikte (het boek, het
   banksaldo), en een conclusie is nooit harder dan haar zachtste premisse.

   EEN GETAL ALLEEN ALS ELKE PREMISSE ER IS. Ontbreekt een post, een nota of een
   saldo, dan zegt de maat WELKE en staat er geen getal -- ook geen nul. */
'use strict';

const { DEFINITIES } = require('./definities');

const VERMOED = 'Overgetikt door een mens van Financiën; er is geen boekhoudkoppeling.';
const vorige = (m) => { const [j, mm] = m.split('-').map(Number); return new Date(Date.UTC(j, mm - 2, 1)).toISOString().slice(0, 7); };
const niet = (waarom, extra) => Object.assign({ stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom }, extra || {});

/* De kosten van een maand buiten het boek: de gemeten platformkosten (uit de
   brutomarge) en de nota's van stroom en serverhuur uit de huisrekening. */
function platform(cijfers, posten) {
  if (cijfers.bruto.kostenCenten == null) return { centen: null, waarom: cijfers.bruto.waarom || 'De platformkosten zijn niet uit te rekenen.' };
  const nota = (id) => (posten || []).find(p => p.soort === id);
  const mis = ['stroom', 'hosting'].filter(id => !nota(id));
  if (mis.length) return { centen: null, waarom: 'Geen nota in de huisrekening voor: ' + mis.join(', ') + '.' };
  return { centen: cijfers.bruto.kostenCenten + nota('stroom').centen + nota('hosting').centen, waarom: null };
}

module.exports = function rtgboekMaten({ m, peilmoment, maat, boek, bank, cijfers, notas, kanalen, ledentegoed }) {
  const b = boek(m);
  const bp = bank(m);
  const vrij = bp && bp.vrij ? bp.vrij.centen : null;

  /* C8: de operationele marge van deze maand. */
  const c = cijfers(m), pf = platform(c, notas(m));
  const operationeel = c.bruto.margeCenten == null ? niet(c.bruto.waarom)
    : !b.vast.compleet ? niet('Nog niet ingevuld in het boek van RTG: ' + b.vast.ontbreekt.join(', ') + '.')
      : pf.centen == null ? niet(pf.waarom)
        : { stand: 'TOONBAAR', waarde: c.ontvangen - pf.centen - b.vast.totaalCenten, eenheid: 'eurocent, zonder btw',
          vasteLastenCenten: b.vast.totaalCenten, platformCenten: pf.centen };

  /* C10: vrij saldo min eigen korte schulden; het ledentegoed los ernaast. */
  let lt = null; try { lt = ledentegoed(); } catch (e) { lt = null; }
  const naast = { ledentegoed: lt ? { centen: lt.centen, peilmoment, afgetrokken: false } : null };
  const liquiditeit = vrij == null ? niet(bp ? bp.reden : 'Het banksaldo is niet gemount.', naast)
    : !b.kort.compleet ? niet('Nog niet ingevuld in het boek van RTG: ' + b.kort.ontbreekt.join(', ') + '.', naast)
      : Object.assign({ stand: 'TOONBAAR', waarde: vrij - b.kort.totaalCenten, eenheid: 'eurocent',
        vrijCenten: vrij, kortCenten: b.kort.totaalCenten }, naast);

  /* C9: runway bruto en netto naast elkaar, over drie afgesloten maanden. */
  const eind = m < peilmoment.slice(0, 7) ? m : vorige(m);
  const maanden = [vorige(vorige(eind)), vorige(eind), eind];
  const verbruik = maanden.map(x => {
    const bx = boek(x), cx = cijfers(x), px = platform(cx, notas(x));
    if (!bx.vast.compleet || !bx.marketing.compleet) return { maand: x, waarom: 'Het boek van ' + x + ' is niet compleet.' };
    if (px.centen == null) return { maand: x, waarom: x + ': ' + px.waarom };
    const bruto = bx.vast.totaalCenten + bx.marketing.totaalCenten + px.centen;
    return { maand: x, bruto, netto: bruto - cx.ontvangen };
  });
  const gat = verbruik.find(v => v.waarom);
  const eindSaldo = bank(eind), eindVrij = eindSaldo && eindSaldo.vrij ? eindSaldo.vrij.centen : null;
  const gem = (k) => verbruik.reduce((s, v) => s + v[k], 0) / verbruik.length;
  const maandenVan = (burn) => (burn > 0 ? Math.round((eindVrij / burn) * 10) / 10 : null);
  const runway = gat ? niet(gat.waarom, { maanden })
    : eindVrij == null ? niet('Geen banksaldo voor ' + eind + '.', { maanden })
      : { stand: 'TOONBAAR', eenheid: 'maanden', maanden, vrijCenten: eindVrij,
        bruto: { waarde: maandenVan(gem('bruto')), verbruikCenten: Math.round(gem('bruto')) },
        netto: gem('netto') > 0 ? { waarde: maandenVan(gem('netto')), verbruikCenten: Math.round(gem('netto')) }
          : { waarde: null, verbruikCenten: Math.round(gem('netto')), waarom: 'Geen netto verbruik: de omzet dekte de uitgaven.' } };

  /* C11: CAC per kanaal, langs de groepspoort van het aanmeldkanaal. */
  const nieuw = new Map((kanalen(m).kanalen || []).map(k => [k.naam, k]));
  const perKanaal = b.marketing.posten.map(p => {
    const g = nieuw.get(p.post);
    if (p.centen == null) return { kanaal: p.post, stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: 'Geen uitgave ingevuld.' };
    if (!g || g.stand !== 'TOONBAAR' || !g.aantal) return { kanaal: p.post, stand: 'TE_KLEINE_GROEP', waarde: null };
    return { kanaal: p.post, stand: 'TOONBAAR', waarde: Math.round(p.centen / g.aantal), eenheid: 'eurocent per nieuw lid' };
  });
  const cac = { stand: 'PER_KANAAL', waarde: null, perKanaal };

  /* C12: per campagne de uitgave uit het boek en de nieuwe leden met haar code,
     langs dezelfde groepspoort. Een kanaal waarvan de campagnes meer kosten dan
     het kanaal zelf, krijgt per campagne geen getal: het boek klopt dan niet. */
  const bc = b.campagnes || { rijen: [], tegenspraak: [] };
  const metCode = new Map(((kanalen(m).campagnes) || []).map(k => [k.naam, k]));
  const perCampagne = bc.rijen.map(r => {
    const t = bc.tegenspraak.find(x => x.kanaal === r.kanaal);
    const basis = { campagne: r.code, naam: r.naam, kanaal: r.kanaal, uitgaveCenten: r.centen };
    if (t) return Object.assign(basis, { stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: t.reden });
    if (r.centen == null) return Object.assign(basis, { stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: 'Geen uitgave ingevuld.' });
    const g = metCode.get(r.code);
    if (!g || g.stand !== 'TOONBAAR' || !g.aantal) return Object.assign(basis, { stand: 'TE_KLEINE_GROEP', waarde: null });
    return Object.assign(basis, { stand: 'TOONBAAR', nieuweLeden: g.aantal, waarde: Math.round(r.centen / g.aantal), eenheid: 'eurocent per nieuw lid' });
  });
  const campagnes = perCampagne.length ? { stand: 'PER_CAMPAGNE', waarde: null, perCampagne, tegenspraak: bc.tegenspraak }
    : niet('In deze maand liep geen campagne van RTG.', { perCampagne });

  const m4 = (id, def, uitkomst, dekt) => Object.assign(maat(id, def, uitkomst, dekt), { graad: 'vermoed' });
  return [
    m4('marge.operationeel-rtg', DEFINITIES.operationeleMarge, operationeel,
      [VERMOED, 'De ontvangen omzet is dezelfde als onder de brutomarge, met dezelfde beperking.']),
    m4('liquiditeit.rtg', DEFINITIES.liquiditeit, liquiditeit,
      [VERMOED, 'Het ledentegoed is de stand van nu en niet van het eind van de maand.']),
    m4('runway.rtg', DEFINITIES.runway, runway,
      [VERMOED, 'Het verbruik van drie maanden is geen voorspelling: een grote uitgave die nog komt, staat er niet in.']),
    m4('cac.per-kanaal', DEFINITIES.cac, cac,
      [VERMOED, 'Alleen leden die de herkomstvraag beantwoordden of via een campagnelink kwamen; de rest heeft geen kanaal.']),
    m4('campagnes.rtg-marketing', DEFINITIES.campagne, campagnes,
      [VERMOED, 'Alleen wie met de campagnelink binnenkwam; wie hem zag en later zelf zocht, telt niet mee.'])
  ];
};

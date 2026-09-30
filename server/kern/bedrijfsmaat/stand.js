/* DE STAND -- de eerste sensor van AUTONOMIE, uitsluitend lezend.

   Haalt de lijsten op die anderen bezitten, rekent de definities uit
   (./projecties.js) en stuurt ELKE uitkomst die over mensen optelt langs de
   groepspoort (./poort.js). Wat eruit komt, mag naar een scherm, een lens of het
   kantoorstuur: onder de groepsgrens staat er geen getal meer in, ook niet het
   aantal.

   EEN UITKOMST ZEGT WAT ZE NIET DEKT (`dektNiet`): een getal dat compleet LIJKT
   terwijl het dat niet is, is erger dan geen getal.

   DE OPSLAG KOMT ALS LEZERS BINNEN, zodat dit bestand geen eigen deur is. */
'use strict';

const P = require('./projecties');
const K = require('./klantwaarde');
const RB = require('./stand-rtgboek');
const LATER = require('./stand-later');
const { toon } = require('./poort');
const { DEFINITIES } = require('./definities');

const GEPEILD = 'gemeten';
const VANAF = 'Leden van voor de ingebruikname van kern/pasgeschiedenis.js hebben geen overgang en tellen niet mee.';

module.exports = ({ lees, pasgeschiedenis, aanwezigheid, kosten, bank, boek, kanalen, ledentegoed, later, nu }) => {
  const klok = typeof nu === 'function' ? nu : Date.now;
  const lijst = (x) => (Array.isArray(x) ? x : []);

  /* De geslaagde uitkomsten (definities.activatie), uit twee domeinen. */
  function uitkomsten() {
    const uit = [];
    for (const r of lijst(lees.ritten()))
      if (['afgerond', 'gearriveerd'].includes(r.status) && r.customerCodename)
        uit.push({ codenaam: r.customerCodename, op: r.finishedAt || r.at });
    for (const o of lijst(lees.bestellingen()))
      if (['bezorgd', 'opgehaald'].includes(o.status) && o.customerCodename)
        uit.push({ codenaam: o.customerCodename, op: o.finishedAt || o.at });
    return uit;
  }
  const termijnen = () => lijst(lees.betaalschemas()).flatMap(r => lijst(r && r.termijnen));

  const maat = (id, def, uitkomst, dektNiet, extra) => Object.assign({
    id, definitie: { versie: def.versie, regel: def.regel }, graad: GEPEILD, dektNiet }, uitkomst, extra || {});
  const verhouding = (m, v) => {
    const t = toon(m, { waarde: v.noemer ? v.teller / v.noemer : null, n: v.noemer });
    return t.stand === 'TOONBAAR' ? Object.assign(t, { teller: v.teller }) : t;
  };
  const LEDEN = { privacy: 'leden', minGroep: 10 };

  function stand({ maand } = {}) {
    const peil = klok();
    const peilmoment = new Date(peil).toISOString();
    const m = /^\d{4}-\d{2}$/.test(String(maand || '')) ? maand : peilmoment.slice(0, 7);
    const overgangen = lijst(pasgeschiedenis && pasgeschiedenis.pasOvergangen());
    const leden = P.nieuweLeden(overgangen);
    const uk = uitkomsten();
    const laatst = lijst(aanwezigheid && aanwezigheid.laatstActief());

    /* De cohorten van de laatste twaalf weken, elk langs de poort. */
    const cohorten = [];
    for (let w = 11; w >= 0; w--) {
      const week = P.isoWeek(peil - w * 7 * P.DAG);
      const groep = leden.filter(l => l.cohort === week);
      cohorten.push({ cohort: week,
        grootte: toon(LEDEN, { waarde: groep.length, n: groep.length }),
        activatie: verhouding(LEDEN, P.activatie(groep, uk, peil)),
        retentieWaarde: verhouding(LEDEN, P.retentieWaarde(groep, uk, peil)),
        retentieAanwezig: verhouding(LEDEN, P.retentieAanwezig(groep, laatst, peil)) });
    }
    const ce = P.churnEnAfwaardering(overgangen, m);
    const om = P.omzet(termijnen(), m);
    const rit = P.rittenAfgerond(lijst(lees.ritten()), m);
    // de kostenlaag komt later, als lezer; faalt hij, dan onbekend en geen nul
    const kl = (f, x) => { try { const k = typeof kosten === 'function' ? kosten() : null; return k && k[f] ? k[f](x) : null; } catch (e) { return null; } };
    const cijfers = (x) => { const o = P.omzet(termijnen(), x); return { ontvangen: o.ontvangenCenten, bruto: P.brutomarge(o.ontvangenCenten, kl('afstemming', x)) }; };
    const bm = cijfers(m).bruto;
    // klantwaarde per wereld (C3): vier maten, elk met poort, geen totaal
    const lees0 = (f) => (typeof f === 'function' ? lijst(f()) : []);
    const kw = { living: K.klantwaardeLiving(lees.ritten(), lees.bestellingen(), m), travel: K.klantwaardeTravel(lees0(lees.reizen), m),
      work: K.klantwaardeWork(lees0(lees.loonruns), m), foundation: K.klantwaardeFoundation(lees0(lees.casussen), m) };
    const kwMaat = (id, def, klasse, v, dekt) => maat(id, def,
      Object.assign(toon(klasse, { waarde: v.aantal, n: v.n }), { eenheid: 'uitkomsten in de maand' }), dekt);
    const UITKOMST = 'Als geslaagde uitkomst tellen alleen afgeronde ritten en bezorgde of opgehaalde bestellingen; boekingen, reizen en servicezaken nog niet.';

    return {
      peilmoment, maand: m,
      maten: [
        maat('acquisitie.nieuwe-leden', DEFINITIES.nieuwLid,
          toon(LEDEN, { waarde: leden.filter(l => new Date(l.op).toISOString().slice(0, 7) === m).length,
            n: leden.filter(l => new Date(l.op).toISOString().slice(0, 7) === m).length }), [VANAF]),
        maat('cohort.aanmeldweek', DEFINITIES.cohort, { cohorten }, [VANAF, UITKOMST,
          'Een cohort telt pas mee in activatie of retentie als zijn hele venster voorbij is.']),
        maat('churn.pas-naar-gast', DEFINITIES.churn, verhouding(LEDEN, { teller: ce.churn, noemer: ce.noemer }), [VANAF,
          'Er bestaat vandaag geen weg van een betaalde pas naar gast; deze maat staat dus op nul tot die weg er is.',
          'Contracten die GEEINDIGD bereiken, tellen nog niet mee.']),
        maat('churn.afwaardering', DEFINITIES.afwaardering, verhouding(LEDEN, { teller: ce.afwaardering, noemer: ce.noemer }), [VANAF,
          'accounts.setTier tilt vandaag alleen op; een afwaardering komt nog niet voor.']),
        maat('omzet.leden-gefactureerd', DEFINITIES.omzetGefactureerd,
          { stand: 'TOONBAAR', waarde: om.gefactureerdCenten, eenheid: 'eurocent, zonder btw', termijnen: om.termijnenGefactureerd },
          ['Alleen de betaalschema\'s uit aanmeldingen; de ledenfacturen van RTG Pass-leden staan per lid in de kluis en worden hier niet gelezen.']),
        maat('omzet.leden-ontvangen', DEFINITIES.omzetOntvangen,
          { stand: 'TOONBAAR', waarde: om.ontvangenCenten, eenheid: 'eurocent, zonder btw', termijnen: om.termijnenOntvangen },
          ['Alleen termijnen die een mens als voldaan aftekende, uit de betaalschema\'s van aanmeldingen.']),
        maat('uitkomst.rit-afgerond', DEFINITIES.activatie,
          Object.assign(toon(LEDEN, { waarde: rit.aantal, n: rit.klanten }), { eenheid: 'ritten' }),
          ['Alleen ritten die een lid via de app aanvroeg (de ritlijst); opdrachten die het dispatchcentrum zelf aannam zonder app-rit tellen niet mee.',
            'De groepsgrens telt verschillende leden en geen ritten.']),
        maat('marge.bruto-rtg', DEFINITIES.brutomarge,
          bm.margeCenten == null
            ? { stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: bm.waarom, zonderTarief: bm.zonderTarief }
            : { stand: 'TOONBAAR', waarde: bm.margeCenten, eenheid: 'eurocent, zonder btw', kostenCenten: bm.kostenCenten, ontvangenCenten: om.ontvangenCenten },
          ['De ontvangen omzet is alleen die uit de betaalschema\'s van aanmeldingen; de ledenfacturen in de kluis tellen niet mee, dus deze marge is te laag of te hoog op een manier die niet te zeggen is.',
            'Stroom en serverhuur zijn toegerekend en horen bij de operationele marge, niet hier.']),
        // banksaldo (kern/bankpositie.js): handmatig
        (() => { const bp = typeof bank === 'function' ? bank(m) : null;
          return Object.assign(maat('cash.rtg-bankpositie', DEFINITIES.cash, bp && bp.saldo
            ? { stand: 'TOONBAAR', waarde: bp.saldo.centen, eenheid: 'eurocent', peildatum: bp.saldo.peildatum,
              bonnenVerplichting: bp.bonnenVerplichting, vrij: bp.vrij }
            : { stand: 'NIET_UIT_TE_REKENEN', waarde: null, waarom: bp ? bp.reden : 'Het banksaldo is niet gemount.' },
          ['Handmatig overgetikt van een afschrift; er is geen bankkoppeling.']), { graad: 'vermoed' }); })(),
        kwMaat('uitkomst.klantwaarde-living', DEFINITIES.klantwaardeLiving, LEDEN, kw.living,
          ['Boekingen bij zaken en servicezaken tellen hier nog niet; tevredenheid wordt niet gemeten.']),
        kwMaat('uitkomst.klantwaarde-travel', DEFINITIES.klantwaardeTravel, LEDEN, kw.travel,
          ['Alleen reizen van het RTG-reisbureau; een reis die niemand thuis meldt, telt niet mee.']),
        kwMaat('uitkomst.klantwaarde-work', DEFINITIES.klantwaardeWork, { privacy: 'zaken', minGroep: 5 }, kw.work,
          ['Alleen de loonruns van de nieuwe payrollmotor (payrollRunsV2); de groep is het aantal zaken.']),
        kwMaat('uitkomst.klantwaarde-foundation', DEFINITIES.klantwaardeFoundation, { privacy: 'gezinnen', minGroep: 10 }, kw.foundation,
          ['Casussen van voor 27 september 2026 hebben geen dag van afronden en tellen niet mee.']),
        ...LATER({ m, peilmoment, maat, kosten, later }),
        // het boek van RTG (C8-C11): operationele marge, liquiditeit, runway, CAC
        ...(typeof boek === 'function' ? RB({ m, peilmoment, maat, boek, bank, cijfers, notas: (x) => kl('posten', x),
          kanalen: typeof kanalen === 'function' ? kanalen : () => ({}), ledentegoed: typeof ledentegoed === 'function' ? ledentegoed : () => null }) : [])
      ]
    };
  }

  return { stand };
};

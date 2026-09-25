/* DE STAND -- de eerste sensor van AUTONOMIE, uitsluitend lezend.

   Haalt de lijsten op die anderen bezitten, rekent de definities uit
   (./projecties.js) en stuurt ELKE uitkomst die over mensen optelt langs de
   groepspoort (./poort.js). Wat eruit komt, mag naar een scherm, een lens of het
   kantoorstuur: onder de groepsgrens staat er geen getal meer in, ook niet het
   aantal.

   EEN UITKOMST ZEGT WAT ZE NIET DEKT. Elke maat draagt `dektNiet`, en dat is hier
   geen voetnoot: de pasgeschiedenis begint op de dag dat hij werd ingebouwd, de
   uitkomsten zijn nog alleen ritten en bestellingen, en de omzet ziet het
   betaalschema van aanmeldingen maar niet de ledenfacturen in de kluis. Een
   getal dat compleet LIJKT terwijl het dat niet is, is erger dan geen getal. */
'use strict';

const P = require('./projecties');
const { toon } = require('./poort');
const { DEFINITIES } = require('./definities');

const GEPEILD = 'gemeten';
const VANAF = 'Leden van voor de ingebruikname van kern/pasgeschiedenis.js hebben geen overgang en tellen niet mee.';

module.exports = ({ db, pasgeschiedenis, aanwezigheid, nu }) => {
  const klok = typeof nu === 'function' ? nu : Date.now;
  const lijst = (x) => (Array.isArray(x) ? x : []);

  /* De geslaagde uitkomsten (definities.activatie), uit twee domeinen. */
  function uitkomsten() {
    const d = (db && db.data) || {};
    const uit = [];
    for (const r of lijst(d.rides))
      if (['afgerond', 'gearriveerd'].includes(r.status) && r.customerCodename)
        uit.push({ codenaam: r.customerCodename, op: r.finishedAt || r.at });
    for (const o of lijst(d.orders))
      if (['bezorgd', 'opgehaald'].includes(o.status) && o.customerCodename)
        uit.push({ codenaam: o.customerCodename, op: o.finishedAt || o.at });
    return uit;
  }
  const termijnen = () => lijst(((db && db.data) || {}).lidmaatschapBetalingen).flatMap(r => lijst(r && r.termijnen));

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
          ['Alleen termijnen die een mens als voldaan aftekende, uit de betaalschema\'s van aanmeldingen.'])
      ]
    };
  }

  return { stand };
};

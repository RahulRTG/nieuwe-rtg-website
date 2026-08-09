/* DE CREDITEUREN: wat moet er nog uit, en wanneer.

   De spiegel van ./debiteuren.js, op dezelfde facturen: waar de debiteurenkant
   kijkt naar wat deze zaak heeft VERSTUURD en nog niet binnen is, kijkt deze
   naar wat zij heeft ONTVANGEN en nog niet heeft betaald. Het rekenwerk
   (ouderdom, groepsgrenzen) is gedeeld via ./ouderdom.js; alleen de teksten
   verschillen, want het advies is hier een ander.

   EEN ASYMMETRIE DIE ER ECHT IS, EN DIE WE NIET WEGPOETSEN. Een factuur wordt
   afgeboekt door de VERKOPER (kern/facturatie/motor.js: alleen hij weet of het
   geld binnen is). Voor de koper betekent dat: een factuur die hij vandaag
   betaalt, blijft op zijn lijst staan tot de verkoper hem afboekt. Dat is
   ongemakkelijk, maar het alternatief is erger: een tweede vlag "ik heb
   betaald" naast de eerste maakt twee waarheden over een factuur, en dan is
   niet meer te zeggen welke telt (lat-regel 4). Het staat daarom in het
   antwoord, zodat een scherm het kan uitleggen in plaats van dat iemand denkt
   dat de lijst kapot is.

   DE VOORUITBLIK IS EEN OPTELSOM, GEEN PROGNOSE. "Wat moet er de komende week
   en maand uit" is de som van de vervaldata die er al staan. Er zit geen
   voorspelling in van wat er nog bij komt, en dat staat er ook bij: een
   liquiditeitsprognose die doet alsof zij de toekomst kent, is precies het
   soort getal waar iemand een beslissing op neemt. */
'use strict';

const OUD = require('./ouderdom');

/* Dezelfde grenzen als bij de debiteuren, andere raad. Te laat betalen is geen
   incasso-probleem maar een leveringsprobleem: uw leverancier stopt. */
const TEKSTEN = {
  loopt: { label: 'Loopt nog', wat: 'Nog niet vervallen. Plan de betaling in.' },
  net: { label: '1 tot 14 dagen over', wat: 'Betaal deze week; hier komt meestal nog geen gedoe van.' },
  lang: { label: '15 tot 30 dagen over', wat: 'Bel zelf voordat zij bellen. Een afspraak is beter dan stilte.' },
  zeer: { label: '31 tot 60 dagen over', wat: 'Reken erop dat de levering stilvalt. Spreek een regeling af.' },
  oud: { label: 'Meer dan 60 dagen over', wat: 'Dit kost u de relatie en waarschijnlijk kosten. Handel nu.' }
};

const DAG = 86400000;
const rond = (n) => Math.round(n * 100) / 100;

module.exports = ({ db }) => {

  const alle = () => (Array.isArray(db.data.facturen) ? db.data.facturen : []);
  const zaakVan = (o) => (o && o.supplierCode
    ? (db.data.suppliers || []).find(x => x.code === o.supplierCode) || null : null);

  /* Wat deze zaak heeft ontvangen en nog niet is afgeboekt. Zelfde lezing van
     `betaald` als aan de debiteurenkant: alleen een uitdrukkelijke `false`
     telt, zodat de geschiedenis niet in een keer op de lijst springt. */
  function openVan(code) {
    return alle().filter(f => f && f.koper && f.koper.supplierCode === code && f.betaald === false);
  }

  /* Wat er binnen `dagen` dagen vervalt, ongeacht of het al te laat is. Posten
     zonder vervaldatum tellen NIET mee: die weten we niet, en meetellen zou een
     bedrag suggereren dat op een datum rust die er niet is. */
  function binnen(posten, dagen, nuMs) {
    const grens = nuMs + dagen * DAG;
    return posten.filter(p => {
      if (!p.vervaldatum) return false;
      const t = Date.parse(p.vervaldatum + 'T12:00:00Z');
      return Number.isFinite(t) && t <= grens;
    });
  }

  function crediteuren(o, nuMs) {
    const s = zaakVan(o);
    if (!s) return null;
    const nuT = Number.isFinite(nuMs) ? nuMs : Date.now();

    const open = openVan(s.code).map(f => ({
      id: f.id, nummer: f.nummer,
      leverancier: f.verkoper.naam || f.verkoper.code || null,
      totaal: f.totaal, datum: f.datum, vervaldatum: f.vervaldatum || null
    }));
    const ing = OUD.deelIn(open, nuT, TEKSTEN);

    const som = (rij) => rond(rij.reduce((n, p) => n + (Number(p.totaal) || 0), 0));

    return {
      zaak: s.code,
      aantal: open.length, bedrag: som(open),
      vervallenAantal: ing.vervallen.length,
      vervallenBedrag: ing.vervallenBedrag,
      groepen: ing.groepen,
      oudste: ing.oudste,
      posten: ing.rijen.slice(0, 50),
      zonderVervaldatum: ing.zonderVervaldatum,
      /* De vooruitblik: wat er de komende week en maand uit moet. Een optelsom
         van wat er al ligt -- zie de kop. */
      vooruit: {
        week: { aantal: binnen(open, 7, nuT).length, bedrag: som(binnen(open, 7, nuT)) },
        maand: { aantal: binnen(open, 30, nuT).length, bedrag: som(binnen(open, 30, nuT)) }
      },
      voorbehoud: 'Een factuur wordt afgeboekt door de verkoper, want alleen hij ziet of het geld binnen is. Betaalt u vandaag, dan blijft de post hier staan tot hij dat doet. De vooruitblik telt alleen op wat er nu ligt; het is geen prognose.'
    };
  }

  return { CREDITEUREN_TEKSTEN: TEKSTEN, crediteuren };
};

/* De opvolgregel voor het dagbeeld. Alleen bij echt vervallen posten: een
   factuur die netjes loopt is geen actie maar de gewone gang van zaken. */
function crediteurenOpvolging(c) {
  if (!c || !c.vervallenAantal) return null;
  return {
    id: 'crediteuren', soort: 'factuur', aantal: c.vervallenAantal,
    kop: 'U bent te laat met ' + c.vervallenAantal + ' factu' +
      (c.vervallenAantal === 1 ? 'ur' : 'ren') + ' (' + Math.round(c.vervallenBedrag) + ' euro)',
    waarom: c.oudste
      ? 'De oudste staat ' + c.oudste.dagenOver + ' dagen open. Een leverancier die niet betaald wordt, levert op enig moment niet meer.'
      : 'Een leverancier die niet betaald wordt, levert op enig moment niet meer.'
  };
}

module.exports.TEKSTEN = TEKSTEN;
module.exports.crediteurenOpvolging = crediteurenOpvolging;

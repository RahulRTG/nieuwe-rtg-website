/* DE ONDERNEMERSREGIE: twee knoppen van de boardroom.

   RTG bepaalt zelf hoe streng of hoe soepel het Ondernemers-OS staat. Dat gaat
   over twee dingen die niets met elkaar te maken hebben, en die hier daarom ook
   apart staan:

     1. PROVISIONING -- wanneer wordt de ZAAK klaargezet. Drie standen.
     2. BIJDRAGE     -- wat RTG per transactie inhoudt. Uit, of een percentage.

   EEN ONDERSCHEID DAT NOOIT MAG VERVAGEN. Een ZAAK klaarzetten (de leverancier,
   de beheer-inlog, het bedrijfsdorp) is operationeel werk. Een PAS toekennen
   (Lifestyle, Business) is toegang verlenen tot RTG zelf, en dat is en blijft
   mensenwerk -- kern/aanmeldingen.js: `magAutomatischToekennen` geeft voor geen
   enkele pas true, en dat verandert deze module niet. De knop hieronder raakt
   uitsluitend het eerste. Zou hij het tweede ook regelen, dan stond er een
   schuifje waarmee iemand per ongeluk de merkregel uitzet.

   DE STANDEN, van streng naar soepel:

     mens        -> RTG-personeel beoordeelt elke aanvraag. De zaak komt er pas
                    na een akkoord. Dit is de stand van vandaag.
     na-termijn  -> geen aparte beoordeling; de zaak komt er zodra de eerste
                    termijn is afgetekend. Het menselijke oordeel verschuift
                    naar de betaalcontrole.
     automatisch -> wie een onderneming aanmaakt en zijn plan vastlegt, krijgt
                    direct een werkende zaak.

   SOEPELER ZETTEN VRAAGT EEN NAAM, STRENGER ZETTEN NOOIT. Hetzelfde principe
   als de bankregie: een terugval blokkeer je niet. Opschuiven naar een soepeler
   stand betekent dat het systeem straks zonder mens partners toelaat, en zo'n
   besluit hoort nooit anoniem te zijn. Elke wijziging komt in een journaal met
   wie hem zette.

   DE BIJDRAGE HEEFT DRIE DINGEN NODIG, EN GEEN ERVAN WORDT GERADEN:
   het percentage (ten hoogste 5), de GRONDSLAG (waarover precies), en de
   drempel waaronder er niets wordt ingehouden. Die drempel is geen coulance
   maar het punt van de hele constructie: bij lage omzet hoort de bijdrage
   beschermend te werken, niet mee te zuigen. */
'use strict';

const STANDEN = ['mens', 'na-termijn', 'automatisch'];
const RANG = { mens: 0, 'na-termijn': 1, automatisch: 2 };

/* De grondslagen. Er is er geen "standaard juiste": ze meten iets anders, en
   welke er geldt is een besluit dat opgeschreven hoort te staan. */
const GRONDSLAGEN = {
  'via-rtg': {
    label: 'Omzet via RTG',
    wat: 'Alleen wat via RTG is verkocht of gefactureerd. Het enige dat RTG zelf kan meten.',
    let: 'Wat een zaak buiten RTG omzet, telt niet mee -- dat kunnen wij niet zien en dus ook niet controleren.'
  },
  'betaald': {
    label: 'Betaalde omzet via RTG',
    wat: 'Alleen transacties die daadwerkelijk zijn afgerekend.',
    let: 'Beschermender voor de ondernemer: over een factuur die nooit binnenkomt, draagt hij niets af.'
  },
  'totaal': {
    label: 'Totale omzet van de onderneming',
    wat: 'Alle omzet, ook buiten RTG.',
    let: 'RTG kan dit NIET meten. Deze grondslag rust volledig op opgave door de ondernemer en vraagt dus een controle die er nu niet is.'
  }
};

const MAX_PROMILLE = 50;   // ten hoogste 5,0% -- in promille, zodat 2,5% exact is

module.exports = ({ db, save }) => {

  const eigen = require('../eigencollectie')({ db, domein: 'kern/onderneming/regie', bezit: { ondernemersregie: 'kaart' } });

  function d() {
    const r = eigen.bak('ondernemersregie');
    if (!STANDEN.includes(r.provisioning)) r.provisioning = 'mens';
    if (!r.bijdrage || typeof r.bijdrage !== 'object') r.bijdrage = {};
    const b = r.bijdrage;
    if (typeof b.aan !== 'boolean') b.aan = false;
    if (!Number.isFinite(b.promille)) b.promille = 0;
    if (!GRONDSLAGEN[b.grondslag]) b.grondslag = 'via-rtg';
    if (!Number.isFinite(b.drempelCenten)) b.drempelCenten = 0;
    if (!Array.isArray(r.journaal)) r.journaal = [];
    return r;
  }

  const nu = () => new Date().toISOString();

  function noteer(wat, van, naar, door) {
    const r = d();
    r.journaal.unshift({ wat, van, naar, door: String(door || '').slice(0, 60) || 'onbekend', at: nu() });
    r.journaal = r.journaal.slice(0, 200);
  }

  /* ---- de provisioning-stand ---- */

  const provisioningStand = () => d().provisioning;

  function provisioningZet(stand, door) {
    if (!STANDEN.includes(stand)) {
      return { status: 400, error: 'Onbekende stand.', standen: STANDEN };
    }
    const r = d();
    const van = r.provisioning;
    if (van === stand) return { ok: true, stand, ongewijzigd: true };
    /* Soepeler zetten vraagt een naam; strenger zetten mag altijd. Zie de kop. */
    const soepeler = RANG[stand] > RANG[van];
    const naam = String(door || '').trim();
    if (soepeler && naam.length < 2) {
      return { status: 400,
        error: 'Voor een soepeler stand is een naam nodig.',
        uitleg: 'Vanaf deze stand laat het systeem partners toe zonder dat een mens ernaar kijkt. Zo\'n besluit hoort nooit anoniem te zijn.' };
    }
    r.provisioning = stand;
    noteer('provisioning', van, stand, naam);
    save();
    return { ok: true, stand, van, soepeler };
  }

  /* ---- de bijdrage ---- */

  function bijdrageZet(body, door) {
    const b = body || {};
    const r = d();
    const oud = JSON.parse(JSON.stringify(r.bijdrage));

    if (b.grondslag !== undefined) {
      if (!GRONDSLAGEN[b.grondslag]) return { status: 400, error: 'Onbekende grondslag.', grondslagen: Object.keys(GRONDSLAGEN) };
      r.bijdrage.grondslag = b.grondslag;
    }
    if (b.promille !== undefined) {
      const p = Number(b.promille);
      if (!Number.isFinite(p) || p < 0) return { status: 400, error: 'Het percentage moet een getal van nul of hoger zijn.' };
      if (p > MAX_PROMILLE) {
        return { status: 400,
          error: 'De bijdrage is ten hoogste ' + (MAX_PROMILLE / 10) + '%.',
          uitleg: 'Die bovengrens staat in de code en niet in een instelling, zodat hij niet per ongeluk hoger wordt gezet.' };
      }
      r.bijdrage.promille = Math.round(p);
    }
    if (b.drempelCenten !== undefined) {
      const c = Number(b.drempelCenten);
      if (!Number.isFinite(c) || c < 0) return { status: 400, error: 'De drempel moet nul of hoger zijn.' };
      r.bijdrage.drempelCenten = Math.round(c);
    }
    if (b.aan !== undefined) {
      const aan = !!b.aan;
      if (aan) {
        const naam = String(door || '').trim();
        if (naam.length < 2) {
          return { status: 400, error: 'Voor het aanzetten van de bijdrage is een naam nodig.',
            uitleg: 'Vanaf dat moment wordt er geld ingehouden op transacties van ondernemers. Zo\'n besluit hoort nooit anoniem te zijn.' };
        }
        if (!r.bijdrage.promille) {
          return { status: 409, error: 'Zet eerst een percentage.',
            uitleg: 'Een bijdrage die aanstaat op nul procent is een schakelaar die niets doet en wel zo lijkt.' };
        }
      }
      r.bijdrage.aan = aan;
    }
    noteer('bijdrage', JSON.stringify(oud), JSON.stringify(r.bijdrage), door);
    save();
    return { ok: true, bijdrage: beeldBijdrage() };
  }

  /* De bijdrage over een bedrag in centen. Geeft ALTIJD dezelfde vorm terug,
     ook als er niets wordt ingehouden -- een aanroeper die soms wel en soms
     geen uitleg krijgt, leest hem niet meer uit.

     `viaRtg` zegt of deze transactie via RTG loopt. Bij de grondslag 'via-rtg'
     en 'betaald' telt alleen dan mee; bij 'totaal' zou het ook buiten RTG
     moeten, en dat kunnen wij niet zien -- vandaar de waarschuwing daar. */
  function bijdrageOver({ centen, viaRtg, betaald }) {
    const b = d().bijdrage;
    const bedrag = Math.max(0, Math.round(Number(centen) || 0));
    const basis = { grondslag: b.grondslag, promille: b.promille, aan: b.aan,
      drempelCenten: b.drempelCenten, over: bedrag };

    if (!b.aan) return Object.assign({ centen: 0, reden: 'De bijdrage staat uit.' }, basis);
    if (!b.promille) return Object.assign({ centen: 0, reden: 'Er is geen percentage ingesteld.' }, basis);
    if (b.grondslag !== 'totaal' && viaRtg === false) {
      return Object.assign({ centen: 0, reden: 'Deze transactie loopt niet via RTG.' }, basis);
    }
    if (b.grondslag === 'betaald' && betaald === false) {
      return Object.assign({ centen: 0, reden: 'Er is nog niet afgerekend.' }, basis);
    }
    if (bedrag < b.drempelCenten) {
      return Object.assign({ centen: 0,
        reden: 'Onder de drempel. Bij lage omzet hoort de bijdrage beschermend te werken, niet mee te zuigen.' }, basis);
    }
    return Object.assign({ centen: Math.round(bedrag * b.promille / 1000), reden: null }, basis);
  }

  function beeldBijdrage() {
    const b = d().bijdrage;
    const g = GRONDSLAGEN[b.grondslag];
    return {
      aan: b.aan, promille: b.promille, percentage: b.promille / 10,
      maxPercentage: MAX_PROMILLE / 10,
      grondslag: b.grondslag, grondslagLabel: g.label, grondslagWat: g.wat, grondslagLet: g.let,
      drempelCenten: b.drempelCenten,
      grondslagen: Object.entries(GRONDSLAGEN).map(([id, x]) => Object.assign({ id }, x))
    };
  }

  function regieBeeld() {
    const r = d();
    return {
      provisioning: {
        stand: r.provisioning, standen: STANDEN,
        uitleg: {
          mens: 'RTG-personeel beoordeelt elke aanvraag; de zaak komt er pas na een akkoord.',
          'na-termijn': 'Geen aparte beoordeling; de zaak komt er zodra de eerste termijn is afgetekend.',
          automatisch: 'Wie een onderneming aanmaakt en zijn plan vastlegt, krijgt direct een werkende zaak.'
        },
        let: 'Deze knop gaat over het klaarzetten van de ZAAK. Een PAS toekennen blijft mensenwerk, in elke stand.'
      },
      bijdrage: beeldBijdrage(),
      journaal: r.journaal.slice(0, 25)
    };
  }

  return { REGIE_STANDEN: STANDEN, REGIE_GRONDSLAGEN: GRONDSLAGEN,
    provisioningStand, provisioningZet, bijdrageZet, bijdrageOver, regieBeeld };
};

module.exports.STANDEN = STANDEN;
module.exports.GRONDSLAGEN = GRONDSLAGEN;
module.exports.MAX_PROMILLE = MAX_PROMILLE;

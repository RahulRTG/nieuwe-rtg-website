/* HET ONDERNEMINGSPLAN: alles wat we weten, in één stuk.

   HET LEVENDE PLAN WORDT ELKE KEER OPNIEUW GEBOUWD en nergens bewaard. Zou het
   als kopie in de database staan, dan is het verouderd zodra de intake wijzigt,
   en dan bestaan er twee waarheden over hetzelfde bedrijf (regel 4). Wie het
   plan opvraagt, krijgt dus altijd het plan van nu.

   WAT WEL WORDT BEWAARD IS DE BESLISSING. `vastleggen` zet een VERSIE in het
   archief: een bevroren momentopname met de datum, het oordeel van de stress
   test en -- als dat oordeel 'niet starten' was -- de uitdrukkelijke keuze om
   toch door te gaan. Dat is geen dubbele waarheid maar een ander soort feit:
   niet "hoe staat het bedrijf ervoor" maar "wat wist deze mens toen hij besloot".
   Dat tweede hoort onveranderlijk te zijn, juist als het eerste verandert.

   HET VASTLEGGEN IS DE FASE-OVERGANG. `plan.vastgelegd` is precies het feit
   waar ./fase.js op kijkt om van 'idee' naar 'validatie' te gaan. Er is dus
   geen aparte knop die een fase zet -- de fase volgt uit wat er gebeurd is.

   EN EEN 'NIET STARTEN' IS ADVIES, GEEN SLOT. Wie na de waarschuwing toch wil
   doorzetten, mag dat -- met `tochDoorzetten`, en die keuze komt met de reden
   in het archief te staan. Het alternatief zou zijn dat software een mens
   verbiedt te ondernemen omdat een rekensom dat vindt, en dat is niet aan ons.
   Wat wel aan ons is: zorgen dat niemand kan zeggen dat hij het niet wist. */
'use strict';

const HOOFDSTUKKEN = ['samenvatting', 'ondernemer', 'idee', 'markt', 'strategie',
  'financieel', 'risicos', 'besluit'];

module.exports = ({ intakeOntbreekt, save }) => {

  const nu = () => new Date().toISOString();
  const eur = (n) => (n === null || n === undefined ? null : Math.round(n));

  /* De hoofdstukken, elk uit de bron die hem hoort te vullen. Waar een bron
     ontbreekt staat dat er, en niet een opgevulde zin -- een ondernemingsplan
     met verzonnen alinea's is gevaarlijker dan een kort ondernemingsplan. */
  function bouwHoofdstukken(o, kans, sim, stress) {
    const i = o.intake || { persoon: {}, idee: {} };
    const p = i.persoon || {}, d = i.idee || {};
    const basis = sim && sim.ok ? sim.scenarios.basis : null;

    return {
      samenvatting: basis ? {
        tekst: (d.wat || 'Een onderneming') + ' in ' + (d.plaats || 'nader te bepalen') +
          ', gericht op ' + (d.doelgroep || 'een nader te bepalen doelgroep') + '.' +
          ' In het basisscenario komt de jaaromzet uit op ' + eur(basis.jaar.omzet) +
          ' met een brutomarge van ' + basis.jaar.margePercentage + '%.',
        oordeel: stress && stress.ok ? stress.oordeel : null
      } : { tekst: null, ontbreekt: 'Zonder doorgerekend plan is er geen samenvatting te maken.' },

      ondernemer: {
        urenPerWeek: p.urenPerWeek ?? null, ervaringJaren: p.ervaringJaren ?? null,
        vaardigheden: p.vaardigheden || [], samen: p.samen || null,
        verkoopervaring: p.verkoopervaring ?? null, startkapitaal: p.startkapitaal ?? null
      },

      idee: {
        branche: d.branche || null, wat: d.wat || null, doelgroep: d.doelgroep || null,
        plaats: d.plaats || null, onderscheid: d.onderscheid || null,
        verkoopmodel: d.verkoopmodel || null
      },

      /* De markt is de kansverkenning, mét haar grondslag. Die reist mee en
         wordt hier niet tot één cijfer platgeslagen. */
      markt: kans ? {
        score: kans.score, oordeel: kans.oordeel, bronnen: kans.bronnen,
        grondslag: kans.grondslag, voorbehoud: kans.voorbehoud || kans.uitleg || null
      } : { ontbreekt: 'De kansverkenning is niet uitgevoerd.' },

      strategie: {
        onderscheid: d.onderscheid || null,
        verdienmodel: d.verkoopmodel || null,
        prijs: d.prijs ?? null, kostprijs: d.kostprijs ?? null,
        margePerEenheid: (d.prijs >= 0 && d.kostprijs >= 0) ? Math.round((d.prijs - d.kostprijs) * 100) / 100 : null
      },

      financieel: basis ? {
        scenarios: Object.fromEntries(Object.entries(sim.scenarios).map(([k, s]) => [k, {
          label: s.label, jaaromzet: eur(s.jaar.omzet), jaarresultaat: eur(s.jaar.resultaat),
          margePercentage: s.jaar.margePercentage, eindkas: eur(s.eindkas),
          runwayMaanden: s.runwayMaanden
        }])),
        aannames: sim.aannames, voorbehoud: sim.voorbehoud
      } : { ontbreekt: 'De simulatie kon niet rekenen.', mist: (sim && sim.ontbreekt) || null },

      risicos: stress && stress.ok ? {
        oordeel: stress.oordeel, toelichting: stress.toelichting,
        bevindingen: stress.bevindingen, sterk: stress.sterk,
        nietGetoetst: stress.nietGetoetst
      } : { ontbreekt: 'De stress test is niet uitgevoerd.' },

      besluit: {
        vastgelegd: !!(o.plan && o.plan.vastgelegd),
        versies: ((o.plan && o.plan.versies) || []).length,
        laatste: (o.plan && o.plan.versies && o.plan.versies[o.plan.versies.length - 1]) || null
      }
    };
  }

  function planBouw(o, kans, sim, stress) {
    const mist = intakeOntbreekt(o.intake || {}, 'plan');
    return {
      ok: true,
      volledig: !(mist && mist.length),
      ontbreekt: mist,
      hoofdstukken: bouwHoofdstukken(o, kans, sim, stress),
      opgesteld: nu(),
      voorbehoud: 'Dit plan is opgesteld uit uw eigen opgave en uit data binnen RTG. Het is geen financieel, fiscaal of juridisch advies.'
    };
  }

  /* Vastleggen: de beslissing het archief in. Weigert alleen als het plan nog
     niet compleet is of als een 'niet starten' niet uitdrukkelijk is
     overgenomen -- niet omdat wij het er niet mee eens zijn. */
  function planVastleggen(o, plan, stress, body) {
    if (!plan.volledig) {
      return { status: 400, error: 'Het plan is nog niet compleet.', ontbreekt: plan.ontbreekt };
    }
    const oordeel = stress && stress.ok ? stress.oordeel : null;
    const toch = !!(body || {}).tochDoorzetten;
    if (oordeel === 'niet starten' && !toch) {
      return {
        status: 409,
        error: 'De stress test adviseert dit model niet te starten.',
        oordeel, toelichting: stress.toelichting,
        blokkerend: stress.bevindingen.filter(b => b.zwaarte === 'blokkerend'),
        uitleg: 'U mag dit plan alsnog vastleggen, maar dan leggen we die keuze er met dit advies bij vast. Stuur tochDoorzetten mee als u dat wilt.'
      };
    }
    if (!o.plan) o.plan = { vastgelegd: false, versies: [] };
    if (!Array.isArray(o.plan.versies)) o.plan.versies = [];
    const versie = {
      nummer: o.plan.versies.length + 1,
      at: nu(),
      oordeel,
      tochDoorzetten: oordeel === 'niet starten' ? true : false,
      /* De bevroren momentopname: wat wist deze mens toen hij besloot. Zie de
         kop -- dit mag juist NIET meebewegen met latere wijzigingen. */
      samenvatting: plan.hoofdstukken.samenvatting,
      financieel: plan.hoofdstukken.financieel,
      risicos: plan.hoofdstukken.risicos
    };
    o.plan.versies.push(versie);
    o.plan.vastgelegd = true;   // hier verschuift de fase naar 'validatie'
    save();
    return { ok: true, versie, vastgelegd: true };
  }

  return { PLAN_HOOFDSTUKKEN: HOOFDSTUKKEN, planBouw, planVastleggen };
};

module.exports.HOOFDSTUKKEN = HOOFDSTUKKEN;

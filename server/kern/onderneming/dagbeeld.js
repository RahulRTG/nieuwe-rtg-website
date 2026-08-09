/* HET DAGBEELD: het ene scherm.

   De ondernemer hoort geen modules te zien. Hij opent zijn bedrijf en ziet waar
   hij staat, wat er vandaag toe doet, en wat hij daaraan kan doen. Deze module
   stelt dat samen uit de drie assen en uit de echte data -- en hij is
   FASE-BEWUST, want dat is de hele belofte: een idee heeft geen debiteuren en
   een groep heeft geen intakevragen meer.

   WAT DIT NIET DOET: cijfers verzinnen om het scherm te vullen. Een onderneming
   in de ideefase heeft geen omzet, en dan staat er geen "€0" maar niets --
   nul is een gemeten waarde en die suggereert dat er verkocht had kunnen worden.
   Elk cijfer draagt daarom `gemeten`, en het scherm toont alleen wat gemeten is.

   DE GEZONDHEID IS EEN METER (lat-regel 10) en loopt via ./meter.js, dezelfde
   rekenwijze als de kansverkenning. Vóór de eerste klant is er niets te meten
   en komt er dus geen cijfer, met de reden erbij. Een bedrijf dat gisteren
   begon en vandaag een 60 krijgt, heeft een cijfer over niets.

   DE ACTIES ZIJN DE KERN VAN HET SCHERM. Ze komen uit de werkelijke staat en
   staan op volgorde van wat er het meest toe doet: een blokkerende bevinding
   uit de stress test gaat vóór een ontbrekend intakeveld, en dat gaat vóór
   "denk eens aan een rechtsvorm". */
'use strict';

const meter = require('./meter');

/* Onder twee meetbare bronnen geen gezondheidscijfer. Zelfde drempel als de
   kansverkenning, en om dezelfde reden. */
const MIN_BRONNEN = 2;
const MAX_PUNTEN = 25;

/* De groet per fase. Geen aanmoediging zonder inhoud: elke regel zegt wat deze
   fase IS, zodat het scherm ook uitlegt waarom het toont wat het toont. */
const GROET = {
  idee: 'U verkent een idee. Er hoeft nog niets te kloppen -- eerst uitzoeken of het kan.',
  validatie: 'Uw plan ligt er. Nu is de vraag of het standhoudt.',
  oprichting: 'De onderneming bestaat. Nu alles eromheen regelen.',
  eersteklant: 'U bent begonnen. Alles draait nu om klant nummer één.',
  tractie: 'Er is vraag. De vraag is nu of ze terugkomen.',
  werkgever: 'U heeft mensen in dienst. Dat verandert waar u op stuurt.',
  vestigingen: 'Meerdere locaties. Draaien ze allemaal even goed?',
  groep: 'Een groep. U stuurt niet meer op één bedrijf maar op het geheel.'
};

module.exports = ({ db, boekingenVanZaak, ordersVanZaak, intakeOntbreekt }) => {

  const maandStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString(); };

  /* ---- de cijfers ----
     Alleen wat er echt is. `gemeten:false` betekent "hier valt niets te meten",
     en het scherm laat die rij weg in plaats van er een nul neer te zetten. */
  function cijfers(o, feiten, zaak) {
    const uit = [];
    if (!zaak) {
      return [{ id: 'nog-geen-zaak', label: 'Omzet', gemeten: false,
        reden: 'Er is nog geen zaak gekoppeld, dus er valt nog niets te meten.' }];
    }
    const vanaf = maandStart();
    const boekingen = (boekingenVanZaak(zaak.code) || []);
    const orders = (ordersVanZaak(zaak.code) || []);
    const dezeMaand = boekingen.filter(b => b && b.paid && String(b.at || '') >= vanaf);
    const omzet = dezeMaand.reduce((s, b) => s + (Number(b.price) || 0), 0);

    uit.push({ id: 'omzet', label: 'Omzet deze maand', gemeten: true,
      waarde: Math.round(omzet), eenheid: 'euro' });
    uit.push({ id: 'klanten', label: 'Klanten', gemeten: true, waarde: feiten.klanten, eenheid: 'totaal' });

    const wacht = boekingen.filter(b => b && b.status === 'aangevraagd').length;
    uit.push({ id: 'wachtend', label: 'Wacht op uw antwoord', gemeten: true, waarde: wacht, eenheid: 'aanvragen' });

    if (feiten.personeel > 0) {
      uit.push({ id: 'personeel', label: 'Mensen in dienst', gemeten: true, waarde: feiten.personeel, eenheid: 'personen' });
    }
    uit.push({ id: 'bonnen', label: 'Bonnen', gemeten: true, waarde: orders.length, eenheid: 'totaal' });
    return uit;
  }

  /* ---- de gezondheid ----
     Vier bronnen. Drie ervan hebben een draaiende zaak nodig; de vierde (ligt
     er een vastgelegd plan) is altijd meetbaar, want dat weten we zeker.

     Gevolg, en het is de bedoeling: een onderneming zonder zaak heeft één
     meetbare bron en krijgt dus GEEN cijfer. Een bedrijf dat gisteren begon en
     vandaag een 60 krijgt, heeft een cijfer over niets.

     Een bron is meetbaar of niet, en meetbaar betekent altijd: mét punten. Een
     bron die allebei half is, is een bron die niemand meer kan uitlezen. */
  function planBron(o) {
    const vast = !!(o.plan && o.plan.vastgelegd);
    return { id: 'plan', label: 'Plan', gemeten: true, waarde: vast ? 'vastgelegd' : 'geen',
      punten: vast ? MAX_PUNTEN : 8, max: MAX_PUNTEN,
      uitleg: vast ? 'U heeft een doorgerekend plan vastgelegd.' : 'Er ligt nog geen doorgerekend plan.' };
  }

  function gezondheid(o, feiten, zaak) {
    if (!zaak) {
      const geen = (id, label) => ({ id, label, gemeten: false, reden: 'Er is nog geen zaak gekoppeld.' });
      return meter.scoreUit([geen('omzet', 'Omzet'), geen('klanten', 'Klanten'),
        geen('opvolging', 'Opvolging'), planBron(o)], MIN_BRONNEN);
    }

    const boekingen = (boekingenVanZaak(zaak.code) || []);
    const vanaf = maandStart();
    const omzet = boekingen.filter(b => b && b.paid && String(b.at || '') >= vanaf)
      .reduce((s, b) => s + (Number(b.price) || 0), 0);
    const wacht = boekingen.filter(b => b && b.status === 'aangevraagd').length;

    const bronnen = [
      omzet > 0
        ? { id: 'omzet', label: 'Omzet', gemeten: true, waarde: Math.round(omzet), eenheid: 'euro deze maand',
            punten: omzet >= 5000 ? MAX_PUNTEN : omzet >= 1000 ? 17 : 9, max: MAX_PUNTEN,
            uitleg: 'Er komt geld binnen deze maand.' }
        : { id: 'omzet', label: 'Omzet', gemeten: false, reden: 'Deze maand is er nog geen betaalde omzet.' },

      { id: 'klanten', label: 'Klanten', gemeten: true, waarde: feiten.klanten, eenheid: 'klanten',
        punten: feiten.klanten >= 25 ? MAX_PUNTEN : feiten.klanten >= 10 ? 18 : feiten.klanten >= 1 ? 10 : 3,
        max: MAX_PUNTEN,
        uitleg: feiten.klanten ? 'U heeft ' + feiten.klanten + ' klant(en).' : 'Nog geen enkele klant.' },

      boekingen.length
        ? { id: 'opvolging', label: 'Opvolging', gemeten: true, waarde: wacht, eenheid: 'open aanvragen',
            punten: wacht === 0 ? MAX_PUNTEN : wacht <= 3 ? 15 : 5, max: MAX_PUNTEN,
            uitleg: wacht ? wacht + ' aanvra(a)g(en) wachten op uw antwoord.' : 'Niets blijft liggen.' }
        : { id: 'opvolging', label: 'Opvolging', gemeten: false, reden: 'Er zijn nog geen aanvragen geweest.' },

      planBron(o)
    ];
    return meter.scoreUit(bronnen, MIN_BRONNEN);
  }

  /* De acties staan in ./dagbeeld-acties.js -- dit bestand ging over de 10 kB
     van het modulebeleid, en dat is de goede naad: daar wat de ondernemer moet
     DOEN, hier wat het scherm TOONT. */
  const { acties } = require('./dagbeeld-acties')({ boekingenVanZaak, intakeOntbreekt });

  /* Het hele beeld. Krijgt de verkenning mee in plaats van hem zelf te draaien:
     de route heeft hem toch al, en twee keer rekenen zou twee antwoorden kunnen
     geven op dezelfde vraag. */
  function dagbeeld(o, beeld, verk, project, eersteklant, mall, rel, deb, cred, con, bel, kas, cap, wrv, pij) {
    const feiten = beeld.feiten;
    const zaak = o.supplierCode ? (db.data.suppliers || []).find(s => s.code === o.supplierCode) : null;
    return {
      ok: true,
      naam: beeld.naam,
      fase: beeld.fase,
      groet: GROET[beeld.fase] || null,
      volgende: beeld.volgende,
      ladder: beeld.ladder,
      cijfers: cijfers(o, feiten, zaak),
      gezondheid: gezondheid(o, feiten, zaak),
      acties: acties(o, feiten, verk, project, eersteklant, mall, rel, deb, cred, con, bel, kas, cap, wrv, pij),
      oprichting: project || null,
      eersteklant: eersteklant || null,
      mall: mall || null,
      relaties: rel || null,
      debiteuren: deb || null,
      crediteuren: cred || null,
      contracten: con || null,
      belasting: bel || null,
      kas: kas || null,
      capaciteit: cap || null,
      werving: wrv || null,
      pijplijn: pij || null,
      rechtsvorm: beeld.rechtsvorm,
      caps: beeld.caps
    };
  }

  return { DAGBEELD_GROET: GROET, dagbeeld };
};

module.exports.GROET = GROET;
module.exports.MIN_BRONNEN = MIN_BRONNEN;

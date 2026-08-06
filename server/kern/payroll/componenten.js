/* Payroll OS: HET LOONCOMPONENTENREGISTER.

   WAAROM DIT GEEN VELDEN ZIJN. De verleiding is om `bonus`, `nachttoeslag` en
   `kilometervergoeding` als kolommen te bouwen. Dat werkt precies tot de
   tweede sector: een horecabedrijf wil fooien en maaltijdinhouding, een
   vervoerder wachttijd en ritvergoeding, een school een eindejaarsuitkering. Wie
   daar velden voor bijbouwt, schrijft de loonmotor elke keer opnieuw en heeft
   binnen een jaar twee berekeningen die uit elkaar lopen.

   Een component is daarom een REGEL, geen veld. De motor kent maar vier
   soorten en verder niets:

     bruto      -- verhoogt het brutoloon (uren, toeslag, bonus, vakantiegeld)
     inhouding  -- gaat er bruto af (pensioen werknemer, loonbeslag)
     netto      -- raakt alleen het nettoloon (onbelaste vergoeding, voorschot)
     werkgever  -- kost de werkgever geld maar staat niet op het nettoloon

   Alles wat een sector nodig heeft is een rij in dit register, niet een tak in
   de code.

   WAT ER PER COMPONENT VASTLIGT, en waarom elk veld er is:

     belast              -- telt hij mee voor de loonheffing? Zonder dit veld
                            moet de motor gokken, en een gok in een grondslag is
                            een fout in elke strook die erop volgt.
     grondslagen         -- WELKE grondslagen precies. "Belast" is niet genoeg:
                            een eindejaarsuitkering telt wel voor de heffing
                            maar niet altijd voor de premies.
     pensioengevend      -- aparte vraag, ander antwoord dan belast.
     vakantiegeldgevend  -- idem. Fooien vaak niet, overuren vaak wel.
     bijzonder           -- is dit loon dat NIET bij deze periode hoort
                            (vakantiegeld, bonus, dertiende maand)? Dan gaat het
                            tegen het bijzondere tarief en wordt het niet
                            meegeherleid naar een jaarloon. Ontbreekt de vlag,
                            dan is het gewoon periodeloon -- de veilige kant,
                            want dat is wat verreweg het meeste loon is.
     invoerbron          -- waar de waarde vandaan MAG komen. Een component die
                            uit de klok komt, hoort niemand met de hand te
                            kunnen intypen; dat is precies het gat waar
                            uren-fraude doorheen loopt.
     goedkeuring         -- wie hem moet aftekenen voor hij meetelt.
     grootboek           -- waar hij in de boekhouding landt, zodat de loonrun
                            en het journaal niet uit elkaar kunnen lopen.
     geldigVan/Tot       -- componenten komen en gaan (een cao-toeslag die
                            vervalt). Verwijderen mag niet: oude stroken moeten
                            leesbaar blijven.

   NIETS HIERVAN BEVAT BEDRAGEN. Een component zegt WAT iets is, niet hoeveel.
   Het hoeveel komt uit het contract, de klok of een goedgekeurde invoer. */
'use strict';

const SOORTEN = ['bruto', 'inhouding', 'netto', 'werkgever'];
const BRONNEN = ['klok', 'contract', 'rooster', 'handmatig', 'motor', 'koppeling'];
const GOEDKEURING = ['geen', 'manager', 'administrateur'];

/* De basisset. Bewust klein: dit is wat elke werkgever nodig heeft, niet een
   catalogus van alles wat denkbaar is. Een sector voegt zijn eigen rijen toe.
   De sleutels zijn stabiel -- ze staan straks in stroken van jaren geleden. */
const BASIS = [
  { sleutel: 'basissalaris', naam: 'Basissalaris', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: true, vakantiegeldgevend: true,
    invoerbron: 'contract', goedkeuring: 'geen', grootboek: '4000' },
  { sleutel: 'gewerkte_uren', naam: 'Gewerkte uren', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: true, vakantiegeldgevend: true,
    invoerbron: 'klok', goedkeuring: 'manager', grootboek: '4000' },
  { sleutel: 'overuren_125', naam: 'Overuren 125%', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: false, vakantiegeldgevend: true,
    invoerbron: 'klok', goedkeuring: 'manager', grootboek: '4010' },
  { sleutel: 'nachttoeslag', naam: 'Nachttoeslag', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: false, vakantiegeldgevend: true,
    invoerbron: 'klok', goedkeuring: 'manager', grootboek: '4011' },
  /* Vakantiegeld is BIJZONDER loon: het hoort niet bij deze maand. Zonder die
     vlag wordt het meeherleid naar een jaarloon -- maal twaalf -- en jaagt een
     enkele uitbetaling de hele strook een schijf omhoog. Zie loonheffing.js. */
  { sleutel: 'vakantiegeld', naam: 'Vakantiegeld', soort: 'bruto', belast: true, bijzonder: true,
    grondslagen: ['loonheffing', 'premies', 'zvw'], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'motor', goedkeuring: 'geen', grootboek: '4020' },
  { sleutel: 'fooi', naam: 'Fooi', soort: 'bruto', belast: true,
    grondslagen: ['loonheffing'], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'handmatig', goedkeuring: 'manager', grootboek: '4030' },
  { sleutel: 'pensioen_werknemer', naam: 'Pensioen (werknemersdeel)', soort: 'inhouding', belast: false,
    grondslagen: [], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'motor', goedkeuring: 'geen', grootboek: '4100' },
  { sleutel: 'loonbeslag', naam: 'Loonbeslag', soort: 'inhouding', belast: false,
    grondslagen: [], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'handmatig', goedkeuring: 'administrateur', grootboek: '4110' },
  { sleutel: 'kilometervergoeding', naam: 'Kilometervergoeding', soort: 'netto', belast: false,
    grondslagen: [], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'handmatig', goedkeuring: 'manager', grootboek: '4200' },
  { sleutel: 'maaltijdinhouding', naam: 'Maaltijdinhouding', soort: 'netto', belast: false,
    grondslagen: [], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'handmatig', goedkeuring: 'manager', grootboek: '4210' },
  { sleutel: 'werkgeverslasten', naam: 'Werkgeverslasten', soort: 'werkgever', belast: false,
    grondslagen: [], pensioengevend: false, vakantiegeldgevend: false,
    invoerbron: 'motor', goedkeuring: 'geen', grootboek: '4300' }
];

function keur(c) {
  const bez = [];
  if (!c || typeof c !== 'object') return ['Geen component ontvangen.'];
  if (!/^[a-z][a-z0-9_]{1,39}$/.test(String(c.sleutel || '')))
    bez.push('sleutel ontbreekt of mag alleen kleine letters, cijfers en _ bevatten.');
  if (!c.naam) bez.push('naam ontbreekt.');
  if (!SOORTEN.includes(c.soort)) bez.push('soort moet een van ' + SOORTEN.join(', ') + ' zijn.');
  if (typeof c.belast !== 'boolean') bez.push('belast moet true of false zijn -- niet leeg.');
  if (!Array.isArray(c.grondslagen)) bez.push('grondslagen moet een lijst zijn (mag leeg).');
  if (c.belast && Array.isArray(c.grondslagen) && !c.grondslagen.length)
    bez.push('belast zonder grondslagen: zeg WELKE grondslagen, anders moet de motor gokken.');
  if (!c.belast && Array.isArray(c.grondslagen) && c.grondslagen.length)
    bez.push('onbelast maar met grondslagen: dat spreekt elkaar tegen.');
  if (c.bijzonder != null && typeof c.bijzonder !== 'boolean') bez.push('bijzonder moet true of false zijn.');
  if (c.bijzonder === true && !c.belast)
    bez.push('bijzonder maar onbelast: het bijzondere tarief is een tarief voor BELAST loon.');
  if (!BRONNEN.includes(c.invoerbron)) bez.push('invoerbron moet een van ' + BRONNEN.join(', ') + ' zijn.');
  if (!GOEDKEURING.includes(c.goedkeuring)) bez.push('goedkeuring moet een van ' + GOEDKEURING.join(', ') + ' zijn.');
  return bez;
}

function maakComponenten({ db, save, nu }) {
  const tijd = nu || (() => new Date().toISOString());

  function bak() {
    if (!db.data.payrollComponenten || typeof db.data.payrollComponenten !== 'object') {
      db.data.payrollComponenten = {};
      // de basisset komt er een keer in; daarna is hij gewoon te wijzigen
      for (const c of BASIS) db.data.payrollComponenten[c.sleutel] =
        Object.assign({}, c, { geldigVan: null, geldigTot: null, basis: true, at: tijd() });
      save();
    }
    return db.data.payrollComponenten;
  }

  const alle = () => Object.values(bak());
  const een = (sleutel) => bak()[String(sleutel || '')] || null;

  /* Geldig op een datum. Een component die vervalt verdwijnt niet -- stroken
     van vorig jaar moeten leesbaar blijven -- maar telt niet meer mee. */
  function geldigOp(datum) {
    const d = String(datum || '').slice(0, 10);
    return alle().filter(c => (!c.geldigVan || c.geldigVan <= d) && (!c.geldigTot || c.geldigTot >= d));
  }

  function zet(component, door) {
    const bez = keur(component);
    if (bez.length) return { status: 422, error: 'Deze looncomponent is afgekeurd.', bezwaren: bez };
    const b = bak();
    const oud = b[component.sleutel];
    b[component.sleutel] = Object.assign({}, oud || {}, component, { at: tijd(), door: door || null });
    save();
    return { ok: true, component: b[component.sleutel], nieuw: !oud };
  }

  return { alle, een, geldigOp, zet, keur, SOORTEN, BRONNEN, GOEDKEURING, BASIS };
}

module.exports = { maakComponenten, keur, SOORTEN, BRONNEN, GOEDKEURING, BASIS };

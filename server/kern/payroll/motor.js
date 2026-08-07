/* Payroll OS: DE LOONMOTOR.

   EEN BEREKENING, EN HIJ MOET VIER VRAGEN KUNNEN BEANTWOORDEN:

     1. Waarom is dit bedrag berekend?   -> elke regel draagt zijn component,
                                            zijn invoer en zijn tussenstap
     2. Welke regel en versie zijn gebruikt? -> het versie-id van het
                                            regelpakket staat op de strook
     3. Wie heeft goedgekeurd?           -> de run (./run.js), niet de motor
     4. Waar geboekt, aangegeven, betaald? -> het grootboek per component

   HERHAALBAAR BETEKENT: DEZELFDE INVOER, DEZELFDE UITKOMST, ALTIJD. Daarom
   neemt de motor niets uit de omgeving. Geen `new Date()`, geen "het huidige
   tarief", geen lezen uit de database. Alles komt binnen als argument:
   het contract zoals het gold, de uren, de componentwaarden, en het
   REGELPAKKET (niet het land -- de VERSIE). Een run over juni die in september
   wordt overgedaan levert tot op de cent hetzelfde op.

   IN CENTEN, NIET IN EURO'S. Een loonstrook opgeteld uit floats loopt na
   twintig regels een cent uit de pas, en die cent staat in het loonjournaal
   tegenover de bank. Alles hier is een geheel getal in centen; delen wordt aan
   het eind afgerond, en de afronding staat als eigen stap in de strook zodat
   ook die te volgen is.

   WAT DE MOTOR NIET DOET: opslaan, goedkeuren, betalen, aangeven. Hij rekent.
   Dat is met opzet: een rekenaar die ook bewaart, is niet te toetsen zonder
   database, en een loonmotor moet je juist wel duizend keer kunnen doorrekenen. */
'use strict';

const loonheffing = require('./loonheffing');
const valuta = require('./valuta');

/* De grondslagen en de tarieftoepassing staan in ./motor-grondslag.js -- zie
   daar waarom ze bij elkaar horen. */
const { grondslagVan, pas, rondCenten } = require('./motor-grondslag');

/* ---------------------------------------------------------------------------
   bereken({ contract, periode, invoer, regelpakket, componenten })

   contract    { uurloonCenten, urenPerWeek, soort, ... } zoals het GOLD in de
               periode -- de aanroeper zoekt de juiste versie op, de motor niet
   periode     { van, tot } -- alleen om op de strook te zetten
   invoer      [{ component, aantal?, centen? }] -- uren uit de klok, toeslagen,
               vergoedingen, inhoudingen
   regelpakket het pakket van ./regelpakket.js, met versie
   componenten { sleutel: component } uit ./componenten.js

   Levert een strook met regels, tussenstappen en totalen -- alles in centen. */
function bereken({ contract, periode, invoer, regelpakket, componenten }) {
  if (!regelpakket || !regelpakket.versie) throw new TypeError('bereken() vraagt een regelpakket met een versie');
  if (!componenten) throw new TypeError('bereken() vraagt het componentenregister');
  const comp = componenten;
  const stappen = [];
  const regels = [];
  const onbekend = [];

  /* 1. De invoer naar regels. Een component die niet in het register staat
        wordt NIET stilzwijgend genegeerd en ook niet gegokt: hij komt als
        bezwaar terug. Een bedrag zonder classificatie is precies wat er niet
        op een loonstrook hoort. */
  for (const rij of (invoer || [])) {
    const c = comp[rij.component];
    if (!c) { onbekend.push(rij.component); continue; }
    let centen = rij.centen;
    if (centen == null && rij.aantal != null) {
      const tarief = rij.tariefCenten != null ? rij.tariefCenten : contract.uurloonCenten;
      centen = rondCenten(rij.aantal * tarief);
      stappen.push({ stap: rij.component, uitleg: rij.aantal + ' x ' + tarief + ' cent', centen });
    }
    if (centen == null) { onbekend.push(rij.component + ' (geen aantal en geen bedrag)'); continue; }
    regels.push({ component: rij.component, naam: c.naam, soort: c.soort,
      aantal: rij.aantal != null ? rij.aantal : null, centen: rondCenten(centen),
      grootboek: c.grootboek || null });
  }
  if (onbekend.length) {
    return { fout: 'Onbekende of onvolledige looncomponenten', onbekend };
  }

  /* 2. Vakantiegeld over wat vakantiegeldgevend is. Als eigen regel, niet als
        opslag in een ander bedrag -- anders is op de strook niet te zien
        waarover het is opgebouwd. */
  const vgGrondslag = regels.reduce((s, r) =>
    s + ((comp[r.component] || {}).vakantiegeldgevend && comp[r.component].soort === 'bruto' ? r.centen : 0), 0);
  const vg = pas(regelpakket, 'vakantiegeld', vgGrondslag);
  if (vg && vg.centen) {
    regels.push({ component: 'vakantiegeld', naam: (comp.vakantiegeld || {}).naam || 'Vakantiegeld',
      soort: 'bruto', aantal: null, centen: vg.centen, grootboek: (comp.vakantiegeld || {}).grootboek || null });
    stappen.push({ stap: 'vakantiegeld', uitleg: 'over ' + vgGrondslag + ' cent', regel: vg.regel,
      tarief: vg.tarief, centen: vg.centen });
  }

  /* 3. Bruto, en de grondslagen eronder. */
  const bruto = regels.filter(r => r.soort === 'bruto').reduce((s, r) => s + r.centen, 0);
  const gLoonheffing = grondslagVan(regels, comp, 'loonheffing');
  const gPremies = grondslagVan(regels, comp, 'premies');
  const gZvw = grondslagVan(regels, comp, 'zvw');
  stappen.push({ stap: 'bruto', centen: bruto });
  stappen.push({ stap: 'grondslagen', loonheffing: gLoonheffing, premies: gPremies, zvw: gZvw });

  /* 4. Loonheffing. Draagt het pakket een jaartabel, dan gaat het via
        ./loonheffing.js: herleiden naar een jaarloon, over de schijven, de
        heffingskortingen eraf, terug naar de periode. Draagt het alleen een vlak
        percentage, dan doet diezelfde module dat -- en zegt in de stap dat het
        vlak was, want dat is een uitspraak over de betrouwbaarheid van dit
        bedrag.

        HET BIJZONDERE LOON GAAT APART. Vakantiegeld en een bonus zijn geen loon
        over deze maand. Tel je ze bij het periodeloon op, dan worden ze
        meeherleid naar een jaarloon (maal twaalf!) en jaagt een enkele
        vakantiegeldbetaling de hele strook een schijf omhoog. De component
        zegt zelf of hij bijzonder is (componenten.js: `bijzonder`). */
  const gBijzonder = grondslagVan(regels, comp, 'loonheffing', (c) => c.bijzonder === true);
  const gRegulier = gLoonheffing - gBijzonder;
  const heffing = loonheffing.bereken({ regelpakket, grondslagCenten: gRegulier,
    bijzonderCenten: gBijzonder, betaling: contract.betaling });
  if (!heffing) return { fout: 'Het regelpakket ' + regelpakket.versie +
    ' kent geen loonheffing: geen schijven en geen vlak tarief.' };
  stappen.push({ stap: 'loonheffing', regel: heffing.regel, soort: heffing.soort,
    tarief: heffing.tarief != null ? heffing.tarief : null,
    grondslag: gLoonheffing, regulier: gRegulier, bijzonder: gBijzonder,
    centen: heffing.centen, versie: regelpakket.versie });
  for (const s of heffing.stappen) stappen.push(s);

  /* 5. Inhoudingen uit de invoer (pensioen, loonbeslag). */
  const inhoudingen = regels.filter(r => r.soort === 'inhouding').reduce((s, r) => s + r.centen, 0);

  /* 6. Netto. De nettocomponenten (onbelaste vergoeding, inhouding op netto)
        komen er als laatste bij, na de belasting -- dat is per definitie wat
        "netto" betekent en het is de plek waar het vaakst misgaat. */
  const nettoRegels = regels.filter(r => r.soort === 'netto').reduce((s, r) => s + r.centen, 0);
  const netto = bruto - heffing.centen - inhoudingen + nettoRegels;
  stappen.push({ stap: 'netto', uitleg: 'bruto - loonheffing - inhoudingen + netto-componenten', centen: netto });

  /* 7. Werkgeverslasten: kosten voor de werkgever, geen deel van het nettoloon. */
  const premies = pas(regelpakket, 'premies.tarief', gPremies);
  const zvw = pas(regelpakket, 'zvw', gZvw);
  const lasten = (premies ? premies.centen : 0) + (zvw ? zvw.centen : 0);
  if (premies) stappen.push({ stap: 'premies', regel: premies.regel, tarief: premies.tarief, grondslag: gPremies, centen: premies.centen });
  if (zvw) stappen.push({ stap: 'zvw', regel: zvw.regel, tarief: zvw.tarief, grondslag: gZvw, centen: zvw.centen });

  return {
    periode: periode || null,
    /* DE VALUTA STAAT OP DE STROOK. Elk bedrag hieronder is een geheel getal in
       de KLEINSTE EENHEID van deze munt -- honderdsten in Nederland, hele yen
       in Japan, duizendsten in Koeweit. De veldnamen zeggen "Centen" en dat is
       een historische naam, geen natuurwet; zie ./valuta.js.

       Zonder valuta op het pakket wordt EUR aangenomen, en dat staat er dan
       ook bij (`aangenomen: true`). Een aanname die je kunt lezen is een
       aanname die iemand kan tegenspreken; een stille aanname niet. */
    valuta: { code: (regelpakket.valuta || 'EUR').toUpperCase(),
      decimalen: valuta.decimalenVan(regelpakket.valuta || 'EUR'),
      aangenomen: !regelpakket.valuta },
    regelpakket: { versie: regelpakket.versie, land: regelpakket.land, stand: regelpakket.stand },
    contract: { uurloonCenten: contract.uurloonCenten, soort: contract.soort || null,
      urenPerWeek: contract.urenPerWeek != null ? contract.urenPerWeek : null },
    regels, stappen,
    brutoCenten: bruto,
    loonheffingCenten: heffing.centen,
    inhoudingenCenten: inhoudingen,
    nettoCenten: netto,
    werkgeverslastenCenten: lasten,
    kostenWerkgeverCenten: bruto + lasten
  };
}

/* De controles staan in ./motor-controle.js -- de motor rekent, hij oordeelt
   niet. Ze komen hier weer naar buiten omdat elke aanroeper ze samen gebruikt
   en een tweede require op elke plek alleen maar iets is om te vergeten. */
const { controleer } = require('./motor-controle');

module.exports = { bereken, controleer, grondslagVan };

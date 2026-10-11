/* VRIJHEID: DE BRON VAN HET VAKANTIESALDO -- aangesloten op wat er al is, en
   de rekenregel blijft open tot iemand hem vaststelt.

   Er komt GEEN tweede saldoregister. Het recht wordt bij elke vraag opnieuw
   gerekend uit drie bestaande waarheden, en verder niets:

     dienstverband  het teambeeld (./teambeeld.js), dat het leest uit
                    kern/concern/employment.js -- employment aan een entiteit
                    is de waarheid (ARBEID.md par. 7a)
     arbeidsduur    de contractversie in de payroll (kern/payroll/contracten.js,
                    `urenPerWeek` en `soort`), dezelfde die de loonrun leest
     opgenomen      de eigen boekingen van de motor (index.js), en het
                    verzuimregister voor vakantie die LANGS EEN ANDERE WEG is
                    gemeld (de oude verlofroute schrijft daar zonder `bron`)

   DE REKENREGEL STAAT, EN DE POORT IS DICHT (besluit B1, 11 oktober 2026).
   De berekening is ./vakantieregel.js: art. 7:634 BW (viermaal de arbeidsduur
   per week, naar rato over een deel van het jaar), naar rato PER contractversie
   bij wisselende arbeidsduur, en art. 7:635 BW voor tijdvakken uit het
   verzuimregister (ziekte: de opbouw loopt door). De factor komt uit het beleid
   (`verlof.wettelijkWekenPerJaar`, laag LEGAL_BASELINE), die ./huis.js zet
   voor een zaak met een Nederlandse vestiging.

   De uitkomst heet `berekend` en draagt de graad `vermoed`. Hij wordt pas
   `wettelijk` -- het recht waar een verlofbesluit op leunt -- als de
   productiepoort (./vakantiepoort.js) open is, en die opent alleen de eigenaar
   na de juridische toets. Tot dan is `wettelijk` null met de reden, en wordt
   een vakantieverzoek UNKNOWN (./besluit.js).

   Wat de regel NIET rekent, blijft open met de reden: een contract zonder
   vaste omvang, meer dan een contract bij deze zaak, ouderschaps- en
   zorgverlof, vakantie die langs de verlofroute in DAGEN is gemeld, en elke
   zaak die niet in Nederland staat. Bovenwettelijk verlof staat in geen enkel
   contract (contracten.js kent dat veld niet), dus `contractueel` is altijd
   `null` met die reden.

   Wat de medewerker hier leest is zijn EIGEN contract: arbeidsduur, soort en
   de ingangsdatum van zijn dienstverband. Geen uurloon, en niets van een ander. */
'use strict';
const regel = require('./vakantieregel');
const { DICHT } = require('./vakantiepoort');

const REGEL = regel.REGEL;
const GRAAD_DICHT = 'vermoed';

/* poort: () => ({ open, reden }) uit ./vakantiepoort.js. Zonder poort is hij
   DICHT -- een ontbrekende grendel is nooit een open grendel. */
module.exports = ({ bronnen, poort }) => {
  const poortStand = () => {
    try { const p = poort && poort(); if (p && p.open === true) return p; return { open: false, reden: (p && p.reden) || DICHT }; }
    catch (e) { return { open: false, reden: 'De productiepoort van de rekenregel is niet te lezen; hij geldt als gesloten.' }; }
  };

  /* rechten van EEN mens bij EEN zaak over EEN kalenderjaar.
     mens: de rij uit het teambeeld ({ id, inDienst }). */
  function verlofrechten(code, mens, jaar, beleid) {
    const k = bronnen();
    const j = String(jaar);
    const jaarVan = j + '-01-01', jaarTot = j + '-12-31';
    const waarom = [];
    const bron = { dienstverband: null, contract: null, regel: null };

    const dv = mens && mens.inDienst;
    if (!dv) waarom.push('Er loopt geen dienstverband bij de entiteit van deze zaak; zonder werkgever is er geen recht om te rekenen.');
    else bron.dienstverband = { van: dv.van, tot: dv.tot || null };

    const vest = k.vestigingVanUnit ? k.vestigingVanUnit(code) : null;
    if (vest && vest.land && String(vest.land).toUpperCase() !== 'NL')
      waarom.push('Deze zaak staat in ' + vest.land + '; de rekenregel volgt Nederlands recht (art. 7:634 BW) en geldt hier niet.');

    const c = k.payrollOS && k.payrollOS.contracten;
    let versies = null;
    if (!c) waarom.push('De payroll is er niet; de arbeidsduur per week is nergens te lezen.');
    else if (mens) {
      const nrs = c.nummersVan(code, mens.id);
      if (!nrs.length) waarom.push('Er is geen arbeidscontract vastgelegd in de payroll; de arbeidsduur per week is onbekend.');
      else if (nrs.length > 1) waarom.push('Er lopen ' + nrs.length + ' contracten bij deze zaak; hoe die samen het recht vormen is niet vastgesteld.');
      else {
        versies = c.geschiedenis(code, mens.id, nrs[0]);
        /* Wat Mijn tijd toont: de versie die nu (of aan het eind van het jaar) geldt. */
        const v = c.opDatum(code, mens.id, jaarTot, nrs[0]) || versies.filter(x => x.vanaf <= jaarTot).pop() || null;
        if (v) bron.contract = { soort: v.soort, urenPerWeek: v.urenPerWeek != null ? v.urenPerWeek : null, vanaf: v.vanaf, tot: v.tot || null };
      }
    }

    const vz = k.payrollOS && k.payrollOS.verzuim;
    let verzuim = [];
    if (mens && vz && typeof vz.zonderBron === 'function') {
      const ander = vz.zonderBron(code, mens.id, jaarVan, jaarTot).filter(m => m.soort === 'vakantie');
      if (ander.length) waarom.push(ander.length + ' vakantiemelding(en) in ' + j + ' kwamen langs de verlofroute en staan in dagen; dit saldo telt in uren, en die omrekening is niet vastgesteld.');
      verzuim = typeof vz.voorPayroll === 'function' ? vz.voorPayroll(code, mens.id, jaarVan, jaarTot) : [];
    } else if (mens) waarom.push('Het verzuimregister is er niet; vakantie en ziekte die langs een andere weg zijn gemeld, kunnen niet worden meegeteld.');

    const r = beleid.waarde(REGEL);
    if (r.open) waarom.push(r.reden);
    else bron.regel = { weken: r.waarde, laag: r.laag, bron: r.bron, versie: regel.REGELVERSIE };

    /* De berekening zelf: alleen als de bronnen er zijn. Wat de regel nog open
       vindt, komt bij de reden; een getal staat er alleen als niets open is. */
    let berekend = null;
    if (!waarom.length) {
      const uit = regel.reken({ jaar: j, dienstverband: dv, versies, verzuim, weken: r.waarde });
      if (uit.open.length) waarom.push(...uit.open);
      else berekend = { uren: uit.uren, graad: GRAAD_DICHT, perioden: uit.perioden, zonderOpbouw: uit.zonderOpbouw,
        artikelen: regel.ARTIKELEN.map(a => a.artikel), regelVersie: regel.REGELVERSIE };
    }

    /* DE POORT. Een berekening wordt pas een recht als de eigenaar de regel na
       de juridische toets heeft vrijgegeven. */
    const p = poortStand();
    let wettelijk = null;
    if (berekend && p.open) { berekend.graad = 'gemeten'; wettelijk = berekend.uren; }
    else if (berekend) waarom.push('Volgens de rekenregel (' + berekend.artikelen.join(', ') + ') zou het recht ' + berekend.uren +
      ' uur zijn, graad ' + GRAAD_DICHT + '. ' + p.reden + ' Geen verlofbesluit kent vakantie toe op dit getal.');
    bron.berekening = berekend;
    bron.poort = { open: !!p.open, reden: p.open ? null : p.reden };

    return {
      wettelijk,
      contractueel: null,
      bron,
      waarom: {
        wettelijk: waarom.length ? waarom.join(' ') : null,
        contractueel: 'Het arbeidscontract (kern/payroll/contracten.js) draagt geen bovenwettelijk verlof; er is geen bron om het uit te lezen.'
      }
    };
  }

  return { verlofrechten, REGEL };
};

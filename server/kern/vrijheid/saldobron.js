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

   DE REKENREGEL IS OPEN. In Nederland is het wettelijke minimum een veelvoud
   van de arbeidsduur per week (art. 7:634 BW). Dat staat als beleidsvariabele
   `verlof.wettelijkWekenPerJaar` in de laag LEGAL_BASELINE (./beleid.js), en
   NIEMAND zet hem: hoe die regel voor deze laag uitpakt is niet juridisch
   getoetst. Zolang hij open is, is het recht `null` met de reden -- nooit een
   geraden getal. Ook als iemand hem zet, rekent deze module alleen het
   eenvoudigste geval, en zegt bij alle andere waarom niet:

     - het dienstverband loopt niet het hele kalenderjaar     (naar rato: open)
     - de arbeidsduur verandert in dat jaar                   (naar rato: open)
     - een contract zonder vaste omvang (oproep, nuluren ...) (gewerkte uren: open)
     - meer dan een contract bij deze zaak                    (samenstellen: open)
     - vakantie die langs de verlofroute in DAGEN is gemeld   (omrekenen: open)

   Bovenwettelijk verlof staat in geen enkel contract (contracten.js kent dat
   veld niet), dus `contractueel` is altijd `null` met die reden.

   Wat de medewerker hier leest is zijn EIGEN contract: arbeidsduur, soort en
   de ingangsdatum van zijn dienstverband. Geen uurloon, en niets van een ander. */
'use strict';
const { heeftVasteOmvang } = require('../payroll/samenstellen-rekenhulp');

const REGEL = 'verlof.wettelijkWekenPerJaar';

module.exports = ({ bronnen }) => {
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
    else {
      bron.dienstverband = { van: dv.van, tot: dv.tot || null };
      if (dv.van > jaarVan || (dv.tot && dv.tot < jaarTot))
        waarom.push('Het dienstverband loopt niet het hele jaar ' + j + ' (vanaf ' + dv.van + '); naar rato rekenen is niet vastgesteld.');
    }

    const c = k.payrollOS && k.payrollOS.contracten;
    if (!c) waarom.push('De payroll is er niet; de arbeidsduur per week is nergens te lezen.');
    else if (mens) {
      const nrs = c.nummersVan(code, mens.id);
      if (!nrs.length) waarom.push('Er is geen arbeidscontract vastgelegd in de payroll; de arbeidsduur per week is onbekend.');
      else if (nrs.length > 1) waarom.push('Er lopen ' + nrs.length + ' contracten bij deze zaak; hoe die samen het recht vormen is niet vastgesteld.');
      else {
        /* Een nieuwe versie VERVANGT de vorige (contracten.js: `tot` is het einde
           van het contract, niet van de versie). Wat in dit jaar geldt is dus de
           versie op 1 januari plus wat er in het jaar ingaat -- een loonsverhoging
           van vorig jaar is geen wijziging van de arbeidsduur in dit jaar. */
        const begin = c.opDatum(code, mens.id, jaarVan, nrs[0]);
        const erin = c.geschiedenis(code, mens.id, nrs[0]).filter(x => x.vanaf > jaarVan && x.vanaf <= jaarTot);
        const v = erin.length ? erin[erin.length - 1] : begin;
        const anders = (x) => !begin || x.urenPerWeek !== begin.urenPerWeek || x.soort !== begin.soort;
        if (v) bron.contract = { soort: v.soort, urenPerWeek: v.urenPerWeek != null ? v.urenPerWeek : null, vanaf: v.vanaf, tot: v.tot || null };
        if (!v) waarom.push('Geen contractversie geldt in ' + j + '.');
        else if (!begin || erin.some(anders) || (v.tot && v.tot < jaarTot))
          waarom.push('De arbeidsduur verandert in ' + j + ' of het contract loopt niet het hele jaar; naar rato rekenen is niet vastgesteld.');
        else if (!heeftVasteOmvang(v))
          waarom.push('Een ' + v.soort + '-contract heeft geen vaste arbeidsduur per week; dan hangt het recht aan de gewerkte uren, en die rekenregel is niet vastgesteld.');
      }
    }

    /* Wat er LANGS EEN ANDERE WEG staat dan een besluit met een `bron` (de oude
       verlofroute, een melding van de leidinggevende). verzuim.zonderBron leest
       alleen: zo telt Vrijheid vakantie mee die het zelf niet boekte, zonder een
       tweede register. */
    const vz = k.payrollOS && k.payrollOS.verzuim;
    if (mens && vz && typeof vz.zonderBron === 'function') {
      const ander = vz.zonderBron(code, mens.id, jaarVan, jaarTot).filter(m => m.soort === 'vakantie');
      if (ander.length) waarom.push(ander.length + ' vakantiemelding(en) in ' + j + ' kwamen langs de verlofroute en staan in dagen; dit saldo telt in uren, en die omrekening is niet vastgesteld.');
    } else if (mens) waarom.push('Het verzuimregister is er niet; vakantie die langs een andere weg is gemeld, kan niet worden meegeteld.');

    const r = beleid.waarde(REGEL);
    if (r.open) waarom.push(r.reden);
    else bron.regel = { weken: r.waarde, laag: r.laag, bron: r.bron };

    const wettelijk = waarom.length ? null : Math.round(r.waarde * bron.contract.urenPerWeek * 100) / 100;
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

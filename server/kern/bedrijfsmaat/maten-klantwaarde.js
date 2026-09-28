/* Bedrijfsmaten, deel KLANTWAARDE: een geslaagde uitkomst per wereld (besluit C3,
   27 september 2026). Vier maten NAAST elkaar, elk met zijn eigen wereld (C1) en
   zijn eigen groepspoort, en met opzet geen totaal (INT-04). Vorm en regels staan
   in ./index.js; dit bestand is alleen gegevens. */
'use strict';
const c = (bestand, citaat) => ({ bestand, citaat });
const DEF = 'server/kern/bedrijfsmaat/definities.js', KW = 'server/kern/bedrijfsmaat/klantwaarde.js';
const STAND = 'server/kern/bedrijfsmaat/stand.js';

const kw = (id, wereld, privacy, minGroep, eenheid, betekenis, berekening, bron, def, fn, poort, gedeeltelijk) => ({
  id, domein: 'uitkomst', wereld, eenheid, betekenis, berekening, actualiteit: 'live', privacy, minGroep,
  eigenaar: 'kern/bedrijfsmaat', graad: 'gemeten', afhankelijk: [], bron, definitie: [c(DEF, def)],
  projectie: [c(KW, 'function ' + fn)], bewijs: [c(STAND, "kwMaat('" + id + "'")], groepsgrens: [c(STAND, poort)],
  gedeeltelijk, waarom: {} });

module.exports = [
  kw('uitkomst.klantwaarde-living', 'consument', 'leden', 10, 'uitkomsten per maand',
    'Ritten en bestellingen die tot het einde liepen, in LivingOS.',
    'afgeronde ritten plus bezorgde of opgehaalde bestellingen in de maand; de poort telt leden',
    [c('server/kern/vervoer.js', 'r.finishedAt = new Date().toISOString()')], 'klantwaardeLiving: d27(1', 'klantwaardeLiving',
    'DEFINITIES.klantwaardeLiving, LEDEN, kw.living', 'Alleen ritten en bestellingen; boekingen bij zaken en servicezaken nog niet.'),
  kw('uitkomst.klantwaarde-travel', 'consument', 'leden', 10, 'reizen per maand',
    'Reizen van het RTG-reisbureau die thuis zijn.',
    'reisaanvragen met de stand thuis en een thuiskomst in de maand; de poort telt leden',
    [c('server/kern/reisbureau-thuis.js', "a.status = 'thuis'")], 'klantwaardeTravel: d27(1', 'klantwaardeTravel',
    'DEFINITIES.klantwaardeTravel, LEDEN, kw.travel', 'Een reis die niemand thuis meldt, telt niet mee; reizen buiten het reisbureau ook niet.'),
  kw('uitkomst.klantwaarde-work', 'commercieel', 'zaken', 5, 'loonruns per maand',
    'Loonruns die definitief werden, in WorkOS.',
    'loonruns met de stand definitief en definitiefOp in de maand; de poort telt zaken',
    [c('server/kern/payroll/run.js', "run.stand = 'definitief'")], 'klantwaardeWork: d27(1', 'klantwaardeWork',
    "DEFINITIES.klantwaardeWork, { privacy: 'zaken', minGroep: 5 }, kw.work", 'Alleen de payrollmotor van nu (payrollRunsV2); de oude loonruns tellen niet mee.'),
  kw('uitkomst.klantwaarde-foundation', 'rtfoundation', 'gezinnen', 10, 'hulpvragen per maand',
    'Hulpvragen van de RTFoundation die zijn afgerond met een hulpactie in het dossier.',
    'casussen met een dag van afronden in de maand; de poort telt casussen, nooit per gezin',
    [c('server/kern/rtfos/casus-keten.js', 'c.afgerondOp = new Date()')], 'klantwaardeFoundation: d27(1', 'klantwaardeFoundation',
    "DEFINITIES.klantwaardeFoundation, { privacy: 'gezinnen', minGroep: 10 }, kw.foundation", 'Casussen die voor 27 september 2026 zijn afgerond, hebben geen dag van afronden.')
];

/* ============================================================================
   DE GELDKAART VAN MAGNAAT WORLD -- ronde A2, stap 1: de inventaris.

   Elke plek in World waar geld ontstaat, verdwijnt of van eigenaar wisselt,
   met de ECONOMISCHE gebeurtenis die er werkelijk plaatsvindt. Er verandert
   hier nog niets aan World: dit is de kaart waarop de migratie per categorie
   wordt gelopen (MAGNAAT.md par. 8).

   test/magnaatgeldkaart.test.js houdt hem compleet en eerlijk:
     - elke plek die de meter vindt, is precies een been van een gebeurtenis
     - elk been wijst naar code die er nog staat (geen verouderde kaart)
     - elke gebeurtenis heeft een betekenis uit de gesloten lijst hieronder, een
       van, een naar en een tegenzijde
   Een nieuwe geldplek zonder classificatie laat die toets dus zakken.

   SINDS RONDE A2.1 staat al dit geld in hele eurocenten en gaat elk bedrag een
   keer door de canonieke functie (server/kern/spellen/magnaat/centen.js). Wat
   de benen hieronder dus niet meer zijn, is ONGEWIS in precisie; wat ze nog
   steeds zijn, is een directe saldomutatie zonder grootboek (A2.3 t/m A2.9).

   VORM PER GEBEURTENIS
     id           G01 ...
     betekenis    uit BETEKENISSEN: wat er economisch gebeurt
     van, naar    wie betaalt en wie ontvangt: een rol uit PARTIJEN hieronder,
                  nooit een speler-id. Sinds ronde A2.2 is dat besloten: de vijf
                  tegenpartijen staan in server/kern/spellen/magnaat/boekhouding.js
     delen        bij een samengestelde gebeurtenis: per deel [van, naar]
     tegenzijde   hoe het vandaag geboekt staat:
                    overdracht  van een speler naar een ander, beide benen hier
                    elders      het andere been staat op een andere plek
                    bron        geld ontstaat: niemand betaalt het
                    put         geld verdwijnt: niemand ontvangt het
                    pot         naar of uit de Foundation-pot van de stad
     benen        [{ bestand, code, na? }]: de regel die de mutatie draagt,
                  letterlijk. `na` is de eerstvolgende niet-lege regel, voor
                  als dezelfde code twee keer in een bestand staat.
     samengesteld bij een regel die meer dan een gebeurtenis verbergt: welke
     categorie    de migratiestap (CATEGORIEEN), in de volgorde van MAGNAAT.md
     gemigreerd   de ronde waarin de gebeurtenis door het grootboek ging (A2.3 ...).
                  Het been wijst dan naar de boeking (`beweeg` in
                  server/kern/spellen/magnaat/boekhouding.js) en niet meer naar een
                  directe mutatie; de telling van de meter gaat erdoor omlaag.
     let          wat de migratie moet weten en niet mag gladstrijken
   ========================================================================== */
'use strict';

const MAP = 'server/kern/spellen/magnaat/';

/* De betekenissen. Waar de A1-motor al een woord heeft, is dat woord gebruikt
   (server/kern/magnaat-economische-motor/constanten.js): een tweede woordenlijst
   voor hetzelfde ding is precies de botsing die SEMANTIEK.json telt. */
const BETEKENISSEN = [
  'OPENING', 'VERKOOP', 'INKOOP', 'LOON', 'VASTE_LASTEN', 'HUUR', 'MARKETING', 'ONDERHOUD',
  'INVESTERING', 'DESINVESTERING', 'WERVING_AFVLOEIING',
  'CONTRACT_VOORUITBETALING', 'CONTRACT_BETALING', 'CONTRACT_BOETE', 'CONTRACT_AFKOOP',
  'RESULTAATDELING', 'AANDELENKOOP', 'VEILING_GUNNING',
  'LENING', 'AFLOSSING', 'RENTE', 'UITWINNING',
  'PREMIE', 'SCHADE', 'UITKERING', 'FOUNDATION_AFDRACHT', 'FOUNDATION_PROJECT'
];

const CATEGORIEEN = ['opening', 'overdracht', 'financiering', 'verzekering', 'activa', 'maandresultaat', 'foundation'];
const TEGENZIJDEN = ['overdracht', 'elders', 'bron', 'put', 'pot'];

/* Wie er aan een kant van een gebeurtenis kan staan: een rol van een speler, de
   Foundation-pot, de inleg (het eigen vermogen tegenover de opening), of een van
   de vijf tegenpartijen van ronde A2.2. Een gesloten lijst, zodat een nieuwe
   partij een besluit is en geen tikfout. */
const SPELERROLLEN = ['speler', 'wederpartij', 'afnemer', 'leverancier', 'koper', 'eigenaar van nu',
  'winnaar', 'verkoper of Foundation-pot', 'eigenaar vestiging', 'aandeelhouder'];
const PARTIJEN = SPELERROLLEN.concat(['Foundation-pot', 'inleg', 'bank', 'huishoudens', 'aannemer', 'verzekeraar', 'stad']);

const b = (bestand, code, na) => (na ? { bestand: MAP + bestand, code, na } : { bestand: MAP + bestand, code });

const GEBEURTENISSEN = [
  { id: 'G01', betekenis: 'OPENING', categorie: 'opening', van: 'inleg', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.3',
    benen: [b('boekhouding.js', "beweeg(st, { soort: 'OPENING', van: ['inleg', h], naar: ['kas', h], bedrag, omschrijving: 'Startkapitaal' });")],
    let: 'legitieme creatie, maar zonder inlegrekening: de beginbalans heeft geen passivakant' },

  { id: 'G02', betekenis: 'INVESTERING', categorie: 'activa', van: 'speler', naar: 'aannemer', tegenzijde: 'put', gemigreerd: 'A2.7',
    benen: [b('acties.js', "beweeg(st, { soort: 'INVESTERING', van: ['kas', h], naar: ['macro', 'aannemer'], bedrag: bouwCenten, omschrijving: 'Bouw vestiging' });")],
    let: 'geen kosten maar kas tegen een activum: de bouwsom staat als v.gebouwdVoor op de vestiging en nergens op een balans' },
  { id: 'G03', betekenis: 'INVESTERING', categorie: 'activa', van: 'speler', naar: 'aannemer', tegenzijde: 'put', gemigreerd: 'A2.7',
    benen: [b('acties.js', "beweeg(st, { soort: 'INVESTERING', van: ['kas', h], naar: ['macro', 'aannemer'], bedrag: uitbreidCenten, omschrijving: 'Uitbreiding vestiging' });")],
    let: 'uitbreiden: zelfde vorm als G02' },
  { id: 'G04', betekenis: 'WERVING_AFVLOEIING', categorie: 'maandresultaat', van: 'speler', naar: 'huishoudens', tegenzijde: 'put', gemigreerd: 'A2.8',
    benen: [b('acties.js', "beweeg(st, { soort: 'WERVING_AFVLOEIING', van: ['kas', h], naar: ['macro', 'huishoudens'], bedrag: personeelCenten, omschrijving: 'Werving of afvloeiing' });")],
    let: 'een maandloon per verschil in personeel, in beide richtingen' },
  { id: 'G05', betekenis: 'DESINVESTERING', categorie: 'activa', van: 'aannemer', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.7',
    benen: [b('acties.js', "beweeg(st, { soort: 'DESINVESTERING', van: ['macro', 'aannemer'], naar: ['kas', h], bedrag: opbrengst, omschrijving: 'Sluiten vestiging' });")],
    let: 'de halve bouwsom ontstaat uit niets; de andere helft is een afboeking van het activum die vandaag nergens staat' },

  { id: 'G06', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('acties.js', "beweeg(st, { soort: 'CONTRACT_AFKOOP', van: ['kas', h], naar: ['kas', tegen], bedrag: som, omschrijving: 'Afkoop bij sluiten' });")],
    let: 'afkoop bij zelf sluiten' },
  { id: 'G07', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('afscheid.js', "beweeg(st, { soort: 'CONTRACT_AFKOOP', van: ['kas', h], naar: ['kas', tegen], bedrag: som, omschrijving: 'Afkoop bij afscheid' });")],
    let: 'afkoop bij uitwinning of verkoop van de vestiging' },
  { id: 'G08', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('handel-acties.js', "beweeg(st, { soort: 'CONTRACT_AFKOOP', van: ['kas', h], naar: ['kas', tegen], bedrag: som, omschrijving: 'Afkoop' });")],
    let: 'afkoop bij opzeggen' },
  { id: 'G09', betekenis: 'CONTRACT_VOORUITBETALING', categorie: 'overdracht', van: 'afnemer', naar: 'leverancier', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('handel-acties.js', "beweeg(st, { soort: 'CONTRACT_VOORUITBETALING', van: ['kas', c.afnemer], naar: ['kas', c.leverancier], bedrag: vooraf, omschrijving: 'Vooruitbetaling contract' });")] },
  { id: 'G10', betekenis: 'CONTRACT_BETALING', categorie: 'overdracht', van: 'afnemer', naar: 'leverancier', tegenzijde: 'elders', gemigreerd: 'A2.8',
    benen: [b('maand-contracten.js', "beweeg(st, { soort: 'CONTRACT_BETALING', van: ['kas', c.afnemer], naar: ['contract', c.id], bedrag, omschrijving: 'Betaling contract' });")],
    let: 'de afnemer betaalt NA de maand op een overlopende rekening per contract, en de leverancier krijgt het IN de maand daarvan (G12). Zo blijft het moment van beide kanten wat het voor A2.8 was; aan het eind van de maand staat die rekening op nul. Sinds A2.1 is het bedrag per contract EEN keer in centen vastgesteld' },
  { id: 'G11', betekenis: 'CONTRACT_BOETE', categorie: 'overdracht', van: 'leverancier', naar: 'afnemer', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('maand-contracten.js', "beweeg(st, { soort: 'CONTRACT_BOETE', van: ['kas', c.leverancier], naar: ['kas', c.afnemer], bedrag: boete, omschrijving: 'Boete wegens tekort' });")] },

  { id: 'G12', betekenis: 'VERKOOP', categorie: 'maandresultaat', van: 'huishoudens', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.8',
    samengesteld: ['VERKOOP', 'CONTRACT_BETALING', 'INKOOP', 'LOON', 'VASTE_LASTEN', 'HUUR', 'MARKETING', 'ONDERHOUD'],
    delen: { VERKOOP: ['huishoudens', 'speler'], CONTRACT_BETALING: ['afnemer', 'leverancier'], INKOOP: ['speler', 'stad'],
      LOON: ['speler', 'huishoudens'], VASTE_LASTEN: ['speler', 'stad'], HUUR: ['speler', 'stad'], MARKETING: ['speler', 'stad'], ONDERHOUD: ['speler', 'stad'] },
    benen: [b('maand-contracten.js', "beweeg(st, { soort: 'VERKOOP', van: ['macro', 'huishoudens'], naar: ['kas', h], bedrag: d.VERKOOP });"), b('maand-contracten.js', "if (c.leverancierId === vestigingId) { beweeg(st, { soort: 'CONTRACT_BETALING', van: ['contract', c.id], naar: ['kas', h], bedrag: betaling[c.id] }); }"), b('maand-contracten.js', "beweeg(st, { soort: 'INKOOP', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.INKOOP });"), b('maand-contracten.js', "beweeg(st, { soort: 'LOON', van: ['kas', h], naar: ['macro', 'huishoudens'], bedrag: d.LOON });"), b('maand-contracten.js', "beweeg(st, { soort: 'VASTE_LASTEN', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.VASTE_LASTEN });"), b('maand-contracten.js', "beweeg(st, { soort: 'HUUR', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.HUUR });"), b('maand-contracten.js', "beweeg(st, { soort: 'MARKETING', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.MARKETING });"), b('maand-contracten.js', "beweeg(st, { soort: 'ONDERHOUD', van: ['kas', h], naar: ['macro', 'stad'], bedrag: d.ONDERHOUD });")],
    let: 'voor A2.8 EEN regel met het saldo van omzet min zes kostenposten; sinds A2.8 acht boekingen, elk een keer afgerond (centen.js, maandDelen), met de huishoudens, de stad en per contract de overlopende rekening van G10 als tegenpartij' },
  { id: 'G13', betekenis: 'RESULTAATDELING', categorie: 'overdracht', van: 'eigenaar vestiging', naar: 'aandeelhouder', tegenzijde: 'elders', gemigreerd: 'A2.8',
    benen: [b('aandeel.js', "if (d.houder !== eigenaar) { beweeg(st, { soort: 'RESULTAATDELING', van: ['kas', eigenaar], naar: ['kas', d.houder], bedrag, omschrijving: 'Deel van het resultaat' });")],
    let: 'van de eigenaar naar de houder, nadat het hele resultaat bij de eigenaar binnenkwam (G12); bij verlies betaalt de houder mee. Houdt de eigenaar zelf een belang, dan gaat er niets over. Sinds A2.1 wordt elk deel een keer tot centen afgerond' },
  { id: 'G14', betekenis: 'AANDELENKOOP', categorie: 'overdracht', van: 'koper', naar: 'eigenaar van nu', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('aandeel-acties.js', "beweeg(st, { soort: 'AANDELENKOOP', van: ['kas', d.houder], naar: ['kas', nu], bedrag: koopsom, omschrijving: 'Koop van een belang' });")] },
  { id: 'G15', betekenis: 'VEILING_GUNNING', categorie: 'overdracht', van: 'winnaar', naar: 'verkoper of Foundation-pot', tegenzijde: 'overdracht', gemigreerd: 'A2.4',
    benen: [b('veiling.js', "beweeg(st, { soort: 'VEILING_GUNNING', van: ['kas', v.winnaar], naar: ['kas', w.speler], bedrag: koopsom, omschrijving: 'Gunning vestiging' });"), b('veiling.js', "beweeg(st, { soort: 'VEILING_GUNNING', van: ['kas', v.winnaar], naar: ['foundation', 'lokaal'], bedrag: koopsom, omschrijving: 'Gunning kavel' });")],
    let: 'twee gebeurtenissen achter een betaalbeen: een kavel is een GRONDUITGIFTE (naar de pot), een vestiging een OVERNAME (naar de verkoper). Sinds A2.4 twee commando\'s. Toen bleek ook dat de winnaar al betaalde voordat vaststond dat de vestiging nog bestond: bij `mislukt` verdween de koopsom zonder ontvanger. Nu gaat er dan niets over' },

  { id: 'G16', betekenis: 'LENING', categorie: 'financiering', van: 'bank', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.5',
    benen: [b('bank-acties.js', "beweeg(st, { soort: 'LENING', van: ['macro', 'bank'], naar: ['kas', h], bedrag: l.restant, omschrijving: 'Uitbetaling lening' });")],
    let: 'geldschepping door de bank is economisch juist, maar de bank heeft geen balans: de schuld bestaat alleen als l.restant' },
  { id: 'G17', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: 'bank', tegenzijde: 'put', gemigreerd: 'A2.5',
    benen: [b('bank-acties.js', "beweeg(st, { soort: 'AFLOSSING', van: ['kas', h], naar: ['macro', 'bank'], bedrag, omschrijving: 'Extra aflossing' });")], let: 'extra aflossing' },
  { id: 'G18', betekenis: 'RENTE', categorie: 'financiering', van: 'speler', naar: 'bank', tegenzijde: 'put', gemigreerd: 'A2.5',
    benen: [b('bank-maand.js', "beweeg(st, { soort: 'RENTE', van: ['kas', h], naar: ['macro', 'bank'], bedrag: r.rente, omschrijving: 'Rente lening' });")], let: '"rente verlaat de wereld" is vandaag de regel; magnaat-pomp.js heeft er een eigen categorie voor' },
  { id: 'G19', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: 'bank', tegenzijde: 'put', gemigreerd: 'A2.5',
    benen: [b('bank-maand.js', "beweeg(st, { soort: 'AFLOSSING', van: ['kas', h], naar: ['macro', 'bank'], bedrag: afgelost, omschrijving: 'Termijn lening' });")], let: 'termijn; gaat ook door als de kas het niet draagt (zie G21)' },
  { id: 'G20', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: 'bank', tegenzijde: 'put', gemigreerd: 'A2.5',
    benen: [b('bank-maand.js', "beweeg(st, { soort: 'AFLOSSING', van: ['kas', h], naar: ['macro', 'bank'], bedrag: uitKas, omschrijving: 'Aflossing na opeising' });")], let: 'na opeising' },
  { id: 'G21', betekenis: 'UITWINNING', categorie: 'financiering', van: 'aannemer', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.5',
    samengesteld: ['DESINVESTERING', 'AFLOSSING'],
    delen: { DESINVESTERING: ['aannemer', 'speler'], AFLOSSING: ['speler', 'bank'] },
    benen: [b('bank-maand.js', "beweeg(st, { soort: 'DESINVESTERING', van: ['macro', 'aannemer'], naar: ['kas', h], bedrag: opbrengst, omschrijving: 'Uitwinning onderpand' });"), b('bank-maand.js', "beweeg(st, { soort: 'AFLOSSING', van: ['kas', h], naar: ['macro', 'bank'], bedrag: naarSchuld, omschrijving: 'Aflossing uit uitwinning' });")],
    let: 'voor A2.5 netto geboekt; sinds A2.5 de twee delen apart: de halve bouwsom van de aannemer naar de kas, en daaruit het deel voor de schuld naar de bank' },
  { id: 'G22', betekenis: 'RENTE', categorie: 'financiering', van: 'speler', naar: 'bank', tegenzijde: 'put', gemigreerd: 'A2.5',
    benen: [b('maand.js', "beweeg(st, { soort: 'RENTE', van: ['kas', h], naar: ['macro', 'bank'], bedrag: rente, omschrijving: 'Rente rood staan' });")],
    let: 'rood staan: de rekening-courant is een NEGATIEF SALDO en geen lening. Sinds A2.1 een keer tot centen afgerond' },

  { id: 'G23', betekenis: 'PREMIE', categorie: 'verzekering', van: 'speler', naar: 'verzekeraar', tegenzijde: 'put', gemigreerd: 'A2.6',
    benen: [b('verzekering.js', "beweeg(st, { soort: 'PREMIE', van: ['kas', h], naar: ['macro', 'verzekeraar'], bedrag, omschrijving: 'Premie' });")] },
  { id: 'G24', betekenis: 'SCHADE', categorie: 'verzekering', van: 'speler', naar: 'aannemer', tegenzijde: 'put', gemigreerd: 'A2.6',
    benen: [b('verzekering.js', "beweeg(st, { soort: 'SCHADE', van: ['kas', h], naar: ['macro', 'aannemer'], bedrag: kosten, omschrijving: 'Herstel na schade' });")], let: 'pandschade verlaagt ook de staat van het pand' },
  { id: 'G25', betekenis: 'UITKERING', categorie: 'verzekering', van: 'verzekeraar', naar: 'speler', tegenzijde: 'bron', gemigreerd: 'A2.6',
    benen: [b('verzekering.js', "if (uit.bedrag > 0) { beweeg(st, { soort: 'UITKERING', van: ['macro', 'verzekeraar'], naar: ['kas', h], bedrag: uit.bedrag, omschrijving: 'Uitkering' });")] },

  { id: 'G26', betekenis: 'FOUNDATION_AFDRACHT', categorie: 'foundation', van: 'stad', naar: 'Foundation-pot', tegenzijde: 'bron',
    benen: [b('foundation.js', 'f.lokaal += naarCenten(lokaal);'), b('foundation.js', 'f.centraal += naarCenten(centraal);')],
    let: 'de afdracht wordt BEREKEND over de omzet maar van niemand afgetrokken: de pot groeit uit niets. Besluit 3 (MAGNAAT.md): de stad en de spelers betalen, via RTG naar de RTFoundation. Tot die regelwijziging (A2.9) staat de stad als betaler: de berekening loopt nu over de stadsomzet en die van de spelers, zonder dat iemand het voelt' },
  { id: 'G27', betekenis: 'FOUNDATION_PROJECT', categorie: 'foundation', van: 'Foundation-pot', naar: 'aannemer', tegenzijde: 'put',
    benen: [b('foundation.js', 'f.lokaal -= naarCenten(p.kosten);')] }
];

/* De patronen waarmee de toets de plekken zelf zoekt. Het eerste is letterlijk
   DIRECTE_SALDOMUTATIE uit ./magnaatgrondwet.js (de toets eist dat); het tweede
   vindt de Foundation-pot, die de grondwetmeter niet ziet omdat hij geen
   `geld[...]` heet -- en die dus bij "breder zoeken" hoort. */
const ZOEK = [
  { naam: 'saldo', patroon: '\\bgeld\\s*\\[[^\\]]+\\]\\s*[-+*/]?=(?!=)' },
  { naam: 'foundation-pot', patroon: '\\b(?:f|st\\.foundation)\\.(?:lokaal|centraal)\\s*[-+*/]?=(?!=)' }
];

module.exports = { BETEKENISSEN, CATEGORIEEN, TEGENZIJDEN, PARTIJEN, GEBEURTENISSEN, ZOEK, MAP };

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
     van, naar    wie betaalt en wie ontvangt. Een rol en geen speler-id; tussen
                  haken een tegenpartij die in World vandaag NIET bestaat en die
                  de migratie moet invoeren (een VOORSTEL, geen besluit).
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

const b = (bestand, code, na) => (na ? { bestand: MAP + bestand, code, na } : { bestand: MAP + bestand, code });

const GEBEURTENISSEN = [
  { id: 'G01', betekenis: 'OPENING', categorie: 'opening', van: '(eigen vermogen)', naar: 'speler', tegenzijde: 'bron',
    benen: [b('economie.js', 'st.geld[h] = naarCenten(START_GELD);')],
    let: 'legitieme creatie, maar zonder inlegrekening: de beginbalans heeft geen passivakant' },

  { id: 'G02', betekenis: 'INVESTERING', categorie: 'activa', van: 'speler', naar: '(aannemer)', tegenzijde: 'put',
    benen: [b('acties.js', 'st.geld[h] -= bouwCenten;')],
    let: 'geen kosten maar kas tegen een activum: de bouwsom staat als v.gebouwdVoor op de vestiging en nergens op een balans' },
  { id: 'G03', betekenis: 'INVESTERING', categorie: 'activa', van: 'speler', naar: '(aannemer)', tegenzijde: 'put',
    benen: [b('acties.js', 'st.geld[h] -= uitbreidCenten;')],
    let: 'uitbreiden: zelfde vorm als G02' },
  { id: 'G04', betekenis: 'WERVING_AFVLOEIING', categorie: 'maandresultaat', van: 'speler', naar: '(arbeidsmarkt)', tegenzijde: 'put',
    benen: [b('acties.js', 'st.geld[h] -= personeelCenten;')],
    let: 'een maandloon per verschil in personeel, in beide richtingen' },
  { id: 'G05', betekenis: 'DESINVESTERING', categorie: 'activa', van: '(aannemer)', naar: 'speler', tegenzijde: 'bron',
    benen: [b('acties.js', 'st.geld[h] += opbrengst;')],
    let: 'de halve bouwsom ontstaat uit niets; de andere helft is een afboeking van het activum die vandaag nergens staat' },

  { id: 'G06', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht',
    benen: [b('acties.js', 'st.geld[h] -= som;'), b('acties.js', 'st.geld[tegen] += som;')],
    let: 'afkoop bij zelf sluiten' },
  { id: 'G07', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht',
    benen: [b('afscheid.js', 'st.geld[h] -= som;'), b('afscheid.js', 'st.geld[tegen] += som;')],
    let: 'afkoop bij uitwinning of verkoop van de vestiging' },
  { id: 'G08', betekenis: 'CONTRACT_AFKOOP', categorie: 'overdracht', van: 'speler', naar: 'wederpartij', tegenzijde: 'overdracht',
    benen: [b('handel-acties.js', 'st.geld[h] -= som;'), b('handel-acties.js', 'st.geld[tegen] += som;')],
    let: 'afkoop bij opzeggen' },
  { id: 'G09', betekenis: 'CONTRACT_VOORUITBETALING', categorie: 'overdracht', van: 'afnemer', naar: 'leverancier', tegenzijde: 'overdracht',
    benen: [b('handel-acties.js', 'st.geld[c.afnemer] -= vooraf;'), b('handel-acties.js', 'st.geld[c.leverancier] += vooraf;')],
    let: 'beide benen op een regel' },
  { id: 'G10', betekenis: 'CONTRACT_BETALING', categorie: 'overdracht', van: 'afnemer', naar: 'leverancier', tegenzijde: 'elders',
    benen: [b('maand-contracten.js', 'st.geld[c.afnemer] -= bedrag;')],
    let: 'het ontvangende been zit in de omzet van de leverancier (stap.js) en komt via G12 binnen. Sinds A2.1 is het bedrag per contract EEN keer in centen vastgesteld (maand.js) en krijgen beide kanten datzelfde getal; voor A2.1 werd de ene kant wel en de andere niet afgerond' },
  { id: 'G11', betekenis: 'CONTRACT_BOETE', categorie: 'overdracht', van: 'leverancier', naar: 'afnemer', tegenzijde: 'overdracht',
    benen: [b('maand-contracten.js', 'st.geld[c.leverancier] -= boete;'), b('maand-contracten.js', 'st.geld[c.afnemer] += boete;')] },

  { id: 'G12', betekenis: 'VERKOOP', categorie: 'maandresultaat', van: '(huishoudens)', naar: 'speler', tegenzijde: 'bron',
    samengesteld: ['VERKOOP', 'CONTRACT_BETALING', 'INKOOP', 'LOON', 'VASTE_LASTEN', 'HUUR', 'MARKETING', 'ONDERHOUD'],
    benen: [b('maand.js', 'st.geld[h] += verdeeld.eigenaar;')],
    let: 'EEN regel, acht gebeurtenissen: het saldo van omzet min zes kostenposten (stap.js). Alleen het contractdeel heeft een tegenzijde (G10); de rest ontstaat of verdwijnt. Hier telt de meter 1 en zijn het er 8' },
  { id: 'G13', betekenis: 'RESULTAATDELING', categorie: 'overdracht', van: 'eigenaar vestiging', naar: 'aandeelhouder', tegenzijde: 'elders',
    benen: [b('aandeel.js', 'st.geld[d.houder] += bedrag;')],
    let: 'het andere been is wat de eigenaar in G12 NIET krijgt; bij verlies betaalt de houder mee. Sinds A2.1 wordt elk deel een keer tot centen afgerond en houdt de eigenaar exact de rest' },
  { id: 'G14', betekenis: 'AANDELENKOOP', categorie: 'overdracht', van: 'koper', naar: 'eigenaar van nu', tegenzijde: 'overdracht',
    benen: [b('aandeel-acties.js', 'st.geld[d.houder] -= koopsom;'), b('aandeel-acties.js', 'st.geld[nu] += koopsom;')] },
  { id: 'G15', betekenis: 'VEILING_GUNNING', categorie: 'overdracht', van: 'winnaar', naar: 'verkoper of Foundation-pot', tegenzijde: 'overdracht',
    benen: [b('veiling.js', 'st.geld[v.winnaar] -= koopsom;'), b('veiling.js', 'st.geld[w.speler] += koopsom;'), b('veiling.js', 'st.foundation.lokaal += koopsom;')],
    let: 'twee gebeurtenissen achter een betaalbeen: een kavel is een GRONDUITGIFTE (naar de pot), een vestiging een OVERNAME (naar de verkoper). Bij de migratie twee commando\'s' },

  { id: 'G16', betekenis: 'LENING', categorie: 'financiering', van: '(bank)', naar: 'speler', tegenzijde: 'bron',
    benen: [b('bank-acties.js', 'st.geld[h] += l.restant;')],
    let: 'geldschepping door de bank is economisch juist, maar de bank heeft geen balans: de schuld bestaat alleen als l.restant' },
  { id: 'G17', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: '(bank)', tegenzijde: 'put',
    benen: [b('bank-acties.js', 'st.geld[h] -= bedrag;')], let: 'extra aflossing' },
  { id: 'G18', betekenis: 'RENTE', categorie: 'financiering', van: 'speler', naar: '(bank)', tegenzijde: 'put',
    benen: [b('bank-maand.js', 'st.geld[h] -= r.rente;')], let: '"rente verlaat de wereld" is vandaag de regel; magnaat-pomp.js heeft er een eigen categorie voor' },
  { id: 'G19', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: '(bank)', tegenzijde: 'put',
    benen: [b('bank-maand.js', 'st.geld[h] -= afgelost;')], let: 'termijn; gaat ook door als de kas het niet draagt (zie G21)' },
  { id: 'G20', betekenis: 'AFLOSSING', categorie: 'financiering', van: 'speler', naar: '(bank)', tegenzijde: 'put',
    benen: [b('bank-maand.js', 'st.geld[h] -= uitKas;')], let: 'na opeising' },
  { id: 'G21', betekenis: 'UITWINNING', categorie: 'financiering', van: '(aannemer)', naar: 'speler', tegenzijde: 'bron',
    samengesteld: ['DESINVESTERING', 'AFLOSSING'],
    benen: [b('bank-maand.js', 'st.geld[h] += opbrengst - naarSchuld;')],
    let: 'netto geboekt: de halve bouwsom ontstaat (zoals G05) en gaat meteen deels naar de schuld' },
  { id: 'G22', betekenis: 'RENTE', categorie: 'financiering', van: 'speler', naar: '(bank)', tegenzijde: 'put',
    benen: [b('maand.js', 'st.geld[h] -= rente;')],
    let: 'rood staan: de rekening-courant is een NEGATIEF SALDO en geen lening. Sinds A2.1 een keer tot centen afgerond' },

  { id: 'G23', betekenis: 'PREMIE', categorie: 'verzekering', van: 'speler', naar: '(verzekeraar)', tegenzijde: 'put',
    benen: [b('verzekering.js', 'st.geld[h] -= bedrag;')] },
  { id: 'G24', betekenis: 'SCHADE', categorie: 'verzekering', van: 'speler', naar: '(aannemer)', tegenzijde: 'put',
    benen: [b('verzekering.js', 'st.geld[h] -= kosten;')], let: 'pandschade verlaagt ook de staat van het pand' },
  { id: 'G25', betekenis: 'UITKERING', categorie: 'verzekering', van: '(verzekeraar)', naar: 'speler', tegenzijde: 'bron',
    benen: [b('verzekering.js', 'if (uit.bedrag > 0) { st.geld[h] += uit.bedrag;')] },

  { id: 'G26', betekenis: 'FOUNDATION_AFDRACHT', categorie: 'foundation', van: '(niemand)', naar: 'Foundation-pot', tegenzijde: 'bron',
    benen: [b('foundation.js', 'f.lokaal += naarCenten(lokaal);'), b('foundation.js', 'f.centraal += naarCenten(centraal);')],
    let: 'de afdracht wordt BEREKEND over de omzet maar van niemand afgetrokken: de pot groeit uit niets. Besluit 3 (MAGNAAT.md): de stad en de spelers betalen, via RTG naar de RTFoundation' },
  { id: 'G27', betekenis: 'FOUNDATION_PROJECT', categorie: 'foundation', van: 'Foundation-pot', naar: '(aannemer)', tegenzijde: 'put',
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

module.exports = { BETEKENISSEN, CATEGORIEEN, TEGENZIJDEN, GEBEURTENISSEN, ZOEK, MAP };

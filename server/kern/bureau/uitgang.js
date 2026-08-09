/* Het Privekantoor, deelbestand "uitgang": wat het kantoor naar buiten geeft.

   Alleen een montagelijst. Hij staat apart omdat hij met vierenzeventig
   onderdelen langer is dan de motor die hem samenstelt, en omdat je hier moet
   kunnen zien WAT er te bereiken is zonder door de bedrading te lezen.

   De twee namen die eruit komen zijn geen indeling maar een grens:

     bureau       de leden-app: graaf, tower, mandaat, zaken, en de twintig
                  kamers.
     bureauBalie  de kantoor-kant: de wachtrij zien en er een stap in zetten.
                  Meer niet -- zat dit in `bureau`, dan kon routes/office bij de
                  levensgraaf en het mandaat van elk lid, en dan is "het bureau
                  ziet geen besloten kamers" een afspraak in plaats van een muur.

   Gemount via ./index.js, die alle modules meegeeft. */
'use strict';

module.exports = (m) => ({
  bureau: {
    overzicht: m.overzicht, ai: m.ai,
    nu: m.nu.nuBeeld, knoop: m.nu.knoopDetail,
    tower: m.termijnen.tower, termijnen: m.termijnen.termijnenAlle,
    graaf: m.graaf.graafVoor, graafSamenvatting: m.graaf.samenvatting,
    // alleen voor de toets; zie de staart van ./graaf.js
    knoopFabriek: m.graaf.knoop,
    delegatie: m.delegatie.delegatie, delegatieZet: m.delegatie.delegatieZet,
    beoordeel: m.delegatie.beoordeel,
    kamers: m.kamers.kamers, kamerStatus: m.kamers.kamerStatus,
    raakvlak: m.ork.raakvlak, briefing: m.brief.bureauBriefing,
    twin: m.twin.twin, twinRuimte: m.twin.twinRuimte, twinRuimteWeg: m.twin.twinRuimteWeg,
    twinInstallatie: m.twin.twinInstallatie, twinInstallatieWeg: m.twin.twinInstallatieWeg,
    twinBeurt: m.twin.twinBeurt,
    cases: m.cases.cases, caseOpen: m.cases.caseOpen,
    caseBeslis: m.cases.caseBeslis, caseIntrek: m.cases.caseIntrek,
    KAMERS: m.kamers.BUREAU_KAMERS,
    DOMEINEN: m.delegatie.DELEGATIE_DOMEINEN,
    NIVEAUS: m.delegatie.DELEGATIE_NIVEAUS,
    CASE_SOORTEN: m.cases.CASE_SOORTEN,
    // Security Office
    beveiliging: m.bv.beveiliging, bvPost: m.bv.bvPost, bvPostWeg: m.bv.bvPostWeg,
    bvRisico: m.bv.bvRisico, bvRisicoWeg: m.bv.bvRisicoWeg,
    bvDigitaal: m.bv.bvDigitaal, bvDigitaalWeg: m.bv.bvDigitaalWeg, bvIncident: m.bv.bvIncident,
    // Reputation Office
    reputatie: m.rp.reputatie, rpOptreden: m.rp.rpOptreden, rpOptredenWeg: m.rp.rpOptredenWeg,
    rpLijn: m.rp.rpLijn, rpLijnWeg: m.rp.rpLijnWeg,
    rpWoordvoerder: m.rp.rpWoordvoerder, rpWoordvoerderWeg: m.rp.rpWoordvoerderWeg,
    rpVermelding: m.rp.rpVermelding, rpVermeldingWeg: m.rp.rpVermeldingWeg,
    // Pet Office
    dieren: m.dr.dieren, drDier: m.dr.drDier, drDierWeg: m.dr.drDierWeg,
    drDocument: m.dr.drDocument, drDocumentWeg: m.dr.drDocumentWeg,
    drZorg: m.dr.drZorg, drZorgWeg: m.dr.drZorgWeg,
    // collecties op diepte
    collectie: m.col.collectie, colHerkomst: m.col.colHerkomst, colHerkomstWeg: m.col.colHerkomstWeg,
    colTaxatie: m.col.colTaxatie, colTaxatieWeg: m.col.colTaxatieWeg,
    colConditie: m.col.colConditie, colBruikleen: m.col.colBruikleen, colTerug: m.col.colTerug,
    // relaties op diepte
    relaties: m.rel.relaties, relBand: m.rel.relBand, relBandWeg: m.rel.relBandWeg,
    relOntmoeting: m.rel.relOntmoeting, relOntmoetingWeg: m.rel.relOntmoetingWeg,
    relContext: m.rel.relContext,
    // het reisdek
    reisdek: m.rd.reisdek, rdVerstoring: m.rd.rdVerstoring, rdGevolg: m.rd.rdGevolg,
    rdVerstoringWeg: m.rd.rdVerstoringWeg, rdBon: m.rd.rdBon,
    rdVergeten: m.rd.rdVergeten, rdPunten: m.rd.rdPunten
  },
  bureauBalie: {
    desk: m.cases.bureauDesk, voortgang: m.cases.bureauVoortgang
  }
});

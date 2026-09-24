/* Magnaat Economische Motor -- de projectie in de wereld, en hoe die ontstaat.

   wereld.economie is een PROJECTIE van het journaal (./journaal-opslag.js) plus
   de toestand die niet uit boekingen volgt (bedrijven, macro, historie). Hij
   draagt geen journaal meer: dat groeide daar tot 2500 posten en gooide dan de
   oudste weg, en elke `beslis` kopieerde hem helemaal. */
'use strict';
const { STAAT_VERSIE, STARTDATUM, SCHOKKEN, MACROACTOREN, ECONOMISCHE_GEBEURTENISSEN, rond, kopieBedrijf } = require('./constanten');

module.exports = (m) => {
  function nieuweState() {
    return {
      versie: STAAT_VERSIE, mutatieVersie: 0, startdatum: STARTDATUM, dag: 0, boekVolgorde: 0,
      rekeningen: {}, commandos: {},
      laatstToegepast: 0, totalen: { debet: 0, credit: 0, aantal: 0 }, recent: [], vandaag: null,
      wachtend: [], integriteit: null,
      bedrijven: Object.fromEntries(Object.entries(m.profiel.bedrijven).map(([id, b]) => [id, kopieBedrijf(id, b.start)])),
      macro: {
        beroepsbevolking: 80, leverancierPersoneel: 14, werkloosheid: 7.5,
        inflatie: 2.1, rente: 2.4, prijsindex: 100, bbpVandaag: 0,
        consumentenvertrouwen: 100, vraagIndex: 100, aanbodIndex: 100
      },
      werk: { aantal: 0, productiviteit: 0, service: 0, controle: 0, impact: 0, innovatie: 0, bronnen: [] },
      geforceerdeSchok: null, actieveSchok: SCHOKKEN[0],
      verklaringen: [], historie: [], audit: [],
      instellingen: {
        prijsElasticiteit: 1.35, vennootschapsbelastingBp: 2580,
        basisVraag: 920, eenhedenPerDienst: 1, inkoopPerEenheid: 2800
      },
      geinitialiseerd: false
    };
  }

  /* Een wereld van voor de losse motor droeg zijn journaal zelf, nieuwste
     eerst, met hooguit 2500 posten. Eenmalig gaat dat naar het journaal. Wat
     de oude ringbuffer al had weggegooid, wordt niet verzonnen maar als gat
     benoemd -- de historie begint dan eerlijk later dan volgnummer 1. */
  function neemOudJournaalOver(e) {
    const volgnummer = (p) => Number(String(p.id).split('-')[2]);
    const oud = e.journaal.slice().sort((a, b) => volgnummer(a) - volgnummer(b));
    const eerste = oud.length ? volgnummer(oud[0]) : e.boekVolgorde + 1;
    const gebeurtenissen = oud.map(p => Object.assign({}, p, {
      wereld: m.wereld, volgnummer: volgnummer(p), soort: ECONOMISCHE_GEBEURTENISSEN.ONBEKEND, oorzaak: 'overgenomen uit het journaal van voor ronde A1',
      regelVersie: '1', motorVersie: '1'
    }));
    const sleutels = {};
    for (const [sleutel, id] of Object.entries(e.verwerkteBoekingen || {})) sleutels[sleutel] = volgnummer({ id });
    m.opslag.neemOver(m.wereld, {
      gebeurtenissen, sleutels,
      ontbrekend: eerste > 1 ? { tot: eerste - 1, reden: 'weggegooid door de oude journaalgrens van 2500 posten, voor ronde A1' } : null
    });
    e.laatstToegepast = e.boekVolgorde;
    e.totalen = { debet: 0, credit: 0, aantal: 0 };
    for (const g of gebeurtenissen) { e.totalen.debet += g.debet; e.totalen.credit += g.credit; e.totalen.aantal += 1; }
    e.recent = oud.slice(-100).reverse().map(g => ({ id: g.id, datum: g.datum, omschrijving: g.omschrijving, bedrag: g.bedrag, debet: g.debet, credit: g.credit, labels: g.labels }));
    const vandaag = gebeurtenissen.filter(g => g.dag === e.dag);
    e.vandaag = { dag: e.dag, posten: vandaag.map(g => ({ volgnummer: g.volgnummer, labels: g.labels, regels: g.regels })) };
    delete e.journaal;
    delete e.verwerkteBoekingen;
  }

  function zorgVorm(e) {
    if (!Number.isSafeInteger(e.mutatieVersie) || e.mutatieVersie < 0) e.mutatieVersie = 0;
    if (!Array.isArray(e.wachtend)) e.wachtend = [];
    if (!e.totalen) e.totalen = { debet: 0, credit: 0, aantal: 0 };
    if (!Array.isArray(e.recent)) e.recent = [];
    if (!Number.isSafeInteger(e.laatstToegepast)) e.laatstToegepast = 0;
    for (const b of Object.values(e.bedrijven || {})) {
      if (!b.kostenUitsplitsing || typeof b.kostenUitsplitsing !== 'object') {
        b.kostenUitsplitsing = { kostprijs: 0, loon: 0, training: 0, impact: 0, rente: 0, belasting: 0 };
      }
    }
  }

  function state() {
    const wereld = m.wereldState();
    if (wereld.economie && wereld.economie.versie !== STAAT_VERSIE) {
      /* Vroeger begon een andere staatvorm stil opnieuw. Met een journaal dat
         blijft bestaan zou dat de projectie van zijn bewijs losknippen. */
      if (m.opslag.laatste(m.wereld) > 0) {
        throw new Error('De economische staat heeft vorm ' + wereld.economie.versie + ' en de motor verwacht ' + STAAT_VERSIE + '; er staat een journaal, dus er wordt niet stil opnieuw begonnen.');
      }
      wereld.economie = null;
    }
    if (!wereld.economie) wereld.economie = nieuweState();
    const e = wereld.economie;
    if (Array.isArray(e.journaal)) neemOudJournaalOver(e);
    zorgVorm(e);
    m.herstel(e);
    if (m.haken.zorgStaat) m.haken.zorgStaat(e);
    if (!e.geinitialiseerd) m.metOorzaak('opening', () => initialiseer(e));
    m.metOorzaak('migratie', () => zorgVoorraadBoekwaarde(e));
    if (!e.integriteit) m.bevestig(e);
    return e;
  }

  function markeerMutatie(e) {
    e.mutatieVersie = (Number.isSafeInteger(e.mutatieVersie) ? e.mutatieVersie : 0) + 1;
  }

  function openingspost(e, actor, naam, bedrag) {
    m.boek(e, 'opening:' + actor, ECONOMISCHE_GEBEURTENISSEN.OPENING, 'Openingsbalans ' + naam, [
      m.regel(actor + '.kas', actor, 'Bank en kas', 'actief', 'debet', bedrag),
      m.regel(actor + '.eigen-vermogen', actor, 'Openingsvermogen', 'eigen-vermogen', 'credit', bedrag)
    ], ['opening']);
  }

  function initialiseer(e) {
    for (const b of Object.values(e.bedrijven)) openingspost(e, b.id, b.naam, b.cash);
    for (const b of Object.values(e.bedrijven)) {
      const waarde = rond(b.voorraad * e.instellingen.inkoopPerEenheid);
      m.boek(e, 'opening:voorraad:' + b.id, ECONOMISCHE_GEBEURTENISSEN.VOORRAAD_OPENING, 'Openingsvoorraad ' + b.naam, [
        m.regel(b.id + '.voorraad', b.id, 'Voorraad', 'actief', 'debet', waarde),
        m.regel(b.id + '.eigen-vermogen', b.id, 'Openingsvermogen', 'eigen-vermogen', 'credit', waarde)
      ], ['opening', 'voorraad']);
    }
    for (const actor of MACROACTOREN) openingspost(e, actor, actor, m.profiel.openingskas[actor]);
    e.geinitialiseerd = true;
    e.verklaringen.unshift({
      dag: 0, soort: 'fundament', titel: 'Economische wereld geopend',
      uitleg: 'Alle beginsaldi zijn dubbel geboekt. Vanaf nu ontstaat iedere euro uit een gebalanceerde transactie.'
    });
    m.neemMoment(e);
  }

  /* Bestaande trainingswerelden van vóór het Economenlab hadden wel fysieke
     voorraadeenheden maar nog geen voorraadrekening. Migreer ze één keer met
     een gebalanceerde openingspost; nooit stil resetten of de kas veranderen. */
  function zorgVoorraadBoekwaarde(e) {
    for (const b of Object.values(e.bedrijven || {})) {
      if (e.rekeningen[b.id + '.voorraad']) continue;
      const waarde = rond(b.voorraad * e.instellingen.inkoopPerEenheid);
      if (!waarde) continue;
      m.boek(e, 'migratie:voorraad:' + b.id, ECONOMISCHE_GEBEURTENISSEN.VOORRAAD_MIGRATIE, 'Migratie openingsvoorraad ' + b.naam, [
        m.regel(b.id + '.voorraad', b.id, 'Voorraad', 'actief', 'debet', waarde),
        m.regel(b.id + '.eigen-vermogen', b.id, 'Openingsvermogen', 'eigen-vermogen', 'credit', waarde)
      ], ['migratie', 'voorraad']);
    }
  }

  return { state, markeerMutatie };
};

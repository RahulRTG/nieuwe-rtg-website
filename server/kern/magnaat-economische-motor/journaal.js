/* Magnaat Economische Motor -- boeken, en de projectie die het journaal volgt.

   Een boeking levert EEN gebeurtenis op: wat er gebeurde (`soort`), wie het
   veroorzaakte (`oorzaak`), onder welke regels en motor, met daaronder de
   postings -- wie geeft, wie ontvangt. De gebeurtenis gaat eerst in een
   wachtrij in de projectie en pas bij `bevestig` het journaal in. Dat is geen
   omweg maar een grens: `beslis` en `analyse` rekenen op een KOPIE die bij een
   weigering wordt weggegooid, en een boeking van een geweigerd besluit mag dan
   ook nooit in het bewijs staan.

   De projectie (wereld.economie) draagt: de saldi, `laatstToegepast` (tot en met
   welk volgnummer die saldi het journaal weergeven), lopende totalen voor de
   balanscontrole, een klein venster `recent` voor het scherm en `vandaag` voor
   de kasstroom van de lopende dag. Niets daarvan vraagt het hele journaal. */
'use strict';
const { ECONOMISCHE_GEBEURTENISSEN, MAX_RECENT, MOTOR_VERSIE, REGEL_VERSIE, rond, geld, som, datumOpDag } = require('./constanten');

module.exports = (m) => {
  let oorzaak = null;

  /* Wie een reeks boekingen veroorzaakt (een dagcommando, een besluit, de
     opening), zet dat hier voor de duur van die reeks. Synchroon, dus zonder
     kans dat twee oorzaken door elkaar lopen. */
  function metOorzaak(waarom, werk) {
    const vorige = oorzaak;
    oorzaak = waarom;
    try { return werk(); } finally { oorzaak = vorige; }
  }

  function rekening(e, code, actor, naam, soort, normaal) {
    if (!e.rekeningen[code]) e.rekeningen[code] = {
      code, actor, naam, soort, normaal: normaal || (['actief', 'kosten'].includes(soort) ? 'debet' : 'credit'),
      saldo: 0
    };
    return e.rekeningen[code];
  }

  function regel(rekeningCode, actor, naam, soort, kant, bedrag) {
    const r = { rekening: rekeningCode, actor, naam, soort, debet: 0, credit: 0 };
    r[kant] = geld(bedrag);
    return r;
  }

  function pasToe(e, lijn) {
    const normaal = ['actief', 'kosten'].includes(lijn.soort) ? 'debet' : 'credit';
    const r = rekening(e, lijn.rekening, lijn.actor, lijn.naam, lijn.soort, normaal);
    r.saldo += lijn.debet - lijn.credit;
  }

  /* Wat het scherm van een gebeurtenis ziet, op EEN plek: het venster `recent`
     wordt zowel bij boeken als bij de overname van een oude wereld gevuld. */
  const regelVoorScherm = (g) => ({ id: g.id, datum: g.datum, omschrijving: g.omschrijving, bedrag: g.bedrag, debet: g.debet, credit: g.credit, labels: g.labels });

  /* De projectie volgt een gebeurtenis. Dezelfde functie voor een verse boeking
     en voor herstel, zodat die twee nooit uit elkaar kunnen lopen. */
  function projecteer(e, g, { saldi = true } = {}) {
    if (saldi) for (const lijn of g.regels) pasToe(e, lijn);
    e.laatstToegepast = g.volgnummer;
    e.totalen.debet += g.debet;
    e.totalen.credit += g.credit;
    e.totalen.aantal += 1;
    e.recent.unshift(regelVoorScherm(g));
    if (e.recent.length > MAX_RECENT) e.recent.length = MAX_RECENT;
    if (!e.vandaag || e.vandaag.dag !== g.dag) e.vandaag = { dag: g.dag, posten: [] };
    e.vandaag.posten.push({ volgnummer: g.volgnummer, labels: g.labels, regels: g.regels });
  }

  function eisIntegriteit(e) {
    if (e.integriteit) {
      throw new Error('De economische projectie loopt voor op het journaal (' + e.integriteit.projectie + ' tegen ' +
        e.integriteit.journaal + '); er wordt niet geboekt tot dat is uitgezocht.');
    }
  }

  function bestaandeGebeurtenis(e, sleutel) {
    const wachtend = e.wachtend.find(g => g.sleutel === sleutel);
    if (wachtend) return wachtend;
    const volgnummer = m.opslag.zoek(m.wereld, sleutel);
    return volgnummer == null ? null : (m.opslag.lees(m.wereld, volgnummer, volgnummer)[0] || null);
  }

  function boek(e, sleutel, soort, omschrijving, regels, labels = []) {
    sleutel = String(sleutel || '').slice(0, 160);
    if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');
    if (!ECONOMISCHE_GEBEURTENISSEN[soort]) throw new Error('Onbekende economische gebeurtenis: ' + soort + '.');
    eisIntegriteit(e);
    const bestaand = bestaandeGebeurtenis(e, sleutel);
    if (bestaand) return bestaand;
    const schoon = regels.filter(r => geld(r.debet) > 0 || geld(r.credit) > 0).map(r => Object.assign({}, r, {
      debet: geld(r.debet), credit: geld(r.credit)
    }));
    const debet = som(schoon.map(r => r.debet));
    const credit = som(schoon.map(r => r.credit));
    if (!schoon.length || debet !== credit) {
      throw new Error('Ongebalanceerde journaalpost geweigerd: ' + omschrijving + ' (' + debet + ' / ' + credit + ').');
    }
    e.boekVolgorde += 1;
    const g = {
      id: 'MJ-' + String(e.dag).padStart(4, '0') + '-' + String(e.boekVolgorde).padStart(5, '0'),
      wereld: m.wereld, volgnummer: e.boekVolgorde, soort, oorzaak,
      regelVersie: REGEL_VERSIE, motorVersie: MOTOR_VERSIE,
      sleutel, dag: e.dag, datum: datumOpDag(e.dag), omschrijving,
      bedrag: Math.max(...schoon.map(r => Math.max(r.debet, r.credit))),
      debet, credit, regels: schoon, labels: labels.slice(0, 8)
    };
    projecteer(e, g);
    e.wachtend.push(g);
    return g;
  }

  /* De wachtrij het journaal in. Wie een projectie wegschrijft, bevestigt
     eerst -- anders staat er in de wereld een saldo waar geen bewijs onder ligt. */
  function bevestig(e) {
    if (!e.wachtend.length) return 0;
    const n = e.wachtend.length;
    m.opslag.voegToe(m.wereld, e.wachtend);
    e.wachtend = [];
    return n;
  }

  /* HERSTEL: het journaal is de waarheid. Loopt het voor op de projectie (de
     projectie is niet weggeschreven, het journaal wel), dan wordt alleen het
     ontbrekende stuk opnieuw toegepast -- niet de hele geschiedenis. Loopt het
     achter, dan staat er in de projectie iets waar geen bewijs voor is, en dat
     wordt niet stil rechtgezet: de motor weigert te boeken tot een mens kijkt. */
  function herstel(e) {
    const journaal = m.opslag.laatste(m.wereld);
    const projectie = e.laatstToegepast - e.wachtend.length;
    if (journaal > projectie && !e.wachtend.length) {
      for (const g of m.opslag.lees(m.wereld, projectie + 1, journaal)) projecteer(e, g);
      e.boekVolgorde = journaal;
      e.integriteit = null;
    } else if (journaal < projectie) {
      e.integriteit = { stand: 'journaal-achter', projectie, journaal };
    } else e.integriteit = null;
  }

  /* Voor controle, herhaling en onderzoek -- niet voor gewone beslissingen. */
  function gebeurtenissen(vanaf = 1, tot = Infinity) {
    return m.opslag.lees(m.wereld, vanaf, tot);
  }

  /* Zet een momentopname van saldi (bij volgnummer `bij`) plus het journaal
     daarna om in de saldi van nu. Een herhaling vanaf een bekend punt, en de
     controle dat de projectie precies het journaal is. */
  function saldiNa(saldiBij, bij, tot) {
    const saldi = Object.assign({}, saldiBij);
    for (const g of gebeurtenissen(bij + 1, tot)) {
      for (const lijn of g.regels) saldi[lijn.rekening] = rond(saldi[lijn.rekening]) + lijn.debet - lijn.credit;
    }
    return saldi;
  }

  return { metOorzaak, rekening, regel, boek, bevestig, herstel, gebeurtenissen, saldiNa, regelVoorScherm };
};

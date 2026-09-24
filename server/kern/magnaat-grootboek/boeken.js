/* Magnaat Grootboek -- boeken, en de projectie die het journaal volgt.

   Een boeking levert EEN gebeurtenis op: wat er gebeurde (`soort`), wie het
   veroorzaakte (`oorzaak`), onder welke regels en motor, met daaronder de
   postings -- wie geeft, wie ontvangt. De gebeurtenis gaat eerst in een
   wachtrij in de projectie en pas bij `bevestig` het journaal in. Dat is geen
   omweg maar een grens: een consument die op een KOPIE rekent en die bij een
   weigering weggooit, laat dan ook niets in het bewijs achter.

   De projectie draagt: de saldi, `laatstToegepast` (tot en met welk
   volgnummer die saldi het journaal weergeven), lopende totalen voor de
   balanscontrole, een klein venster `recent` voor het scherm en `vandaag` voor
   de posten van de lopende periode. Niets daarvan vraagt het hele journaal.

   WAT HET GROOTBOEK NIET KENT: waarom er geboekt wordt. Welke soorten
   gebeurtenissen er bestaan, welke versies de regels hebben en in welke
   periode de wereld staat, zegt de consument (./index.js). Het veld heet in
   een gebeurtenis `dag` omdat het zo in het journaal staat sinds ronde A1;
   voor het grootboek is het een periodenummer en niets meer. */
'use strict';
const { geld, som } = require('./geld');

module.exports = (g) => {
  let oorzaak = null;

  /* Wie een reeks boekingen veroorzaakt, zet dat hier voor de duur van die
     reeks. Synchroon, dus zonder kans dat twee oorzaken door elkaar lopen. */
  function metOorzaak(waarom, werk) {
    const vorige = oorzaak;
    oorzaak = waarom;
    try { return werk(); } finally { oorzaak = vorige; }
  }

  const normaalVan = (soort) => (['actief', 'kosten'].includes(soort) ? 'debet' : 'credit');

  function rekening(p, code, actor, naam, soort, normaal) {
    if (!p.rekeningen[code]) p.rekeningen[code] = { code, actor, naam, soort, normaal: normaal || normaalVan(soort), saldo: 0 };
    return p.rekeningen[code];
  }

  function regel(rekeningCode, actor, naam, soort, kant, bedrag) {
    const r = { rekening: rekeningCode, actor, naam, soort, debet: 0, credit: 0 };
    r[kant] = geld(bedrag);
    return r;
  }

  function pasToe(p, lijn) {
    const r = rekening(p, lijn.rekening, lijn.actor, lijn.naam, lijn.soort, normaalVan(lijn.soort));
    r.saldo += lijn.debet - lijn.credit;
  }

  /* Wat het scherm van een gebeurtenis ziet, op EEN plek: het venster `recent`
     wordt zowel bij boeken als bij een overname gevuld. */
  const regelVoorScherm = (x) => ({ id: x.id, datum: x.datum, omschrijving: x.omschrijving, bedrag: x.bedrag, debet: x.debet, credit: x.credit, labels: x.labels });

  /* De projectie volgt een gebeurtenis. Dezelfde functie voor een verse boeking
     en voor herstel, zodat die twee nooit uit elkaar kunnen lopen. */
  function projecteerGebeurtenis(p, x) {
    for (const lijn of x.regels) pasToe(p, lijn);
    p.laatstToegepast = x.volgnummer;
    p.totalen.debet += x.debet;
    p.totalen.credit += x.credit;
    p.totalen.aantal += 1;
    p.recent.unshift(regelVoorScherm(x));
    if (p.recent.length > g.venster) p.recent.length = g.venster;
    if (!p.vandaag || p.vandaag.dag !== x.dag) p.vandaag = { dag: x.dag, posten: [] };
    p.vandaag.posten.push({ volgnummer: x.volgnummer, labels: x.labels, regels: x.regels });
  }

  function eisIntegriteit(p) {
    if (p.integriteit) {
      throw new Error('De economische projectie loopt voor op het journaal (' + p.integriteit.projectie + ' tegen ' +
        p.integriteit.journaal + '); er wordt niet geboekt tot dat is uitgezocht.');
    }
  }

  function bestaandeGebeurtenis(p, sleutel) {
    const wachtend = p.wachtend.find(x => x.sleutel === sleutel);
    if (wachtend) return wachtend;
    const volgnummer = g.opslag.zoek(g.wereld, sleutel);
    return volgnummer == null ? null : (g.opslag.lees(g.wereld, volgnummer, volgnummer)[0] || null);
  }

  function boek(p, sleutel, soort, omschrijving, regels, labels = []) {
    sleutel = String(sleutel || '').slice(0, 160);
    if (!sleutel) throw new Error('Een economische boeking vereist een idempotentiesleutel.');
    if (!g.soorten[soort]) throw new Error('Onbekende economische gebeurtenis: ' + soort + '.');
    eisIntegriteit(p);
    const bestaand = bestaandeGebeurtenis(p, sleutel);
    if (bestaand) return bestaand;
    const schoon = regels.filter(r => geld(r.debet) > 0 || geld(r.credit) > 0).map(r => Object.assign({}, r, {
      debet: geld(r.debet), credit: geld(r.credit)
    }));
    const debet = som(schoon.map(r => r.debet));
    const credit = som(schoon.map(r => r.credit));
    if (!schoon.length || debet !== credit) {
      throw new Error('Ongebalanceerde journaalpost geweigerd: ' + omschrijving + ' (' + debet + ' / ' + credit + ').');
    }
    const periode = g.periode(p);
    p.boekVolgorde += 1;
    const x = {
      id: g.idVoorvoegsel + '-' + String(periode.nummer).padStart(4, '0') + '-' + String(p.boekVolgorde).padStart(5, '0'),
      wereld: g.wereld, volgnummer: p.boekVolgorde, soort, oorzaak,
      regelVersie: g.versies.regel, motorVersie: g.versies.motor,
      sleutel, dag: periode.nummer, datum: periode.datum, omschrijving,
      bedrag: Math.max(...schoon.map(r => Math.max(r.debet, r.credit))),
      debet, credit, regels: schoon, labels: labels.slice(0, 8)
    };
    projecteerGebeurtenis(p, x);
    p.wachtend.push(x);
    return x;
  }

  /* De wachtrij het journaal in. Wie een projectie wegschrijft, bevestigt
     eerst -- anders staat er een saldo waar geen bewijs onder ligt. */
  function bevestig(p) {
    if (!p.wachtend.length) return 0;
    const n = p.wachtend.length;
    g.opslag.vulJournaalAan(g.wereld, p.wachtend);
    p.wachtend = [];
    return n;
  }

  return { metOorzaak, rekening, regel, boek, bevestig, projecteerGebeurtenis, regelVoorScherm };
};

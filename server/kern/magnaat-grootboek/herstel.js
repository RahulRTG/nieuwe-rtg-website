/* Magnaat Grootboek -- herstel, herhaling, controle en overname.

   Het journaal is de waarheid en de projectie volgt. Dit bestand bevat alles
   wat die twee naast elkaar legt: bijwerken als het journaal voorloopt,
   weigeren als het achterloopt, een herhaling vanaf een bekend volgnummer, en
   de controle dat de projectie precies het journaal is. */
'use strict';
const { rond } = require('./geld');

module.exports = (g, b) => {
  /* HERSTEL. Loopt het journaal voor op de projectie (de projectie is niet
     weggeschreven, het journaal wel), dan wordt alleen het ontbrekende stuk
     opnieuw toegepast -- niet de hele geschiedenis. Loopt het achter, dan
     staat er in de projectie iets waar geen bewijs voor is, en dat wordt niet
     stil rechtgezet: het grootboek weigert te boeken tot een mens kijkt. */
  function herstelProjectie(p) {
    const journaal = g.opslag.laatsteVolgnummer(g.wereld);
    const projectie = p.laatstToegepast - p.wachtend.length;
    if (journaal > projectie && !p.wachtend.length) {
      for (const x of g.opslag.lees(g.wereld, projectie + 1, journaal)) b.projecteer(p, x);
      p.boekVolgorde = journaal;
      p.integriteit = null;
    } else if (journaal < projectie) {
      p.integriteit = { stand: 'journaal-achter', projectie, journaal };
    } else p.integriteit = null;
  }

  /* Voor controle, herhaling en onderzoek -- niet voor gewone beslissingen. */
  function gebeurtenissen(vanaf = 1, tot = Infinity) {
    return g.opslag.lees(g.wereld, vanaf, tot);
  }

  /* Zet een momentopname van saldi (bij volgnummer `bij`) plus het journaal
     daarna om in de saldi van nu. */
  function saldiNa(saldiBij, bij, tot) {
    const saldi = Object.assign({}, saldiBij);
    for (const x of gebeurtenissen(bij + 1, tot)) {
      for (const lijn of x.regels) saldi[lijn.rekening] = rond(saldi[lijn.rekening]) + lijn.debet - lijn.credit;
    }
    return saldi;
  }

  /* De controle: geen gat, geen dubbel, elke gebeurtenis in balans, en -- als
     de hele historie er is -- de saldi van de projectie precies die van het
     journaal. Een gat van voor de overname wordt benoemd, niet verzwegen. */
  function verifieer(p) {
    const gat = g.opslag.ontbrekend(g.wereld);
    const bevindingen = [];
    let verwacht = gat ? gat.tot + 1 : 1;
    for (const x of gebeurtenissen()) {
      if (x.volgnummer !== verwacht) bevindingen.push('volgnummer ' + x.volgnummer + ' waar ' + verwacht + ' verwacht werd');
      if (x.debet !== x.credit) bevindingen.push(x.id + ' is niet in balans');
      verwacht = x.volgnummer + 1;
    }
    if (verwacht - 1 !== p.laatstToegepast) bevindingen.push('het journaal eindigt bij ' + (verwacht - 1) + ', de projectie bij ' + p.laatstToegepast);
    if (!gat) {
      const saldi = saldiNa({}, 0);
      for (const [code, r] of Object.entries(p.rekeningen)) {
        if ((saldi[code] || 0) !== r.saldo) bevindingen.push('saldo ' + code + ': projectie ' + r.saldo + ', journaal ' + (saldi[code] || 0));
      }
    }
    return { ok: !bevindingen.length, gebeurtenissen: verwacht - 1, historieVanaf: gat ? gat.tot + 1 : 1, bevindingen };
  }

  /* EENMALIG: een journaal dat van elders komt (een wereld van voor ronde A1)
     gaat de opslag in, en de projectie krijgt haar lopende velden. De saldi
     zelf stonden al in de projectie; die worden niet opnieuw opgeteld. Wat er
     ontbreekt, geeft de consument mee als gat -- het grootboek verzint niets. */
  function neemOver(p, { gebeurtenissen: lijst, sleutels, ontbrekend }) {
    g.opslag.neemOver(g.wereld, { gebeurtenissen: lijst, sleutels, ontbrekend });
    p.laatstToegepast = p.boekVolgorde;
    p.totalen = { debet: 0, credit: 0, aantal: 0 };
    for (const x of lijst) { p.totalen.debet += x.debet; p.totalen.credit += x.credit; p.totalen.aantal += 1; }
    p.recent = lijst.slice(-g.venster).reverse().map(b.regelVoorScherm);
    const nu = g.periode(p).nummer;
    p.vandaag = { dag: nu, posten: lijst.filter(x => x.dag === nu).map(x => ({ volgnummer: x.volgnummer, labels: x.labels, regels: x.regels })) };
  }

  /* De lopende velden die een oudere projectie nog kan missen. Met opzet
     alleen deze: A2.0 verandert de vorm van geen enkele bestaande wereld. */
  function zorgVorm(p) {
    if (!Array.isArray(p.wachtend)) p.wachtend = [];
    if (!p.totalen) p.totalen = { debet: 0, credit: 0, aantal: 0 };
    if (!Array.isArray(p.recent)) p.recent = [];
    if (!Number.isSafeInteger(p.laatstToegepast)) p.laatstToegepast = 0;
  }

  return { herstelProjectie, gebeurtenissen, saldiNa, verifieer, neemOver, zorgVorm };
};

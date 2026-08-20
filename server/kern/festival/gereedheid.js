/* RTG Festival (deelmodule): DE UITSLAG van de gereedheid.

   Afgesplitst van ./gereed.js op dezelfde naad als bij de rechten: daar wordt
   een control GESCHREVEN, hier wordt hij GELEZEN. En wat hier uitkomt is het
   enige getal in deze wereld waar een terrein op opengaat, dus het verdient
   een eigen bestand met zijn eigen regels.

   DRIE DINGEN DIE DIT GETAL NOOIT MAG DOEN:

   1. AFRONDEN NAAR BOVEN OP EEN KRITIEKE CONTROL. Een ontbrekende kritieke
      control zet de stand op NIET GEREED, ook bij 99%. Het percentage blijft
      dan gewoon staan -- het is waar -- maar het is geen oordeel meer.

   2. IETS BEWEREN ZONDER PEILDATUM. "Verlopen" bestaat alleen ten opzichte van
      een dag. Zonder die dag is elke uitslag een gok, en een meter die zijn
      invoer mist hoort niets te beweren (LAT-regel 3). Er komt dus een fout,
      geen 100%.

   3. HONDERD PROCENT VAN NUL ZIJN. Een editie zonder controls is niet gereed;
      hij is ongekeurd. Dat is precies het verschil dat een leeg dashboard
      wegpoetst, en het is de gevaarlijkste vorm van groen die er is.

   ER WORDT NIETS OPGESLAGEN. De stand wordt bij elke vraag opnieuw gerekend uit
   de controls zelf. Een bewaard cijfer loopt achter op het moment dat er een
   stuk verloopt -- en dat is nu juist het moment waarop het ertoe doet. */
'use strict';

const DATUM = /^\d{4}-\d{2}-\d{2}$/;

module.exports = (ctx) => {
  const { editieVind, standVanControl, telt } = ctx;

  function gereedheid(fid, eid, vraag) {
    const e = editieVind(fid, eid);
    if (!e) return { status: 404, error: 'Deze editie bestaat niet.' };
    const op = String((vraag || {}).op || '');
    if (!DATUM.test(op)) {
      return { status: 400, error: 'Op welke dag wordt er gekeurd? Zonder peildatum bestaat "verlopen" niet.' };
    }

    const alle = Object.values(e.controls || {});
    const regels = alle.map(c => {
      const stand = standVanControl(c, op);
      return { id: c.id, groep: c.groep, naam: c.naam, eis: c.eis, kritiek: !!c.kritiek,
        stand, telt: telt(stand),
        geldigTot: c.bewijs ? c.bewijs.geldigTot : null,
        afgetekendDoor: c.bewijs && c.bewijs.afgetekend ? c.bewijs.afgetekend.door : null };
    });

    /* Per groep, zodat zichtbaar is WAAR het vastzit. Alleen groepen die
       werkelijk een control hebben; een lege groep tonen als 0% zou een
       achterstand suggereren die niet bestaat. */
    const groepen = {};
    for (const r of regels) {
      const g = groepen[r.groep] || (groepen[r.groep] = { totaal: 0, gezien: 0, kritiekOpen: 0 });
      g.totaal++;
      if (r.telt) g.gezien++;
      else if (r.kritiek) g.kritiekOpen++;
    }
    for (const g of Object.values(groepen)) {
      g.deel = Math.round((g.gezien / g.totaal) * 1000) / 10;
    }

    const gezien = regels.filter(r => r.telt).length;
    const kritiekOpen = regels.filter(r => r.kritiek && !r.telt);
    /* De open punten, het dringendste eerst: kritiek voor gewoon, en binnen
       dezelfde soort een verlopen stuk voor een stuk dat er nooit was -- want
       verlopen betekent dat iemand dacht dat het geregeld was. */
    const rang = { verlopen: 0, ingediend: 1, ontbreekt: 2 };
    const open = regels.filter(r => !r.telt)
      .sort((a, b) => (b.kritiek - a.kritiek) || (rang[a.stand] - rang[b.stand]));

    /* Wie een kritieke control heeft afgezwakt, en waarom. Dit is de ENIGE weg
       naar groen die geen bewijs vraagt, dus hij hoort in de uitslag te staan
       en niet alleen in een logboek dat niemand opent. */
    const afgezwakt = [];
    for (const c of alle) {
      for (const g of (c.geschiedenis || [])) {
        if (g.wat === 'afgezwakt') afgezwakt.push({ control: c.naam, reden: g.reden, door: g.door, at: g.at });
      }
    }

    const leeg = alle.length === 0;
    const gereed = !leeg && kritiekOpen.length === 0;
    const deel = leeg ? 0 : Math.round((gezien / alle.length) * 1000) / 10;

    let zin;
    if (leeg) zin = 'Ongekeurd: er staat nog geen enkele control. Dit is geen 100%, dit is niets.';
    else if (!gereed) {
      zin = 'NIET GEREED \u00b7 ' + kritiekOpen.length + ' kritieke control'
        + (kritiekOpen.length === 1 ? '' : 's') + ' open: ' + kritiekOpen.slice(0, 3).map(r => r.naam).join(', ')
        + (kritiekOpen.length > 3 ? ' en nog ' + (kritiekOpen.length - 3) : '') + '.';
    } else {
      zin = 'Gereed op ' + op + ' \u00b7 ' + gezien + ' van ' + alle.length + ' controls afgetekend en geldig.';
    }
    if (afgezwakt.length) {
      zin += ' Let op: ' + afgezwakt.length + ' control'
        + (afgezwakt.length === 1 ? ' is' : 's zijn') + ' afgezwakt van kritiek naar gewoon.';
    }

    return { ok: true, op, stand: gereed ? 'gereed' : 'niet-gereed', deel, zin,
      gezien, totaal: alle.length, groepen, open, kritiekOpen: kritiekOpen.length,
      afgezwakt, controls: regels };
  }

  return { gereedheid };
};

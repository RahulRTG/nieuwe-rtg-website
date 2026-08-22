/* Kern-module "socialecommand": Life Command (LIFE.md fase 5).

   DE VIJFDE LAAG VAN HET WERELDPATROON, en de eerste waarin deze wereld iets
   MAG. De graaf ziet, de objectlaag duidt, de lijn ordent -- en hier wordt voor
   het eerst iets gedaan. Precies daarom staat het werkwoord uit LIFE.md par. 3
   in ./voorstellen.js in code en niet in een zin erboven: samenstellen en
   klaarzetten, bevestigen doet de mens.

   DRIE VRAGEN EN VERDER RUST, dezelfde vorm als de cockpit van RTG Geld en die
   van de levenslijn: hoe sta ik ervoor, wat komt eraan, moet ik iets doen. Wat
   hier ANDERS is dan bij geld, is wat "moet ik iets doen" betekent -- daar is
   het een som die niet klopt, hier is het een mens die op antwoord wacht.

   UITZONDERINGSGESTUURD, EN RUST IS EEN UITKOMST (ONTWERP.md). Een cockpit die
   altijd iets te melden heeft, is een lijst. Staat er niets open en wacht er
   niemand, dan zegt dit scherm dat, en dat is een geldige uitkomst en geen lege
   staat. Er komt hier dus nooit een vulling bij om het scherm te vullen.

   WAT DEZE LAAG BEWAART: alleen het actielog, en waarom dat geen uitzondering is
   op "deze wereld bewaart niets" staat in de kop van ./actielog.js.

   Gemount vanuit opzet/kernlaag3b.js, na de sociale graaf (hij leest diens
   beeld) en na de sociale domeinen. */
'use strict';

module.exports = ({ kern, db, save, klok }) => {
  const logMod = require('./actielog')({ db, save, klok });
  const vMod = require('./voorstellen')({ kern });

  /* HET COMMAND CENTER. Drie vragen, en de bronnen die stukgingen erbij -- want
     een cockpit waar een bron uit is weggevallen ziet er RUSTIG uit, en dat is
     de gevaarlijkste vorm van stilte die deze wereld kent. */
  function command(key) {
    const beeld = kern.socialegraaf.beeld(key) || {};
    const v = vMod.voorstellen(key);
    const t = beeld.telling || {};

    return {
      ok: true,
      /* 1. HOE STA IK ERVOOR. Tellingen van DINGEN, nooit van een relatie
         (LIFE.md par. 4.4). */
      stand: {
        wachtOpMij: t.wachtOpMij || 0,
        wachtOpAnder: t.wachtOpAnder || 0,
        achterstallig: t.achterstallig || 0
      },
      /* 2. WAT KOMT ERAAN. De eerste twee vakken van de momentlijn en niet de
         hele lijn: een cockpit die alles toont is een lijst, en dan is er geen
         uitzondering meer. Wie verder wil kijken, opent de lijn. */
      komt: (kern.socialegraaf.lijn(key).vakken || []).slice(0, 2),
      /* 3. MOET IK IETS DOEN. Klaargezet, niet gedaan. */
      voorstellen: v.voorstellen,
      /* RUST IS EEN UITKOMST. Het scherm hoeft dit niet zelf af te leiden uit
         drie lege lijsten; die afleiding hoort op een plek te wonen. */
      rustig: !(t.wachtOpMij || t.achterstallig || v.voorstellen.length),
      stil: [...new Set((beeld.stil || []).concat(v.stil))]
    };
  }

  /* BEVESTIGEN: de enige schrijvende weg van deze wereld. Twee dingen gebeuren
     hier, in deze volgorde, en de volgorde is een besluit:

     1. het domein voert uit
     2. het log schrijft op wat er gebeurde

     Andersom zou het log kunnen beweren dat er iets gebeurde dat mislukte. Een
     handeling die niet doorging, hoort niet in een verantwoording te staan --
     dan verantwoordt het log fictie. Faalt het loggen zelf, dan is de handeling
     wel gedaan en niet opgeschreven; dat is de minst erge van de twee, en het
     komt terug in het antwoord zodat het scherm het kan zeggen. */
  function bevestig(key, id, keuze) {
    const r = vMod.bevestig(key, id, keuze);
    if (r.error) return r;

    const g = logMod.schrijf(key, {
      /* 'lid', want de mens heeft bevestigd. Rahul heeft het klaargezet, en dat
         staat in `waarom` -- het log mag niet beweren dat het systeem koos. */
      wie: 'lid',
      wat: r.voorstel.wat + ': ' + r.keuze + ' (' + r.voorstel.titel + ')',
      waarom: 'klaargezet door Rahul, bevestigd door u',
      gegevens: r.voorstel.gegevens
    });
    return { status: 200, ok: true, keuze: r.keuze,
      gelogd: !g.error, log: g.regel || null };
  }

  /* Een beleidswijziging hoort in hetzelfde geheugen als een handeling: het is
     een besluit van het lid over wat er namens hem mag gebeuren, en zonder die
     regel kan niemand later nagaan waarom Rahul iets wel of niet voorstelde. */
  function logBeleid(key, invoer) {
    const v = invoer && typeof invoer === 'object' ? invoer : {};
    const stukken = [];
    if (v.soort !== undefined) stukken.push('voorstellen "' + v.soort + '" ' + (v.aan === false ? 'uit' : 'aan'));
    if (v.knop !== undefined) stukken.push('schakelaar "' + v.knop + '" ' + (v.aan === false ? 'uit' : 'aan'));
    if (v.horizon !== undefined) stukken.push('horizon ' + Math.round(Number(v.horizon)) + ' dagen');
    return logMod.schrijf(key, {
      wie: 'lid', wat: 'beleid gewijzigd: ' + (stukken.join(', ') || 'geen wijziging'),
      waarom: 'ingesteld door u', gegevens: stukken
    });
  }

  return { socialecommand: { command, bevestig, log: logMod.log, logBeleid } };
};

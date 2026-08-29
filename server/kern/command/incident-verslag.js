/* HET AFSLUITEN EN HET TERUGLEZEN VAN EEN INCIDENT.

   Apart van ./incident.js omdat het een andere handeling is: dat bestand
   BEHEERT de levensloop (openen, overnemen, maatregelen), dit sluit hem af en
   leest hem terug. Het is eruit geknipt toen dat bestand door zijn
   omvangsgrens ging; de naad lag er al.

   SLUITEN KAN NIET TERWIJL HET NOG STUK IS, en dat is de belangrijkste regel
   hier. Een gesloten incident boven een lopende storing is een leugen in de
   historie -- en het is de makkelijkste leugen om te vertellen, want het scherm
   wordt er rustiger van. Het kan wel met `toch` en een reden, en dan staat dat
   zo in het verslag; het is dan een besluit en geen vergissing.

   EEN VERSLAG IS VERPLICHT. Een incident dat sluit met een leeg veld, laat een
   storing achter waar niemand iets van heeft geleerd -- en dat is precies waar
   dit hele object voor bestaat.

   HET DOSSIER TOONT TWEE MOMENTEN NAAST ELKAAR: de momentopname bij het
   ontstaan, en de stand van nu. Alleen de eerste tonen laat een opgelost
   incident als lopend lezen; alleen de tweede maakt onzichtbaar wat er toen aan
   de hand was. */
'use strict';

const klok = require('../../lib/klok');

const { impactVan } = require('./incident-impact');
const { NIVEAUS } = require('../frictie');

const DICHT = 'gesloten';

function maakVerslag({ rij, vind, save, journaal, kaart, vermogenUit, levend }) {
  const nu = () => klok.datum().toISOString();

  function kort(i) {
    return { id: i.id, status: i.status, vermogen: i.vermogen, naam: i.naam, wat: i.wat,
      begonnen: i.begonnen, hersteldAt: i.hersteldAt, geslotenAt: i.geslotenAt,
      eigenaar: i.eigenaar, bron: i.bron, maatregelen: i.maatregelen.length,
      aanleidingen: i.bijAanvang.aanleidingen.lijst.length };
  }

  function sluit(id, o) {
    const i = vind(id);
    if (!i) return { error: 'Dat incident bestaat niet.', status: 404 };
    if (i.status === DICHT) return { error: 'Dat incident is al gesloten.', status: 409 };
    const opt = o || {};
    const verslag = String(opt.verslag || '').trim();
    if (verslag.length < 10) {
      return { error: 'Een incident sluit met een verslag: wat was er, wat is er gedaan, wat was de uitkomst.',
        status: 400 };
    }
    const v = vermogenUit(kaart(), i.vermogen);
    const nogStuk = !!(v && v.oordeel === 'storing');
    if (nogStuk && !opt.toch) {
      return { error: 'Dit vermogen staat nog op storing. Sluiten kan wel, maar dan met "toch" en een reden ' +
        '-- een gesloten incident boven een lopende storing is een leugen in de historie.', status: 409,
        vermogen: { oordeel: v.oordeel, mens: v.taal ? v.taal.mens : null } };
    }
    i.status = DICHT; i.geslotenAt = nu();
    i.verslag = { tekst: verslag.slice(0, 4000), door: String(opt.door || 'onbekend'), at: i.geslotenAt,
      geslotenBovenEenStoring: nogStuk,
      reden: nogStuk ? String(opt.reden || '').slice(0, 500) : null,
      bijSluiten: v ? { impact: impactVan(v), oordeel: v.oordeel, graad: v.graad } : null,
      /* Twee duren en niet een. De eerste loopt tot het SLUITEN, de tweede tot
         het HERSTELLEN; het verschil ertussen is hoe lang er niemand naar keek,
         en dat is precies het getal dat een enkele "duur" wegpoetst. */
      duurMinuten: Math.round((Date.parse(i.geslotenAt) - Date.parse(i.begonnen)) / 60000),
      hersteldNaMinuten: i.hersteldAt
        ? Math.round((Date.parse(i.hersteldAt) - Date.parse(i.begonnen)) / 60000) : null };
    if (save) save();
    journaal.noteer({ actor: i.verslag.door, actie: 'incident sluiten', objectType: 'incident', objectId: i.id,
      niveau: NIVEAUS.hand, reden: verslag.slice(0, 200),
      na: { duurMinuten: i.verslag.duurMinuten, bovenEenStoring: nogStuk } });
    return { incident: dossier(i.id) };
  }

  function dossier(id) {
    const i = vind(id);
    if (!i) return { error: 'Dat incident bestaat niet.', status: 404 };
    const v = vermogenUit(kaart(), i.vermogen);
    return Object.assign(kort(i), {
      reden: i.reden, door: i.door, bijAanvang: i.bijAanvang,
      maatregelen: i.maatregelen, verslag: i.verslag,
      nu: v ? { oordeel: v.oordeel, graad: v.graad, mens: v.taal ? v.taal.mens : null, impact: impactVan(v) }
        : { nietTeLezen: 'de gezondheidskaart is nu niet te lezen' },
      journaal: journaal.overObject ? journaal.overObject('incident', i.id) : []
    });
  }

  function lijst(filter) {
    const f = filter || {};
    let alle = rij().slice().reverse();
    if (f.status) alle = alle.filter(i => i.status === f.status);
    else if (!f.alles) alle = alle.filter(levend);
    if (f.vermogen) alle = alle.filter(i => i.vermogen === String(f.vermogen));
    return alle.slice(0, Number(f.max || 50)).map(kort);
  }

  function tel() {
    const alle = rij();
    const per = (st) => alle.filter(i => i.status === st).length;
    return { totaal: alle.length, open: per('open'), bezig: per('in behandeling'),
      hersteld: per('hersteld'), gesloten: per(DICHT),
      zonderEigenaar: alle.filter(i => levend(i) && !i.eigenaar).length,
      /* Een incident dat is hersteld maar nooit is afgesloten, is werkvoorraad
         van een eigen soort: de storing is weg en de les is nooit getrokken. */
      wachtOpVerslag: alle.filter(i => i.status === 'hersteld').length };
  }

  return { kort, sluit, dossier, lijst, tel };
}

module.exports = { maakVerslag };

/* CONCERN (deelmodule): DE TIJDMACHINE. De tweede helft van wet 4 uit
   CONCERN.md: juridische waarheid heeft een bron (./bron.js) en een
   geschiedenis (hier).

   EEN JURIDISCH FEIT WORDT NOOIT OVERSCHREVEN. Marco is bestuurder tot en met
   31 augustus 2027, Lisa vanaf 1 september. Dat zijn TWEE regels en de eerste
   blijft staan -- anders is de toestand van vandaag te lezen en die van vorig
   jaar niet, en juist die heb je nodig bij een audit of een geschil.

   HET VENSTER IS PRECIES DAT VAN server/bedrijf/rollen.js: `van` en `tot`
   inclusief, datum als 'JJJJ-MM-DD', vergelijking op tekst. Geen gemak: die
   module bewaakt de toegang echt, en een venster dat hier anders is zegt iets
   anders dan de poort.

   ENKELVOUDIG OF MEERVOUDIG. Een entiteit heeft EEN naam tegelijk, maar
   meerdere bestuurders naast elkaar. Daarom draagt elk feit een `sleutel`;
   zonder dat onderscheid zou een tweede bestuurder de eerste stil ontslaan. */
'use strict';

const { bron: maakBron, sterkste, bronBeeld } = require('./bron');

/* De soorten feiten, en of er er meer dan een tegelijk kan gelden.
   Wie een soort toevoegt doet dat HIER: ./entiteit.js en ./graaf.js lezen deze
   tabel, en een soort die daar wel wordt gezet maar hier niet staat, zou een
   tweede lijst zijn (LAT-regel 4). */
const SOORTEN = {
  naam:           { meervoud: false, label: 'Statutaire naam' },
  handelsnaam:    { meervoud: true,  label: 'Handelsnaam' },
  rechtsvorm:     { meervoud: false, label: 'Rechtsvorm' },
  zetel:          { meervoud: false, label: 'Statutaire zetel' },
  boekjaar:       { meervoud: false, label: 'Boekjaar' },
  registratie:    { meervoud: true,  label: 'Registratie' },
  fiscaal:        { meervoud: true,  label: 'Fiscaal nummer' },
  bestuurder:     { meervoud: true,  label: 'Bestuurder' },
  volmacht:       { meervoud: true,  label: 'Volmacht' },
  aandeelhouder:  { meervoud: true,  label: 'Aandeelhouder' },
  vergunning:     { meervoud: true,  label: 'Vergunning' },
  bank:           { meervoud: true,  label: 'Bankrelatie' },
  verzekering:    { meervoud: true,  label: 'Verzekering' }
};

const DATUM = /^\d{4}-\d{2}-\d{2}$/;
const isDatum = (d) => typeof d === 'string' && DATUM.test(d);
const dagVoor = (d) => {
  const t = new Date(d + 'T00:00:00Z');
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
};

module.exports = ({ db, save, crypto, vandaag }) => {

  const nu = () => new Date().toISOString();
  const dag = () => (typeof vandaag === 'function' ? vandaag() : new Date().toISOString().slice(0, 10));

  function bak() {
    if (!db.data.concern || typeof db.data.concern !== 'object') db.data.concern = {};
    if (!Array.isArray(db.data.concern.feiten)) db.data.concern.feiten = [];
    return db.data.concern.feiten;
  }

  /* Geldt dit feit op deze dag? Inclusief aan beide kanten, precies zoals
     bedrijf/rollen.js het venster leest. */
  const geldtOp = (f, d) => !(f.van && String(f.van) > d) && !(f.tot && String(f.tot) < d);

  /* ---- schrijven ----

     Een feit vastleggen. `van` mag in het verleden liggen (een bestuurder die
     er al drie jaar zit wordt vandaag pas ingevoerd) en in de toekomst (een
     benoeming die per 1 september ingaat). Dat is geen randgeval maar de
     normale gang van zaken, en het is precies waarom er een venster is en geen
     "actief"-vlag. */
  function zet(entiteit, soort, opties) {
    const o = opties || {};
    if (!entiteit) return { status: 400, error: 'Bij welke entiteit hoort dit gegeven?' };
    const def = SOORTEN[soort];
    if (!def) return { status: 400, error: 'Dit soort gegeven kennen we niet: ' + soort };

    const waarde = o.waarde;
    if (waarde === undefined || waarde === null || waarde === '') {
      return { status: 400, error: 'Een gegeven zonder waarde leggen we niet vast.' };
    }
    const van = o.van === undefined || o.van === null ? dag() : o.van;
    if (!isDatum(van)) return { status: 400, error: 'Vanaf welke datum geldt dit? (JJJJ-MM-DD)' };
    const tot = o.tot === undefined || o.tot === null ? null : o.tot;
    if (tot !== null && !isDatum(tot)) return { status: 400, error: 'Tot welke datum geldt dit? (JJJJ-MM-DD)' };
    if (tot !== null && tot < van) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };

    /* DE BRON IS NIET OPTIONEEL. Dit is wet 4 en de hele reden dat ./bron.js
       bestaat; een gegeven dat hier zonder bron langskomt hoort te stuiten en
       niet stil met bron `null` de opslag in te glijden. */
    const b = maakBron(o.bronSoort, o.bronDetail, o.wie);
    if (b.error) return { status: 400, error: b.error, uitleg: b.uitleg };

    const sleutel = def.meervoud ? String(o.sleutel || waarde).slice(0, 120) : '';
    if (def.meervoud && !sleutel) {
      return { status: 400, error: 'Bij een gegeven dat meer dan een keer kan gelden hoort een sleutel.' };
    }

    /* De vorige loop sluiten. Bij een enkelvoudig gegeven is dat de vorige
       waarde, bij een meervoudig alleen dezelfde sleutel -- anders zou een
       tweede bestuurder de eerste ontslaan. Sluiten gebeurt op de dag VOOR de
       nieuwe ingangsdatum: twee bestuurders die elkaar opvolgen horen geen dag
       te overlappen en geen dag gat te laten. */
    const open = bak().filter(f => f.entiteit === entiteit && f.soort === soort
      && (def.meervoud ? f.sleutel === sleutel : true)
      && (f.tot === null || String(f.tot) >= van));
    for (const f of open) {
      if (String(f.van) >= van) { f.vervallen = true; f.vervallenOm = 'overschreven door een gegeven met dezelfde of eerdere ingangsdatum'; continue; }
      f.tot = dagVoor(van);
      f.gesloten = nu();
    }

    const feit = {
      id: 'feit_' + crypto.randomBytes(6).toString('hex'),
      entiteit, soort, sleutel, waarde,
      van, tot,
      bron: b.bron,
      extra: o.extra && typeof o.extra === 'object' ? o.extra : null,
      gezet: nu()
    };
    bak().push(feit);
    save();
    return { ok: true, feit: beeld(feit) };
  }

  /* Een lopend feit beeindigen. Geen verwijdering: een bestuurder die aftreedt
     is geen bestuurder die er nooit was. */
  function beeindig(id, tot, opties) {
    const f = bak().find(x => x.id === id && !x.vervallen);
    if (!f) return { status: 404, error: 'Dit gegeven bestaat niet.' };
    const d = tot === undefined || tot === null ? dag() : tot;
    if (!isDatum(d)) return { status: 400, error: 'Tot welke datum gold dit? (JJJJ-MM-DD)' };
    if (d < String(f.van)) return { status: 400, error: 'De einddatum ligt voor de begindatum.' };
    const b = maakBron((opties || {}).bronSoort, (opties || {}).bronDetail, (opties || {}).wie);
    if (b.error) return { status: 400, error: b.error, uitleg: b.uitleg };
    f.tot = d;
    f.gesloten = nu();
    f.slotBron = b.bron;
    save();
    return { ok: true, feit: beeld(f) };
  }

  /* ---- lezen ---- */

  const beeld = (f) => ({
    id: f.id, soort: f.soort, label: SOORTEN[f.soort] ? SOORTEN[f.soort].label : f.soort,
    sleutel: f.sleutel || null, waarde: f.waarde,
    van: f.van, tot: f.tot, loopt: f.tot === null,
    bron: bronBeeld(f.bron), extra: f.extra || null
  });

  /* ALLES WAT OP DEZE DAG GOLD. Dit is de tijdmachine zelf: geef een datum en
     je krijgt de entiteit zoals zij er toen bij stond, niet zoals zij er nu bij
     staat. Zonder datum: vandaag. */
  function opDatum(entiteit, datum) {
    const d = isDatum(datum) ? datum : dag();
    const uit = {};
    for (const f of bak()) {
      if (f.entiteit !== entiteit || f.vervallen || !geldtOp(f, d)) continue;
      if (SOORTEN[f.soort] && SOORTEN[f.soort].meervoud) (uit[f.soort] = uit[f.soort] || []).push(beeld(f));
      else uit[f.soort] = beeld(f);
    }
    return { op: d, feiten: uit };
  }

  /* Een enkel gegeven op een dag -- de vorm die de graaf en de bevoegdheidsvraag
     gebruiken. Bij een meervoudig gegeven een lijst, anders een feit of null. */
  function opDatumVan(entiteit, soort, datum) {
    const r = opDatum(entiteit, datum).feiten[soort];
    if (r !== undefined) return r;
    return SOORTEN[soort] && SOORTEN[soort].meervoud ? [] : null;
  }

  /* De hele lijn van een gegeven, oud naar nieuw. Dit is wat een auditor leest:
     niet de stand, maar het verloop. */
  function geschiedenis(entiteit, soort, sleutel) {
    return bak()
      .filter(f => f.entiteit === entiteit && !f.vervallen
        && (soort ? f.soort === soort : true)
        && (sleutel ? f.sleutel === sleutel : true))
      .sort((a, b) => String(a.van).localeCompare(String(b.van)) || String(a.gezet).localeCompare(String(b.gezet)))
      .map(beeld);
  }

  /* Wat er binnenkort afloopt. Een vergunning die over 18 dagen verloopt is
     geen fout maar een seintje, en het verschil hoort in het antwoord te staan
     (zie ./readiness.js, dat hier zijn "aandacht"-punten uit haalt). */
  function verlooptBinnen(entiteit, dagen) {
    const d = dag();
    const grens = new Date(d + 'T00:00:00Z');
    grens.setUTCDate(grens.getUTCDate() + (Number.isFinite(dagen) ? dagen : 60));
    const tot = grens.toISOString().slice(0, 10);
    return bak()
      .filter(f => (!entiteit || f.entiteit === entiteit) && !f.vervallen
        && f.tot && String(f.tot) >= d && String(f.tot) <= tot)
      .sort((a, b) => String(a.tot).localeCompare(String(b.tot)))
      .map(f => Object.assign(beeld(f), { entiteit: f.entiteit }));
  }

  function verwijderEntiteit(entiteit) {
    const f = bak();
    for (let i = f.length - 1; i >= 0; i--) if (f[i].entiteit === entiteit) f.splice(i, 1);
  }

  return { TIJD_SOORTEN: SOORTEN, tijdZet: zet, tijdBeeindig: beeindig,
    tijdOpDatum: opDatum, tijdOpDatumVan: opDatumVan, tijdGeschiedenis: geschiedenis,
    tijdVerlooptBinnen: verlooptBinnen, tijdVerwijderEntiteit: verwijderEntiteit,
    tijdVandaag: dag, tijdSterkste: sterkste };
};

module.exports.SOORTEN = SOORTEN;
module.exports.isDatum = isDatum;
module.exports.dagVoor = dagVoor;

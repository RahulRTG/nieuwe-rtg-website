/* RTG School, de leerstof-motor: van leerlijn naar les naar oefenen.

   De leerlijnen (data) staan in ./leerstof-data/, de opgave-generatoren in
   ./leerstof-gen.js. Dit deel is de stroom: welke vakken horen bij jouw
   groep, de les in gewone taal, en de oefensessie van vijf verse opgaven.
   Server-authoritatief: de antwoorden blijven hier, de client krijgt alleen
   de vraag. Haal je vier van de vijf, dan wordt het leerdoel in je
   leerpaspoort bijgeschreven (kern/onderwijs.js). Er zijn bewust geen
   scores buiten de sessie, geen reeksen en geen ranglijsten: leren is geen
   wedstrijd, en een fout is gewoon de volgende stap in de les. */
const { REKENEN } = require('./leerstof-data/rekenen');
const { TAAL } = require('./leerstof-data/taal');
const { opgave } = require('./leerstof-gen');

const OPGAVEN_PER_SESSIE = 5;
const BEHAALD_BIJ = 4;

/* alle leerdoelen plat, geindexeerd op id, met vak en groep erbij -- op
   moduleniveau, zodat ook de schooltoetsen (school/toets.js) uit dezelfde
   bibliotheek putten zonder de stateful motor nodig te hebben */
const DOELEN = {};
const PER_GROEP = {};
for (const [vak, lijn] of [['rekenen', REKENEN], ['taal', TAAL]]) {
  for (const g of lijn) {
    PER_GROEP[g.groep] = PER_GROEP[g.groep] || [];
    for (const d of g.doelen) {
      DOELEN[d.id] = Object.assign({ vak, groep: g.groep }, d);
      PER_GROEP[g.groep].push(d.id);
    }
  }
}

function maakLeerstof({ db, save, onderwijs }) {
  const nu = () => new Date().toISOString();

  function sessies() {
    if (!db.data.leerstofSessies || typeof db.data.leerstofSessies !== 'object') db.data.leerstofSessies = {};
    return db.data.leerstofSessies;
  }
  const norm = s => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

  /* ---- de leerlijn voor een groep: wat leer je hier, en wat heb je al ---- */
  function vakken(key, d) {
    const groep = Number(String(d && d.groep || '').replace(/\D/g, ''));
    if (!PER_GROEP[groep]) return { status: 400, error: 'Kies een groep van 1 tot en met 8.' };
    const pas = onderwijs.mijn(key);
    const behaald = (pas.doelen) || {};
    const perVak = {};
    for (const id of PER_GROEP[groep]) {
      const doel = DOELEN[id];
      perVak[doel.vak] = perVak[doel.vak] || [];
      perVak[doel.vak].push({ id, naam: doel.naam, ref: doel.ref || null, behaald: !!behaald[id] });
    }
    return { ok: true, groep, vakken: Object.entries(perVak).map(([vak, doelen]) => ({ vak, doelen })) };
  }

  function les(d) {
    const doel = DOELEN[String(d && d.doel || '')];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    return { ok: true, doel: { id: doel.id, naam: doel.naam, vak: doel.vak, groep: doel.groep, les: doel.les, ref: doel.ref || null } };
  }

  /* ---- oefenen: vijf verse opgaven, een tegelijk, antwoorden op de server ---- */
  function oefenStart(key, d) {
    const doel = DOELEN[String(d && d.doel || '')];
    if (!doel) return { status: 404, error: 'Dat leerdoel staat niet in de leerlijn.' };
    const vragen = [];
    for (let i = 0; i < OPGAVEN_PER_SESSIE; i++) vragen.push(opgave(doel.gen));
    sessies()['lid:' + key] = { doel: doel.id, vragen, ix: 0, goed: 0, at: nu() };
    save();
    const v = vragen[0];
    return { ok: true, doel: doel.id, naam: doel.naam, totaal: OPGAVEN_PER_SESSIE, nr: 1, vraag: v.v, opties: v.opties || null };
  }

  function oefenAntwoord(key, d) {
    const s = sessies()['lid:' + key];
    if (!s) return { status: 400, error: 'Begin eerst een oefensessie.' };
    const vraag = s.vragen[s.ix];
    if (!vraag) return { status: 400, error: 'Deze sessie is al klaar; begin een nieuwe.' };
    const goed = norm(d && d.antwoord) === norm(vraag.a);
    if (goed) s.goed += 1;
    s.ix += 1;
    const klaar = s.ix >= s.vragen.length;
    const uit = { ok: true, goed, juisteAntwoord: vraag.a, nr: s.ix, totaal: s.vragen.length, aantalGoed: s.goed, klaar };
    if (klaar) {
      uit.behaald = s.goed >= BEHAALD_BIJ;
      if (uit.behaald) {
        const b = onderwijs.doelBehaald(key, { doel: s.doel });
        if (b.error) uit.behaald = false; // geen paspoort (bijv. niet ingeschreven): eerlijk melden
        uit.paspoort = b.error || 'bijgeschreven';
      } else {
        uit.advies = 'Lees de les nog eens rustig door en probeer het opnieuw; elke poging is gewoon oefening.';
      }
      delete sessies()['lid:' + key];
    } else {
      const volgende = s.vragen[s.ix];
      uit.vraag = volgende.v;
      uit.opties = volgende.opties || null;
    }
    save();
    return uit;
  }

  return { leerstofVakken: vakken, leerstofLes: les, leerstofOefenStart: oefenStart, leerstofOefenAntwoord: oefenAntwoord, DOELEN };
}

module.exports = { maakLeerstof, DOELEN };

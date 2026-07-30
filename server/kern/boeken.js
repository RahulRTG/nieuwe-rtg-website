/* RTG Boeken: de e-reader-laag. De huisbibliotheek (boeken-data.js) staat
   voor iedereen klaar; eigen tekstbestanden uit de Bestanden-kluis komen er
   client-side naast (de kluis is de opslag, hier staat geen tweede kopie).
   Wat hier wel leeft is de LEESVOORTGANG per lid: een plek tussen 0 en 1
   per boek, zodat je op elk toestel verdergaat waar je was. Bewust geen
   leesstatistieken of reeksen: lezen is geen wedstrijd. */
const BIEB = require('./boeken-data');
const MAX_BOEKEN = 200;

function maakBoeken({ db, save }) {
  function bord(key) {
    if (!db.data.boeken || typeof db.data.boeken !== 'object') db.data.boeken = {};
    const k = 'lid:' + key;
    if (!db.data.boeken[k]) db.data.boeken[k] = { voortgang: {} };
    return db.data.boeken[k];
  }

  function boekenBieb() {
    return { boeken: BIEB.map(b => ({ id: b.id, titel: b.titel, auteur: b.auteur, jaar: b.jaar,
      over: b.over, woorden: b.tekst.split(/\s+/).length })) };
  }
  function boekenBoek(id) {
    const b = BIEB.find(x => x.id === String(id || ''));
    if (!b) return { status: 404, error: 'Dat boek staat niet in de huisbibliotheek.' };
    return { id: b.id, titel: b.titel, auteur: b.auteur, tekst: b.tekst };
  }
  function boekenVoortgang(key) {
    return { voortgang: bord(key).voortgang };
  }
  // boek: een bieb-id of 'kluis:<bestandId>'; plek: 0..1 (hoe ver je bent)
  function boekenLees(key, { boek, plek }) {
    const id = String(boek || '').slice(0, 80);
    if (!id) return { status: 400, error: 'Welk boek lees je?' };
    const p = Number(plek);
    if (!(p >= 0 && p <= 1)) return { status: 400, error: 'De leesplek is een getal tussen 0 en 1.' };
    const b = bord(key);
    b.voortgang[id] = { plek: Math.round(p * 1000) / 1000, op: new Date().toISOString() };
    const ids = Object.keys(b.voortgang);
    if (ids.length > MAX_BOEKEN) {
      // de oudste plek valt eraf; wie 200 boeken tegelijk leest vergeeft ons dat
      ids.sort((a, c) => Date.parse(b.voortgang[a].op) - Date.parse(b.voortgang[c].op));
      delete b.voortgang[ids[0]];
    }
    save();
    return { ok: true, plek: b.voortgang[id].plek };
  }

  return { boekenBieb, boekenBoek, boekenVoortgang, boekenLees };
}

module.exports = { maakBoeken };

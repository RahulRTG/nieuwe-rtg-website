/* RTG School, de motor: het leerpaspoort dat een leven lang meegaat.

   Een paspoort hangt aan de codenaam (privacy by design: nooit een echte
   naam in dit dossier) en volgt de officiële ladder uit ./onderwijs-ladder.
   Je schrijft je in op een fase, gaat over volgens de doorstroomkaart, en
   elk behaald leerdoel wordt bijgeschreven -- van groep 1 tot de universiteit
   en het leven daarna. Wat hier staat is van de leerling zelf: geen
   ranglijsten, geen reeksen, en een overgang wordt geadviseerd door het
   systeem maar besloten door een mens. */
const { FASEN, TRAPPEN, REFERENTIE, DOORSTROOM, EERLIJK } = require('./onderwijs-ladder');
const { maakBewijs, beheersingVan, BEWIJSSOORTEN } = require('./onderwijs-bewijs');
const { maakGeheugen } = require('./onderwijs-geheugen');

function maakOnderwijs({ db, save, schoon }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/onderwijs', bezit: { onderwijs: 'kaart' } });
  const scho = schoon || ((v, n) => String(v == null ? '' : v).trim().slice(0, n || 200));
  const nu = () => new Date().toISOString();
  const faseVan = id => FASEN.find(f => f.id === id) || null;
  const faseIx = id => FASEN.findIndex(f => f.id === id);

  function borden() {
    return eigen.bak('onderwijs');
  }
  function paspoort(key) {
    const alle = borden();
    const k = 'lid:' + key;
    if (!alle[k]) alle[k] = { fase: null, jaar: 1, historie: [], doelen: {}, at: nu() };
    return alle[k];
  }

  /* Mag je van hier naar daar? Binnen dezelfde reeks is de volgende fase
     altijd goed (groep 3 naar groep 4, of een leerjaar erbij binnen je
     richting); daarbuiten beslist de doorstroomkaart. Terug naar een eerdere
     fase mag ook altijd -- een stap terug is soms de beste stap. */
  function magNaar(vanId, naarId) {
    if (!vanId) return true; // eerste inschrijving: elke fase mag het begin zijn
    if (vanId === naarId) return true;
    const van = faseIx(vanId), naar = faseIx(naarId);
    if (van < 0 || naar < 0) return false;
    if (FASEN[van].trap === FASEN[naar].trap && naar === van + 1) return true; // de normale trede
    if (naar < van && FASEN[naar].trap === FASEN[van].trap) return true;       // stap terug binnen de trap
    const kaart = DOORSTROOM.find(d => d.van === vanId);
    return !!(kaart && kaart.naar.includes(naarId));
  }

  /* ---- de publieke ladder: voor elk scherm hetzelfde beeld ---- */
  function ladder() {
    return { ok: true, trappen: TRAPPEN, fasen: FASEN, referentie: REFERENTIE, doorstroom: DOORSTROOM, eerlijk: EERLIJK };
  }

  /* ---- het eigen paspoort ---- */
  function mijn(key) {
    const p = paspoort(key);
    const f = p.fase ? faseVan(p.fase) : null;
    const kaart = p.fase ? (DOORSTROOM.find(d => d.van === p.fase) || null) : null;
    const ix = p.fase ? faseIx(p.fase) : -1;
    const volgende = ix >= 0 && ix + 1 < FASEN.length && FASEN[ix + 1].trap === FASEN[ix].trap ? FASEN[ix + 1].id : null;
    /* Bij elk doel het WOORD van de beheersing, niet het hele bewijs: dat
       laatste is een eigen vraag (bewijsVan) en hoort niet in elk antwoord
       mee te reizen. Het woord komt uit het bewijs en wordt niet opgeslagen. */
    const doelen = {};
    for (const [id, rij] of Object.entries(p.doelen))
      doelen[id] = Object.assign({}, rij, { bewijs: undefined, stukken: (rij.bewijs || []).length,
        beheersing: beheersingVan(rij).woord });
    return { ok: true, fase: f, jaar: p.jaar, historie: p.historie.slice(-100),
      doelen, verder: { volgende, doorstroom: kaart ? kaart.naar : [], via: (kaart && kaart.via) || null },
      eerlijk: EERLIJK };
  }

  function inschrijf(key, d) {
    d = d || {};
    const f = faseVan(String(d.fase || ''));
    if (!f) return { status: 400, error: 'Die fase staat niet op de ladder.' };
    const p = paspoort(key);
    if (p.fase && !magNaar(p.fase, f.id)) {
      return { status: 400, error: 'Die overstap zit niet in de doorstroomkaart. Vraag een begeleider om mee te kijken.' };
    }
    if (p.fase && p.fase !== f.id) {
      p.historie.push({ van: p.fase, naar: f.id, jaar: p.jaar, reden: scho(d.reden, 200) || null, op: nu() });
      if (p.historie.length > 300) p.historie.splice(0, p.historie.length - 300);
    }
    p.fase = f.id; p.jaar = 1; p.at = nu(); save();
    return mijn(key);
  }

  /* Een leerjaar erbij binnen dezelfde fase (havo 2 naar havo 3). */
  function jaarOver(key) {
    const p = paspoort(key);
    const f = p.fase ? faseVan(p.fase) : null;
    if (!f) return { status: 400, error: 'Schrijf eerst in op een fase.' };
    if (!f.jaren || p.jaar >= f.jaren) return { status: 400, error: 'Dit is al het laatste leerjaar van deze fase; kies de volgende stap op de ladder.' };
    p.jaar += 1; p.historie.push({ van: f.id, naar: f.id, jaar: p.jaar, reden: 'over naar leerjaar ' + p.jaar, op: nu() });
    p.at = nu(); save();
    return mijn(key);
  }

  /* ---- leerdoelen en hun bewijs ----
     Proof of Learning woont in een eigen module: het paspoort weet WAT je
     kunt, die laag weet WAAROM we dat denken. Zelfde opslag, andere vraag. */
  const { doelBehaald, bewijsVan } = maakBewijs({ paspoort, save, nu, scho });
  /* De Memory Engine: wanneer komt een behaald doel terug. Ook hier geldt dat
     het bij het leerdoel in het paspoort hoort en niet in een lijst ernaast. */
  const { herhalingen, noteerOphaling, staatOpen } = maakGeheugen({ paspoort, save, nu });

  return { ladder, mijn, inschrijf, jaarOver, doelBehaald, bewijsVan, beheersingVan,
    herhalingen, noteerOphaling, staatOpen, magNaar, FASEN, BEWIJSSOORTEN };
}

module.exports = { maakOnderwijs };

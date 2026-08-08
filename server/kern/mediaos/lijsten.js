/* Media OS (deelmodule): AFSPEELLIJSTEN OVER DE VIER VORMEN HEEN.

   Een lijst is het tweede ding dat in geen van de vier domeinen bestond (het
   eerste is de bibliotheek in ./eigen.js). Klankwerk kent uitgaven, Clips kent
   clips, het Theater kent video's -- maar niemand kende "de rit naar Ibiza":
   drie nummers, een video en twee korte clips achter elkaar.

   DE LIJST BEWAART ALLEEN ID's, net als de bibliotheek. Wat een stuk IS blijft
   van zijn domein. Dat is geen zuinigheid maar de enige manier waarop dit
   klopt: haalt een maker zijn nummer weg, dan is het hier ook weg -- en het
   verdwijnt niet stil, maar staat als "weggehaald door de maker" in de lijst
   (LAT.md regel 4 en 5). Een bevroren kopie zou een lijst opleveren die
   nummers toont die niemand meer kan spelen.

   EN DE DEUR BLIJFT VAN HET DOMEIN. Wat u niet mag zien, staat niet in uw
   lijst -- ook niet als u het er ooit zelf in zette en de deur later dichtging
   (een 18+-kanaal, een clip van iemand die u blokkeerde). De lijst lost elk
   stuk op via dezelfde catalogus als de wereld, met uw eigen sessie. Er is
   dus geen weg om via een lijst iets binnen te halen wat de wereld u weigert.

   WAT EEN LIJST NIET IS: hij is van u alleen. Lijsten delen, samen aan een
   lijst werken en een publieke lijst van een maker bestaan hier niet. Staat in
   TAKEN.md; zolang het er niet is, belooft het scherm het ook niet. */
'use strict';

const MAX_LIJSTEN = 50;
const MAX_PER_LIJST = 300;

module.exports = ({ db, save, schoon, crypto, catalogus }) => {
  const nu = () => new Date().toISOString();
  const id = () => 'ml' + crypto.randomBytes(4).toString('hex');

  function tabel() {
    if (!db.data.mediaLijsten || typeof db.data.mediaLijsten !== 'object') db.data.mediaLijsten = {};
    return db.data.mediaLijsten;
  }
  const mijne = (key) => {
    const t = tabel();
    if (!Array.isArray(t[key])) t[key] = [];
    return t[key];
  };
  const vind = (key, lid) => mijne(key).find(l => l.id === String(lid || '')) || null;
  const kort = (l) => ({ id: l.id, naam: l.naam, aantal: (l.stukken || []).length, at: l.at, bijgewerkt: l.bijgewerkt || l.at });

  /* ---- de lijst als geheel ---- */
  function maak(sess, opdracht) {
    const naam = schoon((opdracht || {}).naam, 60);
    if (!naam) return { status: 400, error: 'Geef de lijst een naam.' };
    const rij = mijne(sess.key);
    if (rij.length >= MAX_LIJSTEN) return { status: 409, error: 'U heeft de bovengrens van ' + MAX_LIJSTEN + ' lijsten bereikt.' };
    const l = { id: id(), naam, stukken: [], at: nu(), bijgewerkt: nu() };
    rij.unshift(l); save();
    return { status: 200, ok: true, lijst: kort(l) };
  }
  function zet(sess, opdracht) {
    const o = opdracht || {};
    const l = vind(sess.key, o.id);
    if (!l) return { status: 404, error: 'Deze lijst bestaat niet.' };
    if (o.weg === true) {
      tabel()[sess.key] = mijne(sess.key).filter(x => x !== l); save();
      return { status: 200, ok: true, weg: true, lijsten: mijne(sess.key).map(kort) };
    }
    const naam = schoon(o.naam, 60);
    if (!naam) return { status: 400, error: 'Geef de lijst een naam.' };
    l.naam = naam; l.bijgewerkt = nu(); save();
    return { status: 200, ok: true, lijst: kort(l) };
  }

  /* ---- stukken erin, eruit, en op volgorde ----
     Eén ingang voor de drie handelingen, want ze raken alle drie precies
     dezelfde rij: er is geen stand waarin "toevoegen" en "verplaatsen" iets
     anders van de lijst weten. */
  function stuk(sess, opdracht) {
    const o = opdracht || {};
    const l = vind(sess.key, o.id);
    if (!l) return { status: 404, error: 'Deze lijst bestaat niet.' };
    const sid = String(o.stukId || '');
    if (!catalogus.deelId(sid)) return { status: 400, error: 'Dit is geen geldig stuk-id.' };
    l.stukken = Array.isArray(l.stukken) ? l.stukken : [];
    const staat = l.stukken.findIndex(x => x.id === sid);
    if (o.aan === false) {
      if (staat < 0) return { status: 404, error: 'Dit stuk staat niet in deze lijst.' };
      l.stukken.splice(staat, 1);
    } else if (o.naar != null) {
      /* Verplaatsen kan alleen wat er al in staat. Een "verplaats" die stilletjes
         toevoegt, maakt van een misgetikte volgorde een nieuwe rij (regel 5). */
      if (staat < 0) return { status: 404, error: 'Dit stuk staat niet in deze lijst.' };
      const naar = Math.min(Math.max(Math.round(Number(o.naar)) || 0, 0), l.stukken.length - 1);
      const [x] = l.stukken.splice(staat, 1);
      l.stukken.splice(naar, 0, x);
    } else {
      if (staat >= 0) return { status: 409, error: 'Dit stuk staat al in deze lijst.' };
      if (l.stukken.length >= MAX_PER_LIJST) return { status: 409, error: 'Een lijst draagt hoogstens ' + MAX_PER_LIJST + ' stukken.' };
      l.stukken.push({ id: sid, at: nu() });
    }
    l.bijgewerkt = nu(); save();
    return { status: 200, ok: true, lijst: kort(l), volgorde: l.stukken.map(x => x.id) };
  }

  /* ---- lezen ----
     Alles wat een lijst TOONT komt uit de catalogus met de sessie van de
     lezer. Een stuk dat weg is of achter een dichte deur staat, komt daarom
     niet als kaart terug maar als regel in `verdwenen` -- met de reden die de
     catalogus zelf geeft, niet met een eigen verzinsel. */
  function een(sess, lijstId) {
    const l = vind(sess.key, lijstId);
    if (!l) return { status: 404, error: 'Deze lijst bestaat niet.' };
    const wereld = catalogus.alles(sess);
    const kaart = new Map(wereld.rijen.map(r => [r.id, r]));
    const stukken = [], verdwenen = [];
    for (const x of (l.stukken || [])) {
      const s = kaart.get(x.id);
      if (s) stukken.push(Object.assign({}, s, { erinOp: x.at }));
      else verdwenen.push({ id: x.id, vorm: (catalogus.deelId(x.id) || {}).vorm || null, erinOp: x.at });
    }
    return { status: 200, lijst: kort(l), stukken, verdwenen,
      buiten: wereld.buiten || [],
      uitleg: verdwenen.length
        ? verdwenen.length + ' stuk(ken) uit deze lijst zijn er niet meer voor u: weggehaald door de maker, of achter een deur die nu dicht staat. Ze blijven staan tot u ze weghaalt.'
        : 'Alles in deze lijst is er nog.' };
  }
  const alle = (sess) => ({ status: 200, lijsten: mijne(sess.key).map(kort), max: MAX_LIJSTEN, maxPerLijst: MAX_PER_LIJST });

  return { mediaLijsten: alle, mediaLijst: een, mediaLijstMaak: maak, mediaLijstZet: zet, mediaLijstStuk: stuk,
    MEDIA_MAX_LIJSTEN: MAX_LIJSTEN };
};

/* Kern-module "flits": RTG Flits, de rijhulp van het netwerk. Leden en
   chauffeurs melden onderweg met een tik wat ze zien (flitser, file, ongeval,
   object op de weg, wegwerkzaamheden); wie er aan komt rijden wordt op tijd
   gewaarschuwd. Bewust zonder enige spelmechaniek: geen punten, geen scores,
   geen ranglijsten. Melden is een tik, meer niet.

   Spelregels:
   - Alles op codenaam; een melding draagt nooit een echte naam.
   - Een tweede melding van dezelfde soort binnen 300 meter is geen nieuwe
     melding maar een bevestiging (zo houdt het netwerk zichzelf schoon).
   - "Klopt nog" verlengt het leven van een melding; drie keer "weg" haalt
     hem eraf. Elke soort heeft een eigen houdbaarheid.
   - Landregels: in landen waar flitsermeldingen verboden zijn (o.a. Frankrijk,
     Duitsland, Zwitserland) doen we ze daar simpelweg niet: melden geweigerd
     met uitleg, en bestaande flitsers verschijnen daar niet in het beeld.
     File- en gevaarmeldingen blijven overal aan.
   - Officiele flitserdata is een externe bron die deze demo niet heeft; het
     beeld komt eerlijk van het eigen netwerk. In productie schuift een
     officiele feed in via dezelfde lijstfunctie.

   maakFlits(state) volgt het vaste kern-patroon. */
const { coord } = require('./util');

const SOORTEN = {
  flitser: { naam: 'Flitser', icoon: '\u{1F4F8}', ttlMin: 480 },
  file:    { naam: 'File', icoon: '\u{1F697}', ttlMin: 45 },
  ongeval: { naam: 'Ongeval', icoon: '\u{26A0}\u{FE0F}', ttlMin: 120 },
  object:  { naam: 'Object op de weg', icoon: '\u{1FAA8}', ttlMin: 120 },
  wegwerk: { naam: 'Wegwerkzaamheden', icoon: '\u{1F6A7}', ttlMin: 1440 }
};
const { verbodenVak, LANDREGEL } = require('./flits-landregel'); // de landregel, uit de plek
const DEDUPE_M = 300;         // zelfde soort binnen deze straal = bevestiging
const RADIUS_KM = 15;         // het rondom-beeld
const WEG_STEMMEN = 3;        // zoveel keer "weg" haalt een melding eraf
const MELD_PAUZE_MS = 20000;  // een tik per derde minuut per melder is genoeg
const MAX_MELDINGEN = 4000;   // wereldwijd plafond (oudste eerst weg)

function maakFlits({ db, save, crypto, haversine, ghostSimuleer }) {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/flits', bezit: { flitsMeldingen: 'lijst' } });
  const id = () => 'fl' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const laatsteMelder = new Map();   // key -> ts (rate-limit, alleen in RAM)

  function lijst() {
    return eigen.bak('flitsMeldingen');
  }
  function vers(m) {
    const s = SOORTEN[m.soort]; if (!s) return false;
    const basis = new Date(m.laatstBevestigd || m.at).getTime();
    return Date.now() - basis < s.ttlMin * 60 * 1000 && (m.weg || 0) < WEG_STEMMEN;
  }
  function opschonen() {
    const rij = lijst().filter(vers);
    if (rij.length > MAX_MELDINGEN) rij.splice(0, rij.length - MAX_MELDINGEN);
    eigen.zetBak('flitsMeldingen', rij);
    return rij;
  }

  /* ---- melden: een tik, met dedupe en rust ---- */
  function meld(key, codenaam, data) {
    const soort = SOORTEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Onbekende soort melding.' };
    const lat = coord(data.lat, 90), lng = coord(data.lng, 180);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return { status: 400, error: 'Geen geldige plek.' };
    if (soort === 'flitser' && verbodenVak({ lat, lng })) return { status: 403, error: LANDREGEL };
    /* DE HERHAALSLEUTEL hoort bij de melding en overleeft dus een herstart:
       dezelfde tik nog eens (een afgebroken verzoek, een dubbeltik) geeft de
       eerste uitkomst terug, en dezelfde sleutel voor iets anders is een 409. */
    const idem = String(data.idem || '').slice(0, 80);
    const merk = idem ? key + '|' + idem : null;
    if (merk) {
      const eerder = lijst().find(m => Array.isArray(m.idems) && m.idems.includes(merk));
      if (eerder) {
        if (eerder.soort !== soort || haversine({ lat, lng }, eerder) > DEDUPE_M)
          return { status: 409, error: 'Deze herhaalsleutel hoort bij een andere melding.' };
        return { status: 200, ok: true, herhaald: true, melding: beeld(eerder, { lat, lng }) };
      }
    }
    const vorige = laatsteMelder.get(key);
    if (vorige && Date.now() - vorige < MELD_PAUZE_MS)
      return { status: 429, error: 'Rustig aan: uw vorige melding staat er net.' };
    const rij = opschonen();
    // dichtbij dezelfde soort? Dan telt de tik als bevestiging, niet als nieuw.
    const buurman = rij.find(m => m.soort === soort && haversine({ lat, lng }, m) <= DEDUPE_M);
    laatsteMelder.set(key, Date.now());
    const onthoud = (m) => { if (merk) { m.idems = (m.idems || []).concat(merk).slice(-50); } };
    if (buurman) {
      /* EEN MELDER BEVESTIGT ZICHZELF NIET. Wie hem zelf meldde of al
         bevestigde, meldt hem nu opnieuw: dat is een herhaling en telt niet. */
      if (buurman.melder === key || (buurman.stemmers || []).includes(key)) {
        onthoud(buurman); save();
        return { status: 200, ok: true, herhaald: true, melding: beeld(buurman, { lat, lng }),
          let_op: 'U had deze melding al gedaan of bevestigd; hij telt een keer.' };
      }
      buurman.bevestigingen = (buurman.bevestigingen || 0) + 1;
      buurman.laatstBevestigd = nu(); buurman.weg = 0;
      buurman.stemmers = (buurman.stemmers || []).concat(key).slice(-50);
      onthoud(buurman);
      save();
      return { status: 200, ok: true, bevestigd: true, melding: beeld(buurman, { lat, lng }) };
    }
    const m = { id: id(), soort, lat, lng, door: codenaam, melder: key, bevestigingen: 0, weg: 0, at: nu(), laatstBevestigd: null };
    onthoud(m);
    rij.push(m); save();
    return { status: 200, ok: true, melding: beeld(m, { lat, lng }) };
  }

  /* ---- klopt nog / weg ---- */
  function stem(key, meldingId, klopt) {
    const m = lijst().find(x => x.id === String(meldingId || ''));
    if (!m || !vers(m)) return { status: 404, error: 'Deze melding is er niet meer.' };
    if (klopt && m.melder === key)
      return { status: 403, error: 'Uw eigen melding kunt u niet zelf bevestigen; dat doet een ander die hem ook ziet.' };
    m.stemmers = m.stemmers || [];
    if (m.stemmers.includes(key)) return { status: 200, ok: true, al: true };
    m.stemmers.push(key); if (m.stemmers.length > 50) m.stemmers = m.stemmers.slice(-50);
    if (klopt) { m.bevestigingen = (m.bevestigingen || 0) + 1; m.laatstBevestigd = nu(); m.weg = 0; }
    else m.weg = (m.weg || 0) + 1;
    save();
    return { status: 200, ok: true, weg: (m.weg || 0) >= WEG_STEMMEN };
  }

  /* ---- het rondom-beeld voor het rijscherm ----
     Zonder melder en met de plek op drie decimalen (ongeveer 100 m): een
     codenaam met een exacte plek en een tijd is een spoor van die codenaam, en
     voor een waarschuwing is "hier ongeveer" genoeg. De afstand rekent op de
     echte plek; de melder blijft in de opslag (stemmen, vergeten). */
  const rond3 = (x) => Math.round(x * 1000) / 1000;
  function beeld(m, hier) {
    const s = SOORTEN[m.soort];
    return { id: m.id, soort: m.soort, naam: s.naam, icoon: s.icoon, lat: rond3(m.lat), lng: rond3(m.lng),
      afstandKm: hier ? Math.round(haversine(hier, m) / 100) / 10 : null,   // haversine rekent in meters
      bevestigingen: m.bevestigingen || 0, at: m.at };
  }
  // het tweede argument (een land van de client) telt niet meer mee
  function rond(hier) {
    const lat = Number(hier.lat), lng = Number(hier.lng);
    const geldig = Number.isFinite(lat) && Number.isFinite(lng);
    const hierVerboden = geldig && !!verbodenVak({ lat, lng });
    const rij = opschonen()
      .filter(m => !(m.soort === 'flitser' && (hierVerboden || verbodenVak(m))))
      .map(m => beeld(m, geldig ? { lat, lng } : null))
      .filter(m => !geldig || m.afstandKm <= RADIUS_KM)
      .sort((a, b) => (a.afstandKm ?? 999) - (b.afstandKm ?? 999));
    return { status: 200, meldingen: rij.slice(0, 60), radiusKm: RADIUS_KM,
      flitsToegestaan: !hierVerboden, landRegel: hierVerboden ? LANDREGEL : null,
      soorten: Object.entries(SOORTEN).map(([k, v]) => ({ soort: k, naam: v.naam, icoon: v.icoon, ttlMin: v.ttlMin })),
      bron: 'meldingen van het eigen netwerk (op codenaam); officiele flitserdata schuift in productie hier in' };
  }

  // de vooruitblik: de Ghost Driver-motor over de stad van de rijder
  function vooruit(stad) {
    if (!ghostSimuleer) return { status: 200, uurbeeld: [], waarschuwingen: [] };
    const r = ghostSimuleer({ city: stad || 'Ibiza', code: null, fleet: [] });
    return { status: 200, stad: r.stad, uurbeeld: r.uurbeeld,
      waarschuwingen: r.waarschuwingen.slice(0, 3).map(w => ({ tijd: w.tijd, knooppunt: w.knooppunt, kans: w.kans })) };
  }

  /* ---- vergeten (AVG art. 17) ----
     Een melding is de plek waar dit lid was, met zijn codenaam erop, en een
     stem draagt zijn sleutel. Zijn eigen meldingen gaan weg (ze leven hooguit
     een dag, en zonder melder bewijzen ze niets meer); uit de meldingen van
     anderen gaat alleen zijn stem. */
  function vergeet(key, codenaam) {
    const rij = lijst();
    const houd = rij.filter(m => !(m && codenaam && m.door === codenaam));
    for (const m of houd) if (m && Array.isArray(m.stemmers)) m.stemmers = m.stemmers.filter(k => k !== key);
    eigen.zetBak('flitsMeldingen', houd);
    laatsteMelder.delete(key);
    save();
    return { weg: rij.length - houd.length };
  }

  return { flitsMeld: meld, flitsStem: stem, flitsRond: rond, flitsVooruit: vooruit, flitsVergeet: vergeet };
}

module.exports = { maakFlits };

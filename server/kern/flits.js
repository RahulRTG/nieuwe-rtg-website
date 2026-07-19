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

const SOORTEN = {
  flitser: { naam: 'Flitser', icoon: '\u{1F4F8}', ttlMin: 480 },
  file:    { naam: 'File', icoon: '\u{1F697}', ttlMin: 45 },
  ongeval: { naam: 'Ongeval', icoon: '\u{26A0}\u{FE0F}', ttlMin: 120 },
  object:  { naam: 'Object op de weg', icoon: '\u{1FAA8}', ttlMin: 120 },
  wegwerk: { naam: 'Wegwerkzaamheden', icoon: '\u{1F6A7}', ttlMin: 1440 }
};
const GEEN_FLITS_LANDEN = ['FR', 'DE', 'CH', 'TR', 'MK'];
const DEDUPE_M = 300;         // zelfde soort binnen deze straal = bevestiging
const RADIUS_KM = 15;         // het rondom-beeld
const WEG_STEMMEN = 3;        // zoveel keer "weg" haalt een melding eraf
const MELD_PAUZE_MS = 20000;  // een tik per derde minuut per melder is genoeg
const MAX_MELDINGEN = 4000;   // wereldwijd plafond (oudste eerst weg)

function maakFlits({ db, save, crypto, haversine, ghostSimuleer }) {
  const id = () => 'fl' + crypto.randomBytes(4).toString('hex');
  const nu = () => new Date().toISOString();
  const laatsteMelder = new Map();   // key -> ts (rate-limit, alleen in RAM)

  function lijst() {
    if (!Array.isArray(db.data.flitsMeldingen)) db.data.flitsMeldingen = [];
    return db.data.flitsMeldingen;
  }
  function vers(m) {
    const s = SOORTEN[m.soort]; if (!s) return false;
    const basis = new Date(m.laatstBevestigd || m.at).getTime();
    return Date.now() - basis < s.ttlMin * 60 * 1000 && (m.weg || 0) < WEG_STEMMEN;
  }
  function opschonen() {
    const rij = lijst().filter(vers);
    if (rij.length > MAX_MELDINGEN) rij.splice(0, rij.length - MAX_MELDINGEN);
    db.data.flitsMeldingen = rij;
    return rij;
  }
  const flitsVerbodenIn = land => GEEN_FLITS_LANDEN.includes(String(land || '').toUpperCase());

  /* ---- melden: een tik, met dedupe en rust ---- */
  function meld(key, codenaam, data) {
    const soort = SOORTEN[data.soort] ? data.soort : null;
    if (!soort) return { status: 400, error: 'Onbekende soort melding.' };
    const lat = Number(data.lat), lng = Number(data.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
      return { status: 400, error: 'Geen geldige plek.' };
    if (soort === 'flitser' && flitsVerbodenIn(data.land))
      return { status: 403, error: 'In dit land zijn flitsermeldingen wettelijk niet toegestaan; file- en gevaarmeldingen werken gewoon.' };
    const vorige = laatsteMelder.get(key);
    if (vorige && Date.now() - vorige < MELD_PAUZE_MS)
      return { status: 429, error: 'Rustig aan: uw vorige melding staat er net.' };
    const rij = opschonen();
    // dichtbij dezelfde soort? Dan telt de tik als bevestiging, niet als nieuw.
    const buurman = rij.find(m => m.soort === soort && haversine({ lat, lng }, m) <= DEDUPE_M);
    laatsteMelder.set(key, Date.now());
    if (buurman) {
      buurman.bevestigingen = (buurman.bevestigingen || 0) + 1;
      buurman.laatstBevestigd = nu(); buurman.weg = 0;
      save();
      return { status: 200, ok: true, bevestigd: true, melding: beeld(buurman, { lat, lng }) };
    }
    const m = { id: id(), soort, lat, lng, door: codenaam, bevestigingen: 0, weg: 0, at: nu(), laatstBevestigd: null };
    rij.push(m); save();
    return { status: 200, ok: true, melding: beeld(m, { lat, lng }) };
  }

  /* ---- klopt nog / weg ---- */
  function stem(key, meldingId, klopt) {
    const m = lijst().find(x => x.id === String(meldingId || ''));
    if (!m || !vers(m)) return { status: 404, error: 'Deze melding is er niet meer.' };
    m.stemmers = m.stemmers || [];
    if (m.stemmers.includes(key)) return { status: 200, ok: true, al: true };
    m.stemmers.push(key); if (m.stemmers.length > 50) m.stemmers = m.stemmers.slice(-50);
    if (klopt) { m.bevestigingen = (m.bevestigingen || 0) + 1; m.laatstBevestigd = nu(); m.weg = 0; }
    else m.weg = (m.weg || 0) + 1;
    save();
    return { status: 200, ok: true, weg: (m.weg || 0) >= WEG_STEMMEN };
  }

  /* ---- het rondom-beeld voor het rijscherm ---- */
  function beeld(m, hier) {
    const s = SOORTEN[m.soort];
    return { id: m.id, soort: m.soort, naam: s.naam, icoon: s.icoon, lat: m.lat, lng: m.lng,
      afstandKm: hier ? Math.round(haversine(hier, m) / 100) / 10 : null,   // haversine rekent in meters
      bevestigingen: m.bevestigingen || 0, door: m.door, at: m.at };
  }
  function rond(hier, land) {
    const lat = Number(hier.lat), lng = Number(hier.lng);
    const geldig = Number.isFinite(lat) && Number.isFinite(lng);
    const rij = opschonen()
      .filter(m => !(m.soort === 'flitser' && flitsVerbodenIn(land)))
      .map(m => beeld(m, geldig ? { lat, lng } : null))
      .filter(m => !geldig || m.afstandKm <= RADIUS_KM)
      .sort((a, b) => (a.afstandKm ?? 999) - (b.afstandKm ?? 999));
    return { status: 200, meldingen: rij.slice(0, 60), radiusKm: RADIUS_KM,
      flitsToegestaan: !flitsVerbodenIn(land),
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

  return { flitsMeld: meld, flitsStem: stem, flitsRond: rond, flitsVooruit: vooruit, flitsVerbodenIn };
}

module.exports = { maakFlits };

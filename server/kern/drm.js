/* RTG contentbescherming, serverkant: de DRM-route. RTG bedient het Clear Key-
   sleutelsysteem van Encrypted Media Extensions zelf, zodat versleutelde
   streams kunnen worden afgespeeld zonder een externe DRM-leverancier. Per stuk
   content houdt de server een sleutel (kid + key); een lid met recht op de
   content krijgt een Clear Key-licentie (JWK). Widevine/PlayReady/FairPlay
   worden aan de clientkant herkend als de browser ze heeft.

   Nooit sleutels aan gasten of niet-ingelogde bezoekers; de sleutels staan in
   de datamap (niet in git). Volgt het vaste kern-patroon maakDrm(state). */

function maakDrm({ db, save, crypto }) {
  const nu = () => new Date().toISOString();
  // ruwe bytes -> base64url (het formaat dat EME/JWK verwacht)
  const b64url = buf => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const store = () => (db.data.drmSleutels = db.data.drmSleutels || {});

  // per content een vaste kid + key; op aanvraag aangemaakt en bewaard
  function ensureKey(contentId) {
    const s = store();
    if (!s[contentId]) {
      s[contentId] = { kid: b64url(crypto.randomBytes(16)), key: b64url(crypto.randomBytes(16)), at: nu() };
      save();
    }
    return s[contentId];
  }

  const KEY_SYSTEMS = ['org.w3.clearkey', 'com.widevine.alpha', 'com.microsoft.playready', 'com.apple.fps'];
  function capability() {
    return {
      ok: true, keySystems: KEY_SYSTEMS, aanbevolen: 'org.w3.clearkey',
      uitleg: 'RTG bedient Clear Key zelf; Widevine, PlayReady en FairPlay worden herkend als de browser ze heeft. ' +
        'Zonder versleutelde stream beschermt de zichtbare laag: blur, overlay en watermerk.'
    };
  }

  /* de Clear Key-licentie voor een lid met recht op de content. Antwoord is een
     JWK-set zoals EME die verwacht: { keys:[{kty,k,kid}], type:"temporary" }.
     De kid volgt uit de gevraagde key-ids (het licentieverzoek van de CDM) of,
     als die er niet zijn, uit onze eigen store. */
  function sleutel(sess, data) {
    data = data || {};
    if (!sess || sess.tier === 'guest') return { status: 403, error: 'Beschermde inhoud is alleen voor leden.' };
    const contentId = String(data.contentId || '').trim().slice(0, 120);
    if (!contentId) return { status: 400, error: 'Geen content opgegeven.' };
    const k = ensureKey(contentId);
    const gevraagd = Array.isArray(data.kids) && data.kids.length && typeof data.kids[0] === 'string'
      ? data.kids[0].replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64) : '';
    const kid = gevraagd || k.kid;
    return { keys: [{ kty: 'oct', k: k.key, kid }], type: 'temporary' };
  }

  // lichte telemetrie: welke sleutelsystemen de clients melden (voor de regie)
  function report(sess, data) {
    data = data || {};
    if (!Array.isArray(db.data.drmRapport)) db.data.drmRapport = [];
    db.data.drmRapport.unshift({
      key: (sess && sess.key) || null,
      keySystems: (Array.isArray(data.keySystems) ? data.keySystems : []).slice(0, 8).map(x => String(x).slice(0, 40)),
      eme: !!data.eme, at: nu()
    });
    db.data.drmRapport = db.data.drmRapport.slice(0, 5000);
    save();
    return { ok: true };
  }

  return { drm: { capability, sleutel, report, ensureKey, KEY_SYSTEMS } };
}

module.exports = { maakDrm };

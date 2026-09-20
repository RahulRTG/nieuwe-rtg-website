/* Eigen audiobestanden in RTG Sound.

   De bytes staan versleuteld in de bestaande mediastore, maar NIET onder een
   publieke /media-naam. De speler krijgt een korte, willekeurige luisterkaart;
   daarmee kan een browser byte-ranges opvragen zonder een ledentoken in de URL
   te zetten. De bibliotheek en verwijdering blijven altijd op de ledensleutel. */
'use strict';

const MAX_BYTES = 60 * 1024 * 1024;
const MAX_PER_LID = 200;
const TICKET_MS = 15 * 60 * 1000;

module.exports = ({ db, save, crypto, schoon, media, codenaamVan }) => {
  const tickets = new Map();
  const uploads = new Map();
  const nu = () => new Date().toISOString();
  const lijst = () => {
    if (!Array.isArray(db.data.muziekBestanden)) db.data.muziekBestanden = [];
    return db.data.muziekBestanden;
  };
  const met = (id) => lijst().find(x => x.id === String(id || '')) || null;
  const vanMij = (key, id) => {
    const item = met(id);
    return item && item.key === key ? item : null;
  };
  const publiek = (item, kijker) => ({ id: item.id, naam: item.naam,
    beschrijving: item.beschrijving || '', maker: codenaamVan ? codenaamVan(item.key) : 'Een maker',
    mime: item.mime, bytes: item.bytes, duurS: item.duurS || 0, at: item.at,
    mooi: (item.mooiDoor || []).length, mooiVanMij: (item.mooiDoor || []).includes(kijker),
    vanMij: item.key === kijker });

  function veiligeNaam(naam) {
    let uit = String(naam || '').replace(/\\/g, '/').split('/').pop().replace(/[\0\r\n]/g, '').trim();
    uit = schoon ? schoon(uit, 160) : uit.slice(0, 160);
    return uit || 'Muziek';
  }
  function titelVan(bestandsnaam) {
    const zonder = bestandsnaam.replace(/\.(mp3|m4a|aac|wav|ogg|oga|flac|webm)$/i, '').trim();
    return (schoon ? schoon(zonder, 100) : zonder.slice(0, 100)) || 'Naamloos nummer';
  }
  function ruimTickets() {
    const tijd = Date.now();
    for (const [token, t] of tickets) if (t.tot <= tijd || !met(t.id)) tickets.delete(token);
  }

  async function bewaarUpload(key, bytes, opgegevenMime, naam, duurS, titel, beschrijving, eigenWerk, idem) {
    if (!Buffer.isBuffer(bytes) || !bytes.length)
      return { status: 400, error: 'Kies eerst een muziekbestand.' };
    if (eigenWerk !== true) return { status: 400,
      error: 'Bevestig eerst dat dit uw eigen muziek is en dat u haar mag delen.' };
    if (!media || !media.soortVanBuffer || !media.bewaarBestandPrive)
      return { status: 503, error: 'De muziekopslag is niet beschikbaar.' };
    const soort = media.soortVanBuffer(bytes, opgegevenMime);
    if (!soort || soort.kind !== 'audio') return { status: 400,
      error: 'Gebruik mp3, m4a, wav, aac, ogg, flac of een audio-webm.' };
    if (bytes.length > MAX_BYTES) return { status: 413, error: 'Dit muziekbestand is groter dan 60 MB.' };
    if (lijst().filter(x => x.key === key).length >= MAX_PER_LID) return { status: 409,
      error: 'Uw muziekbibliotheek heeft 200 nummers. Haal er eerst één weg.' };

    const opgeslagen = await media.bewaarBestandPrive(bytes, soort.mime, MAX_BYTES);
    if (!opgeslagen || opgeslagen.type !== 'audio')
      return { status: 400, error: 'Dit muziekbestand kon niet veilig worden bewaard.' };
    const bestandsnaam = veiligeNaam(naam);
    const item = { id: 'mb' + crypto.randomBytes(8).toString('hex'), key, idem,
      naam: (schoon ? schoon(titel, 100) : String(titel || '').slice(0, 100)) || titelVan(bestandsnaam),
      beschrijving: schoon ? schoon(beschrijving, 500) : String(beschrijving || '').slice(0, 500),
      bestandsnaam, ref: opgeslagen.ref, openbaar: true, mooiDoor: [],
      mime: opgeslagen.mime, bytes: opgeslagen.bytes,
      duurS: Math.max(0, Math.min(24 * 3600, Number(duurS) || 0)), at: nu() };
    lijst().unshift(item);
    try { save(); } catch (e) { media.verwijder(item.ref); throw e; }
    return { status: 200, ok: true, nummer: publiek(item, key) };
  }

  async function upload(key, bytes, opgegevenMime, naam, duurS, titel, beschrijving, eigenWerk, idem) {
    const sleutel = String(idem || '').trim().slice(0, 200);
    if (sleutel.length < 16) return { status: 400,
      error: 'De publicatiesleutel ontbreekt. Probeer het publiceren opnieuw.' };
    const bestaand = lijst().find(x => x.key === key && x.idem === sleutel);
    if (bestaand) return { status: 200, ok: true, herhaald: true, nummer: publiek(bestaand, key) };
    const wachtOp = String(key) + '\0' + sleutel;
    if (uploads.has(wachtOp)) return uploads.get(wachtOp);
    const taak = bewaarUpload(key, bytes, opgegevenMime, naam, duurS, titel,
      beschrijving, eigenWerk, sleutel).finally(() => uploads.delete(wachtOp));
    uploads.set(wachtOp, taak);
    return taak;
  }

  function mijn(key) {
    return { status: 200, nummers: lijst().filter(x => x.key === key).map(x => publiek(x, key)),
      maxBytes: MAX_BYTES, maxNummers: MAX_PER_LID };
  }

  function feed(key) {
    return { status: 200, nummers: lijst().filter(x => x.openbaar === true)
      .slice().sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 100)
      .map(x => publiek(x, key)) };
  }

  function ticket(key, id) {
    ruimTickets();
    const item = met(id);
    if (item && item.key !== key && item.openbaar !== true)
      return { status: 404, error: 'Dit nummer staat niet in de muziekfeed.' };
    if (!item) return { status: 404, error: 'Dit nummer staat niet in uw muziekbibliotheek.' };
    const token = crypto.randomBytes(24).toString('hex');
    tickets.set(token, { id: item.id, tot: Date.now() + TICKET_MS });
    return { status: 200, ok: true, src: '/api/muziek/luister/' + token,
      verloopt: new Date(Date.now() + TICKET_MS).toISOString(), nummer: publiek(item, key) };
  }

  function mooi(key, id, aan) {
    const item = met(id);
    if (!item || item.openbaar !== true) return { status: 404, error: 'Dit nummer staat niet in de muziekfeed.' };
    if (typeof aan !== 'boolean') return { status: 400, error: 'Geef aan of u dit nummer mooi vindt.' };
    item.mooiDoor = Array.isArray(item.mooiDoor) ? item.mooiDoor : [];
    const i = item.mooiDoor.indexOf(key);
    if (aan && i < 0) { item.mooiDoor.push(key); save(); }
    if (!aan && i >= 0) { item.mooiDoor.splice(i, 1); save(); }
    return { status: 200, ok: true, mooi: item.mooiDoor.length, mooiVanMij: aan };
  }

  async function luister(token) {
    ruimTickets();
    const toegang = tickets.get(String(token || ''));
    if (!toegang || toegang.tot <= Date.now()) return null;
    const item = met(toegang.id);
    if (!item) return null;
    const bytes = await media.leesBuf(item.ref);
    return bytes ? { bytes, mime: item.mime, naam: item.bestandsnaam } : null;
  }

  function weg(key, id) {
    const item = vanMij(key, id);
    if (!item) return { status: 404, error: 'Dit nummer staat niet in uw muziekbibliotheek.' };
    db.data.muziekBestanden = lijst().filter(x => x.id !== item.id);
    for (const [token, t] of tickets) if (t.id === item.id) tickets.delete(token);
    media.verwijder(item.ref);
    save();
    return { status: 200, ok: true };
  }

  return { muziekBestandUpload: upload, muziekBestandenMijn: mijn, muziekBestandenFeed: feed,
    muziekBestandTicket: ticket, muziekBestandLuister: luister,
    muziekBestandMooi: mooi, muziekBestandWeg: weg };
};

module.exports.MAX_BYTES = MAX_BYTES;

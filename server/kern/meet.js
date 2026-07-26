/* RTG Meet: vergaderkamers op codenaam. De kamer leeft op de server (wie
   mag erin, wie is er), maar beeld en geluid lopen peer-to-peer (WebRTC-
   mesh, zelfde aanpak als de teamcall): de server geeft alleen seinen door
   via de bestaande SSE-lijn van het lid (event 'meet'). Echte namen komen
   in het hele verkeer niet voor.

   Een kamer hoort optioneel bij een agenda-afspraak: dezelfde afspraak
   geeft altijd dezelfde kamer (idempotent), en wie op de afspraak staat
   mag erin -- de uitnodiging IS de sleutel. */

const TEKENS = 'BCDFGHJKMNPQRSTVWXZ23456789'; // geen verwarbare tekens in een kamercode
const MAX_KAMERS = 20;      // per gastheer
const MAX_AANWEZIG = 12;    // mesh: ieder toestel verbindt met iedereen
const MAX_SEIN = 30000;     // een WebRTC-sein (offer/answer/ice) is nooit groter
const OUD_MS = 7 * 864e5;   // een kamer die een week stil is, ruimen we op
const SEINEN = ['offer', 'answer', 'ice', 'scherm', 'hand', 'stil'];

function maakMeet({ db, save, crypto, schoon, keyVanCodenaam, codenaamVan, sseToCustomer }) {
  const nu = () => new Date().toISOString();

  function kamers() {
    if (!db.data.meetKamers || !Array.isArray(db.data.meetKamers)) db.data.meetKamers = [];
    return db.data.meetKamers;
  }
  function veeg() {
    const grens = Date.now() - OUD_MS;
    const voor = kamers().length;
    db.data.meetKamers = kamers().filter(k => Date.parse(k.laatst || k.op) > grens);
    if (db.data.meetKamers.length !== voor) save();
  }
  function code() {
    let c = '';
    for (let i = 0; i < 6; i++) c += TEKENS[crypto.randomInt(TEKENS.length)];
    return kamers().some(k => k.code === c) ? code() : c;
  }
  const magErin = (k, key) => {
    if (k.host === key) return true;
    if (!(k.wieMag || []).length) return true;              // open kamer: de code is de sleutel
    const naam = codenaamVan(key);
    return !!(naam && k.wieMag.includes(naam));
  };
  function toon(k, key) {
    return { id: k.id, code: k.code, titel: k.titel, agendaId: k.agendaId || null,
      vanMij: k.host === key, besloten: (k.wieMag || []).length > 0,
      aanwezig: (k.aanwezig || []).map(a => a.codenaam), laatst: k.laatst };
  }
  // iedereen in de kamer een sein sturen, behalve de afzender zelf
  function meld(k, vanKey, data) {
    for (const a of k.aanwezig || []) {
      if (a.key === vanKey) continue;
      try { sseToCustomer(a.key, 'meet', data); } catch (e) {}
    }
  }

  /* ---- een kamer maken; met agendaId is dit idempotent ---- */
  function meetMaak(key, { titel, agendaId, codenamen }) {
    veeg();
    agendaId = String(agendaId || '') || null;
    if (agendaId) {
      const al = kamers().find(k => k.agendaId === agendaId);
      if (al) return magErin(al, key) ? { id: al.id, code: al.code, bestond: true }
        : { status: 403, error: 'Deze vergaderruimte hoort bij een afspraak waar u niet op staat.' };
    }
    if (kamers().filter(k => k.host === key).length >= MAX_KAMERS) {
      return { status: 409, error: 'U heeft al ' + MAX_KAMERS + ' kamers; ruim er eerst een op.' };
    }
    let wieMag = [];
    if (agendaId) {
      // de uitnodiging is de sleutel: organisator + iedereen op de afspraak
      let gevonden = null, eigenaarKey = null;
      for (const ok of Object.keys(db.data.agendas || {})) {
        const i = (db.data.agendas[ok] || []).find(x => x.id === agendaId && !x.vanKey);
        if (i) { gevonden = i; eigenaarKey = ok.replace(/^lid:/, ''); break; }
      }
      if (!gevonden) return { status: 404, error: 'Die afspraak staat niet (meer) in de agenda.' };
      const namen = [codenaamVan(eigenaarKey)];
      for (const d of gevonden.deelnemers || []) namen.push(codenaamVan(String(d.key).replace(/^lid:/, '')));
      wieMag = namen.filter(Boolean);
      const mijn = codenaamVan(key);
      if (!mijn || !wieMag.includes(mijn)) return { status: 403, error: 'U staat niet op deze afspraak.' };
      titel = titel || gevonden.titel;
    } else {
      wieMag = (Array.isArray(codenamen) ? codenamen : []).map(c => String(c).trim()).filter(Boolean).slice(0, 50);
      if (wieMag.length) { const mijn = codenaamVan(key); if (mijn && !wieMag.includes(mijn)) wieMag.push(mijn); }
    }
    const k = { id: 'mk' + crypto.randomBytes(6).toString('hex'), code: code(),
      titel: schoon(String(titel || 'Vergadering'), 80), host: key, wieMag,
      agendaId, aanwezig: [], op: nu(), laatst: nu() };
    kamers().push(k); save();
    return { id: k.id, code: k.code };
  }

  function meetMijn(key) {
    veeg();
    const naam = codenaamVan(key);
    const mijn = kamers().filter(k => k.host === key || (naam && (k.wieMag || []).includes(naam)))
      .sort((a, b) => String(b.laatst).localeCompare(String(a.laatst)));
    return { kamers: mijn.map(k => toon(k, key)) };
  }

  /* ---- binnenkomen op kamercode ---- */
  function meetKom(key, kamercode) {
    const k = kamers().find(x => x.code === String(kamercode || '').trim().toUpperCase());
    if (!k) return { status: 404, error: 'Die kamercode bestaat niet (meer).' };
    if (!magErin(k, key)) return { status: 403, error: 'Deze kamer is besloten; u staat niet op de lijst.' };
    const naam = codenaamVan(key);
    if (!naam) return { status: 403, error: 'Alleen leden met een codenaam vergaderen mee.' };
    k.aanwezig = (k.aanwezig || []).filter(a => a.key !== key);
    if (k.aanwezig.length >= MAX_AANWEZIG) return { status: 409, error: 'De kamer zit vol (' + MAX_AANWEZIG + ').' };
    k.aanwezig.push({ key, codenaam: naam, sinds: nu() });
    k.laatst = nu(); save();
    meld(k, key, { kind: 'kom', kamer: k.id, van: naam });
    return { kamer: toon(k, key), ik: naam };
  }
  function meetVerlaat(key, id) {
    const k = kamers().find(x => x.id === String(id || ''));
    if (!k) return { ok: true };
    const ik = (k.aanwezig || []).find(a => a.key === key);
    k.aanwezig = (k.aanwezig || []).filter(a => a.key !== key);
    k.laatst = nu(); save();
    if (ik) meld(k, key, { kind: 'weg', kamer: k.id, van: ik.codenaam });
    return { ok: true };
  }
  function meetWeg(key, id) {
    const k = kamers().find(x => x.id === String(id || ''));
    if (!k) return { status: 404, error: 'Die kamer bestaat niet.' };
    if (k.host !== key) return { status: 403, error: 'Alleen de gastheer ruimt de kamer op.' };
    meld(k, key, { kind: 'dicht', kamer: k.id });
    db.data.meetKamers = kamers().filter(x => x.id !== k.id); save();
    return { ok: true };
  }

  /* ---- het doorgeefluik: WebRTC-seinen van deelnemer naar deelnemer ---- */
  function meetSein(key, { id, naar, kind, payload }) {
    const k = kamers().find(x => x.id === String(id || ''));
    if (!k) return { status: 404, error: 'Die kamer bestaat niet (meer).' };
    const ik = (k.aanwezig || []).find(a => a.key === key);
    if (!ik) return { status: 403, error: 'U bent niet (meer) in deze kamer.' };
    if (!SEINEN.includes(String(kind || ''))) return { status: 400, error: 'Dat sein kent de kamer niet.' };
    let tekst;
    try { tekst = JSON.stringify(payload == null ? {} : payload); } catch (e) { return { status: 400, error: 'Het sein moet JSON zijn.' }; }
    if (tekst.length > MAX_SEIN) return { status: 413, error: 'Het sein is te groot.' };
    const doel = (k.aanwezig || []).find(a => a.codenaam === String(naar || ''));
    if (!doel) return { status: 404, error: 'Die deelnemer is niet (meer) in de kamer.' };
    k.laatst = nu();
    try { sseToCustomer(doel.key, 'meet', { kind, kamer: k.id, van: ik.codenaam, payload }); } catch (e) {}
    return { ok: true };
  }

  return { meetMaak, meetMijn, meetKom, meetVerlaat, meetWeg, meetSein };
}

module.exports = { maakMeet };

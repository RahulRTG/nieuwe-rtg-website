/* RTG Meet: kamers op codenaam, met beeld en geluid peer-to-peer.

   De deelcode en de kamer-id zijn strikt gescheiden. Alleen de 128-bit code
   mag een nieuw lid binnenlaten; host, genodigde of aanwezige keert daarna met
   de niet-geheime kamer-id terug. Uitgifte, join, rotatie en sluiting lopen in
   één autoritatieve meetKamers-collectietransactie. SSE-seinen vertrekken pas
   nadat die transactie is gecommit. */
'use strict';

const MAX_KAMERS = 20;
const MAX_AANWEZIG = 12;
const MAX_SEIN = 30000;
const OUD_MS = 7 * 864e5;
const DUBBELTIK_MS = 5000;
const SEINEN = ['offer', 'answer', 'ice', 'scherm', 'hand', 'stil', 'tekst'];

function maakMeet({ db, save, bewerkCollectie, crypto, schoon, codenaamVan, sseToCustomer }) {
  const nu = () => new Date().toISOString();
  const toegang = require('./meet-toegang')({ crypto, nu });
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');

  const bron = () => {
    if (!Array.isArray(db.data.meetKamers)) db.data.meetKamers = [];
    return db.data.meetKamers;
  };
  const herstel = (doel, json) => {
    const oud = JSON.parse(json); doel.splice(0, doel.length, ...oud);
  };
  function transactie(werk) {
    const doe = kamers => {
      if (!Array.isArray(kamers)) throw new Error('meetKamers hoort een lijst te zijn');
      toegang.migreerLegacy(kamers);
      const grens = Date.now() - OUD_MS;
      for (let i = kamers.length - 1; i >= 0; i--)
        if (Date.parse(kamers[i].laatst || kamers[i].op) <= grens) kamers.splice(i, 1);
      return werk(kamers);
    };
    /* De generieke collectie-opslag neemt bij een nog onbekende collectie een
       kaart als standaard. Meet bezit bewust een lijst; zet die vorm vóór het
       eerste DB-slot expliciet neer zodat een verse installatie fail-safe niet
       als het verkeerde type begint. */
    bron();
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('meetKamers', doe);
    const kamers = bron(), voor = JSON.stringify(kamers);
    try {
      const antwoord = doe(kamers);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('meetKamers-transactie mag niet asynchroon zijn');
      if (JSON.stringify(kamers) !== voor) save();
      return antwoord;
    } catch (e) { herstel(kamers, voor); throw e; }
  }

  const lidVan = (k, key) => (k.aanwezig || []).find(a => a.key === key) || null;
  const naamMag = (k, key) => {
    const naam = codenaamVan(key);
    return !!(naam && (k.wieMag || []).includes(naam));
  };
  const magErin = (k, key) => k.host === key || !(k.wieMag || []).length || naamMag(k, key);
  const magMetId = (k, key) => k.host === key || !!lidVan(k, key) || naamMag(k, key);
  const toon = (k, key) => ({
    id: k.id, titel: k.titel, agendaId: k.agendaId || null,
    vanMij: k.host === key, besloten: (k.wieMag || []).length > 0,
    aanwezig: (k.aanwezig || []).map(a => a.codenaam), laatst: k.laatst,
    toegang: toegang.publiek(k)
  });
  const stuurNaar = (lijst, vanKey, data) => {
    for (const a of (lijst || [])) if (a.key !== vanKey) {
      try { sseToCustomer(a.key, 'meet', data); } catch (e) {}
    }
  };
  const naCommit = uit => {
    const voltooi = r => {
      if (r && r.sein) stuurNaar(r.sein.aanwezig, r.sein.vanKey, r.sein.data);
      return r && r.antwoord ? r.antwoord : r;
    };
    return uit && typeof uit.then === 'function' ? uit.then(voltooi) : voltooi(uit);
  };

  const { meetMaak } = require('./meet-uitgifte')({ db, crypto, schoon, codenaamVan,
    transactie, toegang, toon, magErin, afdruk, nu, maxKamers: MAX_KAMERS,
    dubbeltikMs: DUBBELTIK_MS });

  function meetMijn(key) {
    return transactie(kamers => ({ kamers: kamers
      .filter(k => !k.gesloten_at && (k.host === key || naamMag(k, key)))
      .sort((a, b) => String(b.laatst).localeCompare(String(a.laatst)))
      .map(k => toon(k, key)) }));
  }

  function meetKom(key, data) {
    const d = typeof data === 'object' && data ? data : { code: data };
    return naCommit(transactie(kamers => {
      const viaCode = !!String(d.code || '').trim();
      const k = viaCode ? toegang.zoek(kamers, d.code)
        : kamers.find(x => x.id === String(d.id || '') && !x.gesloten_at);
      if (!k || (!viaCode && !magMetId(k, key)) || (viaCode && toegang.reden(k)))
        return { status: 404, error: 'Die Meet-kamer bestaat niet (meer).' };
      if (!magErin(k, key)) return { status: 403, error: 'Deze kamer is besloten; u staat niet op de lijst.' };
      const naam = codenaamVan(key);
      if (!naam) return { status: 403, error: 'Alleen leden met een codenaam vergaderen mee.' };
      if (lidVan(k, key)) return { kamer: toon(k, key), ik: naam, al: true };
      if ((k.aanwezig || []).length >= MAX_AANWEZIG)
        return { status: 409, error: 'De kamer zit vol (' + MAX_AANWEZIG + ').' };
      k.aanwezig.push({ key, codenaam: naam, sinds: nu() });
      if (viaCode) toegang.gebruik(k);
      k.laatst = nu();
      return { antwoord: { kamer: toon(k, key), ik: naam },
        sein: { aanwezig: k.aanwezig, vanKey: key,
          data: { kind: 'kom', kamer: k.id, van: naam } } };
    }));
  }

  function meetCode(key, id, idem) {
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    return transactie(kamers => {
      const k = kamers.find(x => x.id === String(id || '') && !x.gesloten_at);
      if (!k || k.host !== key) return { status: 404, error: 'Die Meet-kamer bestaat niet.' };
      const vinger = afdruk(JSON.stringify({ id: k.id, key }));
      const idemHash = idemWaarde ? afdruk('meet-code-idem|' + key + '|' + idemWaarde) : null;
      const tikHash = afdruk('meet-code-dubbeltik|' + key + '|' + vinger);
      const al = k.laatste_rotatie;
      if (al && ((idemHash && al.idem_hash === idemHash) || (!idemHash &&
          al.dubbeltik_hash === tikHash && Date.now() - Date.parse(al.at) >= 0 &&
          Date.now() - Date.parse(al.at) < DUBBELTIK_MS)))
        return { status: 409, error: 'Deze nieuwe Meet-code is al eenmalig getoond en wordt niet herhaald.',
          herhaald: true, kamer: toon(k, key) };
      const gemaakt = toegang.roteer(kamers, k, codenaamVan(key) || key);
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke Meet-code maken.' };
      k.laatste_rotatie = { idem_hash: idemHash, dubbeltik_hash: idemHash ? null : tikHash,
        fingerprint_hash: vinger, at: nu() };
      return { ok: true, id: k.id, code: gemaakt.code, eenmalig: true,
        kamer: toon(k, key) };
    });
  }

  function meetVerlaat(key, id) {
    return naCommit(transactie(kamers => {
      const k = kamers.find(x => x.id === String(id || '') && !x.gesloten_at);
      if (!k) return { ok: true };
      const ik = lidVan(k, key);
      if (!ik) return { ok: true };
      k.aanwezig = k.aanwezig.filter(a => a.key !== key); k.laatst = nu();
      return { antwoord: { ok: true }, sein: { aanwezig: k.aanwezig, vanKey: key,
        data: { kind: 'weg', kamer: k.id, van: ik.codenaam } } };
    }));
  }

  function meetWeg(key, id) {
    return naCommit(transactie(kamers => {
      const k = kamers.find(x => x.id === String(id || '') && !x.gesloten_at);
      if (!k) return { status: 404, error: 'Die Meet-kamer bestaat niet.' };
      if (k.host !== key) return { status: 403, error: 'Alleen de gastheer ruimt de kamer op.' };
      const aanwezig = [...(k.aanwezig || [])];
      toegang.intrekken(k, codenaamVan(key) || key, 'Meet-kamer gesloten');
      k.gesloten_at = nu(); k.aanwezig = []; k.laatst = nu();
      return { antwoord: { ok: true }, sein: { aanwezig, vanKey: key,
        data: { kind: 'dicht', kamer: k.id } } };
    }));
  }

  function meetSein(key, data) {
    const d = data || {};
    return naCommit(transactie(kamers => {
      const k = kamers.find(x => x.id === String(d.id || '') && !x.gesloten_at);
      if (!k) return { status: 404, error: 'Die kamer bestaat niet (meer).' };
      const ik = lidVan(k, key);
      if (!ik) return { status: 403, error: 'U bent niet (meer) in deze kamer.' };
      if (!SEINEN.includes(String(d.kind || ''))) return { status: 400, error: 'Dat sein kent de kamer niet.' };
      let tekst;
      try { tekst = JSON.stringify(d.payload == null ? {} : d.payload); }
      catch (e) { return { status: 400, error: 'Het sein moet JSON zijn.' }; }
      if (tekst.length > MAX_SEIN) return { status: 413, error: 'Het sein is te groot.' };
      const doel = (k.aanwezig || []).find(a => a.codenaam === String(d.naar || ''));
      if (!doel) return { status: 404, error: 'Die deelnemer is niet (meer) in de kamer.' };
      k.laatst = nu();
      return { antwoord: { ok: true }, sein: { aanwezig: [doel], vanKey: null,
        data: { kind: d.kind, kamer: k.id, van: ik.codenaam, payload: d.payload } } };
    }));
  }

  return { meetMaak, meetMijn, meetKom, meetCode, meetVerlaat, meetWeg, meetSein };
}

module.exports = { maakMeet };

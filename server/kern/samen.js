/* LivingOS Samen: een deelcode opent alleen de eerste toetreding. Daarna werkt
   ieder lid met de niet-geheime kamer-id. Kale codes staan niet in opslag,
   lijsten, SSE, URL's of browseropslag en worden alleen bij maak/rotatie getoond. */
'use strict';
const { veiligSamenPad } = require('./samen-pad');

module.exports = ({ db, save, bewerkCollectie, crypto, sseToCustomer, schoon }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/samen',
    bezit: { samenKamers: 'kaart' } });
  const nu = () => new Date().toISOString();
  const toegang = require('./samen-toegang')({ crypto, nu });
  const MAX_KAMERS = 20;
  const DUBBELTIK_MS = 5000;
  const BEWAAR_MS = 90 * 86400000;

  const bak = () => eigen.bak('samenKamers');
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const lidVan = (k, key) => (k.leden || []).find(l => l.key === key) || null;
  const publiek = (k, key) => ({ id: k.id, gastheer: k.gastheer,
    leden: (k.leden || []).map(l => l.codenaam), pad: k.pad, titel: k.titel,
    chat: (k.chat || []).slice(-30), at: k.at, muziek: k.muziek || null,
    toegang: toegang.publiek(k), benGastheer: key ? k.gastheerKey === key : undefined,
    now: Date.now() });
  const antwoord = (waarde, seinen = []) => ({ antwoord: waarde, seinen });
  const seinen = (k, kind, data, behalveKey) => (k.leden || [])
    .filter(l => l.key !== behalveKey)
    .map(l => ({ key: l.key, kind, data: Object.assign({ kind, id: k.id }, data) }));

  function sluitOud(kamers) {
    const tijd = Date.now();
    for (const [id, k] of Object.entries(kamers)) {
      if (!k) { delete kamers[id]; continue; }
      /* Oude versies bewaarden location.search. Wis dat vóór enig kamerbeeld
         of SSE-seintje; reset- en verificatiecredentials mogen niet reizen. */
      if (k.pad && !veiligSamenPad(k.pad)) { k.pad = null; k.titel = null; }
      const reden = !k.gesloten_at && toegang.reden(k);
      if (reden && reden !== 'ingetrokken' && reden !== 'opgebruikt') {
        k.gesloten_at = nu();
        toegang.intrekken(k, 'systeem', 'verlopen');
      }
      if (k.gesloten_at && tijd - Date.parse(k.gesloten_at) > BEWAAR_MS) delete kamers[id];
    }
  }

  function transactie(werk) {
    const doe = kamers => {
      if (!kamers || typeof kamers !== 'object' || Array.isArray(kamers))
        throw new Error('samenKamers hoort een kaart te zijn');
      toegang.migreerLegacy(kamers);
      sluitOud(kamers);
      return werk(kamers);
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('samenKamers', doe);
    const kamers = bak(), voor = JSON.stringify(kamers);
    try {
      const r = doe(kamers);
      if (r && typeof r.then === 'function')
        throw new Error('samenKamers-transactie mag niet asynchroon zijn');
      if (JSON.stringify(kamers) !== voor) save();
      return r;
    } catch (e) {
      const oud = JSON.parse(voor);
      for (const id of Object.keys(kamers)) delete kamers[id];
      Object.assign(kamers, oud);
      throw e;
    }
  }

  function naCommit(r) {
    for (const e of (r && r.seinen) || []) {
      try { sseToCustomer(e.key, 'samen', e.data); } catch (fout) {}
    }
    return r && r.antwoord;
  }
  function handel(werk) {
    const r = transactie(werk);
    return r && typeof r.then === 'function' ? r.then(naCommit) : naCommit(r);
  }
  const kamer = (kamers, id) => kamers[String(id || '')] || null;
  const actiefVoor = (kamers, id, key) => {
    const k = kamer(kamers, id);
    return k && !k.gesloten_at && lidVan(k, key) ? k : null;
  };

  function maak(key, codenaam, idem) {
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    return handel(kamers => {
      if (Object.values(kamers).filter(k => k && !k.gesloten_at && k.gastheerKey === key).length >= MAX_KAMERS)
        return antwoord({ status: 409, error: 'Ruim eerst een oude Samen-kamer op.' });
      const vinger = afdruk('samen-maak|' + key);
      const idemHash = idemWaarde ? afdruk('samen-maak-idem|' + key + '|' + idemWaarde) : null;
      const tikHash = afdruk('samen-maak-dubbeltik|' + key + '|' + vinger);
      const bestaand = Object.values(kamers).find(k => k && k.uitgifte && (
        (idemHash && k.uitgifte.idem_hash === idemHash) ||
        (!idemHash && k.uitgifte.dubbeltik_hash === tikHash &&
          Date.now() - Date.parse(k.uitgifte.at) >= 0 &&
          Date.now() - Date.parse(k.uitgifte.at) < DUBBELTIK_MS)));
      if (bestaand) return antwoord({ status: 409, herhaald: true,
        error: 'Deze Samen-code is al eenmalig getoond. Vernieuw haar vanuit de kamer.',
        kamer: publiek(bestaand, key) });
      const id = 'sk' + crypto.randomBytes(16).toString('hex');
      const k = { id, gastheer: codenaam, gastheerKey: key,
        leden: [{ key, codenaam }], pad: null, titel: null, chat: [], muziek: null,
        at: Date.now(), gesloten_at: null, toegang_historie: [], uitgifte: {
          idem_hash: idemHash, dubbeltik_hash: idemHash ? null : tikHash,
          fingerprint_hash: vinger, at: nu()
        } };
      const gemaakt = toegang.nieuw(kamers, k, codenaam || key);
      if (!gemaakt) return antwoord({ status: 500, error: 'Kon geen unieke Samen-code maken.' });
      k.toegang = gemaakt.toegang;
      kamers[id] = k;
      return antwoord({ status: 200, ok: true, code: gemaakt.code,
        eenmalig: true, kamer: publiek(k, key) });
    });
  }

  function doeMee(key, codenaam, code) {
    const kale = String(code || '').trim().toUpperCase().slice(0, 100);
    return handel(kamers => {
      const k = toegang.zoek(kamers, kale);
      if (!k || toegang.reden(k))
        return antwoord({ status: 404, error: 'Deze Samen-code bestaat niet (meer).' });
      if (lidVan(k, key))
        return antwoord({ status: 200, ok: true, al: true, kamer: publiek(k, key) });
      if ((k.leden || []).length >= 12)
        return antwoord({ status: 409, error: 'Deze kamer zit vol (12 personen).' });
      k.leden.push({ key, codenaam });
      k.at = Date.now();
      toegang.gebruik(k);
      return antwoord({ status: 200, ok: true, kamer: publiek(k, key) },
        seinen(k, 'erbij', { codenaam }, key));
    });
  }

  function roteer(key, id, idem) {
    const idemWaarde = String(idem || '').trim().slice(0, 200);
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      if (!k) return antwoord({ status: 404, error: 'Deze kamer bestaat niet (meer).' });
      if (k.gastheerKey !== key)
        return antwoord({ status: 403, error: 'Alleen de gastheer vernieuwt de deelcode.' });
      const idemHash = idemWaarde ? afdruk('samen-roteer-idem|' + key + '|' + idemWaarde) : null;
      const tikHash = afdruk('samen-roteer-dubbeltik|' + key + '|' + k.id);
      const laatst = k.laatste_rotatie;
      if (laatst && ((idemHash && laatst.idem_hash === idemHash) ||
          (!idemHash && laatst.dubbeltik_hash === tikHash &&
            Date.now() - Date.parse(laatst.at) >= 0 &&
            Date.now() - Date.parse(laatst.at) < DUBBELTIK_MS)))
        return antwoord({ status: 409, herhaald: true,
          error: 'De nieuwe Samen-code is al eenmalig getoond en wordt niet herhaald.',
          kamer: publiek(k, key) });
      const gemaakt = toegang.roteer(kamers, k, codenaamVan(k, key));
      if (!gemaakt) return antwoord({ status: 500, error: 'Kon geen unieke Samen-code maken.' });
      k.laatste_rotatie = { idem_hash: idemHash,
        dubbeltik_hash: idemHash ? null : tikHash, at: nu() };
      k.at = Date.now();
      return antwoord({ status: 200, ok: true, code: gemaakt.code,
        eenmalig: true, kamer: publiek(k, key) });
    });
  }
  const codenaamVan = (k, key) => (lidVan(k, key) || {}).codenaam || key;

  function weg(key, id) {
    return handel(kamers => {
      const k = kamer(kamers, id);
      if (!k || k.gesloten_at) return antwoord({ status: 200, ok: true });
      const lid = lidVan(k, key);
      if (!lid) return antwoord({ status: 200, ok: true });
      k.leden = k.leden.filter(l => l.key !== key);
      if (!k.leden.length) {
        k.gesloten_at = nu();
        toegang.intrekken(k, lid.codenaam, 'laatste lid vertrok');
        return antwoord({ status: 200, ok: true });
      }
      if (k.gastheerKey === key) {
        k.gastheerKey = k.leden[0].key;
        k.gastheer = k.leden[0].codenaam;
        toegang.intrekken(k, lid.codenaam, 'gastheer droeg kamer over');
      }
      k.at = Date.now();
      return antwoord({ status: 200, ok: true },
        seinen(k, 'weg', { codenaam: lid.codenaam }));
    });
  }

  function sluit(key, id) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      if (!k) return antwoord({ status: 404, error: 'Deze kamer bestaat niet (meer).' });
      if (k.gastheerKey !== key)
        return antwoord({ status: 403, error: 'Alleen de gastheer sluit de kamer.' });
      k.gesloten_at = nu();
      toegang.intrekken(k, codenaamVan(k, key), 'kamer gesloten');
      return antwoord({ status: 200, ok: true }, seinen(k, 'gesloten', {}, key));
    });
  }

  function staat(key, id) {
    return handel(kamers => {
      const k = actiefVoor(kamers, id, key);
      return antwoord(k
        ? { status: 200, ok: true, kamer: publiek(k, key) }
        : { status: 404, error: 'Deze kamer bestaat niet (meer).' });
    });
  }

  const ruimOp = () => handel(() => antwoord({ ok: true }));
  const activiteiten = require('./samen-activiteiten')({ schoon, lidVan, publiek,
    antwoord, seinen, actiefVoor, handel });
  return { samen: Object.assign({ maak, doeMee, roteer, weg, sluit, staat, ruimOp },
    activiteiten) };
};

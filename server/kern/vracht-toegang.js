/* Publieke vrachttracking zonder blijvende kale code.

   De deelcode wordt alleen bij uitgifte of rotatie teruggegeven. In de
   vrachtcollectie staat uitsluitend een namespaced hash met issuer, doel,
   scope, verval, gebruikslimiet en intrekspoor. Alle claims en rotaties lopen
   onder hetzelfde collectieslot, ook met meerdere PostgreSQL-processen. */
'use strict';

const { canoniek } = require('../lib/dubbeltik');

const DOEL = 'publieke-vrachtstatus';
const SCOPE = ['vracht.status.lezen'];
const GELDIG_MS = 366 * 86400000;
const MAX_GEBRUIK = 10000;

module.exports = ({ bak, save, bewerkCollectie, crypto, nu }) => {
  const bearer = require('./bearercode')({ crypto, namespace: 'vracht-volgen', nu });
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');
  const rijen = kaart => Object.values(kaart || {}).flatMap(lijst => Array.isArray(lijst) ? lijst : []);

  function migreerLegacy(kaart) {
    let aantal = 0;
    for (const z of rijen(kaart)) {
      if (!z || !Object.prototype.hasOwnProperty.call(z, 'volgcode')) continue;
      const oud = String(z.volgcode || '').trim();
      if (!z.volg_toegang && oud) {
        const begin = Number.isFinite(Date.parse(z.gemaakt)) ? z.gemaakt : nu();
        z.volg_toegang = {
          code_hash: bearer.hash(oud), issuer: 'legacy-migratie', doel: DOEL,
          scope: [...SCOPE], onderwerp: { soort: 'vrachtzending', id: z.id, zaak: null },
          issued_at: begin, expires_at: new Date(Date.parse(begin) + GELDIG_MS).toISOString(),
          max_gebruik: MAX_GEBRUIK, gebruik: 0, laatst_gebruikt_at: null,
          ingetrokken_at: nu(), ingetrokken_door: 'legacy-migratie',
          intrekreden: 'oude 32-bit volgcode vereist rotatie', rotatie: 1
        };
      }
      delete z.volgcode;
      aantal++;
    }
    return aantal;
  }

  function bestaat(kaart, codeHash) {
    let gevonden = false;
    for (const z of rijen(kaart)) {
      if (bearer.zelfdeHash(z && z.volg_toegang && z.volg_toegang.code_hash, codeHash)) gevonden = true;
      for (const oud of (z && Array.isArray(z.volg_historie) ? z.volg_historie : []))
        if (bearer.zelfdeHash(oud && oud.code_hash, codeHash)) gevonden = true;
    }
    return gevonden;
  }

  function nieuw(kaart, z, issuer, rotatie = 1) {
    for (let poging = 0; poging < 8; poging++) {
      const gemaakt = bearer.maak({ prefix: 'VRT', issuer, doel: DOEL, scope: SCOPE,
        onderwerp: { soort: 'vrachtzending', id: z.id, zaak: issuer },
        geldigMs: GELDIG_MS, maxGebruik: MAX_GEBRUIK });
      gemaakt.toegang.rotatie = rotatie;
      if (!bestaat(kaart, gemaakt.toegang.code_hash)) {
        z.volg_toegang = gemaakt.toegang;
        return gemaakt;
      }
    }
    return null;
  }

  function reden(z, zaak) {
    const t = z && z.volg_toegang;
    const basis = bearer.reden(t, { doel: DOEL, scope: SCOPE });
    if (basis) return basis;
    if (!t.onderwerp || t.onderwerp.soort !== 'vrachtzending' || t.onderwerp.id !== z.id ||
        (zaak && t.onderwerp.zaak !== zaak))
      return 'verkeerd-onderwerp';
    return null;
  }

  function publiek(z, zaak) {
    const p = bearer.publiek(z && z.volg_toegang);
    return p ? Object.assign(p, { stand: reden(z, zaak) ? 'gesloten' : 'actief', reden: reden(z, zaak) }) : null;
  }

  function toon(z, code, zaak) {
    if (!z) return z;
    const uit = { ...z, volgtoegang: publiek(z, zaak) };
    delete uit.volgcode;
    delete uit.volg_toegang;
    delete uit.volg_historie;
    delete uit.volg_uitgifte;
    delete uit.laatste_volg_rotatie;
    delete uit.verwerkte_handelingen;
    if (code) { uit.volgcode = code; uit.volgcode_eenmalig = true; }
    return uit;
  }

  function herstel(doel, json) {
    const oud = JSON.parse(json);
    for (const k of Object.keys(doel)) delete doel[k];
    Object.assign(doel, oud);
  }

  function transactie(werk) {
    const doe = kaart => {
      if (!kaart || typeof kaart !== 'object' || Array.isArray(kaart))
        throw new Error('vrachtcollectie hoort een kaart te zijn');
      migreerLegacy(kaart);
      const antwoord = werk(kaart);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('vrachttransactie mag niet asynchroon zijn');
      return antwoord;
    };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('vracht', doe);
    const kaart = bak(), voor = JSON.stringify(kaart);
    try {
      const antwoord = doe(kaart);
      if (JSON.stringify(kaart) !== voor) save();
      return antwoord;
    } catch (e) { herstel(kaart, voor); throw e; }
  }

  function idemVan(invoer) {
    const ruw = invoer && (invoer.idem || invoer.idempotentieSleutel || invoer.idempotencyKey);
    const s = String(ruw || '').trim();
    return s.length >= 16 && s.length <= 200 ? s : null;
  }

  function maakZending({ zaak, invoer, lijstVan, bouw, max }) {
    const idem = idemVan(invoer);
    if (!idem) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om een zending te boeken.' };
    return transactie(kaart => {
      const lijst = lijstVan(kaart);
      const idemHash = afdruk('vracht-maak|' + zaak + '|' + idem);
      const fingerprint = afdruk('vracht-invoer|' + zaak + '|' + canoniek(invoer));
      const al = lijst.find(z => z && z.volg_uitgifte && z.volg_uitgifte.idem_hash === idemHash);
      if (al) return al.volg_uitgifte.fingerprint_hash === fingerprint
        ? { status: 409, herhaald: true,
          error: 'Deze zending is al geboekt; de eenmalige volgcode wordt niet herhaald. Roteer haar vanuit de zending.',
          zending: toon(al, null, zaak) }
        : { status: 409, error: 'Deze idempotentiesleutel hoort al bij een andere zending.' };
      if (lijst.length >= max)
        return { status: 400, error: 'Tot ' + max + ' zendingen per zaak; ruim eerst afgeleverde op.' };
      const gebouwd = bouw(kaart);
      if (!gebouwd || !gebouwd.z) return gebouwd;
      gebouwd.z.volg_uitgifte = { idem_hash: idemHash, fingerprint_hash: fingerprint, at: nu() };
      lijst.unshift(gebouwd.z);
      return { ok: true, zending: toon(gebouwd.z, gebouwd.volgcode, zaak) };
    });
  }

  function zoek(kaart, code) {
    const codeHash = bearer.hash(String(code || '').trim().slice(0, 100));
    let gevonden = null;
    for (const [zaak, lijst] of Object.entries(kaart || {})) for (const z of (Array.isArray(lijst) ? lijst : [])) {
      if (bearer.zelfdeHash(z && z.volg_toegang && z.volg_toegang.code_hash, codeHash)) gevonden = { z, zaak };
      for (const oud of (z && Array.isArray(z.volg_historie) ? z.volg_historie : []))
        bearer.zelfdeHash(oud && oud.code_hash, codeHash);
    }
    return gevonden;
  }

  function volg(code) {
    const kale = String(code || '').trim();
    if (!kale) return { status: 400, error: 'Geef een volgcode op.' };
    return transactie(kaart => {
      const gevonden = zoek(kaart, kale), z = gevonden && gevonden.z;
      if (!z || reden(z, gevonden.zaak)) return { status: 404, error: 'Geen actieve zending gevonden op deze volgcode.' };
      bearer.gebruik(z.volg_toegang);
      return { ok: true, zending: {
        ref: z.ref, status: z.status, eta: z.eta, van: z.van, naar: z.naar, colli: z.colli,
        etappes: z.etappes.map(e => ({ modaliteit: e.modaliteit, van: e.van, naar: e.naar, status: e.status })),
        gebeurtenissen: z.gebeurtenissen.map(g => ({ at: g.at, tekst: g.tekst }))
      } };
    });
  }

  function roteer(zaak, id, actor, idem) {
    const sleutel = idemVan({ idem });
    if (!sleutel) return { status: 400, error: 'Een veilige idempotentiesleutel is verplicht om de volgcode te roteren.' };
    return transactie(kaart => {
      const z = (kaart[zaak] || []).find(x => x.id === String(id || ''));
      if (!z) return { status: 404, error: 'Zending niet gevonden.' };
      const idemHash = afdruk('vracht-roteer|' + zaak + '|' + z.id + '|' + sleutel);
      if (z.laatste_volg_rotatie && z.laatste_volg_rotatie.idem_hash === idemHash)
        return { status: 409, herhaald: true,
          error: 'De nieuwe volgcode is al eenmalig getoond en wordt niet herhaald. Roteer opnieuw met een nieuwe sleutel.',
          zending: toon(z, null, zaak) };
      const vorig = z.volg_toegang;
      const nummer = Math.max(1, Number(vorig && vorig.rotatie) || 1) + 1;
      const gemaakt = nieuw(kaart, z, zaak, nummer);
      if (!gemaakt) return { status: 500, error: 'Kon geen unieke volgcode maken.' };
      if (vorig) {
        bearer.intrekken(vorig, actor || zaak, 'volgcode geroteerd');
        z.volg_historie = Array.isArray(z.volg_historie) ? z.volg_historie : [];
        z.volg_historie.push(vorig);
        if (z.volg_historie.length > 20) z.volg_historie.splice(0, z.volg_historie.length - 20);
      }
      z.laatste_volg_rotatie = { idem_hash: idemHash, at: nu(),
        door: String(actor || zaak).slice(0, 100) };
      return { ok: true, zending: toon(z, gemaakt.code, zaak) };
    });
  }

  function intrekken(zaak, id, actor, waarom) {
    return transactie(kaart => {
      const z = (kaart[zaak] || []).find(x => x.id === String(id || ''));
      if (!z) return { status: 404, error: 'Zending niet gevonden.' };
      if (!z.volg_toegang) return { ok: true, al: true, zending: toon(z, null, zaak) };
      const al = !!z.volg_toegang.ingetrokken_at;
      bearer.intrekken(z.volg_toegang, actor || zaak, waarom || 'ingetrokken door expediteur');
      return { ok: true, al, zending: toon(z, null, zaak) };
    });
  }

  return { metKaart: transactie, nieuw, toon, maakZending, volg, roteer,
    intrekken, publiek, DOEL, SCOPE };
};

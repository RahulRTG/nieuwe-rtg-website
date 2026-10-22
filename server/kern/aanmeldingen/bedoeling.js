/* Een externe aanvraag en haar minimale ontvangst delen één bestaande
   collectietransactie. Geen persoonsinhoud in de ontvangst, geen TTL/evictie.
   De opdrachtsleutel is herhaalbeveiliging en verleent geen inzagerecht. */
'use strict';
const crypto = require('node:crypto');
const { veiligGelijk } = require('../util');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX = /^[0-9a-f]{64}$/;
const VORM = { aanmeldingen: 'lijst', aanmeldingOntvangsten: 'kaart' };
const herstel = () => ({ status: 503, error: 'De ontvangst kan niet worden bevestigd. Bewaar uw opdrachtsleutel voor herstel.' });
const verwerkt = () => ({ status: 410, code: 'AANVRAAG_INTENTIE_VERBRUIKT',
  ontvangst: { status: 'alVerwerkt' } });
const kopie = x => JSON.parse(JSON.stringify(x));

module.exports = ({ eigen, accounts, bewerkCollectie, normaliseer, maakAanvraag }) => {
  function zegel() {
    const key = accounts && accounts.sleutelVoor && accounts.sleutelVoor('aanmelding-ontvangst-v1');
    if (!Buffer.isBuffer(key) || key.length < 32) return null;
    const hash = (doel, data) => crypto.createHmac('sha256', key)
      .update(JSON.stringify(['aanmelding', 1, doel, data])).digest('hex');
    return { hash, keyId: hash('sleutelcontrole', 'v1') };
  }
  const velden = (v, namen) => v && typeof v === 'object' && !Array.isArray(v) &&
    Object.keys(v).length === namen.length && namen.every(n => Object.hasOwn(v, n));
  const geredigeerd = r => velden(r, ['geredigeerd']) && r.geredigeerd === true;
  const hashVeld = h => typeof h === 'string' && HEX.test(h);
  const geldigBoek = (boek, z) => velden(boek, ['schema', 'keyId', 'ontvangsten']) && boek.schema === 1 &&
    hashVeld(boek.keyId) && veiligGelijk(boek.keyId, z.keyId) &&
    boek.ontvangsten && typeof boek.ontvangsten === 'object' && !Array.isArray(boek.ontvangsten);
  function geldigBewijs(r) {
    const o = r && r.ontvangst;
    return velden(r, ['actor', 'afdruk', 'ontvangst']) && hashVeld(r.afdruk) && hashVeld(r.actor) &&
      velden(o, ['id', 'aanvraagId', 'at', 'status']) && typeof o.id === 'string' && UUID.test(o.id) &&
      typeof o.aanvraagId === 'string' && UUID.test(o.aanvraagId) && typeof o.at === 'string' && o.status === 'ontvangen';
  }

  async function aanvraagBedoeling(b = {}, aanvragerId = null) {
    b = b || {};
    if (typeof b.idem !== 'string' || !UUID.test(b.idem))
      return { status: 400, code: 'AANVRAAG_INTENTIE_VEREIST',
        error: 'Gebruik een willekeurige UUID v4 per nieuwe aanvraag. Herhaal een onzeker antwoord met dezelfde sleutel en inhoud.' };
    const accountId = aanvragerId == null ? null : Number(aanvragerId);
    if (accountId != null && (!Number.isSafeInteger(accountId) || accountId < 1 ||
        !accounts || !accounts.getUserById(accountId))) return { status: 401, error: 'Log opnieuw in voor deze aanvraag.' };
    const z = zegel();
    if (!z || typeof bewerkCollectie !== 'function') return herstel();
    const inhoud = normaliseer(b), actor = z.hash('actor', accountId == null ? 'anoniem' : 'account:' + accountId);
    const sleutel = z.hash('intentie', [actor, b.idem.toLowerCase()]), afdruk = z.hash('inhoud', inhoud);
    return bewerkCollectie(VORM, (waarden, meta) => {
      const boek = waarden.aanmeldingOntvangsten;
      const nieuw = meta && meta.bestaat.aanmeldingOntvangsten === false && Object.keys(boek).length === 0;
      if (!nieuw && !geldigBoek(boek, z)) return herstel();
      const oud = !nieuw && boek.ontvangsten[sleutel];
      if (oud) {
        if (geredigeerd(oud)) return verwerkt();
        if (!geldigBewijs(oud)) return herstel();
        if (!waarden.aanmeldingen.some(a => a.id === oud.ontvangst.aanvraagId)) {
          boek.ontvangsten[sleutel] = { geredigeerd: true };
          return verwerkt();
        }
        if (!veiligGelijk(oud.afdruk, afdruk)) return { status: 409, error: 'Deze opdrachtsleutel hoort bij andere inhoud. Begin bewust een nieuwe aanvraag.' };
        return { ok: true, ontvangst: kopie(oud.ontvangst) };
      }
      // De eigen accountcontrole blijft ook binnen het slot gelden. Een UUID
      // of een body-account kan een ontbrekend account nooit vervangen.
      if (accountId != null && !accounts.getUserById(accountId)) return { status: 401, error: 'Log opnieuw in voor deze aanvraag.' };
      const r = maakAanvraag(waarden.aanmeldingen)(inhoud, accountId);
      if (!r.ok) return r;
      const ontvangst = { id: crypto.randomUUID(), aanvraagId: r.aanmelding.id,
        at: r.aanmelding.at, status: 'ontvangen' };
      if (nieuw) Object.assign(boek, { schema: 1, keyId: z.keyId, ontvangsten: {} });
      boek.ontvangsten[sleutel] = { actor, afdruk, ontvangst };
      return { ok: true, ontvangst: kopie(ontvangst) };
    });
  }

  /* De bestaande privacy-wisser doet dit binnen zijn bestaande opslaggang.
     Verwijder ook actor/inhoudsafdruk en objectlink. De verbruikte sleutel blijft
     staan; een later herhaald oud verzoek krijgt uitsluitend alVerwerkt. */
  function controleerOntvangstRedactie() {
    if (!eigen.bestaat('aanmeldingOntvangsten')) return;
    const boek = eigen.kijk('aanmeldingOntvangsten'), z = zegel();
    if (!z || !geldigBoek(boek, z) || Object.entries(boek.ontvangsten)
      .some(([k, r]) => !HEX.test(k) || !(geredigeerd(r) || geldigBewijs(r))))
      throw Error('Aanmeldingontvangsten vereisen herstel vóór redactie.');
  }
  function redigeerOntvangsten({ accountId, aanvraagIds = [] } = {}) {
    controleerOntvangstRedactie();
    if (!eigen.bestaat('aanmeldingOntvangsten')) return;
    const boek = eigen.kijk('aanmeldingOntvangsten'), z = zegel();
    const actor = accountId == null ? null : z.hash('actor', 'account:' + Number(accountId));
    const ids = new Set(aanvraagIds);
    for (const [k, r] of Object.entries(boek.ontvangsten)) {
      if (r && ((actor && r.actor && veiligGelijk(r.actor, actor)) || (r.ontvangst && ids.has(r.ontvangst.aanvraagId))))
        boek.ontvangsten[k] = { geredigeerd: true };
    }
  }
  return { aanvraagBedoeling, controleerOntvangstRedactie, redigeerOntvangsten };
};

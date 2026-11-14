/* Aanbieden en specifiek tekenen binnen de bestaande vier collecties.
   GEACCEPTEERD is de laatste stap hier: geen betaling, factuur of pasactivatie. */
'use strict';
const crypto = require('node:crypto');
const klok = require('../../lib/klok');
const { maakContracten } = require('../commercie/contract');
const vorm = require('./abonnementsaanbod-vorm');
const tekenOntvangst = require('./abonnementsaanbod-ontvangst');
const VORM = { contracten: 'lijst', aanmeldingen: 'lijst', lidmaatschapBetalingen: 'lijst', onboarding: 'kaart',
  tenants: 'kaart', zaakAbonnement: 'kaart' };
const PENDING = new Set(['CONCEPT', 'AANGEBODEN', 'GEACCEPTEERD']);
const herstel = () => vorm.fout(503, 'Het aanbod of de ondertekening is niet bevestigd. Herhaal dezelfde opdracht; er zijn geen nieuwe rechten toegekend.');

module.exports = ({ db, bewerkCollectie, accounts, nu = klok.nu, prijsVoor, verrekeningVoor, scopeVoor }) => {
  function account(id) {
    if (!Number.isSafeInteger(id) || id < 1 || !accounts || typeof accounts.getUserById !== 'function') return null;
    const a = accounts.getUserById(id);
    return a && (!accounts.isActief || accounts.isActief(a)) ? a : null;
  }
  const motorVoor = data => maakContracten({ db: { data }, save() {}, nu });
  const organisatieControle = (c, data) => {
    const s = c.aanbod.scope;
    if (s.soort === 'persoon') return { ok: true };
    const org = require('../commercie/organisatieabonnement')({ db: { data: { ...db.data, ...data } }, nu });
    return s.soort === 'organisatie' ? org.controle(c, { voorstel: true }) : org.controleZaak(s.code);
  };
  const resultaat = (c, motor, extra) => ({ ok: true, contract: vorm.publiek(c, motor), ...extra });
  async function werk(id, taak, slot = VORM) {
    if (!account(id)) return vorm.fout(401, 'Log in met het eigen actieve account.');
    if (typeof bewerkCollectie !== 'function') return herstel();
    try {
      return await bewerkCollectie(slot, waarden => {
        if (!account(id)) return vorm.fout(401, 'Log opnieuw in met het eigen actieve account.');
        // Een geweigerde opdracht publiceert ook geen tussenstappen van callbacks.
        const data = vorm.kopie(waarden), motor = motorVoor(data), at = new Date(nu()).toISOString();
        const r = taak(data, motor, at);
        if (r && typeof r.then === 'function') throw Error('Een aanbodbewerker moet synchroon zijn.');
        if (r && r.ok) for (const k of Object.keys(slot)) waarden[k] = data[k];
        return r;
      });
    } catch (_) { return herstel(); }
  }
  function dossier(data, id, b, at) {
    if (b.aanmeldingId) {
      const a = data.aanmeldingen.find(a => a.id === b.aanmeldingId && a.accountId === id && a.pas === b.pas);
      if (!a) return vorm.fout(404, 'Geen eigen aanmelding voor deze pas gevonden.');
      if (['afgewezen', 'ingetrokken'].includes(a.status)) return vorm.fout(409, 'Deze aanmelding kan geen aanbod ontvangen.');
      if (['business', 'lifestyle'].includes(b.pas)) {
        const d = a.besluit;
        if (a.status !== 'geaccepteerd' || !d || d.besluit !== 'geaccepteerd' ||
            typeof d.door !== 'string' || d.door.trim().length < 2 ||
            /gedeelde code|RTG-personeel|^AI$|getekend en betaald contract/i.test(d.door) || !Number.isFinite(Date.parse(d.at)))
          return vorm.fout(403, 'Deze pas vereist eerst herleidbare menselijke toelating op de eigen aanvraag.');
      }
      if (b.pas === 'business-lite' && !vorm.object(a.bedrijf))
        return vorm.fout(409, 'Business Lite vereist een eigen bedrijfsaanvraag.');
      return a;
    }
    if (b.pas !== 'rtg') return vorm.fout(409, 'Deze pas vereist een eigen bestaande aanmelding.');
    const a = { id: crypto.randomUUID(), accountId: id, pas: b.pas, naam: '', contact: '',
      status: 'in behandeling', besluit: null, reis: [], bron: 'zelfservice-abonnement', at, bijgewerkt: at };
    data.aanmeldingen.unshift(a);
    return a;
  }
  async function aanbod(id, input) {
    const b = vorm.invoer(input);
    if (b.error) return b;
    return werk(id, (data, motor, at) => {
      if (data.contracten.some(c => c.accountId === id && c.automatischAbonnement && !vorm.aanbodGeldig(c))) return herstel();
      const inhoudHash = vorm.hash({ pas: b.pas, frequentie: b.frequentie, aanmeldingId: b.aanmeldingId, zaakCode: b.zaakCode });
      const oud = data.contracten.find(c => c.accountId === id && c.automatischAbonnement && c.aanbod &&
        c.aanbod.opdracht && c.aanbod.opdracht.idempotencyKey === b.idempotencyKey);
      if (oud) {
        if (!vorm.aanbodGeldig(oud)) return herstel();
        if (oud.aanbod.opdracht.inhoudHash !== inhoudHash) return vorm.fout(409, 'Deze opdrachtsleutel hoort bij een ander aanbod.');
        return resultaat(oud, motor, { herhaald: true });
      }
      const a = dossier(data, id, b, at);
      if (a.error) return a;
      if (![prijsVoor, verrekeningVoor, scopeVoor].every(f => typeof f === 'function')) return herstel();
      const prijs = prijsVoor(b.pas, { frequentie: b.frequentie, aanmelding: a });
      if (prijs && prijs.error) return prijs;
      if (!vorm.prijsGeldig(prijs, b.frequentie)) return herstel();
      const scope = scopeVoor(id, { pas: b.pas, aanmelding: a, input: b, collecties: data });
      if (scope && scope.error) return scope;
      if (!vorm.scopeGeldig(scope, b.pas)) return herstel();
      if (b.pas === 'business' && scope.soort !== 'organisatie')
        return vorm.fout(409, 'Een nieuw Business-aanbod vereist de expliciet toegelaten organisatie.');
      const pending = data.contracten.find(c => c.accountId === id && c.automatischAbonnement && PENDING.has(c.status) &&
        c.aanbod && c.aanbod.scope && c.aanbod.scope.soort === scope.soort && c.aanbod.scope.code === scope.code);
      if (pending) return vorm.fout(409, 'Voor deze reikwijdte staat al een aanbod klaar. Rond dat eerst af of laat het intrekken.');
      const verrekening = verrekeningVoor(id, { contracten: data.contracten, aanmeldingen: data.aanmeldingen,
        op: at, doelCenten: prijs.termijn.brutoCenten, pas: b.pas, scope });
      if (verrekening && verrekening.error) return verrekening;
      if (!vorm.creditGeldig(verrekening, prijs.termijn.brutoCenten)) return herstel();
      const c = motor.open({ pas: b.pas, aanmeldingId: a.id, startAt: at,
        afgesprokenCenten: prijs.maand.nettoCenten, btwProfiel: prijs.btwProfiel,
        minimumMaanden: 12, frequentie: b.frequentie, verlenging: 'opzegbaar', opzegMaanden: 1 });
      c.accountId = id;
      c.automatischAbonnement = true;
      c.verrekening = { ...vorm.kopie(verrekening), status: 'GERESERVEERD',
        creditCenten: verrekening.creditCenten + verrekening.overCenten,
        regels: verrekening.regels.map(r => ({ ...vorm.kopie(r), centen: r.beschikbaarCenten })) };
      c.aanbod = vorm.maakAanbod(c, { prijs, scope, verrekening, at,
        opdracht: { idempotencyKey: b.idempotencyKey, inhoudHash } });
      const org = organisatieControle(c, data);
      if (!org.ok) return org;
      const r = motor.bied(c);
      return r.error ? herstel() : resultaat(c, motor);
    });
  }
  async function teken(id, input) {
    if (!vorm.object(input) || typeof input.contractId !== 'string' || typeof input.aanbodHash !== 'string')
      return vorm.fout(400, 'Noem de overeenkomst en de gelezen aanbodreferentie.');
    return werk(id, (data, motor, at) => {
      const c = data.contracten.find(c => c.id === input.contractId && c.accountId === id && c.automatischAbonnement);
      if (!c) return vorm.fout(404, 'Deze eigen overeenkomst is niet gevonden.');
      if (!vorm.aanbodGeldig(c) || input.aanbodHash !== c.aanbod.hash)
        return vorm.fout(409, 'De gelezen aanbodinhoud klopt niet meer. Lees het aanbod opnieuw.');
      const a = dossier(data, id, { pas: c.pas, aanmeldingId: c.aanmeldingId }, at);
      if (a.error) return a;
      if (typeof scopeVoor !== 'function') return herstel();
      const scope = scopeVoor(id, { pas: c.pas, aanmelding: a, input: { zaakCode: c.aanbod.scope.code }, bestaandAanbod: c.aanbod, collecties: data });
      if (scope && scope.error) return scope;
      if (!vorm.scopeGeldig(scope, c.pas) || vorm.canon(scope) !== vorm.canon(c.aanbod.scope))
        return vorm.fout(409, 'De bevoegdheid of reikwijdte is gewijzigd; lees een nieuw aanbod.');
      const org = organisatieControle(c, data);
      if (!org.ok) return org;
      if (c.status === 'AANGEBODEN' && c.aanbod.geldigTot && Date.parse(at) > Date.parse(c.aanbod.geldigTot))
        return vorm.fout(409, 'De verrekenofferte is verlopen; een nieuwe berekening is nodig.', 'AANBOD_VERLOPEN');
      if (c.status === 'AANGEBODEN' && (c.afgesprokenCenten !== c.aanbod.prijs.maand.nettoCenten ||
          c.btwProfiel !== c.aanbod.prijs.btwProfiel || c.frequentie !== c.aanbod.frequentie ||
          c.minimumMaanden !== 12 || c.opzegMaanden !== 1 || c.verlenging !== 'opzegbaar')) return herstel();
      const r = tekenOntvangst(data, c, input, at);
      if (!r.ok) return r;
      if (!r.herhaald) {
        const stap = motor.accepteer(c, c.aanbod.prijs.maand.nettoCenten);
        if (stap.error) return herstel();
        c.ondertekening = r.bewijs;
      } else if (!c.ondertekening || vorm.canon(c.ondertekening) !== vorm.canon(r.bewijs)) return herstel();
      return resultaat(c, motor, { herhaald: r.herhaald });
    });
  }
  function mijn(id) {
    if (!account(id)) return vorm.fout(401, 'Log in met het eigen actieve account.');
    const data = db.data || {}, motor = motorVoor({ contracten: [] });
    const contracten = (data.contracten || []).filter(c => c.accountId === id && c.automatischAbonnement);
    try {
      if (contracten.some(c => !vorm.aanbodGeldig(c))) return herstel();
      return { ok: true, contracten: contracten.map(c => vorm.publiek(c, motor)) };
    } catch (_) { return herstel(); }
  }
  const intrekken = require('./abonnementsaanbod-intrekken')({ werk, resultaat, herstel, slot: VORM });
  return { aanbod, teken, mijn, intrekken };
};
module.exports.valideOndertekening = tekenOntvangst.valideOndertekening;

/* De ENTREECODE van een activiteitenticket (travelos.activity_ticket_entry):
   een 128-bit bearer waarmee de deur van EEN zaak EEN ticket eenmaal binnenlaat.
   De oude `code` (30 bits; aan de deur 24) stond kaal op de boeking, kwam terug
   in Mijn tickets, het dagprogramma en als kassabonnummer, en werd lineair
   vergeleken. De boeking draagt nu geen code meer.

   - uitgeven() IS roteren: het lid tikt "Toon ticketcode" (/api/ticket/toon),
     de deur verkoopt of vernieuwt een deurticket. Kaal staat de code alleen in
     dat antwoord; op schijf de SHA-256 in `ticketToegang` (per ref), en de
     vorige gaat ingetrokken de historie in.
   - issuer/doel/scope, verval aan het eind van de ticketdag (UTC, dezelfde dag
     die de deur vergelijkt), max_gebruik 1.
   - constant-time zoeken over elke hash, ook historische; een treffer bij een
     ANDERE zaak telt niet.
   - de claim legt de check-in vast in DEZELFDE collectietransactie
     (PostgreSQL: advisory lock + FOR UPDATE), dus twee poorten die tegelijk
     scannen laten het ticket een keer binnen. "Binnen" is hier autoritatief
     (`boekingen` is een rij-voor-rij grootboek zonder collectieslot); de
     boeking krijgt de projectie, en een gemiste projectie herstelt de volgende
     scan.
   - ruimLegacy() haalt oude kale codes van boekingen en kassabonnen en
     honoreert ze niet. Het ticket houdt zijn waarde: het lid toont een nieuwe
     code, een deurticket vernieuwt de zaak vanuit het dagprogramma. */
'use strict';

const klok = require('../lib/klok');

const DOEL = 'activiteit-entree';
const SCOPE = Object.freeze(['zaak.ticket.checkin']);
const BEWAAR_MS = 30 * 86400000;
const DICHT = ['geweigerd', 'geannuleerd'];

module.exports = ({ db, save, bewerkCollectie, crypto, nu = () => klok.datum().toISOString() }) => {
  if (typeof bewerkCollectie !== 'function') throw new Error('De ticketcode vereist een collectietransactie.');
  const bearer = require('./bearercode')({ crypto, namespace: 'travelos.activity_ticket_entry', nu });
  const eigen = require('./eigencollectie')({ db, domein: 'kern/tickettoegang', bezit: { ticketToegang: 'kaart' } });
  const afdruk = s => crypto.createHash('sha256').update(String(s)).digest('hex');
  const houder = b => afdruk('rtg-ticket-houder-v1|' + String(b.customerKey || b.customerTier || ('deur:' + b.supplierCode)));
  const vandaag = () => nu().slice(0, 10);
  const eindVan = datum => Date.parse(String(datum) + 'T23:59:59.999Z');

  const transactie = werk => bewerkCollectie('ticketToegang', bron => {
    if (!bron || typeof bron !== 'object' || Array.isArray(bron)) throw new Error('ticketToegang hoort een kaart te zijn');
    return werk(bron);
  });

  let legacyKlaar = false;
  function ruimLegacy() {
    if (legacyKlaar) return 0;
    let n = 0;
    for (const b of (db.data.boekingen || [])) {
      if (!b || b.kind !== 'ticket' || !Object.prototype.hasOwnProperty.call(b, 'code')) continue;
      delete b.code; b.codeLegacy = true; n++;
    }
    for (const bonnen of Object.values(db.data.posSales || {}))
      for (const x of Array.isArray(bonnen) ? bonnen : [])
        if (x && /^Deurverkoop /.test(String(x.desc || '')) && /^[0-9A-F]{6}$/.test(String(x.bon || ''))) {
          x.bon = null; x.bonLegacy = true; n++;   // de oude deurcode stond hier als bonnummer
        }
    if (n) save();
    legacyKlaar = true;
    return n;
  }

  // Mag deze boeking (nu) een code dragen? null = ja, anders de reden.
  function magNiet(b) {
    if (!b || b.kind !== 'ticket') return { status: 404, error: 'Ticket niet gevonden.' };
    if (b.checkin) return { status: 409, error: 'Dit ticket is al gebruikt.' };
    if (b.refunded || DICHT.includes(b.status)) return { status: 409, error: 'Dit ticket is geannuleerd.' };
    if (!b.paid) return { status: 409, error: 'Betaal eerst het ticket; dan krijgt u de code.' };
    if (!(eindVan(b.datum) > Date.parse(nu()))) return { status: 409, error: 'Dit ticket is verlopen.' };
    return null;
  }

  /* Uitgeven is roteren. `key` = het lid dat zijn eigen ticket toont;
     `supplierCode` = de zaak die een DEURticket (zonder lid) uitgeeft. */
  function uitgeven({ boeking: b, key, supplierCode, actor }) {
    if (key != null && (!b || (b.customerKey || b.customerTier) !== key)) return { status: 404, error: 'Ticket niet gevonden.' };
    if (supplierCode != null && (!b || b.supplierCode !== supplierCode || !b.deur || b.customerKey))
      return { status: 404, error: 'Deurticket niet gevonden.' };
    if (key == null && supplierCode == null) return { status: 404, error: 'Ticket niet gevonden.' };
    const fout = magNiet(b);
    if (fout) return fout;
    return transactie(bron => {
      const grens = Date.parse(nu()) - BEWAAR_MS;
      for (const [ref, r] of Object.entries(bron))
        if (!r || !(Date.parse(r.bijgewerkt_at) >= grens)) delete bron[ref];
      const oud = bron[b.ref];
      if (oud && (oud.supplierCode !== b.supplierCode || oud.houder_hash !== houder(b)))
        return { status: 409, error: 'Deze ticketcode hoort niet bij dit ticket.' };
      if (oud && oud.checkin) return { status: 409, error: 'Dit ticket is al gebruikt.' };
      const r = oud || (bron[b.ref] = { ref: b.ref, supplierCode: b.supplierCode, houder_hash: houder(b),
        toegang: null, historie: [], checkin: null, bijgewerkt_at: nu() });
      const rotatie = Math.max(0, ...[r.toegang, ...r.historie].filter(Boolean).map(t => Number(t.rotatie) || 0)) + 1;
      if (r.toegang) {
        bearer.intrekken(r.toegang, key != null ? houder(b) : String(actor || 'zaak'), 'ticketcode vernieuwd');
        r.historie.push(r.toegang);
        if (r.historie.length > 12) r.historie.splice(0, r.historie.length - 12);
      }
      const g = bearer.maak({ prefix: 'TK', issuer: key != null ? 'rtg.lid.ticket' : 'rtg.zaak.deurverkoop',
        doel: DOEL, scope: SCOPE, onderwerp: { soort: 'ticket', ref: b.ref, supplierCode: b.supplierCode, houder_hash: r.houder_hash },
        geldigMs: eindVan(b.datum) - Date.parse(nu()), maxGebruik: 1 });
      g.toegang.rotatie = rotatie;
      r.toegang = g.toegang;
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, eenmalig: true, code: g.code, toegang: bearer.publiek(r.toegang) };
    });
  }

  /* De deur scant. `boekingVan(ref)` geeft de boeking; `actor` het personeelslid. */
  function claim({ code, supplierCode, actor, boekingVan }) {
    const kale = String(code || '').trim().slice(0, 80);
    if (!kale) return { status: 400, error: 'Voer de entreecode in.' };
    const gezocht = bearer.hash(kale);
    return transactie(bron => {
      let r = null, oud = null;
      for (const x of Object.values(bron)) {
        if (bearer.zelfdeHash(x && x.toegang && x.toegang.code_hash, gezocht)) r = x;
        for (const t of (x && x.historie) || []) if (bearer.zelfdeHash(t && t.code_hash, gezocht)) oud = x;
      }
      if (!r && oud && oud.supplierCode === supplierCode)
        return { status: 409, error: 'Deze ticketcode is vervangen. Vraag de gast de nieuwe te tonen.' };
      if (!r || r.supplierCode !== supplierCode) return { status: 404, error: 'Deze code hoort niet bij een ticket van uw zaak.' };
      const b = boekingVan(r.ref), ow = (r.toegang && r.toegang.onderwerp) || {};
      if (!b || b.ref !== r.ref || b.kind !== 'ticket' || b.supplierCode !== supplierCode || houder(b) !== r.houder_hash ||
          ow.ref !== r.ref || ow.supplierCode !== supplierCode || ow.houder_hash !== r.houder_hash)
        return { status: 404, error: 'Deze code hoort niet bij een ticket van uw zaak.' };
      if (!r.checkin && b.checkin) { r.checkin = b.checkin; r.bijgewerkt_at = nu(); }
      if (r.checkin) return { status: 409, ref: r.ref, checkin: r.checkin,
        error: 'Al binnen: om ' + String(r.checkin.at).slice(11, 16) + ' afgevinkt door ' + r.checkin.door + '.' };
      const reden = bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE });
      if (reden === 'verlopen') return { status: 409, error: 'Deze ticketcode is verlopen.' };
      if (reden) return { status: 409, error: 'Deze ticketcode is niet meer geldig.' };
      if (b.refunded || DICHT.includes(b.status)) return { status: 409, error: 'Dit ticket is geannuleerd.' };
      if (!b.paid) return { status: 409, error: 'Dit ticket is nog niet betaald.' };
      if (b.datum !== vandaag()) return { status: 409, error: 'Dit ticket is voor ' + b.datum + ' (' + b.tijd + '), niet voor vandaag.' };
      bearer.gebruik(r.toegang);
      r.checkin = { at: nu(), door: String((actor && actor.name) || 'personeel').slice(0, 80),
        staffId: (actor && actor.staffId) || null };
      r.bijgewerkt_at = nu();
      return { status: 200, ok: true, ref: r.ref, checkin: r.checkin };
    });
  }

  // alleen metadata, nooit code of hash
  const standVan = ref => {
    const r = eigen.kijk('ticketToegang')[ref];
    return r ? { rotatie: r.toegang ? r.toegang.rotatie : 0, gebruikt: !!r.checkin,
      toegang: r.toegang ? Object.assign(bearer.publiek(r.toegang), { stand: bearer.reden(r.toegang, { doel: DOEL, scope: SCOPE }) || 'actief' }) : null } : null;
  };

  return { uitgeven, claim, ruimLegacy, standVan, DOEL, SCOPE };
};

module.exports.DOEL = DOEL;
module.exports.SCOPE = SCOPE;

/* Pure betaalherstelprojectie op bestaande contracten/termijnen. Geen klok,
   opslag, accountverlaging of verzonnen bezorgbewijs. De aanroeper valideert
   de ondertekenontvangst en geeft uitsluitend eigen server-betaalwaarheid door.
   .herstel.aankondiging is een duurzaam geverifieerde inboxreferentie, geen
   browserveld of de ongecontroleerde retourwaarde van notify(). */
'use strict';
const T = require('../tijdzone');
const { LOPEND } = require('../commercie/contract/vorm');
const { aanbodGeldig, hash } = require('./abonnementsaanbod-vorm');
const BASISRECHTEN = Object.freeze(['facturen', 'betalen', 'opzeggen', 'nazorg']);
const tekst = s => typeof s === 'string' && s.length > 0 && s.trim() === s;
const cent = n => Number.isSafeInteger(n) && n >= 0;
const iso = s => typeof s === 'string' && s.length === 24 && Number.isFinite(Date.parse(s)) && new Date(s).toISOString() === s;
const bedrag = t => Object.hasOwn(t, 'brutoCenten') ? t.brutoCenten : t.centen;

function herstelTot(at, zone = T.HUIS_ZONE) {
  if (!iso(at) || !T.geldigeZone(zone)) return null;
  const h = T.huis(at, zone);
  return new Date(T.moment(T.plusDagen(h.datum, 31), h.minuten, zone).getTime() + Date.parse(at) % 60000).toISOString();
}
function oordeel(stand, reden, extra = {}) {
  return { stand, reden, beperkNieuweBetaaldeDiensten: stand === 'BEPERKT',
    controleNodig: stand === 'CONTROLE_NODIG', basisrechten: [...BASISRECHTEN], ...extra };
}
function schuld(t, c, op) {
  if (!tekst(t.id) || t.contractId !== c.id || !Number.isSafeInteger(t.nr) || t.nr < 1 ||
      !tekst(t.invoiceId) || !iso(t.vervalt) || !cent(bedrag(t))) return 'onbekend';
  if (t.betwist === true) return 'onbekend';
  if (bedrag(t) === 0 || Date.parse(t.vervalt) >= Date.parse(op)) return 'geen';
  const b = t.betaling;
  if (!b) return t.betaalWaarheidId ? 'onbekend' : t.status === 'open' ? 'open' : 'onbekend';
  if (!tekst(b.id) || t.betaalWaarheidId !== b.id || b.actor !== 'acc:' + c.accountId ||
      b.soort !== 'factuur' || b.bronRef !== t.invoiceId || b.centen !== bedrag(t) || b.valuta !== 'eur' ||
      b.context?.own !== true || b.context.accountId !== c.accountId || b.context.invoiceId !== t.invoiceId ||
      b.context.contractId !== c.id || b.context.termijn !== t.nr) return 'onbekend';
  if ((b.terugbetaaldCenten != null && (!cent(b.terugbetaaldCenten) || b.terugbetaaldCenten > 0)) ||
      (b.terugbetaalOpdrachten != null && (!Array.isArray(b.terugbetaalOpdrachten) ||
        b.terugbetaalOpdrachten.some(r => !r || !['GEWEIGERD', 'GEANNULEERD'].includes(r.status))))) return 'onbekend';
  if (b.status === 'BEVESTIGD') return tekst(b.provider) && tekst(b.providerId) &&
    iso(b.afgehandeldAt) && Date.parse(b.afgehandeldAt) <= Date.parse(op) ? 'geen' : 'onbekend';
  // Alleen de server-bevestigde off-session poging is hier echt geweigerd.
  // Dezelfde PI-status bij een nog niet begonnen checkout bewijst dat niet.
  if (b.status === 'WACHT_OP_KLANT' && b.provider === 'stripe' && tekst(b.providerId) &&
      b.start?.terugkerend?.modus === 'innen' && b.providerStatus === 'requires_payment_method') return 'open';
  if (['AANGEMAAKT', 'WACHT_OP_KLANT', 'IN_BEHANDELING'].includes(b.status)) return 'wacht';
  return ['GEWEIGERD', 'GEANNULEERD'].includes(b.status) && tekst(b.provider) && tekst(b.providerId) ? 'open' : 'onbekend';
}
function inspecteer({ contract: c, termijnen, op } = {}) {
  if (!c || c.automatischAbonnement !== true || c.aanbod?.voorwaarden?.herstelDagen !== 31)
    return { stop: oordeel('BESTAANDE_AFSPRAAK', 'Geen nieuwe automatische 31-dagenafspraak; bestaande voorwaarden blijven leidend.') };
  if (!iso(op) || !tekst(c.id) || !Number.isSafeInteger(c.accountId) || c.accountId <= 0 || !Array.isArray(termijnen))
    return { stop: oordeel('CONTROLE_NODIG', 'Contract, eigenaar, peiltijd of termijnbron ontbreekt.') };
  let geldig = false;
  try { geldig = aanbodGeldig(c); } catch (_) { /* Onleesbare inhoud is geen geldige afspraak. */ }
  const s = c.ondertekening;
  if (!geldig || !s || s.scope !== 'abonnement:' + c.id || s.profiel !== 'user-' + c.accountId ||
      s.versie !== c.aanbod.versie || !/^[a-f0-9]{64}$/.test(s.hash || '') || !iso(s.at) || Date.parse(s.at) > Date.parse(op) || c.betwist === true)
    return { stop: oordeel('CONTROLE_NODIG', 'De individuele afspraak of ondertekenreferentie vraagt controle.') };
  if (!LOPEND.has(c.status) || c.eindigtOp && (!iso(c.eindigtOp) || Date.parse(c.eindigtOp) <= Date.parse(op)))
    return { stop: oordeel('NIET_VAN_TOEPASSING', 'Deze overeenkomst is niet lopend; betaalherstel verlaagt nooit de accountpas.') };
  if (!termijnen.length) return { stop: oordeel('CONTROLE_NODIG', 'De termijnbron van deze lopende overeenkomst ontbreekt.') };
  const gezien = new Set(), facturen = new Set(), betalingen = new Set(), open = [], wacht = [];
  for (const t of termijnen) {
    if (!t || gezien.has(t.id) || facturen.has(t.invoiceId) || t.betaalWaarheidId && betalingen.has(t.betaalWaarheidId))
      return { stop: oordeel('CONTROLE_NODIG', 'Een termijn, factuur of betaalbewijs ontbreekt of komt dubbel voor.') };
    gezien.add(t.id);
    facturen.add(t.invoiceId);
    if (t.betaalWaarheidId) betalingen.add(t.betaalWaarheidId);
    const stand = schuld(t, c, op);
    if (stand === 'onbekend') return { stop: oordeel('CONTROLE_NODIG', 'De termijn of betaalwaarheid is onvolledig, betwist of onzeker.') };
    if (stand === 'open') open.push(t);
    if (stand === 'wacht') wacht.push(t.id);
  }
  return { c, open, wacht, termijnen, op };
}
const regels = ts => ts.map(t => ({ id: t.id, invoiceId: t.invoiceId, vervalt: t.vervalt, brutoCenten: bedrag(t) })).sort((a, b) => a.id.localeCompare(b.id));
function inhoud(c, ts, at, tot, zone) {
  const r = regels(ts);
  return { contractId: c.id, accountId: c.accountId, termijnIds: r.map(t => t.id), termijnAfdruk: hash(r),
    at, herstelTot: tot, tijdzone: zone,
    tekst: 'Er staan abonnementstermijnen open: ' + r.map(t => t.invoiceId + ' (EUR ' + (t.brutoCenten / 100).toFixed(2) + ')').join(', ') +
      '. U kunt deze uiterlijk ' + tot + ' herstellen (31 kalenderdagen, ' + zone + '). Daarna worden alleen nieuwe betaalde diensten beperkt.' +
      ' Facturen, betalen, opzeggen en noodzakelijke nazorg blijven bereikbaar. Neem bij een betwisting contact op met RTG voor menselijke beoordeling.' };
}
function aankondiging(input) {
  const v = inspecteer(input);
  if (v.stop) return { ok: false, ...v.stop };
  if (!v.open.length) return { ok: false, ...oordeel(v.wacht.length ? 'BETALING_IN_BEHANDELING' : 'GEEN_ACHTERSTAND', 'Geen aantoonbaar open achterstand om aan te kondigen.') };
  const h = inhoud(v.c, v.open, v.op, herstelTot(v.op), T.HUIS_ZONE);
  // Alleen concept: zonder geverifieerde .aankondiging heeft dit geen beperkend effect.
  return { ok: true, herstel: { ...h, inhoudHash: hash(h) } };
}
function beoordeel(input) {
  const v = inspecteer(input);
  if (v.stop) return v.stop;
  const { c, open, wacht, termijnen, op } = v;
  if (!open.length) return oordeel(wacht.length ? 'BETALING_IN_BEHANDELING' : 'GEEN_ACHTERSTAND',
    wacht.length ? 'De betaling is nog niet definitief; geen mislukking vastgesteld.' : 'Geen bewezen open achterstand.', { wacht });
  const h = c.herstel;
  if (!h) return oordeel('AANKONDIGING_NODIG', 'Eerst een aantoonbaar beschikbaar gemaakte aankondiging.', { termijnIds: open.map(t => t.id) });
  const a = h.aankondiging, genoemd = Array.isArray(h.termijnIds) ? termijnen.filter(t => h.termijnIds.includes(t.id)) : [];
  const bekend = genoemd.length && genoemd.length === h.termijnIds.length && genoemd.every(t => Date.parse(t.vervalt) < Date.parse(h.at));
  const bewijs = a && a.kanaal === 'rtg-inbox' && tekst(a.referentie) && iso(a.beschikbaarAt) &&
    Date.parse(a.beschikbaarAt) >= Date.parse(h.at) && Date.parse(a.beschikbaarAt) <= Date.parse(op) && a.inhoudHash === h.inhoudHash;
  const tijd = iso(h.at) && iso(h.herstelTot) && h.tijdzone === T.HUIS_ZONE &&
    Date.parse(h.herstelTot) >= Date.parse(herstelTot(h.at)) && bewijs &&
    Date.parse(h.herstelTot) >= Date.parse(herstelTot(a.beschikbaarAt));
  const verwacht = bekend && tijd ? inhoud(c, genoemd, h.at, h.herstelTot, h.tijdzone) : null;
  if (!verwacht || h.contractId !== c.id || h.accountId !== c.accountId ||
      h.termijnAfdruk !== verwacht.termijnAfdruk || h.tekst !== verwacht.tekst || h.inhoudHash !== hash(verwacht))
    return oordeel('CONTROLE_NODIG', 'Aankondiging, persoonlijke inboxreferentie of volledige hersteltermijn is niet aantoonbaar.');
  const achterstand = open.filter(t => h.termijnIds.includes(t.id)).map(t => t.id);
  if (!achterstand.length) return oordeel('AANKONDIGING_NODIG', 'Eerder aangekondigde achterstand is hersteld; nieuwe termijnen vragen een eigen aankondiging.', { wacht });
  return oordeel(Date.parse(op) > Date.parse(h.herstelTot) ? 'BEPERKT' : 'HERSTELTERMIJN',
    'Alleen de aangekondigde, aantoonbaar open termijnen tellen; basisrechten blijven beschikbaar.',
    { termijnIds: achterstand, herstelTot: h.herstelTot, aankondigingRef: a.referentie, wacht });
}
function magDienst(o, { basisrecht, nieuweBetaaldeDienst } = {}) {
  return BASISRECHTEN.includes(basisrecht) || nieuweBetaaldeDienst !== true || o?.beperkNieuweBetaaldeDiensten !== true;
}
module.exports = { beoordeel, aankondiging, magDienst, herstelTot, BASISRECHTEN };

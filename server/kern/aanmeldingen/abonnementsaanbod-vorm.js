/* De onveranderlijke inhoud van één individueel aanbod. Prijzen en verrekening
   komen van de bestaande eigenaren; deze module berekent geen catalogusprijs. */
'use strict';
const crypto = require('node:crypto');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PASSEN = new Set(['rtg', 'business-lite', 'business', 'lifestyle']);
const kopie = x => JSON.parse(JSON.stringify(x));
const fout = (status, error, code) => ({ status, error, ...(code ? { code } : {}) });
const object = x => !!x && typeof x === 'object' && !Array.isArray(x);
function canon(x) {
  if (Array.isArray(x)) return '[' + x.map(canon).join(',') + ']';
  if (object(x)) return '{' + Object.keys(x).sort().map(k => JSON.stringify(k) + ':' + canon(x[k])).join(',') + '}';
  if (x === undefined || (typeof x === 'number' && !Number.isFinite(x))) throw Error('Ongeldige aanbodinhoud.');
  return JSON.stringify(x);
}
const hash = x => crypto.createHash('sha256').update(canon(x)).digest('hex');
const cent = x => Number.isSafeInteger(x) && x >= 0;
function geld(x) {
  return object(x) && ['nettoCenten', 'btwCenten', 'brutoCenten'].every(k => cent(x[k])) &&
    x.nettoCenten + x.btwCenten === x.brutoCenten;
}
function prijsGeldig(p, frequentie) {
  return object(p) && typeof p.versie === 'string' && p.versie.length > 0 &&
    typeof p.btwProfiel === 'string' && p.btwProfiel.length > 0 &&
    ['maand', 'termijn', 'jaar'].every(k => geld(p[k])) && p.maand.brutoCenten > 0 &&
    p.minimumMaanden === 12 && p.herstelDagen === 31 &&
    canon(p.termijn) === canon(frequentie === 'jaar' ? p.jaar : p.maand);
}
function scopeGeldig(s, pas) {
  return object(s) && ['persoon', 'zaak', 'organisatie'].includes(s.soort) &&
    (s.soort === 'persoon' ? s.code === null : s.code === null || typeof s.code === 'string' && s.code.trim().length > 0) &&
    (s.soort !== 'organisatie' || pas === 'business' && typeof s.code === 'string' && /^[A-Z0-9][A-Z0-9-]{1,30}$/.test(s.code)) &&
    Array.isArray(s.capaciteiten) && s.capaciteiten.every(c => typeof c === 'string' && c.length > 0) &&
    new Set(s.capaciteiten).size === s.capaciteiten.length &&
    (pas !== 'business-lite' || s.soort === 'zaak');
}
function creditGeldig(v, doel) {
  return object(v) && v.ok === true && (v.bronContractId === null || typeof v.bronContractId === 'string' && v.bronContractId.length > 0) &&
    Array.isArray(v.regels) && ['creditCenten', 'teBetalenCenten', 'overCenten'].every(k => cent(v[k])) &&
    v.creditCenten <= doel && v.teBetalenCenten === doel - v.creditCenten &&
    (v.overCenten === 0 || v.creditCenten === doel) && cent(v.creditCenten + v.overCenten) &&
    v.regels.every(r => object(r) && cent(r.beschikbaarCenten) && cent(r.centen) && cent(r.overCenten) &&
      r.centen + r.overCenten === r.beschikbaarCenten) &&
    v.regels.reduce((n, r) => n + r.beschikbaarCenten, 0) === v.creditCenten + v.overCenten &&
    (v.bronContractId !== null || v.creditCenten === 0 && v.regels.length === 0 && v.overCenten === 0);
}
function invoer(b) {
  if (!object(b) || !PASSEN.has(b.pas) || !['maand', 'jaar'].includes(b.frequentie) ||
      typeof b.idempotencyKey !== 'string' || !UUID.test(b.idempotencyKey) ||
      b.zaakCode != null && (typeof b.zaakCode !== 'string' || !b.zaakCode.trim()) ||
      b.aanmeldingId != null && (typeof b.aanmeldingId !== 'string' || !b.aanmeldingId.trim()))
    return fout(400, 'Kies een betaalde pas, betaalfrequentie en een willekeurige UUID v4 voor dit aanbod.');
  return { pas: b.pas, frequentie: b.frequentie, idempotencyKey: b.idempotencyKey.toLowerCase(),
    aanmeldingId: b.aanmeldingId || null,
    zaakCode: b.zaakCode == null ? null : String(b.zaakCode).trim().toUpperCase() };
}
const euro = n => 'EUR ' + (n / 100).toFixed(2);
function tekstVoor(a) {
  const p = a.prijs, v = a.verrekening;
  return [a.titel, 'Aanbod ' + a.contractId + ' voor abonnement ' + a.pas + '.',
    'Prijsversie: ' + p.versie + '; btw-profiel: ' + p.btwProfiel + '.',
    'Maandprijs: ' + euro(p.maand.nettoCenten) + ' exclusief btw + ' + euro(p.maand.btwCenten) +
      ' btw = ' + euro(p.maand.brutoCenten) + ' inclusief btw.',
    'Betaalfrequentie: ' + a.frequentie + '; per termijn: ' + euro(p.termijn.nettoCenten) +
      ' exclusief btw + ' + euro(p.termijn.btwCenten) + ' btw = ' + euro(p.termijn.brutoCenten) + ' inclusief btw.',
    'Jaarvooruitbetaling: ' + euro(p.jaar.nettoCenten) + ' exclusief btw + ' + euro(p.jaar.btwCenten) +
      ' btw = ' + euro(p.jaar.brutoCenten) + ' inclusief btw.',
    'De eerste verbintenis duurt 12 maanden vanaf activering na instemming en voldane eerste betalingsverplichting. Daarna maandelijks opzegbaar met één maand opzegtermijn; geen nieuwe vaste jaartermijn.',
    ...(a.voorwaarden.jaarVervolg === 'maand' ? [
      'Na de eerste vooruitbetaalde 12 maanden volgt automatisch maandbetaling tegen de hierboven vastgelegde maandprijs. Opnieuw een jaar vooruitbetalen vereist een nieuwe uitdrukkelijke keuze.'
    ] : []),
    ...(a.voorwaarden.laatsteMaandNaarRato === true ? [
      'Een laatste gedeeltelijke maand wordt naar rato tot de contractuele einddatum berekend; bestaande gestarte betaalopdrachten worden niet herschreven.'
    ] : []),
    'Een betaalachterstand kent 31 kalenderdagen herstel na aantoonbare aankondiging; dit aanbod is niet die aankondiging.',
    'Reikwijdte: ' + a.scope.soort + (a.scope.code ? ' ' + a.scope.code : '') +
      '. Inbegrepen productcapaciteiten: ' + a.scope.capaciteiten.join(', ') + '.',
    ...(a.voorwaarden.bedrijfsReikwijdte === 'organisatie' ? [
      'Business geldt voor de hele organisatie ' + a.scope.code + ', via haar bestaande bevoegde zaak- en werkruimtebindingen. Dit kent medewerkers geen persoonlijke Business Pass of nieuwe beheerdersrollen toe.'
    ] : a.voorwaarden.bedrijfsReikwijdte === 'zaak' ? [
      'Business Lite geldt voor één zaak; andere zaken of de hele organisatie zijn niet inbegrepen.'
    ] : []),
    'Verrekening: ' + euro(v.creditCenten) + '; nu te betalen: ' + euro(v.teBetalenCenten) +
      '; eventueel overschot: ' + euro(v.overCenten) + '. Geen automatische terugbetaling van een overschot.',
    ...(a.geldigTot ? ['Verrekening berekend op ' + a.at + '; betaalbevestiging uiterlijk ' + a.geldigTot +
      '. Een late of onzekere betaling geeft geen nieuwe rechten en vraagt herstel. Dit is quoteversheid, niet de betaalhersteltermijn.'] : []),
    a.voorwaarden.mandaatTekst,
    'Alle versiegebonden bedragen, termijnen, reikwijdte en verrekenregels: ' + canon(a)
  ].join('\n');
}
function maakAanbod(c, { prijs, scope, verrekening, at, opdracht }) {
  const inhoud = { schema: 1, versie: 1, titel: 'Persoonlijke RTG-abonnementsovereenkomst',
    contractId: c.id, accountId: c.accountId, aanmeldingId: c.aanmeldingId, pas: c.pas,
    frequentie: c.frequentie, prijs: kopie(prijs), scope: kopie(scope), verrekening: kopie(verrekening),
    voorwaarden: { minimumMaanden: 12, herstelDagen: 31, opzegMaanden: 1, verlenging: 'opzegbaar',
      ...(c.frequentie === 'jaar' ? { jaarVervolg: 'maand' } : {}), laatsteMaandNaarRato: true,
      ...(scope.soort === 'organisatie' || scope.soort === 'zaak' ? { bedrijfsReikwijdte: scope.soort } : {}),
      start: 'na instemming en voldane eerste betalingsverplichting',
      mandaatTekst: 'Afzonderlijke toestemming: ik machtig automatische betaling van de overeengekomen abonnementstermijnen. Deze toestemming is geen bewijs van een betaling of van een provider-mandaat.' },
    opdracht, at, geldigTot: verrekening.bronContractId ? new Date(Date.parse(at) + 15 * 60 * 1000).toISOString() : null };
  const afdruk = hash(inhoud);
  return { ...inhoud, hash: afdruk, tekst: tekstVoor(inhoud) + '\nAanbodreferentie: ' + afdruk };
}
function aanbodGeldig(c) {
  const a = c && c.aanbod;
  if (!a || a.schema !== 1) return false;
  const { hash: h, tekst, ...inhoud } = a;
  return typeof h === 'string' && h === hash(inhoud) && tekst === tekstVoor(inhoud) + '\nAanbodreferentie: ' + h &&
    a.contractId === c.id && a.accountId === c.accountId && a.aanmeldingId === c.aanmeldingId && a.pas === c.pas;
}
function publiek(c, motor) {
  return { ...motor.publiek(c), aanbod: kopie(c.aanbod), verrekening: kopie(c.verrekening),
    ondertekening: c.ondertekening ? kopie(c.ondertekening) : null, automatischAbonnement: true };
}
module.exports = { kopie, fout, object, canon, hash, invoer, prijsGeldig, scopeGeldig, creditGeldig,
  maakAanbod, aanbodGeldig, publiek };

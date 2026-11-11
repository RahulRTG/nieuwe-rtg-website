/* Versievaste offerte in het bestaande reisdomein. Geen tweede boekingsbron:
   onderdelen dragen providerverwijzingen; uitsluitend de aanbieder bevestigt
   of levert. Een juridische rol is een expliciete verklaring per transactie,
   geen door RTG afgeleide juridische kwalificatie. */
'use strict';
const { berichtHash: hash } = require('../lib/zegel');
const fout = (status, error) => ({ status, error });
const tekst = (v, max, meerdereRegels = false) => typeof v === 'string' && v.trim().length <= max &&
  !(meerdereRegels ? /[<>\x00-\x09\x0b\x0c\x0e-\x1f]/ : /[<>\x00-\x1f]/).test(v) ? v.trim() : '';
const kopie = v => JSON.parse(JSON.stringify(v));
const IDEM = /^[A-Za-z0-9_-]{8,100}$/;
const SOORTEN = new Set(['verblijf', 'vervoer', 'activiteit', 'dienst']);
const ROLLEN = new Set(['reisagent', 'touroperator', 'bemiddelaar', 'leverancier']);
const geldigeOfferte = o => { if (!o) return false; const { hash: afdruk, ...grond } = o; return hash(grond) === afdruk; };

function maakKetenofferte(data, verkoper, vorigeVersie, providerVan, nu) {
  const voorwaarden = tekst(data.voorwaarden, 4000, true);
  const geldig = typeof data.geldigTot === 'string' ? Date.parse(data.geldigTot) : NaN;
  if (!voorwaarden || !Number.isFinite(geldig) || geldig <= Date.parse(nu) ||
      geldig > Date.parse(nu) + 90 * 86400000 || data.valuta !== 'EUR')
    return fout(400, 'Een offerte vraagt voorwaarden, een geldige termijn (maximaal 90 dagen) en EUR.');
  const r = data.rollen || {};
  if (!ROLLEN.has(r.hoedanigheid) || !tekst(r.contractpartij, 160) ||
      !tekst(r.factureert, 160) || !tekst(r.aansprakelijk, 500, true))
    return fout(400, 'Leg hoedanigheid, contractpartij, facturerende partij en aansprakelijkheid expliciet vast.');
  if (!Array.isArray(data.onderdelen) || !data.onderdelen.length || data.onderdelen.length > 20)
    return fout(400, 'Een offerte bevat één tot twintig onderdelen.');
  const onderdelen = [], ids = new Set();
  for (const p of data.onderdelen) {
    if (!p || !/^[A-Za-z0-9_-]{1,50}$/.test(p.id || '') || ids.has(p.id) ||
        !tekst(p.wat, 160) || !SOORTEN.has(p.soort) || !tekst(p.productRef, 160) ||
        !Number.isSafeInteger(p.centen) || p.centen < 1 || p.centen > 10000000 ||
        !Number.isSafeInteger(p.verschuldigdCenten) || p.verschuldigdCenten < 0 ||
        p.verschuldigdCenten > p.centen)
      return fout(400, 'Een onderdeel vraagt een unieke id, productreferentie, soort en geldige centbedragen.');
    const provider = providerVan(p.supplierCode);
    if (!provider || provider.error) return provider || fout(503, 'De aanbieder kan niet worden gecontroleerd.');
    ids.add(p.id);
    onderdelen.push({ id: p.id, wat: tekst(p.wat, 160), soort: p.soort,
      productRef: tekst(p.productRef, 160), supplierCode: provider.supplierCode,
      org: provider.org, naam: provider.naam, centen: p.centen,
      verschuldigdCenten: p.verschuldigdCenten });
  }
  const grond = { schemaVersion: 1, versie: vorigeVersie + 1,
    verkoper: { org: verkoper.org, supplierCode: verkoper.supplierCode || null },
    rollen: { hoedanigheid: r.hoedanigheid, contractpartij: tekst(r.contractpartij, 160),
      factureert: tekst(r.factureert, 160), aansprakelijk: tekst(r.aansprakelijk, 500, true) },
    geldigTot: new Date(geldig).toISOString(), voorwaarden, valuta: 'EUR', onderdelen,
    totaalCenten: onderdelen.reduce((som, p) => som + p.centen, 0) };
  return { ok: true, offerte: { ...grond, hash: hash(grond) } };
}

function lidbeeld(a) {
  const k = a.keten, o = k.offerte;
  return { ref: a.ref, titel: a.titel, bestemming: a.bestemming, at: a.at,
    status: a.status, versie: k.versie, verkoper: { naam: k.verkoper.naam },
    offerte: o ? { versie: o.versie, hash: o.hash, geldigTot: o.geldigTot,
      voorwaarden: o.voorwaarden, rollen: kopie(o.rollen), totaalCenten: o.totaalCenten,
      valuta: o.valuta, onderdelen: o.onderdelen.map(p => ({ id: p.id, wat: p.wat,
        soort: p.soort, centen: p.centen, aanbieder: p.naam })) } : null,
    akkoord: k.akkoord ? { at: k.akkoord.at, offerteHash: k.akkoord.offerteHash } : null,
    leveringen: (k.leveringen || []).map(p => ({ id: p.id, wat: p.wat, status: p.status })),
    betaling: k.betaling ? { status: k.betaling.status, centen: k.betaling.centen,
      valuta: 'EUR', at: k.betaling.at } : null,
    nazorg: (k.nazorg || []).map(v => ({ id: v.id, soort: v.soort, status: v.status,
      offerteHash: v.offerteHash, offerteVersie: v.offerteVersie, onderdelen: v.onderdelen.slice(),
      toelichting: v.toelichting, at: v.at, uitvoering: v.uitvoering,
      financieleUitvoering: v.financieleUitvoering,
      antwoord: v.antwoord ? { soort: v.antwoord.soort, toelichting: v.antwoord.toelichting,
        bronRef: v.antwoord.bronRef, at: v.antwoord.at, bewijsSoort: v.antwoord.bewijsSoort,
        juridischGoedgekeurd: false } : null })),
    kwalificatie: 'ondersteund', operationeelBewezen: false, directBoekbaarBewezen: false };
}

function verkoperbeeld(a) {
  const k = a.keten;
  return { ...lidbeeld(a), codenaam: a.codename, offerte: k.offerte ? kopie(k.offerte) : null,
    leveringen: kopie(k.leveringen), gebeurtenissen: kopie(k.gebeurtenissen),
    aansluiting: { ontvangenCenten: k.betaling && k.betaling.status === 'betaald' ? k.betaling.centen : 0,
      verschuldigdCenten: k.offerte ? k.offerte.onderdelen.reduce((s, p) => s + p.verschuldigdCenten, 0) : 0,
      settlement: 'niet-gekwalificeerd', externeBetaalprovider: 'niet-gekoppeld',
      kostenbesparing: 'niet-gemeten' } };
}
module.exports = { fout, tekst, hash, kopie, IDEM, offerte: maakKetenofferte, geldigeOfferte, lidbeeld, verkoperbeeld };

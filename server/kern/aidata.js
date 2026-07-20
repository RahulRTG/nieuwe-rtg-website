/* Kern-module "aidata": de eigen-AI-dataset. Eén knop in de boardroom verzamelt
   alle logs die RTG nodig heeft om later een eigen model te trainen, in één
   JSONL-bestand (één JSON-regel per record -- het standaardformaat voor
   trainingspijplijnen).

   Wat erin gaat (en wat bewust niet):
   - GESPREKKEN: de Rahul-beurten van leden (vraag + antwoord, fluister-laag) en
     de intake-gesprekken van de ballotage. Dit is de kern: echte vraag-antwoord-
     paren in de eigen toon.
   - BESLUITEN: het boardroom-auditlog (wie deed wat) -- leert het model hoe RTG
     bestuurt.
   - TRANSACTIES: orders en boekingen als gebeurtenis (genre, status, bedrag) --
     leert het model hoe het huis loopt. Geen vrije tekst van derden.
   - KANTOORCHAT: de interne kamers -- de werktaal van het huis.
   PRIVACY BY DESIGN: alles draait al op codenamen/sleutels; de identiteitskluis
   (echte namen) wordt hier NOOIT aangeraakt. De export is dus per constructie
   pseudoniem. maakAidata(state) volgt het vaste kern-patroon. */

const MAX_PER_BRON = 50000; // begrensd: een export mag nooit de event-loop verdrinken

function maakAidata({ db, accounts }) {
  const d = () => db.data;

  function* gesprekken() {
    const fl = d().fluister || {};
    for (const [key, p] of Object.entries(fl))
      for (const g of (p && Array.isArray(p.gesprek)) ? p.gesprek : [])
        yield { soort: 'gesprek', bron: 'rahul', wie: key, vraag: g.u, antwoord: g.a, at: g.at || null };
  }
  function* intakes() {
    let rijen = [];
    try { rijen = accounts.conversations() || []; } catch (e) {}
    for (const r of rijen)
      for (const beurt of r.conversation || [])
        yield { soort: 'gesprek', bron: 'ballotage', wie: r.codename || r.id, rol: beurt.role || beurt.rol || null, tekst: beurt.text || beurt.content || beurt.tekst || null, tier: r.tier };
  }
  function* besluiten() {
    for (const a of d().kantoorAudit || [])
      yield { soort: 'besluit', bron: 'boardroom-audit', wie: a.wie, wat: a.wat, at: a.at || null };
  }
  function* transacties() {
    for (const o of d().orders || [])
      yield { soort: 'transactie', bron: 'order', wie: o.customerKey || o.customerTier || null, zaak: o.supplierCode || null, status: o.status || null, totaal: o.total != null ? o.total : o.price, at: o.at || null };
    for (const b of d().boekingen || [])
      yield { soort: 'transactie', bron: 'boeking', wie: b.customerKey || b.customerTier || null, zaak: b.supplierCode || null, status: b.status || null, totaal: b.total != null ? b.total : b.price, at: b.at || null };
  }
  function* kantoorchat() {
    for (const [kamer, rij] of Object.entries(d().kantoorChat || {}))
      for (const m of Array.isArray(rij) ? rij : [])
        yield { soort: 'gesprek', bron: 'kantoorchat', kamer, wie: m.naam, tekst: m.tekst, at: m.at || null };
  }
  // het RTG Bank-grootboek: geldstromen als gebeurtenis (rekeningen zijn al
  // pseudoniem: IBAN's en extern:/rtg:-tegenrekeningen, geen namen)
  function* bank() {
    for (const b of d().bankBoekingen || [])
      yield { soort: 'transactie', bron: 'bank', van: b.van, naar: b.naar, srt: b.soort, centen: b.centen, at: b.at || null };
  }
  // RTG Stad: sensormetingen per zone (per constructie zonder persoonsgegevens:
  // de stad meet dingen, geen mensen)
  function* stad() {
    for (const m of d().stadMetingen || [])
      yield { soort: 'meting', bron: 'stad', node: m.node, zone: m.zone, sens: m.sens, waarde: m.waarde, at: m.at || null };
  }

  const BRONNEN = { gesprekken, intakes, besluiten, transacties, kantoorchat, bank, stad };

  // het bord: hoeveel records elke bron nu oplevert (zelfde tellers als de export)
  function overzicht() {
    const telling = {};
    let totaal = 0;
    for (const [naam, gen] of Object.entries(BRONNEN)) {
      let n = 0;
      for (const _ of gen()) { if (++n >= MAX_PER_BRON) break; }
      telling[naam] = n; totaal += n;
    }
    return { status: 200, bronnen: telling, totaal, formaat: 'jsonl', privacy: 'codenamen; de identiteitskluis blijft dicht' };
  }

  /* De export zelf: één JSONL-string (regel per record), met een kop-record dat
     de snapshot beschrijft. Begrensd per bron; de teller in de kop zegt eerlijk
     of er iets is afgekapt. */
  function exportJsonl() {
    const regels = [];
    const telling = {};
    for (const [naam, gen] of Object.entries(BRONNEN)) {
      let n = 0;
      for (const rec of gen()) {
        if (n >= MAX_PER_BRON) break;
        regels.push(JSON.stringify(rec));
        n++;
      }
      telling[naam] = n;
    }
    const kop = { soort: 'meta', dataset: 'rtg-eigen-ai', at: new Date().toISOString(), bronnen: telling,
      privacy: 'alle records op codenaam/sleutel; echte namen staan in de gescheiden kluis en zitten hier niet in' };
    return { ok: true, jsonl: JSON.stringify(kop) + '\n' + regels.join('\n') + (regels.length ? '\n' : ''), aantal: regels.length, bronnen: telling };
  }

  return { aidataOverzicht: overzicht, aidataExport: exportJsonl };
}

module.exports = { maakAidata };

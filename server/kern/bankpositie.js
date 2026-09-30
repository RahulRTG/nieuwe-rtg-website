/* HET BANKSALDO VAN RTG -- handmatig, met het afschrift als herkomst.

   WAAROM DIT BESTAAT. RTG kende zijn eigen banksaldo niet (AUTONOMIE.md par. 5,
   punt 6): cash, liquiditeit en runway hadden daardoor geen bron. Besluit C4 van
   de eigenaar (27 september 2026): eerst handmatig, met het afschrift als bron; een
   bankkoppeling later, als eigen besluit met een contract.

   DRIE REGELS.

   1. GEEN BEDRAG ZONDER BRON. Zelfde regel als de huisrekening in kern/kosten: een
      saldo zonder "welk afschrift, van welke dag" is niet na te vertellen, en een
      runway die erop rust ook niet. De graad is daarom `vermoed` -- een mens tikte
      het over -- en nooit `gemeten`.
   2. OVERSCHRIJVEN LAAT DE VORIGE STAND STAAN. Een correctie vervangt het saldo van
      die maand, maar `vorige` blijft zichtbaar: er kan al iets op gebaseerd zijn.
   3. NIET ALLES OP DE BANK IS VRIJ GELD. RTG gaat eigen cadeaubonnen verkopen (C4);
      het geld van een verkochte bon staat op de bank maar is nog niet verdiend.
      Die verplichting komt uit het register van de bon zelf (kern/cadeaubon.js,
      C14) en wordt hier gelezen, niet overgetikt. Zolang RTG geen bonnen verkoopt,
      staat ze op nul MET die reden -- zodat een lezer ziet dat de plek er is en
      waarom hij leeg is, en niet denkt dat hij vergeten is. Bonnen die ZAKEN
      verkopen zijn van die zaak (kern/fiscaal) en tellen hier nooit mee: de
      firewall tussen de werelden laat ze niet als RTG-geld tellen.

   Wat dit NIET is: een boekhouding, een betaalweg of een koppeling. Er beweegt hier
   geen geld; er wordt opgeschreven wat er staat. */
'use strict';

const NAAM = 'rtgBankpositie';
const MAX_CENTEN = 100000000000;   // een miljard euro: een grens op het doel, niet op RTG
const BONNEN_REDEN = 'RTG verkoopt nog geen eigen cadeaubonnen (besluit C4): er staat geen verplichting uit.';
/* Zonder register (een losse toets, of de bon nog niet gemonteerd) geldt de oude
   reden; met register zegt de bon zelf wat hij verschuldigd is en waarom. */
const bonnenVan = (fn) => {
  try { const v = typeof fn === 'function' ? fn() : null; if (v && Number.isInteger(v.centen)) return { centen: v.centen, graad: v.graad || 'gemeten', reden: v.reden || null }; } catch (e) { /* valt terug */ }
  return { centen: 0, graad: 'gemeten', reden: BONNEN_REDEN };
};

module.exports = ({ db, save, nu, bonnen: bonnenBron }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/bankpositie', bezit: { [NAAM]: 'kaart' } });
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();
  const maandVan = (m) => (/^\d{4}-\d{2}$/.test(String(m || '')) ? String(m) : null);

  /* Het saldo aan het eind van een maand zetten. `peildatum` is de dag van het
     afschrift; die hoort in de maand te liggen. */
  function zet({ maand, centen, peildatum, bron, wie }) {
    const m = maandVan(maand);
    if (!m) return { status: 400, error: 'Kies een maand als 2026-09.' };
    if (!Number.isInteger(centen) || centen < -MAX_CENTEN || centen > MAX_CENTEN)
      return { status: 400, error: 'Het saldo is een heel aantal centen.' };
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(peildatum || '')) || String(peildatum).slice(0, 7) !== m)
      return { status: 400, error: 'De dag van het afschrift hoort in die maand te liggen, als 2026-09-30.' };
    const b = String(bron || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (b.length < 4) return { status: 400, error: 'Zeg waar het saldo vandaan komt: welk afschrift, van welke rekening.' };
    const kaart = eigen.bak(NAAM);
    const oud = kaart[m] || null;
    /* Hetzelfde saldo van hetzelfde afschrift nog een keer: er verandert niets, ook
       `vorige` niet -- anders wist een dubbelklik de echte vorige stand. */
    if (oud && oud.centen === centen && oud.peildatum === String(peildatum) && oud.bron === b)
      return { ok: true, ongewijzigd: true, stand: stand(m) };
    kaart[m] = { centen, peildatum: String(peildatum), bron: b, gezetOp: klok(),
      gezetDoor: String(wie || 'kantoor').slice(0, 80),
      vorige: oud ? { centen: oud.centen, peildatum: oud.peildatum, bron: oud.bron, gezetOp: oud.gezetOp } : null };
    save();
    return { ok: true, stand: stand(m) };
  }

  /* De stand van een maand, of van de laatste maand met een saldo. Lezen maakt
     niets aan. */
  function stand(maand) {
    const kaart = eigen.kijk(NAAM);
    const maanden = Object.keys(kaart).sort();
    const m = maandVan(maand) || maanden[maanden.length - 1] || null;
    const r = m ? kaart[m] : null;
    const bonnen = bonnenVan(bonnenBron);
    if (!r) return { maand: m, saldo: null, graad: 'onbekend', bonnenVerplichting: bonnen, vrij: null,
      reden: 'Er is voor deze maand geen saldo ingevoerd; er staat geen getal waar er geen is.' };
    return { maand: m, saldo: { centen: r.centen, peildatum: r.peildatum, bron: r.bron, gezetOp: r.gezetOp,
      gezetDoor: r.gezetDoor, vorige: r.vorige }, graad: 'vermoed', bonnenVerplichting: bonnen,
      vrij: { centen: r.centen - bonnen.centen, graad: 'vermoed' }, maanden };
  }

  return { bankpositieZet: zet, bankpositie: stand };
};

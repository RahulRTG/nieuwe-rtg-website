/* HET BESLISGEHEUGEN VAN RTG ALS ONDERNEMING -- besluit C13 van de eigenaar
   (28 september 2026), stap 10 van AUTONOMIE.md par. 7.

   DE VRAAG. "Wat besloten we, waarom, wat verwachtten we, en wat deden de
   getallen daarna?" Per besluit: wie besloot, op welke gronden (de bedrijfsmaten
   met hun graad OP DAT MOMENT), wat er verwacht werd, en na een vaste termijn wat
   diezelfde maten werkelijk deden.

   WAAROM NIET HET BESLUITGEHEUGEN VAN HET WERK OS (server/bedrijf/geheugen.js).
   Dat is het geheugen van een ZAAK in haar eigen werkruimte, achter de
   werkruimtepoort; dit gaat over RTG zelf en leest de bedrijfsmaten, die achter
   de boardroom staan. Die twee aan elkaar knopen zou de maten van RTG aan leden
   van een werkruimte tonen. Wat wel is overgenomen zijn de drie regels van dat
   geheugen, omdat ze over hetzelfde gaan -- wat is dit over drie jaar nog waard:
   1. EEN GROND DRAAGT WAT HIJ TOEN WAS. Niet alleen het id van een maat maar zijn
      stand, waarde, graad en eenheid van dat moment. Een maat wordt hergedefinieerd
      of een maand wordt gecorrigeerd -- en dan is "we besloten op marge X" geen
      antwoord meer zonder de X van toen.
   2. EEN BESLUIT VERDWIJNT NIET, HET WORDT INGETROKKEN MET EEN REDEN. Wie een
      besluit kan wissen, kan de geschiedenis herschrijven.
   3. ER WORDT NIETS GERADEN. Een maat die toen of nu geen getal had (onder de
      groepsgrens, niet uit te rekenen) krijgt geen oordeel maar een reden.

   WAT HET NIET DOET. De uitkomst is per maat en nooit opgeteld tot een cijfer
   voor het besluit (INT-04): een omzet die steeg koopt geen churn af die ook
   steeg. En de machine STELT NIETS VOOR uit dit geheugen -- er is geen functie
   die uit oude besluiten een nieuw besluit afleidt. Dat komt pas als er genoeg
   gegronde ketens zijn om er iets anders dan gissingen uit te leren.

   BEWAARD: zeven jaar, zoals de pasgeschiedenis. De tekst van een besluit is
   vrij; hij hoort over RTG te gaan en niet over een mens, en er staat daarom een
   lengtegrens op en geen veld voor een naam van een lid. */
'use strict';

const crypto = require('crypto');
const NAAM = 'beslisgeheugen';
const RICHTINGEN = Object.freeze(['omhoog', 'omlaag', 'gelijk']);
const BEWAAR_DAGEN = 7 * 366;
const DAG_MS = 86400000;

module.exports = ({ db, save, nu, bedrijfsmaat }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/beslisgeheugen', bezit: { [NAAM]: 'kaart' } });
  const klok = typeof nu === 'function' ? nu : () => new Date().toISOString();
  const maatVan = (stand, id) => ((stand && stand.maten) || []).find(x => x.id === id) || null;
  const grondVan = (m) => ({ id: m.id, stand: m.stand || null, waarde: typeof m.waarde === 'number' ? m.waarde : null,
    graad: m.graad || null, eenheid: m.eenheid || null });

  function leg({ besluit, verwachting, termijnDagen, wie }) {
    const tekst = String(besluit || '').replace(/[<>]/g, '').trim();
    if (tekst.length < 10 || tekst.length > 500) return { status: 400, error: 'Beschrijf het besluit in 10 tot 500 tekens.' };
    const v = Array.isArray(verwachting) ? verwachting : [];
    if (!v.length || v.length > 8) return { status: 400, error: 'Noem een tot acht bedrijfsmaten waarop dit besluit iets verwacht.' };
    const t = Number(termijnDagen);
    if (!Number.isInteger(t) || t < 30 || t > 366) return { status: 400, error: 'De termijn is 30 tot 366 dagen.' };
    if (!wie) return { status: 403, error: 'Een besluit legt een mens op naam vast, niet de gedeelde kantoorcode.' };
    const nuStand = bedrijfsmaat.stand({});
    const gronden = [], verwacht = [];
    for (const x of v) {
      const m = maatVan(nuStand, String((x && x.maat) || ''));
      if (!m) return { status: 400, error: 'Onbekende bedrijfsmaat: ' + String((x && x.maat) || '').slice(0, 60) + '.' };
      if (!RICHTINGEN.includes(x.richting)) return { status: 400, error: 'Een verwachting is omhoog, omlaag of gelijk.' };
      if (verwacht.some(y => y.maat === m.id)) return { status: 400, error: 'Elke maat een keer.' };
      gronden.push(grondVan(m));
      verwacht.push({ maat: m.id, richting: x.richting });
    }
    const op = klok();
    const kaart = eigen.bak(NAAM);
    ruimOp(kaart, op);
    /* hetzelfde besluit nog eens (een dubbelklik) is hetzelfde besluit, zolang het niet is ingetrokken */
    const zelfde = Object.entries(kaart).find(([, b]) => !b.ingetrokken && b.besluit === tekst && b.termijnDagen === t &&
      JSON.stringify(b.verwachting) === JSON.stringify(verwacht));
    if (zelfde) return { ok: true, ongewijzigd: true, besluit: vorm(zelfde[0], zelfde[1]) };
    const id = crypto.randomBytes(6).toString('hex');
    kaart[id] = { besluit: tekst, wie: String(wie).slice(0, 80), op, maand: nuStand.maand, gronden, verwachting: verwacht, termijnDagen: t,
      toetsOp: new Date(Date.parse(op) + t * DAG_MS).toISOString(), ingetrokken: null };
    save();
    return { ok: true, besluit: vorm(id, kaart[id]) };
  }

  function trekIn({ id, reden, wie }) {
    const r = String(reden || '').replace(/[<>]/g, '').trim().slice(0, 300);
    if (r.length < 4) return { status: 400, error: 'Een besluit trekt u in met een reden.' };
    if (!wie) return { status: 403, error: 'Intrekken doet een mens op naam.' };
    const b = eigen.bak(NAAM)[String(id || '')];
    if (!b) return { status: 404, error: 'Dat besluit staat niet in het geheugen.' };
    if (b.ingetrokken) return { ok: true, ongewijzigd: true, besluit: vorm(String(id), b) };
    b.ingetrokken = { op: klok(), wie: String(wie).slice(0, 80), reden: r };
    save();
    return { ok: true, besluit: vorm(String(id), b) };
  }

  function ruimOp(kaart, op) {
    const grens = Date.parse(op) - BEWAAR_DAGEN * DAG_MS;
    for (const [k, b] of Object.entries(kaart)) if (Date.parse(b.op) < grens) delete kaart[k];
  }

  /* De uitkomst per maat, uitgerekend bij het lezen uit de maand van de toets.
     Niets hiervan wordt opgeslagen: de maat is de bron, dit is een projectie. */
  function uitkomstVan(b) {
    if (klok() < b.toetsOp) return { stand: 'NOG_NIET', toetsOp: b.toetsOp };
    const toets = bedrijfsmaat.stand({ maand: b.toetsOp.slice(0, 7) });
    return { stand: 'GETOETST', maand: toets.maand, perMaat: b.verwachting.map(v => {
      const voor = b.gronden.find(g => g.id === v.maat), na = maatVan(toets, v.maat);
      const basis = { maat: v.maat, verwacht: v.richting, voor: voor.waarde, na: na && typeof na.waarde === 'number' ? na.waarde : null };
      if (!na) return Object.assign(basis, { gemeten: null, klopt: null, waarom: 'De maat bestaat niet meer.' });
      if (voor.waarde == null || basis.na == null || voor.stand !== 'TOONBAAR' || na.stand !== 'TOONBAAR')
        return Object.assign(basis, { gemeten: null, klopt: null, waarom: 'Toen of nu geen getal (' + (voor.stand || 'onbekend') + ' / ' + (na.stand || 'onbekend') + ').' });
      const gemeten = basis.na > voor.waarde ? 'omhoog' : basis.na < voor.waarde ? 'omlaag' : 'gelijk';
      return Object.assign(basis, { gemeten, klopt: gemeten === v.richting, graad: na.graad || null });
    }) };
  }

  const vorm = (id, b) => ({ id, besluit: b.besluit, wie: b.wie, op: b.op, maand: b.maand, gronden: b.gronden,
    verwachting: b.verwachting, toetsOp: b.toetsOp, ingetrokken: b.ingetrokken });

  /* Het geheugen, nieuwste eerst, met de uitkomst erbij. Lezen maakt niets aan. */
  const lijst = () => Object.entries(eigen.kijk(NAAM)).map(([id, b]) => Object.assign(vorm(id, b), { uitkomst: uitkomstVan(b) }))
    .sort((a, b) => (a.op < b.op ? 1 : a.op > b.op ? -1 : 0));

  return { beslisgeheugen: lijst, beslisgeheugenLeg: leg, beslisgeheugenTrekIn: trekIn, BESLIS_RICHTINGEN: RICHTINGEN };
};

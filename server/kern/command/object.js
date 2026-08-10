/* UNIVERSAL OBJECT CONTROL -- ieder object platformbreed openen.

   Eén dossier voor een zaak, een bestelling, een rit, een boeking, een
   voertuig of een melding: de feiten, wie ernaar verwijst, wat ermee gebeurd
   is en wat je ermee kunt doen.

   DE AFHANKELIJKHEDEN WORDEN GEMETEN, NIET OPGESCHREVEN. Een handgeschreven
   relatietabel ("een bestelling hangt aan een zaak") is binnen twee maanden
   onvolledig, want er komt een collectie bij die niemand in die tabel zet.
   Hier scant hij: welke records in ANDERE collecties dragen ergens de sleutel
   van dit object? Dat vindt echte verwijzingen, ook nieuwe, en het vindt er
   nooit een die er niet is.

   De prijs daarvan is een scan, en die is begrensd: MAX_SCAN rijen per
   collectie, en wat daarboven ligt wordt gemeld en niet stil weggelaten.

   DE ACTIES DRAGEN HUN NIVEAU. Elke actie zegt of hij met de hand, met hulp of
   autonoom mag -- de ontwerpregel van deze hele laag. Wat dat per actie is,
   bepaalt ./risico.js uit het beleid en niet dit bestand: anders zou het
   risico-oordeel op twee plekken staan. */
'use strict';

const { s } = require('./register');

const MAX_SCAN = 20000;
const MAX_PER_SOORT = 8;

/* Welke velden van een record laat je zien? Alles behalve wat groot of
   gevoelig is: een dossier dat een base64-foto of een lijst van 900 kamers
   uitprint is onleesbaar, en een dossier dat een e-mailadres toont omzeilt de
   kluis. Objecten en arrays worden samengevat, niet uitgeklapt. */
/* `rtgKey` staat erbij sinds de werkruimtelaag mensen in haar register zette.
   Dat veld koppelt een medewerker van een organisatie aan zijn PERSOONLIJKE
   RTG-account; een dossier dat het uitprint, legt buiten de kluis om een
   verband tussen twee identiteiten dat juist gescheiden hoort te blijven. */
const VERBORGEN = new Set(['email', 'e-mail', 'realName', 'naamEcht', 'wachtwoord', 'password', 'token', 'secret', 'iban', 'foto', 'image', 'avatar', 'rtgKey']);

function feiten(r) {
  const uit = [];
  for (const [k, v] of Object.entries(r || {})) {
    if (VERBORGEN.has(k)) { uit.push({ veld: k, waarde: '- in de kluis -', kluis: true }); continue; }
    if (v == null || v === '') continue;
    if (Array.isArray(v)) { uit.push({ veld: k, waarde: v.length + ' stuk(s)', lijst: true }); continue; }
    if (typeof v === 'object') { uit.push({ veld: k, waarde: Object.keys(v).slice(0, 6).join(', '), lijst: true }); continue; }
    const t = s(v);
    uit.push({ veld: k, waarde: t.length > 160 ? t.slice(0, 160) + '…' : t });
  }
  return uit;
}

/* De afhankelijkhedengraaf van één object: wie noemt hem, en waar. */
function afhankelijkheden(reg, db, soort, r) {
  const sleutels = new Set(reg.verwijzingen(soort, r).map(v => v.toLowerCase()).filter(v => v.length >= 3));
  if (!sleutels.size) return { groepen: [], onvolledig: false };
  const groepen = [];
  let onvolledig = false;
  for (const ander of reg.SOORTEN) {
    const alle = reg.rijen(db, ander);
    const gekeken = Math.min(alle.length, MAX_SCAN);
    if (alle.length > gekeken) onvolledig = true;
    const raak = [];
    for (let i = 0; i < gekeken && raak.length < MAX_PER_SOORT * 4; i++) {
      const q = alle[i];
      if (!q || (ander.type === soort.type && s(q[ander.sleutel]) === s(r[soort.sleutel]))) continue;
      let veld = '';
      for (const [k, v] of Object.entries(q)) {
        if (v == null || typeof v === 'object') continue;
        if (sleutels.has(s(v).toLowerCase())) { veld = k; break; }
      }
      if (veld) raak.push(Object.assign(reg.kort(ander, q), { via: veld }));
    }
    if (raak.length) groepen.push({ type: ander.type, label: ander.label, meervoud: ander.meervoud,
      domein: ander.domein, totaal: raak.length, rijen: raak.slice(0, MAX_PER_SOORT) });
  }
  return { groepen, onvolledig };
}

/* De tijdlijn: wat er rond dit object gebeurde. Twee bronnen, in één lijn:
   - het journaal dat de aanroeper meegeeft (elke ingreep die daarin staat);
   - de tijdstempels die het record zelf draagt (aangemaakt, betaald, gewijzigd).
   Meer bronnen komen erbij zodra ze bestaan; de vorm is dan dezelfde. */
const TIJDVELDEN = [['at', 'aangemaakt'], ['created_at', 'aangemaakt'], ['createdAt', 'aangemaakt'],
  ['paidAt', 'betaald'], ['betaaldOp', 'betaald'], ['updatedAt', 'gewijzigd'], ['bijgewerkt', 'gewijzigd'],
  ['afgerondOp', 'afgerond'], ['annuleerdOp', 'geannuleerd']];

/* `bron` benoemt WELK journaal de regels leverde. Standaard 'command', want dat
   is waar deze laag begon; de werkruimtelaag geeft er 'werkruimte' mee. Dat is
   geen cosmetica: die twee journalen dekken verschillende handelingen, en een
   regel die "command" heet terwijl hij uit een werkruimte komt, laat een lezer
   denken dat de dekking van het ene journaal die van het andere is. */
function tijdlijn(soort, r, journaal, bron) {
  const lijn = [];
  for (const [veld, wat] of TIJDVELDEN) {
    const v = r[veld];
    if (v) lijn.push({ at: s(v), wat, bron: 'record', veld });
  }
  for (const j of journaal.overObject(soort.type, s(r[soort.sleutel]))) {
    lijn.push({ at: j.at, wat: j.actie, bron: bron || 'command', door: j.actor, reden: j.reden,
      niveau: j.niveau, uitslag: j.uitslag, id: j.id });
  }
  lijn.sort((a, b) => s(b.at).localeCompare(s(a.at)));
  return lijn;
}

/* Het complete dossier. `acties` komt van buiten (risico.js kent het beleid),
   zodat dit bestand niets over risico hoeft te weten. */
function dossier(reg, db, type, id, { journaal, actiesVoor, bron }) {
  const soort = reg.OP_TYPE.get(String(type));
  if (!soort) return { error: 'Onbekende soort: ' + type, status: 404 };
  const r = reg.vindRij(db, soort.type, id);
  if (!r) return { error: 'Niet gevonden: ' + type + ' ' + id, status: 404 };
  const k = reg.kort(soort, r);
  const afh = afhankelijkheden(reg, db, soort, r);
  return {
    object: k,
    feiten: feiten(r),
    afhankelijkheden: afh.groepen,
    afhankelijkhedenOnvolledig: afh.onvolledig,
    tijdlijn: tijdlijn(soort, r, journaal, bron),
    acties: actiesVoor ? actiesVoor(k, r) : []
  };
}

module.exports = { dossier, feiten, afhankelijkheden, tijdlijn };

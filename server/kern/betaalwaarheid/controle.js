/* Een betaling op controle afronden: alleen een mens op naam, met een reden.

   CONTROLE_NODIG heeft in ./staten.js geen enkele uitgaande overgang, en dat
   blijft zo: naar() haalt een betaling daar nooit uit, ook niet als een
   provider alsnog iets meldt of de veegronde langskomt. Maar een geweigerde
   terugbetaling zet de HELE betaling op controle (kop van ./terug.js), en
   zonder uitgang bleef een tweede ticket onder dezelfde betaling voor altijd
   staan. Eigenaarsbesluit van 19 oktober 2026 (derde reeks): een mens die
   keek, rondt de controle af en zet de betaling terug op de laatste
   DEFINITIEVE stand voor de controle. Daarvoor is deze ene weg, buiten naar()
   om, met naam, tijd en reden in de gebeurtenissen.

   Wat hij niet doet: een opdracht die op controle staat bijzetten (die blijft
   staan als bewijs van de weigering), geld boeken, of een betaling die nooit
   bevestigd was alsnog bevestigen -- daar is geen definitieve stand om naar
   terug te gaan, en dat zou een betaling verzinnen. */
'use strict';
const staten = require('./staten');

/* De laatste definitieve RUSTstand voor de jongste overgang naar controle, of
   null. TERUGBETALING_WACHT telt in definitiefBetaald mee, maar is geen
   rustpunt: er liep toen een terugbetaling, en die is juist geweigerd.
   Puur: de betaalkamer (kern/betaalregie-waarheid.js) leest dezelfde regel. */
const S = staten.STATUS;
const RUST = new Set([S.BEVESTIGD, S.GEDEELTELIJK_TERUGBETAALD, S.TERUGBETAALD]);
function standVoorControle(r) {
  const g = (r && r.gebeurtenissen) || [];
  let i = g.length - 1;
  while (i >= 0 && !(g[i].soort === 'STATUS' && g[i].naar === S.CONTROLE_NODIG)) i--;
  for (i -= 1; i >= 0; i--) if (g[i].soort === 'STATUS' && RUST.has(g[i].naar)) return g[i].naar;
  return null;
}

module.exports = function controlelaag({ doos, save, nuIso, gebeurtenis, STATUS }) {
  async function controleAfronden({ betalingId, door, reden } = {}) {
    const wie = String(door || '').trim(), waarom = String(reden || '').trim();
    if (!wie) return { status: 403, error: 'Een controle rondt een mens op naam af.' };
    if (waarom.length < 10) return { status: 400, error: 'Schrijf op wat u heeft nagekeken (minstens tien tekens).' };
    const r = doos()[String(betalingId || '')];
    if (!r) return { status: 404, error: 'Deze betaling bestaat niet.' };
    if (r.status !== STATUS.CONTROLE_NODIG) return { status: 409, error: 'Deze betaling staat niet op controle.' };
    const terugNaar = standVoorControle(r);
    if (!terugNaar)
      return { status: 409, error: 'Deze betaling was nooit bevestigd; er is geen stand om naar terug te gaan.' };
    r.controleAfgerond = { door: wie, at: nuIso(), reden: waarom.slice(0, 300), blokkade: r.blokkade || null, naar: terugNaar };
    delete r.blokkade;
    r.status = terugNaar;
    gebeurtenis(r, 'STATUS', { van: STATUS.CONTROLE_NODIG, naar: terugNaar, bron: 'mens', door: wie });
    gebeurtenis(r, 'CONTROLE_AFGEROND', { door: wie, naar: terugNaar });
    save();
    return { ok: true, betalingId: r.id, stand: r.status };
  }

  return { controleAfronden };
};
module.exports.standVoorControle = standVoorControle;

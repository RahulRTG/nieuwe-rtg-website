/* RTG Wallet: een plek voor alles wat een lid bij zich draagt. Pasjes
   (zoals de zorgpas), tickets, sleutels, feestmunten met een saldo en
   klantenkaarten. Systemen leggen er automatisch passen in (via
   walletVoeg, met een bron zodat ze bij intrekken ook weer netjes
   verdwijnen); het lid voegt zelf klantenkaarten, tickets en sleutels
   toe en beheert de eigen portemonnee. Munten zijn een saldo-item per
   zaak: kopen verhoogt, inwisselen verlaagt, en onder nul kan nooit.
   Opslag per lid in db.data.wallet[key]; maakWallet(state) volgt het
   vaste kern-patroon. */

const SOORTEN = ['pas', 'ticket', 'sleutel', 'munt', 'klantenkaart'];
const ZELF_SOORTEN = ['ticket', 'sleutel', 'klantenkaart'];
const MAX_ITEMS = 100;
const MUNT_PRIJS = 3.5;

function maakWallet({ db, save, crypto, schoon }) {
  const nu = () => new Date().toISOString();
  const id = () => 'w' + crypto.randomBytes(5).toString('hex');

  function bak(key) {
    if (!db.data.wallet || typeof db.data.wallet !== 'object') db.data.wallet = {};
    if (!Array.isArray(db.data.wallet[key])) db.data.wallet[key] = [];
    return db.data.wallet[key];
  }

  /* ---- de systeem-kant: een pas erin leggen of weer weghalen ---- */
  function voeg(key, item) {
    const items = bak(key);
    if (items.length >= MAX_ITEMS) return null;
    const d = { id: id(), soort: SOORTEN.includes(item.soort) ? item.soort : 'pas',
      titel: schoon(item.titel, 80) || 'Pas', code: schoon(item.code, 40) || '',
      bron: schoon(item.bron, 40) || 'systeem', geldigTot: schoon(item.geldigTot, 10) || null,
      saldo: item.saldo != null ? Math.max(0, Math.round(Number(item.saldo))) : null,
      sinds: nu() };
    items.unshift(d);
    save();
    return d;
  }
  function wegBron(key, bron, code) {
    const items = bak(key);
    const voor = items.length;
    db.data.wallet[key] = items.filter(x => !(x.bron === bron && (!code || x.code === code)));
    if (db.data.wallet[key].length !== voor) save();
    return voor - db.data.wallet[key].length;
  }

  /* ---- de leden-kant ---- */
  function lijst(key) {
    const items = bak(key);
    const perSoort = {};
    for (const s of SOORTEN) perSoort[s] = items.filter(x => x.soort === s);
    return { status: 200, items, perSoort, soorten: SOORTEN, muntPrijs: MUNT_PRIJS };
  }
  function voegZelf(key, b) {
    const soort = ZELF_SOORTEN.includes(b.soort) ? b.soort : 'klantenkaart';
    const titel = schoon(b.titel, 80), code = schoon(b.code, 40);
    if (!titel) return { status: 400, error: 'Geef het een naam (bijv. de winkel of het event).' };
    if (!code) return { status: 400, error: 'Wat is de kaart- of ticketcode?' };
    if (bak(key).length >= MAX_ITEMS) return { status: 409, error: 'De wallet zit vol; ruim eerst iets op.' };
    const d = voeg(key, { soort, titel, code, bron: 'zelf' });
    return { status: 200, ok: true, item: d };
  }
  function weg(key, itemId) {
    const items = bak(key);
    const voor = items.length;
    db.data.wallet[key] = items.filter(x => x.id !== String(itemId || ''));
    if (db.data.wallet[key].length === voor) return { status: 404, error: 'Dit zit niet in uw wallet.' };
    save();
    return { status: 200, ok: true };
  }

  /* ---- feestmunten: een saldo per zaak, nooit onder nul ---- */
  function muntKoop(key, b) {
    const zaak = schoon(b.zaak, 60);
    const aantal = Math.round(Number(b.aantal));
    if (!zaak) return { status: 400, error: 'Bij welke zaak of welk feest horen de munten?' };
    if (!(aantal >= 1 && aantal <= 100)) return { status: 400, error: 'Koop 1 tot 100 munten tegelijk.' };
    const items = bak(key);
    let m = items.find(x => x.soort === 'munt' && x.titel === 'Feestmunten · ' + zaak);
    if (!m) {
      if (items.length >= MAX_ITEMS) return { status: 409, error: 'De wallet zit vol; ruim eerst iets op.' };
      m = voeg(key, { soort: 'munt', titel: 'Feestmunten · ' + zaak, code: 'M-' + crypto.randomBytes(2).toString('hex').toUpperCase(), bron: 'munt', saldo: 0 });
    }
    m.saldo += aantal;
    save();
    return { status: 200, ok: true, item: m, prijs: Math.round(aantal * MUNT_PRIJS * 100) / 100 };
  }
  function muntWissel(key, b) {
    const items = bak(key);
    const m = items.find(x => x.id === String(b.id || '') && x.soort === 'munt');
    if (!m) return { status: 404, error: 'Deze munten zitten niet in uw wallet.' };
    const aantal = Math.max(1, Math.round(Number(b.aantal) || 1));
    if (m.saldo < aantal) return { status: 409, error: 'Niet genoeg munten (saldo ' + m.saldo + ').' };
    m.saldo -= aantal;
    save();
    return { status: 200, ok: true, item: m };
  }

  return { walletVoeg: voeg, walletWegBron: wegBron,
    wallet: { lijst, voegZelf, weg, muntKoop, muntWissel } };
}

module.exports = { maakWallet };

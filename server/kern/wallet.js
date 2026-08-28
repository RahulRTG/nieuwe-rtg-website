/* RTG Wallet: een plek voor alles wat een lid bij zich draagt. Pasjes
   (zoals de zorgpas), tickets, sleutels, feestmunten met een saldo en
   klantenkaarten. Systemen leggen er automatisch passen in (via
   walletVoeg, met een bron zodat ze bij intrekken ook weer netjes
   verdwijnen); het lid voegt zelf klantenkaarten, tickets en sleutels
   toe en beheert de eigen portemonnee. Munten zijn een saldo-item per
   zaak: kopen verhoogt, inwisselen verlaagt, en onder nul kan nooit.
   Opslag per lid in db.data.wallet[key]; maakWallet(state) volgt het
   vaste kern-patroon.

   DE FEESTMUNT WERD NIET BETAALD. muntKoop() verhoogde het saldo en gaf een
   `prijs` terug -- en dat was alles: er ging geen boeking langs RTG Pay, er
   werd niets geind, en het scherm toonde een prijs die niemand ooit betaalde.
   Een munt met een saldo die uit het niets ontstaat, is precies wat het
   pay-grootboek een laag hoger verbiedt ("geld ontstaat nooit uit het niets"),
   en hij ontstond hier honderd stuks tegelijk.

   Kopen loopt daarom via pay.huisIn: het geld gaat van de wallet van het lid
   naar de huisrekening (extern:treasury), met autolaad eromheen zoals elk
   ander geld-moment in dit huis. INWISSELEN boekt met opzet niets terug -- het
   geld is bij de aankoop al betaald, en de munt inleveren is besteden, geen
   verkoop. */

const SOORTEN = ['pas', 'ticket', 'sleutel', 'munt', 'klantenkaart'];
const ZELF_SOORTEN = ['ticket', 'sleutel', 'klantenkaart'];
const MAX_ITEMS = 100;
const MUNT_PRIJS = 3.5;

function maakWallet({ db, save, crypto, schoon, pay, codenaamVan }) {
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
  async function muntKoop(key, b) {
    const zaak = schoon(b.zaak, 60);
    const aantal = Math.round(Number(b.aantal));
    if (!zaak) return { status: 400, error: 'Bij welke zaak of welk feest horen de munten?' };
    if (!(aantal >= 1 && aantal <= 100)) return { status: 400, error: 'Koop 1 tot 100 munten tegelijk.' };
    const items = bak(key);
    const titel = 'Feestmunten · ' + zaak;
    let m = items.find(x => x.soort === 'munt' && x.titel === titel);
    /* DE VOLLE WALLET WORDT VOOR DE KASSA GECONTROLEERD en niet erna. Zou dat
       omgekeerd staan, dan betaalt het lid en krijgt het daarna te horen dat de
       munten er niet meer bij passen -- geld weg, niets terug. */
    if (!m && items.length >= MAX_ITEMS) return { status: 409, error: 'De wallet zit vol; ruim eerst iets op.' };
    const codenaam = codenaamVan && codenaamVan(key);
    if (!codenaam) return { status: 403, error: 'Voor feestmunten hoort een wallet bij uw account.' };
    const centen = Math.round(aantal * MUNT_PRIJS * 100);
    const betaald = await pay.huisIn({ vanCodenaam: codenaam, centen, oms: titel, idem: schoon(b.idem, 60) || null });
    if (betaald.error) return betaald;
    /* Pas NA de betaling ontstaan de munten. voeg() kan hier niet meer op null
       lopen: de wallet-ruimte is hierboven al gecontroleerd en er is sindsdien
       niets aan deze bak toegevoegd. */
    if (!m) m = voeg(key, { soort: 'munt', titel, code: 'M-' + crypto.randomBytes(2).toString('hex').toUpperCase(), bron: 'munt', saldo: 0 });
    m.saldo += aantal;
    save();
    return { status: 200, ok: true, item: m, prijs: centen / 100, betaaldCenten: centen, bijgeladen: betaald.bijgeladen || 0 };
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

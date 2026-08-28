/* Lidacties (deelmodule): BESTELLEN bij een partner -- plaatsOrderVoor, met de
   ledenprijsgarantie, 86 van de keuken, de alcohol/leeftijdsgrens, het
   zorgprofiel en het betaalmoment van de zaak.

   BETALEN staat in ./betalen.js en de gezamenlijke rekening in ./rekening.js;
   dit bestand hangt ze alle drie aan dezelfde ctx op. Krijgt die context een
   keer bij het opstarten vanuit kern/lidacties.js. */
const { servicekostenVoor } = require('../servicekosten');

module.exports = (ctx) => {
  /* De namen die BETALEN nodig had (fooiUit, pasTegoedToe, verdienPunten,
     ledenvoordeelVoor, orderMetRef, factuurVoorLid) staan hier niet meer: die
     zijn met betaalOrderVoor mee naar ./betalen.js gegaan. */
  const { db, save, crypto, schoon, PERSONAS, findSupplier, ledenPrijs, optieAan,
    leeftijdVan, geborenVan, idGeverifieerd, alcoholGrensVan, pickupCode, entreeCode, ticketsVoorSlot,
    liveCodename, haversine, pushLive,
    notifySupplier, sseToSupplier, sseToOffice, zorgVoor, zorgContact, keuken,
    ordersVoegToe, boekingMetRef, boekingenVoegToe, openLijnVoor } = ctx;
function plaatsOrderVoor(session, body) {
  // betalen bij partners mag ook zonder pas (gratis gebruiker)
  const s = findSupplier(body.supplierCode);
  if (!s) return { status: 404, error: 'Leverancier niet gevonden.' };
  if (s.settings && s.settings.ordersOpen === false) return { status: 409, error: s.name + ' neemt op dit moment geen bestellingen aan.' };
  const wanted = Array.isArray(body.items) ? body.items : [];
  const items = [];
  let total = 0;
  for (const w of wanted) {
    const m = (s.menu || []).find(x => x.id === w.id);
    const qty = Math.min(20, Math.max(1, parseInt(w.qty, 10) || 1));
    // 86 van het keukenscherm: een uitverkocht gerecht is per direct niet te bestellen
    if (m && m.uitverkocht) return { status: 409, error: m.name + ' is helaas uitverkocht (86 gemeld door de keuken).' };
    // ledenprijsgarantie: reken nooit meer dan de publieke prijs, ook al zou
    // de menuprijs door een fout hoger staan (extra vangnet na het opslaan)
    if (m) { const unit = ledenPrijs(m.publiekePrijs, m.price); items.push({ id: m.id, name: m.name, qty, price: unit }); total += unit * qty; }
  }
  if (!items.length) return { status: 400, error: 'Geen geldige gerechten gekozen.' };
  const codename = session.account ? session.account.codename : PERSONAS[session.tier].codename;
  // leeftijd uit het paspoort: alcohol (bar-items) alleen boven de grens van
  // het land van de zaak; de partner ziet enkel dat de leeftijd geverifieerd is.
  // Zonder RTG-geverifieerd ID geldt de STANDAARD "onder de 18": een onbekende
  // of ongeverifieerde leeftijd telt dus als te jong, nooit als volwassen.
  const lft = idGeverifieerd(session) ? leeftijdVan(geborenVan(session)) : null;
  /* `m.alcohol` en niet `m.station`: de werkplek zegt waar iets wordt gemaakt,
     niet wat erin zit. Zie kern/supplierdefaults.js -- in een bar of club kreeg
     elk item de werkplek 'bar', en dan telde een Virgin Colada 0% als alcohol. */
  const metAlcohol = items.some(it => { const m = (s.menu || []).find(x => x.id === it.id); return !!(m && m.alcohol); });
  if (metAlcohol) {
    const a = alcoholGrensVan(s);
    if (lft == null) return { status: 403, error: 'Zonder geverifieerde leeftijd geldt de standaard "onder de 18": alcohol kan niet. Laat uw identiteit verifieren, of kies iets zonder alcohol.' };
    if (lft < a.grens) return { status: 403, error: 'Alcohol is in ' + a.land + ' vanaf ' + a.grens + ' jaar; je leeftijd is via je paspoort geverifieerd. Kies iets zonder alcohol.' };
  }
  // zorg-/allergieveiligheid: keur gerechten af die botsen met het allergieprofiel
  // van het lid (een allergeen van het gerecht staat in de eigen allergenenlijst),
  // tenzij het lid bewust doorzet. De menukaart, de kassa EN Rahul roepen dezelfde
  // /api/order, dus ze weigeren dit allemaal automatisch. Dieet en medische
  // aandachtspunten reizen als context mee naar de keuken.
  const zorg = zorgVoor(session.key);
  if (zorg && (zorg.allergenen || []).length && !body.allergieAkkoord) {
    const eigen = zorg.allergenen.map(a => String(a).toLowerCase());
    const botsers = [];
    for (const it of items) {
      const m = (s.menu || []).find(x => x.id === it.id);
      const raak = ((m && m.allergens) || []).filter(a => eigen.includes(String(a).toLowerCase()));
      if (raak.length) botsers.push({ id: it.id, naam: it.name, allergenen: raak });
    }
    if (botsers.length) return {
      status: 409,
      error: 'Dit botst met je allergieprofiel: ' + botsers.map(b => b.naam + ' (' + b.allergenen.join(', ') + ')').join('; ') + '. Kies iets anders, of bevestig bewust dat je het toch wilt.',
      allergieBotsing: botsers
    };
  }
  // de zaak kiest het betaalmoment: vooraf (standaard, pas zichtbaar na
  // afrekenen) of achteraf (direct zichtbaar, betalen via de app volgt);
  // jeugdleden (15-17) betalen altijd vooraf, ook bij een achteraf-zaak.
  // "Naar de kassa": het lid kiest zelf om de bestelling nu te laten maken en
  // straks aan de balie af te rekenen (met de ophaalcode); dit gaat voor op de
  // vooraf-voorkeur van de zaak, behalve bij jeugdleden.
  const jeugd = lft == null || lft < 18; // onbekend/ongeverifieerd = standaard onder de 18
  const naarKassa = !!body.naarKassa && !jeugd;
  const vooraf = jeugd || (!naarKassa && optieAan(s, 'betaalVooraf'));
  /* Servicekosten voor niet-leden: een gratis account betaalt EUR 2,50 ex btw
     per etensbestelling; leden betalen dit nooit.

     Het bedrag stond hier DRIE keer: exBtw 2.5, inBtw 3.03 (met de hand
     uitgerekend), en nog eens als tekst in de app -- "(incl. EUR 2,50
     servicekosten ex btw voor niet-leden)". Wie het tarief wijzigde, kreeg een
     bevestigingsscherm dat het oude bedrag noemde bij een nieuw totaal. Nu
     staat het er een keer en volgt de rest eruit; de app leest het uit deze
     velden in plaats van het te herhalen. */
  let servicekosten;
  if (session.tier === 'guest') {
    const exBtw = 2.5, btwPct = 21;
    servicekosten = { exBtw, btwPct, inBtw: Math.round(exBtw * (1 + btwPct / 100) * 100) / 100 };
    total = Math.round((total + servicekosten.inBtw) * 100) / 100;
  }
  const order = {
    ref: 'RTG-O-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
    pickup: pickupCode(),
    supplierCode: s.code, supplierName: s.name, type: s.type,
    customerTier: session.tier, customerKey: session.key, customerCodename: codename,
    items, total,
    // alleen als er echt iets te melden is: een lid krijgt geen veld, geen nul
    ...(servicekosten ? { servicekosten } : {}),
    table: schoon(body.table, 24),
    allergyNote: schoon(body.allergyNote, 200),
    // het zorgprofiel reist automatisch mee naar de keuken (alleen met toestemming)
    zorg: zorg,
    allergieAkkoord: body.allergieAkkoord ? true : undefined,
    tagSalon: !!body.tagSalon,
    betaalMoment: vooraf ? 'vooraf' : 'achteraf',
    aanBalie: naarKassa ? true : undefined,
    leeftijdOk: metAlcohol && lft != null ? true : undefined,
    status: vooraf ? 'wacht-op-betaling' : 'nieuw', paid: false, at: new Date().toISOString()
  };
  ordersVoegToe(order);
  openLijnVoor(s, session);
  save();
  if (!vooraf) {
    const kop = naarKassa ? 'Nieuwe bestelling (afrekenen aan de kassa)' : 'Nieuwe bestelling (betaling achteraf)';
    notifySupplier(s.code, { icon: 'hotel', title: kop, body: codename + (order.table ? ' · ' + order.table : '') + ', ' + items.reduce((n, i) => n + i.qty, 0) + ' item(s), € ' + total + (order.allergyNote ? ' · allergie: ' + order.allergyNote : '') });
    sseToSupplier(s.code, 'sync', { scope: 'orders' });
    sseToOffice('sync', { scope: 'orders' });
  }
  return { ok: true, order };
}

  /* Betalen woont in ./betalen.js en "de rekening" (betalen na het eten) in
     ./rekening.js, zodat alle drie de bestanden in de 5-10 KB-band blijven. Ze
     draaien op dezelfde ctx, dus er is geen tweede kopie van iets. */
  const { betaalOrderVoor } = require('./betalen')(ctx);
  return { plaatsOrderVoor, betaalOrderVoor };
};

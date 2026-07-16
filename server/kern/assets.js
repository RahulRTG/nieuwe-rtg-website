/* Toren 3: RTG Shared Assets. Jets, jachten en villa's in een besloten pool
   van altijd precies 300 tickets per object. Een ticket = 24 uur gebruik per
   jaar, tien jaar lang. Twee smaken:

   - RTG Access (de consument): vaste prijs, de dagenteller reset elk jaar en
     na tien jaar is het klaar. Geen nazorg, geen berekeningen.
   - RTG Asset (de entrepreneur): hetzelfde gebruiksrecht, plus een aandeel in
     de reele restwaarde van het object (waarde / 300). Uitstappen kan altijd:
     RTG betaalt de actuele ticketwaarde uit via een Tik.

   De leden financieren zo de vloot en de stenen (werkkapitaal vooraf), en
   zitten voor jaren aan het ecosysteem: hun nachten en vlieguren zijn al
   ingekocht. Alleen voor betalende leden (RTG, Lifestyle en Business Pass). */
const TICKETS_PER_OBJECT = 300;
const UREN_PER_TICKET = 24;   // per jaar
const JAREN_GELDIG = 10;
const BETALENDE_PASSEN = ['rtg', 'lifestyle', 'business'];
/* De prijzen van de twee smaken zijn een formule op de objectwaarde, zodat
   ze automatisch meebewegen als RTG-kantoor het object hertaxeert:
   - Access = 25% van de ticketwaarde: je koopt alleen het gebruik, geen
     restwaarde, na tien jaar is het klaar.
   - Asset = ticketwaarde + 15% pool-premie: je koopt het gebruik EN het
     aandeel in het object; de premie dekt beheer en onderhoud van de pool. */
const ACCESS_FACTOR = 0.25;
const ASSET_FACTOR = 1.15;
const netjes = n => Math.round(n / 100) * 100; // prijzen op honderden

module.exports = ({ db, save, crypto, schoon, notify, pay }) => {
  const nu = () => new Date().toISOString();
  const lijsten = () => {
    if (!db.data.assetTickets) db.data.assetTickets = [];   // gekochte tickets, per lid en object
    if (!db.data.assetGebruik) db.data.assetGebruik = [];   // geboekte 24-uursblokken
    if (!Array.isArray(db.data.sharedAssets) || !db.data.sharedAssets.length) {
      db.data.sharedAssets = [
        { id: 'sa-jet', naam: 'Aria One, Gulfstream G650', soort: 'privejet', icon: '✈️', waar: 'Thuisbasis Schiphol Oost',
          beschrijving: 'Volledig bemand, wereldwijd inzetbaar. Uw 24 uur is een retour binnen Europa of een enkele reis intercontinentaal.',
          waarde: 42000000 },
        { id: 'sa-jacht', naam: 'Azul Horizon, 34 meter', soort: 'jacht', icon: '🛥️', waar: 'Marina Botafoc, Ibiza',
          beschrijving: 'Met schipper en hostess. Uw 24 uur is een dag en een nacht op zee, Es Vedra bij zonsondergang inbegrepen.',
          waarde: 9000000 },
        { id: 'sa-villa', naam: 'Sunset Beach Villa', soort: 'villa', icon: '🏖️', waar: 'Cala Conta, Ibiza',
          beschrijving: 'Zes slaapkamers, eigen strandpad, dagelijkse housekeeping. Uw 24 uur is een volledige nacht met late check-out.',
          waarde: 6000000 }
      ];
    }
  };
  const objectVan = id => (db.data.sharedAssets || []).find(a => a.id === String(id || ''));
  const ticketWaarde = a => Math.round(a.waarde / TICKETS_PER_OBJECT);
  const prijsAccessVan = a => netjes(ticketWaarde(a) * ACCESS_FACTOR);
  const prijsAssetVan = a => netjes(ticketWaarde(a) * ASSET_FACTOR);
  const actieveVan = assetId => db.data.assetTickets.filter(t => t.assetId === assetId && t.status === 'actief');
  const magKopen = sess => BETALENDE_PASSEN.includes(sess.tier);

  function assetsOverzicht(key) {
    lijsten();
    return {
      ok: true,
      regels: { tickets: TICKETS_PER_OBJECT, urenPerJaar: UREN_PER_TICKET, jaren: JAREN_GELDIG },
      assets: db.data.sharedAssets.map(a => {
        const actief = actieveVan(a.id);
        return {
          id: a.id, naam: a.naam, soort: a.soort, icon: a.icon, waar: a.waar, beschrijving: a.beschrijving,
          waarde: a.waarde, ticketWaarde: ticketWaarde(a),
          prijsAccess: prijsAccessVan(a), prijsAsset: prijsAssetVan(a),
          totaal: TICKETS_PER_OBJECT, beschikbaar: Math.max(0, TICKETS_PER_OBJECT - actief.length),
          mijnTickets: key ? actief.filter(t => t.key === key).length : 0
        };
      })
    };
  }

  function assetKoop(sess, codenaam, assetIdIn, smaakIn, aantalIn) {
    lijsten();
    if (!magKopen(sess)) return { status: 403, error: 'RTG Shared Assets is er voor betalende leden (RTG, Lifestyle en Business Pass).' };
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const smaak = smaakIn === 'asset' ? 'asset' : 'access';
    const aantal = Math.max(1, Math.min(TICKETS_PER_OBJECT, parseInt(aantalIn, 10) || 1));
    const beschikbaar = TICKETS_PER_OBJECT - actieveVan(a.id).length;
    if (aantal > beschikbaar) return { status: 409, error: 'Uitverkocht: er zijn nog ' + beschikbaar + ' van de ' + TICKETS_PER_OBJECT + ' tickets beschikbaar.' };
    const prijs = smaak === 'asset' ? prijsAssetVan(a) : prijsAccessVan(a);
    const vervalt = new Date();
    vervalt.setFullYear(vervalt.getFullYear() + JAREN_GELDIG);
    const tickets = [];
    for (let i = 0; i < aantal; i++) {
      tickets.push({
        id: crypto.randomBytes(4).toString('hex'),
        ref: 'RTG-SA-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
        assetId: a.id, assetNaam: a.naam,
        key: sess.key, codenaam: schoon(codenaam, 40), tier: sess.tier,
        smaak, prijs, urenPerJaar: UREN_PER_TICKET,
        at: nu(), vervaltOp: vervalt.toISOString().slice(0, 10),
        status: 'actief', uitstap: null
      });
    }
    db.data.assetTickets.unshift(...tickets);
    db.data.assetTickets = db.data.assetTickets.slice(0, 200000);
    save();
    notify(sess.key, {
      icon: a.icon, title: 'Welkom in de pool van ' + a.naam,
      body: aantal + ' ' + (smaak === 'asset' ? 'Asset' : 'Access') + '-ticket(s), elk 24 uur per jaar, tien jaar lang.' +
        (smaak === 'asset' ? ' Uw aandeel in de restwaarde: € ' + (ticketWaarde(a) * aantal) + '.' : ''), scope: 'assets'
    });
    return { ok: true, tickets, totaalPrijs: prijs * aantal, beschikbaar: beschikbaar - aantal };
  }

  /* Het eigen overzicht: per object de positie, het dagen-tegoed van dit jaar
     en (voor de Asset-smaak) wat uitstappen vandaag zou opleveren. */
  function assetMijn(key) {
    lijsten();
    const jaar = new Date().getFullYear();
    const posities = db.data.sharedAssets.map(a => {
      const mijn = actieveVan(a.id).filter(t => t.key === key);
      if (!mijn.length) return null;
      const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum.slice(0, 4) === String(jaar)).length;
      return {
        assetId: a.id, naam: a.naam, icon: a.icon, soort: a.soort,
        tickets: mijn.length,
        access: mijn.filter(t => t.smaak === 'access').length,
        asset: mijn.filter(t => t.smaak === 'asset').length,
        dagenTegoed: Math.max(0, mijn.length - gebruikt),
        gebruiktDitJaar: gebruikt,
        vervaltOp: mijn.map(t => t.vervaltOp).sort()[0],
        ticketWaarde: ticketWaarde(a),
        uitstapWaarde: mijn.filter(t => t.smaak === 'asset').length * ticketWaarde(a),
        assetTicketIds: mijn.filter(t => t.smaak === 'asset').map(t => t.id),
        gepland: db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum >= new Date().toISOString().slice(0, 10)).map(g => g.datum).sort().slice(0, 6)
      };
    }).filter(Boolean);
    return { ok: true, posities };
  }

  // 24 uur boeken: een dag-tegoed van het jaar waarin de dag valt
  function assetGebruik(sess, assetIdIn, datumIn) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const datum = String(datumIn || '');
    const vandaag = new Date().toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    const mijn = actieveVan(a.id).filter(t => t.key === sess.key && t.vervaltOp >= datum);
    if (!mijn.length) return { status: 403, error: 'U heeft geen (geldige) tickets voor dit object.' };
    if (db.data.assetGebruik.some(g => g.assetId === a.id && g.key === sess.key && g.datum === datum))
      return { status: 409, error: 'U heeft deze dag al geboekt.' };
    const jaar = datum.slice(0, 4);
    const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === sess.key && g.datum.slice(0, 4) === jaar).length;
    if (gebruikt >= mijn.length) return { status: 400, error: 'Uw ' + mijn.length * UREN_PER_TICKET + ' uur voor ' + jaar + ' is geboekt; de teller reset op 1 januari.' };
    const g = { id: crypto.randomBytes(4).toString('hex'), assetId: a.id, assetNaam: a.naam, key: sess.key, datum, at: nu() };
    db.data.assetGebruik.unshift(g);
    db.data.assetGebruik = db.data.assetGebruik.slice(0, 500000);
    save();
    notify(sess.key, { icon: a.icon, title: a.naam + ' staat voor u klaar', body: datum + ': uw 24 uur is vastgelegd. Het team neemt vooraf contact op.', scope: 'assets' });
    return { ok: true, gebruik: g, dagenTegoed: mijn.length - gebruikt - 1 };
  }

  /* Uitstappen (alleen de Asset-smaak): het ticket gaat terug in de pool en
     RTG betaalt de actuele ticketwaarde uit via een Tik. */
  async function assetUitstap(sess, codenaam, ticketIdIn) {
    lijsten();
    const t = db.data.assetTickets.find(x => x.id === String(ticketIdIn || '') && x.key === sess.key && x.status === 'actief');
    if (!t) return { status: 404, error: 'Ticket niet gevonden.' };
    if (t.smaak !== 'asset') return { status: 400, error: 'Access-tickets hebben geen restwaarde; ze lopen gewoon af.' };
    const a = objectVan(t.assetId);
    const waarde = ticketWaarde(a);
    t.status = 'uitgestapt';
    t.uitstap = { waarde, at: nu() };
    save();
    // de Tik van RTG: de restwaarde staat meteen in het tegoed van het lid
    try {
      await pay.stuur({ van: 'RTG Treasury', aanCodenaam: codenaam, centen: waarde * 100, oms: 'Uitstap ' + a.naam + ' (RTG Asset)', idem: 'uitstap-' + t.id, soort: 'tik' });
    } catch (e) { /* de uitbetaling staat vast op het ticket; de tik volgt */ }
    notify(sess.key, { icon: '💰', title: 'Uitgestapt uit ' + a.naam, body: 'De Tik van € ' + waarde + ' staat in uw tegoed. Het ticket is terug in de pool.', scope: 'assets' });
    return { ok: true, waarde, ticket: t };
  }

  /* Hertaxatie door RTG-kantoor: de objectwaarde beweegt, en daarmee schuiven
     de ticketwaarde, de uitstapwaarde en de prijzen van beide smaken
     automatisch mee. De pool-leden krijgen er direct bericht van. */
  function assetHertaxeer(assetIdIn, waardeIn, wie) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const waarde = Math.round(Number(waardeIn));
    if (!(waarde >= 300000) || waarde > 1000000000) return { status: 400, error: 'Geef een taxatiewaarde tussen € 300.000 en € 1 miljard.' };
    const vorige = a.waarde;
    a.waarde = waarde;
    a.taxatie = { vorige, door: schoon(wie, 40) || 'RTG-kantoor', at: nu() };
    save();
    // iedereen in de pool hoort meteen wat het ticket nu waard is
    const leden = [...new Set(actieveVan(a.id).map(t => t.key))];
    const richting = waarde > vorige ? 'omhoog' : 'omlaag';
    for (const key of leden) {
      try { notify(key, { icon: a.icon, title: a.naam + ' is hertaxeerd', body: 'De ticketwaarde ging ' + richting + ' naar € ' + ticketWaarde(a) + '. Uw uitstapwaarde beweegt automatisch mee.', scope: 'assets' }); } catch (e) {}
    }
    return { ok: true, asset: { id: a.id, naam: a.naam, waarde: a.waarde, vorige, ticketWaarde: ticketWaarde(a), prijsAccess: prijsAccessVan(a), prijsAsset: prijsAssetVan(a) } };
  }

  return { assetsOverzicht, assetKoop, assetMijn, assetGebruik, assetUitstap, assetHertaxeer };
};

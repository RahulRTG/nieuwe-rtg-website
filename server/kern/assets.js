/* Toren 3: RTG Shared Assets. Jets, jachten en villa's in een besloten pool
   van altijd precies 300 tickets per object. Een ticket = 24 uur gebruik per
   jaar, tien jaar lang. Twee smaken, bewust verschillend gehouden en allebei
   juridisch op eigen leest geschoeid:

   - RTG Access (de consument): een meerjarige dienstenvoucher. Vaste prijs,
     de dagenteller reset elk jaar en na tien jaar is het klaar. Geen
     restwaarde, geen beleggingsregels; wel de wettelijke bedenktijd.
   - RTG Asset (de entrepreneur): een deelnemingsbewijs in een aparte
     entiteit per object. Zelfde gebruiksrecht, plus een aandeel in de reele
     restwaarde (waarde / 300). Koop kan alleen na een uitdrukkelijk
     risico-akkoord, met een essentiele-informatiedocument en veertien dagen
     bedenktijd met volledige terugbetaling.

   Uitstappen loopt langs een trap die een stormloop op de kas voorkomt:
   1. staat er een koper op de wachtlijst, dan draagt het lid het ticket
      direct over (verkoper ontvangt de ticketwaarde, de koper betaalt de
      ticketwaarde plus 5% overdrachtskosten die in de poolkas vallen);
   2. anders koopt RTG terug: het verzoek staat vast en het kantoor betaalt
      binnen dertig dagen uit via een Tik, uit de poolkas van het object.

   De exploitatie is gedekt: elke Asset-koop stort de 15%-premie in de
   poolkas, elk actief ticket betaalt een jaarlijkse servicefee (2% van de
   ticketwaarde) en de restdagen van het object zijn zichtbaar voor het
   kantoor om extern te verhuren. Alleen voor betalende leden. */
const TICKETS_PER_OBJECT = 300;
const UREN_PER_TICKET = 24;   // per jaar
const JAREN_GELDIG = 10;
const BETALENDE_PASSEN = ['rtg', 'lifestyle', 'business'];
const BEDENKTIJD_DAGEN = 14;        // herroeping met volledige terugbetaling
const TERUGKOOP_VENSTER_DAGEN = 30; // RTG betaalt een terugkoop uiterlijk dan uit
const SERVICE_FEE_PCT = 0.02;       // per ticket per jaar, dekt beheer en bemanning
const OVERDRACHT_FEE_PCT = 0.05;    // op een wachtlijst-overdracht, naar de poolkas
const ONDERHOUD_DAGEN = 15;         // per jaar gereserveerd voor onderhoud
const PIEK_MAANDEN = ['07', '08'];  // hooguit de helft van je dagen in juli/augustus
/* De prijzen van de twee smaken zijn een formule op de objectwaarde, zodat
   ze automatisch meebewegen als RTG-kantoor het object hertaxeert:
   - Access = 25% van de ticketwaarde: alleen het gebruik.
   - Asset = ticketwaarde + 15% pool-premie (beheer en onderhoud). */
const ACCESS_FACTOR = 0.25;
const ASSET_FACTOR = 1.15;
const netjes = n => Math.round(n / 100) * 100; // prijzen op honderden

module.exports = ({ db, save, crypto, schoon, notify, pay }) => {
  const nu = () => new Date().toISOString();
  const vandaag = () => new Date().toISOString().slice(0, 10);
  const lijsten = () => {
    if (!db.data.assetTickets) db.data.assetTickets = [];       // gekochte tickets, per lid en object
    if (!db.data.assetGebruik) db.data.assetGebruik = [];       // geboekte 24-uursblokken
    if (!db.data.assetWachtlijst) db.data.assetWachtlijst = []; // kopers die op een Asset-ticket wachten
    if (!db.data.assetTerugkoop) db.data.assetTerugkoop = [];   // uitstapverzoeken die op de kantoor-uitbetaling wachten
    if (!db.data.assetKas) db.data.assetKas = {};               // poolkas per object, in centen
    if (!Array.isArray(db.data.sharedAssets) || !db.data.sharedAssets.length) {
      db.data.sharedAssets = [
        { id: 'sa-jet', naam: 'Aria One, Gulfstream G650', soort: 'privejet', icon: '✈️', waar: 'Thuisbasis Schiphol Oost',
          entiteit: 'RTG Asset Pool Aria One B.V.',
          beschrijving: 'Volledig bemand, wereldwijd inzetbaar. Uw 24 uur is een retour binnen Europa of een enkele reis intercontinentaal.',
          waarde: 42000000 },
        { id: 'sa-jacht', naam: 'Azul Horizon, 34 meter', soort: 'jacht', icon: '🛥️', waar: 'Marina Botafoc, Ibiza',
          entiteit: 'RTG Asset Pool Azul Horizon B.V.',
          beschrijving: 'Met schipper en hostess. Uw 24 uur is een dag en een nacht op zee, Es Vedra bij zonsondergang inbegrepen.',
          waarde: 9000000 },
        { id: 'sa-villa', naam: 'Sunset Beach Villa', soort: 'villa', icon: '🏖️', waar: 'Cala Conta, Ibiza',
          entiteit: 'RTG Asset Pool Sunset Beach B.V.',
          beschrijving: 'Zes slaapkamers, eigen strandpad, dagelijkse housekeeping. Uw 24 uur is een volledige nacht met late check-out.',
          waarde: 6000000 }
      ];
    }
    // oudere pools: elk object hoort in een eigen entiteit
    for (const a of db.data.sharedAssets) if (!a.entiteit) a.entiteit = 'RTG Asset Pool ' + a.naam.split(',')[0] + ' B.V.';
  };
  const objectVan = id => (db.data.sharedAssets || []).find(a => a.id === String(id || ''));
  const ticketWaarde = a => Math.round(a.waarde / TICKETS_PER_OBJECT);
  const prijsAccessVan = a => netjes(ticketWaarde(a) * ACCESS_FACTOR);
  const prijsAssetVan = a => netjes(ticketWaarde(a) * ASSET_FACTOR);
  const serviceFeeVan = a => netjes(ticketWaarde(a) * SERVICE_FEE_PCT);
  const actieveVan = assetId => db.data.assetTickets.filter(t => t.assetId === assetId && t.status === 'actief');
  // bezet = actief plus alles wat op een terugkoop-uitbetaling wacht: pas na
  // de uitbetaling valt het ticket echt terug in de pool
  const bezetVan = assetId => db.data.assetTickets.filter(t => t.assetId === assetId && ['actief', 'uitstap-aangevraagd'].includes(t.status));
  const magKopen = sess => BETALENDE_PASSEN.includes(sess.tier);
  const kasAdd = (assetId, centen) => { db.data.assetKas[assetId] = (db.data.assetKas[assetId] || 0) + Math.round(centen); };
  const binnenBedenktijd = t => (Date.now() - new Date(t.at).getTime()) < BEDENKTIJD_DAGEN * 86400000;

  function assetsOverzicht(key) {
    lijsten();
    return {
      ok: true,
      regels: {
        tickets: TICKETS_PER_OBJECT, urenPerJaar: UREN_PER_TICKET, jaren: JAREN_GELDIG,
        bedenktijdDagen: BEDENKTIJD_DAGEN, terugkoopDagen: TERUGKOOP_VENSTER_DAGEN,
        serviceFeePct: SERVICE_FEE_PCT, overdrachtFeePct: OVERDRACHT_FEE_PCT
      },
      assets: db.data.sharedAssets.map(a => {
        const bezet = bezetVan(a.id);
        return {
          id: a.id, naam: a.naam, soort: a.soort, icon: a.icon, waar: a.waar, beschrijving: a.beschrijving,
          entiteit: a.entiteit,
          waarde: a.waarde, ticketWaarde: ticketWaarde(a),
          prijsAccess: prijsAccessVan(a), prijsAsset: prijsAssetVan(a),
          serviceFee: serviceFeeVan(a),
          totaal: TICKETS_PER_OBJECT, beschikbaar: Math.max(0, TICKETS_PER_OBJECT - bezet.length),
          wachtenden: db.data.assetWachtlijst.filter(w => w.assetId === a.id).length,
          mijnTickets: key ? bezet.filter(t => t.key === key).length : 0,
          opWachtlijst: key ? db.data.assetWachtlijst.some(w => w.assetId === a.id && w.key === key) : false
        };
      })
    };
  }

  /* Het essentiele-informatiedocument: wat je koopt, wat het kost, wat de
     risico's zijn en hoe je er weer uitkomt. Voor beide smaken, in gewone
     taal, voordat er iets wordt afgerekend. */
  function assetDocument(assetIdIn) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const tw = ticketWaarde(a);
    return {
      ok: true,
      document: {
        object: a.naam, entiteit: a.entiteit, waar: a.waar,
        taxatie: { waarde: a.waarde, ticketWaarde: tw, laatst: a.taxatie || null },
        gebruik: '1 ticket geeft ' + UREN_PER_TICKET + ' uur gebruik per kalenderjaar, ' + JAREN_GELDIG + ' jaar lang. Het object is een dag per keer voor een gezelschap; hooguit de helft van uw dagen valt in juli en augustus. De teller reset op 1 januari en ongebruikte dagen vervallen.',
        smaken: {
          access: { prijs: prijsAccessVan(a), aard: 'Dienstenvoucher: alleen het gebruiksrecht. Geen restwaarde, niet overdraagbaar; na ' + JAREN_GELDIG + ' jaar is het klaar.' },
          asset: { prijs: prijsAssetVan(a), aard: 'Deelnemingsbewijs in ' + a.entiteit + ': hetzelfde gebruiksrecht plus een aandeel in de restwaarde (objectwaarde / ' + TICKETS_PER_OBJECT + ', vandaag € ' + tw + '). De waarde beweegt mee met de taxatie en kan dus ook dalen.' }
        },
        kosten: {
          serviceFee: 'Jaarlijkse servicefee van ' + Math.round(SERVICE_FEE_PCT * 100) + '% van de ticketwaarde (vandaag € ' + serviceFeeVan(a) + ' per ticket) voor bemanning, beheer en onderhoud.',
          overdracht: 'Bij verkoop via de wachtlijst betaalt de koper ' + Math.round(OVERDRACHT_FEE_PCT * 100) + '% overdrachtskosten; die vallen in de poolkas van het object.'
        },
        uitstappen: 'Alleen de Asset-smaak. Eerst de wachtlijst (directe overdracht tegen de actuele ticketwaarde); staat er geen koper, dan koopt RTG terug en betaalt het kantoor uiterlijk binnen ' + TERUGKOOP_VENSTER_DAGEN + ' dagen uit via een Tik.',
        bedenktijd: 'U heeft ' + BEDENKTIJD_DAGEN + ' dagen wettelijke bedenktijd na aankoop: herroepen betekent volledige terugbetaling en het ticket valt terug in de pool.',
        risico: 'De restwaarde van een Asset-ticket is geen garantie: taxaties kunnen dalen. Het gebruiksrecht van beide smaken vervalt na ' + JAREN_GELDIG + ' jaar. RTG Asset Pool-deelnemingen vallen buiten het depositogarantiestelsel.'
      }
    };
  }

  function assetKoop(sess, codenaam, assetIdIn, smaakIn, aantalIn, akkoord) {
    lijsten();
    if (!magKopen(sess)) return { status: 403, error: 'RTG Shared Assets is er voor betalende leden (RTG, Lifestyle en Business Pass).' };
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const smaak = smaakIn === 'asset' ? 'asset' : 'access';
    // de Asset-smaak is een deelneming: kopen kan alleen na een uitdrukkelijk akkoord
    if (smaak === 'asset' && akkoord !== true) {
      return { status: 400, error: 'De Asset-smaak is een deelnemingsbewijs in ' + a.entiteit + '. Lees het informatiedocument (waarde kan dalen, jaarlijkse servicefee, uitstappen via wachtlijst of terugkoop binnen ' + TERUGKOOP_VENSTER_DAGEN + ' dagen) en bevestig uw akkoord.' };
    }
    const aantal = Math.max(1, Math.min(TICKETS_PER_OBJECT, parseInt(aantalIn, 10) || 1));
    const beschikbaar = TICKETS_PER_OBJECT - bezetVan(a.id).length;
    if (aantal > beschikbaar) return { status: 409, error: 'Uitverkocht: er zijn nog ' + beschikbaar + ' van de ' + TICKETS_PER_OBJECT + ' tickets beschikbaar. Zet u op de wachtlijst.' };
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
        akkoord: smaak === 'asset' ? nu() : null,
        status: 'actief', uitstap: null, feeJaar: new Date().getFullYear()
      });
    }
    db.data.assetTickets.unshift(...tickets);
    db.data.assetTickets = db.data.assetTickets.slice(0, 200000);
    // de 15%-premie van elke Asset-koop valt in de poolkas van het object
    if (smaak === 'asset') kasAdd(a.id, (prijs - ticketWaarde(a)) * 100 * aantal);
    save();
    notify(sess.key, {
      icon: a.icon, title: 'Welkom in de pool van ' + a.naam,
      body: aantal + ' ' + (smaak === 'asset' ? 'Asset' : 'Access') + '-ticket(s), elk 24 uur per jaar, tien jaar lang. U heeft ' + BEDENKTIJD_DAGEN + ' dagen bedenktijd.' +
        (smaak === 'asset' ? ' Uw aandeel in de restwaarde: € ' + (ticketWaarde(a) * aantal) + '.' : ''), scope: 'assets'
    });
    return { ok: true, tickets, totaalPrijs: prijs * aantal, beschikbaar: beschikbaar - aantal };
  }

  /* De wettelijke bedenktijd: binnen veertien dagen herroepen betekent
     volledige terugbetaling, voor beide smaken. Het ticket valt terug in de
     pool en een eventueel gestorte premie gaat terug uit de poolkas. */
  async function assetHerroep(sess, codenaam, ticketIdIn) {
    lijsten();
    const t = db.data.assetTickets.find(x => x.id === String(ticketIdIn || '') && x.key === sess.key && x.status === 'actief');
    if (!t) return { status: 404, error: 'Ticket niet gevonden.' };
    if (!binnenBedenktijd(t)) return { status: 409, error: 'De bedenktijd van ' + BEDENKTIJD_DAGEN + ' dagen is voorbij. Uitstappen kan (voor de Asset-smaak) via de wachtlijst of de terugkoop.' };
    const a = objectVan(t.assetId);
    t.status = 'herroepen';
    t.uitstap = { waarde: t.prijs, at: nu(), soort: 'herroeping' };
    if (t.smaak === 'asset') kasAdd(a.id, -(t.prijs - ticketWaarde(a)) * 100);
    save();
    try {
      await pay.stuur({ van: 'RTG Treasury', aanCodenaam: codenaam, centen: t.prijs * 100, oms: 'Herroeping ' + a.naam + ' (volledige terugbetaling)', idem: 'herroep-' + t.id, soort: 'tik' });
    } catch (e) { /* de terugbetaling staat vast op het ticket; de tik volgt */ }
    notify(sess.key, { icon: '↩️', title: 'Herroepen: ' + a.naam, body: 'De volledige koopsom van € ' + t.prijs + ' staat in uw tegoed. Het ticket is terug in de pool.', scope: 'assets' });
    return { ok: true, terug: t.prijs, ticket: t };
  }

  // de wachtlijst: wie een Asset-ticket wil terwijl de pool vol is (of een
  // uitstapper zoekt), meldt zich hier; uitstappers matchen hier eerst op
  function assetWachtlijstZet(sess, codenaam, assetIdIn) {
    lijsten();
    if (!magKopen(sess)) return { status: 403, error: 'De wachtlijst is er voor betalende leden.' };
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    if (db.data.assetWachtlijst.some(w => w.assetId === a.id && w.key === sess.key)) return { status: 409, error: 'U staat al op de wachtlijst.' };
    db.data.assetWachtlijst.push({ id: crypto.randomBytes(4).toString('hex'), assetId: a.id, key: sess.key, codenaam: schoon(codenaam, 40), tier: sess.tier, at: nu() });
    save();
    const positie = db.data.assetWachtlijst.filter(w => w.assetId === a.id).length;
    return { ok: true, positie };
  }

  /* Het eigen overzicht: per object de positie, het dagen-tegoed van dit jaar,
     wat uitstappen vandaag oplevert en welke tickets nog in de bedenktijd zitten. */
  function assetMijn(key) {
    lijsten();
    const jaar = new Date().getFullYear();
    const posities = db.data.sharedAssets.map(a => {
      const mijn = actieveVan(a.id).filter(t => t.key === key);
      const wachtend = db.data.assetTerugkoop.filter(v => v.assetId === a.id && v.key === key && v.status === 'aangevraagd');
      if (!mijn.length && !wachtend.length) return null;
      const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum.slice(0, 4) === String(jaar)).length;
      return {
        assetId: a.id, naam: a.naam, icon: a.icon, soort: a.soort, entiteit: a.entiteit,
        tickets: mijn.length,
        access: mijn.filter(t => t.smaak === 'access').length,
        asset: mijn.filter(t => t.smaak === 'asset').length,
        dagenTegoed: Math.max(0, mijn.length - gebruikt),
        gebruiktDitJaar: gebruikt,
        vervaltOp: mijn.length ? mijn.map(t => t.vervaltOp).sort()[0] : null,
        ticketWaarde: ticketWaarde(a),
        serviceFee: serviceFeeVan(a),
        uitstapWaarde: mijn.filter(t => t.smaak === 'asset').length * ticketWaarde(a),
        assetTicketIds: mijn.filter(t => t.smaak === 'asset').map(t => t.id),
        herroepbaar: mijn.filter(binnenBedenktijd).map(t => ({ id: t.id, smaak: t.smaak, prijs: t.prijs })),
        terugkoopOnderweg: wachtend.map(v => ({ waarde: v.waarde, uiterlijk: v.uiterlijk })),
        gepland: db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === key && g.datum >= vandaag()).map(g => g.datum).sort().slice(0, 6)
      };
    }).filter(Boolean);
    return { ok: true, posities };
  }

  /* 24 uur boeken: een dag-tegoed van het jaar waarin de dag valt. Het object
     is een dag per keer voor een gezelschap, en hooguit de helft van je dagen
     valt in het piekseizoen (juli/augustus). */
  function assetGebruik(sess, assetIdIn, datumIn) {
    lijsten();
    const a = objectVan(assetIdIn);
    if (!a) return { status: 404, error: 'Object niet gevonden.' };
    const datum = String(datumIn || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || datum < vandaag()) return { status: 400, error: 'Kies een dag vanaf vandaag.' };
    const mijn = actieveVan(a.id).filter(t => t.key === sess.key && t.vervaltOp >= datum);
    if (!mijn.length) return { status: 403, error: 'U heeft geen (geldige) tickets voor dit object.' };
    // een object, een gezelschap per dag: de dagclaim is poolbreed
    const claim = db.data.assetGebruik.find(g => g.assetId === a.id && g.datum === datum);
    if (claim && claim.key !== sess.key) return { status: 409, error: 'Die dag is al vergeven aan een ander pool-lid. Kies een andere dag.' };
    if (claim) return { status: 409, error: 'U heeft deze dag al geboekt.' };
    const jaar = datum.slice(0, 4);
    const gebruikt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.key === sess.key && g.datum.slice(0, 4) === jaar);
    if (gebruikt.length >= mijn.length) return { status: 400, error: 'Uw ' + mijn.length * UREN_PER_TICKET + ' uur voor ' + jaar + ' is geboekt; de teller reset op 1 januari.' };
    // piekregel: iedereen wil augustus, dus hooguit de helft van je dagen daar
    if (PIEK_MAANDEN.includes(datum.slice(5, 7))) {
      const piek = gebruikt.filter(g => PIEK_MAANDEN.includes(g.datum.slice(5, 7))).length;
      const max = Math.ceil(mijn.length / 2);
      if (piek >= max) return { status: 400, error: 'Piekseizoen: hooguit ' + max + ' van uw ' + mijn.length + ' dag(en) in juli/augustus, zodat iedereen in de pool aan de beurt komt.' };
    }
    const g = { id: crypto.randomBytes(4).toString('hex'), assetId: a.id, assetNaam: a.naam, key: sess.key, datum, at: nu() };
    db.data.assetGebruik.unshift(g);
    db.data.assetGebruik = db.data.assetGebruik.slice(0, 500000);
    save();
    notify(sess.key, { icon: a.icon, title: a.naam + ' staat voor u klaar', body: datum + ': uw 24 uur is vastgelegd. Het team neemt vooraf contact op.', scope: 'assets' });
    return { ok: true, gebruik: g, dagenTegoed: mijn.length - gebruikt.length - 1 };
  }

  /* Uitstappen (alleen de Asset-smaak), langs de trap:
     1. wachtlijst-koper aanwezig -> directe overdracht (verkoper ontvangt de
        ticketwaarde, koper betaalt ticketwaarde + 5% naar de poolkas);
     2. anders een terugkoopverzoek: RTG-kantoor betaalt uiterlijk binnen
        dertig dagen uit via een Tik, uit de poolkas. */
  async function assetUitstap(sess, codenaam, ticketIdIn) {
    lijsten();
    const t = db.data.assetTickets.find(x => x.id === String(ticketIdIn || '') && x.key === sess.key && x.status === 'actief');
    if (!t) return { status: 404, error: 'Ticket niet gevonden.' };
    if (t.smaak !== 'asset') return { status: 400, error: 'Access-tickets hebben geen restwaarde; ze lopen gewoon af. Binnen de bedenktijd kunt u wel herroepen.' };
    const a = objectVan(t.assetId);
    const waarde = ticketWaarde(a);
    const wi = db.data.assetWachtlijst.findIndex(w => w.assetId === a.id && w.key !== sess.key);
    if (wi >= 0) {
      // trap 1: de wachtlijst neemt over; het ticket verhuist met restlooptijd en al
      const koper = db.data.assetWachtlijst.splice(wi, 1)[0];
      const fee = netjes(waarde * OVERDRACHT_FEE_PCT);
      t.key = koper.key; t.codenaam = koper.codenaam; t.tier = koper.tier;
      t.akkoord = nu(); t.at = nu(); // nieuwe eigenaar, nieuwe bedenktijd
      kasAdd(a.id, fee * 100);
      save();
      try { await pay.stuur({ van: koper.codenaam, aanCodenaam: 'RTG Treasury', centen: (waarde + fee) * 100, oms: 'Overname Asset-ticket ' + a.naam + ' (incl. ' + Math.round(OVERDRACHT_FEE_PCT * 100) + '% overdracht)', idem: 'overname-' + t.id + '-' + koper.id, soort: 'tik' }); } catch (e) {}
      try { await pay.stuur({ van: 'RTG Treasury', aanCodenaam: codenaam, centen: waarde * 100, oms: 'Verkoop Asset-ticket ' + a.naam + ' via de wachtlijst', idem: 'uitstap-' + t.id + '-' + koper.id, soort: 'tik' }); } catch (e) {}
      notify(sess.key, { icon: '💰', title: 'Verkocht via de wachtlijst', body: a.naam + ': de Tik van € ' + waarde + ' staat in uw tegoed.', scope: 'assets' });
      notify(koper.key, { icon: a.icon, title: 'U bent aan de beurt: ' + a.naam, body: 'Het Asset-ticket is van u (€ ' + waarde + ' + € ' + fee + ' overdracht). Restlooptijd tot ' + t.vervaltOp + '.', scope: 'assets' });
      return { ok: true, soort: 'overdracht', waarde, naar: koper.codenaam };
    }
    // trap 2: terugkoop door RTG, uitbetaling binnen het venster door het kantoor
    const uiterlijk = new Date(Date.now() + TERUGKOOP_VENSTER_DAGEN * 86400000).toISOString().slice(0, 10);
    t.status = 'uitstap-aangevraagd';
    const v = { id: crypto.randomBytes(4).toString('hex'), ticketId: t.id, assetId: a.id, assetNaam: a.naam, key: sess.key, codenaam: schoon(codenaam, 40), waarde, at: nu(), uiterlijk, status: 'aangevraagd' };
    db.data.assetTerugkoop.unshift(v);
    db.data.assetTerugkoop = db.data.assetTerugkoop.slice(0, 50000);
    save();
    notify(sess.key, { icon: '⏳', title: 'Terugkoop aangevraagd: ' + a.naam, body: 'Er staat nu geen koper op de wachtlijst; RTG koopt terug en betaalt uiterlijk ' + uiterlijk + ' € ' + waarde + ' uit via een Tik.', scope: 'assets' });
    return { ok: true, soort: 'terugkoop-aangevraagd', waarde, uiterlijk, verzoek: v };
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
    const leden = [...new Set(actieveVan(a.id).map(t => t.key))];
    const richting = waarde > vorige ? 'omhoog' : 'omlaag';
    for (const key of leden) {
      try { notify(key, { icon: a.icon, title: a.naam + ' is hertaxeerd', body: 'De ticketwaarde ging ' + richting + ' naar € ' + ticketWaarde(a) + '. Uw uitstapwaarde beweegt automatisch mee.', scope: 'assets' }); } catch (e) {}
    }
    return { ok: true, asset: { id: a.id, naam: a.naam, waarde: a.waarde, vorige, ticketWaarde: ticketWaarde(a), prijsAccess: prijsAccessVan(a), prijsAsset: prijsAssetVan(a) } };
  }

  /* ---- het kantoor: de pool besturen ---- */
  // het overzicht: verkoop, poolkas, wachtlijst, open terugkopen en de
  // restdagen die dit jaar extern verhuurd kunnen worden
  function assetKantoor() {
    lijsten();
    const jaar = String(new Date().getFullYear());
    return {
      ok: true,
      objecten: db.data.sharedAssets.map(a => {
        const bezet = bezetVan(a.id);
        const geboekt = db.data.assetGebruik.filter(g => g.assetId === a.id && g.datum.slice(0, 4) === jaar).length;
        return {
          id: a.id, naam: a.naam, icon: a.icon, waarde: a.waarde, ticketWaarde: ticketWaarde(a),
          verkocht: bezet.length, access: bezet.filter(t => t.smaak === 'access').length, asset: bezet.filter(t => t.smaak === 'asset').length,
          kas: Math.round((db.data.assetKas[a.id] || 0) / 100),
          wachtenden: db.data.assetWachtlijst.filter(w => w.assetId === a.id).length,
          terugkoopOpen: db.data.assetTerugkoop.filter(v => v.assetId === a.id && v.status === 'aangevraagd').map(v => ({ id: v.id, codenaam: v.codenaam, waarde: v.waarde, uiterlijk: v.uiterlijk })),
          // wat er dit jaar nog te verhuren valt: 365 minus geboekt minus onderhoud
          restdagen: Math.max(0, 365 - geboekt - ONDERHOUD_DAGEN)
        };
      })
    };
  }
  // een terugkoop uitbetalen: de Tik gaat eruit, het ticket valt terug in de pool
  async function assetTerugkoopUit(verzoekIdIn, wie) {
    lijsten();
    const v = db.data.assetTerugkoop.find(x => x.id === String(verzoekIdIn || '') && x.status === 'aangevraagd');
    if (!v) return { status: 404, error: 'Terugkoopverzoek niet gevonden (of al uitbetaald).' };
    const t = db.data.assetTickets.find(x => x.id === v.ticketId);
    v.status = 'uitbetaald'; v.uitbetaaldAt = nu(); v.door = schoon(wie, 40) || 'RTG-kantoor';
    if (t) { t.status = 'uitgestapt'; t.uitstap = { waarde: v.waarde, at: nu(), soort: 'terugkoop' }; }
    kasAdd(v.assetId, -v.waarde * 100);
    save();
    try { await pay.stuur({ van: 'RTG Treasury', aanCodenaam: v.codenaam, centen: v.waarde * 100, oms: 'Terugkoop ' + v.assetNaam + ' (RTG Asset)', idem: 'terugkoop-' + v.id, soort: 'tik' }); } catch (e) {}
    notify(v.key, { icon: '💰', title: 'Terugkoop uitbetaald: ' + v.assetNaam, body: 'De Tik van € ' + v.waarde + ' staat in uw tegoed. Het ticket is terug in de pool.', scope: 'assets' });
    return { ok: true, waarde: v.waarde, verzoek: v };
  }
  // de jaarlijkse servicefee innen: per actief ticket een keer per jaar, naar de poolkas
  async function assetFeesInnen(wie) {
    lijsten();
    const jaar = new Date().getFullYear();
    let geind = 0, totaal = 0;
    for (const t of db.data.assetTickets) {
      if (t.status !== 'actief' || t.feeJaar === jaar) continue;
      const a = objectVan(t.assetId);
      if (!a) continue;
      const fee = serviceFeeVan(a);
      try {
        await pay.stuur({ van: t.codenaam, aanCodenaam: 'RTG Treasury', centen: fee * 100, oms: 'Servicefee ' + jaar + ' ' + a.naam, idem: 'fee-' + t.id + '-' + jaar, soort: 'tik' });
        t.feeJaar = jaar;
        kasAdd(a.id, fee * 100);
        geind++; totaal += fee;
      } catch (e) { /* volgende ronde opnieuw */ }
    }
    save();
    return { ok: true, geind, totaal, door: schoon(wie, 40) || 'RTG-kantoor' };
  }

  return { assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet, assetMijn, assetGebruik, assetUitstap, assetHertaxeer, assetKantoor, assetTerugkoopUit, assetFeesInnen };
};

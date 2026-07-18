/* Shared-assets (deelmodule): overzicht, ticketdocument, kopen, herroepen en de wachtlijst.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/assets.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon, notify, pay,
    TICKETS_PER_OBJECT, UREN_PER_TICKET, JAREN_GELDIG, BETALENDE_PASSEN, BEDENKTIJD_DAGEN,
    TERUGKOOP_VENSTER_DAGEN, SERVICE_FEE_PCT, OVERDRACHT_FEE_PCT, ONDERHOUD_DAGEN, PIEK_MAANDEN,
    ACCESS_FACTOR, ASSET_FACTOR, netjes,
    nu, vandaag, lijsten, objectVan, ticketWaarde, prijsAccessVan, prijsAssetVan, serviceFeeVan,
    actieveVan, bezetVan, magKopen, kasAdd, binnenBedenktijd } = ctx;
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
  return { assetsOverzicht, assetDocument, assetKoop, assetHerroep, assetWachtlijstZet };
};

/* Shared-assets (deelmodule): overzicht, ticketdocument en de wachtlijst.
   Krijgt de gedeelde context een keer bij het opstarten vanuit kern/assets.js. */
module.exports = (ctx) => {
  const { db, save, crypto, schoon,
    TICKETS_PER_OBJECT, UREN_PER_TICKET, JAREN_GELDIG, BETALENDE_PASSEN, BEDENKTIJD_DAGEN,
    TERUGKOOP_VENSTER_DAGEN, SERVICE_FEE_PCT, OVERDRACHT_FEE_PCT, ONDERHOUD_DAGEN, PIEK_MAANDEN,
    ACCESS_FACTOR, ASSET_FACTOR, netjes,
    nu, vandaag, lijsten, objectVan, ticketWaarde, prijsAccessVan, prijsAssetVan, serviceFeeVan,
    actieveVan, bezetVan, magKopen } = ctx;
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

  /* Kopen en herroepen staan sinds 19 oktober 2026 in ./aanvraag.js: een koop
     is een aanvraag die een mens van RTG beoordeelt, en een ticket ontstaat
     pas na een bevestigde betaling. */

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
  return { assetsOverzicht, assetDocument, assetWachtlijstZet };
};

  /* ---------- SCHERMEN VAN EEN WERKROL (19 oktober 2026) ----------
     De widgetcatalogus van Heel RTG toonde deze schermen aan elk lid, terwijl de
     server een zaak-, personeels-, kantoor- of werkruimtesessie eist (gemeten
     met scripts/lib/bewakers.js en SCHERMROUTES.json). Een ingang hier, met de
     werkrol uit de sleutelbos (app-main-24a3.js), laat de bestaande poort
     (gidsToegang -> itemZichtbaar -> werkrolOk) ze filteren: geen nieuwe regel.
     Ze staan in GEEN wereld van MAPPEN -- het zijn geen tegels van een lid; de
     gids neemt ze op in de context "Werkrollen" (scripts/workspace-worlds.js).
     PERSONEEL voor de schermen op een dienstsessie (chauffeur, de PDA's): een
     manager draagt die rol ook, een eigenaar zonder dienstverband niet. */
    // zaak (supplierAuth)
    appstoreuitgever:        { naam: T('werkrol.appstoreuitgever', 'App Store · uitgever'), url: '/apps/appstore-uitgever.html', werkrol: 'zaak' },
    belastingkantoor:        { naam: T('werkrol.belastingkantoor', 'Belastingkantoor (inspecteur)'), url: '/apps/belastingkantoor.html', werkrol: 'zaak' },
    dispatch:                { naam: T('werkrol.dispatch', 'RTG Dispatch'), url: '/apps/dispatch.html', werkrol: 'zaak' },
    festival:                { naam: T('werkrol.festival', 'RTG Festival'), url: '/apps/festival.html', werkrol: 'zaak' },
    gemeenteloket:           { naam: T('werkrol.gemeenteloket', 'Gemeente-loket (medewerker)'), url: '/apps/gemeenteloket.html', werkrol: 'zaak' },
    ghost:                   { naam: T('werkrol.ghost', 'Ghost Driver'), url: '/apps/ghost.html', werkrol: 'zaak' },
    handel:                  { naam: T('werkrol.handel', 'RTG Handel: inkoop tussen zaken'), url: '/apps/handel.html', werkrol: 'zaak' },
    horecabar:               { naam: T('werkrol.horecabar', 'RTG Horeca: bar'), url: '/apps/horeca-bar.html', werkrol: 'zaak' },
    horecabeheer:            { naam: T('werkrol.horecabeheer', 'RTG Horeca: beheer'), url: '/apps/horeca-beheer.html', werkrol: 'zaak' },
    horecabezorg:            { naam: T('werkrol.horecabezorg', 'RTG Horeca: bezorging'), url: '/apps/horeca-bezorg.html', werkrol: 'zaak' },
    horecaclub:              { naam: T('werkrol.horecaclub', 'RTG Horeca: club'), url: '/apps/horeca-club.html', werkrol: 'zaak' },
    horecaevents:            { naam: T('werkrol.horecaevents', 'RTG Horeca: events'), url: '/apps/horeca-events.html', werkrol: 'zaak' },
    horecaexpeditie:         { naam: T('werkrol.horecaexpeditie', 'RTG Horeca: expeditie'), url: '/apps/horeca-expeditie.html', werkrol: 'zaak' },
    horecahaccp:             { naam: T('werkrol.horecahaccp', 'RTG Horeca: HACCP'), url: '/apps/horeca-haccp.html', werkrol: 'zaak' },
    horecahotel:             { naam: T('werkrol.horecahotel', 'RTG Horeca: hotel'), url: '/apps/horeca-hotel.html', werkrol: 'zaak' },
    horecavloer:             { naam: T('werkrol.horecavloer', 'RTG Horeca: vloer'), url: '/apps/horeca-vloer.html', werkrol: 'zaak' },
    kassa:                   { naam: T('werkrol.kassa', 'De Kassa'), url: '/apps/kassa.html', werkrol: 'zaak' },
    leverancieraanvragen:    { naam: T('werkrol.leverancieraanvragen', 'Aanvragen uit de Mall'), url: '/apps/leverancier-aanvragen.html', werkrol: 'zaak' },
    leveranciercommerce:     { naam: T('werkrol.leveranciercommerce', 'Verkoopwegen en retouren'), url: '/apps/leverancier-commerce.html', werkrol: 'zaak' },
    leverancierrtmail:       { naam: T('werkrol.leverancierrtmail', 'RTMAIL zaak'), url: '/apps/leverancier-rtmail.html', werkrol: 'zaak' },
    leverancierservice:      { naam: T('werkrol.leverancierservice', 'Hulp van RTG'), url: '/apps/leverancier-service.html', werkrol: 'zaak' },
    luchthaven:              { naam: T('werkrol.luchthaven', 'RTG Airport (operations)'), url: '/apps/luchthaven.html', werkrol: 'zaak' },
    magnaatpartnerstudio:    { naam: T('werkrol.magnaatpartnerstudio', 'Magnaat Partnerstudio'), url: '/apps/magnaat-partnerstudio.html', werkrol: 'zaak' },
    marechaussee:            { naam: T('werkrol.marechaussee', 'Brigade RTG Airport (KMar)'), url: '/apps/marechaussee.html', werkrol: 'zaak' },
    oog:                     { naam: T('werkrol.oog', 'RTG Eye'), url: '/apps/oog.html', werkrol: 'zaak' },
    ovcontrol:               { naam: T('werkrol.ovcontrol', 'RTG Mobility Control Tower'), url: '/apps/ovcontrol.html', werkrol: 'zaak' },
    rechtbank:               { naam: T('werkrol.rechtbank', 'De Rechtspraak (griffie)'), url: '/apps/rechtbank.html', werkrol: 'zaak' },
    redactie:                { naam: T('werkrol.redactie', 'RTG Redactie · Journalistiek'), url: '/apps/redactie.html', werkrol: 'zaak' },
    rijksloket:              { naam: T('werkrol.rijksloket', 'Rijks-loket (ambtenaar)'), url: '/apps/rijksloket.html', werkrol: 'zaak' },
    sportclub:               { naam: T('werkrol.sportclub', 'FC RTG · Clubkantoor'), url: '/apps/sportclub.html', werkrol: 'zaak' },
    voertuig:                { naam: T('werkrol.voertuig', 'RTG Voertuig'), url: '/apps/voertuig.html', werkrol: 'zaak' },
    zaakkosten:              { naam: T('werkrol.zaakkosten', 'RTG Kostprijs: wat uw zaak ons kost'), url: '/apps/zaakkosten.html', werkrol: 'zaak' },
    zaakweb:                 { naam: T('werkrol.zaakweb', 'Mijn RTG-website'), url: '/apps/zaakweb.html', werkrol: 'zaak' },
    zakelijk:                { naam: T('werkrol.zakelijk', 'RTG Zakelijk vervoer'), url: '/apps/zakelijk.html', werkrol: 'zaak' },
    // personeel (supplierAuth op een dienstsessie)
    chauffeur:               { naam: T('werkrol.chauffeur', 'RTG Chauffeur'), url: '/apps/chauffeur.html', werkrol: 'personeel' },
    gemeentepda:             { naam: T('werkrol.gemeentepda', 'Gemeente-PDA (buitendienst)'), url: '/apps/gemeentepda.html', werkrol: 'personeel' },
    horecapda:               { naam: T('werkrol.horecapda', 'RTG Horeca: PDA Service'), url: '/apps/horeca-pda.html', werkrol: 'personeel' },
    ovdienst:                { naam: T('werkrol.ovdienst', 'OV-dienst'), url: '/apps/ovdienst.html', werkrol: 'personeel' },
    overheidspda:            { naam: T('werkrol.overheidspda', 'Overheids-PDA'), url: '/apps/overheidspda.html', werkrol: 'personeel' },
    redactiepda:             { naam: T('werkrol.redactiepda', 'Redactie PDA'), url: '/apps/redactie-pda.html', werkrol: 'personeel' },
    // kantoor (officeAuth, boardroomAuth, kluisAuth, techAuth, balieAuth)
    appstorekantoor:         { naam: T('werkrol.appstorekantoor', 'Appkeuring'), url: '/apps/appstore-kantoor.html', werkrol: 'kantoor' },
    backoffice:              { naam: T('werkrol.backoffice', 'Backoffice'), url: '/apps/backoffice.html', werkrol: 'kantoor' },
    boardroom:               { naam: T('werkrol.boardroom', 'Boardroom'), url: '/apps/boardroom.html', werkrol: 'kantoor' },
    foundationkwestiekantoor:{ naam: T('werkrol.foundationkwestiekantoor', 'Kwesties behandelen · RTF-kantoor'), url: '/apps/foundation/kwestiekantoor.html', werkrol: 'kantoor' },
    isolatie:                { naam: T('werkrol.isolatie', 'Isolatiemodus'), url: '/apps/isolatie.html', werkrol: 'kantoor' },
    kantoren:                { naam: T('werkrol.kantoren', 'Afdelingen'), url: '/apps/kantoren.html', werkrol: 'kantoor' },
    kosten:                  { naam: T('werkrol.kosten', 'RTG Kostprijs'), url: '/apps/kosten.html', werkrol: 'kantoor' },
    magnaatkantoor:          { naam: T('werkrol.magnaatkantoor', 'RTG Controleregister · Boardroom'), url: '/apps/magnaat-kantoor.html', werkrol: 'kantoor' },
    loonkantoor:             { naam: T('werkrol.loonkantoor', 'RTG Payroll · het loonkantoor'), url: '/apps/payroll.html', werkrol: 'kantoor' },
    platformregister:        { naam: T('werkrol.platformregister', 'Platformregister'), url: '/apps/platformregister.html', werkrol: 'kantoor' },
    routedekking:            { naam: T('werkrol.routedekking', 'Routedekking'), url: '/apps/routedekking.html', werkrol: 'kantoor' },
    service:                 { naam: T('werkrol.service', 'RTG Service · de wachtrij'), url: '/apps/service.html', werkrol: 'kantoor' },
    techniek:                { naam: T('werkrol.techniek', 'Technische status'), url: '/apps/techniek.html', werkrol: 'kantoor' },
    websitestudio:           { naam: T('werkrol.websitestudio', 'Website-studio'), url: '/apps/websitestudio.html', werkrol: 'kantoor' },
    // werkruimte (huisAuth)
    werkplek:                { naam: T('werkrol.werkplek', 'RTG Enterprise Campus'), url: '/apps/werkplek.html', werkrol: 'werkruimte' },

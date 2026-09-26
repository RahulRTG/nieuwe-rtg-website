/* RTG Pay, het oplaaddeel: geld de wallet in. Opladen via de betaal-naad
   (Apple Pay/kaart), de eigen bank als eerste dekking bij een tekort, het
   automatische bijladen achter "EEN knop" (zorgSaldo), en de herstart-
   reconcile in motor-modus. De grootboekregels zelf staan in ./index.js;
   dit deel krijgt de guard (boekAsync) en de helpers mee en verandert
   NIETS aan de boekingsregels. */
function maakOpladen(basis) {
  const { betaal, metIdem, boekAsync, rekLid, saldoVan, nu, d, save,
    motorklant, geldModus, keyVanCodenaam, plafondFout, betaalWaarheid,
    OPLAAD_MIN, MAX_CENTEN, AUTOLAAD_STAP } = basis;
  const { randomUUID } = require('crypto');

  /* ---------- opladen (Apple Pay / kaart via de betaal-naad) ---------- */
  async function laadOp({ codenaam, centen, idem, oms, userId, interneStap }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c < OPLAAD_MIN || c > MAX_CENTEN) return { status: 400, error: 'Opladen kan van 1 tot 5000 euro.' };
    /* HET PLAFOND VALT HIER, EN NIET PAS BIJ DE BOEKING.

       Verderop wordt eerst de KAART BELAST en pas daarna bijgeschreven. Zou het
       walletplafond alleen in boekAsync staan, dan is de volgorde: geld van de
       kaart af, en dan een 409 omdat het er niet meer bij past -- afgeschreven
       zonder bijgeschreven, precies de fout die de kop van oplaadAfronden
       hieronder beschrijft voor de webhook. Een grens die je pas na de kassa
       ontdekt, is geen grens maar een schadepost. */
    const vol = plafondFout(rekLid(codenaam), c);
    if (vol) return vol;
    // `interneStap`: stap binnen een andere handeling (zie zorgSaldo), nooit van buiten.
    return metIdem(idem ? 'oplaad:' + codenaam + ':' + idem : null, 'oplaad|' + codenaam + '|' + c, async () => {
      /* VIA DE BETAALWAARHEID (MONEY-012); waarom, staat in ./oplaadwaarheid.js.
         Zonder `idem` krijgt de poging een eigen sleutel: een tweede tik is dan
         een tweede betaling, maar een verloren antwoord raakt niet meer zoek. */
      if (!betaalWaarheid) return { status: 503, error: 'De betaalwaarheid is niet aangesloten; er is niets afgeschreven.' };
      let w;
      try {
        w = betaalWaarheid.maak({ actor: 'pay:' + codenaam, soort: 'pay-oplaad', bronRef: codenaam,
          idem: 'pay-oplaad:' + codenaam + ':' + (idem ? String(idem) : 'los:' + randomUUID()),
          centen: c, valuta: 'eur', context: { codenaam, userId: userId || null, oms: oms || 'Opladen' } });
      } catch (e) { return { status: 409, error: e.message }; }
      let uit;
      try { uit = await betaalWaarheid.begin(w.id, { omschrijving: oms || 'RTG Pay opladen' }); }
      catch (e) {
        if (e && e.code === 'BETAAL_AFHANDELING_MISLUKT')
          return { status: 502, betalingId: w.id, error: 'De betaling is bevestigd maar nog niet bijgeschreven; dat gebeurt vanzelf.' };
        return { status: 502, betalingId: w.id, onbekend: true,
          error: 'De betaling gaf geen uitsluitsel. Betaal niet opnieuw: RTG zoekt het na met dezelfde sleutel.' };
      }
      const r = betaalWaarheid.van(w.id);
      if (r && r.afgehandeldAt) return { ok: true, saldo: saldoVan(rekLid(codenaam)), geladen: c, betalingId: w.id };
      return { status: 402, error: 'De betaling wacht op bevestiging.', betalingId: w.id,
        betaalStatus: (r && r.providerStatus) || (uit && uit.betaling && uit.betaling.status) || null };
    }, interneStap ? null : { geld: 'laadt de wallet op, met transactiekosten op dat moment' });
  }

  /* HET BIJSCHRIJVEN ZELF, als eigen functie -- want het gebeurt op TWEE
     momenten: meteen (de aanbieder bevestigt direct) en later (de webhook
     bevestigt, kern/settlement.js). Die tweede weg bestond niet en daar ging
     het geld verloren. Een tweede boekingsregel ernaast zou hetzelfde soort
     fout zijn: twee bronnen die ooit uit de pas lopen. Dus een. */
  async function oplaadAfronden({ codenaam, centen, oms, ref, economischeSleutel }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) return { status: 400, error: 'Geen geldig bedrag om bij te schrijven.' };
    const b = await boekAsync({ van: 'extern:oplaad', naar: rekLid(codenaam), centen: c, soort: 'oplaad', oms: oms || 'Opladen', ref, economischeSleutel });
    if (b.error) return b;
    /* DE TRANSACTIEKOSTEN, op het OPLAADMOMENT. Dat is niet toevallig de plek:
       WAARDE.md par. 1 zegt het al met zoveel woorden -- transactiekosten
       verdwijnen niet, ze verhuizen naar het moment dat er geld van buiten
       binnenkomt, en dat is hier. Wat een lid daarna met zijn saldo doet, kost de
       betaalpartner niets meer.

       Pas gemeld NA de boeking: een mislukte oplading heeft ons geen
       transactiekosten gekost, en een teller die vooraf staat, telt precies de
       gevallen mee die niet gebeurd zijn. */
    if (typeof meetTransactie === 'function') {
      try { await meetTransactie({ codenaam, centen: c, ref }); } catch (e) {}
    }
    return { ok: true, saldo: saldoVan(rekLid(codenaam)), geladen: c };
  }

  // de enige bijschrijving van een bevestigde oplading, precies een keer: ./oplaadwaarheid.js
  require('./oplaadwaarheid')({ betaalWaarheid, oplaadAfronden, nu });

  /* De kostprijslaag hangt hier LAAT aan: kern/kosten wordt na kern/pay gebouwd,
     en pay hoeft niets van de kosten te weten om te bestaan (zelfde draadje als
     koppelBank hierboven). Zonder koppeling wordt er niets gemeld, en dat is
     beter dan een oplading die omvalt op een boekhouding. */
  let meetTransactie = null;
  function koppelKosten(fn) { meetTransactie = typeof fn === 'function' ? fn : null; }

  /* De eigen bank als eerste dekking: is de RTG Bank live en heeft het lid
     daar een betaalrekening met ruimte, dan komt een saldotekort DAAR vandaan
     (eigen rails) in plaats van via de kaart-naad. De koppeling komt na het
     opstarten binnen (de bank bouwt op pay, dus late binding). */
  let bankDekking = null;
  function koppelBank(dekking) { bankDekking = typeof dekking === 'function' ? dekking : null; }

  /* Herstart-reconcile (cutover): bij het opstarten in motor-modus is de motor de
     autoriteit, dus de JS-spiegel moet zijn saldi uit de motor-snapshot overnemen
     i.p.v. uit zijn eigen (mogelijk verouderde) snapshot. We halen de volledige
     saldi-stand op en vervangen db.data.paySaldi ermee. Zo start de spiegel altijd
     in lockstep met de motor, ook na een crash of nadat de motor los is bijgewerkt.
     No-op buiten motor-modus. */
  async function reconcileVanMotor() {
    if (geldModus !== 'motor') return { ok: true, overgeslagen: true };
    const r = await motorklant.saldiSnapshot();
    if (!r || r.error) return { ok: false, error: (r && r.error) || 'Geen saldi van de motor.' };
    const nieuw = {};
    for (const k in r.saldi) {
      if (!Object.prototype.hasOwnProperty.call(r.saldi, k)) continue;
      const v = Math.round(Number(r.saldi[k]) || 0);
      if (v !== 0) nieuw[k] = v; // nul-saldi laten we weg (schone spiegel)
    }
    d().paySaldi = nieuw;
    save();
    let som = 0; for (const k in nieuw) som += nieuw[k];
    return { ok: true, rekeningen: Object.keys(nieuw).length, som };
  }

  /* Het hart van "EEN knop": is er te weinig saldo, dan laadt de wallet zelf
     bij en betaalt door. Eerst via de eigen bank (exact het tekort), anders
     via de kaart-naad (afgerond op tientjes). Het lid merkt er niets van
     behalve een regel "bijgeladen" in het overzicht. */
  async function zorgSaldo({ codenaam, centen, idem }) {
    const tekort = Math.round(centen) - saldoVan(rekLid(codenaam));
    if (tekort <= 0) return { ok: true, bijgeladen: 0 };
    if (bankDekking) {
      /* De sleutel gaat MEE: anders weigert de geldgrens de dekking en slikt deze
         catch dat op -- zo kreeg een lid `bijgeladen: 0` zonder uitleg. */
      try { const b = await bankDekking({ codenaam, centen: tekort, idem }); if (b && b.ok) return { ok: true, bijgeladen: tekort, via: 'bank' }; }
      catch (e) { /* de bank kon niet dekken: gewoon door naar de kaart */ }
    }
    /* Afronden op tientjes is comfort, het plafond is een grens -- dus als de
       afronding er niet meer bij past, laden we exact het tekort. Dat past
       altijd: het tekort brengt de wallet op het bedrag van de boeking zelf, en
       een boeking is nooit groter dan MAX_CENTEN, dat onder het plafond ligt.
       Zonder deze regel zou een lid met een bijna volle wallet niets meer kunnen
       betalen -- de duurste manier om een plafond te ontdekken. */
    const stap = Math.ceil(tekort / AUTOLAAD_STAP) * AUTOLAAD_STAP;
    const bedrag = plafondFout(rekLid(codenaam), stap) ? Math.max(tekort, OPLAAD_MIN) : stap;
    /* Zonder sleutel van boven is dit een STAP: de handeling die hierom vroeg
       draagt de idempotentie. Afweging voluit: ../bank/walletbrug.js. */
    const r = await laadOp({ codenaam, centen: bedrag, oms: 'Automatisch bijgeladen',
      idem: idem ? idem + ':autolaad' : null, interneStap: !idem });
    if (r.error) return r;
    return { ok: true, bijgeladen: bedrag, via: 'kaart' };
  }
  async function bestaatLid(codenaam) {
    try { return !!(await keyVanCodenaam(codenaam)); } catch (e) { return false; }
  }

  return { laadOp, oplaadAfronden, koppelBank, koppelKosten, reconcileVanMotor, zorgSaldo, bestaatLid };
}

module.exports = { maakOpladen };

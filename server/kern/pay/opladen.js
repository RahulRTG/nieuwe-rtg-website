/* RTG Pay, het oplaaddeel: geld de wallet in. Opladen via de betaal-naad
   (Apple Pay/kaart), de eigen bank als eerste dekking bij een tekort, het
   automatische bijladen achter "EEN knop" (zorgSaldo), en de herstart-
   reconcile in motor-modus. De grootboekregels zelf staan in ./index.js;
   dit deel krijgt de guard (boekAsync) en de helpers mee en verandert
   NIETS aan de boekingsregels. */
function maakOpladen(basis) {
  const { betaal, metIdem, boekAsync, rekLid, saldoVan, nu, d, save,
    motorklant, geldModus, keyVanCodenaam, plafondFout,
    OPLAAD_MIN, MAX_CENTEN, AUTOLAAD_STAP } = basis;

  /* ---------- opladen (Apple Pay / kaart via de betaal-naad) ---------- */
  async function laadOp({ codenaam, centen, idem, oms }) {
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
    return metIdem(idem ? 'oplaad:' + codenaam + ':' + idem : null, 'oplaad|' + codenaam + '|' + c, async () => {
      let betaling;
      try {
        betaling = await betaal.maakBetaling({
          bedrag: c, referentie: 'pay-oplaad-' + codenaam + '-' + nu(),
          idempotentieSleutel: idem ? 'pay-oplaad:' + codenaam + ':' + idem : undefined,
          omschrijving: oms || 'RTG Pay opladen'
        });
      } catch (e) { return { status: 502, error: 'De betaling lukte niet: ' + e.message }; }
      if (betaling.status !== 'betaald' && betaling.status !== 'succeeded') {
        /* "De webhook crediteert daarna" -- dat stond hier, en het was niet waar.
           Niets vertelde die webhook WELKE oplading bij welk lid hoorde: hij kijkt
           in db.data.kaartWachtend, en daar kwam alleen een FACTUUR in te staan
           (routes/member/betalen.js). Een oplading stond er nergens, dus vond de
           webhook niets, logde "zonder wachtende betaling" en deed niets.

           Het gevolg bij een echte aanbieder: de kaart van het lid werd wel
           afgeschreven en zijn wallet nooit bijgeschreven. De aanroeper kreeg
           een nette 402 "wacht op bevestiging" en die bevestiging kwam nooit aan.
           In demostand viel het niet op, want daar is de betaling meteen betaald
           en loopt de code hier niet langs -- precies dezelfde blinde vlek die
           kern/settlement.js in zijn kop beschrijft voor de facturen.

           De context gaat lokaal in de boeken, op het betaal-id. Bewust lokaal
           en niet als metadata bij de provider: een codenaam hoort niet naar een
           derde partij, ook niet als pseudoniem. */
        try {
          d().kaartWachtend = d().kaartWachtend && typeof d().kaartWachtend === 'object' ? d().kaartWachtend : {};
          d().kaartWachtend[betaling.id] = { soort: 'oplaad', codenaam, centen: c, oms: oms || 'Opladen', at: Date.now() };
          // hetzelfde plafond als bij de facturen, zodat afgebroken betalingen dit niet laten groeien
          const sleutels = Object.keys(d().kaartWachtend);
          if (sleutels.length > 20000) for (const k of sleutels.slice(0, sleutels.length - 20000)) delete d().kaartWachtend[k];
          save();
        } catch (e) { /* de registratie mag de betaling niet omgooien */ }
        return { status: 402, error: 'De betaling wacht op bevestiging.', betaalStatus: betaling.status };
      }
      return oplaadAfronden({ codenaam, centen: c, oms, ref: betaling.id });
    });
  }

  /* HET BIJSCHRIJVEN ZELF, als eigen functie -- want het gebeurt op TWEE
     momenten: meteen (de aanbieder bevestigt direct) en later (de webhook
     bevestigt, kern/settlement.js). Die tweede weg bestond niet en daar ging
     het geld verloren. Een tweede boekingsregel ernaast zou hetzelfde soort
     fout zijn: twee bronnen die ooit uit de pas lopen. Dus een. */
  async function oplaadAfronden({ codenaam, centen, oms, ref }) {
    const c = Math.round(Number(centen));
    if (!Number.isFinite(c) || c <= 0) return { status: 400, error: 'Geen geldig bedrag om bij te schrijven.' };
    const b = await boekAsync({ van: 'extern:oplaad', naar: rekLid(codenaam), centen: c, soort: 'oplaad', oms: oms || 'Opladen', ref });
    if (b.error) return b;
    return { ok: true, saldo: saldoVan(rekLid(codenaam)), geladen: c };
  }

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
      try { const b = await bankDekking({ codenaam, centen: tekort }); if (b && b.ok) return { ok: true, bijgeladen: tekort, via: 'bank' }; }
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
    const r = await laadOp({ codenaam, centen: bedrag, idem: idem ? idem + ':autolaad' : null, oms: 'Automatisch bijgeladen' });
    if (r.error) return r;
    return { ok: true, bijgeladen: bedrag, via: 'kaart' };
  }
  async function bestaatLid(codenaam) {
    try { return !!(await keyVanCodenaam(codenaam)); } catch (e) { return false; }
  }

  return { laadOp, oplaadAfronden, koppelBank, reconcileVanMotor, zorgSaldo, bestaatLid };
}

module.exports = { maakOpladen };

/* ============================================================================
   EEN BETAALDE FACTUUR CORRIGEREN -- de terugweg van kern/factuursaldo.js.

   HERSTELBESLUIT.json verklaarde `POST /api/pay/saldo` als COMPENSATABLE, en
   het bewijsveld stond op BLOCKED met `watErMoetKomen`: "een route die op een
   BETAALDE factuur een tegenboeking zet via pay.huisUit, met dezelfde duurzame
   bundel als de heenweg, en die de afdracht NIET stil terugdraait maar haar
   eigen correctieregel schrijft". Dit is die route.

   COMPENSATABLE EN NIET REVERSIBLE, en dat is het hele ontwerp. De heenweg
   wordt niet uitgewist: de factuur blijft `paid`, het betaalbewijs blijft
   staan, en er komt een correctie NAAST met een eigen boeking. Dat is de regel
   van de eigenaar -- +500 / -500 / +450, en geen stilzwijgend verdwenen 500 --
   en het is bovendien het enige dat veilig is: 19 lezers in server/ en public/
   splitsen binair op `status === 'paid'` en tonen alles wat dat niet is als
   "open". Een `gecorrigeerd` erbij zou een terugbetaalde factuur bij het lid
   als openstaande schuld op het scherm zetten. Zie ./factuurcorrectie-gronden.js.

   WAT DE BUNDEL HIER WEL EN NIET DOET, en dit is met schade en schande geleerd.
   `db/bijeen.js` wikkelt het werk in try/FINALLY en niet in try/catch: werpt
   het werk, dan draait de finally alsnog en committeert wat er tot dan toe is
   gemuteerd. Een bundel is hier dus GEEN rollback. Precies die aanname stond
   eerder fout in kern/factuursaldo.js, waar een mislukte afwikkeling antwoordde
   met "er is niets afgeschreven" terwijl het geld al geboekt kon zijn.

   Daarom staat de VOLGORDE hier vast, en die is de bescherming in plaats van de
   bundel:

     1. eerst het geld terug (pay.huisUit, met een deterministische sleutel);
     2. daarna pas de correctieregel op de factuur en op de afdracht.

   Breekt het tussen 1 en 2, dan is het geld terug en ontbreekt de aantekening.
   Een herhaling geneest dat: dezelfde sleutel geeft dezelfde boeking terug, er
   gaat geen tweede euro heen, en de aantekening wordt alsnog geschreven.
   Andersom -- eerst schrijven, dan boeken -- zou een factuur achterlaten die
   zegt dat er is terugbetaald terwijl er niets is verplaatst, en dat is de
   ergste van de twee.

   HET GELD BLIJFT BINNEN HET HUIS. `pay.huisUit` schrijft bij op de RTG
   Pay-wallet van het lid; er gaat niets naar een bank en niets naar buiten. Dat
   is dezelfde weg als kern/assets/winkel.js bij een herroeping, en het is de
   reden dat deze route mag uitvoeren in plaats van alleen klaarzetten: GELD.md
   par. 3 gaat over geld dat het huis verlaat. Wil een lid het daarna op zijn
   bankrekening, dan is dat de bestaande terugstortweg met zijn eigen besluit.
   ========================================================================== */
'use strict';

const { GRONDEN, GROND, NIET_GEBOUWD } = require('./factuurcorrectie-gronden');

function maakFactuurCorrectie({ db, accounts, payVan, fonds, bijeen, log, broadcastSync }) {
  const bezig = new Set();

  /* Wat er op deze factuur werkelijk is binnengekomen. NIET `bijdrage`: dat is
     wat er gevraagd wérd, en bij een deelbetaling is dat meer dan er staat. */
  const ontvangenCenten = (inv) => Math.round(Number(inv && inv.deelbetaald) || 0);

  async function corrigeerFactuur({ own, accountId, wie, tier, codenaam, invoiceId, grond, reden, door }) {
    // dezelfde zekering als de heenweg: staat betalen stil, dan ook dit
    const zPay = db.data.techniek && db.data.techniek.zekeringen && db.data.techniek.zekeringen.betalingen;
    if (zPay && zPay.aan === false) return { status: 503, error: 'Betalen is tijdelijk uitgeschakeld.' };

    const g = GROND.get(String(grond || ''));
    if (!g) return { status: 400, error: 'Kies een grond: ' + GRONDEN.map(x => x.id).join(', ') + '.' };
    const uitleg = String(reden || '').trim();
    if (uitleg.length < 3) return { status: 400, error: 'Een correctie draagt altijd een reden.' };
    /* WIE HEM ZET HOORT ERBIJ. Een terugbetaling zonder naam is een bedrag dat
       uit het niets komt; bij een geschil is dat precies het veld dat je zoekt. */
    const mens = String(door || '').trim();
    if (!mens) return { status: 400, error: 'Een correctie wordt gezet door een mens, en die naam hoort erbij.' };

    const pay = payVan && payVan();
    if (!pay) return { status: 503, error: 'De betaalkern is nog niet wakker; probeer het zo weer.' };
    if (!codenaam) return { status: 409, error: 'Zonder codenaam is er geen wallet om op bij te schrijven.' };

    const md = own ? accounts.getMemberState(accountId) : db.data;
    const inv = md && (md.invoices || []).find(i => i.id === String(invoiceId || ''));
    if (!inv) return { status: 404, error: 'Factuur niet gevonden.' };
    /* ALLEEN EEN BETAALDE FACTUUR. Op een openstaande factuur valt niets te
       compenseren -- die trek je in, en dat is een andere handeling. */
    if (inv.status !== 'paid') return { status: 409, error: 'Alleen een betaalde factuur kan worden gecorrigeerd.' };

    const centen = ontvangenCenten(inv);
    if (centen < 1) return { status: 409, error: 'Op deze factuur is niets ontvangen om terug te boeken.' };

    /* AL GECORRIGEERD IS KLAAR, en dat is een toestandscontrole en geen
       idempotentie -- het onderscheid staat in de kop van lib/idem-poort.js.
       De sleutel hieronder doet het echte werk; dit voorkomt alleen dat er een
       tweede regel bij komt. */
    if (Array.isArray(inv.correcties) && inv.correcties.length) {
      return { ok: true, herhaald: true, correctie: inv.correcties[0] };
    }

    const slot = wie + ':corr:' + inv.id;
    if (bezig.has(slot)) return { status: 409, error: 'Deze correctie loopt al.' };
    bezig.add(slot);
    try {
      let uit = null;
      const werk = async () => {
        /* STAP 1: HET GELD. Deterministische sleutel uit het factuurnummer, dus
           een herhaald verzoek boekt nooit een tweede keer terug -- de
           aanroeper kan hem niet weglaten. */
        const b = await pay.huisUit({
          aanCodenaam: codenaam, centen,
          oms: 'Correctie RTG factuur ' + inv.id,
          idem: 'inv-correctie:' + inv.id
        });
        if (b && b.error) { uit = b; return; }

        /* STAP 2: DE AANTEKENING. Pas nu, en nooit ervoor. */
        const regel = {
          id: 'CORR-' + inv.id,
          grond: g.id, grondLabel: g.label, signaalVan: g.wie,
          reden: uitleg, door: mens,
          centen, boeking: (b && b.boeking) || null,
          at: new Date().toISOString()
        };
        if (!Array.isArray(inv.correcties)) inv.correcties = [];
        inv.correcties.push(regel);

        /* DE AFDRACHT KRIJGT HAAR EIGEN REGEL EN WORDT NIET WEGGEHAALD. Het
           geld ervan is niet te verplaatsen -- er is geen positie van de
           RTFoundation om aan te betalen (GIFT.md) -- dus staat er wat er is:
           de afdracht is gedaan, de factuur eronder is gecorrigeerd, en het
           geld is NIET geregeld. Dezelfde vorm als kern/reisbureau-nazorg.js;
           een leeg veld zou als "afgehandeld" gelezen worden. */
        merkAfdracht(inv, regel);

        if (own) await accounts.saveMemberState(accountId, md);
        else if (typeof db.save === 'function') await db.save();
        uit = { ok: true, correctie: regel, teruggeboekt: centen };
      };

      if (typeof bijeen === 'function') {
        try { await bijeen(werk, { duurzaam: true }); }
        catch (e) {
          /* GEEN BEVESTIGING IS GEEN BEWIJS DAT ER NIETS IS GEBEURD. De bundel
             committeert in zijn finally, dus het geld kan al terug zijn. Dit
             antwoord belooft dus niets over de uitkomst, alleen over wat wij
             weten -- en de sleutel maakt een herhaling veilig. */
          if (log && log.error) log.error('[factuurcorrectie] bundel wierp', { factuur: inv.id, fout: e.message });
          return uit && uit.error ? uit : {
            status: 503,
            error: 'De correctie kon niet worden bevestigd. Controleer de wallet van dit lid voordat je het opnieuw probeert.'
          };
        }
      } else await werk();

      if (uit && uit.error) return uit;
      if (broadcastSync && tier) broadcastSync([tier], 'payments');
      return uit;
    } finally { bezig.delete(slot); }
  }

  /* De correctieregel op de afdracht. Hij zet GEEN status om en haalt niets
     weg: de afdracht is echt gebeurd. */
  function merkAfdracht(inv, regel) {
    if (!fonds || !fonds.isAbonnement || !fonds.isAbonnement(inv.desc)) return;
    const rijen = (db.data && db.data.fondsAfdrachten) || [];
    const a = rijen.find(x => x && x.invoiceId === inv.id);
    if (!a) return;
    a.correctie = {
      factuurCorrectieId: regel.id, grond: regel.grond, reden: regel.reden,
      door: regel.door, at: regel.at,
      geld: {
        stand: 'nietGeregeld',
        uitleg: 'De factuur onder deze afdracht is gecorrigeerd en het lid heeft zijn geld terug. ' +
          'De afdracht zelf is NIET teruggehaald: er is geen positie van de RTFoundation om aan te ' +
          'betalen (GIFT.md). Een mens handelt dit af met de stichting; dit systeem heeft hiervoor ' +
          'niets verplaatst.'
      }
    };
  }

  return { corrigeerFactuur, GRONDEN, GROND, NIET_GEBOUWD, ontvangenCenten };
}

module.exports = { maakFactuurCorrectie, GRONDEN, GROND, NIET_GEBOUWD };

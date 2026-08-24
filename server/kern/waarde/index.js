/* DE WAARDELAAG: elke positie in het grootboek weet wat hij is.

   RTG Pay boekt centen van de ene rekening naar de andere en dat blijft zo --
   deze laag boekt niets en houdt geen saldo bij (GELD.md par. 1: geen tweede
   boekhouding). Wat hij toevoegt is BETEKENIS aan een rekening: welke klasse,
   van welke uitgever, met welk beleid, tot wanneer, en met welk plafond.

   DE POORT is waar het op aankomt. `poort()` is de enige functie die RTG Pay
   aanroept, en hij beantwoordt in EEN keer de drie vragen die voor een boeking
   uit elkaar gehouden moeten worden:

     1. is er genoeg BESCHIKBAAR (saldo min wat vastgezet staat)?
     2. MAG deze waarde hiervoor worden gebruikt (de beleidstoets)?
     3. past het bedrag nog binnen het PLAFOND van de ontvangende positie?

   Die derde vraag is de reden dat dit bestand bestaat. Het besluit onder
   WALLET_SALDO in kern/bevoegdheid/lijst.js zegt sinds zijn eerste regel dat
   het gesloten circuit "een maximum per wallet en per boeking" kent, en dat de
   grond onder het besluit wegvalt als die plafonds worden losgelaten. Er was
   alleen nooit een maximum per wallet: kern/pay/stand.js kent MAX_CENTEN (per
   boeking) en KASCODE_MAX, en verder niets. Een lid kon dus onbeperkt opladen.
   Het besluit beschreef een werkelijkheid die de code niet had.

   WAT HIER GEEN OORDEEL IS. Deze laag zegt niet of RTG BEVOEGD is -- dat is
   kern/bevoegdheid, en die vraag gaat over RTG. Deze gaat over de waarde zelf.
   Ze staan naast elkaar en vervangen elkaar niet: een uitbetaling die van de
   klasse mag, kan nog steeds op een ontbrekende vergunning stuklopen. */
'use strict';

const { KLASSEN, SOORTEN, STANDAARD } = require('./klassen');
const { toets } = require('./policy');
const { maakReserve } = require('./reserve');

/* Welke rekeningen zijn een waardepositie? De extern-rekeningen NIET: die zijn
   de tegenkant van het dubbel boekhouden (daar staat de echte kaartbetaling of
   payout tegenover) en mogen juist negatief staan. Een plafond of een
   beleidstoets daarop zou het grootboek laten klemmen op zijn eigen sluitpost. */
function klasseVan(rek) {
  const r = String(rek || '');
  if (r.startsWith('lid:')) return 'PERSONAL_FUNDED';
  if (r.startsWith('partner:')) return 'PARTNER_SETTLEMENT';
  /* Een uitgegeven positie hoort altijd geregistreerd te zijn -- ./uitgifte.js
     maakt de registratie en de rekening in dezelfde handeling. Staat er toch
     eentje zonder, dan is dat een fout, en dan valt hij terug op de STRENGSTE
     klasse en niet op "geen regels". Een positie waarvan we het niet weten,
     krijgt niet stilzwijgend de ruimste rechten. */
  if (r.startsWith('waarde:')) return STANDAARD;
  return null;
}

function maakWaarde({ db, save, crypto, nu = () => Date.now() }) {
  const reserve = maakReserve({ db, save, crypto, nu });

  function posities() {
    if (!db.data.waardePosities || typeof db.data.waardePosities !== 'object') db.data.waardePosities = {};
    return db.data.waardePosities;
  }

  /* De positie van een rekening. Staat er niets geregistreerd, dan volgt de
     klasse uit de naam van de rekening -- zo hoeven de duizenden bestaande
     wallets niet eerst een registratie te krijgen om onder een plafond te
     vallen. Een lege registratie mag nooit "geen regels" betekenen. */
  function positie(rek) {
    const eigen = posities()[rek];
    const klasse = (eigen && KLASSEN[eigen.klasse]) ? eigen.klasse : klasseVan(rek);
    if (!klasse) return null;
    return { rek, klasse, spec: KLASSEN[klasse],
      uitgever: (eigen && eigen.uitgever) || null,
      eigenaar: (eigen && eigen.eigenaar) || (rek.startsWith('lid:') ? rek.slice(4) : null),
      beleid: (eigen && eigen.beleid) || {},
      vervaltOp: (eigen && Number.isFinite(eigen.vervaltOp)) ? eigen.vervaltOp : null,
      sinds: (eigen && eigen.sinds) || null, geregistreerd: !!eigen };
  }

  function registreer({ rek, klasse, uitgever, eigenaar, beleid, vervaltOp }) {
    if (!rek) return { status: 400, error: 'Welke rekening?' };
    if (!KLASSEN[klasse]) return { status: 400, error: 'Kies een klasse: ' + SOORTEN.join(', ') + '.' };
    const spec = KLASSEN[klasse];
    const verval = Number.isFinite(vervaltOp) ? vervaltOp
      : (spec.vervaltNaDagen ? nu() + spec.vervaltNaDagen * 86400000 : null);
    posities()[rek] = { klasse, uitgever: uitgever || null, eigenaar: eigenaar || null,
      beleid: beleid || {}, vervaltOp: verval, sinds: nu() };
    save();
    return { ok: true, positie: positie(rek) };
  }

  /* Beschikbaar is saldo min wat vastgezet staat. Dit is het getal waar een
     bestedingsvraag tegenaan hoort, en niet het saldo -- zie ./reserve.js. */
  function beschikbaar(rek, saldo) {
    return Math.round(Number(saldo) || 0) - reserve.vastgezet(rek);
  }

  /* Ruimte onder het plafond van de ONTVANGENDE positie. Geen positie of geen
     plafond (een zaak int een dag lang door) -> oneindig, en dan is dit een
     no-op in plaats van een grens die niemand heeft besloten. */
  function ruimte(rek, saldo) {
    const p = positie(rek);
    if (!p || !Number.isFinite(p.spec.plafondCenten)) return Infinity;
    return p.spec.plafondCenten - Math.round(Number(saldo) || 0);
  }

  /* DE POORT. Geeft `null` als de boeking door mag, en anders exact het
     foutobject dat RTG Pay teruggeeft -- zelfde vorm als de rest van die laag
     ({ status, error }), zodat de aanroeper niets hoeft te vertalen. */
  function poort({ van, naar, centen, soort, saldoVan, genre, dagBesteed, eigenBeleid }) {
    const c = Math.round(Number(centen) || 0);
    const saldo = r => Math.round(Number(saldoVan ? saldoVan(r) : 0) || 0);

    // 1 + 2: de betalende kant, maar alleen als dat een waardepositie is
    const bron = positie(van);
    if (bron) {
      const vrij = beschikbaar(van, saldo(van));
      if (vrij < c) {
        const vast = reserve.vastgezet(van);
        return vast > 0
          ? { status: 402, error: 'Onvoldoende beschikbaar saldo: er staat ' + (vast / 100).toFixed(2) + ' euro gereserveerd.', beschikbaar: vrij, gereserveerd: vast }
          : { status: 402, error: 'Onvoldoende saldo.', beschikbaar: vrij };
      }
      /* DE AARD VAN DE HANDELING, en dit is de enige plek waar die wordt
         bepaald -- dus ook de plek waar een stilzwijgende uitzondering hoort op
         te vallen in plaats van weg te zakken.

         `extern:bank` telt hier met OPZET niet als uitbetalen. Dat is de brug
         naar de eigen RTG Bank (kern/bank/walletbrug.js) en het geld blijft
         binnen het huis: aan de andere kant staat een RTG-rekening, geen derde.
         Pas de SEPA daarna verlaat het stelsel, en die hangt aan een eigen
         bevoegdheid (SEPA_UIT in kern/bevoegdheid/lijst.js) die de boardroom
         kan dichtzetten.

         Daarmee is de keten wallet -> bank -> SEPA wel degelijk een weg waarlangs
         walletsaldo bij het lid terecht kan komen, terwijl het besluit
         WALLET_SALDO zegt dat het "niet wordt uitbetaald aan het lid". Die twee
         staan op gespannen voet. Het dichtzetten van die keten is een besluit
         over het product en niet een reparatie, dus het gebeurt hier niet
         stilletjes; het staat als open vraag in WAARDE.md par. 9. Wat hier wel
         gebeurt: de uitzondering heeft een naam en een reden, zodat de volgende
         die hem leest ziet dat er over is nagedacht. */
      const HUISINTERN = ['extern:bank', 'extern:treasury'];
      const aard = soort === 'uitbetaling' ? 'uitbetalen'
        : String(naar || '').startsWith('lid:') ? 'overdragen'
        : HUISINTERN.includes(String(naar || '')) ? 'huisintern'
        : 'besteden';
      const o = toets(bron, { centen: c, genre, soort: aard, dagBesteed,
        ontvanger: String(naar || '').replace(/^partner:/, ''), nu: nu() }, eigenBeleid);
      if (!o.mag) return { status: 403, error: o.uitleg, reden: o.reden, klasse: bron.klasse, ...(o.opheffbaar ? { opheffbaar: true } : {}) };
    }

    // 3: het plafond van de ontvangende kant
    const doel = positie(naar);
    if (doel && Number.isFinite(doel.spec.plafondCenten)) {
      const over = ruimte(naar, saldo(naar));
      if (c > over) return { status: 409,
        error: 'Dit past niet meer binnen het maximum van ' + (doel.spec.plafondCenten / 100).toFixed(0) + ' euro voor ' + doel.spec.naam.toLowerCase() + '.',
        reden: 'plafond', plafondCenten: doel.spec.plafondCenten, ruimte: Math.max(0, over) };
    }
    return null;
  }

  /* De alleen-lezen kant (./kijken.js): wat een lid heeft en wat er op een
     positie staat. Daar komen save noch registreer binnen -- wie er iets
     verandert kan per definitie niets aan een positie wijzigen. Zelfde reden
     als kern/pay/kijken.js. */
  const kijk = require('./kijken')({ posities, positie, beschikbaar, ruimte, reserve, KLASSEN });

  const api = { KLASSEN, SOORTEN, STANDAARD, positie, registreer, beschikbaar, ruimte, poort, toets,
    positiesVan: kijk.positiesVan, overzicht: kijk.overzicht, portefeuille: kijk.portefeuille,
    reserveer: reserve.reserveer, vastleggen: reserve.vastleggen, vrijgeven: reserve.vrijgeven,
    gereserveerd: reserve.vastgezet, reserveringen: reserve.open,
    reserveringenVan: reserve.voorRef, reservering: reserve.vind };
  Object.assign(api, require('./uitgifte')({ api, crypto, nu }));
  /* De samenstelling (./samenstellen.js): uit welke potjes komt deze betaling,
     en in welke volgorde. Rekent alleen uit; boeken doet kern/pay/samen.js,
     langs dezelfde poort als elke andere betaling. */
  Object.assign(api, require('./samenstellen')({ KLASSEN, positie: api.positie,
    positiesVan: api.positiesVan, beschikbaar: api.beschikbaar, toets }));
  return { waarde: api };
}

module.exports = { maakWaarde, klasseVan };

/* HET OORDEEL: mag deze boeking door?

   Afgesplitst uit ./index.js, dat de OPBOUW doet (registratie, saldi-rekenwerk,
   de deelmodules aan elkaar knopen). Dit bestand doet de BESLISSING, en dat is
   het stuk met de meeste redenering per regel -- het hoort niet tussen de
   bedrading te staan.

   Drie vragen, in deze volgorde:

     1. is er genoeg BESCHIKBAAR (saldo min wat vastgezet staat)?
     2. MAG deze waarde hiervoor worden gebruikt (klasse, uitgever, houder)?
     3. past het bedrag binnen het PLAFOND van de ontvangende positie?

   De derde is de reden dat de hele waardelaag bestaat: het besluit WALLET_SALDO
   in kern/bevoegdheid/lijst.js belooft "een maximum per wallet", en dat maximum
   bestond nergens (zie WAARDE.md par. 3).

   Geeft `null` als de boeking door mag, en anders exact het foutobject dat RTG
   Pay teruggeeft ({ status, error, ... }), zodat de aanroeper niets hoeft te
   vertalen. */
'use strict';

module.exports = ({ positie, beschikbaar, ruimte, reserve, toets, nu }) => {

  /* Geeft `null` als de boeking door mag, en anders exact het
     foutobject dat RTG Pay teruggeeft -- zelfde vorm als de rest van die laag
     ({ status, error }), zodat de aanroeper niets hoeft te vertalen. */
  function poort(h) {
    const { van, naar, centen, soort, saldoVan, genre, dagBesteed, eigenBeleid } = h;
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
      /* GELD TERUGGEVEN IS GEEN OVERDRACHT, en dat onderscheid ontbrak hier.

         Een zaak die een reiziger compenseert voor een uitgevallen bus boekt van
         `partner:` naar `lid:`. Dat werd hierboven als 'overdragen' gelezen, en
         een partnersaldo is niet overdraagbaar -- dus weigerde de poort elke
         teruggave. test/ovkaart.test.js viel er als eerste over, en terecht: het
         is dezelfde beweging als een terugbetaling, een creditnota of een
         geannuleerd kaartje.

         De regel is structureel en geen lijst met soortnamen: gaat er waarde van
         een ZAAK naar een LID, dan is dat per definitie geld dat terugkomt bij de
         klant. Een zaak deelt geen saldo uit aan willekeurige leden -- daar is
         `budget` voor, en dat loopt langs ./uitgifte.js met een eigen klasse.
         Een lijst met namen ('terug', 'ovteruggave', ...) zou hier alleen werken
         tot de volgende die iemand verzint. */
      const vanZaak = bron.klasse === 'PARTNER_SETTLEMENT';
      const naarLid = String(naar || '').startsWith('lid:') || String(naar || '').startsWith('waarde:');
      const aard = soort === 'uitbetaling' ? 'uitbetalen'
        : (vanZaak && naarLid) ? 'teruggave'
        : String(naar || '').startsWith('lid:') ? 'overdragen'
        : HUISINTERN.includes(String(naar || '')) ? 'huisintern'
        : 'besteden';
      const o = toets(bron, { centen: c, genre, soort: aard, dagBesteed,
        dagBestedTotaal: h.dagBestedTotaal, maandBestedTotaal: h.maandBestedTotaal,
        ontvanger: String(naar || '').replace(/^partner:/, ''), nu: nu() }, eigenBeleid);
      /* Het hele oordeel gaat mee naar boven, niet alleen de reden. Wélke grens
         het was, hoeveel er al besteed is, welke genres wel mogen -- dat is
         precies wat het lid nodig heeft om te begrijpen waarom de deur dichtging.
         Eerst stonden hier drie handgekozen velden en viel de rest stil weg;
         dan leest een lid "dit gaat over een grens die u zelf heeft ingesteld"
         zonder te horen wélke, en dat is geen uitleg maar een raadsel.

         Wat een ZAAK hiervan te zien krijgt, is een andere vraag, en die wordt
         beantwoord in server/routes/pay-zaak.js: daar gaat alles er weer af. */
      if (!o.mag) {
        const uit = { status: 403, error: o.uitleg, klasse: bron.klasse };
        for (const k in o) if (k !== 'mag' && k !== 'uitleg') uit[k] = o[k];
        return uit;
      }
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

  return poort;
};

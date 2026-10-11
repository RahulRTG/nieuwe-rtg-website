/* Kantoren, deel "bank-afstemming": een ONBEKENDE uitbetaling sluiten op een
   afschriftregel die een mens overneemt (MONEY-012).

   Een geauthenticeerd kanaal van de rail sluit zo'n opdracht vanzelf (een
   herinzending met dezelfde sleutel). Maar zolang er geen echte uitbetaalrail
   is, is er geen ander kanaal -- en dan zou ONBEKEND het geld voor altijd
   vastzetten. Deze route is de tweede weg: een kantoormens neemt over wat het
   afschrift zegt, en een TWEEDE mens tekent af. Besluit van de eigenaar
   (24 september 2026): beide wegen, met vier ogen.

   WAAROM VIER OGEN. De uitspraak `niet-uitgevoerd` boekt geld terug naar een
   rekening. Wie dat in zijn eentje kan op basis van een regel die hij zelf
   overtypt, kan geld maken -- dezelfde reden waarom rood staan en de incasso al
   een tweede handtekening vragen (./bank-tweedehand.js).

   WAT DE AANVRAGER NIET ZET. De echtheid (`OVERGENOMEN`) komt uit deze route
   en niet uit het formulier: een mens kan niet opgeven dat de rail het zelf
   zei. En wie aftekent, komt uit de sessie.

   SINDS 11 OKTOBER 2026 LOOPT HIJ DOOR DE GELDKETEN (kern/kantoor/geldketen.js),
   als tweede handeling naast de incassoronde (MACHINE.md par. 5a). Twee dingen
   kwamen daarmee mee die er niet waren:
   - DE PASSKEY, bij aanvragen EN bij tekenen. `bank.afstemming` stond niet als
     `geld` aangemeld, dus de tweede handtekening ging zonder ceremonie -- terwijl
     `niet-uitgevoerd` geld terugboekt en het besluit van 25 september 2026 zegt dat
     een geldhandeling op kantoor niet meer op de terugval doorgaat
     (./bank-passkey.js). De STAND wordt eerst gekeurd en pas daarna de ceremonie:
     een weigering op 404/409/400 hoort geen passkey te vragen.
   - HET VOORNEMEN met besluit, tegenfeit, frictie, envelop en hashketen, zodat het
     dossier per as zegt wat er gebeurde (/api/office/bank/incasso/dossier leest
     elk dossier van de baan, ook dit).
   WAT ER NIET IS: `atomair`. Een terugboeking raakt twee duurzame waarheden (het
   grootboek en de opdracht) en is EENMAAL-geboekt op een economische sleutel
   (kern/betaalopdracht/terugboeking.js): hervatbaar, niet alles-of-niets. De klasse
   `geld-eenmalig` eist atomair, dus deze keten is NIET volledig en het dossier
   zegt dat -- liever een open as dan een belofte die de opslag niet doet. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, afdelingen, sseToOffice, kern, tweedeHand, zwaar, boardroomUser, naam } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  tweedeHand.registreer('bank.afstemming', {
    wat: 'een uitbetaling met onbekende uitkomst afstemmen op een afschriftregel', geld: true,
    voerUit: async (lijf, wie) => {
      const ketenlaag = kern.geldketen;
      if (!ketenlaag) return { status: 503,
        error: 'De geldketen is niet gemount; een afstemming gaat niet buiten de keten om.' };
      /* Een aanvraag van voor de geldketen draagt geen voornemen. Zij gaat niet stil de
         oude weg (geld terugboeken zonder besluit, bewijs of spoor), maar weigert met de
         weg erbij -- dezelfde regel als bij de incassoronde in ./bank-tweedehand.js. */
      const vid = lijf && lijf.voornemen ? String(lijf.voornemen) : '';
      if (!vid) return { status: 409,
        error: 'Deze aanvraag draagt geen voornemen en is van voor de geldketen. Vraag de ' +
          'afstemming opnieuw aan; dan loopt zij langs het besluit en het bewijs.' };
      const bevestiger = (wie && wie.bevestigdDoor) || null;
      const tekenen = ketenlaag.tekenAf({ id: vid, door: bevestiger });
      // 409 = het voornemen stond niet op WACHT (binnen het beleid); dan gaat de uitvoering door
      if (tekenen && tekenen.error && tekenen.status !== 409) return tekenen;
      let r = null;
      const k = await ketenlaag.uitvoer({ id: vid, door: bevestiger, verzoek: wie && wie.verzoek,
        /* Uitgevoerd wordt wat in het voornemen BEVROREN is (stap.gegevens), niet het
           lijf van de aanvraag: dat is wat gewogen en getekend werd. */
        doe: async (stap) => {
          const g = (stap && stap.gegevens) || {};
          r = await bank.bankOpdrachtStemAf({ id: g.id, uitspraak: g.uitspraak, providerRef: g.providerRef,
            centen: g.centen, valuta: g.valuta, bron: g.bron,
            echtheid: 'OVERGENOMEN', wie: { aangevraagdDoor: (wie && wie.aangevraagdDoor) || null,
              bevestigdDoor: bevestiger } });
          if (r && r.error) throw Object.assign(new Error(r.error), { status: r.status });
          return { uitkomst: r && r.uitkomst, id: r && r.id };
        } });
      if (r && r.uitkomst) {
        afdelingen.audit('tweede handtekening', 'Betaalopdracht ' + r.id + ' afgestemd: ' + r.uitkomst +
          ' (bron: ' + String(lijf.bron || '').slice(0, 80) + ', voornemen ' + vid + ')');
        sync();
      }
      /* De uitslag van de afstemming blijft naar buiten gaan, met het voornemen erbij:
         zelfde contract als de incassoronde (de baan komt erbij en niet in plaats van). */
      if (k && k.ok && r) return Object.assign({}, r, { voornemen: k.voornemen });
      return (r && r.error) ? r : k;
    }
  });

  /* De aanvraag. Eerst keuren -- bestaat hij, staat hij op ONBEKEND -- zodat een
     collega niet iets aftekent dat daarna een fout geeft die niet de zijne is. */
  /* mutatie: sleutelVereist -- het voornemen hangt aan de opdracht en de uitspraak
     (economische sleutel), dus een tweede aanvraag is hetzelfde voornemen; geld
     beweegt pas na de tweede handtekening. */
  app.post('/api/office/bank/opdrachten/afstemming', kluisAuth, async (req, res) => {
    const b = req.body || {};
    const id = String(b.id || '');
    const o = bank.bankOpdrachtVind(id);
    if (!o) return veilig(res, () => ({ status: 404, error: 'Die betaalopdracht bestaat niet.' }));
    if (o.status !== 'ONBEKEND') return veilig(res, () => ({ status: 409, huidig: o.status,
      error: 'Alleen een opdracht met onbekende uitkomst wordt afgestemd; deze staat op ' + o.status + '.' }));
    if (!['uitgevoerd', 'niet-uitgevoerd'].includes(b.uitspraak))
      return veilig(res, () => ({ status: 400, error: 'De uitspraak is "uitgevoerd" of "niet-uitgevoerd".' }));
    if (!String(b.bron || '').trim()) return veilig(res, () => ({ status: 400, error: 'Noem het afschrift of bericht waar dit uit komt.' }));
    const ketenlaag = kern.geldketen;
    if (!ketenlaag) return veilig(res, () => ({ status: 503,
      error: 'De geldketen is niet gemount; een afstemming gaat niet buiten de keten om.' }));

    /* ASSURANCE, gebonden aan deze ene opdracht en zonder terugval. */
    const sleutel = 'afstemming:' + id;
    const zw = await zwaar.eis(boardroomUser(req), 'bank.afstemming', sleutel, req,
      'Een uitbetaling afstemmen', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);

    const lijf = { id, uitspraak: b.uitspraak, providerRef: b.providerRef || null,
      centen: b.centen == null ? null : Number(b.centen), valuta: b.valuta || null, bron: String(b.bron).slice(0, 200) };
    const blik = bank.bankOpdrachtAfstemVooruitblik(lijf);
    if (!blik.ok) return veilig(res, () => blik);

    const klaar = ketenlaag.klaarzet({
      klasse: 'geld-eenmalig', handeling: 'GELD_AFSTEMMEN', pad: '/api/office/bank/opdrachten/afstemming',
      doel: 'afstemming ' + id + ' (' + b.uitspraak + ')',
      mens: { naam: naam(req), sleutel: req.officeKey },
      assurance: zw,
      streefstand: 'betaalopdracht ' + id + ' staat niet meer op ONBEKEND: ' +
        (blik.uitkomst === 'NIET_UITGEVOERD' ? 'het geld is precies een keer teruggeboekt'
          : blik.uitkomst === 'BEVESTIGD' ? 'hij is afgewikkeld op de referentie van de rail'
            : 'hij draagt een verschilzaak en er is niets met het geld gedaan'),
      tegenfeit: { graad: 'vermoed', uitslag: { uitkomst: blik.uitkomst, bedragCenten: blik.bedragCenten },
        reden: blik.grens, over: '/api/office/bank/handtekening/bevestig', effecten: blik.effecten },
      stappen: [{ wat: 'afstemming', doel: id, centen: blik.bedragCenten, gegevens: lijf }],
      totaalCenten: blik.bedragCenten,
      /* De economische sleutel: de opdracht plus de uitspraak. Twee medewerkers die
         hetzelfde afschrift overnemen, maken hetzelfde voornemen. */
      sleutel: sleutel + ':' + b.uitspraak,
      /* EERLIJK OVER DE UITVOERING: hervatbaar en niet atomair -- zie de kop. */
      uitvoerbelofte: { graad: 'onbekend', uitslag: 'niet alles-of-niets',
        reden: 'kern/betaalopdracht/terugboeking.js boekt de teruggang EENMAAL op een economische sleutel ' +
          'en de opdracht volgt in een tweede schrijfactie; valt die tweede uit, dan blijft de opdracht op ' +
          'MISLUKT in de openstaande lijst. Dat is hervatbaar, niet atomair.' },
    });
    if (!klaar.ok) return veilig(res, () => klaar);

    veilig(res, () => {
      const vraag = tweedeHand.vraag({ actie: 'bank.afstemming', lijf: Object.assign({}, lijf, { voornemen: klaar.voornemen.id }),
        onderwerp: id, door: req.officeKey });
      return vraag.ok ? Object.assign({}, vraag, { voornemen: klaar.voornemen, dossier: klaar.dossier, vooruitblik: blik }) : vraag;
    });
  });
};

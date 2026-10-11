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
   naast de incassoronde (MACHINE.md par. 5a), met een PASSKEY bij aanvragen en
   tekenen (besluit 25 september 2026, ./bank-passkey.js) -- de stand wordt eerst
   gekeurd. `atomair` staat met opzet open: een terugboeking is eenmaal-geboekt op
   een economische sleutel en de opdracht volgt in een tweede schrijfactie
   (kern/betaalopdracht/terugboeking.js). De keten is dus NIET volledig. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, kern, tweedeHand, zwaar, boardroomUser, naam } = ctx;
  const bank = kern.bank;

  /* De uitvoering (wat er gebeurt zodra de tweede mens tekent) staat in
     ./bank-afstemming-uitvoer.js: zij hoort bij de HANDELING en niet bij deze deur. */
  require('./bank-afstemming-uitvoer')(ctx);

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

    /* De vooruitblik VOOR de passkey: hij schrijft niets, en hij weigert wat de
       uitvoering ook zou weigeren (zoals een uitgevoerde betaling zonder referentie). */
    const lijf = { id, uitspraak: b.uitspraak, providerRef: b.providerRef || null,
      centen: b.centen == null ? null : Number(b.centen), valuta: b.valuta || null, bron: String(b.bron).slice(0, 200) };
    const blik = bank.bankAfstemBlik(lijf);
    if (!blik.ok) return veilig(res, () => blik);

    /* ASSURANCE, gebonden aan deze opdracht EN deze uitspraak, zonder terugval. */
    const zw = await zwaar.eis(boardroomUser(req), 'bank.afstemming', 'afstemming:' + id + ':' + b.uitspraak, req,
      'Een uitbetaling afstemmen', { zonderTerugval: true });
    if (!zw.ok) return zwaar.stuur(res, zw);

    /* DE ECONOMISCHE SLEUTEL: de opdracht, de hoeveelste afstemming het is, en de
       invoer. Twee medewerkers die hetzelfde afschrift overnemen maken hetzelfde
       voornemen; maar na een VERSCHIL (de opdracht blijft ONBEKEND) is een correctie
       een NIEUW voornemen -- met alleen de uitspraak in de sleutel kreeg die het oude,
       al uitgevoerde voornemen terug en zat de opdracht vast (tegenlezing 11 oktober). */
    const ronde = (o.uitspraken || []).length;
    const invoer = require('crypto').createHash('sha256')
      .update([b.uitspraak, lijf.providerRef, lijf.centen, lijf.valuta].map(x => String(x == null ? '' : x)).join('|'))
      .digest('hex').slice(0, 16);
    const sleutel = 'afstemming:' + id + ':' + ronde + ':' + invoer;

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
      sleutel,
      /* EERLIJK OVER DE UITVOERING: niet atomair -- zie de kop. */
      uitvoerbelofte: { graad: 'onbekend', uitslag: 'niet alles-of-niets',
        reden: 'kern/betaalopdracht/terugboeking.js boekt de teruggang EENMAAL op een economische sleutel ' +
          'en de opdracht volgt in een tweede schrijfactie. Valt de terugboeking uit, dan blijft de opdracht ' +
          'op MISLUKT staan en vraagt het herstel een mens of een melding van de rail; dit pad pakt het niet ' +
          'zelf weer op. Niet atomair.' },
    });
    if (!klaar.ok) return veilig(res, () => klaar);
    /* Een voornemen dat al een eindstand heeft, krijgt geen nieuw ticket: dan zou een
       tweede mens tekenen voor iets dat niet meer uitgevoerd kan worden. */
    if (['UITGEVOERD', 'GESTAAKT', 'AFGEWEZEN'].includes(klaar.voornemen && klaar.voornemen.stand))
      return veilig(res, () => ({ status: 409, voornemen: klaar.voornemen,
        error: 'Over precies deze afstemming is al besloten (' + klaar.voornemen.stand + '). Klopt de invoer niet, ' +
          'neem dan het afschrift opnieuw over met de juiste gegevens.' }));

    veilig(res, () => {
      const vraag = tweedeHand.vraag({ actie: 'bank.afstemming', lijf: Object.assign({}, lijf, { voornemen: klaar.voornemen.id }),
        onderwerp: id, door: req.officeKey });
      return vraag.ok ? Object.assign({}, vraag, { voornemen: klaar.voornemen, dossier: klaar.dossier, vooruitblik: blik }) : vraag;
    });
  });
};

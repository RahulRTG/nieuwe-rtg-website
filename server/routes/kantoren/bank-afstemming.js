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
   zei. En wie aftekent, komt uit de sessie. */
'use strict';

module.exports = (ctx) => {
  const { app, kluisAuth, veilig, afdelingen, sseToOffice, kern, tweedeHand } = ctx;
  const bank = kern.bank;
  const sync = () => sseToOffice('sync', { scope: 'bank' });

  tweedeHand.registreer('bank.afstemming', {
    wat: 'een uitbetaling met onbekende uitkomst afstemmen op een afschriftregel',
    voerUit: async (lijf, wie) => {
      const r = await bank.bankOpdrachtStemAf(Object.assign({}, lijf, {
        echtheid: 'OVERGENOMEN', wie: { aangevraagdDoor: (wie && wie.aangevraagdDoor) || null,
          bevestigdDoor: (wie && wie.bevestigdDoor) || null } }));
      if (r && r.uitkomst) {
        afdelingen.audit('tweede handtekening', 'Betaalopdracht ' + r.id + ' afgestemd: ' + r.uitkomst +
          ' (bron: ' + String(lijf.bron || '').slice(0, 80) + ')');
        sync();
      }
      return r;
    }
  });

  /* De aanvraag. Eerst keuren -- bestaat hij, staat hij op ONBEKEND -- zodat een
     collega niet iets aftekent dat daarna een fout geeft die niet de zijne is. */
  app.post('/api/office/bank/opdrachten/afstemming', kluisAuth, (req, res) => veilig(res, () => {
    const b = req.body || {};
    const id = String(b.id || '');
    const o = bank.bankOpdrachtVind(id);
    if (!o) return { status: 404, error: 'Die betaalopdracht bestaat niet.' };
    if (o.status !== 'ONBEKEND') return { status: 409, huidig: o.status,
      error: 'Alleen een opdracht met onbekende uitkomst wordt afgestemd; deze staat op ' + o.status + '.' };
    if (!['uitgevoerd', 'niet-uitgevoerd'].includes(b.uitspraak))
      return { status: 400, error: 'De uitspraak is "uitgevoerd" of "niet-uitgevoerd".' };
    if (!String(b.bron || '').trim()) return { status: 400, error: 'Noem het afschrift of bericht waar dit uit komt.' };
    return tweedeHand.vraag({
      actie: 'bank.afstemming',
      lijf: { id, uitspraak: b.uitspraak, providerRef: b.providerRef || null,
        centen: b.centen == null ? null : Number(b.centen), valuta: b.valuta || null, bron: String(b.bron).slice(0, 200) },
      onderwerp: id,
      door: req.officeKey
    });
  }));
};

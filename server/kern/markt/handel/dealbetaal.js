/* Markt-handel: de koper betaalt de verkoper -- via de betaalwaarheid.

   WAAROM. dealBetaal riep betaal.maakBetaling rechtstreeks aan en zette ELKE
   uitkomst die geen "betaald" was en geen clientSecret droeg op betaald: een
   geweigerde, hangende of teruggeboekte betaling werd "Betaald via Apple Pay",
   de advertentie "verkocht", en de verkoper kreeg het seintje dat hij kon
   overhandigen (test/marktdeal-betaal.test.js). Geen rail anders dan Stripe
   geeft een clientSecret, dus bij elke andere provider kwam iedere weigering
   als betaling door.

   NU zoals opladen en bank-storten (MONEY-012): betaalWaarheid.maak + begin met
   een eigen soort (markt-deal) en een sleutel per factuur, zodat een tweede tik
   dezelfde betaling is. DE AFHANDELAAR is de enige plek die de deal op betaald
   zet -- of de bevestiging nu meteen, via een webhook of via de veegronde komt
   -- en hij doet het precies een keer. Het lid hoort de zin van de stand
   (../../pay/oplaadstand.js): geweigerd is af, lopend wacht. */
'use strict';
const stand = require('../../pay/oplaadstand');

module.exports = (ctx, { chatMet, isDeelnemer, rolIn, chatPub }) => {
  const { save, nu, pk, vind, sein, betaalWaarheid } = ctx;

  /* Precies een keer, en alleen als de deal er nog is en nog niet betaald. */
  function zetBetaald(chat, methode) {
    if (!chat || !chat.deal || chat.deal.betaald) return false;
    const m = methode || 'apple-pay';
    chat.deal.betaald = true; chat.deal.status = 'betaald'; chat.deal.methode = m; chat.deal.betaaldAt = nu();
    const ad = vind(chat.adId); if (ad) ad.status = 'verkocht';
    chat.berichten.push({ van: pk(chat.koper), naam: chat.koper.naam, tekst: 'Betaald via ' + (m === 'apple-pay' ? 'Apple Pay' : m) + ': € ' + chat.deal.bedrag + '. Bedankt!', at: nu(), systeem: true });
    save();
    sein(chat.verkoper, { icon: 'pas', title: 'Betaald', body: chat.koper.naam + ' heeft € ' + chat.deal.bedrag + ' betaald voor "' + (chat.adTitel || '').slice(0, 30) + '".' });
    return true;
  }

  if (betaalWaarheid) betaalWaarheid.registreerAfhandeling('markt-deal', async (w) => {
    const c = w.context || {};
    zetBetaald(chatMet(c.cid), c.methode);
  });

  async function dealBetaal(cid, partij, methode) {
    const chat = chatMet(cid);
    if (!chat) return { error: 'Gesprek niet gevonden.', status: 404 };
    if (!isDeelnemer(chat, partij)) return { error: 'Dit gesprek is niet van jou.', status: 403 };
    if (rolIn(chat, partij) !== 'koper') return { error: 'Alleen de koper betaalt.', status: 403 };
    if (!chat.deal || !chat.deal.samen) return { error: 'Betalen kan pas als jullie samen zijn (locaties bij elkaar).', status: 409 };
    if (chat.deal.betaald) return { error: 'Deze aankoop is al betaald.', status: 409 };
    if (!betaalWaarheid) return { error: 'De betaalrail is niet beschikbaar. Er is niets afgeschreven.', status: 503 };
    const m = ['apple-pay', 'ideal', 'kaart'].includes(methode) ? methode : 'apple-pay';
    let w;
    try {
      w = betaalWaarheid.maak({ actor: 'markt:' + pk(partij), soort: 'markt-deal', bronRef: cid,
        idem: 'markt-deal:' + cid + ':' + chat.deal.factuur.nummer, centen: Math.round(chat.deal.bedrag * 100),
        valuta: 'eur', context: { cid, methode: m } });
    } catch (e) { return { status: 409, error: e.message }; }
    const alGestart = !!w.providerId;
    let uit;
    try { uit = await betaalWaarheid.begin(w.id, { omschrijving: 'De Salon: ' + (chat.adTitel || 'aankoop') }); }
    catch (e) { return stand.naFout(betaalWaarheid.van(w.id), e, alGestart, w.id); }
    const r = betaalWaarheid.van(w.id);
    if (r && r.afgehandeldAt && chat.deal.betaald)
      return { ok: true, betaald: true, factuur: chat.deal.factuur, betalingId: w.id, chat: chatPub(chat, partij) };
    const actie = uit && uit.actie;
    if (actie && actie.soort === 'client-bevestigen') {
      chat.deal.methode = m; chat.deal.clientSecret = actie.clientSecret; chat.deal.status = 'in-behandeling';
      save();
      return { ok: true, inBehandeling: true, clientSecret: actie.clientSecret, betalingId: w.id, chat: chatPub(chat, partij) };
    }
    return { status: 402, error: stand.zinNa(r && r.status), betalingId: w.id, betaalStatus: (r && r.providerStatus) || null };
  }

  return { dealBetaal };
};

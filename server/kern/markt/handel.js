/* Markt-handel: de chat tussen koper en verkoper en de veilige deal
   (prijs afspreken, beide GPS bij elkaar, factuur, betalen) plus het
   postvak. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/markt.js. */
module.exports = (ctx) => {
  // Chat ontvangt alleen berichten- en leesfuncties; de betaalwaarheid blijft
  // bij de deal. De projectie wordt pas aangeroepen nadat beide delen bestaan.
  const { save, notify, notifySupplier, store, nu, clip, pk, zichtbaar, vind,
    haversine, betaalWaarheid } = ctx;
  const deelChat = require('./handel/chat')({ save, notify, notifySupplier,
    store, nu, clip, pk, zichtbaar, vind, chatPub: (...a) => deelDeal.chatPub(...a) });
  const deelDeal = require('./handel/deal')({ save, store, nu, pk, vind,
    haversine, betaalWaarheid, chatId: deelChat.chatId, sein: deelChat.sein });
  const { reageer, antwoord, chatOpen } = deelChat;
  const { postvak, chatPub, dealVoorstel, dealHier, dealBetaal } = deelDeal;
  return { reageer, antwoord, postvak, chatOpen, chatPub, dealVoorstel, dealHier, dealBetaal };
};

/* Markt-handel: de chat tussen koper en verkoper en de veilige deal
   (prijs afspreken, beide GPS bij elkaar, factuur, betalen) plus het
   postvak. Krijgt de gedeelde context een keer bij het opstarten
   vanuit kern/markt.js. */
module.exports = (ctx) => {
  /* De chat- en deallaag draaien als deelmodules op de gedeelde context;
     de chatlaag gaat eerst de context in (de deallaag gebruikt chatId en
     sein), chatPub bindt de chatlaag per aanroep laat. */
  const deelChat = require('./handel/chat')(ctx);
  Object.assign(ctx, deelChat);
  const deelDeal = require('./handel/deal')(ctx);
  Object.assign(ctx, deelDeal);
  const { reageer, antwoord, chatOpen } = deelChat;
  const { postvak, chatPub, dealVoorstel, dealHier, dealBetaal } = deelDeal;
  return { reageer, antwoord, postvak, chatOpen, chatPub, dealVoorstel, dealHier, dealBetaal };
};

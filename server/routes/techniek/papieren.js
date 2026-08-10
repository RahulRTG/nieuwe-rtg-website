/* Techniek (deelmodule): het papierwerk dat Rahul uitvraagt.

   Hier stond in twee markdown-bestanden een rij [VUL IN]-plekken. Niemand vult
   een invullijst in, dus stond het er nog steeds. Nu vraagt Rahul het uit: één
   vraag per keer, met erbij waaróm hij het vraagt, en het antwoord landt
   meteen op de goede plek in het document.

   De handlers zelf staan in ../papieren-deur.js, want ze hangen sinds de
   boardroom-ronde op TWEE plekken: hier en in het kantoor. Twee deuren naar
   dezelfde gegevens met elk hun eigen code lopen uiteen zodra iemand er een
   aanraakt -- en dan verschilt wat de ene toelaat van wat de andere toelaat.

   Alles achter eigenaarAlleen. Niet uit gewoonte: hier komen het KvK-nummer,
   het privénummer van de jurist en de afspraak wie er 's nachts gebeld wordt.
   Dat is geen informatie voor iedereen met toegang tot het techniekbord.

   Gemount vanuit routes/techniek.js. */
module.exports = (tctx) => {
  const { app, accounts, techAuth, eigenaarAlleen, isEigenaar } = tctx;

  require('../papieren-deur')({
    app,
    prefix: '/api/techniek',
    // techAuth zet req.techUser; eigenaarAlleen leest die en is hier de
    // eigenaar-controle, dus isBaas hoeft er niets meer bovenop te doen
    poort: [techAuth, eigenaarAlleen],
    isBaas: (req) => (isEigenaar ? isEigenaar(req.techUser) : true),
    wie: (req) => {
      try { return req.techUser ? accounts.realNameOf(req.techUser) : null; }
      catch (e) { return null; }
    }
  });

  /* De go-live-keuring hangt hier om dezelfde reden: hij leest het papierwerk
     hierboven mee, en de eigenaar hoort op allebei de plekken hetzelfde
     oordeel te zien. De controles staan in server/golive.js. */
  require('../golive-deur')({
    app,
    prefix: '/api/techniek',
    poort: [techAuth, eigenaarAlleen],
    isBaas: (req) => (isEigenaar ? isEigenaar(req.techUser) : true)
  });
};

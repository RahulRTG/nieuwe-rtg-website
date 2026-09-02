/* WIE KIJKT HIER IN DE IDENTITEITSKLUIS?

   Eén antwoord op die vraag, voor iedereen die hem stelt. Hij stond in
   ./werk.js en werd van daaruit doorgegeven aan ./verificaties.js, met de
   reden er expliciet bij: "een tweede kopie van wie kijkt er in de kluis is
   precies de dubbeling van LAT.md regel 4". Toen het vakbewijs een eigen
   kluisdeur kreeg (routes/vakbewijs.js) stond die tweede kopie op het punt te
   ontstaan -- buiten het office-domein, dus zonder toegang tot die closure.
   Vandaar deze eigen module: één plek, drie lezers.

   WAT HIJ ZEGT, EN WAT NIET. De backoffice-code is GEDEELD. Een office-sessie
   alleen zegt dus "iemand van kantoor" en niet meer, en dat is eerlijker dan
   een verzonnen naam in het journaal. Komt de eigenaar met zijn eigen
   accountlogin binnen (officeAuth zet dan req.eigenaar), dan weten we het wel
   precies, en dan hoort dat er ook te staan.

   DE DERDE STAND IS ERBIJ GEKOMEN, en het is de stand die er hoorde te zijn.
   Wie via zijn eigen RTG-account de kantoorrol koppelt, krijgt een sessie MET
   een sleutel (kern/eenaccount/starten.js). Die sleutel is een codenaam-sleutel
   en geen naam uit de kluis -- precies wat hier hoort te staan: genoeg om de
   regel naar een mens terug te voeren, zonder de kluis open te trekken om hem
   op te schrijven.

   Sinds kern/kantoor/kluispoort.js komt de naamloze gedeelde sessie helemaal
   niet meer langs de zware deuren. Deze functie blijft hem toch kennen, want
   hij wordt ook op lichtere plekken gebruikt -- en een "wie kijkt hier" die
   liegt zodra hij het niet weet, is erger dan een die zwijgt. */
'use strict';

module.exports = (accounts) => function wieKijkt(req) {
  const h = req.get('authorization') || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : null;
  try {
    const u = tok && accounts.verifyToken(tok);
    if (u && req.eigenaar) return { id: u.id, naam: 'eigenaar' };
  } catch (e) {}
  /* De kluispoort heeft de sleutel al opgezocht en op het verzoek gezet; hem
     hier nog een keer uit de sessie halen zou een tweede plek zijn waar
     "welke kantoorsessie is dit" wordt uitgerekend. */
  if (req.kantoorKey) return { sleutel: req.kantoorKey, naam: 'kantoor op naam' };
  return { naam: 'backoffice (gedeelde code)' };
};

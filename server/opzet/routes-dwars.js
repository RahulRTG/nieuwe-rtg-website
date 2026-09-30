/* ============================================================================
   DE DWARSE ROUTERS: alles wat aan meer dan een domein hangt.

   WAAROM DIT EEN EIGEN BESTAND IS

   Hetzelfde als bij ./aanbouw.js, en om dezelfde reden: routes.js ging met
   10859 byte over de eigen 10 kB-grens (scripts/keuring.js, regel 13). Niet
   omdat er iets ingewikkelds bij kwam, maar omdat de lijst met los opgehangen
   routers blijft groeien -- elk nieuw onderwerp dat niet in een domein past
   komt hier terecht.

   WAAROM PRECIES DIT BLOK. Van alles in routes.js is dit het enige stuk dat
   niets anders aanraakt dan `grens`. De regels erboven kiezen de domeinen en
   bouwen de doorkijk; de regels eronder (werving) schrijven terug IN de kern
   met Object.assign. Dit blok hangt alleen routers op achter de poort van hun
   eigen naam. Dat maakte het als geheel te verplaatsen, zonder een tweede
   lijst met doorgegeven namen -- de dubbele boekhouding waar dit huis zich
   vaker op heeft gebrand.

   Nagerekend en niet gegokt: het blok is door scripts/lib/bron.js gehaald en
   daarna op vrije namen bekeken. Wat overbleef was `require` en `grens`. Het
   woord "kern" staat er vijf keer in, alle vijf in een zin die uitlegt waar de
   kern al vandaan komt -- geen daarvan is een verwijzing.

   DE VOLGORDE IS GEDRAG, GEEN SMAAK -- net als in routes.js. De regels zijn
   letterlijk overgenomen, in dezelfde volgorde, met hun eigen uitleg erbij.
   ========================================================================== */
'use strict';

module.exports = function hangDwarseRoutersOp(grens) {
  /* RTG Isolatiemodus voor het LID zelf (kern/isolatie/): zichzelf, deze sessie
     of dit toestel strenger zetten zonder RTG te bellen. De eigenaar-console
     staat in routes/techniek/isolatie.js en deelt dezelfde laag -- dit is de
     andere kant van dezelfde knop en niet een tweede knop. */
  require('../routes/isolatie')(grens('isolatie'));
  require('../routes/sleutelwoorden')(grens('sleutelwoorden'));
  require('../routes/agenda')(grens('agenda'));
  require('../routes/notities')(grens('notities'));
  /* RTG Vertegenwoordiging (kern/vertegenwoordiging/): een mens die handelt
     namens een mens. Dwars omdat hij aan geen enkel domein hangt -- hij gaat
     over de betrekking tussen twee leden en niet over wat zij doen. */
  require('../routes/vertegenwoordiging')(grens('vertegenwoordiging'));
  /* RTG Rugdekking (kern/rugdekking/): wat RTG een mens biedt die van zijn
     talent leeft. Ook dwars: het gaat over de betrekking tussen RTG en die
     mens, en niet over wat hij doet. */
  require('../routes/rugdekking')(grens('rugdekking'));
  /* Het carriere ledger (kern/carriereledger/): chronologisch, per regel
     bewijsbaar. Ook dwars -- een loopbaan hangt aan een MENS en niet aan een
     domein; dat is precies wat CARRIEREVORM.json meet (0 velden gedeeld over
     de vijftien talentdomeinen). */
  require('../routes/carriereledger')(grens('carriereledger'));
  require('./democratie-router')(grens);
  require('../routes/bestanden')(grens('bestanden'));
  require('../routes/meet')(grens('meet'));
  require('../routes/galerij')(grens('galerij'));
  require('../routes/klok')(grens('klok'));
  require('../routes/vertaal')(grens('vertaal'));
  require('../routes/memo')(grens('memo'));
  require('../routes/boeken')(grens('boeken'));
  require('../routes/onderwijs')(grens('onderwijs'));
  require('../routes/leerstof')(grens('leerstof'));
  require('../routes/bijles')(grens('bijles'));
  require('../routes/facturatie')(grens('facturatie'));
  /* RTG Kostprijs (kern/kosten/): wat kost elke gebruiker, en wie betaalt dat.
     Naast de facturatie, want het eindigt op dezelfde factuur en niet op een
     tweede geldstroom. */
  require('../routes/kosten')(grens('kosten'));
  /* De kantoorkant van dezelfde laag, in een eigen bestand omdat het samen door
     de omvangsgrens ging; de naad ligt op de LEZER (een gebruiker ziet zichzelf,
     het kantoor ziet iedereen en beslist). Zelfde domeingrens: een tweede lezer
     van dezelfde kern is geen tweede domein. */
  require('../routes/kosten-kantoor')(grens('kosten'));
  /* RTG Neiging (kern/neiging/, NEIGING.md): de intake die zichzelf afkapt, en wat RTG
     van een lid denkt te weten. Dwars omdat hij aan geen enkel domein hangt --
     hij gaat over de mens en niet over wat die mens bij RTG doet. */
  require('../routes/neiging')(grens('neiging'));
  /* De gedeelde Experience Plane boven alle vier werelden: projections lezen,
     mutaties uitsluitend via zijn Action Broker. */
  const experienceGrens = grens('experience');
  require('../routes/living-world')(grens('living-world'));
  require('../routes/experience')(experienceGrens.app, experienceGrens.auth,
    experienceGrens.experience);
  /* De economielaag eronder (kern/economie/, ECONOMIE.md): de vier werelden en
     de firewall ertussen. Na de kosten, want de werelden-route toont de
     verdeling van de nota's die daar wordt gerekend. */
  require('../routes/economie')(grens('economie'));
  /* Bedrijfsmaten na de economielaag: elke maat draagt een wereld (C1). */
  require('../routes/bedrijfsmaat')(grens('bedrijfsmaat'));
  require('../routes/naargast')(grens('naargast'));
  require('../routes/rtmail')(grens('rtmail'));
  require('../routes/rtmail-vak')(grens('rtmail-vak'));
  require('../routes/rtmail-schrijf')(grens('rtmail-schrijf'));
  require('../routes/rtmail-bestuur')(grens('rtmail-bestuur'));
  require('../routes/rtmail-team')(grens('rtmail-team'));
  require('../routes/rtgone')(grens('rtgone'));
  require('../routes/werkmail')(grens('werkmail'));
  require('../routes/mailpost')(grens('mailpost'));
  require('../routes/payroll')(grens('payroll'));
  require('../routes/huis')(grens('huis'));
  require('../routes/muziek')(grens('muziek'));
  require('../routes/muziek-samen')(grens('muziek-samen'));
  require('../routes/atelierweb')(grens('atelierweb'));
  require('../routes/webmaker')(grens('webmaker'));
  require('../routes/webbrowser')(grens('webbrowser'));
  require('../routes/zaakweb')(grens('zaakweb'));
  require('../routes/webmeting')(grens('webmeting'));
  require('../routes/webmerk')(grens('webmerk'));
  require('../routes/journalistiek')(grens('journalistiek'));
  require('../routes/markt')(grens('markt'));
  require('../routes/borden')(grens('borden'));
  require('../routes/spellen')(grens('spellen'));
  require('../routes/magnaatwereld')(grens('magnaatwereld'));
  require('../routes/leren')(grens('leren'));
  /* Payroll OS: de routes van de nieuwe loonlaag (kern/payroll/), naast de
     oude payroll-routes en met dezelfde poorten. */
  require('../routes/payroll-os')(grens('payroll-os'));
  require('./routes-dwars-vervolg')(grens);
};

/* DE DIRECTE BEZORGING: zelf de MX opzoeken en SMTP praten, zonder aanbieder.

   Afgesplitst uit ./mail.js, dat over de 10 KB ging. De knip loopt langs een
   echte grens: mail.js gaat over WAT er verstuurd wordt en waar het blijft als
   dat niet lukt (de outbox); dit bestand gaat over HOE het over de lijn gaat.
   Twee onderwerpen met twee lezers -- wie een bezorgprobleem zoekt hoeft niet
   door de rest heen.

   De afhankelijkheden komen mee als argument in plaats van via een require naar
   boven: zo blijft de richting een kant op en is dit deel los te toetsen. */
'use strict';
const net = require('net');
const dns = require('dns').promises;

/* Zelf bezorgen. Let op de meldingen: een PERMANENTE weigering (5xx) zegt dat
   het adres niet bestaat en opnieuw proberen zinloos is; een tijdelijke zegt
   het tegenovergestelde. Dat verschil hoort in het logboek te staan, anders
   blijft iemand dagen bonzen op een adres dat er niet is. */
function stuurDirect({ to, subject, text, FROM, bouwBericht, toOutbox }) {
  const { rauw, ondertekend } = bouwBericht(to, subject, text);
  const van = (/<([^>]+)>/.exec(FROM) || [null, FROM])[1];
  require('./smtp-direct').bezorg({ van, naar: to, bericht: rauw })
    .then(uit => {
      if (uit.ok) {
        console.log('[mail] zelf bezorgd bij ' + uit.via + (ondertekend ? ' (ondertekend)' : ' (NIET ondertekend: zet DKIM_PRIVATE_KEY)'));
        return;
      }
      console.warn('[mail] ' + uit.soort + ' niet bezorgd (' + (uit.waarom || uit.code) + '); naar de outbox' +
        (uit.soort === 'permanent' ? ' -- opnieuw proberen heeft geen zin' : ' -- later opnieuw proberen kan wel'));
      try { toOutbox(to, subject, text); } catch (e) {}
    })
    .catch(e => { console.warn('[mail] eigen bezorging mislukt:', e.message); try { toOutbox(to, subject, text); } catch (e2) {} });
}

/* DEZELFDE VERZENDING, MAAR MET EEN ANTWOORD. `send()` hierboven is
   fire-and-forget: goed genoeg voor een bevestigingsmail, maar onbruikbaar voor
   een wachtrij, want die moet WETEN wat er gebeurde. Deze variant geeft
   { ok, soort } terug -- bezorgd, tijdelijk of permanent -- en dat onderscheid
   is waar kern/mailwachtrij.js zijn hele gedrag op baseert: bij tijdelijk
   opnieuw proberen, bij permanent nooit meer.

   De outbox telt hier als BEZORGD, met `via: 'outbox'` erbij. Dat is eerlijker
   dan hem als mislukking tellen: zonder SMTP-instellingen is de outbox de
   afgesproken bestemming, en een wachtrij die daar eindeloos op blijft
   herproberen doet alsof er iets stuk is. */
module.exports = { stuurDirect };

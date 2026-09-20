/* Zichtbare hashtags uit een Salon-tekst. Geen verborgen categorisering of
   profiel dat meegroeit: wat een mens zelf met # schrijft is wat terugkomt. */
'use strict';

const ONDERWERP = /#([\p{L}\p{N}_]{2,30})/gu;

module.exports = function onderwerpenUit(tekst) {
  const uit = [];
  for (const m of String(tekst || '').matchAll(ONDERWERP)) {
    const t = m[1].toLowerCase();
    if (!uit.includes(t)) uit.push(t);
    if (uit.length >= 10) break;
  }
  return uit;
};

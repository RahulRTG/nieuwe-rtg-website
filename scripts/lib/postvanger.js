/* ============================================================================
   DE POSTVANGER VAN BUITENAF -- de testwereld vraagt hem aan, en leest hem uit.

   De vanger zelf staat in server/post-vanger.js (mail) en server/sms-sandbox.js
   (sms). Dit is de kant van de PROEF, en hij doet drie dingen:

     omgeving()    de omgeving waarin een wegwerpserver geen post naar buiten
                   kan sturen: RTG_POSTVANGER=1 en SMS_SANDBOX=1, en de twee
                   echte mailwegen leeg.
     eis(env)      weigert te meten als de vanger in DIE omgeving niet aan zou
                   gaan. Hij vraagt het aan dezelfde waaromNiet() die de server
                   bij het opstarten leest -- geen tweede regel die uiteen kan
                   lopen (LAT.md regel 4). Een proef die stroomt tot "wij hebben
                   u gemaild" en daarbij echte post verstuurt, is geen proef.
     berichten()   wat er in de outbox van een datamap ligt, ontsleuteld met
                   dezelfde kluis als de server (scripts/outbox.js doet dat voor
                   een mens; dit is dezelfde lezing voor een instrument).

   WAT DIT NIET IS: een bewijs dat een bericht AANKWAM. De vanger bewijst dat
   het huis het bericht wilde versturen, aan wie en met welke inhoud -- en dat
   het nergens heen ging. Bezorging bij een echte provider is een ander
   experiment, en dat staat in BETROUWBAARHEID.md par. 4 als zodanig.
   ========================================================================== */
'use strict';
const fs = require('fs');
const path = require('path');
const { waaromNiet: mailNiet } = require('../../server/post-vanger');
const { waaromNiet: smsNiet } = require('../../server/sms-sandbox');

function omgeving() {
  return { RTG_POSTVANGER: '1', SMS_SANDBOX: '1', SMTP_URL: '', MAIL_DIRECT: '' };
}

/* Gooit met de reden als mail of sms in deze omgeving naar buiten zou kunnen. */
function eis(env) {
  const redenen = [mailNiet(env), smsNiet(env)].filter(Boolean);
  if (redenen.length) {
    const e = new Error('De testwereld weigert te meten: ' + redenen.join(' '));
    e.code = 'POSTVANGER_UIT';
    throw e;
  }
  return true;
}

function berichten(datamap) {
  const map = path.join(datamap, 'outbox');
  let namen = [];
  try { namen = fs.readdirSync(map).filter((n) => n.endsWith('.txt') || n.endsWith('.eml.enc')).sort(); }
  catch (e) { return []; }
  const kluis = require('../../server/kluis');
  return namen.map((naam) => {
    const ruw = fs.readFileSync(path.join(map, naam), 'utf8');
    let tekst;
    try { tekst = kluis.ontsleutel(ruw); } catch (e) { return { naam, onleesbaar: String(e.message) }; }
    const kop = (veld) => ((new RegExp('^' + veld + ': (.*)$', 'm')).exec(tekst) || [])[1] || null;
    const aan = kop('To');
    return { naam, aan, soort: /^sms:/i.test(String(aan || '')) ? 'sms' : 'mail',
      onderwerp: kop('Subject'), lijf: tekst.split(/\n\n/).slice(1).join('\n\n') };
  });
}

module.exports = { omgeving, eis, berichten };

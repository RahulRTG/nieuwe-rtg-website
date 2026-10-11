/* DE POSTVANGER: de sink-mailbox van de gecontroleerde testwereld.

   WAAROM DIT BESTAAT. BETROUWBAARHEID.md par. 4 noemt mail "een stap weg": de
   outbox (./mail-outbox.js) bestaat al en vangt alles op zolang er geen
   smarthost en geen eigen bezorging staat. Wat ontbrak was de GARANTIE. Een
   proef die een stroom tot en met "wij hebben u gemaild" afmaakt, start een
   wegwerpserver met de omgeving van wie hem draait -- en staat daar toevallig
   MAIL_DIRECT=1 of een SMTP_URL in, dan gaat er echte post naar verzonnen
   adressen. Dat de outbox "meestal" de bestemming is, is geen meetopstelling.

   DEZELFDE REGEL ALS DE SIMULATIEBANK (./betaal/synthetisch.js, MAGNAATLAB.md
   par. 3): een simulatie-adapter vervangt de RAIL, nooit de POORT. Er wordt
   hier niets aan het OPSTELLEN van een bericht veranderd, niets aan wie het
   mag ontvangen en niets aan de toestemmingslaag; alleen de laatste meter, de
   bezorging, eindigt in de outbox. Wat beslist of er post uitgaat, draait in
   de proef ongewijzigd mee.

   DRIE GRENDELS, ALLE DRIE FAIL-CLOSED, en elke weigering noemt de grendel:
     1. alleen met RTG_POSTVANGER=1 -- geen vlag is nooit stil "het is goed";
     2. nooit in productie, ook niet mét de vlag;
     3. nooit naast een echte mailweg (SMTP_URL of MAIL_DIRECT=1). Een vanger
        die een werkende bezorging overschaduwt is erger dan geen vanger: wie
        de vlag vergeet uit te zetten, verliest dan ongemerkt zijn post. De
        echte weg blijft dus winnen, en de PROEF die om de vanger vroeg leest
        dezelfde waaromNiet() en weigert te meten (scripts/lib/postvanger.js).

   EEN VANGER LAAT NIETS SLAGEN WAT IN HET ECHT ZOU MISLUKKEN: een bericht
   zonder geldig adres wordt hier net zo min "bezorgd" als buiten. Daarom zit
   de vanger ACHTER de adrescontrole van mail.js en niet ervoor. */
'use strict';

/* Een SMTP_URL is een echte mailweg, ook op loopback: een lokale MTA stuurt
   gewoon door. Alleen "niets ingesteld" is zeker geen bezorging naar buiten. */
function echteMailweg(e) {
  if (String(e.MAIL_DIRECT || '') === '1') return 'MAIL_DIRECT=1 (eigen bezorging)';
  if (String(e.SMTP_URL || '').trim()) return 'SMTP_URL (een smarthost)';
  return null;
}

function waaromNiet(env) {
  const e = env || {};
  if (e.RTG_POSTVANGER !== '1')
    return 'De postvanger staat uit. Zet RTG_POSTVANGER=1 in een omgeving die geen productie is.';
  if (e.NODE_ENV === 'production')
    return 'De postvanger draait nooit in productie, ook niet met RTG_POSTVANGER=1: daar hoort post aan te komen.';
  const echt = echteMailweg(e);
  if (echt)
    return 'Er is een echte mailweg ingesteld (' + echt + '). De postvanger weigert die te overschaduwen; ' +
      'haal hem weg uit de omgeving van de proef of zet de vanger uit.';
  return null;
}

const reden = waaromNiet(process.env);
if (process.env.RTG_POSTVANGER === '1' && reden) console.warn('[mail] postvanger geweigerd: ' + reden);

module.exports = { aan: reden === null, reden, waaromNiet, echteMailweg };

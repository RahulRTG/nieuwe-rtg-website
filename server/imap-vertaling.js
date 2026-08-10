/* IMAP: DE VERTAALTABEL. Puur tekstwerk, geen toestand.

   Afgesplitst van ./imap.js op dezelfde naad als kern/mailmime.js van
   mailinkomend.js: alles hier is een functie van zijn invoer. Geen database,
   geen verbinding, geen tijd -- dus los te beproeven met een object erin en een
   string eruit. Bij een adapter zijn de moeilijke gevallen rare BERICHTEN, niet
   rare omstandigheden.

   DE VERTALING, en waar hij wringt:

     INBOX      -> de map 'in'
     Archive    -> de map 'archief'
     Trash      -> de map 'prullenbak'
     Sent       -> wat dit adres verstuurd heeft
     Drafts     -> de concepten. Die wonen met OPZET niet tussen de post (zie de
                   kop van kern/rtmail-schrijf.js), dus deze map heeft geen
                   `vak` maar wordt uit de conceptenlijst gevuld door
                   ./imap-schrijf.js.
     \Seen      -> gelezen
     \Flagged   -> favoriet
     etiketten  -> die bestaan niet in IMAP; ze zijn zichtbaar als sleutelwoord
                   maar een client kan ze niet altijd tonen. Dat is een
                   TEKORTKOMING VAN HET PROTOCOL en niet van dit huis, en hij
                   staat hier opgeschreven in plaats van weggemoffeld.
     sluimeren  -> bestaat niet in IMAP. Sluimerende post is in de client gewoon
                   zichtbaar. Ook dat is eerlijker dan hem verbergen: een client
                   die post niet ziet die er wel is, is erger.

   Alles wat hier niet in staat, bestaat voor een client niet. Dat is geen
   omissie maar de grens van de vertaling, en hij hoort op EEN plek te staan. */
'use strict';

const CRLF = '\r\n';

const MAPPEN = [
  { imap: 'INBOX', vak: 'in' },
  { imap: 'Archive', vak: 'archief' },
  { imap: 'Trash', vak: 'prullenbak' },
  { imap: 'Sent', vak: 'uit' },
  { imap: 'Drafts', concepten: true }
];

const regelVan = (naam) => MAPPEN.find(m => m.imap.toLowerCase() === String(naam || '').toLowerCase()) || null;
const vakVan = (naam) => (regelVan(naam) || {}).vak || null;
const isConceptMap = (naam) => !!(regelVan(naam) || {}).concepten;

/* Een bericht als RFC 5322-tekst. Een client verwacht een heel bericht en geen
   JSON, dus bouwen we hem op uit wat RTMAIL bewaart. De koppen zijn bewust
   minimaal en eerlijk: wat we niet weten, verzinnen we niet. */
function alsBericht(m) {
  const kop = [
    'From: ' + m.van,
    'To: ' + m.naar,
    'Subject: ' + m.onderwerp,
    'Date: ' + new Date(m.at).toUTCString(),
    'Message-ID: <' + m.id + '@rtmail>',
    m.antwoordOp ? 'In-Reply-To: <' + m.antwoordOp + '@rtmail>' : null,
    'X-RTG-Vertrouwd: ' + (m.vertrouwd ? 'ja' : 'nee'),
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8'
  ].filter(Boolean).join(CRLF);
  return kop + CRLF + CRLF + String(m.tekst || '');
}

function vlaggenVan(m) {
  const v = [];
  if (m.gelezen) v.push('\\Seen');
  if (m.favoriet) v.push('\\Flagged');
  if (m.concept) v.push('\\Draft');
  for (const l of (m.labels || [])) v.push(String(l).replace(/[^A-Za-z0-9_-]/g, ''));
  return v.filter(Boolean);
}

module.exports = { CRLF, MAPPEN, regelVan, vakVan, isConceptMap, alsBericht, vlaggenVan };

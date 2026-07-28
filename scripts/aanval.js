/* AANVALSRONDE -- het systeem van buitenaf bestoken.

   WAT DIT WEL IS: een batterij aanvallen tegen een DRAAIENDE server, met de
   houding van iemand die binnen wil komen in plaats van iemand die wil
   bevestigen dat zijn ontwerp klopt. Elke poging staat er met wat er gebeurde.

   WAT DIT NIET IS: een onafhankelijke pentest. Dit script is geschreven door
   dezelfde partij die de server schreef, en dat is een fundamentele beperking:
   je zoekt niet naar de aanname die je niet weet dat je hebt. De WAL-bug in de
   backups lag maanden onder een volledige testsuite en geen enkele eigen test
   raakte hem -- die vond ik pas door iets ECHT te doen in plaats van te
   controleren. Voor de lancering hoort hier een vreemd paar ogen overheen.

   Draai:  node scripts/aanval.js [http://127.0.0.1:3000]
   Exitcode 1 zodra er iets raak is, zodat hij als poort kan dienen. */
const BASIS = process.argv[2] || 'http://127.0.0.1:3000';
const raak = [];    // echt mis
const let_op = [];  // verdient een blik
const ok = [];      // aanval afgeslagen

const meld = (lijst, wat, hoe) => lijst.push({ wat, hoe });
const uniek = () => Math.random().toString(36).slice(2, 10);

async function post(pad, body, tok, extra) {
  const h = { 'Content-Type': 'application/json', ...(extra || {}) };
  if (tok) h.Authorization = 'Bearer ' + tok;
  try {
    const r = await fetch(BASIS + pad, { method: 'POST', headers: h, body: JSON.stringify(body || {}) });
    return { status: r.status, tekst: await r.text() };
  } catch (e) { return { status: 0, tekst: String(e.message) }; }
}
async function ha
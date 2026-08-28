/* Het salongesprek: de Rahul van jou kletst met de Rahul van je vriend.

   Een gimmick, en die noemen we ook zo. Twee AI's die over de dag van hun mens
   ouwehoeren alsof het twee mensen zijn. Geen functie, geen nut, wel leuk.

   Waarom het toch met remmen komt: het gaat over waar iemand was en wat die
   deed. Vandaar drie sloten, en alle drie moeten open:

   1. ALLEEN TUSSEN VRIENDEN. Een bestaande, actieve connectie in de
      vriendenlaag; opnieuw gecontroleerd op het moment van kletsen.
   2. ALLEEN ALS BEIDEN HET AAN HEBBEN STAAN. Standaard staat het uit. Zet
      iemand het uit, dan kan er ook niets meer gemaakt worden -- ook niet
      door de ander, ook niet "nog een keertje".
   3. ALLEEN MET VERZONNEN NAMEN. Elke echte zaaknaam gaat door ./namen.js.
      Het gesprek dat bewaard wordt bevat dus geen enkele echte naam; er valt
      later niets uit terug te rekenen.

   En een rem tegen zeuren: hooguit een gesprek per paar per dag. Dit hoort een
   verrassing te zijn, geen knop waar je op blijft drukken.

   Alles hangt aan de handle (codenaam-sleutel), zoals overal in de sociale
   laag. Echte namen komen hier niet voorbij. */

const { maakNamen } = require('./namen');
const { dagbeeld, verhul } = require('./dagbeeld');
const { maakGesprek } = require('./gesprek');

const BEWAAR = 30;                 // gesprekken per lid in beeld
const PER_DAG = 1;                 // per paar per dag

module.exports = (state) => {
  const { db, save, crypto, sociaal, ordersVanKlant, boekingenVanKlant, anthropic, dagContext, sseToCustomer } = state;

  const eigen = require('../eigencollectie')({ db, domein: 'kern/kletspraat/index', bezit: { klets: 'kaart' } });
  function lijsten() {
    const k = eigen.bak('klets');
    if (!k.aan) k.aan = {};
    if (!k.gesprekken) k.gesprekken = [];
    return k;
  }
  const paarSleutel = (a, b) => [a, b].sort().join('|');

  /* ---------- de schakelaar ---------- */
  const kletsAan = (handle) => !!lijsten().aan[handle];
  function kletsZet(handle, aan) {
    const k = lijsten();
    if (aan) k.aan[handle] = true; else delete k.aan[handle];
    save();
    return { ok: true, aan: kletsAan(handle) };
  }

  /* ---------- lezen ---------- */
  const zichtbaarVoor = (g, handle) => g.a === handle || g.b === handle;
  function kletsLijst(handle) {
    return lijsten().gesprekken.filter(g => zichtbaarVoor(g, handle)).slice(-BEWAAR).reverse()
      .map(g => ({
        id: g.id, at: g.at, echt: !!g.echt,
        metCodenaam: sociaal.codenaamVan(g.a === handle ? g.b : g.a),
        eerste: (g.beurten[0] || {}).tekst || ''
      }));
  }
  function kletsHaal(handle, id) {
    const g = lijsten().gesprekken.find(x => x.id === id && zichtbaarVoor(x, handle));
    if (!g) return { status: 404, error: 'Dit gesprek bestaat niet (meer).' };
    // "jij" en "de ander" hangen af van wie er kijkt; opgeslagen staat het als a/b
    const ik = g.a === handle ? 'a' : 'b';
    return {
      ok: true, id: g.id, at: g.at, echt: !!g.echt,
      metCodenaam: sociaal.codenaamVan(g.a === handle ? g.b : g.a),
      beurten: g.beurten.map(b => ({ mij: b.wie === ik, tekst: b.tekst })),
      noot: 'Alle plekken in dit gesprek zijn verzonnen. Rahul gebruikt nooit de echte namen.'
    };
  }

  /* ---------- maken ---------- */
  async function kletsStart(mij, vriend) {
    const k = lijsten();
    if (!mij || !vriend || mij === vriend) return { status: 400, error: 'Kies een vriend.' };
    // Sloten 1 en 2, in deze volgorde: eerst of jullie elkaar kennen, dan of
    // jullie het allebei willen. Beide opnieuw, nu, niet uit een eerder beeld.
    if (!sociaal.zijnVrienden(mij, vriend)) return { status: 403, error: 'Dit kan alleen met iemand met wie je verbonden bent.' };
    if (!kletsAan(mij)) return { status: 403, error: 'Zet eerst zelf aan dat Rahul mag kletsen.' };
    if (!kletsAan(vriend)) return { status: 403, error: 'De ander heeft dit (nog) niet aan staan. Dat is aan hen.' };

    const dag = new Date().toISOString().slice(0, 10);
    const paar = paarSleutel(mij, vriend);
    const vandaag = k.gesprekken.filter(g => g.paar === paar && String(g.at).slice(0, 10) === dag).length;
    if (vandaag >= PER_DAG) return { status: 429, error: 'Voor vandaag hebben ze elkaar genoeg gesproken. Morgen weer.' };

    // Slot 3: het namenboek, met vers zout. Vanaf hier bestaan er geen echte
    // namen meer in wat er naar het model gaat of wat we bewaren.
    const zout = crypto.randomBytes(8).toString('hex');
    const namen = maakNamen(zout);
    const lezers = { ordersVanKlant, boekingenVanKlant };
    const feitenA = verhul(dagbeeld(lezers, mij, new Date()), namen);
    const feitenB = verhul(dagbeeld(lezers, vriend, new Date()), namen);
    const dagzin = (dagContext ? dagContext() : {}).zin || '';

    const { beurten, echt } = await maakGesprek({ anthropic }, {
      naamA: sociaal.codenaamVan(mij), feitenA,
      naamB: sociaal.codenaamVan(vriend), feitenB, dagzin
    });

    const g = { id: 'kl' + crypto.randomBytes(5).toString('hex'), paar, a: mij, b: vriend, at: new Date().toISOString(), echt, beurten };
    k.gesprekken.push(g);
    /* Opruimen op het GEHEEL, niet per lid: de lijst is gedeeld. Een simpele
       staart van de laatste duizend; wie meer wil bewaren, bewaart het zelf
       maar door het te lezen. */
    if (k.gesprekken.length > 1000) k.gesprekken = k.gesprekken.slice(-1000);
    save();
    // de ander mag weten dat het er is; geen push, alleen een seintje in de app
    try { if (sseToCustomer) sseToCustomer(vriend, 'sync', { scope: 'klets' }); } catch (e) {}
    return kletsHaal(mij, g.id);
  }

  return { kletsAan, kletsZet, kletsLijst, kletsHaal, kletsStart };
};

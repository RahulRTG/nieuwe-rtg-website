/* DE AI-OPERATOR -- een opdracht in gewone taal wordt een plan met oorzaken,
   een veilige stapel en een lijstje uitzonderingen.

   "Waarom loopt mobiliteit in Haarlem achter?" hoort niet te eindigen in een
   dashboard maar in: 41 ritten lopen vertraging op, 33 daarvan door twee
   voertuigen, 6 door een routeconfiguratie, 2 zijn uitzonderingen; 39 kan ik
   veilig herstellen, twee vragen een mens. En daarna: "doe de veilige 39."

   HET REKENWERK IS VAN DE MACHINE, HET OORDEEL VAN HET BELEID, DE TAAL VAN DE
   AI -- IN DIE VOLGORDE. De AI schrijft hier hooguit het antwoord op; hij
   kiest niet wat er gebeurt. Welke gevallen er zijn komt uit de gegevens, welke
   veilig zijn uit ./risico.js, en wat er dan gebeurt uit ./runbooks.js. Zonder
   API-sleutel werkt alles hetzelfde, alleen is de zin dan door ons geschreven.
   Dat is met opzet: een operator die zonder AI stukgaat, is een operator die je
   op je slechtste dag kwijt bent.

   DE OORZAKEN WORDEN GEMETEN, NIET GERADEN. De groepering zoekt zelf het veld
   dat de gevallen het strakst clustert (het kenteken, de lijn, de zaak) in
   plaats van een vaste tabel "wat verklaart wat" -- zo'n tabel zou verouderen
   zodra er een collectie bij komt, en dan zou de operator stellig het verkeerde
   zeggen. Dat is erger dan niets zeggen. */
'use strict';

const { OP_TYPE, kort, s } = require('./register');
/* De oorzaakmeting staat apart in ./oorzaak.js: een andere vraag (wat is er
   aan de hand) dan de rest van dit bestand (wat moet er gebeuren), en los te
   toetsen. */
const { groepeer, GEEN_OORZAAK } = require('./oorzaak');

function maakOperator({ db, save, crypto, journaal, risico, runbooks, zaken, beleid, anthropic }) {
  function plannen() {
    if (!Array.isArray(db.data.commandPlannen)) db.data.commandPlannen = [];
    return db.data.commandPlannen;
  }

  /* Welke runbooks gaan over deze vraag? Op woorden in de vraag tegen de naam,
     de oorzaak, het domein en de soort. Vindt hij niets, dan kijkt hij naar
     alles wat op dit moment kandidaten heeft -- beter een breed eerlijk beeld
     dan een leeg antwoord op een vraag die je niet begreep. */
  function kies(vraag) {
    const t = String(vraag || '').toLowerCase();
    const alle = runbooks.lijst();
    const raak = alle.filter(rb => {
      const soort = OP_TYPE.get(rb.type);
      const woorden = [rb.naam, rb.oorzaak, rb.type, soort ? soort.domein : '', soort ? soort.meervoud : '']
        .join(' ').toLowerCase();
      return woorden.split(/[^a-zà-ÿ]+/).filter(w => w.length > 3).some(w => t.includes(w));
    });
    const gekozen = raak.length ? raak : alle;
    return gekozen.filter(rb => rb.kandidaten > 0);
  }

  /* Het plan. Per runbook: de gevallen, de gemeten oorzaakgroepen, en de
     routering veilig/hulp/mens. */
  function plan(vraag, door) {
    const gekozen = kies(vraag);
    const delen = [];
    for (const rb of gekozen) {
      const rbVol = runbooks.OP_ID.get(rb.id);
      const kand = runbooks.kandidaten(rbVol, beleid.getal('herstel.maxPerRonde', 50) * 4);
      const soort = OP_TYPE.get(rb.type);
      const gevallen = kand.rijen.map(r => ({ id: s(r[soort.sleutel]), titel: kort(soort, r).titel, rij: r,
        ctx: { klantImpact: rbVol.klantImpact, onomkeerbaar: !rbVol.terugDraaibaar, zekerheid: 0.95 } }));
      const g = groepeer(gevallen);
      const route = risico.routeer(gevallen, rbVol.actie, { klantImpact: rbVol.klantImpact });
      delen.push({
        runbook: rb.id, naam: rb.naam, type: rb.type, domein: soort ? soort.domein : 'overig',
        totaal: kand.totaal, bekeken: gevallen.length,
        oorzaakVeld: g.veld, oorzaken: g.groepen.slice(0, 5),
        veilig: route.veilig.length, hulp: route.hulp.length, mens: route.mens.length,
        overgeslagen: route.overgeslagen, stapeloordeel: route.stapeloordeel,
        veiligeIds: route.veilig.map(v => v.geval.id),
        uitzonderingen: route.mens.concat(route.hulp).slice(0, 20).map(v => ({
          id: v.geval.id, titel: v.geval.titel, score: v.oordeel.score, waarom: v.oordeel.waarom }))
      });
    }
    const p = {
      id: crypto.randomUUID(), at: new Date().toISOString(), vraag: String(vraag || ''),
      door: String(door || 'onbekend'), delen,
      totaal: delen.reduce((n, d) => n + d.totaal, 0),
      veilig: delen.reduce((n, d) => n + d.veilig, 0),
      uitzonderingen: delen.reduce((n, d) => n + d.mens + d.hulp, 0),
      uitgevoerd: false
    };
    plannen().push(p);
    if (plannen().length > 200) plannen().splice(0, plannen().length - 200);
    if (save) save();
    p.tekst = tekst(p);
    return p;
  }

  /* De zin die een mens leest. Deterministisch opgebouwd uit het plan, zodat
     hij nooit iets kan beweren wat er niet in staat. */
  function tekst(p) {
    if (!p.delen.length) return 'Ik vind op dit moment niets dat hierbij past en herstel vraagt. Dat is een uitslag, geen storing: er staan geen gevallen open in de runbooks die op deze vraag lijken.';
    const zinnen = [];
    for (const d of p.delen) {
      let z = d.totaal + ' × ' + d.naam.toLowerCase() + ' (' + d.type + ')';
      if (d.oorzaakVeld && d.oorzaken.length) {
        const top = d.oorzaken.slice(0, 3).map(o => o.aantal + ' door ' + d.oorzaakVeld + ' ' + o.waarde);
        const rest = d.oorzaken.slice(3).reduce((n, o) => n + o.aantal, 0);
        z += '. Oorzaken: ' + top.join(', ') + (rest ? ' en ' + rest + ' verspreid' : '');
      }
      zinnen.push(z);
    }
    const staart = p.veilig
      ? 'Ik kan ' + p.veilig + ' geval(len) veilig herstellen' + (p.uitzonderingen ? '; ' + p.uitzonderingen + ' vragen een menselijke beoordeling.' : '.')
      : (p.uitzonderingen ? 'Geen van deze gevallen mag ik zelf doen; ' + p.uitzonderingen + ' vragen een mens.' : 'Er valt nu niets te herstellen.');
    return zinnen.join('. ') + '. ' + staart;
  }

  /* De AI mag het mooier zeggen, en verder niets. Faalt hij, dan staat de
     eigen zin er nog -- daarom wordt die altijd eerst gezet. */
  async function verwoord(p) {
    if (!anthropic) return p.tekst;
    try {
      const r = await anthropic.messages.create({
        model: 'claude-opus-4-8', max_tokens: 320,
        system: 'U bent de operator van RTG Command. Schrijf de aangeleverde MEETUITSLAG in maximaal vier zakelijke Nederlandse zinnen, u-vorm, zonder opsmuk. Voeg NIETS toe wat er niet staat: geen oorzaken, aantallen, partners of merken die niet in de uitslag voorkomen. Beloof nooit dat u iets zult doen; het besluit ligt bij de medewerker.',
        messages: [{ role: 'user', content: 'Vraag: "' + p.vraag + '"\nMeetuitslag:\n' +
          JSON.stringify(p.delen.map(d => ({ wat: d.naam, totaal: d.totaal, oorzaakVeld: d.oorzaakVeld,
            oorzaken: d.oorzaken, veilig: d.veilig, uitzonderingen: d.mens + d.hulp })), null, 1) }]
      });
      const t = (r.content || []).filter(c => c.type === 'text').map(c => c.text).join(' ').trim();
      return t.length > 20 ? t : p.tekst;
    } catch (e) { return p.tekst; }
  }

  /* "Doe de veilige gevallen." Alleen wat het plan als veilig aanmerkte, per
     runbook, via runbooks.voer -- dus met dezelfde grendels en hetzelfde spoor.
     De uitzonderingen worden zaken, want anders verdwijnen ze. */
  function voerVeilig(planId, door, reden) {
    const p = plannen().find(x => x.id === String(planId));
    if (!p) return { error: 'Dat plan bestaat niet (meer).', status: 404 };
    if (!door) return { error: 'Zonder herleidbare medewerker voert de operator niets uit.', status: 403 };
    if (p.uitgevoerd) return { error: 'Dit plan is al uitgevoerd.', status: 409 };
    const runs = [], fouten = [];
    for (const d of p.delen) {
      if (!d.veiligeIds.length) continue;
      const r = runbooks.voer(d.runbook, { droog: false, door, reden: reden || ('operator: ' + p.vraag), alleen: d.veiligeIds });
      if (r.error) fouten.push({ runbook: d.runbook, error: r.error });
      else runs.push(r.run);
    }
    const nieuweZaken = [];
    for (const d of p.delen) {
      for (const u of d.uitzonderingen) {
        nieuweZaken.push(zaken.open({
          titel: d.naam + ' -- uitzondering: ' + u.titel, domein: d.domein, objectType: d.type, objectId: u.id,
          oorzaak: d.oorzaakVeld ? d.oorzaakVeld + '-afwijking' : 'geen veilige route', bron: 'operator',
          risico: u.score, door, niveau: 'assist',
          reden: 'De operator mocht dit geval niet zelf doen: ' + u.waarom,
          bewijs: { plan: p.id, vraag: p.vraag, runbook: d.runbook, oordeel: u.waarom }
        }));
      }
    }
    p.uitgevoerd = true; p.uitgevoerdDoor = String(door); p.uitgevoerdAt = new Date().toISOString();
    if (save) save();
    journaal.noteer({ actor: door, actie: 'operator uitvoeren', objectType: 'plan', objectId: p.id,
      niveau: 'assist', reden: reden || p.vraag,
      voor: { veilig: p.veilig, uitzonderingen: p.uitzonderingen },
      na: { runs: runs.length, zaken: nieuweZaken.length, fouten: fouten.length } });
    return { hersteld: runs.reduce((n, r) => n + r.geraakt, 0), runs, zaken: nieuweZaken.length, fouten };
  }

  const vind = (id) => plannen().find(x => x.id === String(id)) || null;
  const recent = (n) => plannen().slice().reverse().slice(0, n || 10)
    .map(p => ({ id: p.id, at: p.at, vraag: p.vraag, door: p.door, totaal: p.totaal,
      veilig: p.veilig, uitzonderingen: p.uitzonderingen, uitgevoerd: p.uitgevoerd }));

  return { plan, tekst, verwoord, voerVeilig, vind, recent, groepeer };
}

module.exports = { maakOperator, groepeer, GEEN_OORZAAK };

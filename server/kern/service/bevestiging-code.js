/* ============================================================================
   DE TERUGVALCODE EN DE CLAIM VAN EEN BEVESTIGING (service.balie_bevestigingscode).

   Afgesplitst van ./bevestiging.js, dat er over de omvangsgrens mee ging. Hier
   staat alles wat een bevestiging VERBRUIKT: indrukken in de app, de code die
   het lid voorleest, en weigeren. Alles in EEN collectietransactie op
   `serviceBevestigingen`, zodat twee instances een verzoek nooit allebei
   verbruiken.

   WAAROM DE CODE ZES CIJFERS BLIJFT. Het lid leest hem aan de telefoon voor aan
   een medewerker; 128 bit is dan geen code meer maar een dictee. Wat hem veilig
   maakt is niet zijn lengte maar alles eromheen, en dat staat hier in code:
     - hij bestaat pas als het LID hem opvraagt (toon), nooit bij het verzoek;
     - hij is gebonden aan EEN bevestiging van EEN zaak en EEN medewerker, en de
       medewerker moet de zaak noemen: de hash neemt het id van de bevestiging mee;
     - hij geldt tot het verzoek verloopt (vijf minuten na het vragen) en werkt
       een keer;
     - alleen als hash bewaard, en vergeleken zonder vroegtijdig af te breken;
     - drie foute pogingen en hij is dood; het lid kan hooguit drie keer een code
       opvragen. Samen hooguit negen gokken van 1 op 1.000.000 per verzoek, en elk
       verzoek vraagt een handeling van het lid.
   De hash van een zescijferige code is offline in een oogwenk te kraken; wat
   hem daar beschermt is de levensduur van vijf minuten, niet de hash.
   ========================================================================== */
'use strict';

const MAX_POGINGEN = 3;
const MAX_TONEN = 3;

module.exports = function maakBevestigingCode({ crypto, bewerkCollectie, machtigingen, nu, stand, kortB, MINUTEN, B }) {
  const bearer = require('../bearercode')({ crypto, namespace: 'service.balie_bevestigingscode', nu });
  const codeHash = (id, code) => bearer.hash(String(id) + '.' + String(code));
  const cijfers = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const transactie = werk => {
    if (typeof bewerkCollectie !== 'function')
      return { status: 503, error: 'Bevestigen vraagt een collectietransactie die in deze server ontbreekt.' };
    B(); // een lege collectie is een lijst en geen kaart
    return bewerkCollectie('serviceBevestigingen', l => {
      if (!Array.isArray(l)) throw new Error('serviceBevestigingen hoort een lijst te zijn');
      // een kale code van voor de migratie hoort niet op schijf te blijven staan
      for (const b of l) if (b && 'code' in b) delete b.code;
      return werk(l);
    });
  };
  const vindIn = (l, id) => l.find(b => b && b.id === String(id || '')) || null;
  const eigen = (b, melder) => !b ? { status: 404, error: 'Dit verzoek kennen wij niet.' }
    : String(melder || '') !== b.melder ? { status: 403, error: 'Dit verzoek staat niet op uw naam.' } : null;
  const kopie = b => JSON.parse(JSON.stringify(b));

  /* De machtiging ontstaat NA de claim. Weigert zij, dan gaat de claim terug:
     er ging niets open, dus het lid mag het opnieuw proberen. */
  async function rondAf(b) {
    const m = machtigingen.verleen({ zaakId: b.zaak, mens: b.mens, doel: b.doel,
      capabilities: b.capabilities, binnenTeam: b.team, reden: b.reden + ' (bevestigd door het lid zelf)' });
    const beeld = await transactie(l => {
      const x = vindIn(l, b.id);
      if (!x) return null;
      if (m.error) { x.gebruiktAt = null; x.via = null; } else x.machtiging = m.machtiging.id;
      return kortB(x);
    });
    return m.error ? m : { ok: true, bevestiging: beeld, machtiging: m.machtiging };
  }

  async function bevestig(id, { melder, via } = {}) {
    const c = await transactie(l => {
      const b = vindIn(l, id);
      const f = eigen(b, melder);
      if (f) return f;
      const s = stand(b);
      if (s !== 'open') return { status: 400, error: 'Dit verzoek is ' + s + '. Vraag de medewerker om een nieuw verzoek.' };
      b.gebruiktAt = nu(); b.via = String(via || 'app'); b.code_hash = null;
      return { ok: true, b: kopie(b) };
    });
    return c.ok ? rondAf(c.b) : c;
  }

  function weiger(id, { melder } = {}) {
    return transactie(l => {
      const b = vindIn(l, id);
      const f = eigen(b, melder);
      if (f) return f;
      if (stand(b) !== 'open') return { status: 400, error: 'Dit verzoek is ' + stand(b) + '.' };
      b.geweigerdAt = nu(); b.code_hash = null;
      return { ok: true, bevestiging: kortB(b) };
    });
  }

  /* Het LID vraagt zijn code op. Elke keer een nieuwe; de vorige werkt dan niet meer. */
  function toon(id, { melder } = {}) {
    return transactie(l => {
      const b = vindIn(l, id);
      const f = eigen(b, melder);
      if (f) return f;
      const s = stand(b);
      if (s !== 'open') return { status: 400, error: 'Dit verzoek is ' + s + '. Vraag de medewerker om een nieuw verzoek.' };
      if ((b.codePogingen || 0) >= MAX_POGINGEN || (b.codeUitgifte || 0) >= MAX_TONEN)
        return { status: 429, error: 'Voor dit verzoek wordt geen code meer gegeven. Bevestig in de app of vraag de medewerker om een nieuw verzoek.' };
      const code = cijfers();
      b.code_hash = codeHash(b.id, code);
      b.codeUitgifte = (b.codeUitgifte || 0) + 1;
      return { ok: true, code, tot: b.tot, minuten: MINUTEN,
        let: 'Lees deze code alleen voor aan de medewerker die u nu spreekt. Hij werkt een keer, tot ' + b.tot + '.' };
    });
  }

  /* De medewerker typt wat het lid voorleest, voor DEZE zaak. Alle open verzoeken
     van hem bij die zaak worden vergeleken, zonder vroegtijdig af te breken. */
  async function metCode(code, { mens, zaak } = {}) {
    const c = String(code || '').replace(/\D/g, '');
    if (c.length !== 6) return { status: 400, error: 'Een bevestigingscode is zes cijfers.' };
    const zaakId = String(zaak || '').trim().toUpperCase().slice(0, 40);
    if (!zaakId) return { status: 400, error: 'Noem de zaak waarvoor het lid de code voorleest.' };
    const w = String(mens || '').replace(/[<>]/g, '').trim().slice(0, 60);
    const r = await transactie(l => {
      const kand = l.filter(b => b && b.zaak === zaakId && b.mens === w && b.code_hash && stand(b) === 'open');
      let raak = null;
      for (const b of kand) if (bearer.zelfdeHash(b.code_hash, codeHash(b.id, c))) raak = b;
      if (!raak) {
        for (const b of kand) {
          b.codePogingen = (b.codePogingen || 0) + 1;
          if (b.codePogingen >= MAX_POGINGEN) b.code_hash = null;
        }
        return { status: 404, error: 'Deze code hoort niet bij een openstaand verzoek van u voor deze zaak. Codes gelden ' +
          MINUTEN + ' minuten, een keer, en na ' + MAX_POGINGEN + ' foute pogingen niet meer.' };
      }
      raak.gebruiktAt = nu(); raak.via = 'code'; raak.code_hash = null;
      return { ok: true, b: kopie(raak) };
    });
    return r.ok ? rondAf(r.b) : r;
  }

  return { bevestig, weiger, toon, metCode, MAX_POGINGEN, MAX_TONEN };
};

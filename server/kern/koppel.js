/* DE KOPPELLAAG: twee schermen, één handeling.

   Wie op twee plekken tegelijk werkt -- de leverancier-app of RTG Kantoren
   op het bureau, de PDA in de broekzak -- had tot nu toe twee losse
   schermen die hetzelfde deden. Dat is geen voordeel, dat is dubbel werk.
   Deze laag doet het omgekeerde: een handeling die op het ene scherm
   BEGINT en op het andere wordt AFGEMAAKT, omdat dat daar beter kan.

   Drie handelingen die dat echt nodig hebben:
   - betaal    : de balie maakt een betaalverzoek, de telefoon toont de
                 RTG-code aan de klant. Op afstand betalen zonder dat de
                 klant achter het bureau hoeft te komen staan.
   - verzenden : een factuur gaat pas de deur uit als iemand met
                 tekenbevoegdheid hem heeft afgetekend -- en dat doe je met
                 je vinger op de telefoon, niet met een muis.
   - ontvangst : tekenen VOOR ontvangst; de bezorger of leverancier laat
                 op de telefoon tekenen en het bureau ziet het meteen.

   Wat we nooit doen: zeggen dat er betaald is. Een betaalverzoek staat
   open tot de betaallaag zelf meldt dat het geld binnen is; tot die tijd
   heet het "wacht op betaling".

   De handtekening is een tekening, geen plaatje: een paar paden met
   punten, begrensd opgeslagen, zodat het klein blijft en overal opnieuw
   te tekenen is. */
module.exports = ({ db, save, crypto, schoon, dyncode, sseToSupplier }) => {
  const eigen = require('./eigencollectie')({ db, domein: 'kern/koppel', bezit: { koppelVerzoeken: 'lijst' } });
  const nu = () => new Date().toISOString();
  const lijst = () => eigen.bak('koppelVerzoeken');

  const SOORTEN = {
    betaal: { label: 'Betalen op afstand', werkt: 'De telefoon toont de RTG-code; de klant scant en betaalt in zijn eigen app.' },
    verzenden: { label: 'Aftekenen voor verzending', werkt: 'De factuur gaat pas weg als er is getekend.' },
    ontvangst: { label: 'Tekenen voor ontvangst', werkt: 'De ontvanger tekent op de telefoon; het bureau ziet het meteen.' }
  };
  const LEVEN_MS = 30 * 60 * 1000; // een verzoek staat een half uur open

  const bedragVan = v => { const n = Math.round(Number(v) * 100) / 100; return Number.isFinite(n) && n > 0 ? n : 0; };
  const verlopen = v => v.status === 'open' && Date.parse(v.verlooptAt) < Date.now();
  const stand = v => (verlopen(v) ? 'verlopen' : v.status);

  /* Een handtekening is een lijst paden; elk pad is een lijst punten
     [x, y] tussen 0 en 1 (verhoudingen, dus schermgrootte doet er niet
     toe). Begrensd, zodat niemand er een bestand in kwijt kan. */
  function schoonHandtekening(ruw) {
    if (!Array.isArray(ruw)) return null;
    const paden = [];
    for (const pad of ruw.slice(0, 12)) {
      if (!Array.isArray(pad)) continue;
      const punten = [];
      for (const p of pad.slice(0, 120)) {
        if (!Array.isArray(p) || p.length < 2) continue;
        const x = Math.round(Math.min(1, Math.max(0, Number(p[0]))) * 1000) / 1000;
        const y = Math.round(Math.min(1, Math.max(0, Number(p[1]))) * 1000) / 1000;
        if (Number.isFinite(x) && Number.isFinite(y)) punten.push([x, y]);
      }
      if (punten.length > 1) paden.push(punten);
    }
    return paden.length ? paden : null;
  }

  const publiek = v => ({
    id: v.id, zaak: v.zaak, soort: v.soort, soortLabel: (SOORTEN[v.soort] || {}).label || v.soort,
    titel: v.titel, toelichting: v.toelichting || null, bedrag: v.bedrag || 0, ref: v.ref || null,
    voor: v.voor || null, door: v.door, status: stand(v), at: v.at, verlooptAt: v.verlooptAt,
    handtekening: v.handtekening ? { door: v.handtekening.door, at: v.handtekening.at, paden: v.handtekening.paden } : null,
    betaald: v.betaald || null,
    vanScherm: v.vanScherm || null
  });

  /* Een verzoek maken. Het bureau (of de PDA) begint; het andere scherm
     ziet het meteen staan. */
  function maak(zaak, door, data) {
    data = data || {};
    const soort = String(data.soort || '');
    if (!SOORTEN[soort]) return { status: 400, error: 'Kies: betalen op afstand, aftekenen voor verzending of tekenen voor ontvangst.' };
    const titel = schoon(data.titel, 80);
    if (!titel) return { status: 400, error: 'Waar gaat het over? Geef het verzoek een titel.' };
    const bedrag = bedragVan(data.bedrag);
    if (soort === 'betaal' && !bedrag) return { status: 400, error: 'Een betaalverzoek heeft een bedrag nodig.' };
    const open = lijst().filter(v => v.zaak === zaak && stand(v) === 'open').length;
    if (open >= 50) return { status: 429, error: 'Er staan al vijftig verzoeken open; werk die eerst af.' };
    const v = {
      id: 'KOP-' + crypto.randomBytes(3).toString('hex').toUpperCase(),
      zaak, soort, titel,
      toelichting: schoon(data.toelichting, 200),
      bedrag: soort === 'betaal' ? bedrag : 0,
      ref: schoon(data.ref, 40) || null,
      voor: schoon(data.voor, 40) || null,
      vanScherm: schoon(data.vanScherm, 24) || null,
      door: schoon(door, 40) || 'onbekend',
      status: 'open', handtekening: null, betaald: null,
      at: nu(), verlooptAt: new Date(Date.now() + LEVEN_MS).toISOString()
    };
    lijst().unshift(v);
    if (lijst().length > 5000) lijst().length = 5000;
    save();
    if (sseToSupplier) try { sseToSupplier(zaak, { type: 'koppel', verzoek: publiek(v) }); } catch (e) {}
    return { ok: true, verzoek: publiek(v), uitleg: SOORTEN[soort].werkt };
  }

  /* Wat staat er voor mij klaar op dit scherm? Openstaande verzoeken van
     de zaak, nieuwste eerst; afgeronde blijven kort zichtbaar zodat het
     andere scherm de bevestiging ziet. */
  function mijn(zaak, f) {
    f = f || {};
    let uit = lijst().filter(v => v.zaak === zaak);
    if (f.soort && SOORTEN[f.soort]) uit = uit.filter(v => v.soort === f.soort);
    if (f.alleenOpen) uit = uit.filter(v => stand(v) === 'open');
    return { ok: true, soorten: SOORTEN,
      verzoeken: uit.slice(0, 40).map(publiek),
      open: uit.filter(v => stand(v) === 'open').length,
      uitleg: 'Begin een handeling op het ene scherm en maak hem af op het andere. Wat hier staat, staat ook op uw telefoon.' };
  }

  const vind = (zaak, id) => lijst().find(v => v.id === String(id || '') && v.zaak === zaak);

  /* De RTG-code voor een betaalverzoek: dezelfde gezegelde codelaag als de
     kassa gebruikt, dus de leden-app herkent hem meteen. */
  function code(zaak, id) {
    const v = vind(zaak, id);
    if (!v) return { status: 404, error: 'Dit verzoek bestaat niet.' };
    if (v.soort !== 'betaal') return { status: 400, error: 'Alleen een betaalverzoek heeft een code.' };
    if (stand(v) !== 'open') return { status: 409, error: 'Dit verzoek staat niet meer open.' };
    if (!dyncode) return { status: 503, error: 'De codelaag staat niet aan.' };
    const c = dyncode.maak({ soort: 'kas', code: zaak + ':' + v.id, ttlMs: 120000 });
    return { ok: true, id: v.id, token: c.token, vervalt: c.exp, bedrag: v.bedrag,
      tonen: 'Laat deze code aan de klant zien. Hij scant met de RTG-app en betaalt daar; hier verandert pas iets als het geld binnen is.' };
  }

  /* Tekenen. Wie tekent zet zijn naam erbij: een handtekening zonder naam
     is geen handtekening. */
  function teken(zaak, id, wie, paden) {
    const v = vind(zaak, id);
    if (!v) return { status: 404, error: 'Dit verzoek bestaat niet.' };
    if (v.soort === 'betaal') return { status: 400, error: 'Een betaalverzoek teken je niet, die betaal je.' };
    if (stand(v) !== 'open') return { status: 409, error: 'Dit verzoek is al afgerond of verlopen.' };
    const naam = schoon(wie, 40);
    if (!naam) return { status: 400, error: 'Wie tekent er?' };
    const p = schoonHandtekening(paden);
    if (!p) return { status: 400, error: 'Zet eerst een handtekening op het scherm.' };
    v.handtekening = { door: naam, paden: p, at: nu() };
    v.status = 'getekend';
    save();
    if (sseToSupplier) try { sseToSupplier(zaak, { type: 'koppel', verzoek: publiek(v) }); } catch (e) {}
    return { ok: true, verzoek: publiek(v),
      gevolg: v.soort === 'verzenden' ? 'Getekend; de factuur mag de deur uit.' : 'Getekend voor ontvangst.' };
  }

  /* De betaling melden. Dit doet de betaallaag, niet een knop: pas als er
     echt geld binnen is, gaat het verzoek op betaald. */
  function betaalMelden(zaak, id, ref, hoe) {
    const v = vind(zaak, id);
    if (!v || v.soort !== 'betaal') return { status: 404, error: 'Dit betaalverzoek bestaat niet.' };
    if (v.status === 'betaald') return { ok: true, verzoek: publiek(v) };
    if (stand(v) !== 'open') return { status: 409, error: 'Dit verzoek staat niet meer open.' };
    v.status = 'betaald';
    v.betaald = { ref: schoon(ref, 40) || null, hoe: schoon(hoe, 24) || 'RTG Pay', at: nu() };
    save();
    if (sseToSupplier) try { sseToSupplier(zaak, { type: 'koppel', verzoek: publiek(v) }); } catch (e) {}
    return { ok: true, verzoek: publiek(v) };
  }

  function annuleer(zaak, id, wie) {
    const v = vind(zaak, id);
    if (!v) return { status: 404, error: 'Dit verzoek bestaat niet.' };
    if (stand(v) !== 'open') return { status: 409, error: 'Dit verzoek staat niet meer open.' };
    v.status = 'geannuleerd';
    v.doorAf = schoon(wie, 40) || null;
    save();
    if (sseToSupplier) try { sseToSupplier(zaak, { type: 'koppel', verzoek: publiek(v) }); } catch (e) {}
    return { ok: true, id: v.id, status: 'geannuleerd' };
  }

  return { koppel: { SOORTEN, maak, mijn, code, teken, betaalMelden, annuleer, koppelPubliek: publiek } };
};

/* Hospitality Guest OS (deelmodule): BESTELLEN, en de saaie laag eronder.

   Dit is de plek waar een gastbestelling op de BESTAANDE rekening terechtkomt.
   Er komt geen tweede orderadministratie naast (LAT-regel 4): de regels die
   hier ontstaan zijn dezelfde regels die de bediening aanslaat, gebouwd door
   dezelfde kern/horeca/regel.js, en de keuken ziet ze op hetzelfde bord.

   WAT ER WEL BIJ KOMT, EN WAAROM DAT NU MOET.

   1. IDEMPOTENTIE. Een gast op een slechte wifi tikt twee keer op Bestellen. Op
      de vloer is dat een tweede biertje; bij een betaling is het een tweede
      afschrijving. Elke handeling draagt daarom een sleutel van de client, en
      dezelfde sleutel geeft hetzelfde antwoord terug zonder nog een keer te
      doen. Dit achteraf inbouwen betekent elke aanroeper aanpassen, dus het
      hoort in de eerste versie.
   2. AUDIT. Wie, wanneer, waarvandaan, van welke toestand naar welke, en waarom.
      Ook dit is niet achteraf te maken: wat je niet hebt opgeschreven, is weg.
   3. DE TIJDLIJN IS EEN PROJECTIE EN GEEN OPSLAG. De regel draagt al `at`,
      `vrijAt`, `startAt`, `klaarAt` en `uitAt`, gezet door het keukenscherm.
      De gast krijgt daar een leesbare versie van; de keuken houdt zijn eigen
      bord met stations en urgentie. Een gebeurtenis, twee perspectieven -- en
      niet twee administraties die uit de pas gaan lopen. */
'use strict';

/* De reis van de gast. De rekening draagt waar hij is; de stap volgt uit wat er
   gebeurt en wordt niet door een scherm gezet. */
const REIS = ['plaatsgenomen', 'besteld', 'geserveerd', 'afrekenen', 'vertrokken'];

module.exports = ({ save, schoon, horeca, regelbouw, beleid }) => {
  const { H, nu } = horeca;
  const { bouwRegel } = regelbouw;
  const { tijdlijn, gastBeeld } = require('./order-beeld')({ horeca });

  /* ---------- idempotentie ----------
     Per zaak een kleine kaart van sleutel naar antwoord. Bewust begrensd (300)
     en op tijd (12 uur): een sleutel die een dag later terugkomt is geen
     dubbele tik meer maar een nieuwe handeling. */
  function idemZoek(zaakcode, sleutel) {
    const h = H(zaakcode);
    if (!h.idem) h.idem = {};
    const s = schoon(sleutel, 80);
    if (!s) return { sleutel: null, eerder: null };
    const grens = Date.now() - 12 * 3600 * 1000;
    for (const [k, v] of Object.entries(h.idem)) if (Date.parse(v.at) < grens) delete h.idem[k];
    return { sleutel: s, eerder: h.idem[s] ? h.idem[s].uit : null };
  }
  function idemLeg(zaakcode, sleutel, uit) {
    if (!sleutel) return uit;
    const h = H(zaakcode);
    if (!h.idem) h.idem = {};
    const namen = Object.keys(h.idem);
    if (namen.length > 300) delete h.idem[namen[0]];
    h.idem[sleutel] = { at: nu(), uit };
    return uit;
  }

  /* ---------- audit ----------
     Elke mutatie krijgt dezelfde velden. `bron` zegt waar hij vandaan kwam
     (gast, bediening, keuken) en `apparaat` welke sessie -- zonder die twee is
     "wie deed dit" bij een gedeelde tafelrekening niet te beantwoorden. */
  function audit(rek, { actor, bron, apparaat, wat, van, naar, reden }) {
    if (!Array.isArray(rek.audit)) rek.audit = [];
    rek.audit.push({ at: nu(), actor: actor || 'onbekend', bron: bron || 'gast',
      apparaat: apparaat || null, wat, van: van === undefined ? null : van,
      naar: naar === undefined ? null : naar, reden: reden || null });
    if (rek.audit.length > 400) rek.audit = rek.audit.slice(-400);
  }

  const zetReis = (rek, stap) => {
    if (!REIS.includes(stap)) return;
    if (REIS.indexOf(stap) > REIS.indexOf(rek.reis || 'plaatsgenomen')) rek.reis = stap;
  };

  /* ---------- bestellen ----------
     `items` is een mandje. Het gaat als EEN handeling langs het beleid: een
     mandje dat half doorgaat is voor een gast onbegrijpelijk en voor de keuken
     gevaarlijk (de allergie hoort bij het hele mandje, niet bij een regel). */
  function bestel(zaakcode, rek, deelnemer, { items, allergie, idem, apparaat, kaartVan }) {
    const magHet = beleid.magBestellen(zaakcode, rek.kanaal);
    if (!magHet.mag) return { status: 403, error: magHet.uitleg, code: magHet.code };
    if (rek.status !== 'open') return { status: 409, error: 'Deze rekening is al ' + rek.status + '.', code: 'gesloten' };

    const { sleutel, eerder } = idemZoek(zaakcode, idem);
    if (eerder) return Object.assign({}, eerder, { herhaald: true });

    const mandje = Array.isArray(items) ? items.slice(0, 40) : [];
    if (!mandje.length) return { status: 400, error: 'Er staat niets in je bestelling.', code: 'leeg' };

    /* Eerst ALLES nakijken, dan pas iets wegschrijven. Anders staan er drie
       regels op de rekening en faalt de vierde, en dan heeft de gast besteld
       wat hij niet wilde. */
    const klaar = [];
    for (const wens of mandje) {
      const item = kaartVan(String(wens.itemId || ''));
      const magDit = beleid.magItem(zaakcode, item, deelnemer);
      if (!magDit.mag) return { status: 409, error: magDit.uitleg, code: magDit.code,
        item: item ? item.name : String(wens.itemId || '') };
      const uit = bouwRegel(zaakcode, {
        naam: item.name, centen: Math.round(Number(item.price) * 100), groep: item.cat || null,
        aantal: wens.aantal, gang: wens.gang, station: item.station || null,
        notitie: wens.notitie, allergie: allergie || wens.allergie || null,
        gastNr: deelnemer ? deelnemer.nr : null
      }, deelnemer ? deelnemer.handle : 'gast');
      if (uit.error) return { status: uit.status || 400, error: uit.error, code: 'regel' };
      klaar.push(uit.regel);
    }

    const som = klaar.reduce((t, r) => t + r.centen * r.aantal, 0);
    const bevestig = beleid.bevestigingNodig(zaakcode, { allergie, totaalCenten: som });
    for (const r of klaar) {
      if (bevestig) { r.bevestiging = 'wacht'; r.bevestigingUitleg = bevestig.uitleg; r.bevestigingCode = bevestig.code; }
      rek.regels.push(r);
      audit(rek, { actor: deelnemer ? deelnemer.handle : 'gast', bron: 'gast', apparaat,
        wat: 'regel-erop', naar: r.naam + ' × ' + r.aantal, reden: bevestig ? bevestig.code : null });
    }
    zetReis(rek, 'besteld');
    save();

    const uit = { ok: true, toegevoegd: klaar.length, centen: som,
      bevestiging: bevestig ? { code: bevestig.code, uitleg: bevestig.uitleg } : null,
      rekening: gastBeeld(rek, deelnemer) };
    return idemLeg(zaakcode, sleutel, uit);
  }

  return { REIS, idemZoek, idemLeg, audit, zetReis, tijdlijn, gastBeeld, bestel };
};

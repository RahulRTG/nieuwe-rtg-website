/* Het Privekantoor, deelbestand "lus": de concierge-lus op een case.

   CONCIERGE.md beschrijft de lus; dit bestand is de helft die met de WENS en
   het VOORSTEL werkt. De uitvoering (onderdelen, vertraging, herstel,
   afsluiten, de weergave voor een zaak) staat in ./lus-uitvoering.js, en de
   regels zonder opslag in ./lus-regels.js.

   HET VERSCHIL MET EEN GEWONE CASE is waar het akkoord zit. Een gewone case
   vraagt het akkoord bij het openen, over een wens -- en dan kan het kantoor
   pas beginnen als u ja zei op iets wat nog niet bestaat. In de lus werkt het
   kantoor meteen, en vraagt het uw akkoord over een CONCREET VOORSTEL, en alleen
   als dat voorstel buiten uw mandaat valt (bureau/delegatie.js, plus de
   speelruimte in tijd die deze case zelf draagt). Binnen uw mandaat zet het
   kantoor het gewoon vast. Twintig vragen als "is 20:15 ook goed?" zijn het
   tegendeel van gemak.

   DRIE DINGEN DIE HIER VASTLIGGEN:

   1. EEN VERLOPEN AANBOD WORDT NIET GEKOZEN, ook niet door u. Wie akkoord geeft
      op een tafel die al vrijgegeven is, heeft geen tafel (CON-09).
   2. DE OVERGANG NAAR "BIJZONDER" IS EEN REGEL MET EEN OORZAAK. Weigert de
      gewone route, dan staat die weigering in de tijdlijn en verandert de soort
      pas daarna -- nooit stil (CONCIERGE.md par. 2.4).
   3. DE NAAM VAN DE EIGENAAR IS ECHT OF ER STAAT EEN ROL. `lusNeem` zet een
      naam alleen als de route er een uit de sessie heeft; anders blijft de rol
      staan (CON-11). */
'use strict';

const R = require('./lus-regels');

const BRONNEN = ['normaal', 'beslisser', 'alternatief', 'tijd'];

module.exports = (ctx) => {
  const { save, schoon, rid, nu, caseOpen, caseLijst, stap, beoordeel, notify } = ctx;
  const nuMs = () => Date.now();

  function vind(key, id) {
    const c = (caseLijst(key) || []).find(x => x.id === id);
    if (!c) return { fout: { status: 404, error: 'Deze zaak vinden wij niet terug.' } };
    if (c.werkwijze !== 'voorstel') return { fout: { status: 409, error: 'Deze zaak loopt niet via de concierge-lus.' } };
    return { c };
  }

  function meld(key, c, body) {
    if (!notify) return;
    try { notify(key, { title: 'De Rechterhand', body: '"' + c.titel + '": ' + body, scope: 'lifestyle' }); }
    catch (e) { /* een melding die niet aankomt mag de stap niet terugdraaien */ }
  }

  /* ---- het kantoor zoekt -------------------------------------------- */

  function lusNeem(key, id, wie) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const naam = wie && wie.naam ? schoon(wie.naam, 60) : null;
    if (c.eigenaar && c.eigenaar.naam === naam && c.tijdlijn.some(r => r.door === 'kantoor')) return { status: 200, ok: true, eigenaar: c.eigenaar };
    c.eigenaar = { rol: 'Lead Rechterhand', naam };
    stap(c, c.status, c.eigenaar.naam ? c.eigenaar.naam + ' regelt dit voor u.' : 'Een van onze mensen regelt dit voor u.', 'kantoor');
    save();
    return { status: 200, ok: true, eigenaar: c.eigenaar };
  }

  function lusWeigering(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const reden = schoon(b.reden, 300);
    if (!reden) return { status: 400, error: 'Wat zei de gewone route?' };
    const regel = 'De gewone route lukt niet: ' + reden;
    if (c.tijdlijn.some(r => r.notitie === regel)) return { status: 200, ok: true, soort: c.soort }; // dubbeltik
    stap(c, c.status, regel, 'kantoor');
    if (c.soort === 'regulier') {
      c.soort = 'bijzonder';
      stap(c, c.status, 'Daarom is dit nu een bijzonder verzoek: wij zoeken verder langs andere wegen.', 'systeem');
    }
    save();
    return { status: 200, ok: true, soort: c.soort };
  }

  function lusAanbod(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const wat = schoon(b.wat, 160);
    if (!wat) return { status: 400, error: 'Wat wordt er aangeboden?' };
    const geldigMin = Math.round(Number(b.geldigMin) || 0);
    const code = schoon(b.zaak, 40);
    const a = {
      id: rid(), wat, bron: BRONNEN.includes(b.bron) ? b.bron : 'normaal',
      zaak: code ? { soort: 'zaak', code } : null,
      van: /^\d{1,2}:\d{2}$/.test(String(b.van || '')) ? b.van : '',
      duurMin: Math.max(0, Math.min(720, Math.round(Number(b.duurMin) || 0))),
      bedragCenten: Math.max(0, Math.min(1e11, Math.round(Number(b.bedragCenten) || 0))),
      vervangt: schoon(b.vervangt, 20) || null,
      geldigTot: geldigMin > 0 ? new Date(nuMs() + Math.min(geldigMin, 24 * 60) * 60000).toISOString() : '',
      op: nu(), gekozen: false, afgewezen: false
    };
    const zelfde = c.mogelijkheden.find(x => x.wat === a.wat && x.van === a.van && ((x.zaak && x.zaak.code) || '') === code &&
      R.aanbodStand(x, nuMs()) === 'vastgehouden');
    if (zelfde) return { status: 200, ok: true, aanbod: Object.assign({ stand: 'vastgehouden' }, zelfde) }; // dubbeltik
    c.mogelijkheden.push(a);
    stap(c, c.status, 'Mogelijkheid: ' + wat + (a.geldigTot ? ' (vastgehouden tot ' + a.geldigTot.slice(11, 16) + ' UTC)' : ''), 'kantoor');
    save();
    return { status: 200, ok: true, aanbod: Object.assign({ stand: R.aanbodStand(a, nuMs()) }, a) };
  }

  /* Valt dit voorstel binnen wat het lid ons heeft toevertrouwd? Het mandaat
     van het domein beslist over geld; de speelruimte van deze case over tijd.
     Twee vragen, en de strengste wint. */
  function binnenMandaat(key, c, a) {
    const o = beoordeel(key, c.domein, a.bedragCenten);
    if (!o.magZelf) return { ok: false, reden: o.reden };
    if (c.tijd && a.van) {
      const [h1, m1] = c.tijd.split(':').map(Number), [h2, m2] = a.van.split(':').map(Number);
      const verschil = Math.abs((h2 * 60 + m2) - (h1 * 60 + m1));
      if (verschil > c.speelruimteMin) {
        return { ok: false, reden: 'U vroeg ' + c.tijd + ' en dit is ' + a.van + '; dat valt buiten de ' + c.speelruimteMin + ' minuten die u ons gaf.' };
      }
    }
    return { ok: true, reden: o.reden };
  }

  function plaats(c, a, door) {
    a.gekozen = true;
    const onderdeel = { id: rid(), wat: a.wat, van: a.van, duurMin: a.duurMin, reisMin: 0,
      deelnemer: a.zaak, stand: 'bevestigd', vertragingMin: 0, uitAanbod: a.id };
    if (a.vervangt) {
      const oud = c.onderdelen.find(x => x.id === a.vervangt);
      if (oud) oud.vervangenDoor = onderdeel.id;
    }
    c.onderdelen.push(onderdeel);
    c.onderdelen.sort((x, y) => String(x.van).localeCompare(String(y.van)));
    const nogKapot = c.onderdelen.some(x => x.stand === 'kapot' && !x.vervangenDoor);
    stap(c, nogKapot ? 'in herstel' : 'in uitvoering', 'Vastgezet: ' + a.wat + '.', door);
    return onderdeel;
  }

  function lusKies(key, id, b) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    const a = c.mogelijkheden.find(x => x.id === b.aanbod);
    if (!a) return { status: 404, error: 'Dit aanbod staat niet bij deze zaak.' };
    const st = R.aanbodStand(a, nuMs());
    if (st === 'verlopen' || st === 'gekozen' || st === 'afgewezen') {
      return { status: 409, error: 'Dit aanbod kan niet meer gekozen worden: ' + R.AANBOD_LABEL[st].toLowerCase() + '.' };
    }
    if (c.voorstel) return { status: 409, error: 'Er ligt al een voorstel bij het lid.' };
    const m = binnenMandaat(key, c, a);
    if (m.ok) {
      const o = plaats(c, a, 'kantoor');
      save();
      meld(key, c, R.gastBericht(c).tekst);
      return { status: 200, ok: true, vastgezet: true, onderdeel: o, reden: m.reden };
    }
    c.voorstel = { aanbod: a.id, reden: m.reden, op: nu() };
    stap(c, 'wacht op uw akkoord', m.reden, 'systeem');
    save();
    meld(key, c, 'er ligt een voorstel voor u klaar.');
    return { status: 200, ok: true, vastgezet: false, wachtOpLid: true, reden: m.reden };
  }

  /* Het lid beslist over het voorstel. Een aanbod dat intussen verliep, gaat
     terug naar het kantoor met die reden -- niet stil naar "geregeld". */
  function lusBeslis(key, id, akkoord) {
    const { c, fout } = vind(key, id);
    if (fout) return fout;
    if (!c.voorstel) return { status: 400, error: 'Hier ligt geen voorstel voor u klaar.' };
    const a = c.mogelijkheden.find(x => x.id === c.voorstel.aanbod);
    c.voorstel = null;
    const terug = c.onderdelen.some(x => x.stand === 'kapot' && !x.vervangenDoor) ? 'in herstel' : 'in voorbereiding';
    if (!akkoord) {
      a.afgewezen = true;
      stap(c, terug, 'U koos dit niet. Wij zoeken verder.', 'lid');
      save();
      return { status: 200, ok: true, vastgezet: false };
    }
    if (R.aanbodStand(a, nuMs()) === 'verlopen') {
      stap(c, terug, 'Het aanbod "' + a.wat + '" was verlopen voordat u akkoord gaf. Wij zoeken opnieuw.', 'systeem');
      save();
      return { status: 409, error: 'Dit aanbod is intussen verlopen. Wij zoeken opnieuw; u hoeft niets te doen.' };
    }
    const o = plaats(c, a, 'lid');
    save();
    return { status: 200, ok: true, vastgezet: true, onderdeel: o };
  }

  const wens = require('./lus-wens')({ save, schoon, stap, caseOpen, caseLijst, vind });
  return Object.assign({ lusNeem, lusWeigering, lusAanbod, lusKies, lusBeslis, vind }, wens);
};

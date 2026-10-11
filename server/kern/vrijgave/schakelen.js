/* SCHAKELEN IN DE VRIJGAVEPOORT: een stand zetten, een extern besluit vastleggen
   of intrekken. Alles via ./stand.js `muteer()` (slot, versie, atomair), met een
   regel in de eigen geschiedenis van het standbestand EN in het auditlog. Waarom
   aanzetten iets anders vraagt dan uitzetten, staat in de kop van
   server/routes/kantoren/vrijgave.js. */
'use strict';
const reg = require('./register');

module.exports = function maakSchakelen({ st, register, isOpenbaar, sandboxMag, k }) {
  const sandboxMagFn = typeof sandboxMag === 'function' ? sandboxMag : () => !isOpenbaar();
  /* SCHAKELEN. `stapOmhoog` zegt dat de route de verse passkey al heeft
     gezien; deze module kan dat niet zelf vaststellen en vertrouwt het dus
     alleen voor wat de route hem doorgeeft. Uitzetten vraagt het nooit. */
  function zet(id, nieuweStand, { wie, reden, versie, stapOmhoog = false } = {}) {
    const cap = register.vind(id);
    if (!cap) return { ok: false, status: 404, error: 'Deze capability staat niet in het vrijgaveregister.' };
    if (!reg.STANDEN.includes(nieuweStand)) return { ok: false, status: 400, error: 'Onbekende stand.' };
    if (!cap.standen.includes(nieuweStand)) return { ok: false, status: 409, error: 'Deze stand bestaat niet voor deze capability.' };
    if (!wie || !/^user-\d+$/.test(String(wie))) return { ok: false, status: 403, error: 'Schakelen vraagt een mens op naam.' };
    const r = String(reden || '').trim();
    if (r.length < 10) return { ok: false, status: 400, error: 'Geef een reden van minstens tien tekens; die komt in het spoor.' };
    const activeert = reg.ACTIVEREND.includes(nieuweStand);
    if (activeert && (cap.geld || cap.beveiliging) && stapOmhoog !== true)
      return { ok: false, status: 401, bevestigingNodig: true, error: 'Aanzetten van geld of veiligheid vraagt een verse passkey.' };
    /* Productie en een openbaar adres kennen geen sandbox (./lokaal.js). Hier
       geweigerd zodat niemand hem kan ZETTEN; ./oordeel.js weigert hem nog eens
       als hij er toch staat (een met de hand bewerkt bestand). */
    if (nieuweStand === 'sandbox' && !sandboxMagFn())
      return { ok: false, status: 409, error: 'Deze installatie kent geen sandboxstand (productie of openbaar).' };
    const uit = st.muteer(versie, staat => {
      /* Alleen een VASTGELEGDE gelijke stand is ongewijzigd. Een mens die op een
         verse installatie uitdrukkelijk `disabled` kiest, legt dat vast: zonder
         regel geldt lokaal de sandboxstandaard (./lokaal.js), en dan zou zijn
         uitzetten stil niets doen. */
      const oud = staat.standen[id] ? staat.standen[id].stand : cap.veiligeStand;
      if (staat.standen[id] && oud === nieuweStand) return { ok: true, ongewijzigd: true, stand: oud };
      const op = new Date().toISOString();
      staat.standen[id] = { stand: nieuweStand, wie: String(wie), sinds: op, reden: r.slice(0, 500) };
      staat.geschiedenis.push({ op, id, van: oud, naar: nieuweStand, wie: String(wie), reden: r.slice(0, 500), stapOmhoog: !!stapOmhoog });
      return { ok: true, id, van: oud, stand: nieuweStand };
    });
    if (uit.ok && !uit.ongewijzigd && k.audit)
      try { k.audit(String(wie), 'Vrijgave ' + id + ': ' + uit.van + ' -> ' + uit.stand + ' (versie ' + uit.versie + '). Reden: ' + r); }
      catch (e) { /* het spoor in het standbestand staat er al; de tweede plek mag de schakeling niet terugdraaien */ }
    return uit;
  }

  function besluitVastleggen(naam, { wie, bron, sha256, reden, versie, stapOmhoog = false } = {}) {
    if (!reg.BESLUITEN[naam]) return { ok: false, status: 404, error: 'Onbekend besluit.' };
    if (!wie || !/^user-\d+$/.test(String(wie))) return { ok: false, status: 403, error: 'Een besluit vastleggen vraagt een mens op naam.' };
    if (stapOmhoog !== true) return { ok: false, status: 401, bevestigingNodig: true, error: 'Een besluit vastleggen vraagt een verse passkey.' };
    if (!/^[a-f0-9]{64}$/.test(String(sha256 || ''))) return { ok: false, status: 400, error: 'Geef de SHA-256 van het besluitdocument.' };
    const b = String(bron || '').trim();
    if (b.length < 6 || b.length > 300) return { ok: false, status: 400, error: 'Geef de bron van het besluit (een documentverwijzing).' };
    const r = String(reden || '').trim();
    if (r.length < 10) return { ok: false, status: 400, error: 'Geef een reden van minstens tien tekens.' };
    const uit = st.muteer(versie, staat => {
      const op = new Date().toISOString();
      staat.besluiten[naam] = { wie: String(wie), op, bron: b, sha256: String(sha256), reden: r.slice(0, 500) };
      staat.geschiedenis.push({ op, besluit: naam, vastgelegd: true, wie: String(wie), bron: b, sha256: String(sha256), reden: r.slice(0, 500) });
      return { ok: true, besluit: naam };
    });
    if (uit.ok && k.audit) try { k.audit(String(wie), 'Vrijgavebesluit ' + naam + ' vastgelegd (bron ' + b + ', sha256 ' + sha256 + ').'); } catch (e) { /* zie zet() */ }
    return uit;
  }

  function besluitIntrekken(naam, { wie, reden, versie } = {}) {
    if (!reg.BESLUITEN[naam]) return { ok: false, status: 404, error: 'Onbekend besluit.' };
    if (!wie || !/^user-\d+$/.test(String(wie))) return { ok: false, status: 403, error: 'Een besluit intrekken vraagt een mens op naam.' };
    const r = String(reden || '').trim();
    if (r.length < 10) return { ok: false, status: 400, error: 'Geef een reden van minstens tien tekens.' };
    const uit = st.muteer(versie, staat => {
      const b = staat.besluiten[naam];
      if (!b || b.ingetrokken) return { ok: true, ongewijzigd: true };
      const op = new Date().toISOString();
      b.ingetrokken = { wie: String(wie), op, reden: r.slice(0, 500) };
      staat.geschiedenis.push({ op, besluit: naam, ingetrokken: true, wie: String(wie), reden: r.slice(0, 500) });
      return { ok: true, besluit: naam, ingetrokken: true };
    });
    if (uit.ok && !uit.ongewijzigd && k.audit) try { k.audit(String(wie), 'Vrijgavebesluit ' + naam + ' INGETROKKEN. Reden: ' + r); } catch (e) { /* zie zet() */ }
    return uit;
  }

  return { zet, besluitVastleggen, besluitIntrekken };
};

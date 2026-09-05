/* Spellen (deelmodule): een potje op een gedeeld scherm.

   Een televisie is geen deelnemer en draagt nooit een ledenaccount. Hij krijgt
   uitsluitend `zicht.publiek`, maar de toegang daartoe is wel een echte
   credential. De vroegere 32-bits code deed twee banen tegelijk en stond in
   iedere poll-URL. Deze laag gebruikt daarom een eenmalige koppeling en daarna
   een afzonderlijke, gehashte schermsessie. Zie ../spelprojectie-toegang.js.

   Uitgifte, koppeling, rotatie en intrekking wijzigen dezelfde `spellen`-
   collectie in één autoritatieve transactie. Een opslagfout kan dus nooit een
   bruikbare code achterlaten die de aanroeper als mislukt heeft gezien. */
'use strict';

const BEWAAR_MS = 30 * 86400000;
const MAX_UITGIFTES = 50;

module.exports = (ctx) => {
  const { S, save, bewerkCollectie, crypto, nu, SPEL, SOORTEN, ZICHT, codenaamVan } = ctx;
  const toegang = require('../spelprojectie-toegang')({ crypto, nu });
  const afdruk = waarde => crypto.createHash('sha256').update(String(waarde || '')).digest('hex');

  function vorm(staat) {
    if (!staat || typeof staat !== 'object' || Array.isArray(staat))
      throw new Error('spellen hoort een kaart te zijn');
    if (!staat.potjes || typeof staat.potjes !== 'object') staat.potjes = {};
    toegang.migreerLegacy(staat);
    if (!Array.isArray(staat.projecties)) staat.projecties = [];
    return staat.projecties;
  }

  function sluit(rij, actor, waarom) {
    if (!rij || rij.gesloten_at) return;
    toegang.intrekActief(rij, actor, waarom);
    rij.gesloten_at = nu();
    rij.sluitreden = String(waarom || 'gesloten').slice(0, 200);
  }

  function ruim(staat) {
    const rijen = vorm(staat);
    for (const rij of rijen) {
      if (!rij || rij.gesloten_at) continue;
      if (!staat.potjes[rij.potje]) sluit(rij, 'systeem', 'Potje bestaat niet meer');
      else if (toegang.redenKoppeling(rij) && toegang.redenScherm(rij))
        sluit(rij, 'systeem', 'Projectietoegang verlopen');
    }
    const grens = Date.now() - BEWAAR_MS;
    for (let i = rijen.length - 1; i >= 0; i--)
      if (rijen[i] && rijen[i].gesloten_at && Date.parse(rijen[i].gesloten_at) < grens)
        rijen.splice(i, 1);
    return rijen;
  }

  function transactie(werk) {
    S();
    const doe = staat => { const rijen = ruim(staat); return werk(staat, rijen); };
    if (typeof bewerkCollectie === 'function') return bewerkCollectie('spellen', doe);
    const staat = S(), voor = JSON.stringify(staat);
    try {
      const antwoord = doe(staat);
      if (antwoord && typeof antwoord.then === 'function')
        throw new Error('spellen-transactie mag niet asynchroon zijn');
      if (JSON.stringify(staat) !== voor) save();
      return antwoord;
    } catch (e) {
      const oud = JSON.parse(voor);
      for (const k of Object.keys(staat)) delete staat[k];
      Object.assign(staat, oud);
      throw e;
    }
  }

  const geldigIdem = idem => {
    const waarde = String(idem || '').trim();
    return waarde.length >= 16 && waarde.length <= 200 ? waarde : null;
  };
  const isActief = rij => !!(rij && !rij.gesloten_at &&
    (!toegang.redenKoppeling(rij) || !toegang.redenScherm(rij)));

  /* Iedere bewuste uitgifte maakt een nieuwe code en trekt een eventueel oud
     scherm meteen in. Een retry met dezelfde idempotentiesleutel krijgt nooit
     het eenmalige geheim opnieuw. */
  function projectieOpen(mij, id, idem) {
    const idemWaarde = geldigIdem(idem);
    if (!idemWaarde) return { status: 400, error: 'Een veilige herhaalsleutel is verplicht.' };
    return transactie((staat, rijen) => {
      const potje = staat.potjes[String(id || '')];
      if (!potje || !potje.spelers.includes(mij))
        return { status: 404, error: 'Dit potje bestaat niet (meer).' };
      if (potje.status === 'klaar') return { status: 409, error: 'Dit potje is klaar.' };
      if (!ZICHT[potje.soort] || !ZICHT[potje.soort].publiek)
        return { status: 400, error: 'Dit spel hoort niet op een gedeeld scherm.' };

      const vinger = afdruk(JSON.stringify({ mij, potje: potje.id }));
      const idemHash = afdruk('spelprojectie-uitgifte|' + mij + '|' + idemWaarde);
      for (const rij of rijen) for (const uitgifte of (rij.uitgiftes || [])) {
        if (uitgifte.idem_hash !== idemHash) continue;
        return uitgifte.fingerprint_hash === vinger
          ? { status: 409, error: 'Deze schermcode is al eenmalig getoond en wordt niet herhaald.', herhaald: true }
          : { status: 409, error: 'Deze herhaalsleutel hoort bij een ander projectieverzoek.' };
      }

      let rij = rijen.find(x => x.potje === potje.id && isActief(x));
      const geroteerd = !!rij;
      if (rij) toegang.intrekActief(rij, codenaamVan(mij) || mij, 'Nieuwe schermcode uitgegeven');
      else {
        rij = { id: 'pj' + crypto.randomBytes(16).toString('hex'), potje: potje.id,
          door: mij, aangemaakt_at: nu(), gesloten_at: null, sluitreden: null,
          koppeling: null, koppeling_historie: [], scherm: null,
          scherm_historie: [], uitgiftes: [], rotatie: 0 };
        rijen.push(rij);
      }
      rij.door = mij; rij.rotatie = Math.max(0, Number(rij.rotatie) || 0) + 1;
      rij.laatst_uitgegeven_at = nu();
      const gemaakt = toegang.nieuweKoppeling(rijen, rij, codenaamVan(mij) || mij, rij.rotatie);
      if (!gemaakt) return { status: 503, error: 'Kon geen unieke schermcode maken.' };
      rij.koppeling = gemaakt.toegang;
      rij.uitgiftes.push({ idem_hash: idemHash, fingerprint_hash: vinger, at: nu() });
      if (rij.uitgiftes.length > MAX_UITGIFTES)
        rij.uitgiftes.splice(0, rij.uitgiftes.length - MAX_UITGIFTES);
      return { status: 200, ok: true, id: rij.id, code: gemaakt.code,
        eenmalig: true, geroteerd, tot: gemaakt.toegang.expires_at };
    });
  }

  /* De televisie wisselt de eenmalige koppeling in voor een eigen sessie.
     Beide wijzigingen staan in dezelfde transactie; een half verbruikte code
     of een sessie zonder verbruikte code kan dus niet ontstaan. */
  function projectieKoppel(code) {
    return transactie((staat, rijen) => {
      const rij = toegang.zoekKoppeling(rijen, code);
      if (!rij || toegang.redenKoppeling(rij) || !staat.potjes[rij.potje])
        return { status: 404, error: 'Deze schermcode doet het niet (meer).' };
      const gemaakt = toegang.nieuweSessie(rijen, rij);
      if (!gemaakt) return { status: 503, error: 'Kon geen veilige schermsessie maken.' };
      toegang.gebruikKoppeling(rij);
      rij.scherm = gemaakt.toegang;
      rij.gekoppeld_at = nu();
      return { status: 200, ok: true, token: gemaakt.code,
        eenmalig: true, tot: gemaakt.toegang.expires_at };
    });
  }

  /* Polling is read-only. De sessiehash wordt over alle actieve en historische
     rijen vergeleken; de invoer staat in een POST-body en nooit in een URL.
     Ook deze leesactie gaat door het autoritatieve collectieslot. Daardoor is
     een intrekking door instance A bij de eerstvolgende poll op instance B al
     zichtbaar en vertrouwen we niet op een later cachesein. */
  function projectieStand(token) {
    return transactie((staat, rijen) => {
      const rij = toegang.zoekScherm(rijen, token);
      if (!rij || toegang.redenScherm(rij))
        return { status: 404, error: 'Deze schermsessie doet het niet (meer).' };
      const p = staat.potjes[rij.potje];
      if (!p) return { status: 404, error: 'Deze schermsessie doet het niet (meer).' };
      const uit = {
        status: 200, spel: p.soort, naam: SOORTEN[p.soort] || p.soort,
        spelers: p.spelers.map(codenaamVan), beurt: p.beurt,
        teams: p.teams.slice(0, p.spelers.length), modus: p.modus,
        klaar: p.status === 'klaar', winnaar: p.winnaar || null,
        tot: rij.scherm.expires_at
      };
      if (p.status !== 'wacht' && p.staat) uit.staat = ZICHT[p.soort].publiek(p, p.staat);
      return uit;
    });
  }

  /* Iedere speler kan alle actuele credentials van zijn potje intrekken. */
  function projectieSluit(mij, id) {
    return transactie((staat, rijen) => {
      const potje = staat.potjes[String(id || '')];
      if (!potje || !potje.spelers.includes(mij))
        return { status: 404, error: 'Dit potje bestaat niet (meer).' };
      let aantal = 0;
      for (const rij of rijen) if (rij.potje === potje.id && !rij.gesloten_at) {
        sluit(rij, codenaamVan(mij) || mij, 'Door speler gesloten'); aantal += 1;
      }
      return { status: 200, ok: true, al: aantal === 0 };
    });
  }

  const projectieSpellen = () => Object.keys(SPEL).filter(k => ZICHT[k] && ZICHT[k].publiek);

  return { projectieOpen, projectieKoppel, projectieStand, projectieSluit,
    projectieSpellen, _KOPPEL_MS: toegang.KOPPEL_MS, _SCHERM_MS: toegang.SCHERM_MS };
};

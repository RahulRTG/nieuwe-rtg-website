/* Onboarding (deelmodule): de lid-kant. Leest de onboarding-status voor een
   sessie, slaat de intake-velden op, bewaart de paspoort-meta, bewaakt de
   RTG Pay-poort (eenmalig paspoort bij de gratis pas) en tekent het contract.
   Draait op de gedeelde context die kern/onboarding.js een keer opbouwt. */
module.exports = (ctx) => {
  const { accounts, save, schoon, crypto, nu, scopeVan, profielVan, profielId } = ctx;

  // wat we al van een echt account weten (naam, e-mail, paspoortstatus ...)
  function bekend(veldId, sess) {
    const acc = sess && sess.account;
    const md = acc && accounts.getMemberState ? (accounts.getMemberState(acc.id) || {}) : {};
    switch (veldId) {
      case 'naam': return acc ? accounts.realNameOf(acc) : null;
      case 'email': return acc ? accounts.emailOf(acc) : null;
      case 'telefoon': return acc ? accounts.phoneOf(acc) : null;
      case 'geboortedatum': return md.geboren || null;
      case 'land': return md.land || null;
      case 'nationaliteit': return md.nationaliteit || null;
      // Demo-sessies zonder account kunnen geen identiteitsbewijs uploaden
      // (de upload eist een echt account); daar telt het veld als voldaan,
      // anders zou de demo eeuwig voor de onboarding-poort blijven staan.
      case 'paspoort': return acc
        ? (['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified) ? 'ingediend' : null)
        : 'demo-sessie';
      default: return null;
    }
  }
  function waardeVan(veld, sess, profiel) {
    const eigen = profiel.velden[veld.id];
    if (eigen != null && eigen !== '') return eigen;
    return bekend(veld.id, sess);
  }

  // Het paspoort (KYC-upload) is standaard bij de betaalde passen (Lifestyle,
  // Business). Bij de gratis RTG Pass hoeft niemand een paspoort te laten zien
  // -- behalve wie RTG Pay gebruikt: dan wordt het eenmalig gevraagd. Guests en
  // RTFoundation laten nooit een paspoort zien via deze poort.
  function paspoortVerplicht(tier, profiel) {
    if (tier === 'lifestyle' || tier === 'business') return true;
    if (tier === 'rtg') return !!(profiel && profiel.payGebruikt);
    return false;
  }

  // De volledige onboarding-status voor deze sessie binnen een scope.
  function status(scope, sess) {
    const sc = scopeVan(scope);
    const tier = (sess && sess.tier) || 'guest';
    const profiel = profielVan(profielId(sess));
    const velden = sc.velden
      .filter(v => (v.voorWie || []).includes(tier))
      .filter(v => v.id !== 'paspoort' || paspoortVerplicht(tier, profiel))
      .map(v => {
        const w = waardeVan(v, sess, profiel);
        return { id: v.id, label: v.label, type: v.type, ingevuld: !!(w && String(w).trim()),
          waarde: v.type === 'kyc' ? undefined : (w != null ? String(w) : '') };
      });
    const ontbrekend = velden.filter(v => !v.ingevuld).map(v => v.id);
    const ond = (profiel.ondertekend || {})[scope];
    const getekend = !!(ond && ond.versie === sc.contract.versie);
    return {
      scope, tier,
      velden, ontbrekend,
      contract: { versie: sc.contract.versie, titel: sc.contract.titel, tekst: sc.contract.tekst,
        ondertekend: getekend, ondertekendAt: getekend ? ond.at : null },
      klaar: ontbrekend.length === 0 && getekend
    };
  }
  // Snelle ja/nee: is de onboarding van deze sessie (platform-scope) rond?
  function klaar(sess, scope) { return status(scope || 'rtg', sess).klaar; }

  /* RTG Pay-gebruik door een gratis lid. Vanaf het eerste gebruik is het
     paspoort eenmalig vereist; de betaalde passen hebben dat al bij de
     onboarding gedaan. Geeft {ok:true} als het door mag; anders een nette
     403 met kyc:true, zodat de app het lid naar de paspoort-stap stuurt.
     (Demo-/gastsessies zonder echt account laten we door: die kunnen geen
     identiteitsbewijs uploaden.) */
  function payGate(sess) {
    const tier = (sess && sess.tier) || 'guest';
    if (tier === 'lifestyle' || tier === 'business') return { ok: true };
    if (tier !== 'rtg') return { ok: true };
    const profiel = profielVan(profielId(sess));
    if (!profiel.payGebruikt) { profiel.payGebruikt = true; save(); }
    const acc = sess && sess.account;
    const geverifieerd = acc && ['pending', 'approved', 'geverifieerd', 'verified'].includes(acc.verified);
    if (!acc || geverifieerd) return { ok: true };
    return { ok: false, status: 403, kyc: true,
      error: 'RTG Pay vraagt eenmalig je paspoort. Open de app; Rahul helpt je het te bevestigen.' };
  }

  // De intake-velden opslaan (paspoort loopt via de KYC-upload, niet hier).
  function slaOp(scope, sess, velden) {
    const sc = scopeVan(scope);
    const geldig = new Set(sc.velden.map(v => v.id));
    const p = profielVan(profielId(sess));
    for (const [k, v] of Object.entries(velden || {})) {
      if (!geldig.has(k) || k === 'paspoort') continue;
      p.velden[k] = schoon(String(v == null ? '' : v), 200);
    }
    save();
    return status(scope, sess);
  }

  /* Paspoort-meta (vervaldatum, nummer) uit de MRZ-scan bewaren op het profiel.
     Rahul gebruikt de vervaldatum om een half jaar vooraf te seinen dat het
     paspoort verloopt (zie kern/fluister). Alleen een geldige ISO-datum telt. */
  /* Wat de scan van het paspoort oplevert, bewaren we -- en niet minder dan dat.

     Hier stonden alleen nummer en vervaldatum, terwijl shared/mrz.js de hele
     strook al leest: naam, nummer, nationaliteit, geboortedatum, vervaldatum en
     geslacht. De rest werd stil weggegooid, en het gevolg was dat een lid dat
     zijn paspoort al had gescand bij een vlucht ALSNOG zijn nationaliteit moest
     intypen. Twee keer hetzelfde vragen is precies wat dit huis niet doet.

     Alleen wat een grens of een luchtvaartmaatschappij echt van je wil, en
     niets meer: geslacht en de naamvelden laten we hier bewust liggen -- de
     naam staat al in de kluis en het geslacht heeft hier geen lezer.
     Nationaliteit en geboortedatum gaan ook naar het ledendossier, want daar
     kijkt de gegevenspoort. */
  function bewaarPaspoort(sess, info) {
    info = info || {};
    const p = profielVan(profielId(sess));
    if (!p.paspoort) p.paspoort = {};
    const datum = (x) => (x && /^\d{4}-\d{2}-\d{2}$/.test(String(x)) ? String(x) : null);
    if (datum(info.vervaldatum)) p.paspoort.vervaldatum = datum(info.vervaldatum);
    if (info.nummer) p.paspoort.nummer = schoon(String(info.nummer), 40);
    if (info.nationaliteit) p.paspoort.nationaliteit = schoon(String(info.nationaliteit), 60);
    if (datum(info.geboortedatum)) p.paspoort.geboortedatum = datum(info.geboortedatum);
    p.paspoort.at = nu();
    /* HET LEDENDOSSIER IS WAAR DE GEGEVENSPOORT KIJKT. Die krijgt alleen de
       accountrij en het dossier mee, niet dit onboarding-profiel; wat hier
       blijft staan bestaat voor hem dus niet, en dan zou hij blijven vragen om
       een paspoort dat we net gescand hebben. Het dossier gaat versleuteld en
       gebonden de kluis in (zie de kop van kern/gegevenspoort.js), dus dit is
       geen tweede, lossere bewaarplaats maar dezelfde. */
    const acc = sess && sess.account;
    if (acc && accounts.saveMemberState && accounts.getMemberState) {
      try {
        const md = accounts.getMemberState(acc.id) || {};
        md.paspoort = Object.assign({}, md.paspoort, {
          nummer: p.paspoort.nummer || (md.paspoort || {}).nummer || null,
          vervaldatum: p.paspoort.vervaldatum || (md.paspoort || {}).vervaldatum || null,
          nationaliteit: p.paspoort.nationaliteit || (md.paspoort || {}).nationaliteit || null,
          geboortedatum: p.paspoort.geboortedatum || (md.paspoort || {}).geboortedatum || null
        });
        // de losse velden blijven bestaan voor wie ze al gebruikte (ledenregister)
        if (p.paspoort.nationaliteit && !md.nationaliteit) md.nationaliteit = p.paspoort.nationaliteit;
        if (p.paspoort.geboortedatum && !md.geboren) md.geboren = p.paspoort.geboortedatum;
        accounts.saveMemberState(acc.id, md);
      } catch (e) { /* geen dossier: de paspoort-kant staat er hoe dan ook */ }
    }
    save();
    return { ok: true, paspoort: { vervaldatum: p.paspoort.vervaldatum || null,
      nationaliteit: p.paspoort.nationaliteit || null } };
  }

  // Het contract ondertekenen: getypte naam + akkoord -> bewijs met vingerafdruk.
  function teken(scope, sess, naam, akkoord) {
    if (!akkoord) return { status: 400, error: 'Zet een vinkje dat u akkoord bent met de overeenkomst.' };
    naam = schoon(String(naam || ''), 80);
    if (naam.length < 2) return { status: 400, error: 'Typ uw volledige naam om digitaal te ondertekenen.' };
    const sc = scopeVan(scope);
    const pid = profielId(sess);
    const p = profielVan(pid);
    const hash = crypto.createHash('sha256').update(sc.contract.versie + '|' + sc.contract.tekst + '|' + naam + '|' + pid).digest('hex');
    p.ondertekend[scope] = { versie: sc.contract.versie, naam, at: nu(), hash };
    save();
    return { status: 200, ok: true, ...status(scope, sess) };
  }

  return { status, klaar, payGate, slaOp, bewaarPaspoort, teken };
};

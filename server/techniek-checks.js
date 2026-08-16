/* Techniek-motor, de integratie-checks: alles wat aan een buitendienst of
   geldsysteem hangt (AI, betalingen, wallet, Rust-motor, bank, stad, e-mail).
   De motor zelf (draaiChecks, zekeringen) en de data-/runtime-checks staan in
   ./techniek.js; daar worden deze checks op hun vaste plek ingevoegd. */

// Elke check geeft { status, detail } terug. status: 'ok' | 'waarschuwing' | 'fout'.
const CHECKS_INTEGRATIES = [
  {
    id: 'ai', naam: 'Persoonlijke AI (Claude)', code: 'AI-01', categorie: 'Integraties',
    run: (c) => process.env.RTG_AI_UIT === '1'
      ? { status: 'ok', detail: 'Bewust uit: handmatige werkmodus actief; geen gegevens gaan naar een AI-provider.' }
      : c.anthropic
      ? { status: 'ok', detail: 'Claude API actief.' }
      : { status: 'waarschuwing', detail: 'Handmatige werkmodus: geen AI-provider ingesteld.' }
  },
  {
    id: 'betalingen', naam: 'Betalingen', code: 'PAY-01', categorie: 'Integraties',
    run: (c) => {
      const m = c.betaal && c.betaal.mogelijkheden ? c.betaal.mogelijkheden() : null;
      if (m && m.uit) return { status: 'ok', detail: 'Bewust uit: alle betaalrails en webhooks weigeren fail-closed; ook de demo-provider staat uit.' };
      const echt = m && m.rails.filter(x => x.echt).map(x => x.id);
      return echt && echt.length
        ? { status: 'ok', detail: echt.map(x => x === 'mollie' ? 'Mollie' : x === 'adyen' ? 'Adyen' : 'Stripe').join(' + ') + ' actief; betaalwaarheid provider-onafhankelijk.' }
        : { status: 'waarschuwing', detail: 'Demo-betalingen: geen echte betaalprovider ingesteld (geen echt geld).' };
    }
  },
  {
    id: 'wallet', naam: 'RTG Pay (wallet)', code: 'PAY-02', categorie: 'Integraties',
    run: (c) => {
      if (!c.pay || !c.pay.sluitcontrole) return { status: 'waarschuwing', detail: 'Wallet niet gekoppeld aan de bewaking.' };
      const s = c.pay.sluitcontrole();
      if (!s.klopt) return { status: 'fout', detail: 'De wallet-sluitcontrole faalt: som ' + s.som + ' (hoort exact 0 te zijn).' };
      return { status: 'ok', detail: 'Het wallet-grootboek sluit (som 0).' };
    }
  },
  {
    id: 'motorschaduw', naam: 'Rust-motor (schaduw)', code: 'MOTOR-01', categorie: 'Integraties',
    run: async (c) => {
      if (!c.pay || !c.pay.schaduw || !c.pay.schaduw.aan) return { status: 'waarschuwing', detail: 'Schaduw-modus uit. Zet RTG_MOTOR_SHADOW om de Rust-motor als parallel-grootboek mee te laten lopen.' };
      let s;
      try { s = await c.pay.schaduw.stand(); } catch (e) { return { status: 'fout', detail: 'Kan de motor niet bereiken: ' + (e.message || e) }; }
      if (!s || s.fout) return { status: 'fout', detail: 'Kan de motor niet bereiken: ' + ((s && s.fout) || 'onbekend') };
      if (!s.motorKlopt) return { status: 'fout', detail: 'De Rust-motor sluit niet (motor-som ' + s.motorSom + ', hoort exact 0 te zijn).' };
      if (!s.gelijk) return { status: 'fout', detail: 'DRIFT (som): JS-som ' + s.jsSom + ' vs motor-som ' + s.motorSom + ' -- de schaduw loopt uit de pas.' };
      // Som klopt, maar valt er per-rekening iets weg? De vingerafdruk over alle
      // saldi vangt drift die de som mist (A te hoog, B even veel te laag).
      if (s.gelijkAlle === false) return { status: 'fout', detail: 'DRIFT (per rekening): de som klopt (' + s.jsSom + ') maar de saldi-vingerafdruk verschilt (JS ' + s.jsVingerafdruk + ' vs motor ' + s.motorVingerafdruk + ') -- ergens vallen twee rekeningen tegen elkaar weg.' };
      if (s.gelijkAlle === true) return { status: 'ok', detail: 'Lockstep: JS en de Rust-motor sluiten allebei op ' + s.jsSom + ' en de saldi-vingerafdruk klopt rekening-voor-rekening (' + s.jsVingerafdruk + ').' };
      return { status: 'ok', detail: 'Lockstep op de som (' + s.jsSom + '). Motor levert nog geen saldi-vingerafdruk; alleen de som is vergeleken.' };
    }
  },
  {
    id: 'bank', naam: 'RTG Bank', code: 'BANK-01', categorie: 'Integraties',
    run: (c) => {
      if (!c.bank) return { status: 'waarschuwing', detail: 'Bankmodule niet gekoppeld aan de bewaking.' };
      const g = c.bank.gezondheid();
      const r = c.bankRegie ? c.bankRegie() : null;
      if (r && r.nood && r.nood.actief) return { status: 'fout', detail: 'NOOD actief: clearing valt terug op de kaart-rails. ' + (r.nood.reden || '') };
      if (!g.sluit || !g.sluit.klopt) return { status: 'fout', detail: 'De sluitcontrole faalt: som ' + (g.sluit ? g.sluit.som : '?') + ' (hoort exact 0 te zijn).' };
      return { status: 'ok', detail: 'Stand "' + (r ? r.modus : '?') + '"' + (r && r.ledenAan ? ', live voor leden' : '') + '; sluitcontrole klopt; ' + g.aantalRekeningen + ' rekening(en), ' + g.boekingenVandaag + ' boeking(en) vandaag.' };
    }
  },
  {
    id: 'stad', naam: 'RTG Stad', code: 'STAD-01', categorie: 'Integraties',
    run: (c) => {
      if (!c.stad) return { status: 'waarschuwing', detail: 'Stadsmodule niet gekoppeld aan de bewaking.' };
      const b = c.stad.stadBeeld();
      if (!b.vloot.totaal) return { status: 'waarschuwing', detail: 'Nog geen Stadsdozen aangemeld.' };
      if (b.vloot.online * 2 < b.vloot.totaal) return { status: 'fout', detail: 'Meer dan de helft van de Stadsdozen is offline (' + b.vloot.online + '/' + b.vloot.totaal + ').' };
      return { status: 'ok', detail: 'Scenario "' + b.scenario + '"; ' + b.vloot.online + '/' + b.vloot.totaal + ' Stadsdozen online; ' + b.alerts.length + ' waarschuwing(en) op het bord.' };
    }
  },
  {
    id: 'email', naam: 'E-mail (SMTP)', code: 'MAIL-01', categorie: 'Integraties',
    run: (c) => c.mailLiveGeconfigureerd
      ? { status: 'ok', detail: 'SMTP ingesteld; e-mail wordt echt verstuurd.' }
      : c.mailSandboxGeconfigureerd
        ? { status: 'waarschuwing', detail: 'Lokale SMTP-sandbox actief; berichten verlaten deze computer niet.' }
        : { status: 'waarschuwing', detail: 'Geen SMTP: e-mail gaat naar de outbox in plaats van naar klanten.' }
  },
  {
    id: 'sms', naam: 'Herstel-SMS', code: 'SMS-01', categorie: 'Integraties',
    run: (c) => c.smsGeconfigureerd
      ? { status: 'ok', detail: 'Echte SMS-provider actief.' }
      : c.smsSandboxGeconfigureerd
        ? { status: 'waarschuwing', detail: 'Lokale SMS-contractsandbox actief; codes blijven in de beveiligde outbox en bereiken geen telefoon.' }
        : { status: 'fout', detail: 'Geen echte SMS-provider: herstel voor accounts met telefoon staat veilig geblokkeerd; outbox telt niet als bezorging.' }
  }
];

module.exports = { CHECKS_INTEGRATIES };

/* Uitgifte na een volledig FOUNDATION-besluit. Los van de intake gehouden:
   hier is in een oogopslag te zien welke toegang een goedkeuring werkelijk
   creëert. Partnerstichtingen blijven 'goedgekeurd' tot hun overeenkomst in
   Foundation OS is vastgelegd; alleen scholen en vrijwilligers gaan actief. */
'use strict';

module.exports = ({ db, crypto, nu, rid }) => {
  function os() {
    if (!db.data.rtfos || typeof db.data.rtfos !== 'object') db.data.rtfos = {};
    for (const k of ['steden','vrijwilligers','partners']) if (!Array.isArray(db.data.rtfos[k])) db.data.rtfos[k] = [];
    return db.data.rtfos;
  }
  function scholen() {
    if (!db.data.foundation || typeof db.data.foundation !== 'object') db.data.foundation = {};
    if (!db.data.foundation.scholen || typeof db.data.foundation.scholen !== 'object') db.data.foundation.scholen = {};
    return db.data.foundation.scholen;
  }
  function uniekeCode(prefix, bestaand) {
    const tekens = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code;
    do { code = prefix + '-' + Array.from(crypto.randomBytes(7)).map(x => tekens[x % tekens.length]).join(''); }
    while (bestaand(code));
    return code;
  }
  function schoolCode() {
    let c; do { c = 'S' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5); } while (scholen()[c]);
    return c;
  }
  const stadVan = a => os().steden.find(x => x.id === a.stadId)
    || os().steden.find(x => String(x.naam || '').toLowerCase() === String(a.plaats || '').toLowerCase()) || null;

  return function geefUit(a) {
    if (a.type === 'school') {
      if (Object.values(scholen()).some(s => s.registratie && s.registratie.brin === a.brin)) return { status:409, error:'Dit BRIN is al toegelaten.' };
      const code = schoolCode(), beheerToken = rid(16), geheim = rid(24);
      const activatieHash = crypto.createHash('sha256').update(geheim).digest('hex');
      const activatieVerlooptAt = new Date(Date.parse(nu()) + 48 * 60 * 60 * 1000).toISOString();
      scholen()[code] = { code, naam:a.naam, plaats:a.plaats, token:beheerToken, at:nu(), status:'actief', personeel:{},
        registratie:{ aanvraagId:a.id, brin:a.brin, landCode:a.landCode,
          activatieHash, activatieVerlooptAt, activatieStatus:'open' }, goedgekeurdAt:nu() };
      return { toegang:{ soort:'school', schoolCode:code, activatieVerlooptAt,
        opmerking:'De persoonlijke activatielink is naar het gecontroleerde schooladres gestuurd.' },
        geheim:{ activatie:code + '.' + geheim } };
    }
    const stad = stadVan(a);
    if (!stad) return { status:409, error:'Koppel deze aanvraag eerst aan een actieve FOUNDATION-stad.' };
    if (a.type === 'vrijwilliger') {
      const code = uniekeCode('RTFV', c => os().vrijwilligers.some(v => v.code === c));
      os().vrijwilligers.push({ id:rid(6), code, stad:stad.id, naam:a.naam, contact:a.email,
        status:'actief', beschikbaar:[], talen:a.talen || [], vaardigheden:a.vaardigheden || [], rijbewijs:false,
        voertuig:false, gedragscode:true, vogGeldigTot:null, trainingen:[], uren:[], projecten:[], evaluaties:[], at:nu(), registratieId:a.id });
      return { soort:'vrijwilliger', code };
    }
    const code = uniekeCode('RTFP', c => os().partners.some(p => p.code === c));
    os().partners.push({ id:rid(6), code, stad:stad.id, naam:a.naam, kvk:a.landCode === 'NL' ? a.registratieNummer : '',
      registratie:{ landCode:a.landCode, nummer:a.registratieNummer }, rsin:a.rsin || '', anbi:!!a.anbi,
      iban:'', contact:a.email, doel:a.doel, werkgebied:a.plaats, bestuurders:[], documenten:[], beoordelingen:[],
      afspraken:{ geld:'rtf', vrijwilligers:'partner', persoonsgegevens:'partner', aansprakelijk:'partner', rapportage:'partner' },
      bevoegdheden:[], van:null, tot:null, status:'goedgekeurd', at:nu(), registratieId:a.id });
    return { soort:'partnerstichting', code, opmerking:'De samenwerking wordt actief na een ondertekende overeenkomst.' };
  };
};

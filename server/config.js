/* Configuratie-controle die bij het opstarten faalt als productie onveilig is
   ingesteld ("fail-fast"). Beter dat de server weigert te starten dan dat hij
   live gaat met het demo-wachtwoord open of met onversleutelde gegevens.

   valideer(env) is zuiver en testbaar: het leest alleen uit het meegegeven
   omgevingsobject en geeft { fouten, waarschuwingen, productie } terug.
   pasToe() draait die controle bij de echte start en stopt het proces bij een
   fout in productie. */

function isProductie(env) { return env.NODE_ENV === 'production'; }

function valideer(env) {
  const fouten = [];
  const waarschuwingen = [];
  /* Fouten die de start afbreken ONGEACHT NODE_ENV. Die bak bestaat omdat de
     rest van dit bestand aan precies een vraag hangt -- staat NODE_ENV op
     production? -- en dat is nu juist de vraag die op een verkeerd ingerichte
     server het verkeerde antwoord geeft. Zie ./config/openbaar.js. */
  const hardeFouten = [];
  const prod = isProductie(env);

  // PORT moet een geldig poortnummer zijn als hij is gezet.
  if (env.PORT && !(Number(env.PORT) > 0 && Number(env.PORT) < 65536))
    fouten.push(`PORT is ongeldig: "${env.PORT}".`);

  if (prod) {
    /* De productieregels staan in ./config/productie.js. Ze zijn met afstand het
       grootste deel van deze keuring en het deel dat het vaakst groeit -- elke
       doorlichting levert er weer een op. Hier bleven ze het bestand over de
       10 KB duwen; daar staan ze op zichzelf. */
    require('./config/productie').keur(env, fouten, waarschuwingen);
  } else {
    // Buiten productie: alleen zachte hints, nooit blokkeren.
    if (!env.RTG_ENC_KEY) waarschuwingen.push('RTG_ENC_KEY niet gezet: versleuteling-at-rest is uit (prima voor lokaal, niet voor productie).');
  }

  /* BUITEN de productietak, en dat is de hele bedoeling: deze keuring vraagt of
     de installatie zichzelf als openbaar OPGEEFT, in plaats van te vertrouwen
     op de variabele die iemand kan vergeten. */
  require('./config/openbaar').keurOpenbareBouwstand(env, { fouten, waarschuwingen, hardeFouten, productie: prod });

  return { fouten, waarschuwingen, hardeFouten, productie: prod };
}

/* Draai de controle en handel ernaar: waarschuwingen loggen, en bij fouten in
   productie stoppen met exitcode 1 (zodat de proces-manager niet doorstart op
   een onveilige configuratie). Buiten productie worden fouten als waarschuwing
   getoond, zodat lokaal experimenteren niet wordt geblokkeerd. */
function pasToe(env, log) {
  env = env || process.env;
  log = log || console;
  const r = valideer(env);
  for (const w of r.waarschuwingen) (log.warn || log.log).call(log, '[config] ' + w);
  /* EERST DE HARDE FOUTEN, EN ZONDER TE KIJKEN NAAR NODE_ENV.

     Ze staan vóór de bestaande tak omdat ze er anders doorheen zouden vallen:
     buiten productie degradeert die tak elke fout tot een waarschuwing, en dan
     is een grendel weer een gele regel in een logboek dat niemand leest. */
  if (r.hardeFouten.length) {
    for (const f of r.hardeFouten) (log.error || log.log).call(log, '[config] ' + f);
    (log.error || log.log).call(log,
      '[config] ' + r.hardeFouten.length + ' configuratiefout(en) die op geen enkele installatie mogen; start afgebroken. '
      + 'Dit hangt NIET aan NODE_ENV.');
    process.exit(1);
  }
  if (r.fouten.length) {
    for (const f of r.fouten) (log.error || log.log).call(log, '[config] ' + f);
    if (r.productie) {
      (log.error || log.log).call(log, `[config] ${r.fouten.length} configuratiefout(en) in productie; start afgebroken.`);
      process.exit(1);
    } else {
      (log.warn || log.log).call(log, '[config] bovenstaande zou de productiestart blokkeren; buiten productie gaan we door.');
    }
  } else if (r.productie) {
    (log.info || log.log).call(log, '[config] productieconfiguratie gecontroleerd: in orde.');
  }
  return r;
}

module.exports = { valideer, pasToe, isProductie };

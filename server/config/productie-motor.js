/* Productiepoort voor de Rust-sidecar. Een vlag die "motor" zegt zonder URL
   of poorttoken is geen cut-over maar een latente storing. De netwerkproef zelf
   staat in scripts/golive.js; deze laag keurt de statische bedrading. */
'use strict';

function geldigeUrl(waarde) {
  try {
    const u = new URL(waarde);
    return ['http:', 'https:'].includes(u.protocol) && !!u.hostname && !u.username && !u.password;
  } catch (e) { return false; }
}

function keurMotor(env, fouten, waarschuwingen = []) {
  const magnaat = String(env.RTG_MAGNAAT_RUST || 'uit').toLowerCase();
  const geld = String(env.RTG_MOTOR_GELD || 'schaduw').toLowerCase();
  const globaleNoodstop = String(env.RTG_RUST_ALLES_UIT || '0');
  const capabilityRuw = String(env.RTG_CAPABILITY_RUST_MODE || (env.RTG_CAPABILITY_RUST_BIN ? 'motor' : 'uit')).toLowerCase();
  const capability = capabilityRuw === 'shadow' ? 'schaduw' : capabilityRuw;
  if (!['uit', 'motor'].includes(magnaat)) fouten.push('RTG_MAGNAAT_RUST moet "uit" of "motor" zijn.');
  if (!['uit', 'schaduw', 'shadow', 'motor'].includes(geld)) fouten.push('RTG_MOTOR_GELD heeft een onbekende stand.');
  if (!['0', '1'].includes(globaleNoodstop)) fouten.push('RTG_RUST_ALLES_UIT moet 0 of 1 zijn.');
  if (!['uit', 'schaduw', 'canary', 'motor'].includes(capability))
    fouten.push('RTG_CAPABILITY_RUST_MODE moet uit, schaduw, canary of motor zijn.');
  if (env.RTG_CAPABILITY_RUST_CANARY_PCT !== undefined) {
    const percentage = Number(env.RTG_CAPABILITY_RUST_CANARY_PCT);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100)
      fouten.push('RTG_CAPABILITY_RUST_CANARY_PCT moet een getal van 0 tot en met 100 zijn.');
  }

  const rekenUrl = env.RTG_MOTOR_REKEN_URL || env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW || '';
  const geldUrl = env.RTG_MOTOR_GELD_URL || env.RTG_MOTOR_SHADOW || '';
  const gebruiktNetwerk = magnaat === 'motor' || geld === 'motor' || !!env.RTG_MOTOR_SHADOW;
  if (magnaat === 'motor' && !rekenUrl) fouten.push('RTG_MAGNAAT_RUST=motor vereist RTG_MOTOR_REKEN_URL (of de gedeelde motor-URL).');
  if (geld === 'motor' && !geldUrl) fouten.push('RTG_MOTOR_GELD=motor vereist RTG_MOTOR_GELD_URL of RTG_MOTOR_SHADOW.');
  for (const [naam, waarde] of [
    ['RTG_MOTOR_REKEN_URL', env.RTG_MOTOR_REKEN_URL],
    ['RTG_MOTOR_GELD_URL', env.RTG_MOTOR_GELD_URL],
    ['RTG_MOTOR_SHADOW', env.RTG_MOTOR_SHADOW]
  ]) if (waarde && !geldigeUrl(waarde)) fouten.push(naam + ' moet een geldige HTTP(S)-URL zonder inloggegevens zijn.');

  if (gebruiktNetwerk) {
    const token = String(env.RTG_MOTOR_TOKEN || '');
    if (token.length < 16) fouten.push('De Rust-sidecar is geconfigureerd maar RTG_MOTOR_TOKEN ontbreekt of is korter dan 16 tekens.');
  }
  if (capability !== 'uit' && !env.RTG_CAPABILITY_RUST_BIN)
    fouten.push('Een actieve RTG_CAPABILITY_RUST_MODE vereist RTG_CAPABILITY_RUST_BIN.');
  if (env.RTG_CAPABILITY_RUST_BIN && !String(env.RTG_CAPABILITY_RUST_BIN).startsWith('/'))
    fouten.push('RTG_CAPABILITY_RUST_BIN moet in productie een absoluut pad naar de gebouwde Rust-binary zijn.');
  if (globaleNoodstop === '1') waarschuwingen.push('RTG_RUST_ALLES_UIT=1: alle Rust-appmigraties vallen terug; Rust Sentinel blijft actief.');
}

module.exports = { keurMotor, geldigeUrl };

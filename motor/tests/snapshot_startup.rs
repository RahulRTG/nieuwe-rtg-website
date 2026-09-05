use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

fn map() -> PathBuf {
    let tik = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    std::env::temp_dir().join(format!("rtg-motor-startup-{}-{}", std::process::id(), tik))
}

fn opdracht(bin: &Path, sleutel: &Path, state: &Path, genesis: &str, args: &[&str]) -> std::process::Output {
    Command::new(bin).args(args)
        .env("RTG_MOTOR_STATE_KEY_FILE", sleutel)
        .env("RTG_MOTOR_DATA", state)
        .env("RTG_MOTOR_EXPECT_GENESIS", genesis)
        .output().unwrap()
}

#[test]
fn operator_init_bindt_genesis_en_restart_faalt_bij_drift_of_verlies() {
    let dir = map(); fs::create_dir_all(&dir).unwrap();
    let sleutel = dir.join("money.key"); let state = dir.join("state.json");
    fs::write(&sleutel,
        b"k-proof:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef\n").unwrap();
    let bin = PathBuf::from(env!("CARGO_BIN_EXE_rtg-motor"));
    let genesis = "g-11111111111111111111111111111111";

    let eerste = opdracht(&bin, &sleutel, &state, genesis, &["init-state"]);
    assert!(eerste.status.success(), "{}", String::from_utf8_lossy(&eerste.stderr));
    let rauw = fs::read_to_string(&state).unwrap();
    assert!(rauw.contains(genesis) && rauw.contains("ciphertext"));
    assert!(!rauw.contains("saldi") && !rauw.contains("boekingen"));
    let dubbel = opdracht(&bin, &sleutel, &state, genesis, &["init-state"]);
    assert!(!dubbel.status.success(), "init-state hoort eenmalig te zijn");

    let verkeerd = opdracht(&bin, &sleutel, &state,
        "g-22222222222222222222222222222222", &[]);
    assert!(!verkeerd.status.success());
    assert!(String::from_utf8_lossy(&verkeerd.stderr).contains("andere genesis"));

    fs::remove_file(&state).unwrap();
    let verdwenen = opdracht(&bin, &sleutel, &state, genesis, &[]);
    assert!(!verdwenen.status.success());
    assert!(String::from_utf8_lossy(&verdwenen.stderr).contains("snapshot ontbreekt"));
    fs::remove_dir_all(&dir).unwrap();
}

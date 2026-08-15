/* De onafhankelijke staat, releasecontrole en het geketende auditspoor van
   RTG Sentinel. De netwerkproxy staat in de rtg-sentinel binary; deze module
   blijft klein genoeg om zonder draaiende app te testen en herstellen. */
use crate::{aead, json::{self, Json}, rng, sha256};
use std::collections::BTreeSet;
use std::fs::{self, File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::{Component, Path, PathBuf};

const MAX_BEWIJS: u64 = 16 * 1024 * 1024;
const MAX_BESTAND: u64 = 128 * 1024 * 1024;
const MAX_BESTANDEN: usize = 20_000;
const MAX_VERSCHILLEN: usize = 200;
const MAPPEN: [&str; 4] = ["server", "public", "scripts", "motor/src"];
const LOS: [&str; 8] = ["package.json", "package-lock.json", "motor/Cargo.toml",
    "motor/Cargo.lock", "Dockerfile", "docker-compose.yml", ".env.example", "SLO.json"];

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Mode { Normaal, Waakzaam, Beperkt, Isolatie }
impl Mode {
    pub fn as_str(self) -> &'static str { match self {
        Self::Normaal=>"normaal", Self::Waakzaam=>"waakzaam",
        Self::Beperkt=>"beperkt", Self::Isolatie=>"isolatie" } }
    pub fn parse(s: &str) -> Option<Self> { match s {
        "normaal"=>Some(Self::Normaal), "waakzaam"=>Some(Self::Waakzaam),
        "beperkt"=>Some(Self::Beperkt), "isolatie"=>Some(Self::Isolatie), _=>None } }
}

#[derive(Clone, Debug)]
pub struct ScanResult {
    pub ok: bool,
    pub at_ms: u64,
    pub bewijs_sha256: String,
    pub inhoud_sha256: String,
    pub bestand_aantal: usize,
    pub verschil_aantal: usize,
    pub verschillen: Vec<String>,
}
impl ScanResult {
    fn leeg() -> Self { Self { ok:false, at_ms:0, bewijs_sha256:String::new(),
        inhoud_sha256:String::new(), bestand_aantal:0, verschil_aantal:0, verschillen:Vec::new() } }
    pub fn json(&self) -> Json {
        let mut j=Json::obj();
        j.set("ok",Json::Bool(self.ok)).set("atMs",Json::Num(self.at_ms as f64))
         .set("bewijsSha256",Json::Str(self.bewijs_sha256.clone()))
         .set("inhoudSha256",Json::Str(self.inhoud_sha256.clone()))
         .set("bestandAantal",Json::Num(self.bestand_aantal as f64))
         .set("verschilAantal",Json::Num(self.verschil_aantal as f64))
         .set("verschillen",Json::Arr(self.verschillen.iter().cloned().map(Json::Str).collect()));
        j
    }
}

#[derive(Clone)]
struct BewijsBestand { pad:String, bytes:u64, hash:String }

fn veilig_rel(p: &str) -> bool {
    !p.is_empty() && !Path::new(p).is_absolute() && Path::new(p).components().all(|c| matches!(c, Component::Normal(_)))
}
fn hex64(s:&str)->bool { s.len()==64 && s.bytes().all(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()) }
fn uitgesloten(rel:&str)->bool {
    rel=="server/data" || rel.starts_with("server/data/") || rel==".release" || rel.starts_with(".release/") ||
    rel=="node_modules" || rel.starts_with("node_modules/")
}
fn voeg_pad(root:&Path, rel:&str, uit:&mut Vec<String>, fouten:&mut Vec<String>) {
    if uitgesloten(rel) { return; }
    let vol=root.join(rel);
    let meta=match fs::symlink_metadata(&vol) { Ok(m)=>m, Err(_)=>return };
    if meta.file_type().is_symlink() { fouten.push(format!("Symlink in releasebron: {}",rel)); return; }
    if meta.is_dir() {
        let mut namen=match fs::read_dir(&vol) { Ok(x)=>x.filter_map(Result::ok).map(|x|x.file_name()).collect::<Vec<_>>(),
            Err(e)=>{fouten.push(format!("Map onleesbaar {}: {}",rel,e));return} };
        namen.sort();
        for naam in namen {
            let naam=naam.to_string_lossy();
            voeg_pad(root,&format!("{}/{}",rel,naam),uit,fouten);
        }
    } else if meta.is_file() { uit.push(rel.to_string()); }
}
fn verzamel(root:&Path)->(Vec<String>,Vec<String>) {
    let mut uit=Vec::new(); let mut fouten=Vec::new();
    for p in LOS { voeg_pad(root,p,&mut uit,&mut fouten); }
    for p in MAPPEN { voeg_pad(root,p,&mut uit,&mut fouten); }
    let image=root.join("rtg-motor").exists();
    for p in if image { vec!["rtg-motor","rtg-sentinel"] }
             else { vec!["motor/target/release/rtg-motor","motor/target/release/rtg-sentinel"] } {
        voeg_pad(root,p,&mut uit,&mut fouten);
    }
    uit.sort(); uit.dedup(); (uit,fouten)
}

fn bestand_hash(p:&Path)->Result<(String,u64),String> {
    let meta=fs::symlink_metadata(p).map_err(|e|e.to_string())?;
    if !meta.is_file() || meta.file_type().is_symlink() { return Err("geen gewoon bestand".into()); }
    if meta.len()>MAX_BESTAND { return Err("bestand boven 128 MiB".into()); }
    let f=File::open(p).map_err(|e|e.to_string())?;
    let (h,n)=sha256::reader(f).map_err(|e|e.to_string())?;
    Ok((sha256::hex_bytes(&h),n))
}

pub fn scan_release(root:&Path,bewijs:&Path,pin:&str)->ScanResult {
    let mut uit=ScanResult::leeg(); uit.at_ms=rng::nu_ms();
    let mut verschillen=Vec::<String>::new();
    let raw=match fs::read(bewijs) { Ok(v)=>v, Err(e)=>{
        uit.verschillen=vec![format!("Releasebewijs onleesbaar: {}",e)]; uit.verschil_aantal=1; return uit; } };
    if raw.len() as u64>MAX_BEWIJS { uit.verschillen=vec!["Releasebewijs boven 16 MiB.".into()];uit.verschil_aantal=1;return uit; }
    uit.bewijs_sha256=sha256::hex(&raw);
    let pin=pin.trim().to_ascii_lowercase();
    if !hex64(&pin) { verschillen.push("Externe releasepin ontbreekt of is geen SHA-256.".into()); }
    else if !aead::ct_eq(pin.as_bytes(),uit.bewijs_sha256.as_bytes()) { verschillen.push("Releasebewijs wijkt af van de externe pin.".into()); }
    let manifest=match std::str::from_utf8(&raw).ok().and_then(|s|json::parse(s).ok()) {
        Some(v)=>v,None=>{verschillen.push("Releasebewijs bevat geen geldige JSON.".into());
            uit.verschil_aantal=verschillen.len();uit.verschillen=verschillen;return uit;}
    };
    if manifest.str_at("formaat")!=Some("rtg-release-bewijs-v1") { verschillen.push("Onbekend releasebewijsformaat.".into()); }
    uit.inhoud_sha256=manifest.str_at("inhoudSha256").unwrap_or("").to_string();
    let rijen=match manifest.get("bestanden") { Some(Json::Arr(a))=>a, _=>{
        verschillen.push("Releasebewijs heeft geen bestandenlijst.".into());
        uit.verschil_aantal=verschillen.len();uit.verschillen=verschillen;return uit;} };
    if rijen.len()>MAX_BESTANDEN { verschillen.push(format!("Releasebewijs heeft meer dan {} bestanden.",MAX_BESTANDEN)); }
    let mut bestanden=Vec::new(); let mut gezien=BTreeSet::new();
    for rij in rijen.iter().take(MAX_BESTANDEN) {
        let pad=rij.str_at("pad").unwrap_or("");
        let bytes=rij.i64_at("bytes").unwrap_or(-1);
        let hash=rij.str_at("sha256").unwrap_or("");
        if !veilig_rel(pad) || bytes<0 || !hex64(hash) || !gezien.insert(pad.to_string()) {
            verschillen.push(format!("Ongeldige bewijsregel: {}",if pad.is_empty(){"(zonder pad)"}else{pad})); continue;
        }
        bestanden.push(BewijsBestand{pad:pad.into(),bytes:bytes as u64,hash:hash.into()});
    }
    uit.bestand_aantal=bestanden.len();
    let mut totaal=sha256::Sha256::new();
    for b in &bestanden { totaal.update(format!("{}\0{}\0{}\n",b.pad,b.bytes,b.hash).as_bytes()); }
    let totaal_hex=sha256::hex_bytes(&totaal.finish());
    if !hex64(&uit.inhoud_sha256) || !aead::ct_eq(totaal_hex.as_bytes(),uit.inhoud_sha256.as_bytes()) {
        verschillen.push("Verzamelhash in het releasebewijs klopt niet.".into());
    }
    let verwacht:BTreeSet<String>=bestanden.iter().map(|b|b.pad.clone()).collect();
    let (huidig,mut loop_fouten)=verzamel(root); verschillen.append(&mut loop_fouten);
    for p in &huidig { if !verwacht.contains(p) { verschillen.push(format!("Nieuw bestand buiten bewijs: {}",p)); } }
    let huidig_set:BTreeSet<String>=huidig.into_iter().collect();
    for b in &bestanden {
        if !huidig_set.contains(&b.pad) { verschillen.push(format!("Bestand ontbreekt: {}",b.pad)); continue; }
        match bestand_hash(&root.join(&b.pad)) {
            Ok((_h,n)) if n!=b.bytes=>verschillen.push(format!("Grootte gewijzigd: {}",b.pad)),
            Ok((h,_)) if !aead::ct_eq(h.as_bytes(),b.hash.as_bytes())=>verschillen.push(format!("Inhoud gewijzigd: {}",b.pad)),
            Ok(_)=>{}, Err(e)=>verschillen.push(format!("Bestand onleesbaar {}: {}",b.pad,e)),
        }
    }
    uit.verschil_aantal=verschillen.len();
    uit.verschillen=verschillen.into_iter().take(MAX_VERSCHILLEN).collect();
    uit.ok=uit.verschil_aantal==0; uit
}

fn schoon_reden(s:&str)->Result<String,String> {
    let r=s.split_whitespace().collect::<Vec<_>>().join(" ");
    if r.len()<8 || r.len()>240 { Err("Reden moet 8 tot 240 tekens zijn.".into()) } else { Ok(r) }
}
pub fn valideer_prefixes(v:&[String])->Result<Vec<String>,String> {
    if v.is_empty() || v.len()>100 { return Err("Beperken vraagt 1 tot 100 padprefixes.".into()); }
    let mut s=BTreeSet::new();
    for p in v {
        let p=p.trim();
        if !p.starts_with('/') || p.len()>180 || p.bytes().any(|b|b.is_ascii_control()||b.is_ascii_whitespace()) {
            return Err(format!("Ongeldige padprefix: {}",p));
        }
        s.insert(p.to_string());
    }
    Ok(s.into_iter().collect())
}
fn prefixes_json(p:&[String])->Json { Json::Arr(p.iter().cloned().map(Json::Str).collect()) }
fn prefixes_van(j:&Json)->Vec<String> { match j.get("prefixes") { Some(Json::Arr(a))=>a.iter().filter_map(|x|x.as_str().map(str::to_string)).collect(),_=>Vec::new() } }

pub struct Sentinel {
    pub root:PathBuf, pub bewijs:PathBuf, pub pin:String, pub data:PathBuf,
    token:Vec<u8>, pub mode:Mode, pub reden:String, pub prefixes:Vec<String>,
    pub revisie:u64, pub gewijzigd_ms:u64, pub scan:ScanResult,
    pub upstream_gezond:bool, pub upstream_fouten:u64, pub upstream_laatst_ms:u64,
    pub audit_veilig:bool, audit_seq:u64, audit_vorige:String,
}

impl Sentinel {
    pub fn open(root:PathBuf,bewijs:PathBuf,pin:String,data:PathBuf,token:Vec<u8>)->Result<Self,String> {
        fs::create_dir_all(&data).map_err(|e|format!("Sentinel-datamap: {}",e))?;
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&data,fs::Permissions::from_mode(0o700)).ok(); }
        let (audit_veilig,audit_seq,audit_vorige)=controleer_audit(&data.join("audit.jsonl"),&token)
            .unwrap_or((false,0,String::new()));
        let mut s=Self{root,bewijs,pin,data,token,mode:Mode::Normaal,reden:"Normale bedrijfsstand.".into(),
            prefixes:Vec::new(),revisie:0,gewijzigd_ms:rng::nu_ms(),scan:ScanResult::leeg(),
            upstream_gezond:false,upstream_fouten:0,upstream_laatst_ms:0,audit_veilig,audit_seq,audit_vorige};
        if let Err(e)=s.laad_stand() { s.mode=Mode::Isolatie;s.reden=format!("Standbestand onbetrouwbaar: {}",e);s.audit_veilig=false; }
        if !s.audit_veilig { s.mode=Mode::Isolatie;s.reden="Sentinel-auditketen is beschadigd; handmatig onderzoek vereist.".into(); }
        Ok(s)
    }
    fn state_pad(&self)->PathBuf { self.data.join("state.json") }
    fn state_kern(&self)->String { format!("rtg-sentinel-state-v1\n{}\n{}\n{}\n{}\n{}",
        self.mode.as_str(),self.revisie,self.gewijzigd_ms,self.reden,self.prefixes.join("\0")) }
    fn laad_stand(&mut self)->Result<(),String> {
        let p=self.state_pad(); if !p.exists(){return Ok(())}
        let j=json::parse(&fs::read_to_string(p).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;
        let mode=Mode::parse(j.str_at("mode").unwrap_or("")).ok_or("ongeldige mode")?;
        let rev=j.i64_at("revisie").ok_or("ongeldige revisie")? as u64;
        let at=j.i64_at("gewijzigdMs").ok_or("ongeldige tijd")? as u64;
        let reden=j.str_at("reden").unwrap_or("").to_string(); let prefixes=prefixes_van(&j);
        let mac=j.str_at("mac").unwrap_or("");
        let kern=format!("rtg-sentinel-state-v1\n{}\n{}\n{}\n{}\n{}",mode.as_str(),rev,at,reden,prefixes.join("\0"));
        let verwacht=sha256::hex_bytes(&sha256::hmac(&self.token,kern.as_bytes()));
        if !aead::ct_eq(mac.as_bytes(),verwacht.as_bytes()){return Err("HMAC klopt niet".into())}
        self.mode=mode;self.revisie=rev;self.gewijzigd_ms=at;self.reden=reden;self.prefixes=prefixes;Ok(())
    }
    fn bewaar_stand(&self)->Result<(),String> {
        let mac=sha256::hex_bytes(&sha256::hmac(&self.token,self.state_kern().as_bytes()));
        let mut j=Json::obj();j.set("formaat",Json::Str("rtg-sentinel-state-v1".into()))
          .set("mode",Json::Str(self.mode.as_str().into())).set("revisie",Json::Num(self.revisie as f64))
          .set("gewijzigdMs",Json::Num(self.gewijzigd_ms as f64)).set("reden",Json::Str(self.reden.clone()))
          .set("prefixes",prefixes_json(&self.prefixes)).set("mac",Json::Str(mac));
        atomisch(&self.state_pad(),&(j.dump()+"\n"))
    }
    pub fn wijzig(&mut self,mode:Mode,reden:&str,prefixes:Vec<String>,actie:&str)->Result<(),String> {
        if !self.audit_veilig{return Err("Auditketen is onbetrouwbaar; herstel die offline voordat de stand verandert.".into())}
        if self.mode==Mode::Isolatie && mode!=Mode::Isolatie && !self.scan.ok {
            return Err("Herstel geweigerd: de releasecontrole is nog rood.".into());
        }
        let reden=schoon_reden(reden)?;
        let prefixes=if mode==Mode::Beperkt{valideer_prefixes(&prefixes)?}else{Vec::new()};
        self.mode=mode;self.reden=reden;self.prefixes=prefixes;self.revisie+=1;self.gewijzigd_ms=rng::nu_ms();
        self.bewaar_stand()?;self.schrijf_audit(actie)?;Ok(())
    }
    fn schrijf_audit(&mut self,actie:&str)->Result<(),String> {
        self.audit_seq+=1;
        let kern=format!("rtg-sentinel-audit-v1\n{}\n{}\n{}\n{}\n{}\n{}",self.audit_seq,
          self.gewijzigd_ms,actie,self.mode.as_str(),self.reden,self.prefixes.join("\0"));
        let data=format!("{}\n{}",self.audit_vorige,kern);
        let mac=sha256::hex_bytes(&sha256::hmac(&self.token,data.as_bytes()));
        let mut j=Json::obj();j.set("formaat",Json::Str("rtg-sentinel-audit-v1".into()))
          .set("seq",Json::Num(self.audit_seq as f64)).set("atMs",Json::Num(self.gewijzigd_ms as f64))
          .set("actie",Json::Str(actie.into())).set("mode",Json::Str(self.mode.as_str().into()))
          .set("reden",Json::Str(self.reden.clone())).set("prefixes",prefixes_json(&self.prefixes))
          .set("vorige",Json::Str(self.audit_vorige.clone())).set("mac",Json::Str(mac.clone()));
        let pad=self.data.join("audit.jsonl");
        let mut f=OpenOptions::new().create(true).append(true).open(&pad).map_err(|e|e.to_string())?;
        f.write_all((j.dump()+"\n").as_bytes()).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;
        #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(&pad,fs::Permissions::from_mode(0o600)).ok(); }
        self.audit_vorige=mac;Ok(())
    }
    pub fn scan_nu(&mut self,fail_closed:bool)->bool {
        self.scan=scan_release(&self.root,&self.bewijs,&self.pin);
        if !self.scan.ok && fail_closed && self.mode!=Mode::Isolatie && self.audit_veilig {
            let reden=format!("Release-integriteit rood: {} verschil(len).",self.scan.verschil_aantal);
            let _=self.wijzig(Mode::Isolatie,&reden,Vec::new(),"auto-isolatie-integriteit");
        }
        self.scan.ok
    }
    pub fn staat_pad_toe(&self,pad:&str)->bool { match self.mode {
        Mode::Normaal|Mode::Waakzaam=>true,
        Mode::Beperkt=>!self.prefixes.iter().any(|p|pad.starts_with(p)),
        Mode::Isolatie=>false,
    } }
    pub fn status_json(&self,actief:usize)->Json {
        let mut j=Json::obj();j.set("ok",Json::Bool(true)).set("mode",Json::Str(self.mode.as_str().into()))
          .set("reden",Json::Str(self.reden.clone())).set("revisie",Json::Num(self.revisie as f64))
          .set("gewijzigdMs",Json::Num(self.gewijzigd_ms as f64)).set("prefixes",prefixes_json(&self.prefixes))
          .set("release",self.scan.json()).set("upstreamGezond",Json::Bool(self.upstream_gezond))
          .set("upstreamFouten",Json::Num(self.upstream_fouten as f64)).set("upstreamLaatstMs",Json::Num(self.upstream_laatst_ms as f64))
          .set("actieveVerbindingen",Json::Num(actief as f64)).set("auditVeilig",Json::Bool(self.audit_veilig));j
    }
    pub fn zet_upstream(&mut self,gezond:bool){self.upstream_gezond=gezond;self.upstream_laatst_ms=rng::nu_ms();if gezond{self.upstream_fouten=0}else{self.upstream_fouten+=1}}
}

fn atomisch(p:&Path,tekst:&str)->Result<(),String>{
    let tmp=p.with_extension("tmp");
    {let mut f=File::create(&tmp).map_err(|e|e.to_string())?;f.write_all(tekst.as_bytes()).and_then(|_|f.sync_all()).map_err(|e|e.to_string())?;}
    fs::rename(&tmp,p).map_err(|e|e.to_string())?;
    #[cfg(unix)] {use std::os::unix::fs::PermissionsExt;fs::set_permissions(p,fs::Permissions::from_mode(0o600)).ok();}
    Ok(())
}

pub fn controleer_audit(p:&Path,token:&[u8])->Result<(bool,u64,String),String>{
    if !p.exists(){return Ok((true,0,String::new()))}
    let f=File::open(p).map_err(|e|e.to_string())?;let mut vorige=String::new();let mut seq=0u64;
    for (i,lijn) in BufReader::new(f).lines().enumerate(){
        let lijn=lijn.map_err(|e|e.to_string())?;if lijn.trim().is_empty(){continue}
        let j=json::parse(&lijn).map_err(|e|format!("auditregel {}: {}",i+1,e))?;
        let n=j.i64_at("seq").ok_or_else(||format!("auditregel {} zonder seq",i+1))? as u64;
        if n!=seq+1||j.str_at("vorige").unwrap_or("")!=vorige{return Err(format!("auditketen breekt op regel {}",i+1))}
        let at=j.i64_at("atMs").unwrap_or(-1);let actie=j.str_at("actie").unwrap_or("");let mode=j.str_at("mode").unwrap_or("");
        let reden=j.str_at("reden").unwrap_or("");let prefixes=prefixes_van(&j);
        let kern=format!("rtg-sentinel-audit-v1\n{}\n{}\n{}\n{}\n{}\n{}",n,at,actie,mode,reden,prefixes.join("\0"));
        let verwacht=sha256::hex_bytes(&sha256::hmac(token,format!("{}\n{}",vorige,kern).as_bytes()));
        let mac=j.str_at("mac").unwrap_or("");if !aead::ct_eq(mac.as_bytes(),verwacht.as_bytes()){return Err(format!("audit-HMAC fout op regel {}",i+1))}
        seq=n;vorige=mac.to_string();
    } Ok((true,seq,vorige))
}

pub fn audit_tail(p:&Path,limiet:usize)->Result<Json,String>{
    if !p.exists(){return Ok(Json::Arr(Vec::new()))}
    let regels=BufReader::new(File::open(p).map_err(|e|e.to_string())?).lines().filter_map(Result::ok)
      .filter_map(|x|json::parse(&x).ok()).collect::<Vec<_>>();
    Ok(Json::Arr(regels.into_iter().rev().take(limiet.min(200)).collect()))
}

#[cfg(test)]
mod tests{
    use super::*;
    fn tmp()->PathBuf{let p=std::env::temp_dir().join(format!("rtg-sentinel-test-{}",crate::rng::id("")));fs::create_dir_all(&p).unwrap();p}
    fn bewijs(root:&Path,pin_uit:&mut String){
        fs::create_dir_all(root.join("server")).unwrap();fs::write(root.join("server/a.js"),b"veilig").unwrap();
        let h=sha256::hex(b"veilig");
        let totaal=sha256::hex(format!("server/a.js{}6{}{}\n",'\0','\0',h).as_bytes());
        let tekst=format!("{{\"formaat\":\"rtg-release-bewijs-v1\",\"inhoudSha256\":\"{}\",\"bestanden\":[{{\"pad\":\"server/a.js\",\"bytes\":6,\"sha256\":\"{}\"}}]}}",totaal,h);
        let p=root.join("proof.json");fs::write(&p,tekst.as_bytes()).unwrap();*pin_uit=sha256::hex(tekst.as_bytes());
    }
    #[test] fn scan_ziet_pin_inhoud_en_nieuw_bestand(){let r=tmp();let mut pin=String::new();bewijs(&r,&mut pin);
        let eerste=scan_release(&r,&r.join("proof.json"),&pin);assert!(eerste.ok,"{:?}",eerste.verschillen);fs::write(r.join("server/a.js"),b"kwaad!").unwrap();
        assert!(!scan_release(&r,&r.join("proof.json"),&pin).ok);fs::write(r.join("server/a.js"),b"veilig").unwrap();fs::write(r.join("server/nieuw.js"),b"x").unwrap();
        assert!(!scan_release(&r,&r.join("proof.json"),&pin).ok);let _=fs::remove_dir_all(r);}
    #[test] fn stand_en_audit_zijn_herstartbaar_en_tamper_evident(){let r=tmp();let mut pin=String::new();bewijs(&r,&mut pin);let data=r.join("data");let token=b"dit-is-een-lang-en-onvoorspelbaar-testgeheim".to_vec();
        {let mut s=Sentinel::open(r.clone(),r.join("proof.json"),pin.clone(),data.clone(),token.clone()).unwrap();s.scan_nu(true);s.wijzig(Mode::Beperkt,"verdachte betaalroute gezien",vec!["/api/pay".into()],"beperk").unwrap();assert!(!s.staat_pad_toe("/api/pay/stuur"));}
        let s=Sentinel::open(r.clone(),r.join("proof.json"),pin,data.clone(),token.clone()).unwrap();assert_eq!(s.mode,Mode::Beperkt);assert!(s.audit_veilig);
        let p=data.join("audit.jsonl");let mut x=fs::read_to_string(&p).unwrap();x=x.replace("verdachte","veranderde");fs::write(&p,x).unwrap();
        let s=Sentinel::open(r.clone(),r.join("proof.json"),String::new(),data,token).unwrap();assert_eq!(s.mode,Mode::Isolatie);assert!(!s.audit_veilig);let _=fs::remove_dir_all(r);}
    #[test] fn prefixvalidatie_is_strikt(){assert!(valideer_prefixes(&["/api/pay".into()]).is_ok());assert!(valideer_prefixes(&["api/pay".into()]).is_err());assert!(valideer_prefixes(&["/api/pay\n/x".into()]).is_err());}
    #[test] fn herstel_eist_eerst_een_groene_scan(){let r=tmp();let data=r.join("data");let token=b"dit-is-een-lang-en-onvoorspelbaar-testgeheim".to_vec();
        let mut s=Sentinel::open(r.clone(),r.join("ontbreekt.json"),String::new(),data,token).unwrap();
        s.wijzig(Mode::Isolatie,"handmatig onderzoek noodzakelijk",Vec::new(),"isoleer").unwrap();
        assert!(s.wijzig(Mode::Normaal,"onderzoek is nu volledig afgerond",Vec::new(),"herstel").is_err());let _=fs::remove_dir_all(r);}
}

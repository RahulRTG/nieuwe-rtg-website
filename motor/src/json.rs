/* Een compacte, correcte JSON-laag — alleen std. Genoeg voor de RTG-API:
   objecten, arrays, strings, getallen (als f64, met exacte i64-uitlezing),
   bool en null. Geen externe crate; alles hier te auditen. */
use std::collections::BTreeMap;
use std::fmt::Write as _;

#[derive(Clone, Debug, PartialEq)]
pub enum Json {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<Json>),
    Obj(BTreeMap<String, Json>),
}

impl Json {
    pub fn obj() -> Json { Json::Obj(BTreeMap::new()) }

    pub fn set(&mut self, k: &str, v: Json) -> &mut Json {
        if let Json::Obj(m) = self { m.insert(k.to_string(), v); }
        self
    }

    pub fn get<'a>(&'a self, k: &str) -> Option<&'a Json> {
        match self { Json::Obj(m) => m.get(k), _ => None }
    }

    pub fn as_str(&self) -> Option<&str> {
        match self { Json::Str(s) => Some(s), _ => None }
    }

    /* Getallen komen als f64 binnen; centen willen we exact. Alleen een geheel
       getal binnen het veilige bereik telt als i64 — een gebroken bedrag is
       geen geldig aantal centen. */
    pub fn as_i64(&self) -> Option<i64> {
        match self {
            Json::Num(n) => {
                if n.is_finite() && n.fract() == 0.0 && *n >= -9.0e15 && *n <= 9.0e15 {
                    Some(*n as i64)
                } else { None }
            }
            _ => None,
        }
    }

    pub fn as_bool(&self) -> Option<bool> {
        match self { Json::Bool(b) => Some(*b), _ => None }
    }

    pub fn str_at(&self, k: &str) -> Option<&str> { self.get(k).and_then(|v| v.as_str()) }
    pub fn i64_at(&self, k: &str) -> Option<i64> { self.get(k).and_then(|v| v.as_i64()) }
    pub fn bool_at(&self, k: &str) -> bool { self.get(k).and_then(|v| v.as_bool()).unwrap_or(false) }

    /* Serialiseren. Escapet strings netjes; getallen zonder onnodige komma's. */
    pub fn dump(&self) -> String {
        let mut s = String::new();
        self.write_to(&mut s);
        s
    }

    fn write_to(&self, out: &mut String) {
        match self {
            Json::Null => out.push_str("null"),
            Json::Bool(b) => out.push_str(if *b { "true" } else { "false" }),
            Json::Num(n) => {
                if n.fract() == 0.0 && n.is_finite() && n.abs() < 9.0e15 {
                    let _ = write!(out, "{}", *n as i64);
                } else {
                    let _ = write!(out, "{}", n);
                }
            }
            Json::Str(s) => write_json_str(s, out),
            Json::Arr(a) => {
                out.push('[');
                for (i, v) in a.iter().enumerate() {
                    if i > 0 { out.push(','); }
                    v.write_to(out);
                }
                out.push(']');
            }
            Json::Obj(m) => {
                out.push('{');
                for (i, (k, v)) in m.iter().enumerate() {
                    if i > 0 { out.push(','); }
                    write_json_str(k, out);
                    out.push(':');
                    v.write_to(out);
                }
                out.push('}');
            }
        }
    }
}

fn write_json_str(s: &str, out: &mut String) {
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => { let _ = write!(out, "\\u{:04x}", c as u32); }
            c => out.push(c),
        }
    }
    out.push('"');
}

/* ---------- parser ---------- */
pub fn parse(input: &str) -> Result<Json, String> {
    let mut p = Parser { b: input.as_bytes(), i: 0 };
    p.ws();
    let v = p.value()?;
    p.ws();
    if p.i != p.b.len() { return Err("rommel na de waarde".into()); }
    Ok(v)
}

struct Parser<'a> { b: &'a [u8], i: usize }

impl<'a> Parser<'a> {
    fn ws(&mut self) {
        while self.i < self.b.len() {
            match self.b[self.i] { b' ' | b'\t' | b'\n' | b'\r' => self.i += 1, _ => break }
        }
    }

    fn value(&mut self) -> Result<Json, String> {
        if self.i >= self.b.len() { return Err("leeg".into()); }
        match self.b[self.i] {
            b'{' => self.object(),
            b'[' => self.array(),
            b'"' => Ok(Json::Str(self.string()?)),
            b't' => self.lit("true", Json::Bool(true)),
            b'f' => self.lit("false", Json::Bool(false)),
            b'n' => self.lit("null", Json::Null),
            _ => self.number(),
        }
    }

    fn lit(&mut self, word: &str, val: Json) -> Result<Json, String> {
        if self.b[self.i..].starts_with(word.as_bytes()) {
            self.i += word.len();
            Ok(val)
        } else { Err(format!("verwacht {}", word)) }
    }

    fn object(&mut self) -> Result<Json, String> {
        self.i += 1; // {
        let mut m = BTreeMap::new();
        self.ws();
        if self.i < self.b.len() && self.b[self.i] == b'}' { self.i += 1; return Ok(Json::Obj(m)); }
        loop {
            self.ws();
            if self.i >= self.b.len() || self.b[self.i] != b'"' { return Err("sleutel verwacht".into()); }
            let k = self.string()?;
            self.ws();
            if self.i >= self.b.len() || self.b[self.i] != b':' { return Err("':' verwacht".into()); }
            self.i += 1;
            self.ws();
            let v = self.value()?;
            m.insert(k, v);
            self.ws();
            match self.b.get(self.i) {
                Some(b',') => { self.i += 1; }
                Some(b'}') => { self.i += 1; break; }
                _ => return Err("',' of '}' verwacht".into()),
            }
        }
        Ok(Json::Obj(m))
    }

    fn array(&mut self) -> Result<Json, String> {
        self.i += 1; // [
        let mut a = Vec::new();
        self.ws();
        if self.i < self.b.len() && self.b[self.i] == b']' { self.i += 1; return Ok(Json::Arr(a)); }
        loop {
            self.ws();
            a.push(self.value()?);
            self.ws();
            match self.b.get(self.i) {
                Some(b',') => { self.i += 1; }
                Some(b']') => { self.i += 1; break; }
                _ => return Err("',' of ']' verwacht".into()),
            }
        }
        Ok(Json::Arr(a))
    }

    fn string(&mut self) -> Result<String, String> {
        self.i += 1; // "
        let mut s = String::new();
        while self.i < self.b.len() {
            let c = self.b[self.i];
            self.i += 1;
            match c {
                b'"' => return Ok(s),
                b'\\' => {
                    let e = *self.b.get(self.i).ok_or("kapotte escape")?;
                    self.i += 1;
                    match e {
                        b'"' => s.push('"'),
                        b'\\' => s.push('\\'),
                        b'/' => s.push('/'),
                        b'n' => s.push('\n'),
                        b'r' => s.push('\r'),
                        b't' => s.push('\t'),
                        b'b' => s.push('\u{08}'),
                        b'f' => s.push('\u{0c}'),
                        b'u' => {
                            let hex = self.b.get(self.i..self.i + 4).ok_or("kapotte \\u")?;
                            let code = u32::from_str_radix(std::str::from_utf8(hex).map_err(|_| "kapotte \\u")?, 16)
                                .map_err(|_| "kapotte \\u")?;
                            self.i += 4;
                            s.push(char::from_u32(code).unwrap_or('\u{fffd}'));
                        }
                        _ => return Err("onbekende escape".into()),
                    }
                }
                _ => {
                    // UTF-8 doorlaten: verzamel de byte en eventuele vervolgbytes
                    if c < 0x80 {
                        s.push(c as char);
                    } else {
                        let start = self.i - 1;
                        while self.i < self.b.len() && (self.b[self.i] & 0xC0) == 0x80 { self.i += 1; }
                        s.push_str(std::str::from_utf8(&self.b[start..self.i]).map_err(|_| "kapotte utf8")?);
                    }
                }
            }
        }
        Err("string niet gesloten".into())
    }

    fn number(&mut self) -> Result<Json, String> {
        let start = self.i;
        if self.i < self.b.len() && (self.b[self.i] == b'-' || self.b[self.i] == b'+') { self.i += 1; }
        while self.i < self.b.len() {
            match self.b[self.i] {
                b'0'..=b'9' | b'.' | b'e' | b'E' | b'+' | b'-' => self.i += 1,
                _ => break,
            }
        }
        let raw = std::str::from_utf8(&self.b[start..self.i]).map_err(|_| "getal")?;
        raw.parse::<f64>().map(Json::Num).map_err(|_| "ongeldig getal".into())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let src = r#"{"aan":"NEVEL","centen":2500,"idem":"abc","splits":true,"x":null}"#;
        let v = parse(src).unwrap();
        assert_eq!(v.str_at("aan"), Some("NEVEL"));
        assert_eq!(v.i64_at("centen"), Some(2500));
        assert_eq!(v.bool_at("splits"), true);
        // dump -> parse blijft gelijk
        let v2 = parse(&v.dump()).unwrap();
        assert_eq!(v, v2);
    }

    #[test]
    fn gebroken_getal_is_geen_centen() {
        let v = parse(r#"{"centen":25.5}"#).unwrap();
        assert_eq!(v.i64_at("centen"), None);
    }

    #[test]
    fn utf8_en_escapes() {
        let v = parse(r#"{"n":"café \"x\"\n"}"#).unwrap();
        assert_eq!(v.str_at("n"), Some("café \"x\"\n"));
    }
}

import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";

// ── Sabitler ──────────────────────────────────────────────
const WORKING_HOURS = { start: 11, end: 20 };
const SLOT_DURATION = 30;
const SERVICES = [
  { id: "sac",      name: "Saç Kesimi",   duration: 30, price: "500₺",  priceNum: 500 },
  { id: "sakal",    name: "Sakal Tıraşı", duration: 30, price: "300₺",  priceNum: 300 },
  { id: "sac_sakal",name: "Saç + Sakal",  duration: 60, price: "700₺",  priceNum: 700 },
  { id: "cocuk",    name: "Çocuk Kesimi", duration: 30, price: "500₺",  priceNum: 500 },
  { id: "cilt",     name: "Cilt Bakımı",  duration: 30, price: "500₺",  priceNum: 500 },
];
const DAYS_TR   = ["Paz","Pzt","Sal","Çar","Per","Cum","Cmt"];
const MONTHS_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];

// ── Renkler ───────────────────────────────────────────────
const G    = "#c9a84c";
const DARK = "#0a0a0a";
const CARD = "#111008";
const MUTED= "#5a4a2a";
const TEXT = "#e8e0d0";

// ── Yardımcı fonksiyonlar ─────────────────────────────────
function generateSlots(date, appointments, serviceDuration) {
  const slots = [];
  const slotsNeeded = serviceDuration / SLOT_DURATION;
  const now = new Date();
  for (let h = WORKING_HOURS.start; h < WORKING_HOURS.end; h++) {
    for (let m = 0; m < 60; m += SLOT_DURATION) {
      const slotTime = new Date(date);
      slotTime.setHours(h, m, 0, 0);
      if (slotTime <= now) continue;
      if (h * 60 + m + serviceDuration > WORKING_HOURS.end * 60) continue;
      const timeStr = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`;
      const dateKey = date.toDateString();
      let available = true;
      for (let i = 0; i < slotsNeeded; i++) {
        const cMin = h * 60 + m + i * SLOT_DURATION;
        if (appointments.some(a => {
          if (a.date_key !== dateKey) return false;
          const aStart = parseInt(a.appointment_time.split(":")[0]) * 60 + parseInt(a.appointment_time.split(":")[1]);
          return cMin >= aStart && cMin < aStart + a.duration;
        })) { available = false; break; }
      }
      slots.push({ time: timeStr, available });
    }
  }
  return slots;
}

function sendWhatsApp(phone, name, date, time, service, price) {
  const cleaned = phone.replace(/\D/g, "");
  const intl = cleaned.startsWith("0") ? "90" + cleaned.slice(1) : cleaned;
  const msg = (date && time && service)
    ? `Merhaba ${name} 👋\n\nÖmer Temel Hair Studio randevunuz onaylandı! ✂️\n\n📅 Tarih: ${date}\n🕐 Saat: ${time}\n💈 Hizmet: ${service}\n💰 Ücret: ${price}\n\nRandevu saatinizde bekliyoruz. İptal için lütfen önceden haber veriniz.\n\nTeşekkürler 🙏`
    : `Merhaba ${name} 👋\n\nÖmer Temel Hair Studio'dan yazıyoruz. Sizi tekrar görmek isteriz! ✂️`;
  window.open(`https://wa.me/${intl}?text=${encodeURIComponent(msg)}`, "_blank");
}

// ── Stil yardımcıları ─────────────────────────────────────
const inp = {
  background: CARD, border: `1px solid ${G}33`, borderRadius: 8,
  padding: "12px 14px", color: TEXT, fontSize: 14, outline: "none",
  width: "100%", boxSizing: "border-box",
};
const goldBtn = (extra = {}) => ({
  background: `linear-gradient(135deg,${G},#a07830)`, color: DARK,
  border: "none", borderRadius: 8, padding: "13px 16px",
  fontSize: 14, fontWeight: "bold", cursor: "pointer", ...extra,
});

// ── Yükleniyor bileşeni ───────────────────────────────────
function Spinner() {
  return (
    <div style={{ display:"flex", justifyContent:"center", alignItems:"center", padding:40 }}>
      <div style={{ width:32, height:32, border:`3px solid ${G}33`, borderTop:`3px solid ${G}`, borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════
export default function App() {
  // navigasyon
  const [view, setView]       = useState("home");
  const [adminTab, setAdminTab] = useState("randevular");

  // booking
  const [step, setStep]               = useState(1);
  const [selService, setSelService]   = useState(null);
  const [selDate, setSelDate]         = useState(null);
  const [selTime, setSelTime]         = useState(null);
  const [custName, setCustName]       = useState("");
  const [custPhone, setCustPhone]     = useState("");
  const [lastBooking, setLastBooking] = useState(null);
  const [weekOffset, setWeekOffset]   = useState(0);

  // veri
  const [appointments, setAppointments] = useState([]);
  const [customers, setCustomers]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(false);

  // admin
  const [adminUnlocked, setAdminUnlocked] = useState(false);
  const [adminPass, setAdminPass]         = useState("");
  const [cancelTarget, setCancelTarget]   = useState(null);
  const [selCustomer, setSelCustomer]     = useState(null);
  const [search, setSearch]               = useState("");

  // müşteri ekleme
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName]   = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNote, setNewNote]   = useState("");
  const [addError, setAddError] = useState("");

  // ── Veriyi çek ─────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: appts }, { data: custs }] = await Promise.all([
        supabase.from("appointments").select("*").order("date_obj", { ascending: true }),
        supabase.from("customers").select("*").order("visits", { ascending: false }),
      ]);
      setAppointments(appts || []);
      setCustomers(custs || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Hesaplamalar ────────────────────────────────────────
  const today = new Date(); today.setHours(0,0,0,0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1 + weekOffset * 7);
  const weekDays = Array.from({length:7}, (_,i) => { const d=new Date(weekStart); d.setDate(weekStart.getDate()+i); return d; });

  const futureAppts = appointments.filter(a => new Date(a.date_obj) >= new Date());
  const todayAppts  = futureAppts.filter(a => a.date_key === today.toDateString());
  const slots = (selDate && selService) ? generateSlots(selDate, appointments, selService.duration) : [];

  const filteredCustomers = search
    ? customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search))
    : customers;

  // kayıtlı müşteri auto-fill
  useEffect(() => {
    const cleaned = custPhone.replace(/\D/g,"");
    if (cleaned.length >= 10) {
      const found = customers.find(c => c.phone_cleaned === cleaned);
      if (found) setCustName(found.name);
    }
  }, [custPhone, customers]);

  // ── Randevu ekle ────────────────────────────────────────
  async function handleBook() {
    if (!custName.trim() || !custPhone.trim()) return;
    setSaving(true);
    const cleaned = custPhone.replace(/\D/g,"");
    const dateStr = selDate.toLocaleDateString("tr-TR");
    const dateKey = selDate.toDateString();

    try {
      // Müşteriyi bul veya oluştur
      let customer = customers.find(c => c.phone_cleaned === cleaned);
      if (!customer) {
        const { data, error } = await supabase.from("customers").insert({
          name: custName.trim(), phone: custPhone.trim(),
          phone_cleaned: cleaned, visits: 0, total_spent: 0,
        }).select().single();
        if (error) throw error;
        customer = data;
      }

      // Randevu oluştur
      const dateObj = new Date(selDate);
      const [hh, mm] = selTime.split(":").map(Number);
      dateObj.setHours(hh, mm, 0, 0);

      const { data: appt, error: apptErr } = await supabase.from("appointments").insert({
        customer_id: customer.id,
        name: custName.trim(), phone: custPhone.trim(), phone_cleaned: cleaned,
        service: selService.name, duration: selService.duration,
        price: selService.price, price_num: selService.priceNum,
        appointment_date: dateStr, appointment_time: selTime,
        date_key: dateKey, date_obj: dateObj.toISOString(),
      }).select().single();
      if (apptErr) throw apptErr;

      // Müşteri istatistiklerini güncelle
      await supabase.from("customers").update({
        visits: customer.visits + 1,
        total_spent: customer.total_spent + selService.priceNum,
        last_visit: dateStr,
      }).eq("id", customer.id);

      setLastBooking({ ...appt, date: dateStr });
      await fetchData();
      setStep(5);
    } catch (e) {
      alert("Hata oluştu: " + e.message);
    }
    setSaving(false);
  }

  // ── Randevu iptal ───────────────────────────────────────
  async function handleCancel(appt) {
    setSaving(true);
    try {
      await supabase.from("appointments").delete().eq("id", appt.id);
      // Müşteri istatistiklerini güncelle
      const cust = customers.find(c => c.phone_cleaned === appt.phone_cleaned);
      if (cust) {
        await supabase.from("customers").update({
          visits: Math.max(0, cust.visits - 1),
          total_spent: Math.max(0, cust.total_spent - appt.price_num),
        }).eq("id", cust.id);
      }
      await fetchData();
    } catch (e) { alert("Hata: " + e.message); }
    setCancelTarget(null);
    setSaving(false);
  }

  // ── Manuel müşteri ekle ─────────────────────────────────
  async function handleAddCustomer() {
    const cleaned = newPhone.replace(/\D/g,"");
    if (!newName.trim()) { setAddError("Ad soyad zorunlu"); return; }
    if (cleaned.length < 10) { setAddError("Geçerli bir telefon numarası girin"); return; }
    if (customers.find(c => c.phone_cleaned === cleaned)) { setAddError("Bu numara zaten kayıtlı"); return; }
    setSaving(true);
    try {
      await supabase.from("customers").insert({
        name: newName.trim(), phone: newPhone.trim(),
        phone_cleaned: cleaned, note: newNote.trim(),
        visits: 0, total_spent: 0,
      });
      await fetchData();
      setNewName(""); setNewPhone(""); setNewNote(""); setAddError("");
      setShowAddModal(false);
    } catch (e) { setAddError("Hata: " + e.message); }
    setSaving(false);
  }

  function resetBook() {
    setStep(1); setSelService(null); setSelDate(null); setSelTime(null);
    setCustName(""); setCustPhone(""); setLastBooking(null); setView("home");
  }

  // ════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════
  return (
    <div style={{ minHeight:"100vh", background:DARK, fontFamily:"Georgia,serif", color:TEXT, maxWidth:480, margin:"0 auto" }}>

      {/* ── HEADER ── */}
      <div style={{ background:"linear-gradient(135deg,#1a1208,#0a0a0a)", borderBottom:`1px solid ${G}33`, padding:"18px 20px 14px", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ cursor:"pointer" }} onClick={()=>setView("home")}>
            <div style={{ fontSize:10, letterSpacing:4, color:G, textTransform:"uppercase" }}>✦ Erkek Berberi ✦</div>
            <div style={{ fontSize:21, fontWeight:"bold", color:"#f0e6c8", letterSpacing:1 }}>Ömer Temel</div>
            <div style={{ fontSize:10, color:"#8a7a5a", letterSpacing:2 }}>HAIR STUDIO</div>
          </div>
          <button onClick={()=>setView(view==="admin"?"home":"admin")}
            style={{ background:"none", border:`1px solid ${G}44`, color:G, padding:"6px 12px", borderRadius:4, fontSize:11, cursor:"pointer", letterSpacing:1 }}>
            {view==="admin" ? "← GERİ" : "⚙ YÖNETİM"}
          </button>
        </div>
      </div>

      {/* ── HOME ── */}
      {view==="home" && (
        <div style={{ padding:20 }}>
          <div style={{ background:"linear-gradient(135deg,#1a1208,#12100a)", border:`1px solid ${G}33`, borderRadius:12, padding:28, textAlign:"center", marginBottom:24 }}>
            <div style={{ fontSize:48, marginBottom:8 }}>✂️</div>
            <div style={{ fontSize:24, color:"#f0e6c8", fontWeight:"bold", marginBottom:6 }}>Hoş Geldiniz</div>
            <div style={{ fontSize:13, color:"#8a7a5a", lineHeight:1.7, marginBottom:20 }}>
              Boş saatleri görün, hemen randevu alın.<br/>Bekleme yok, sürpriz yok.
            </div>
            <button onClick={()=>{setView("book");setStep(1);}} style={{...goldBtn(), width:"100%", fontSize:15, padding:15}}>
              RANDEVU AL →
            </button>
          </div>

          <div style={{ marginBottom:24 }}>
            <div style={{ fontSize:10, letterSpacing:3, color:G, marginBottom:14, textTransform:"uppercase" }}>Hizmetler & Fiyatlar</div>
            {SERVICES.map(s=>(
              <div key={s.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 0", borderBottom:"1px solid #ffffff0f" }}>
                <div>
                  <div style={{ fontSize:14, color:TEXT }}>{s.name}</div>
                  <div style={{ fontSize:11, color:MUTED }}>{s.duration} dk</div>
                </div>
                <div style={{ fontSize:15, color:G, fontWeight:"bold" }}>{s.price}</div>
              </div>
            ))}
          </div>

          <div style={{ background:CARD, border:`1px solid ${G}22`, borderRadius:8, padding:16 }}>
            <div style={{ fontSize:12, color:MUTED, lineHeight:1.9 }}>
              🕐 Çalışma saatleri: 11:00 – 20:00<br/>
              📅 Pazartesi – Cumartesi<br/>
              📍 Randevu sistemi üzerinden rezervasyon yapın
            </div>
          </div>
        </div>
      )}

      {/* ── BOOKING ── */}
      {view==="book" && (
        <div style={{ padding:20 }}>
          <div style={{ display:"flex", gap:4, marginBottom:24 }}>
            {[1,2,3,4].map(s=><div key={s} style={{ flex:1, height:3, borderRadius:2, background:step>=s?G:"#1a1a1a", transition:"background 0.3s" }}/>)}
          </div>

          {/* 1 - Hizmet */}
          {step===1 && (
            <div>
              <div style={{ fontSize:10, letterSpacing:3, color:G, marginBottom:5, textTransform:"uppercase" }}>Adım 1/4</div>
              <div style={{ fontSize:20, color:"#f0e6c8", marginBottom:20, fontWeight:"bold" }}>Hizmet Seçin</div>
              {SERVICES.map(s=>(
                <button key={s.id} onClick={()=>{setSelService(s);setStep(2);}}
                  style={{ width:"100%", background:CARD, border:`1px solid ${G}33`, borderRadius:10, padding:"16px 18px", marginBottom:10, cursor:"pointer", textAlign:"left", display:"flex", justifyContent:"space-between", alignItems:"center" }}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=G+"88"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor=G+"33"}>
                  <div>
                    <div style={{ fontSize:15, color:TEXT, fontWeight:"bold" }}>{s.name}</div>
                    <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>{s.duration} dakika</div>
                  </div>
                  <div style={{ fontSize:16, color:G, fontWeight:"bold" }}>{s.price}</div>
                </button>
              ))}
            </div>
          )}

          {/* 2 - Tarih */}
          {step===2 && (
            <div>
              <button onClick={()=>setStep(1)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:13, marginBottom:12, padding:0 }}>← Geri</button>
              <div style={{ fontSize:10, letterSpacing:3, color:G, marginBottom:5, textTransform:"uppercase" }}>Adım 2/4</div>
              <div style={{ fontSize:20, color:"#f0e6c8", marginBottom:4, fontWeight:"bold" }}>Tarih Seçin</div>
              <div style={{ fontSize:12, color:MUTED, marginBottom:20 }}>{selService?.name} · {selService?.duration} dk</div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
                <button onClick={()=>setWeekOffset(w=>Math.max(0,w-1))} disabled={weekOffset===0}
                  style={{ background:"none", border:`1px solid ${G}33`, color:G, padding:"6px 14px", borderRadius:6, cursor:weekOffset===0?"not-allowed":"pointer", opacity:weekOffset===0?0.3:1, fontSize:14 }}>←</button>
                <div style={{ fontSize:13, color:"#8a7a5a" }}>{MONTHS_TR[weekDays[0].getMonth()]} {weekDays[0].getFullYear()}</div>
                <button onClick={()=>setWeekOffset(w=>w+1)}
                  style={{ background:"none", border:`1px solid ${G}33`, color:G, padding:"6px 14px", borderRadius:6, cursor:"pointer", fontSize:14 }}>→</button>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6, marginBottom:8 }}>
                {DAYS_TR.map(d=><div key={d} style={{ textAlign:"center", fontSize:10, color:"#3a2a1a" }}>{d}</div>)}
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7,1fr)", gap:6 }}>
                {weekDays.map((d,i)=>{
                  const isPast=d<today, isSun=d.getDay()===0, isSel=selDate?.toDateString()===d.toDateString();
                  const disabled=isPast||isSun;
                  const hasDot = appointments.some(a=>a.date_key===d.toDateString());
                  return (
                    <button key={i} disabled={disabled} onClick={()=>{setSelDate(d);setStep(3);}}
                      style={{ background:isSel?G:disabled?"#0d0d0d":CARD, border:`1px solid ${isSel?G:G+"22"}`, borderRadius:8, padding:"10px 4px", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.3:1, textAlign:"center" }}>
                      <div style={{ fontSize:16, fontWeight:"bold", color:isSel?DARK:TEXT }}>{d.getDate()}</div>
                      {hasDot&&!isSel&&<div style={{ width:4,height:4,borderRadius:"50%",background:G,margin:"3px auto 0" }}/>}
                    </button>
                  );
                })}
              </div>
              <div style={{ fontSize:11, color:"#3a2a1a", textAlign:"center", marginTop:12 }}>Pazar günleri kapalı</div>
            </div>
          )}

          {/* 3 - Saat */}
          {step===3 && (
            <div>
              <button onClick={()=>setStep(2)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:13, marginBottom:12, padding:0 }}>← Geri</button>
              <div style={{ fontSize:10, letterSpacing:3, color:G, marginBottom:5, textTransform:"uppercase" }}>Adım 3/4</div>
              <div style={{ fontSize:20, color:"#f0e6c8", marginBottom:4, fontWeight:"bold" }}>Saat Seçin</div>
              <div style={{ fontSize:12, color:MUTED, marginBottom:20 }}>
                {selDate?.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})} · {selService?.name}
              </div>
              {loading ? <Spinner/> : slots.filter(s=>s.available).length===0 ? (
                <div style={{ textAlign:"center", padding:32, color:MUTED, fontSize:14 }}>
                  Bu gün için boş saat kalmadı.<br/>
                  <button onClick={()=>setStep(2)} style={{ marginTop:12, background:"none", border:`1px solid ${G}44`, color:G, padding:"8px 20px", borderRadius:6, cursor:"pointer", fontSize:13 }}>Başka gün seç</button>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                  {slots.map(slot=>(
                    <button key={slot.time} disabled={!slot.available} onClick={()=>{setSelTime(slot.time);setStep(4);}}
                      style={{ padding:"14px 8px", borderRadius:8, fontSize:15, fontWeight:"bold", cursor:slot.available?"pointer":"not-allowed", border:`1px solid ${slot.available?G+"44":"#1a1a1a"}`, background:slot.available?CARD:DARK, color:slot.available?TEXT:"#2a2a2a" }}>
                      {slot.available?slot.time:"—"}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 4 - Bilgi */}
          {step===4 && (
            <div>
              <button onClick={()=>setStep(3)} style={{ background:"none", border:"none", color:MUTED, cursor:"pointer", fontSize:13, marginBottom:12, padding:0 }}>← Geri</button>
              <div style={{ fontSize:10, letterSpacing:3, color:G, marginBottom:5, textTransform:"uppercase" }}>Adım 4/4</div>
              <div style={{ fontSize:20, color:"#f0e6c8", marginBottom:20, fontWeight:"bold" }}>Bilgileriniz</div>
              <div style={{ background:CARD, border:`1px solid ${G}22`, borderRadius:10, padding:16, marginBottom:20 }}>
                <div style={{ fontSize:11, color:MUTED, marginBottom:6 }}>📋 Özet</div>
                <div style={{ fontSize:14, color:TEXT, lineHeight:2.1 }}>
                  <span style={{ color:MUTED }}>Hizmet: </span>{selService?.name}<br/>
                  <span style={{ color:MUTED }}>Tarih: </span>{selDate?.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}<br/>
                  <span style={{ color:MUTED }}>Saat: </span>{selTime}<br/>
                  <span style={{ color:MUTED }}>Ücret: </span><span style={{ color:G }}>{selService?.price}</span>
                </div>
              </div>
              <div style={{ marginBottom:14 }}>
                <label style={{ fontSize:11, letterSpacing:2, color:MUTED, display:"block", marginBottom:6 }}>TELEFON *</label>
                <input value={custPhone} onChange={e=>setCustPhone(e.target.value)} placeholder="05xx xxx xx xx" type="tel" style={inp}/>
                {customers.find(c=>c.phone_cleaned===custPhone.replace(/\D/g,"")) && custPhone.replace(/\D/g,"").length>=10 && (
                  <div style={{ fontSize:12, color:G, marginTop:5 }}>✦ Kayıtlı müşteri — isim otomatik dolduruldu</div>
                )}
              </div>
              <div style={{ marginBottom:24 }}>
                <label style={{ fontSize:11, letterSpacing:2, color:MUTED, display:"block", marginBottom:6 }}>AD SOYAD *</label>
                <input value={custName} onChange={e=>setCustName(e.target.value)} placeholder="Adınızı giriniz" style={inp}/>
              </div>
              <button onClick={handleBook} disabled={!custName.trim()||!custPhone.trim()||saving}
                style={{ width:"100%", background:custName.trim()&&custPhone.trim()?`linear-gradient(135deg,${G},#a07830)`:"#1a1a1a", color:custName.trim()&&custPhone.trim()?DARK:"#3a3a3a", border:"none", borderRadius:8, padding:16, fontSize:15, fontWeight:"bold", cursor:custName.trim()&&custPhone.trim()?"pointer":"not-allowed" }}>
                {saving ? "Kaydediliyor..." : "RANDEVUYU ONAYLA ✓"}
              </button>
            </div>
          )}

          {/* 5 - Tamamlandı */}
          {step===5 && lastBooking && (
            <div style={{ textAlign:"center", paddingTop:24 }}>
              <div style={{ fontSize:60, marginBottom:12 }}>✅</div>
              <div style={{ fontSize:22, color:G, fontWeight:"bold", marginBottom:6 }}>Randevunuz Alındı!</div>
              <div style={{ fontSize:14, color:"#8a7a5a", lineHeight:1.9, marginBottom:24 }}>
                {selDate?.toLocaleDateString("tr-TR",{weekday:"long",day:"numeric",month:"long"})}<br/>
                Saat {selTime} · {selService?.name}<br/>
                <span style={{ color:G }}>{selService?.price}</span>
              </div>
              <button onClick={()=>sendWhatsApp(lastBooking.phone,lastBooking.name,lastBooking.appointment_date,lastBooking.appointment_time,lastBooking.service,lastBooking.price)}
                style={{ width:"100%", background:"#25D366", color:"#fff", border:"none", borderRadius:8, padding:15, fontSize:15, fontWeight:"bold", cursor:"pointer", marginBottom:10, display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                <span>💬</span> WhatsApp ile Hatırlatma Gönder
              </button>
              <div style={{ background:CARD, border:`1px solid ${G}22`, borderRadius:8, padding:12, marginBottom:16, textAlign:"left" }}>
                <div style={{ fontSize:12, color:MUTED }}>Müşteriye randevu bilgilerini içeren hazır mesajı WhatsApp'ta gönderebilirsiniz.</div>
              </div>
              <button onClick={resetBook} style={{ ...goldBtn({width:"100%"}) }}>ANA SAYFAYA DÖN</button>
            </div>
          )}
        </div>
      )}

      {/* ── ADMIN ── */}
      {view==="admin" && (
        <div style={{ padding:20 }}>
          {!adminUnlocked ? (
            <div style={{ textAlign:"center", paddingTop:40 }}>
              <div style={{ fontSize:40, marginBottom:16 }}>🔐</div>
              <div style={{ fontSize:18, color:"#f0e6c8", fontWeight:"bold", marginBottom:4 }}>Yönetim Paneli</div>
              <div style={{ fontSize:12, color:MUTED, marginBottom:24 }}>Şifrenizi girin</div>
              <input value={adminPass} onChange={e=>setAdminPass(e.target.value)} type="password" placeholder="Şifre"
                onKeyDown={e=>e.key==="Enter"&&adminPass==="omer2024"&&setAdminUnlocked(true)}
                style={{ ...inp, marginBottom:12, textAlign:"center" }}/>
              <button onClick={()=>adminPass==="omer2024"&&setAdminUnlocked(true)}
                style={{ ...goldBtn({width:"100%", fontSize:15, padding:15}) }}>GİRİŞ YAP</button>
              {adminPass&&adminPass!=="omer2024"&&<div style={{ color:"#a04040", fontSize:13, marginTop:10 }}>Hatalı şifre</div>}
            </div>
          ) : (
            <div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div>
                  <div style={{ fontSize:10, letterSpacing:3, color:G, textTransform:"uppercase" }}>Yönetim</div>
                  <div style={{ fontSize:18, color:"#f0e6c8", fontWeight:"bold" }}>Ömer Temel</div>
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={fetchData} style={{ background:"none", border:`1px solid ${G}33`, color:G, padding:"6px 10px", borderRadius:6, cursor:"pointer", fontSize:13 }}>↻</button>
                  <button onClick={()=>setAdminUnlocked(false)} style={{ background:"none", border:`1px solid ${G}33`, color:MUTED, padding:"6px 10px", borderRadius:6, cursor:"pointer", fontSize:11 }}>Çıkış</button>
                </div>
              </div>

              {loading ? <Spinner/> : (
                <>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:18 }}>
                    {[
                      { label:"Yaklaşan", value:futureAppts.length },
                      { label:"Bugün",    value:todayAppts.length },
                      { label:"Müşteri", value:customers.length },
                    ].map(s=>(
                      <div key={s.label} style={{ background:CARD, border:`1px solid ${G}22`, borderRadius:10, padding:"14px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:24, fontWeight:"bold", color:G }}>{s.value}</div>
                        <div style={{ fontSize:11, color:MUTED }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:"flex", gap:8, marginBottom:18 }}>
                    {[["randevular","📅 Randevular"],["musteriler","👥 Müşteriler"]].map(([id,label])=>(
                      <button key={id} onClick={()=>setAdminTab(id)}
                        style={{ flex:1, padding:"10px 8px", borderRadius:8, fontSize:13, fontWeight:"bold", cursor:"pointer", border:`1px solid ${adminTab===id?G:G+"22"}`, background:adminTab===id?G+"22":CARD, color:adminTab===id?G:MUTED }}>
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Randevular */}
                  {adminTab==="randevular" && (
                    <div>
                      {futureAppts.length===0
                        ? <div style={{ textAlign:"center", padding:40, color:"#3a3a3a", fontSize:14 }}>Henüz randevu yok</div>
                        : futureAppts.map(appt=>(
                          <div key={appt.id} style={{ background:CARD, border:`1px solid ${G}22`, borderRadius:10, padding:16, marginBottom:10 }}>
                            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                              <div>
                                <div style={{ fontSize:15, color:TEXT, fontWeight:"bold" }}>{appt.name}</div>
                                <div style={{ fontSize:12, color:MUTED, marginTop:1 }}>{appt.phone}</div>
                                <div style={{ fontSize:13, color:"#8a7a5a", marginTop:6, lineHeight:1.8 }}>
                                  📅 {appt.appointment_date} · {appt.appointment_time}<br/>
                                  ✂️ {appt.service} · <span style={{ color:G }}>{appt.price}</span>
                                </div>
                              </div>
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                <button onClick={()=>sendWhatsApp(appt.phone,appt.name,appt.appointment_date,appt.appointment_time,appt.service,appt.price)}
                                  style={{ background:"#25D366", color:"#fff", border:"none", padding:"7px 11px", borderRadius:6, cursor:"pointer", fontSize:14 }}>💬</button>
                                <button onClick={()=>setCancelTarget(appt)}
                                  style={{ background:"none", border:"1px solid #a0404044", color:"#a04040", padding:"6px 10px", borderRadius:6, cursor:"pointer", fontSize:11 }}>İptal</button>
                              </div>
                            </div>
                          </div>
                        ))
                      }
                    </div>
                  )}

                  {/* Müşteriler */}
                  {adminTab==="musteriler" && (
                    <div>
                      <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="İsim veya telefon ara..."
                          style={{ ...inp, flex:1 }}/>
                        <button onClick={()=>{setShowAddModal(true);setAddError("");}}
                          style={{ ...goldBtn({padding:"0 18px", fontSize:22, flexShrink:0}) }}>+</button>
                      </div>
                      {filteredCustomers.length===0
                        ? <div style={{ textAlign:"center", padding:40, color:"#3a3a3a", fontSize:14 }}>Henüz müşteri kaydı yok</div>
                        : filteredCustomers.map(c=>(
                          <div key={c.id}>
                            <button onClick={()=>setSelCustomer(selCustomer?.id===c.id?null:c)}
                              style={{ width:"100%", background:CARD, border:`1px solid ${selCustomer?.id===c.id?G+"77":G+"22"}`, borderRadius:10, padding:14, marginBottom:6, cursor:"pointer", textAlign:"left" }}>
                              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                                <div>
                                  <div style={{ fontSize:15, color:TEXT, fontWeight:"bold" }}>{c.name}</div>
                                  <div style={{ fontSize:12, color:MUTED, marginTop:2 }}>{c.phone}</div>
                                  {c.last_visit&&<div style={{ fontSize:11, color:"#3a3020", marginTop:4 }}>Son ziyaret: {c.last_visit}</div>}
                                </div>
                                <div style={{ textAlign:"right" }}>
                                  <div style={{ fontSize:14, color:G, fontWeight:"bold" }}>{c.visits} ziyaret</div>
                                  <div style={{ fontSize:12, color:MUTED }}>{c.total_spent}₺</div>
                                </div>
                              </div>
                            </button>
                            {selCustomer?.id===c.id && (
                              <div style={{ background:"#0e0c06", border:`1px solid ${G}22`, borderRadius:10, padding:14, marginBottom:12, marginTop:-2 }}>
                                {c.note&&<div style={{ background:"#1a1408", border:`1px solid ${G}22`, borderRadius:6, padding:"8px 10px", marginBottom:12, fontSize:12, color:"#8a7a5a" }}>📝 {c.note}</div>}
                                <div style={{ fontSize:10, letterSpacing:2, color:G, textTransform:"uppercase", marginBottom:10 }}>Randevu Geçmişi</div>
                                {appointments.filter(a=>a.phone_cleaned===c.phone_cleaned).length===0
                                  ? <div style={{ fontSize:13, color:MUTED }}>Henüz randevu yok</div>
                                  : [...appointments.filter(a=>a.phone_cleaned===c.phone_cleaned)].reverse().map((h,i,arr)=>(
                                    <div key={h.id} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom:i<arr.length-1?"1px solid #ffffff08":"none" }}>
                                      <div>
                                        <div style={{ fontSize:13, color:TEXT }}>{h.service}</div>
                                        <div style={{ fontSize:11, color:MUTED }}>{h.appointment_date} · {h.appointment_time}</div>
                                      </div>
                                      <div style={{ fontSize:13, color:G }}>{h.price}</div>
                                    </div>
                                  ))
                                }
                                <button onClick={()=>sendWhatsApp(c.phone,c.name,"","","","")}
                                  style={{ marginTop:14, width:"100%", background:"#25D366", color:"#fff", border:"none", borderRadius:7, padding:"11px 0", fontSize:13, fontWeight:"bold", cursor:"pointer" }}>
                                  💬 WhatsApp'tan Yaz
                                </button>
                              </div>
                            )}
                          </div>
                        ))
                      }
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: Müşteri Ekle ── */}
      {showAddModal&&(
        <div style={{ position:"fixed", inset:0, background:"#000000e0", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div style={{ background:"#111008", border:`1px solid ${G}55`, borderRadius:14, padding:24, width:"100%", maxWidth:360 }}>
            <div style={{ fontSize:18, color:"#f0e6c8", fontWeight:"bold", marginBottom:4 }}>Müşteri Ekle</div>
            <div style={{ fontSize:12, color:MUTED, marginBottom:20 }}>Yeni müşteriyi sisteme kaydedin</div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, letterSpacing:2, color:MUTED, display:"block", marginBottom:5 }}>AD SOYAD *</label>
              <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Müşteri adı" style={inp}/>
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, letterSpacing:2, color:MUTED, display:"block", marginBottom:5 }}>TELEFON *</label>
              <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="05xx xxx xx xx" type="tel" style={inp}/>
            </div>
            <div style={{ marginBottom:18 }}>
              <label style={{ fontSize:11, letterSpacing:2, color:MUTED, display:"block", marginBottom:5 }}>NOT (isteğe bağlı)</label>
              <input value={newNote} onChange={e=>setNewNote(e.target.value)} placeholder="Örn: Saçı ince, hassas cilt..." style={inp}/>
            </div>
            {addError&&<div style={{ color:"#c05050", fontSize:13, marginBottom:12, background:"#200a0a", padding:"8px 12px", borderRadius:6 }}>⚠ {addError}</div>}
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>{setShowAddModal(false);setNewName("");setNewPhone("");setNewNote("");setAddError("");}}
                style={{ flex:1, background:"none", border:`1px solid ${G}33`, color:"#8a7a5a", padding:12, borderRadius:8, cursor:"pointer", fontSize:14 }}>İptal</button>
              <button onClick={handleAddCustomer} disabled={saving}
                style={{ ...goldBtn({flex:1, padding:12}) }}>{saving?"Kaydediliyor...":"Kaydet ✓"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: İptal ── */}
      {cancelTarget&&(
        <div style={{ position:"fixed", inset:0, background:"#000000cc", display:"flex", alignItems:"center", justifyContent:"center", zIndex:200, padding:20 }}>
          <div style={{ background:CARD, border:`1px solid ${G}33`, borderRadius:12, padding:24, width:"100%", maxWidth:340 }}>
            <div style={{ fontSize:18, color:"#f0e6c8", fontWeight:"bold", marginBottom:8 }}>Randevuyu İptal Et</div>
            <div style={{ fontSize:14, color:MUTED, marginBottom:20 }}>
              <b style={{ color:TEXT }}>{cancelTarget.name}</b> adlı müşterinin<br/>
              {cancelTarget.appointment_date} · {cancelTarget.appointment_time} randevusu iptal edilsin mi?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setCancelTarget(null)}
                style={{ flex:1, background:"none", border:`1px solid ${G}33`, color:"#8a7a5a", padding:12, borderRadius:8, cursor:"pointer", fontSize:14 }}>Vazgeç</button>
              <button onClick={()=>handleCancel(cancelTarget)} disabled={saving}
                style={{ flex:1, background:"#a04040", color:"#fff", border:"none", padding:12, borderRadius:8, cursor:"pointer", fontSize:14, fontWeight:"bold" }}>
                {saving?"Siliniyor...":"İptal Et"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

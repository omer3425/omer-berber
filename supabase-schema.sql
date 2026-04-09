-- ============================================
-- ÖMER TEMEL HAIR STUDIO - Veritabanı Şeması
-- Bu kodu Supabase > SQL Editor'de çalıştırın
-- ============================================

-- Müşteriler tablosu
CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE,
  phone_cleaned TEXT NOT NULL UNIQUE,
  note TEXT DEFAULT '',
  visits INTEGER DEFAULT 0,
  total_spent INTEGER DEFAULT 0,
  last_visit TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Randevular tablosu
CREATE TABLE IF NOT EXISTS appointments (
  id BIGSERIAL PRIMARY KEY,
  customer_id BIGINT REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  phone_cleaned TEXT NOT NULL,
  service TEXT NOT NULL,
  duration INTEGER NOT NULL,
  price TEXT NOT NULL,
  price_num INTEGER NOT NULL,
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  date_key TEXT NOT NULL,
  date_obj TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Herkese okuma izni (müşteriler boş saatleri görebilsin)
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Herkes randevuları görebilir" ON appointments FOR SELECT USING (true);
CREATE POLICY "Herkes randevu ekleyebilir" ON appointments FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkes randevu silebilir" ON appointments FOR DELETE USING (true);

CREATE POLICY "Herkes müşteri görebilir" ON customers FOR SELECT USING (true);
CREATE POLICY "Herkes müşteri ekleyebilir" ON customers FOR INSERT WITH CHECK (true);
CREATE POLICY "Herkes müşteri güncelleyebilir" ON customers FOR UPDATE USING (true);
CREATE POLICY "Herkes müşteri silebilir" ON customers FOR DELETE USING (true);

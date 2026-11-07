#!/usr/bin/env bash
# Test foydalanuvchilar — har role'dan bitta. Murakkab parollar (kamida 8 simvol).
set -euo pipefail
cd "$(dirname "$0")/.."

PGPORT=${PGPORT:-55434}
PSQL="psql -h 127.0.0.1 -p $PGPORT -U postgres -d ssd_klinika -v ON_ERROR_STOP=1"

hashpw() {
  local pw="$1"
  node -e "
    const { scryptSync, randomBytes } = require('node:crypto');
    const s = randomBytes(16).toString('hex');
    console.log(s + ':' + scryptSync(process.argv[1], s, 64).toString('hex'));
  " "$pw"
}

upsert() {
  local user="$1" password="$2" role="$3" name="$4" category="$5" pos="$6" spec="$7"
  local pw_hash
  pw_hash="$(hashpw "$password")"
  $PSQL >/dev/null <<SQL
INSERT INTO employees (id, category, full_name, phone, email, position, specialty, experience, diploma, added_at, archived, username, password_hash, role)
VALUES (gen_random_uuid()::text, '$category', '$name', '', '', '$pos', '$spec', '', '', $(date +%s)000, false, '$user', '$pw_hash', '$role')
ON CONFLICT DO NOTHING;
UPDATE employees SET password_hash = '$pw_hash', role = '$role', full_name = '$name' WHERE username = '$user';
SQL
  echo "  ✓ $user ($role) — parol: $password"
}

$PSQL -c "CREATE UNIQUE INDEX IF NOT EXISTS employees_username_uq ON employees(username) WHERE username IS NOT NULL;" >/dev/null

upsert admin@ssdklinika.uz       'Admin@2026'       admin       "Tizim Admini"    admin   ""            "Admin"
upsert shifokor@ssdklinika.uz    'Shifokor@2026'    shifokor    "Dr. Shifokorov"  medical ""            "Terapevt"
upsert laborant@ssdklinika.uz    'Laborant@2026'    laborant    "Laborantov L."   medical ""            "Laborant"
upsert registrator@ssdklinika.uz 'Registrator@2026' registrator "Registratorova"  staff   "Registrator" ""
upsert kassir@ssdklinika.uz      'Kassir@2026'      kassir      "Kassirova"       staff   "Kassir"      ""
upsert buxgalter@ssdklinika.uz   'Buxgalter@2026'   buxgalter   "Buxgalterova"    staff   "Buxgalter"   ""
upsert hodim@ssdklinika.uz       'Hodim@2026'       oddiy       "Oddiy Hodim"     staff   "Yordamchi"   ""

echo ""
echo "✅ Barcha foydalanuvchilar tayyor."

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const now = Date.now();
const DAY = 86_400_000;
const MIN = 60_000;

const EMPLOYEES: [string, 'medical' | 'service', string, string, string, string, string, string, number][] = [
  ['d1', 'medical', 'Alisher Qodirov',   '+998 90 111 22 11', 'a.qodirov@ssdklinika.uz',   'Bosh shifokor',       'Stomatolog-terapevt',  '14 yil', 'TTA, 2010 — stomatologiya',             400],
  ['d2', 'medical', 'Malika Yusupova',   '+998 91 333 22 44', 'm.yusupova@ssdklinika.uz',  'Stomatolog-terapevt', 'Terapevtik stomatologiya', '8 yil', 'TTA, 2016 — stomatologiya',          300],
  ['d3', 'medical', 'Nodir Jalilov',     '+998 93 555 66 77', 'n.jalilov@ssdklinika.uz',   'Ortodont',            'Breket va kappalar',   '11 yil', 'SamDMI, 2013 — stomatologiya',         250],
  ['d4', 'medical', 'Zarina Qarshieva',  '+998 94 888 99 00', 'z.qarshieva@ssdklinika.uz', 'Bolalar stomatologi', 'Pedodontiya',           '6 yil', 'TTA, 2018 — stomatologiya',            180],
  ['d5', 'medical', 'Sanjar Mirzaev',    '+998 97 112 33 44', 's.mirzaev@ssdklinika.uz',   'Stomatolog-jarroh',   'Og‘iz jarrohligi',      '9 yil', 'SamDMI, 2015 — stomatologiya',         220],
  ['d6', 'medical', 'Jamshid Karimov',   '+998 90 234 56 78', 'j.karimov@ssdklinika.uz',   'Implantolog',         'Implantatsiya',         '10 yil', 'Moskva MGMU, 2014 — stomatologiya',   260],
  ['d7', 'medical', 'Dilbar Ismoilova',  '+998 91 445 66 78', 'd.ismoilova@ssdklinika.uz', 'Endodontist',         'Kanal davolash',        '7 yil', 'TTA, 2017 — stomatologiya',            190],
  ['d8', 'medical', 'Oybek Rustamov',    '+998 93 667 88 99', 'o.rustamov@ssdklinika.uz',  'Parodontolog',        'Milk kasalliklari',     '5 yil', 'TTA, 2019 — stomatologiya',            140],
  ['d9', 'medical', 'Komila Saidova',    '+998 94 778 90 12', 'k.saidova@ssdklinika.uz',   'Gigienist',           'Og‘iz gigienasi',       '4 yil', 'Toshkent tibbiyot kolleji, 2020',      120],

  ['s1',  'service', 'Nilufar Hamidova',  '+998 90 221 33 55', 'n.hamidova@ssdklinika.uz',   'Hamshira',             'Umumiy hamshira',       '5 yil', 'Toshkent tibbiyot kolleji, 2019',    150],
  ['s2',  'service', 'Shahnoza Toirova',  '+998 98 445 11 22', 's.toirova@ssdklinika.uz',    'Hamshira',             'Jarrohlik hamshirasi',  '7 yil', 'Toshkent tibbiyot kolleji, 2017',    200],
  ['s3',  'service', 'Madina Olimjonova', '+998 99 334 22 11', 'm.olimjonova@ssdklinika.uz', 'Yordamchi hamshira',   'Instrument tayyorlash', '2 yil', 'Toshkent tibbiyot kolleji, 2022',     80],
  ['s4',  'service', 'Shoxrux Normatov',  '+998 90 998 44 55', 'sh.normatov@ssdklinika.uz',  'Laborant',             'Rentgen-laboratoriya',  '6 yil', 'TTA, 2018 — tibbiy diagnostika',     210],
  ['s5',  'service', 'Feruza Qosimova',   '+998 91 332 11 00', 'f.qosimova@ssdklinika.uz',   'Laborant',             'Qon tahlili',           '4 yil', 'Buxoro tibbiyot instituti, 2020',    130],
  ['s6',  'service', 'Jamoliddin Olimov', '+998 93 112 55 66', 'j.olimov@ssdklinika.uz',     'Laborant yordamchisi', 'Namuna tayyorlash',     '1 yil', 'Toshkent tibbiyot kolleji, 2024',     30],
  ['s7',  'service', 'Dilshod Rustamov',  '+998 90 123 45 67', 'd.rustamov@ssdklinika.uz',   'Registrator',          'Qabulxona xizmati',     '4 yil', 'O‘MKHTT, 2020 — xizmat ko‘rsatish',  160],
  ['s8',  'service', 'Guliston Ergasheva','+998 91 234 56 78', 'g.ergasheva@ssdklinika.uz',  'Call-markaz operatori','Mijozlar bilan ishlash','2 yil', 'TATU, 2022 — ish yuritish',           70],
  ['s9',  'service', 'Bahodir Toirov',    '+998 93 345 67 89', 'b.toirov@ssdklinika.uz',     'Qarovul',              'Tungi smena',           '6 yil', 'O‘rta maxsus (xavfsizlik)',          300],
  ['s10', 'service', 'Erkin Nazarov',     '+998 94 456 78 90', 'e.nazarov@ssdklinika.uz',    'Qarovul',              'Kunduzgi smena',        '3 yil', 'O‘rta ta’lim',                       100],
  ['s11', 'service', 'Zebo Mamatova',     '+998 97 567 89 01', 'z.mamatova@ssdklinika.uz',   'Farrosh',              'Sanitariya',            '5 yil', 'O‘rta ta’lim',                       240],
  ['s12', 'service', 'Munira Olimova',    '+998 98 678 90 12', 'm.olimova@ssdklinika.uz',    'Farrosh',              'Dezinfeksiya',          '2 yil', 'Sanitariya kurslari, 2023',           50],
  ['s13', 'service', 'Qahramon Yo‘ldoshev','+998 99 789 01 23','q.yoldoshev@ssdklinika.uz', 'Haydovchi',             'B toifa',               '12 yil','Avtomaktab, 2012',                   320],
];

const CATEGORIES: [string, string, string][] = [
  ['c1', 'Konsultatsiya',           '#4a5bcf'],
  ['c2', 'Terapevtik stomatologiya','#0e8e52'],
  ['c3', 'Jarrohlik',               '#c22'   ],
  ['c4', 'Ortopediya (protez)',     '#9c6b00'],
  ['c5', 'Implantologiya',          '#634a9f'],
  ['c6', 'Ortodontiya',             '#2c7766'],
  ['c7', 'Estetik stomatologiya',   '#ff3c00'],
  ['c8', 'Bolalar stomatologiyasi', '#17a2b8'],
];

const SERVICES: [string, string, string, number, 'som'|'rubl'|'dollar', number | null, number, boolean][] = [
  ['sv1',  'c1', 'Birlamchi konsultatsiya',       80_000,    'som',    null,         30, false],
  ['sv2',  'c1', 'Takroriy konsultatsiya',        50_000,    'som',    null,         25, false],
  ['sv3',  'c1', 'Og‘iz bo‘shlig‘i tekshiruvi',   100_000,   'som',    null,         30, false],
  ['sv4',  'c2', 'Kariyes davolash (1 kanal)',    350_000,   'som',    null,         35, false],
  ['sv5',  'c2', 'Kariyes davolash (2 kanal)',    550_000,   'som',    null,         35, false],
  ['sv6',  'c2', 'Pulpit davolash',               650_000,   'som',    null,         40, false],
  ['sv7',  'c2', 'Og‘iz gigienasi (Air Flow)',    220_000,   'som',    null,         25, false],
  ['sv8',  'c2', 'Flyurlash',                     120_000,   'som',    null,         20, true ],
  ['sv9',  'c3', 'Tishni oddiy olib tashlash',    180_000,   'som',    null,         35, false],
  ['sv10', 'c3', 'Murakkab tish olib tashlash',   450_000,   'som',    null,         40, false],
  ['sv11', 'c3', 'Aql tishini olib tashlash',     550_000,   'som',    null,         45, false],
  ['sv12', 'c4', 'Metall-keramik koronka',        1_200_000, 'som',    null,         30, false],
  ['sv13', 'c4', 'Keramik koronka (E-max)',       2_200_000, 'som',    null,         30, false],
  ['sv14', 'c4', 'Yechiladigan protez',           1_800_000, 'som',    null,         28, false],
  ['sv15', 'c5', 'Implant o‘rnatish (Osstem)',    380,       'dollar', 4_800_000,    25, false],
  ['sv16', 'c5', 'Implant o‘rnatish (Straumann)', 600,       'dollar', 7_500_000,    25, false],
  ['sv17', 'c5', 'Suyak ustirish (sinus-lift)',   2_500_000, 'som',    null,         30, false],
  ['sv18', 'c6', 'Metall breket tizimi',          90_000,    'rubl',   12_000_000,   20, false],
  ['sv19', 'c6', 'Keramik breket tizimi',         135_000,   'rubl',   18_000_000,   22, false],
  ['sv20', 'c6', 'Elayner (Invisalign)',          2_000,     'dollar', 25_000_000,   20, false],
  ['sv21', 'c7', 'Tishni oqartirish (ZOOM)',      750_000,   'som',    null,         30, false],
  ['sv22', 'c7', 'Vinirlar (1 ta)',               220,       'dollar', 2_800_000,    25, false],
  ['sv23', 'c8', 'Bolalar konsultatsiyasi',       70_000,    'som',    null,         30, false],
  ['sv24', 'c8', 'Sut tishini davolash',          220_000,   'som',    null,         35, false],
  ['sv25', 'c8', 'Silerlar bilan profilaktika',   180_000,   'som',    null,         25, true ],
];

const ASSIGNMENTS: [string, string][] = [
  ['d1','sv1'],['d1','sv3'],['d1','sv4'],['d1','sv5'],['d1','sv6'],
  ['d2','sv1'],['d2','sv2'],['d2','sv4'],['d2','sv7'],
  ['d3','sv18'],['d3','sv19'],['d3','sv20'],
  ['d4','sv23'],['d4','sv24'],
  ['d5','sv9'],['d5','sv10'],['d5','sv11'],
  ['d6','sv15'],['d6','sv16'],['d6','sv17'],
  ['d7','sv5'],['d7','sv6'],
  ['d8','sv7'],['d8','sv8'],
  ['d9','sv7'],['d9','sv21'],
];

type P = [string, string, string, string, string, string, 'erkak' | 'ayol', number];
const PATIENTS: P[] = [
  ['p1',  'Shahnoza Ergasheva', '+998 90 111 22 33', 'Novza mahallasi, 12-uy',   'Toshkent shahri',  'Chilonzor',         'ayol',  2],
  ['p2',  'Bobur Sa’dullayev',  '+998 91 222 44 55', 'Minor ko‘chasi 3-uy',       'Toshkent shahri',  'Yunusobod',         'erkak', 5],
  ['p3',  'Mariya Nazarova',    '+998 93 123 45 67', 'Buyuk Ipak yo‘li 14',       'Toshkent shahri',  'Mirzo Ulug‘bek',    'ayol', 12],
  ['p4',  'Jasur Rahimov',      '+998 94 777 88 99', 'Beshyog‘och 7-uy',          'Toshkent shahri',  'Shayxontohur',      'erkak',18],
  ['p5',  'Dilnoza Qosimova',   '+998 97 555 66 77', 'Qorasuv mahallasi',         'Toshkent shahri',  'Olmazor',           'ayol', 25],
  ['p6',  'Umid Toshmatov',     '+998 90 232 11 00', 'Sergeli-5',                 'Toshkent shahri',  'Sergeli',           'erkak',40],
  ['p7',  'Oygul Mirzaeva',     '+998 98 445 32 11', 'Yangi hayot mahallasi',     'Toshkent shahri',  'Yakkasaroy',        'ayol', 60],
  ['p8',  'Rustam Yo‘ldoshev',  '+998 99 112 34 56', 'Bektemir markazi',          'Toshkent shahri',  'Bektemir',          'erkak',75],
];

const ARCHIVED_PATIENTS: P[] = [
  ['p9',  'Lola Qodirova',   '+998 88 334 56 78', 'Chilonzor-9, 24-uy',  'Toshkent shahri', 'Chilonzor',  'ayol',  90],
  ['p10', 'Nodira Karimova', '+998 90 998 76 54', 'Yunusobod-15',        'Toshkent shahri', 'Yunusobod',  'ayol', 120],
];

const APPOINTMENTS: [string, string, string, string, string, string, string][] = [
  ['1',  '2026-10-31','09:00','Shahnoza Ergasheva','Alisher Qodirov','Kariyes davolash (1 kanal)',    'keldi'],
  ['2',  '2026-10-31','09:30','Bobur Sa’dullayev', 'Malika Yusupova','Birlamchi konsultatsiya',       'keldi'],
  ['3',  '2026-10-31','10:00','Mariya Nazarova',   'Alisher Qodirov','Metall-keramik koronka',       'kutilmoqda'],
  ['4',  '2026-10-31','10:30','Jasur Rahimov',     'Nodir Jalilov',  'Metall breket tizimi',          'kutilmoqda'],
  ['5',  '2026-10-31','11:00','Dilnoza Qosimova',  'Malika Yusupova','Og‘iz gigienasi (Air Flow)',    'kutilmoqda'],
  ['6',  '2026-10-31','11:30','Nozima Karimova',   'Zarina Qarshieva','Bolalar konsultatsiyasi',      'kutilmoqda'],
  ['7',  '2026-10-31','12:00','Sardor Alimov',     'Sanjar Mirzaev', 'Tishni oddiy olib tashlash',    'kutilmoqda'],
  ['8',  '2026-10-31','13:00','Zuhra Haydarova',   'Alisher Qodirov','Kariyes davolash (1 kanal)',    'kelmadi'],
  ['9',  '2026-10-31','14:00','Ravshan Yusupov',   'Nodir Jalilov',  'Keramik breket tizimi',         'bekor'],
  ['10', '2026-10-31','15:30','Gulbahor Nazirova', 'Malika Yusupova','Og‘iz gigienasi (Air Flow)',    'kutilmoqda'],
  ['11', '2026-10-31','16:00','Botir Qosimov',     'Alisher Qodirov','Birlamchi konsultatsiya',       'kutilmoqda'],
  ['12', '2026-11-01','09:00','Umid Toshmatov',    'Nodir Jalilov',  'Elayner (Invisalign)',          'kutilmoqda'],
  ['13', '2026-11-01','10:30','Oygul Mirzaeva',    'Malika Yusupova','Birlamchi konsultatsiya',       'kutilmoqda'],
  ['14', '2026-11-02','11:00','Rustam Yo‘ldoshev', 'Zarina Qarshieva','Sut tishini davolash',         'kutilmoqda'],
  ['15', '2026-11-03','13:30','Lola Qodirova',     'Sanjar Mirzaev', 'Aql tishini olib tashlash',     'kutilmoqda'],
  ['16', '2026-11-04','09:30','Dilshod Ikromov',   'Alisher Qodirov','Metall-keramik koronka',       'kutilmoqda'],
  ['17', '2026-11-05','14:00','Shoira Nurmatova',  'Malika Yusupova','Og‘iz gigienasi (Air Flow)',    'kutilmoqda'],
  ['18', '2026-11-07','10:00','Akmal Rahmonov',    'Nodir Jalilov',  'Implant o‘rnatish (Osstem)',    'kutilmoqda'],
];

async function run() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('✓ Schema ensured.');

  // Idempotent: mavjud yozuvlarga tegmaymiz (ON CONFLICT DO NOTHING).
  // Qo'lda o'chirmaguncha seed saqlanib qoladi va qayta yozilmaydi.

  for (const [id, cat, name, phone, email, pos, spec, exp, diploma, daysAgo] of EMPLOYEES) {
    await pool.query(
      `INSERT INTO employees (id, category, full_name, phone, email, position, specialty, experience, diploma, added_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [id, cat, name, phone, email, pos, spec, exp, diploma, now - (daysAgo as number) * DAY],
    );
  }
  console.log(`✓ Employees upserted (skip existing)`);

  for (const [id, name, color] of CATEGORIES) {
    await pool.query('INSERT INTO service_categories (id, name, color) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [id, name, color]);
  }
  console.log(`✓ Service categories upserted`);

  for (const [id, catId, name, price, cur, somValue, share, archived] of SERVICES) {
    await pool.query(
      `INSERT INTO services (id, category_id, name, price, currency, som_value, doctor_share, archived)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING`,
      [id, catId, name, price, cur, somValue, share, archived],
    );
  }
  console.log(`✓ Services upserted`);

  for (const [empId, svId] of ASSIGNMENTS) {
    await pool.query('INSERT INTO assignments (employee_id, service_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [empId, svId]);
  }
  console.log(`✓ Assignments upserted`);

  for (const [id, name, phone, addr, region, district, gender, daysAgo] of PATIENTS) {
    await pool.query(
      'INSERT INTO patients (id, full_name, phone, address, region, district, gender, added_at, archived) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false) ON CONFLICT (id) DO NOTHING',
      [id, name, phone, addr, region, district, gender, now - daysAgo * DAY],
    );
  }
  for (const [id, name, phone, addr, region, district, gender, daysAgo] of ARCHIVED_PATIENTS) {
    await pool.query(
      'INSERT INTO patients (id, full_name, phone, address, region, district, gender, added_at, archived) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) ON CONFLICT (id) DO NOTHING',
      [id, name, phone, addr, region, district, gender, now - daysAgo * DAY],
    );
  }
  console.log(`✓ Patients upserted`);

  for (const [id, date, time, patient, doctor, service, status] of APPOINTMENTS) {
    await pool.query(
      'INSERT INTO appointments (id, date, time, patient, doctor, service, status) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
      [id, date, time, patient, doctor, service, status],
    );
  }
  console.log(`✓ Appointments upserted`);

  await pool.query(
    `INSERT INTO queue (id, number, patient, doctor, service, added_at, status) VALUES
      ('q1', 'A-01', 'Shahnoza Ergasheva', 'Alisher Qodirov', 'Kariyes davolash (1 kanal)', $1, 'kabinetda'),
      ('q2', 'A-02', 'Bobur Sa’dullayev',  'Malika Yusupova', 'Birlamchi konsultatsiya',     $2, 'navbatda')
     ON CONFLICT (id) DO NOTHING`,
    [now - 25 * MIN, now - 12 * MIN],
  );
  console.log('✓ Queue upserted');

  await pool.end();
  console.log('\n✓ Done. Database restored with full seed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

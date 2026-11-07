import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  CheckCircle2, Clock, Droplet, Eye, FileText, FlaskConical, Microscope,
  Printer, Save, Scan, Search, Trash2, X, XCircle, Zap, FileImage,
} from 'lucide-react';
import { usePatients, useEmployees } from '../store';
import { usePagination, TablePagination } from '../components/TablePagination';

function ModalPortal({ children }: { children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

type LabStatus = 'kutilmoqda' | 'jarayonda' | 'tayyor' | 'bekor';

type LabTest = {
  id: string;
  createdAt: number;
  patientId: string;        // UUID — asosiy identifikator
  patientPassport?: string; // qo'shimcha identifikator
  patientName: string;      // ko'rsatish uchun
  doctorId?: string;
  doctorName?: string;
  templateId: string;
  testType: string;
  priority: 'oddiy' | 'shoshilinch';
  status: LabStatus;
  // Doc data
  docNumber?: string;
  docDate?: string;
  patientBirth?: string;
  patientAddress?: string;
  sampleDate?: string;
  labDoctor?: string;
  laborant?: string;
  results?: Record<string, string>;
  resultNote?: string;
  readyAt?: number;
};

type DocField =
  | { key: string; label: string; code?: string; norm: string; section?: false }
  | { key: string; section: true; label: string };

type LabTemplate = {
  id: string;
  title: string;
  group: string;
  docTitle: string;
  heading: string;
  color: string;
  icon: typeof Droplet;
  pdfFile?: string;
  columns: { indicator: string; code?: string; result: string; norm: string };
  rows: DocField[];
  footerNote?: string;
  theme?: 'blue' | 'red' | 'green';
};

const CLINIC_NAME = '«SIRIUS STOMA DENT» DIAGNOSTIKA MARKAZI';
const CLINIC_ADDR = 'Shavat tumani, Ж.Mangʻuberdi koʻchasi 8-uy';
const CLINIC_PHONES = 'Tel: (+99891) 207-07-77; (+99891) 434-37-35; 34-53-571, 34-53-572';
const CLINIC_EMAIL = 'murod0983@mail.ru';
const DISCLAIMER = 'Diqqat: Bitta analiz toʻlik tashhisni ifodalamaydi. Analiz musbat boʻlsa keyingi klinik va laborator tekshiruvlar talab qilinadi.';

const DOC = `${encodeURI('/documents')}`;

const LAB_TEMPLATES: LabTemplate[] = [
  {
    id: 'cbc',
    title: 'Qonning umumiy tahlili',
    group: 'Qon',
    docTitle: 'КОННИНГ УМУМИЙ ТАҲЛИЛИ',
    heading: 'Qonning umumiy tahlili',
    color: '#dc2626',
    icon: Droplet,
    pdfFile: `${DOC}/Qonning umumiy tahlili.pdf`,
    columns: { indicator: 'Koʻrsatkich', code: 'Belgi', result: 'Tahlil', norm: 'Meʼyor' },
    rows: [
      { key: 'wbc',   label: 'Лейкоциты',                                code: 'WBC',   norm: '4-10 10^9 L' },
      { key: 'rbc',   label: 'Эритроциты',                               code: 'RBC',   norm: '3.5-5.5 10^12 L' },
      { key: 'hgb',   label: 'Гемоглобин',                               code: 'HGB',   norm: '110-160 g/L' },
      { key: 'hct',   label: 'Гематокрит',                               code: 'HCT',   norm: '35-50 %' },
      { key: 'mcv',   label: 'Средний объём эритроцитов',                 code: 'MCV',   norm: '80-100 fl' },
      { key: 'mch',   label: 'Среднее содержание гемоглобина в эритроцитах', code: 'MCH',   norm: '27-34 pg' },
      { key: 'mchc',  label: 'Средняя концентрация гемоглобина в эритроците', code: 'MCHC',  norm: '320-360 g/L' },
      { key: 'plt',   label: 'Тромбоциты',                               code: 'PLT',   norm: '180-320 10^9/l' },
      { key: 'lum',   label: 'Лимфоциты',                                code: 'LYM#',  norm: '0.6-3.5 10^9 L' },
      { key: 'mxd',   label: 'Смешанное количество клеток',              code: 'MXD#',  norm: '0.1-0.9 10^9 L' },
      { key: 'neut',  label: 'Нейтрофилы',                               code: 'NEUT#', norm: '1.3-6.7 10^9 L' },
      { key: 'lum_p', label: 'Процент лимфоцитов',                       code: 'LYM%',  norm: '14-53 %' },
      { key: 'mxd_p', label: 'Процент смешанных количество клеток',       code: 'MXD%',  norm: '3-16 %' },
      { key: 'neut_p',label: 'Процент нейтрофилов',                       code: 'NEUT%', norm: '30-90 %' },
      { key: 'rdw_cv',label: '(Аназоцитов эритроцитов)',                  code: 'RDW-CV',norm: '11-16 %' },
      { key: 'rdw_sd',label: '(Аназоцитоз эритроцитов) стандартное отклонение', code: 'RDW-SD',norm: '35-56 fL' },
      { key: 'pdw',   label: '(Аназоцитоз тромбоцитов)',                 code: 'PDW',   norm: '15-18 fL' },
      { key: 'mpv',   label: 'Средний объём тромбоцитов',                 code: 'MPV',   norm: '7-13 fL' },
      { key: 'plcr',  label: 'Доля крупных тромбоцитов',                  code: 'P-LCR', norm: '13-43 %' },
      { key: 'pct',   label: 'Тромбокрит',                               code: 'PCT',   norm: '0.1-0.28 %' },
      { key: 'plcc',  label: 'Количество крупных тромбоцитов',           code: 'P-LCC', norm: '13-129 10^9 L' },
      { key: 'esr',   label: 'СОЭ',                                      code: 'ESR',   norm: 'M.0-10 J.0-15 mm/h' },
    ],
    theme: 'blue',
  },
  {
    id: 'biochem',
    title: 'Biokimyoviy tahlil',
    group: 'Qon',
    docTitle: 'БИОХИМИК ТАҲЛИЛ',
    heading: 'Biokimyoviy tahlil',
    color: '#f97316',
    icon: FlaskConical,
    pdfFile: `${DOC}/Bioximik tahlil.pdf`,
    columns: { indicator: 'Koʻrsatkich', result: 'Xulosa', norm: 'SI sistemasi' },
    rows: [
      { key: 'uob',    label: 'Умумий оксил',             norm: '63-84 % mol' },
      { key: 'glc',    label: 'Глюкоза',                  norm: '3,3-6,6 m/mol' },
      { key: 'bil',    label: 'Билирубин',                norm: '20,5' },
      { key: 'bil_un', label: '- боғланмаган',            norm: '5-20,5 m/mol' },
      { key: 'bil_bn', label: '- боғланган',              norm: '0-5 ml/mol' },
      { key: 'alt',    label: 'АЛТ',                      norm: '0-40 ед/л' },
      { key: 'ast',    label: 'АСТ',                      norm: '0-40 ед/л' },
      { key: 'cre',    label: 'Креатин',                  norm: '53/115 m/mol' },
      { key: 'mcv',    label: 'Мачевина',                 norm: '2,5-8,3 m/mol' },
      { key: 'chol',   label: 'Умумий холестерин',        norm: '3,6-6,7 m/mol' },
      { key: 'ca',     label: 'Кальций',                  norm: '2,0-2,8 ml/mol' },
      { key: 'k',      label: 'Калий',                    norm: '2,20-2,60 мк/mol' },
      { key: 'na',     label: 'Натрий',                   norm: '135-150 мк/mol' },
      { key: 'dia',    label: 'Диастаза',                 norm: '16-32 ед/л' },
    ],
    theme: 'blue',
  },
  {
    id: 'urine',
    title: 'Umumiy siydik tahlili',
    group: 'Siydik',
    docTitle: 'ОБЩИЙ АНАЛИЗ МОЧИ',
    heading: 'Umumiy siydik tahlili',
    color: '#eab308',
    icon: FlaskConical,
    pdfFile: `${DOC}/Umumiy analiz mochi.pdf`,
    columns: { indicator: 'Показатели', result: 'Результат', norm: 'Норма' },
    rows: [
      { key: 'sec_phys', section: true, label: 'Физико-химические свойства' },
      { key: 'kol',     label: 'Количество',                   norm: '' },
      { key: 'cvet',    label: 'Цвет',                         norm: 'солом — жёлт' },
      { key: 'proz',    label: 'Прозрачность',                 norm: 'прозрачная' },
      { key: 'ph',      label: 'Реакция Ph',                   norm: '6,5-7,2' },
      { key: 'otpl',    label: 'Относительная плотность',      norm: '1010-1030' },
      { key: 'glc',     label: 'Глюкоза',                      norm: 'abs' },
      { key: 'nitr',    label: 'Нитриты',                      norm: 'abs' },
      { key: 'blk',     label: 'Белок',                        norm: 'abs' },
      { key: 'keton',   label: 'Кетоновые тела',               norm: 'abs' },
      { key: 'urob',    label: 'Уробилиноген',                 norm: 'abs' },
      { key: 'bil',     label: 'Билирубин',                    norm: 'abs' },
      { key: 'sec_micro', section: true, label: 'Микроскопия' },
      { key: 'ep_pl',   label: 'Эпителий: плоский',            norm: '0,3 в поле зрения' },
      { key: 'ep_per',  label: 'Переходной',                   norm: 'abs' },
      { key: 'ep_poch', label: 'почечный',                     norm: 'abs' },
      { key: 'leyk',    label: 'Лейкоциты',                    norm: '0-2 в поле зрения' },
      { key: 'eri_ne',  label: 'Эритроциты: Неизмененные',     norm: 'ед.' },
      { key: 'eri_iz',  label: 'Эритроциты: Измененные',       norm: 'ед.' },
      { key: 'cyl_g',   label: 'Цилиндры: гиалиновые',         norm: 'ед. в препарате' },
      { key: 'cyl_z',   label: 'Зернистые',                    norm: 'abs' },
      { key: 'cyl_v',   label: 'восковидные',                  norm: 'abs' },
      { key: 'cyl_ep',  label: 'Эпителиальные',                norm: 'abs' },
      { key: 'cyl_er',  label: 'эритроцитарные',               norm: 'abs' },
      { key: 'cyl_lk',  label: 'лейкоцитарные',                norm: 'abs' },
      { key: 'ura',     label: 'Неорганич. Осадок: ураты',     norm: 'abs' },
      { key: 'oks',     label: 'Оксалаты',                     norm: 'abs' },
      { key: 'kmk',     label: 'кристаллы мочевой кислоты',    norm: 'abs' },
      { key: 'amf',     label: 'аморфные фосфаты',             norm: 'abs' },
      { key: 'mka',     label: 'мочекислый аммоний',           norm: 'abs' },
      { key: 'tri',     label: 'трипельфосфат',                norm: 'abs' },
      { key: 'sliz',    label: 'Слизь',                        norm: 'abs' },
      { key: 'bact',    label: 'Бактерии',                     norm: 'abs' },
      { key: 'drog',    label: 'Дрожжевые грибы',              norm: 'abs' },
    ],
    theme: 'green',
  },
  {
    id: 'hormones',
    title: 'Garmonlar testi',
    group: 'Garmonlar',
    docTitle: 'ГАРМОНЛАР',
    heading: 'Garmonlar testi',
    color: '#8b5cf6',
    icon: Zap,
    pdfFile: `${DOC}/Garmonlar testi.pdf`,
    columns: { indicator: 'Garmon', result: 'Xulosa', norm: 'Norma' },
    rows: [
      { key: 'fsh',  label: 'ФСГ',             norm: '0,8-150 ME/l' },
      { key: 'lg',   label: 'LG',              norm: '1-57 IU/l' },
      { key: 'prl',  label: 'Prolactin',       norm: '40-10000 mIU/l' },
      { key: 't3',   label: 'T3',              norm: '1,2-3,2 ng/ml' },
      { key: 't4',   label: 'T4',              norm: '60-160 nmol/l' },
      { key: 'ttg',  label: 'ТТГ',             norm: '0,3-4 mIU/l' },
      { key: 't3s',  label: 'T3 свободный',    norm: '2,6-5,7 пмаль/л' },
      { key: 't4s',  label: 'T4 свободный',    norm: '9-23 пмаль/л' },
      { key: 'tpo',  label: 'Антитела к ТПО',  norm: '<30ME/мл, <(34ME/мл)' },
      { key: 'tst',  label: 'Тестостерон',     norm: '5-38 nmol/l' },
    ],
    theme: 'red',
  },
  {
    id: 'hematology',
    title: 'Gematologiya testi',
    group: 'Qon',
    docTitle: 'ГЕМАТОЛОГИЯ',
    heading: 'Gematologiya testi',
    color: '#ef4444',
    icon: Microscope,
    pdfFile: `${DOC}/Gematologiya testi.pdf`,
    columns: { indicator: 'Tekshiruv turi', result: 'Tahlil natijasi', norm: 'Maʼrom (norma)' },
    rows: [
      { key: 'svert', label: 'Время свертываемости крови', norm: '2 min 00 sek – 5 min 00 sek' },
    ],
    theme: 'blue',
  },
  {
    id: 'ifa',
    title: 'IFA tahlili',
    group: 'IFA',
    docTitle: 'ИФА - ТАҲЛИЛИ НАТИЖАСИ',
    heading: 'IFA tahlili',
    color: '#1d4ed8',
    icon: Microscope,
    pdfFile: `${DOC}/IFA tahlili.pdf`,
    columns: { indicator: 'Tekshiruv turi', result: 'Tahlil natijasi', norm: 'Maʼromi (norma)' },
    rows: [
      { key: 'hep_a', label: 'Гепатит A (A-IgM)', norm: '0,2-0,8 ед' },
    ],
    theme: 'blue',
  },
  {
    id: 'ifa_bc',
    title: 'IFA tahlil (Gepatit B, C)',
    group: 'IFA',
    docTitle: 'ИФА - ТАҲЛИЛИ НАТИЖАСИ',
    heading: 'IFA tahlil (Gepatit B, C)',
    color: '#b91c1c',
    icon: Microscope,
    pdfFile: `${DOC}/IFA tahlil gepatit B,C.pdf`,
    columns: { indicator: 'Tekshiruv turi', result: 'Tahlil natijasi', norm: 'Maʼromi (norma)' },
    rows: [
      { key: 'hep_b', label: 'Гепатит B (HBsAg)', norm: '< 1,0' },
      { key: 'hep_c', label: 'Гепатит C (HCV)',   norm: '< 1,0' },
    ],
    theme: 'red',
  },
  {
    id: 'express',
    title: 'Ekspress test',
    group: 'Ekspress',
    docTitle: 'ЭКСПРЕСС-ТЕСТ',
    heading: 'Ekspress test',
    color: '#0ea5e9',
    icon: Zap,
    pdfFile: `${DOC}/Ekpress test.pdf`,
    columns: { indicator: 'Tekshiruv turi', code: 'Marker', result: 'Tahlil natijasi', norm: '' },
    rows: [
      { key: 'hbsag', label: 'Гепатит B', code: 'HBsAg', norm: '' },
      { key: 'hcv',   label: 'Гепатит C', code: 'HCV',   norm: '' },
    ],
    theme: 'blue',
  },
  {
    id: 'glucose',
    title: 'Glyukoza (qand) tahlili',
    group: 'Qon',
    docTitle: 'ГЛЮКОЗА (ҚОН ҚАНДИ) ТАҲЛИЛИ',
    heading: 'Glyukoza (qand) tahlili',
    color: '#f59e0b',
    icon: Droplet,
    columns: { indicator: 'Koʻrsatkich', result: 'Natija', norm: 'Meʼyor' },
    rows: [
      { key: 'glc_f',  label: 'Och qoringa glyukoza',                 norm: '3.9 - 6.1 mmol/L' },
      { key: 'glc_pp', label: 'Ovqatdan 2 soat keyin',                norm: '< 7.8 mmol/L' },
      { key: 'hba1c',  label: 'Gemoglobin A1c (HbA1c)',               norm: '4.0 - 5.6 %' },
    ],
    theme: 'blue',
  },
  {
    id: 'allergy',
    title: 'Allergiya paneli',
    group: 'Immunologiya',
    docTitle: 'АЛЛЕРГИЯ ПАНЕЛИ',
    heading: 'Allergiya paneli',
    color: '#06b6d4',
    icon: Zap,
    columns: { indicator: 'Allergen', result: 'IgE natijasi', norm: 'Meʼyor' },
    rows: [
      { key: 'ige_tot', label: 'Umumiy IgE',          norm: '< 100 IU/ml' },
      { key: 'dust',   label: 'Uy changi',            norm: '< 0.35 kU/L' },
      { key: 'pollen', label: 'Oʻsimlik changlari',   norm: '< 0.35 kU/L' },
      { key: 'milk',   label: 'Sut mahsulotlari',     norm: '< 0.35 kU/L' },
      { key: 'egg',    label: 'Tuxum',                norm: '< 0.35 kU/L' },
      { key: 'fish',   label: 'Baliq',                norm: '< 0.35 kU/L' },
      { key: 'nuts',   label: 'Yongʻoqlar',           norm: '< 0.35 kU/L' },
    ],
    theme: 'green',
  },
];

// API-backed lab tests store
async function labApi<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`API ${path} failed: ${res.status}`);
  if (res.status === 204) return undefined as T;
  const txt = await res.text();
  return txt ? (JSON.parse(txt) as T) : (undefined as T);
}

function labFromRow(row: any): LabTest {
  const extra = row.result ? (() => { try { return JSON.parse(row.result); } catch { return {}; } })() : {};
  return {
    id: row.id,
    createdAt: Number(row.createdAt) || Date.now(),
    // Yangi yozuv: row.patientId UUID; eski: ism. Ism `extra.patientName` da ham saqlanadi.
    patientId: row.patientId ?? '',
    patientPassport: row.patientPassport ?? extra.patientPassport,
    patientName: extra.patientName ?? row.patientId ?? '',
    doctorId: extra.doctorId,
    doctorName: extra.doctorName,
    templateId: extra.templateId ?? '',
    testType: row.testName,
    priority: extra.priority ?? 'oddiy',
    status: (row.status ?? 'kutilmoqda') as LabStatus,
    docNumber: extra.docNumber,
    docDate: row.date,
    patientBirth: extra.patientBirth,
    patientAddress: extra.patientAddress,
    sampleDate: extra.sampleDate,
    labDoctor: row.doctorId ?? extra.labDoctor,
    laborant: extra.laborant,
    results: extra.results,
    resultNote: extra.resultNote,
    readyAt: extra.readyAt,
  };
}
function labToRowBody(t: Partial<LabTest> & { id?: string }) {
  const {
    id, patientName, testType, status, docDate, labDoctor,
    patientId, patientPassport, doctorId, doctorName, templateId, priority, docNumber,
    patientBirth, patientAddress, sampleDate, laborant, results, resultNote, readyAt,
  } = t;
  // UUID bo'lsa UUID, aks holda ism — eski yozuvlar uchun fallback
  const dbPatientId = patientId ?? patientName;
  return {
    ...(id ? { id } : {}),
    ...(dbPatientId !== undefined ? { patientId: dbPatientId } : {}),
    ...(patientPassport !== undefined ? { patientPassport } : {}),
    ...(testType !== undefined ? { testName: testType } : {}),
    ...(status !== undefined ? { status } : {}),
    ...(docDate !== undefined ? { date: docDate } : {}),
    ...(labDoctor !== undefined ? { doctorId: labDoctor } : {}),
    result: JSON.stringify({
      patientName, patientPassport,
      doctorId, doctorName, templateId, priority, docNumber,
      patientBirth, patientAddress, sampleDate, laborant, results, resultNote, readyAt,
    }),
  };
}

let testsState: LabTest[] = [];
const listeners = new Set<() => void>();
function emitTests() { listeners.forEach((l) => l()); }
function subTests(l: () => void) { listeners.add(l); return () => listeners.delete(l); }

let labHydrated = false;
async function hydrateTests() {
  if (labHydrated || typeof window === 'undefined') return;
  labHydrated = true;
  try {
    const rows = await labApi<any[]>('/lab-results');
    testsState = rows.map(labFromRow).sort((a, b) => b.createdAt - a.createdAt);
    emitTests();
  } catch (e) { console.error('lab-results hydrate failed', e); }
}

function useTests() {
  useEffect(() => { hydrateTests(); }, []);
  return useSyncExternalStore(subTests, () => testsState, () => testsState);
}

async function addTest(t: Omit<LabTest, 'id' | 'createdAt' | 'status'>) {
  const body = labToRowBody({ ...t, status: 'kutilmoqda', docDate: t.docDate ?? new Date().toISOString().slice(0, 10) } as any);
  const row = await labApi<any>('/lab-results', { method: 'POST', body: JSON.stringify(body) });
  testsState = [labFromRow(row), ...testsState];
  emitTests();
}
async function createReadyTest(t: Omit<LabTest, 'id' | 'createdAt' | 'status' | 'readyAt'>) {
  const body = labToRowBody({ ...t, status: 'tayyor', readyAt: Date.now(), docDate: t.docDate ?? new Date().toISOString().slice(0, 10) } as any);
  const row = await labApi<any>('/lab-results', { method: 'POST', body: JSON.stringify(body) });
  testsState = [labFromRow(row), ...testsState];
  emitTests();
}
async function updateTestStatus(id: string, status: LabStatus) {
  const existing = testsState.find((x) => x.id === id);
  if (!existing) return;
  const merged = { ...existing, status, readyAt: status === 'tayyor' ? Date.now() : existing.readyAt };
  const row = await labApi<any>(`/lab-results/${id}`, { method: 'PATCH', body: JSON.stringify(labToRowBody(merged)) });
  testsState = testsState.map((t) => (t.id === id ? labFromRow(row) : t));
  emitTests();
}
async function saveTestDoc(id: string, patch: Partial<LabTest>) {
  const existing = testsState.find((x) => x.id === id);
  if (!existing) return;
  const merged = { ...existing, ...patch, status: 'tayyor' as LabStatus, readyAt: Date.now() };
  const row = await labApi<any>(`/lab-results/${id}`, { method: 'PATCH', body: JSON.stringify(labToRowBody(merged)) });
  testsState = testsState.map((t) => (t.id === id ? labFromRow(row) : t));
  emitTests();
}
async function removeTest(id: string) {
  await labApi(`/lab-results/${id}`, { method: 'DELETE' });
  testsState = testsState.filter((t) => t.id !== id);
  emitTests();
}

function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const statusLabel: Record<LabStatus, string> = {
  kutilmoqda: 'Kutilmoqda', jarayonda: 'Jarayonda', tayyor: 'Tayyor', bekor: 'Bekor',
};
const statusChip: Record<LabStatus, string> = {
  kutilmoqda: 'chip-wait', jarayonda: 'chip-wait', tayyor: 'chip-ok', bekor: 'chip-danger',
};

export function AdminLaboratory() {
  const tests = useTests();
  const patients = usePatients().filter((p) => !p.archived);
  const allEmployees = useEmployees().filter((e) => !e.archived);
  const employees = allEmployees.filter((e) => e.category === 'medical');
  const labDoctors = allEmployees.filter(
    (e) => e.category === 'medical' || /laborant/i.test(e.position ?? '') || /laborant/i.test(e.specialty ?? '')
  );
  const laborants = allEmployees.filter(
    (e) => /laborant/i.test(e.position ?? '') || /laborant/i.test(e.specialty ?? '')
  );

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<LabStatus | 'all'>('all');
  const [picker, setPicker] = useState(false);
  const [previewTpl, setPreviewTpl] = useState<LabTemplate | null>(null);
  const [editing, setEditing] = useState<LabTest | null>(null);
  const [viewing, setViewing] = useState<LabTest | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tests.filter((t) => {
      if (filter !== 'all' && t.status !== filter) return false;
      if (!q) return true;
      return (
        t.patientName.toLowerCase().includes(q) ||
        t.testType.toLowerCase().includes(q) ||
        (t.doctorName ?? '').toLowerCase().includes(q)
      );
    });
  }, [tests, query, filter]);

  const pg = usePagination(filtered, [query, filter, filtered.length]);

  const stats = useMemo(() => ({
    pending: tests.filter((t) => t.status === 'kutilmoqda').length,
    progress: tests.filter((t) => t.status === 'jarayonda').length,
    ready: tests.filter((t) => t.status === 'tayyor').length,
    total: tests.length,
  }), [tests]);

  return (
    <div className="admin-page">
      <div className="admin-page-head">
        <div>
          <h1>Laboratoriya</h1>
          <p>Tahlillarni qabul qilish, hujjat shabloniga natijalarni yozib saqlash va chop etish.</p>
        </div>
        <div className="admin-page-actions">
          <button className="admin-btn admin-btn-primary" onClick={() => setPicker(true)}>
            + Yangi tahlil
          </button>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Clock size={18} /></div>
          <div className="admin-stat-copy">
            <small>Kutilmoqda</small><strong>{stats.pending} ta</strong>
            <span className="admin-stat-trend trend-up">yangi</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><Microscope size={18} /></div>
          <div className="admin-stat-copy">
            <small>Jarayonda</small><strong>{stats.progress} ta</strong>
            <span className="admin-stat-trend trend-up">faol</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><CheckCircle2 size={18} /></div>
          <div className="admin-stat-copy">
            <small>Tayyor</small><strong>{stats.ready} ta</strong>
            <span className="admin-stat-trend trend-up">natijalar</span>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon"><FlaskConical size={18} /></div>
          <div className="admin-stat-copy">
            <small>Umumiy</small><strong>{stats.total} ta</strong>
            <span className="admin-stat-trend trend-up">barcha vaqt</span>
          </div>
        </div>
      </div>

      <section className="admin-card">
        <div className="admin-card-head" style={{ gap: 12, flexWrap: 'wrap' }}>
          <div>
            <h2>Tahlillar roʻyxati</h2>
            <small>{filtered.length} ta yozuv</small>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <div className="admin-search" style={{ minWidth: 220 }}>
              <Search size={14} />
              <input
                placeholder="Bemor, tahlil, shifokor..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <select
              className="admin-input"
              value={filter}
              onChange={(e) => setFilter(e.target.value as LabStatus | 'all')}
              style={{ width: 'auto' }}
            >
              <option value="all">Barcha statuslar</option>
              <option value="kutilmoqda">Kutilmoqda</option>
              <option value="jarayonda">Jarayonda</option>
              <option value="tayyor">Tayyor</option>
              <option value="bekor">Bekor</option>
            </select>
          </div>
        </div>

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Sana</th><th>Bemor</th><th>Tahlil turi</th>
                <th>Yoʻnaltirgan shifokor</th><th>Laborant shifokor</th>
                <th>Shoshilinch</th><th>Status</th><th>Amallar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="admin-cell-muted" style={{ textAlign: 'center', padding: 24 }}>
                  Tahlillar yoʻq — "Yangi tahlil" tugmasini bosing.
                </td></tr>
              )}
              {pg.pageRows.map((t) => (
                <tr key={t.id}>
                  <td className="admin-cell-muted">{fmtDate(t.createdAt)}</td>
                  <td>{t.patientName}</td>
                  <td>{t.testType}</td>
                  <td>{t.doctorName ?? '—'}</td>
                  <td>{t.labDoctor || '—'}</td>
                  <td>
                    {t.priority === 'shoshilinch'
                      ? <span className="admin-chip chip-danger">Shoshilinch</span>
                      : <span className="admin-cell-muted">Oddiy</span>}
                  </td>
                  <td><span className={`admin-chip ${statusChip[t.status]}`}>{statusLabel[t.status]}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(t.status === 'kutilmoqda' || t.status === 'jarayonda') && (
                        <button
                          className="admin-btn admin-btn-primary"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => { if (t.status === 'kutilmoqda') updateTestStatus(t.id, 'jarayonda'); setEditing(t); }}
                        ><FileText size={12} style={{ marginRight: 4 }} />Hujjat</button>
                      )}
                      {t.status === 'tayyor' && (
                        <button
                          className="admin-btn admin-btn-ghost"
                          style={{ padding: '4px 8px', fontSize: 12 }}
                          onClick={() => setViewing(t)}
                        ><Eye size={12} style={{ marginRight: 4 }} />Koʻrish</button>
                      )}
                      {(t.status === 'kutilmoqda' || t.status === 'jarayonda') && (
                        <button
                          className="admin-icon-btn"
                          title="Bekor qilish"
                          onClick={() => updateTestStatus(t.id, 'bekor')}
                        ><XCircle size={14} /></button>
                      )}
                      <button
                        className="admin-icon-btn danger"
                        title="Oʻchirish"
                        onClick={() => { if (confirm('Oʻchirilsinmi?')) removeTest(t.id); }}
                      ><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <TablePagination {...pg} />
        </div>
      </section>

      {picker && (
        <DocPickerModal
          onClose={() => setPicker(false)}
          onPreview={(tpl) => setPreviewTpl(tpl)}
          patients={patients}
          employees={employees}
          labDoctors={labDoctors}
          laborants={laborants}
          onCreate={(payload) => {
            createReadyTest(payload);
            setPicker(false);
          }}
          onDraft={(payload) => {
            addTest(payload);
            setPicker(false);
          }}
        />
      )}

      {previewTpl && (
        <PdfPreviewModal tpl={previewTpl} onClose={() => setPreviewTpl(null)} />
      )}

      {editing && (
        <DocEditorModal
          test={editing}
          labDoctors={labDoctors}
          laborants={laborants}
          onClose={() => setEditing(null)}
          onSave={(patch) => { saveTestDoc(editing.id, patch); setEditing(null); }}
        />
      )}

      {viewing && (
        <DocViewerModal
          test={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => { setEditing(viewing); setViewing(null); }}
        />
      )}
    </div>
  );
}

/* ---------- Document picker (10 cards) + inline doc editor ---------- */
type NewTestPayload = Omit<LabTest, 'id' | 'createdAt' | 'status' | 'readyAt'>;

function DocPickerModal({
  onClose, onPreview, onCreate, onDraft, patients, employees, labDoctors, laborants,
}: {
  onClose: () => void;
  onPreview: (tpl: LabTemplate) => void;
  onCreate: (payload: NewTestPayload) => void;
  onDraft: (payload: NewTestPayload) => void;
  patients: ReturnType<typeof usePatients>;
  employees: ReturnType<typeof useEmployees>;
  labDoctors: ReturnType<typeof useEmployees>;
  laborants: ReturnType<typeof useEmployees>;
}) {
  const [tpl, setTpl] = useState<LabTemplate | null>(null);

  const back = () => setTpl(null);

  if (tpl) {
    return (
      <DocInlineEditor
        tpl={tpl}
        patients={patients}
        employees={employees}
        labDoctors={labDoctors}
        laborants={laborants}
        onBack={back}
        onClose={onClose}
        onCreate={onCreate}
        onDraft={onDraft}
      />
    );
  }

  return (
    <ModalPortal>
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal lab-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1100 }}>
        <div className="lab-modal-head">
          <div className="lab-modal-head-left">
            <div className="lab-modal-head-icon" style={{ background: '#0ea5e91a', color: '#0ea5e9' }}>
              <FileText size={22} />
            </div>
            <div>
              <h2>Tibbiy hujjat tanlang</h2>
              <small>10 xil tahlil hujjati — natijalarni yozish, saqlash va PDF chop etish mumkin</small>
            </div>
          </div>
          <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>

        <div className="lab-modal-body">
          <div className="lab-doc-grid">
            {LAB_TEMPLATES.map((t) => {
              const Icon = t.icon;
              return (
                <div key={t.id} className="lab-doc-card">
                  <div className="lab-doc-card-head" style={{ background: `${t.color}0d` }}>
                    <span className="lab-doc-card-icon" style={{ background: `${t.color}1a`, color: t.color }}>
                      <Icon size={22} />
                    </span>
                    <div className="lab-doc-card-copy">
                      <strong>{t.title}</strong>
                      <small>{t.group} · {t.rows.length} ta koʻrsatkich</small>
                    </div>
                  </div>
                  <div className="lab-doc-card-body">
                    <div className="lab-doc-card-meta">
                      <FileText size={13} />
                      <span>{t.docTitle}</span>
                    </div>
                    {t.pdfFile && (
                      <div className="lab-doc-card-meta">
                        <FileImage size={13} />
                        <span>Asl PDF nusxa mavjud</span>
                      </div>
                    )}
                  </div>
                  <div className="lab-doc-card-foot">
                    {t.pdfFile ? (
                      <button
                        type="button"
                        className="admin-btn admin-btn-ghost"
                        style={{ padding: '6px 10px', fontSize: 12 }}
                        onClick={() => onPreview(t)}
                      >
                        <Eye size={13} style={{ marginRight: 4 }} />Asl nusxa
                      </button>
                    ) : <span />}
                    <button
                      type="button"
                      className="admin-btn admin-btn-primary"
                      style={{ padding: '6px 12px', fontSize: 12 }}
                      onClick={() => setTpl(t)}
                    >
                      Tanlash →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="admin-modal-foot">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ---------- Inline editor shown in the same modal after picking ---------- */
function DocInlineEditor({
  tpl, patients, employees, labDoctors, laborants, onBack, onClose, onCreate, onDraft,
}: {
  tpl: LabTemplate;
  patients: ReturnType<typeof usePatients>;
  employees: ReturnType<typeof useEmployees>;
  labDoctors: ReturnType<typeof useEmployees>;
  laborants: ReturnType<typeof useEmployees>;
  onBack: () => void;
  onClose: () => void;
  onCreate: (payload: NewTestPayload) => void;
  onDraft: (payload: NewTestPayload) => void;
}) {
  const [patientId, setPatientId] = useState('');
  const [patientQuery, setPatientQuery] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [priority, setPriority] = useState<'oddiy' | 'shoshilinch'>('oddiy');

  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(todayStr());
  const [patientName, setPatientName] = useState('');
  const [patientBirth, setPatientBirth] = useState('');
  const [patientAddress, setPatientAddress] = useState('');
  const [sampleDate, setSampleDate] = useState(todayStr());
  const [labDoctor, setLabDoctor] = useState('');
  const [laborant, setLaborant] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const setVal = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const selectedPatient = patients.find((p) => p.id === patientId);
  const filteredPatients = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q || selectedPatient) return patients.slice(0, 6);
    return patients
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q))
      .slice(0, 6);
  }, [patients, patientQuery, selectedPatient]);

  const pickPatient = (id: string) => {
    const p = patients.find((x) => x.id === id);
    if (!p) return;
    setPatientId(id);
    setPatientName(p.fullName);
  };

  const chosenName = patientName.trim() || selectedPatient?.fullName || '';
  const canSave = chosenName.length > 0;

  const buildPayload = (): NewTestPayload => {
    const doc = employees.find((e) => e.id === doctorId);
    const p = patients.find((x) => x.id === patientId);
    const passport = (p?.passport ?? '').replace(/\s+/g, '').toUpperCase() || undefined;
    return {
      patientId: patientId || `walkin_${Date.now()}`,
      patientPassport: passport,
      patientName: chosenName,
      doctorId: doc?.id,
      doctorName: doc?.fullName,
      templateId: tpl.id,
      testType: tpl.title,
      priority,
      docNumber, docDate, patientBirth, patientAddress, sampleDate,
      labDoctor, laborant,
      results: values,
    };
  };

  const save = () => { if (canSave) onCreate(buildPayload()); };
  const saveDraft = () => { if (canSave) onDraft(buildPayload()); };

  const print = () => {
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing');
    }, 50);
  };

  const Icon = tpl.icon;

  return (
    <ModalPortal>
    <div className="admin-modal-backdrop lab-doc-backdrop" onClick={onClose}>
      <div className="admin-modal lab-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head no-print">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="admin-btn admin-btn-ghost" onClick={onBack} style={{ padding: '4px 10px', fontSize: 12 }}>
              ← Hujjatlar
            </button>
            <div className="lab-modal-head-icon" style={{ background: `${tpl.color}1a`, color: tpl.color, width: 34, height: 34 }}>
              <Icon size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0 }}>{tpl.title}</h2>
              <small>Natijalarni toʻldiring va saqlang</small>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn admin-btn-ghost" onClick={print}>
              <Printer size={14} style={{ marginRight: 6 }} />Chop etish
            </button>
            <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>
        </div>

        <div className="admin-modal-body lab-doc-body">
          <div className="lab-doc-sidepanel no-print">
            <section className="lab-section">
              <div className="lab-section-head">
                <div className="lab-section-dot" style={{ background: '#0ea5e9' }}><Search size={14} /></div>
                <div><strong>Bemor</strong><small>Roʻyxatdan tanlang yoki hujjatda qoʻlda yozing</small></div>
              </div>
              {selectedPatient ? (
                <div className="lab-patient-card">
                  <div className="lab-patient-avatar">{selectedPatient.fullName.charAt(0)}</div>
                  <div className="lab-patient-info">
                    <strong>{selectedPatient.fullName}</strong>
                    <small>{selectedPatient.phone}</small>
                  </div>
                  <button className="admin-btn admin-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}
                    onClick={() => { setPatientId(''); setPatientQuery(''); }}>
                    Oʻzgartirish
                  </button>
                </div>
              ) : (
                <>
                  <div className="lab-search">
                    <Search size={15} />
                    <input placeholder="Bemor ismi yoki telefon..." value={patientQuery}
                      onChange={(e) => setPatientQuery(e.target.value)} />
                  </div>
                  <div className="lab-patient-list">
                    {filteredPatients.length === 0 && <div className="lab-empty">Bemor topilmadi — hujjatda qoʻlda yozing</div>}
                    {filteredPatients.map((p) => (
                      <button key={p.id} type="button" className="lab-patient-row" onClick={() => pickPatient(p.id)}>
                        <div className="lab-patient-avatar sm">{p.fullName.charAt(0)}</div>
                        <div className="lab-patient-info">
                          <strong>{p.fullName}</strong>
                          <small>{p.phone}</small>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            <section className="lab-section">
              <div className="lab-section-head">
                <div className="lab-section-dot" style={{ background: '#8b5cf6' }}><FileText size={14} /></div>
                <div><strong>Shifokor</strong><small>Yoʻnaltirgan (ixtiyoriy)</small></div>
              </div>
              <div className="lab-chip-row">
                <button type="button" className={`lab-chip-btn${!doctorId ? ' is-active' : ''}`}
                  onClick={() => setDoctorId('')}>Tanlanmagan</button>
                {employees.map((e) => (
                  <button key={e.id} type="button"
                    className={`lab-chip-btn${doctorId === e.id ? ' is-active' : ''}`}
                    onClick={() => setDoctorId(e.id)}>{e.fullName}</button>
                ))}
              </div>
            </section>

            <section className="lab-section">
              <div className="lab-section-head">
                <div className="lab-section-dot" style={{ background: '#ef4444' }}><Zap size={14} /></div>
                <div><strong>Shoshilinchlik</strong><small>Oddiy yoki tezkor</small></div>
              </div>
              <div className="lab-priority-row">
                <button type="button" className={`lab-priority-btn${priority === 'oddiy' ? ' is-active' : ''}`}
                  data-tone="normal" onClick={() => setPriority('oddiy')}>
                  <Clock size={16} />
                  <span><strong>Oddiy</strong><small>Odatiy navbat</small></span>
                </button>
                <button type="button" className={`lab-priority-btn${priority === 'shoshilinch' ? ' is-active' : ''}`}
                  data-tone="urgent" onClick={() => setPriority('shoshilinch')}>
                  <Zap size={16} />
                  <span><strong>Shoshilinch</strong><small>Darhol bajariladi</small></span>
                </button>
              </div>
            </section>
          </div>

          <LabDocument
            tpl={tpl}
            editable
            labDoctors={labDoctors}
            laborants={laborants}
            docNumber={docNumber} setDocNumber={setDocNumber}
            docDate={docDate} setDocDate={setDocDate}
            patientName={patientName} setPatientName={setPatientName}
            patientBirth={patientBirth} setPatientBirth={setPatientBirth}
            patientAddress={patientAddress} setPatientAddress={setPatientAddress}
            sampleDate={sampleDate} setSampleDate={setSampleDate}
            labDoctor={labDoctor} setLabDoctor={setLabDoctor}
            laborant={laborant} setLaborant={setLaborant}
            values={values} setVal={setVal}
          />
        </div>

        <div className="admin-modal-foot no-print">
          <button className="admin-btn admin-btn-ghost" onClick={onBack}>← Hujjatlar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn admin-btn-ghost" disabled={!canSave} onClick={saveDraft}>
              Qoralama saqlash
            </button>
            <button className="admin-btn admin-btn-primary" disabled={!canSave} onClick={save}>
              <Save size={14} style={{ marginRight: 6 }} />Saqlash va tayyor
            </button>
          </div>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ---------- PDF preview (asl nusxa) ---------- */
function PdfPreviewModal({ tpl, onClose }: { tpl: LabTemplate; onClose: () => void }) {
  return (
    <ModalPortal>
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, width: '95%' }}>
        <div className="admin-modal-head">
          <h2>Asl nusxa — {tpl.title}</h2>
          <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>
        <div className="admin-modal-body" style={{ padding: 0 }}>
          {tpl.pdfFile && (
            <iframe
              src={tpl.pdfFile}
              title={tpl.title}
              style={{ width: '100%', height: '75vh', border: 0 }}
            />
          )}
        </div>
        <div className="admin-modal-foot">
          {tpl.pdfFile && (
            <a className="admin-btn admin-btn-ghost" href={tpl.pdfFile} target="_blank" rel="noreferrer">
              Yangi oynada ochish
            </a>
          )}
          <button className="admin-btn admin-btn-primary" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ---------- Document editor ---------- */
function findTpl(id: string) {
  return LAB_TEMPLATES.find((t) => t.id === id) ?? LAB_TEMPLATES[0];
}

function DocEditorModal({
  test, onClose, onSave, labDoctors, laborants,
}: {
  test: LabTest;
  onClose: () => void;
  onSave: (patch: Partial<LabTest>) => void;
  labDoctors: ReturnType<typeof useEmployees>;
  laborants: ReturnType<typeof useEmployees>;
}) {
  const tpl = findTpl(test.templateId);
  const [docNumber, setDocNumber] = useState(test.docNumber ?? '');
  const [docDate, setDocDate] = useState(test.docDate ?? todayStr());
  const [patientName, setPatientName] = useState(test.patientName);
  const [patientBirth, setPatientBirth] = useState(test.patientBirth ?? '');
  const [patientAddress, setPatientAddress] = useState(test.patientAddress ?? '');
  const [sampleDate, setSampleDate] = useState(test.sampleDate ?? todayStr());
  const [labDoctor, setLabDoctor] = useState(test.labDoctor ?? '');
  const [laborant, setLaborant] = useState(test.laborant ?? '');
  const [values, setValues] = useState<Record<string, string>>(test.results ?? {});

  const setVal = (k: string, v: string) => setValues((prev) => ({ ...prev, [k]: v }));

  const submit = () => {
    onSave({
      docNumber, docDate, patientName, patientBirth, patientAddress,
      sampleDate, labDoctor, laborant, results: values,
    });
  };

  const print = () => {
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing');
    }, 50);
  };

  return (
    <ModalPortal>
    <div className="admin-modal-backdrop lab-doc-backdrop" onClick={onClose}>
      <div className="admin-modal lab-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head no-print">
          <h2>Hujjat tahrirlash — {tpl.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn admin-btn-ghost" onClick={print}>
              <Printer size={14} style={{ marginRight: 6 }} />Chop etish / PDF
            </button>
            <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>
        </div>

        <div className="admin-modal-body lab-doc-body">
          <LabDocument
            tpl={tpl}
            editable
            labDoctors={labDoctors}
            laborants={laborants}
            docNumber={docNumber} setDocNumber={setDocNumber}
            docDate={docDate} setDocDate={setDocDate}
            patientName={patientName} setPatientName={setPatientName}
            patientBirth={patientBirth} setPatientBirth={setPatientBirth}
            patientAddress={patientAddress} setPatientAddress={setPatientAddress}
            sampleDate={sampleDate} setSampleDate={setSampleDate}
            labDoctor={labDoctor} setLabDoctor={setLabDoctor}
            laborant={laborant} setLaborant={setLaborant}
            values={values} setVal={setVal}
          />
        </div>

        <div className="admin-modal-foot no-print">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>Bekor qilish</button>
          <button className="admin-btn admin-btn-primary" onClick={submit}>
            <Save size={14} style={{ marginRight: 6 }} />Saqlash va tayyor deb belgilash
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ---------- Document viewer (read-only) ---------- */
function DocViewerModal({
  test, onClose, onEdit,
}: { test: LabTest; onClose: () => void; onEdit: () => void }) {
  const tpl = findTpl(test.templateId);
  const print = () => {
    document.body.classList.add('is-printing');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('is-printing');
    }, 50);
  };

  return (
    <ModalPortal>
    <div className="admin-modal-backdrop lab-doc-backdrop" onClick={onClose}>
      <div className="admin-modal lab-doc-modal" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-head no-print">
          <h2>Hujjatni koʻrish — {tpl.title}</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="admin-btn admin-btn-primary" onClick={print}>
              <Printer size={14} style={{ marginRight: 6 }} />PDF chop etish
            </button>
            <button className="admin-btn admin-btn-ghost" onClick={onEdit}>Tahrirlash</button>
            <button className="admin-icon-btn" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
          </div>
        </div>

        <div className="admin-modal-body lab-doc-body">
          <LabDocument
            tpl={tpl}
            editable={false}
            docNumber={test.docNumber ?? ''}
            docDate={test.docDate ?? ''}
            patientName={test.patientName}
            patientBirth={test.patientBirth ?? ''}
            patientAddress={test.patientAddress ?? ''}
            sampleDate={test.sampleDate ?? ''}
            labDoctor={test.labDoctor ?? ''}
            laborant={test.laborant ?? ''}
            values={test.results ?? {}}
          />
        </div>

        <div className="admin-modal-foot no-print">
          <button className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}

/* ---------- Printable document ---------- */
function LabDocument(props: {
  tpl: LabTemplate;
  editable: boolean;
  docNumber: string; setDocNumber?: (v: string) => void;
  docDate: string; setDocDate?: (v: string) => void;
  patientName: string; setPatientName?: (v: string) => void;
  patientBirth: string; setPatientBirth?: (v: string) => void;
  patientAddress: string; setPatientAddress?: (v: string) => void;
  sampleDate: string; setSampleDate?: (v: string) => void;
  labDoctor: string; setLabDoctor?: (v: string) => void;
  laborant: string; setLaborant?: (v: string) => void;
  labDoctors?: ReturnType<typeof useEmployees>;
  laborants?: ReturnType<typeof useEmployees>;
  values: Record<string, string>;
  setVal?: (k: string, v: string) => void;
}) {
  const {
    tpl, editable, docNumber, docDate, patientName, patientBirth, patientAddress,
    sampleDate, labDoctor, laborant, values,
  } = props;

  const theme = tpl.theme ?? 'blue';
  const hasCode = tpl.rows.some((r) => !r.section && r.code);
  const colSpan = 2 + (hasCode ? 1 : 0) + 1;

  const inp = (val: string, set?: (v: string) => void, w?: string | number) => (
    editable
      ? <input className="lab-doc-input" value={val} style={{ width: w }}
          onChange={(e) => set?.(e.target.value)} />
      : <span className="lab-doc-static" style={{ width: w }}>{val || '—'}</span>
  );

  return (
    <div className={`lab-doc print-area theme-${theme}`}>
      <header className="lab-doc-header">
        <div className="lab-doc-brand">SSD</div>
        <div className="lab-doc-brand-copy">
          <strong>{CLINIC_NAME}</strong>
          <div>{CLINIC_ADDR}</div>
          <div>{CLINIC_PHONES}</div>
          <div>{CLINIC_EMAIL}</div>
        </div>
      </header>

      <div className="lab-doc-meta">
        <div className="lab-doc-meta-row">
          <span>№</span>{inp(docNumber, props.setDocNumber, 120)}
          <span style={{ marginLeft: 16 }}>Tahlil sanasi:</span>{inp(docDate, props.setDocDate, 160)}
        </div>
        <div className="lab-doc-meta-row">
          <span>F.I.Sh.:</span>{inp(patientName, props.setPatientName, '100%')}
        </div>
        <div className="lab-doc-meta-row">
          <span>Tugʻilgan yili:</span>{inp(patientBirth, props.setPatientBirth, 220)}
          <span style={{ marginLeft: 16 }}>Namuna sanasi:</span>{inp(sampleDate, props.setSampleDate, 160)}
        </div>
        <div className="lab-doc-meta-row">
          <span>Yashash joyi:</span>{inp(patientAddress, props.setPatientAddress, '100%')}
        </div>
      </div>

      <h3 className="lab-doc-title">{tpl.docTitle}</h3>

      <table className="lab-doc-table">
        <thead>
          <tr>
            <th style={{ width: hasCode ? '46%' : '52%' }}>{tpl.columns.indicator}</th>
            {hasCode && <th style={{ width: '11%' }}>{tpl.columns.code ?? 'Belgi'}</th>}
            <th style={{ width: hasCode ? '18%' : '22%' }}>{tpl.columns.result}</th>
            <th style={{ width: hasCode ? '25%' : '26%' }}>{tpl.columns.norm}</th>
          </tr>
        </thead>
        <tbody>
          {tpl.rows.map((r) => (
            r.section ? (
              <tr key={r.key} className="lab-doc-section-row">
                <td colSpan={colSpan}>{r.label}</td>
              </tr>
            ) : (
              <tr key={r.key}>
                <td>{r.label}</td>
                {hasCode && <td className="lab-doc-code">{r.code ?? ''}</td>}
                <td>
                  {editable
                    ? <input
                        className="lab-doc-input lab-doc-cell-input"
                        value={values[r.key] ?? ''}
                        onChange={(e) => props.setVal?.(r.key, e.target.value)}
                      />
                    : <span className="lab-doc-cell-static">{values[r.key] || ''}</span>}
                </td>
                <td className="lab-doc-norm">{r.norm}</td>
              </tr>
            )
          ))}
        </tbody>
      </table>

      <p className="lab-doc-disclaimer">{DISCLAIMER}</p>

      <div className="lab-doc-signatures">
        <div>
          <span>Shifokor laborant:</span>
          {editable ? (
            <select
              className="lab-doc-input lab-doc-select"
              value={labDoctor}
              onChange={(e) => props.setLabDoctor?.(e.target.value)}
            >
              <option value="">— Tanlang —</option>
              {(props.labDoctors ?? []).map((e) => (
                <option key={e.id} value={e.fullName}>
                  {e.fullName}{e.position ? ` — ${e.position}` : ''}
                </option>
              ))}
              {labDoctor && !(props.labDoctors ?? []).some((x) => x.fullName === labDoctor) && (
                <option value={labDoctor}>{labDoctor}</option>
              )}
            </select>
          ) : (
            <span className="lab-doc-static" style={{ width: 260 }}>{labDoctor || '—'}</span>
          )}
        </div>
        <div>
          <span>Laborant:</span>
          {editable ? (
            <select
              className="lab-doc-input lab-doc-select"
              value={laborant}
              onChange={(e) => props.setLaborant?.(e.target.value)}
            >
              <option value="">— Tanlang —</option>
              {(props.laborants ?? []).map((e) => (
                <option key={e.id} value={e.fullName}>
                  {e.fullName}{e.position ? ` — ${e.position}` : ''}
                </option>
              ))}
              {laborant && !(props.laborants ?? []).some((x) => x.fullName === laborant) && (
                <option value={laborant}>{laborant}</option>
              )}
            </select>
          ) : (
            <span className="lab-doc-static" style={{ width: 260 }}>{laborant || '—'}</span>
          )}
        </div>
      </div>
    </div>
  );
}

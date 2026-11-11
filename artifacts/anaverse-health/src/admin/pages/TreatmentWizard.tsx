import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Save, Search, X } from 'lucide-react';
import { useQueue, usePatients, useServices, useServiceCategories, useEmployees } from '../store';
import { addTreatment, updateTreatment, type AdmissionTests, type TechOrderItem, type Treatment, type TreatmentStatus } from '../clinicalData';
import { useTechProducts } from '../techStore';

type Props = {
  onClose: () => void;
  existing?: Treatment;
  initialPatient?: string;      // navbatdan avto-tanlangan bemor
  initialDoctor?: string;       // joriy shifokorni majburlash
  onSaved?: (info: { patient: string; doctor: string; status: TreatmentStatus }) => void;
};

function formatSom(n: number): string {
  return new Intl.NumberFormat('uz-UZ').format(Math.round(n)) + " so'm";
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TreatmentWizard({ onClose, existing, initialPatient, initialDoctor, onSaved }: Props) {
  const queue = useQueue();
  const patients = usePatients();
  const services = useServices();
  const categories = useServiceCategories();
  const employees = useEmployees();
  const techProducts = useTechProducts();

  type Step = 1 | 2 | 3 | 4 | 5;
  const [step, setStep] = useState<Step>(1);

  // Step 1: patient + date + doctor
  const [patientQ, setPatientQ] = useState(existing?.patient ?? initialPatient ?? '');
  const [patient, setPatient] = useState(existing?.patient ?? initialPatient ?? '');
  const [date, setDate] = useState<string>(existing?.date ?? todayISO());
  const [doctor, setDoctor] = useState(existing?.doctor ?? initialDoctor ?? '');

  // Agar initialPatient berilgan bo'lsa — navbatdagi ma'lumotlardan avto to'ldirish
  useEffect(() => {
    if (!initialPatient || existing) return;
    const inQueue = queue.find((q) => q.patient === initialPatient);
    if (inQueue && !initialDoctor) setDoctor(inQueue.doctor);
  }, [initialPatient]);

  // Suggestions: queue patients first, then all patients
  const patientSuggestions = useMemo(() => {
    const needle = patientQ.trim().toLowerCase();
    const queueNames = Array.from(new Set(queue.map((q) => q.patient)));
    const patientNames = patients.map((p) => p.fullName);
    const all = Array.from(new Set([...queueNames, ...patientNames]));
    if (!needle) return all.slice(0, 15);
    return all.filter((n) => n.toLowerCase().includes(needle)).slice(0, 15);
  }, [patientQ, queue, patients]);

  function pickPatient(name: string) {
    setPatient(name);
    setPatientQ(name);
    const inQueue = queue.find((q) => q.patient === name);
    if (inQueue) {
      setDoctor(inQueue.doctor);
      const added = new Date(inQueue.addedAt);
      setDate(`${added.getFullYear()}-${String(added.getMonth() + 1).padStart(2, '0')}-${String(added.getDate()).padStart(2, '0')}`);
    }
  }

  // Step 2: complaints + diagnosis (003 form)
  const [complaints, setComplaints] = useState(existing?.complaints ?? '');
  const [diagnosis, setDiagnosis] = useState(existing?.diagnosis ?? '');

  // Step 3: selected services (pre-select by name)
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(() => {
    if (!existing?.services?.length) return [];
    const nameSet = new Set(existing.services);
    return services.filter((s) => nameSet.has(s.name)).map((s) => s.id);
  });
  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  const selectedServices = useMemo(
    () => services.filter((s) => selectedServiceIds.includes(s.id) && !s.archived),
    [services, selectedServiceIds],
  );
  const totalAmount = useMemo(
    () => selectedServices.reduce((sum, s) => sum + (s.somValue ?? s.price), 0),
    [selectedServices],
  );
  const serviceCategoryMap = useMemo(() => {
    const m = new Map<string, string>();
    categories.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [categories]);
  const servicesByCategory = useMemo(() => {
    const groups = new Map<string, typeof services>();
    services.filter((s) => !s.archived).forEach((s) => {
      const key = s.categoryId;
      if (!groups.has(key)) groups.set(key, [] as typeof services);
      groups.get(key)!.push(s);
    });
    return Array.from(groups.entries());
  }, [services]);

  // Step 4: plans + advice + tech order
  const [examPlan, setExamPlan] = useState(existing?.examPlan ?? '');
  const [treatmentPlan, setTreatmentPlan] = useState(existing?.treatmentPlan ?? '');
  const [advice, setAdvice] = useState(existing?.advice ?? '');
  const [doctorNote, setDoctorNote] = useState(existing?.doctorNote ?? '');
  const [techEnabled, setTechEnabled] = useState(existing?.techOrderEnabled ?? false);
  const [techItems, setTechItems] = useState<TechOrderItem[]>(existing?.techOrderItems ?? []);

  // Step 5: 003 form extras
  const [admissionTime, setAdmissionTime] = useState(existing?.admissionTime ?? '');
  const [dischargeDate, setDischargeDate] = useState(existing?.dischargeDate ?? '');
  const [dischargeTime, setDischargeTime] = useState(existing?.dischargeTime ?? '');
  const [department, setDepartment] = useState(existing?.department ?? 'Stomatologiya');
  const [roomNo, setRoomNo] = useState(existing?.roomNo ?? '');
  const [stayDays, setStayDays] = useState(existing?.stayDays ?? '');
  const [bloodGroup, setBloodGroup] = useState(existing?.bloodGroup ?? '');
  const [rh, setRh] = useState(existing?.rh ?? '');
  const [drugAllergy, setDrugAllergy] = useState(existing?.drugAllergy ?? '');
  const [height, setHeight] = useState(existing?.height ?? '');
  const [weight, setWeight] = useState(existing?.weight ?? '');
  const [temperature, setTemperature] = useState(existing?.temperature ?? '');
  const [workplace, setWorkplace] = useState(existing?.workplace ?? '');
  const [transport, setTransport] = useState(existing?.transport ?? '');
  const [timeSinceOnset, setTimeSinceOnset] = useState(existing?.timeSinceOnset ?? '');
  const [complication, setComplication] = useState(existing?.complication ?? '');
  const [comorbidity, setComorbidity] = useState(existing?.comorbidity ?? '');
  const [admissionCount, setAdmissionCount] = useState<'first' | 'repeat'>(existing?.admissionCount ?? 'first');
  const [totalAdmissions, setTotalAdmissions] = useState(existing?.totalAdmissions ?? '1');
  const [anesthesia, setAnesthesia] = useState(existing?.anesthesia ?? '');
  const [sickLeave, setSickLeave] = useState(existing?.sickLeave ?? '');
  const [treatmentResult, setTreatmentResult] = useState(existing?.treatmentResult ?? '');
  const [workCapacity, setWorkCapacity] = useState(existing?.workCapacity ?? '');
  const [expertiseConclusion, setExpertiseConclusion] = useState(existing?.expertiseConclusion ?? '');
  const [specialMarks, setSpecialMarks] = useState(existing?.specialMarks ?? '');
  const [admissionTests, setAdmissionTests] = useState<AdmissionTests>(existing?.admissionTests ?? {});
  const [headOfDepartment, setHeadOfDepartment] = useState(existing?.headOfDepartment ?? '');
  const [receptionNote, setReceptionNote] = useState(existing?.receptionNote ?? '');
  const [pathologyConclusion, setPathologyConclusion] = useState(existing?.pathologyConclusion ?? '');
  const [pathDxMain, setPathDxMain] = useState(existing?.pathDxMain ?? '');
  const [pathDxComplication, setPathDxComplication] = useState(existing?.pathDxComplication ?? '');
  const [pathDxComorbid, setPathDxComorbid] = useState(existing?.pathDxComorbid ?? '');
  const [pathologistName, setPathologistName] = useState(existing?.pathologistName ?? '');
  const [status, setStatus] = useState<TreatmentStatus>(existing?.status ?? 'rejalashtirildi');

  const isLocked = existing?.status === 'yakunlandi';

  function toggleTechItem(name: string) {
    setTechItems((prev) => {
      const found = prev.find((p) => p.name === name);
      if (found) return prev.filter((p) => p.name !== name);
      return [...prev, { name, qty: 1 }];
    });
  }
  function updateTechItem(name: string, patch: Partial<TechOrderItem>) {
    setTechItems((prev) => prev.map((p) => (p.name === name ? { ...p, ...patch } : p)));
  }
  const techProductPrice = useMemo(() => {
    const m = new Map<string, number>();
    techProducts.forEach((p) => m.set(p.name, p.salePrice));
    return m;
  }, [techProducts]);
  const techOrderTotal = useMemo(
    () => techItems.reduce((s, it) => s + it.qty * (techProductPrice.get(it.name) ?? 0), 0),
    [techItems, techProductPrice],
  );

  // Doctor list for the dropdown when queue doesn't provide one
  const doctorEmployees = useMemo(
    () => employees.filter((e) => e.category === 'medical' && !e.archived),
    [employees],
  );

  // Guards
  const canNext1 = patient.trim().length > 0 && doctor.trim().length > 0 && date.length === 10;
  const canNext2 = diagnosis.trim().length > 0;
  const canNext3 = selectedServices.length > 0;

  function handleSave() {
    const serviceNames = selectedServices.map((s) => s.name);
    // Bemorni ismi bo'yicha topamiz — UUID va jshshir kartaga biriktiriladi
    const selectedPatient = patients.find((p) => p.fullName === patient);
    const normalizeJshshir = (v?: string) => (v ?? '').replace(/\s+/g, '').toUpperCase();
    const payload = {
      patient,
      patientId: selectedPatient?.id ?? existing?.patientId,
      patientJshshir: normalizeJshshir(selectedPatient?.jshshir) || existing?.patientJshshir,
      diagnosis,
      service: serviceNames[0],
      services: serviceNames,
      amount: totalAmount,
      complaints,
      methods: treatmentPlan,
      advice,
      examPlan,
      treatmentPlan,
      doctorNote,
      techOrderEnabled: techEnabled,
      techOrderItems: techEnabled ? techItems : [],
      doctor,
      date,
      admissionTime,
      dischargeDate,
      dischargeTime,
      department,
      roomNo,
      stayDays,
      bloodGroup,
      rh,
      drugAllergy,
      height,
      weight,
      temperature,
      workplace,
      transport,
      timeSinceOnset,
      complication,
      comorbidity,
      admissionCount,
      totalAdmissions,
      anesthesia,
      sickLeave,
      treatmentResult,
      workCapacity,
      expertiseConclusion,
      specialMarks,
      admissionTests,
      headOfDepartment,
      receptionNote,
      pathologyConclusion,
      pathDxMain,
      pathDxComplication,
      pathDxComorbid,
      pathologistName,
    };
    if (existing) {
      if (isLocked) { onClose(); return; }
      updateTreatment(existing.id, { ...payload, status });
    } else {
      addTreatment({ ...payload, status });
    }
    onSaved?.({ patient, doctor, status });
    onClose();
  }

  // Close on Esc
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="appt-modal-backdrop" onClick={onClose}>
      <div className="tw-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tw-head">
          <h2>{existing ? (isLocked ? 'Davolash (yakunlangan — tahrirlab bo\'lmaydi)' : 'Davolashni tahrirlash') : 'Yangi davolash'}</h2>
          <button className="admin-icon-btn sm" onClick={onClose} aria-label="Yopish"><X size={16} /></button>
        </div>

        <ol className="tw-steps tw-steps-5">
          {[
            { n: 1, t: 'Bemor va sana' },
            { n: 2, t: 'Shikoyat va tashxis' },
            { n: 3, t: 'Xizmatlar' },
            { n: 4, t: 'Reja va maslahatlar' },
            { n: 5, t: '003 forma — qo\'shimcha' },
          ].map((s) => (
            <li
              key={s.n}
              className={'tw-step' + (step === (s.n as Step) ? ' is-active' : '') + (step > s.n ? ' is-done' : '')}
            >
              <span className="tw-step-num">{step > s.n ? <Check size={13} /> : s.n}</span>
              <span className="tw-step-title">{s.t}</span>
            </li>
          ))}
        </ol>

        <div className="tw-body">
          {isLocked && (
            <div className="tw-locked-banner">
              Ushbu davolashning holati <strong>«Yakunlandi»</strong>. Ma'lumotlar faqat ko'rish uchun — tahrirlab bo'lmaydi.
            </div>
          )}
          <fieldset disabled={isLocked} style={{ border: 0, padding: 0, margin: 0 }}>
          {step === 1 && (
            <div className="tw-pane">
              <h3>1-qadam: Bemor va sana</h3>
              <div className="tw-patient-search">
                <Search size={14} />
                <input
                  type="text"
                  placeholder="Bemor nomini kiriting — navbatdagi yoki ro'yxatdagi..."
                  value={patientQ}
                  onChange={(e) => { setPatientQ(e.target.value); setPatient(''); }}
                />
                {patient !== patientQ && patientSuggestions.length > 0 && (
                  <ul className="tw-suggest">
                    {patientSuggestions.map((n) => {
                      const inQ = queue.some((q) => q.patient === n);
                      return (
                        <li key={n} onClick={() => pickPatient(n)}>
                          <span>{n}</span>
                          {inQ && <small className="tw-badge-queue">navbatda</small>}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="appt-modal-row">
                <label className="tw-label">
                  <span>Shifokor {queue.some((q) => q.patient === patient) && <small className="tw-auto">(avtomatik)</small>}</span>
                  <select value={doctor} onChange={(e) => setDoctor(e.target.value)}>
                    <option value="">— tanlang —</option>
                    {doctorEmployees.map((e) => (
                      <option key={e.id} value={e.fullName}>{e.fullName}{e.position ? ` — ${e.position}` : ''}</option>
                    ))}
                  </select>
                </label>
                <label className="tw-label">
                  <span>Sana</span>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </label>
              </div>
              {patient && queue.some((q) => q.patient === patient) && (
                <div className="tw-hint-ok">
                  Bemor navbatda topildi — shifokor va sana avtomatik to'ldirildi.
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="tw-pane">
              <h3>2-qadam: Shikoyat va tashxis</h3>
              <small className="tw-form-ref">003 forma — bemorning tibbiy baënnomasi uchun</small>
              <label className="tw-label">
                <span>Bemor shikoyati</span>
                <textarea
                  rows={4}
                  value={complaints}
                  onChange={(e) => setComplaints(e.target.value)}
                  placeholder="Bemor nimadan shikoyat qilayotganini batafsil yozing..."
                />
              </label>
              <label className="tw-label">
                <span>Shifokor tashxisi <strong style={{ color: '#ff3c00' }}>*</strong></span>
                <textarea
                  rows={4}
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="Qo'yilgan tashxisni yozing..."
                />
              </label>
            </div>
          )}

          {step === 3 && (
            <div className="tw-pane">
              <h3>3-qadam: Xizmatlar</h3>
              <small className="tw-form-ref">Klinikadagi barcha xizmatlar — keraklisini belgilang</small>
              <div className="tw-services">
                {servicesByCategory.length === 0 && (
                  <div className="tw-empty">Xizmatlar ro'yxati bo'sh.</div>
                )}
                {servicesByCategory.map(([catId, items]) => (
                  <div key={catId} className="tw-service-group">
                    <h4>{serviceCategoryMap.get(catId) ?? 'Umumiy'}</h4>
                    <div className="tw-service-grid">
                      {items.map((s) => {
                        const active = selectedServiceIds.includes(s.id);
                        return (
                          <button
                            key={s.id}
                            type="button"
                            className={'tw-service-item' + (active ? ' is-active' : '')}
                            onClick={() => toggleService(s.id)}
                          >
                            <div className="tw-service-name">{s.name}</div>
                            <div className="tw-service-price">{formatSom(s.somValue ?? s.price)}</div>
                            {active && <Check size={14} className="tw-service-check" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              {selectedServices.length > 0 && (
                <div className="tw-selected-summary">
                  Tanlangan: <strong>{selectedServices.length} ta xizmat</strong> · Jami: <strong>{formatSom(totalAmount)}</strong>
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="tw-pane">
              <h3>4-qadam: Reja va maslahatlar</h3>
              <label className="tw-label">
                <span>Tekshirish rejasi</span>
                <textarea rows={3} value={examPlan} onChange={(e) => setExamPlan(e.target.value)}
                  placeholder="Qanday tekshirishlar o'tkaziladi..." />
              </label>
              <label className="tw-label">
                <span>Davolash rejasi</span>
                <textarea rows={3} value={treatmentPlan} onChange={(e) => setTreatmentPlan(e.target.value)}
                  placeholder="Davolash bosqichlari..." />
              </label>
              <label className="tw-label">
                <span>Maslahatlar</span>
                <textarea rows={3} value={advice} onChange={(e) => setAdvice(e.target.value)}
                  placeholder="Bemorga tavsiyalar..." />
              </label>
              <label className="tw-label">
                <span>Shifokor izohi</span>
                <input type="text" value={doctorNote} onChange={(e) => setDoctorNote(e.target.value)}
                  placeholder="Qisqa izoh..." />
              </label>

              <div className="tw-card">
                <div className="tw-card-head">
                  <div>
                    <strong>Texnik buyurtma</strong>
                    <small>Zarur asbob/mahsulotlarni belgilang</small>
                  </div>
                  <label className="tw-switch">
                    <input type="checkbox" checked={techEnabled} onChange={(e) => setTechEnabled(e.target.checked)} />
                    <span />
                  </label>
                </div>
                {techEnabled && (
                  <>
                    {techProducts.length === 0 ? (
                      <div className="tw-empty">«Texnik buyurtma» sahifasidan avval mahsulot qo'shing.</div>
                    ) : (
                      <div className="tw-tech-list">
                        {techProducts.map((p) => {
                          const sel = techItems.find((t) => t.name === p.name);
                          const lineTotal = sel ? sel.qty * p.salePrice : 0;
                          return (
                            <div key={p.id} className={'tw-tech-item tw-tech-item-wide' + (sel ? ' is-active' : '')}>
                              <label className="tw-tech-check">
                                <input type="checkbox" checked={!!sel} onChange={() => toggleTechItem(p.name)} />
                                <span>
                                  {p.name}
                                  <small className="tw-tech-price"> — {formatSom(p.salePrice)}</small>
                                </span>
                              </label>
                              {sel && (
                                <>
                                  <input
                                    type="number"
                                    min={1}
                                    value={sel.qty}
                                    onChange={(e) => updateTechItem(p.name, { qty: Math.max(1, Number(e.target.value) || 1) })}
                                    className="tw-tech-qty"
                                  />
                                  <div className="tw-tech-line-total">{formatSom(lineTotal)}</div>
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {techItems.length > 0 && (
                      <div className="tw-selected-summary">
                        Texnik buyurtma jami: <strong>{formatSom(techOrderTotal)}</strong>
                      </div>
                    )}
                  </>
                )}
              </div>

            </div>
          )}

          {step === 5 && (
            <div className="tw-pane">
              <h3>5-qadam: 003 forma — qo'shimcha ma'lumotlar</h3>
              <small className="tw-form-ref">Hujjat shabloniga avtomatik yoziladi</small>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Kasalxona ma'lumotlari</strong></div>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Yotqizilgan vaqti</span>
                    <input type="time" value={admissionTime} onChange={(e) => setAdmissionTime(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Chiqarilgan sana</span>
                    <input type="date" value={dischargeDate} onChange={(e) => setDischargeDate(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Chiqarilgan vaqti</span>
                    <input type="time" value={dischargeTime} onChange={(e) => setDischargeTime(e.target.value)} />
                  </label>
                </div>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Bo'lim</span>
                    <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Xona №</span>
                    <input type="text" value={roomNo} onChange={(e) => setRoomNo(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Kun ётib davolangan</span>
                    <input type="number" min={0} value={stayDays} onChange={(e) => setStayDays(e.target.value)} />
                  </label>
                </div>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Sog'liq ma'lumotlari</strong></div>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Qon guruhi</span>
                    <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}>
                      <option value="">—</option>
                      <option>I (O)</option><option>II (A)</option><option>III (B)</option><option>IV (AB)</option>
                    </select>
                  </label>
                  <label className="tw-label"><span>Rezus</span>
                    <select value={rh} onChange={(e) => setRh(e.target.value)}>
                      <option value="">—</option>
                      <option>Rh+</option><option>Rh−</option>
                    </select>
                  </label>
                  <label className="tw-label"><span>Harorati (°C)</span>
                    <input type="text" value={temperature} onChange={(e) => setTemperature(e.target.value)} placeholder="36.6" />
                  </label>
                </div>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Bo'yi (sm)</span>
                    <input type="text" value={height} onChange={(e) => setHeight(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Vazni (kg)</span>
                    <input type="text" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </label>
                </div>
                <label className="tw-label"><span>Dorilarning nojo'ya ta'siri</span>
                  <textarea rows={2} value={drugAllergy} onChange={(e) => setDrugAllergy(e.target.value)} placeholder="Dori nomi va ta'siri" />
                </label>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Shaxsiy va kelish ma'lumotlari</strong></div>
                <label className="tw-label"><span>Ish joyi, kasbi, lavozimi</span>
                  <input type="text" value={workplace} onChange={(e) => setWorkplace(e.target.value)} />
                </label>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Qanday transportda</span>
                    <input type="text" value={transport} onChange={(e) => setTransport(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Kasallik boshlangandan o'tgan vaqt</span>
                    <input type="text" value={timeSinceOnset} onChange={(e) => setTimeSinceOnset(e.target.value)} placeholder="3 kun / 2 hafta" />
                  </label>
                </div>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Tashxis to'ldirmalari (12. b, v)</strong></div>
                <label className="tw-label"><span>Asosiy kasallikning asorati</span>
                  <textarea rows={2} value={complication} onChange={(e) => setComplication(e.target.value)} />
                </label>
                <label className="tw-label"><span>Aniqlangan hamroh kasalliklar</span>
                  <textarea rows={2} value={comorbidity} onChange={(e) => setComorbidity(e.target.value)} />
                </label>
                <div className="appt-modal-row">
                  <label className="tw-label"><span>Ketish turi</span>
                    <select value={admissionCount} onChange={(e) => setAdmissionCount(e.target.value as 'first' | 'repeat')}>
                      <option value="first">Birinchi marta</option>
                      <option value="repeat">Qayta</option>
                    </select>
                  </label>
                  <label className="tw-label"><span>Jami marta</span>
                    <input type="number" min={1} value={totalAdmissions} onChange={(e) => setTotalAdmissions(e.target.value)} />
                  </label>
                  <label className="tw-label"><span>Og'riqsizlantirish usuli</span>
                    <input type="text" value={anesthesia} onChange={(e) => setAnesthesia(e.target.value)} placeholder="Mahalliy / umumiy" />
                  </label>
                </div>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Natija va xulosa (17-20)</strong></div>
                <label className="tw-label"><span>Davolash natijasi</span>
                  <select value={treatmentResult} onChange={(e) => setTreatmentResult(e.target.value)}>
                    <option value="">—</option>
                    <option>Tuzaldi</option>
                    <option>Bir oz yaxshilandi</option>
                    <option>O'zgarishsiz</option>
                    <option>Og'irlashgan holda</option>
                    <option>Boshqa muassasaga o'tkazildi</option>
                  </select>
                </label>
                <label className="tw-label"><span>Mehnat qobiliyati</span>
                  <select value={workCapacity} onChange={(e) => setWorkCapacity(e.target.value)}>
                    <option value="">—</option>
                    <option>Tiklandi</option>
                    <option>Sustlashdi</option>
                    <option>Vaqtincha yo'qoldi</option>
                    <option>Butunlay yo'qoldi</option>
                    <option>Boshqa sabablarga ko'ra</option>
                  </select>
                </label>
                <label className="tw-label"><span>Mehnatga yaroqsizlik varag'i №</span>
                  <input type="text" value={sickLeave} onChange={(e) => setSickLeave(e.target.value)} />
                </label>
                <label className="tw-label"><span>Ekspertizaga yuborish uchun xulosa</span>
                  <textarea rows={2} value={expertiseConclusion} onChange={(e) => setExpertiseConclusion(e.target.value)} />
                </label>
                <label className="tw-label"><span>Alohida belgilar</span>
                  <textarea rows={2} value={specialMarks} onChange={(e) => setSpecialMarks(e.target.value)} />
                </label>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>21. Qabul qilinganda tekshirildi</strong></div>
                <div className="tw-checks-grid">
                  {([
                    ['rw', 'Qon (RW, OITS va boshqa)'],
                    ['feces', 'Axlat posevi'],
                    ['pediculosis', 'Pedikulyoz'],
                    ['oits', 'Mavhum kasalliklar'],
                  ] as const).map(([key, lbl]) => (
                    <label key={key} className="tw-tech-check">
                      <input
                        type="checkbox"
                        checked={!!admissionTests[key]}
                        onChange={(e) => setAdmissionTests({ ...admissionTests, [key]: e.target.checked })}
                      />
                      <span>{lbl}</span>
                    </label>
                  ))}
                </div>
                <label className="tw-label"><span>Boshqa / izoh</span>
                  <input type="text" value={admissionTests.other ?? ''} onChange={(e) => setAdmissionTests({ ...admissionTests, other: e.target.value })} />
                </label>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Xodimlar va yozuvlar</strong></div>
                <label className="tw-label"><span>Bo'lim mudiri (F.I.O.)</span>
                  <input type="text" value={headOfDepartment} onChange={(e) => setHeadOfDepartment(e.target.value)} />
                </label>
                <label className="tw-label"><span>Qabulxona shifokorining yozuvi</span>
                  <textarea rows={3} value={receptionNote} onChange={(e) => setReceptionNote(e.target.value)} />
                </label>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Patologoanatom xulosasi (ixtiyoriy)</strong></div>
                <label className="tw-label"><span>Xulosa matni</span>
                  <textarea rows={3} value={pathologyConclusion} onChange={(e) => setPathologyConclusion(e.target.value)} />
                </label>
                <label className="tw-label"><span>a) Asosiy tashxis</span>
                  <input type="text" value={pathDxMain} onChange={(e) => setPathDxMain(e.target.value)} />
                </label>
                <label className="tw-label"><span>b) Asosiy kasallik asorati</span>
                  <input type="text" value={pathDxComplication} onChange={(e) => setPathDxComplication(e.target.value)} />
                </label>
                <label className="tw-label"><span>v) Yo'ldosh kasalliklar</span>
                  <input type="text" value={pathDxComorbid} onChange={(e) => setPathDxComorbid(e.target.value)} />
                </label>
                <label className="tw-label"><span>Patolog shifokor (F.I.O.)</span>
                  <input type="text" value={pathologistName} onChange={(e) => setPathologistName(e.target.value)} />
                </label>
              </div>

              <div className="tw-card">
                <div className="tw-card-head"><strong>Davolash holati</strong></div>
                <div className="tw-status-row">
                  {(['rejalashtirildi', 'davolanmoqda', 'yakunlandi'] as TreatmentStatus[]).map((s) => (
                    <label
                      key={s}
                      className={'tw-status-opt tw-status-' + s + (status === s ? ' is-active' : '')}
                    >
                      <input
                        type="radio"
                        name="treatment-status"
                        value={s}
                        checked={status === s}
                        onChange={() => setStatus(s)}
                      />
                      <span>{s === 'rejalashtirildi' ? 'Rejalashtirildi' : s === 'davolanmoqda' ? 'Davolanmoqda' : 'Yakunlandi'}</span>
                    </label>
                  ))}
                </div>
                {status === 'yakunlandi' && (
                  <div className="tw-status-warn">
                    Diqqat: holat <strong>«Yakunlandi»</strong> deb belgilansa, saqlangandan keyin bu davolashni tahrirlab bo'lmaydi.
                  </div>
                )}
              </div>

              <div className="tw-card tw-summary">
                <div className="tw-card-head"><strong>Saqlashdan oldin tekshiruv</strong></div>
                <div className="tw-summary-grid">
                  <div><small>Bemor</small><strong>{patient || '—'}</strong></div>
                  <div><small>Shifokor</small><strong>{doctor || '—'}</strong></div>
                  <div><small>Sana</small><strong>{date}</strong></div>
                  <div><small>Tashxis</small><strong>{diagnosis || '—'}</strong></div>
                  <div><small>Bo'lim · xona</small><strong>{department || '—'} · {roomNo || '—'}</strong></div>
                  <div><small>Qon guruhi · Rh</small><strong>{bloodGroup || '—'} · {rh || '—'}</strong></div>
                  <div><small>Natija</small><strong>{treatmentResult || '—'}</strong></div>
                  <div><small>Holat</small><strong>{status}</strong></div>
                </div>
                <div className="tw-summary-services">
                  <small>Yo'naltirilgan xizmatlar:</small>
                  {selectedServices.length === 0 ? (
                    <div className="tw-empty">Xizmat tanlanmagan.</div>
                  ) : (
                    <ul>
                      {selectedServices.map((s) => (
                        <li key={s.id}>
                          <span>{s.name}</span>
                          <strong>{formatSom(s.somValue ?? s.price)}</strong>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {techEnabled && techItems.length > 0 && (
                  <div className="tw-summary-services">
                    <small>Texnik buyurtma:</small>
                    <ul>
                      {techItems.map((it) => (
                        <li key={it.name}>
                          <span>{it.name} × {it.qty}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="tw-summary-total">
                  <span>Jami summa</span>
                  <strong>{formatSom(totalAmount)}</strong>
                </div>
              </div>
            </div>
          )}
          </fieldset>
        </div>

        <div className="tw-foot">
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            disabled={step === 1}
            onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))}
          >
            <ChevronLeft size={15} /> Orqaga
          </button>
          {step < 5 ? (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              disabled={
                (step === 1 && !canNext1) ||
                (step === 2 && !canNext2) ||
                (step === 3 && !canNext3)
              }
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              Davom etish <ChevronRight size={15} />
            </button>
          ) : isLocked ? (
            <button type="button" className="admin-btn admin-btn-ghost" onClick={onClose}>Yopish</button>
          ) : (
            <button
              type="button"
              className="admin-btn admin-btn-primary"
              onClick={handleSave}
              disabled={selectedServices.length === 0}
            >
              <Save size={15} /> Saqlash
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

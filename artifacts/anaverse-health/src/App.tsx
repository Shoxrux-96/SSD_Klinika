import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  EyeOff,
  HeartPulse,
  Hospital,
  Instagram,
  Lock,
  LogIn,
  Mail,
  MapPin,
  Menu,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
  User,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Facebook, Globe, Youtube } from 'lucide-react';
import { useAuth } from './auth/AuthContext';
import { ClinicMap } from './ClinicMap';
import { SkeletonModel } from './SkeletonModel';
import { addAppointment, addPatient, useAssignments, useEmployees, useServices } from './admin/store';
import { useContactSettings, telHref, type SocialPlatform } from './contactSettings';

const SOCIAL_ICON: Record<SocialPlatform, typeof Instagram> = {
  telegram: Send,
  instagram: Instagram,
  facebook: Facebook,
  youtube: Youtube,
  tiktok: Globe,
  website: Globe,
  other: Globe,
};

const services = [
  { key: 'yurak', title: 'Yurak salomatligi', description: 'Yurak va qon tomirlar diagnostikasi', image: 'organ-heart.jpg' },
  { key: 'opka', title: 'O‘pka va nafas', description: 'Nafas yo‘llari va o‘pka parvarishi', image: 'organ-lungs.jpg' },
  { key: 'jigar', title: 'Jigar salomatligi', description: 'Jigar va hazm tizimi tekshiruvlari', image: 'organ-liver.jpg' },
  { key: 'tomoq', title: 'Tomoq va LOR', description: 'Quloq, burun va tomoq mutaxassislari', image: 'organ-throat.jpg' },
  { key: 'oyoq', title: 'Oyoq va bo‘g‘imlar', description: 'Harakat va bo‘g‘imlar salomatligi', image: 'organ-leg.jpg' },
  { key: 'umurtqa', title: 'Umurtqa va bel', description: 'Umurtqa pog‘onasi diagnostikasi', image: 'organ-spine.jpg' },
  { key: 'miya', title: 'Miya va asab tizimi', description: 'Nevrologik maslahat va tekshiruvlar', image: 'organ-brain.jpg' },
  { key: 'qol', title: 'Qo‘l va bilak', description: 'Qo‘l, bilak va paylar davolash', image: 'organ-hand.jpg' },
  { key: 'tana', title: 'Ichki a’zolar', description: 'Organizmni kompleks tekshirish', image: 'organ-body.jpg' },
];

const navLinks = [
  ['Biz haqimizda', '#about'],
  ['Xizmatlar', '#services'],
  ['Shifokorlar', '#doctors'],
  ['Imkoniyatlar', '#facilities'],
  ['Qabulxona', '#appointment'],
  ['Aloqa', '#contact'],
];

function DoctorCarousel() {
  const employees = useEmployees();
  const assignments = useAssignments();
  const services = useServices();
  const doctors = useMemo(() => {
    const assignedIds = new Set(assignments.map((a) => a.employeeId));
    return employees.filter(
      (e) => !e.archived && e.category === 'medical' && assignedIds.has(e.id),
    );
  }, [employees, assignments]);
  const servicesFor = (empId: string) => {
    const ids = new Set(
      assignments.filter((a) => a.employeeId === empId).map((a) => a.serviceId),
    );
    return services.filter((s) => !s.archived && ids.has(s.id));
  };
  const [page, setPage] = useState(0);
  const perPage = 3;
  const totalPages = Math.max(1, Math.ceil(doctors.length / perPage));
  const safePage = Math.min(page, totalPages - 1);
  const hasCarousel = doctors.length > perPage;

  useEffect(() => {
    if (!hasCarousel) return;
    const id = window.setInterval(() => {
      setPage((p) => (p + 1) % totalPages);
    }, 5000);
    return () => window.clearInterval(id);
  }, [hasCarousel, totalPages]);

  if (doctors.length === 0) {
    return <div className="doctor-grid-empty">Xizmat biriktirilgan shifokor mavjud emas.</div>;
  }

  return (
    <div className={`doctor-carousel${hasCarousel ? ' has-nav' : ''}`}>
      {hasCarousel && (
        <button
          type="button"
          className="doctor-nav prev"
          aria-label="Oldingi"
          onClick={() => setPage((p) => (p - 1 + totalPages) % totalPages)}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div className="doctor-viewport">
        <div
          className="doctor-track"
          style={{
            width: `${totalPages * 100}%`,
            transform: `translateX(-${safePage * (100 / totalPages)}%)`,
          }}
        >
          {Array.from({ length: totalPages }).map((_, p) => {
            const slice = doctors.slice(p * perPage, p * perPage + perPage);
            return (
              <div key={p} className="doctor-slide" style={{ width: `${100 / totalPages}%` }}>
                <div className="doctor-grid">
                  {slice.map((d) => (
                    <article className="doctor-card" key={d.id}>
                      <img
                        src={d.photo || '/assets/doctor-default.jpg'}
                        alt={`${d.fullName}, shifokor`}
                      />
                      <div className="doctor-card-copy">
                        <strong>{d.fullName}</strong>
                        <span>{d.position}{d.specialty ? `, ${d.specialty}` : ''}</span>
                        {(() => {
                          const svcs = servicesFor(d.id);
                          if (svcs.length === 0) return null;
                          return (
                            <div className="doctor-services-wrap">
                              <button type="button" className="doctor-services-btn">Xizmatlar ({svcs.length})</button>
                              <div className="doctor-services-pop">
                                <strong>Biriktirilgan xizmatlar</strong>
                                <ul>
                                  {svcs.map((s) => <li key={s.id}>{s.name}</li>)}
                                </ul>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {hasCarousel && (
        <button
          type="button"
          className="doctor-nav next"
          aria-label="Keyingi"
          onClick={() => setPage((p) => (p + 1) % totalPages)}
        >
          <ChevronRight size={20} />
        </button>
      )}
      {hasCarousel && (
        <div className="doctor-dots">
          {Array.from({ length: totalPages }).map((_, i) => (
            <button
              key={i}
              type="button"
              className={`doctor-dot${i === safePage ? ' active' : ''}`}
              onClick={() => setPage(i)}
              aria-label={`${i + 1}-sahifa`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="SSD Klinika bosh sahifasi">
      <span className="brand-mark"><Hospital size={21} strokeWidth={2.4} /></span>
      <span className="brand-name"><strong>SSD KLINIKA</strong><small>SIRIUS STOMA DENT DIAGNOSTIKA MARKAZI</small></span>
    </a>
  );
}

const anatomyItems = [
  { id: 'miya', label: 'Miya', image: '/assets/organ-brain.jpg', detail: 'Miya va asab tizimi', note: 'Nevrologik tekshiruv va asab tizimi salomatligi bo‘yicha ko‘rik.', position: 'tooth' },
  { id: 'yurak', label: 'Yurak', image: '/assets/organ-heart.jpg', detail: 'Yurak faoliyati', note: 'Yurak-qon tomir salomatligi bo‘yicha mutaxassis ko‘rigi.', position: 'heart' },
  { id: 'opka', label: 'O‘pka', image: '/assets/organ-lungs.jpg', detail: 'Nafas tizimi', note: 'Nafas olish va o‘pka salomatligi bo‘yicha ko‘rik.', position: 'lungs' },
  { id: 'jigar', label: 'Jigar', image: '/assets/organ-liver.jpg', detail: 'Jigar va hazm', note: 'Jigar funksiyasi va hazm tizimi salomatligi.', position: 'ekg' },
  { id: 'oshqozon', label: 'Oshqozon', image: '/assets/organ-body.jpg', detail: 'Oshqozon-ichak', note: 'Oshqozon va ichak tizimi tekshiruvi.', position: 'lab' },
  { id: 'umurtqa', label: 'Umurtqa', image: '/assets/organ-spine.jpg', detail: 'Umurtqa pog‘onasi', note: 'Umurtqa va bo‘g‘imlar salomatligi bo‘yicha ko‘rik.', position: 'xray' },
];

function AnatomyExperience() {
  const [active, setActive] = useState(anatomyItems[1]);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      setActive((cur) => {
        const i = anatomyItems.findIndex((it) => it.id === cur.id);
        return anatomyItems[(i + 1) % anatomyItems.length];
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [paused]);
  const pick = (item: typeof anatomyItems[number]) => {
    setActive(item);
    setPaused(true);
    window.setTimeout(() => setPaused(false), 15000);
  };
  return (
    <div className="anatomy-experience" data-testid="anatomy-experience">
      <div className="anatomy-scene" aria-label="Interaktiv anatomiya tasviri">
        <div className="scene-orbit orbit-one" aria-hidden="true" />
        <div className="scene-orbit orbit-two" aria-hidden="true" />
        <div className="scene-caption"><span className="scene-live-dot" /> ANATOMIYA / 01</div>
        <img className="anatomy-body" src="/assets/anatomy-hero.png" alt="Inson tanasining ichki a’zolari ko‘rsatilgan anatomik tasvir" data-testid="img-anatomy-body" />
        {anatomyItems.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`anatomy-node node-${item.position}${active.id === item.id ? ' is-active' : ''}`}
            onClick={() => pick(item)}
            aria-label={`${item.label} bo‘yicha ma’lumotni ko‘rsatish`}
            aria-pressed={active.id === item.id}
            data-testid={`button-anatomy-${item.id}`}
          >
            <img src={item.image} alt="" />
            <span>{item.label}</span>
          </button>
        ))}
        <div className="scene-coordinate" aria-hidden="true">41°18′ N<br />69°16′ E</div>
      </div>
      <div className="anatomy-detail" aria-live="polite" data-testid="panel-anatomy-detail">
        <div className="detail-index">TANLANGAN YO‘NALISH <span>0{anatomyItems.findIndex((item) => item.id === active.id) + 1} / 06</span></div>
        <div className="detail-content">
          <span className="detail-marker" aria-hidden="true" />
          <div><strong>{active.detail}</strong><p>{active.note}</p></div>
        </div>
        <small>Ma’lumot tanishtiruv uchun. Tashxis o‘rnini bosmaydi.</small>
      </div>
      <div className="scene-legend" aria-label="Anatomiya yo‘nalishlari">
        {anatomyItems.map((item) => (
          <button key={item.id} type="button" onClick={() => pick(item)} aria-pressed={active.id === item.id} data-testid={`button-select-${item.id}`}>
            <span className="legend-mark" />{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const navigate = useNavigate();

  const employees = useEmployees();
  const servicesAll = useServices();
  const assignmentsAll = useAssignments();

  const publicDoctors = useMemo(() => {
    const assigned = new Set(assignmentsAll.map((a) => a.employeeId));
    return employees.filter((e) => !e.archived && e.category === 'medical' && assigned.has(e.id));
  }, [employees, assignmentsAll]);

  const [apptName, setApptName] = useState('');
  const [apptPhone, setApptPhone] = useState('');
  const [apptDoctor, setApptDoctor] = useState('');
  const [apptService, setApptService] = useState('');

  const apptAvailableServices = useMemo(() => {
    const emp = publicDoctors.find((e) => e.id === apptDoctor);
    if (!emp) return [];
    const ids = new Set(
      assignmentsAll.filter((a) => a.employeeId === emp.id).map((a) => a.serviceId),
    );
    return servicesAll.filter((s) => !s.archived && ids.has(s.id));
  }, [apptDoctor, publicDoctors, assignmentsAll, servicesAll]);

  useEffect(() => {
    if (apptAvailableServices.length === 0) {
      setApptService('');
    } else if (!apptAvailableServices.some((s) => s.id === apptService)) {
      setApptService(apptAvailableServices[0].id);
    }
  }, [apptAvailableServices, apptService]);

  const nextSlotToday = () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const totalMin = now.getHours() * 60 + now.getMinutes();
    let slot = Math.ceil(totalMin / 30) * 30;
    if (slot < 9 * 60) slot = 9 * 60;
    if (slot >= 23 * 60) {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      return {
        date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`,
        time: '09:00',
      };
    }
    const h = Math.floor(slot / 60);
    const mm = slot % 60;
    return { date: `${y}-${m}-${d}`, time: `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const doctor = publicDoctors.find((e) => e.id === apptDoctor);
    const service = apptAvailableServices.find((s) => s.id === apptService);
    if (!doctor || !service || !apptName.trim() || !apptPhone.trim()) return;
    const { date, time } = nextSlotToday();
    addAppointment({
      patient: apptName.trim(),
      date,
      time,
      doctor: doctor.fullName,
      doctorId: doctor.id,
      service: service.name,
      serviceId: service.id,
    });
    addPatient({ fullName: apptName.trim(), phone: apptPhone.trim(), address: '' });
    setSubmitted(true);
    setApptName('');
    setApptPhone('');
    event.currentTarget.reset();
  };

  const { login } = useAuth();
  const [loginBusy, setLoginBusy] = useState(false);
  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = (form.elements.namedItem('username') as HTMLInputElement)?.value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value;
    if (!username || !password) {
      setLoginError('Login va parolni kiriting');
      return;
    }
    if (password.length < 8) {
      setLoginError("Parol kamida 8 ta simvoldan iborat bo'lishi kerak");
      return;
    }
    setLoginError(null); setLoginBusy(true);
    try {
      const u = await login(username, password);
      setLoginOpen(false);
      navigate(u.home ?? '/');
    } catch (e: any) {
      setLoginError(e?.message ?? 'Login yoki parol noto‘g‘ri. Qayta urinib ko‘ring.');
    } finally {
      setLoginBusy(false);
    }
  };

  const closeMenu = () => setMenuOpen(false);
  const selectService = (title: string) => {
    setSelectedService((current) => current === title ? null : title);
  };

  return (
    <div id="top">
      <header className="topbar">
        <div className="site-shell nav-inner">
          <Logo />
          <nav className="nav-links" aria-label="Asosiy navigatsiya">
            {navLinks.map(([label, href]) => <a key={href} href={href} data-testid={`link-nav-${href.slice(1)}`}>{label}</a>)}
          </nav>
          <div className="nav-actions">
            <a className="button button-primary" href="#appointment"><Clock3 size={15} /> Qabulxona</a>
            <button className="button button-login" type="button" onClick={() => setLoginOpen(true)} aria-haspopup="dialog" aria-expanded={loginOpen}>
              <LogIn size={15} /> Kirish
            </button>
            <button className="menu-toggle" aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Mobil navigatsiya">
            {navLinks.map(([label, href]) => <a key={href} href={href} onClick={closeMenu} data-testid={`link-mobile-nav-${href.slice(1)}`}>{label}</a>)}
          </nav>
        )}
      </header>

      <main>
        <section className="site-shell hero" aria-labelledby="hero-title">
          <div className="hero-copy reveal">
            <span className="eyebrow"><span className="eyebrow-dot" /> Siz va oilangiz uchun g‘amxo‘rlik</span>
            <h1 id="hero-title">Sog‘lig‘ingiz —<br />bizning <em>e’tiborimiz.</em></h1>
            <p>Sirius Stoma Dent Diagnostika markazi (SSD Klinika) — tajribali mutaxassislar va zamonaviy tibbiyot birlashgan, har bir insonni tinglaydigan shifoxona.</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#services">Xizmatlarni ko‘rish <ArrowRight size={16} /></a>
              <a className="button button-soft" href="#about">Biz haqimizda</a>
            </div>
            <div className="hero-note">
              <div className="avatars" aria-hidden="true"><span className="avatar-dot">A</span><span className="avatar-dot">M</span><span className="avatar-dot">S</span></div>
              <span>Har bir oilaga mehr va e’tibor bilan</span>
            </div>
          </div>
          <div className="hero-visual reveal delay-1">
            <AnatomyExperience />
          </div>
          <div className="hero-fab-stack" aria-label="Tezkor aloqa">
            <a className="hero-fab hero-fab-instagram" href="https://instagram.com/ssd_klinika" target="_blank" rel="noreferrer" aria-label="Instagram: @ssd_klinika">
              <span className="hero-fab-pulse" aria-hidden="true" />
              <span className="hero-fab-pulse hero-fab-pulse-two" aria-hidden="true" />
              <Instagram size={22} />
              <span className="hero-fab-label">@ssd_klinika</span>
            </a>
            <a className="hero-fab hero-fab-telegram" href="https://t.me/ssd_klinika" target="_blank" rel="noreferrer" aria-label="Telegram: @ssd_klinika">
              <span className="hero-fab-pulse" aria-hidden="true" />
              <span className="hero-fab-pulse hero-fab-pulse-two" aria-hidden="true" />
              <Send size={22} />
              <span className="hero-fab-label">@ssd_klinika</span>
            </a>
            <a className="hero-fab hero-fab-phone" href="tel:+998914343735" aria-label="Telefon: +998 91 434 37 35">
              <span className="hero-fab-pulse" aria-hidden="true" />
              <span className="hero-fab-pulse hero-fab-pulse-two" aria-hidden="true" />
              <Phone size={22} />
              <span className="hero-fab-label">+998 91 434 37 35</span>
            </a>
          </div>
        </section>

        <section className="trust-strip trust-strip-full" aria-label="SSD Klinika ko‘rsatkichlari">
          <div className="trust-item"><span className="trust-icon"><Stethoscope size={20} /></span><span><strong>15+</strong><span>yillik tajriba</span></span></div>
          <div className="trust-item"><span className="trust-icon"><HeartPulse size={20} /></span><span><strong>25 000+</strong><span>mamnun bemor</span></span></div>
          <div className="trust-item"><span className="trust-icon"><Hospital size={20} /></span><span><strong>120+</strong><span>tibbiy mutaxassis</span></span></div>
          <div className="trust-item"><span className="trust-icon"><ShieldCheck size={20} /></span><span><strong>98%</strong><span>tavsiya etadi</span></span></div>
        </section>

        <section className="site-shell section about-grid" id="about">
          <div className="about-tooth-stage reveal" aria-hidden="true">
            <div className="about-tooth-glow" />
            <div className="about-tooth-orbit about-tooth-orbit-one" />
            <div className="about-tooth-orbit about-tooth-orbit-two" />
            <div className="about-tooth-sparkle about-tooth-sparkle-1" />
            <div className="about-tooth-sparkle about-tooth-sparkle-2" />
            <div className="about-tooth-sparkle about-tooth-sparkle-3" />
            <img src="/assets/tooth-model.png" alt="3D tish modeli" className="about-tooth-img" />
            <div className="about-image-badge">
              <strong>SSD</strong>
              <span>Sirius Stoma Dent Diagnostika markazi</span>
            </div>
          </div>
          <div className="about-copy reveal delay-1">
            <span className="kicker">Biz haqimizda</span>
            <h2>Soglom tish —<br />yorqin tabassum.</h2>
            <p><strong>SSD Klinika — Sirius Stoma Dent Diagnostika markazi</strong> stomatologiya yo‘nalishi bo‘yicha mutaxassislashgan tibbiy markaz. Klinikamiz asoschisi tish shifokori bo‘lib, biz zamonaviy stomatologik yondashuvni insoniy g‘amxo‘rlik bilan uyg‘unlashtiramiz.</p>
            <div className="about-points">
              <div className="about-point"><span className="check"><Check size={14} /></span>Tajribali tish shifokorlari</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Zamonaviy stomatologik uskunalar</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Og‘riqsiz davolash usullari</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Bolalar va kattalar uchun</div>
            </div>
            <a className="button button-primary" href="#services">Xizmatlarimiz bilan tanishing <ArrowRight size={15} /></a>
          </div>
        </section>

        <section className="service-section" id="services">
          <div className="site-shell section">
            <div className="section-heading">
              <div><span className="kicker">Tibbiy xizmatlar</span><h2>Sog‘liq uchun to‘liq<br />yechimlar bir joyda.</h2></div>
              <p>Har bir yo‘nalishda tajribali mutaxassis va sizga mos tibbiy yondashuv.</p>
            </div>
            <div className="service-grid">
              {services.map((service) => (
                <button className={`service-card${selectedService === service.title ? ' selected' : ''}`} key={service.key} onClick={() => selectService(service.title)} aria-pressed={selectedService === service.title}>
                  <img className="organ-image" src={`/assets/${service.image}`} alt={`${service.title} uchun anatomik tibbiy tasvir`} />
                  <span className="service-info"><strong>{service.title}</strong><span>{service.description}</span></span>
                  <ChevronRight className="service-arrow" size={16} />
                </button>
              ))}
            </div>
            <div className="service-selected-note" aria-live="polite">
              {selectedService ? <>{selectedService} bo‘yicha maslahat kerakmi? <a href="#contact">Biz bilan bog‘laning <ArrowRight size={12} /></a></> : 'Yo‘nalishni tanlang — sizga kerakli mutaxassis haqida ma’lumot beramiz.'}
            </div>
          </div>
        </section>

        <section className="site-shell section doctors-layout" id="doctors">
          <div className="doctors-intro">
            <span className="kicker">Bizning shifokorlar</span>
            <h2>Yaxshi shifokor.<br />Yaxshi suhbat.</h2>
            <p>Bilim va tajriba bilan birga, shifokorlarimiz bemorni diqqat bilan tinglaydi. Chunki yaxshi davolash ishonchli suhbatdan boshlanadi.</p>
            <a className="button button-primary" href="#contact">Mutaxassis bilan bog‘lanish <ArrowRight size={15} /></a>
          </div>
          <DoctorCarousel />
        </section>

        <section className="site-shell section" id="facilities">
          <div className="facility-section">
            <div>
              <span className="kicker">Sharoit va texnologiya</span>
              <h2>Yengilroq kunlar<br />uchun qulay muhit.</h2>
              <p>Har bir detal sizning xotirjamligingiz uchun: zamonaviy uskunalar, ozoda xonalar va mehribon tibbiy jamoa.</p>
              <a className="button button-white" href="#contact">Markazga tashrif <ArrowRight size={15} /></a>
            </div>
            <div className="facility-mosaic">
              <div className="facility-tile"><img src="/assets/facility-imaging.jpg" alt="Zamonaviy diagnostika xonasi" /><span>Diagnostika markazi</span></div>
              <div className="facility-tile"><img src="/assets/hospital-building.jpg" alt="Klinikaning yorug‘ va zamonaviy muhiti" /><span>Qulay shifoxona</span></div>
              <div className="facility-tile"><img src="/assets/hero-care.jpg" alt="Bemorlar uchun g‘amxo‘r muhit" /><span>Mehrli parvarish</span></div>
            </div>
          </div>
        </section>

        <section className="site-shell section anatomy-showcase" aria-labelledby="anatomy-showcase-title">
          <div className="anatomy-showcase-copy">
            <span className="kicker">Insoniy anatomiya</span>
            <h2 id="anatomy-showcase-title">Har bir hujayra —<br />jonli hikoya.</h2>
            <p>Mushaklar, ichki a’zolar va qon tomirlar tizimi birgalikda ishlaydi. Biz sizning tanangizning har bir bo‘g‘inini tushunib davolaymiz.</p>
            <div className="anatomy-showcase-points">
              <div className="anatomy-showcase-point"><span className="check"><Check size={14} /></span>Zamonaviy anatomik tasavvur</div>
              <div className="anatomy-showcase-point"><span className="check"><Check size={14} /></span>Mushak va a’zolar diagnostikasi</div>
              <div className="anatomy-showcase-point"><span className="check"><Check size={14} /></span>Chuqur tibbiy tahlil</div>
            </div>
          </div>
          <div className="anatomy-showcase-stage">
            <div className="anatomy-showcase-glow" />
            <div className="anatomy-showcase-item anatomy-showcase-skeleton">
              <SkeletonModel />
              <span className="anatomy-showcase-caption">Skelet tizimi</span>
            </div>
            <div className="anatomy-showcase-item anatomy-showcase-muscles">
              <div className="anatomy-showcase-tilt">
                <img src="/assets/anatomy-body-3d.png" alt="Inson tanasining mushaklari va a’zolari" className="anatomy-showcase-img" />
              </div>
              <span className="anatomy-showcase-caption">Mushak va a’zolar</span>
            </div>
          </div>
        </section>

        <section className="site-shell section appointment-section" id="appointment" aria-labelledby="appointment-title">
          <div className="appointment-copy">
            <span className="kicker">Qulay va tez</span>
            <h2 id="appointment-title">Qabulga yoziling.</h2>
            <p>Ma’lumotlaringizni qoldiring — klinika jamoasi siz bilan bog‘lanish uchun aloqaga chiqadi.</p>
            <div className="appointment-hours"><span className="check"><Clock3 size={18} /></span><span><strong>Har kuni, 24 soat</strong><small>So‘rovni istalgan vaqtda yuborishingiz mumkin</small></span></div>
          </div>
          <form className="contact-form appointment-form" onSubmit={handleSubmit} data-testid="form-appointment">
            <div className="form-heading">Qabul so‘rovi</div>
            <div className="form-grid">
              <div className="field"><label htmlFor="appointment-name">Ismingiz</label><input id="appointment-name" name="name" value={apptName} onChange={(e) => setApptName(e.target.value)} autoComplete="name" placeholder="Ismingizni kiriting" required /></div>
              <div className="field"><label htmlFor="appointment-phone">Telefon raqamingiz</label><input id="appointment-phone" name="phone" value={apptPhone} onChange={(e) => setApptPhone(e.target.value)} autoComplete="tel" type="tel" placeholder="+998 __ ___ __ __" required /></div>
              <div className="field full">
                <label htmlFor="appointment-doctor">Shifokorni tanlang</label>
                <select id="appointment-doctor" name="doctor" value={apptDoctor} onChange={(e) => setApptDoctor(e.target.value)} required>
                  <option value="" disabled>Shifokorni tanlang</option>
                  {publicDoctors.map((d) => (
                    <option key={d.id} value={d.id}>{d.fullName}{d.specialty ? ` — ${d.specialty}` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="field full">
                <label htmlFor="appointment-service">Xizmat</label>
                <select
                  id="appointment-service"
                  name="service"
                  value={apptService}
                  onChange={(e) => setApptService(e.target.value)}
                  disabled={!apptDoctor || apptAvailableServices.length === 0}
                  required
                >
                  {!apptDoctor && <option value="">Avval shifokorni tanlang</option>}
                  {apptDoctor && apptAvailableServices.length === 0 && <option value="">Ushbu shifokorga xizmat biriktirilmagan</option>}
                  {apptAvailableServices.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button className="button button-primary form-submit" type="submit" disabled={!apptDoctor || !apptService}>Qabul so‘rovini yuborish <ArrowRight size={17} /></button>
            {submitted && <div className="form-message" role="status"><Check size={18} /> So‘rovingiz qabul qilindi. Klinika jamoasi tez orada siz bilan bog‘lanadi.</div>}
          </form>
        </section>

        <ContactSection />

      </main>

      {loginOpen && (
        <div className="login-overlay" role="dialog" aria-modal="true" aria-labelledby="login-title" onClick={() => setLoginOpen(false)}>
          <div className="login-modal" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="login-close" onClick={() => setLoginOpen(false)} aria-label="Yopish">
              <X size={20} />
            </button>
            <div className="login-visual">
              <SkeletonModel />
            </div>
            <form className="login-form" onSubmit={handleLoginSubmit}>
              <div className="login-header">
                <span className="kicker">Xush kelibsiz</span>
                <h2 id="login-title">Tizimga kirish</h2>
                <p>Shaxsiy kabinetingizga kirish uchun ma’lumotlarni kiriting.</p>
              </div>

              <label className="login-field">
                <span>Email yoki telefon</span>
                <div className="login-input">
                  <User size={16} />
                  <input type="text" name="username" placeholder="siz@ssdklinika.uz" autoComplete="username" required />
                </div>
              </label>

              <label className="login-field">
                <span>Parol</span>
                <div className="login-input">
                  <Lock size={16} />
                  <input type={showPassword ? 'text' : 'password'} name="password" placeholder="••••••••" autoComplete="current-password" required minLength={6} />
                  <button type="button" className="login-eye" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </label>

              <div className="login-row">
                <label className="login-remember">
                  <input type="checkbox" />
                  <span>Meni eslab qol</span>
                </label>
                <a href="#reset" className="login-forgot">Parolni unutdingizmi?</a>
              </div>

              {loginError && (
                <div className="login-error" role="alert">
                  <X size={14} /> {loginError}
                </div>
              )}

              <button className="button button-primary login-submit" type="submit" disabled={loginBusy}>
                {loginBusy ? 'Kirmoqda…' : 'Kirish'} <ArrowRight size={16} />
              </button>

              <div className="login-notice" role="note">
                <ShieldCheck size={16} />
                <span>Diqqat! Bu kirish faqat <strong>klinika xodimlari</strong> uchun mo‘ljallangan.</span>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="site-footer" aria-labelledby="footer-title">
        <div className="site-shell footer-grid">
          <div className="footer-brand">
            <Logo />
            <p className="footer-tagline">Sog‘lig‘ingiz — bizning e’tiborimiz. Oilangiz uchun zamonaviy va ishonchli tibbiy xizmat.</p>
            <div className="footer-socials" aria-label="Ijtimoiy tarmoqlar">
              <a href="#contact" aria-label="Telegram"><Send size={16} /></a>
              <a href="#contact" aria-label="Instagram"><Instagram size={16} /></a>
              <a href="mailto:info@ssdklinika.uz" aria-label="Email"><Mail size={16} /></a>
            </div>
          </div>

          <div className="footer-col">
            <h3 id="footer-title">Navigatsiya</h3>
            <ul>
              {navLinks.map(([label, href]) => (
                <li key={href}><a href={href}>{label}</a></li>
              ))}
            </ul>
          </div>

          <div className="footer-col">
            <h3>Xizmatlar</h3>
            <ul>
              {services.slice(0, 6).map((service) => (
                <li key={service.key}><a href="#services">{service.title}</a></li>
              ))}
            </ul>
          </div>

          <div className="footer-col footer-contact">
            <h3>Aloqa</h3>
            <ul>
              <li><Phone size={14} /> <a href="tel:+998914343735">+998 91 434 37 35</a></li>
              <li><Phone size={14} /> <a href="tel:+998912070777">+998 91 207 07 77</a></li>
              <li><Mail size={14} /> <a href="mailto:info@ssdklinika.uz">info@ssdklinika.uz</a></li>
              <li><MapPin size={14} /> Shovot tumani, J. Manguberdi ko‘chasi, 28-A</li>
              <li><Clock3 size={14} /> Har kuni, 24 soat</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ContactSection() {
  const contact = useContactSettings();
  return (
    <section className="site-shell section contact-section" id="contact" aria-labelledby="contact-title">
      <div className="contact-intro">
        <div className="contact-intro-copy">
          <div className="contact-eyebrow-row">
            <span className="kicker">Biz bilan bogʻlaning</span>
            {contact.availability && (
              <span className="contact-availability"><Clock3 size={15} /> {contact.availability}</span>
            )}
          </div>
          <h2 id="contact-title">Har doim yoningizdamiz.</h2>
          <p>Savolingiz boʻlsa yoki klinikaga tashrif rejalashtirsangiz, sizga qulay aloqa usulini tanlang.</p>
        </div>
      </div>
      <div className="contact-layout">
        <div className="contact-card-grid" aria-label="Klinika bilan aloqa maʼlumotlari">
          {contact.phones.map((p) => (
            <a key={p.id} className="contact-card contact-card-phone" href={telHref(p.tel || p.number)}>
              <span className="contact-icon"><Phone size={21} /></span>
              <span className="contact-card-copy">
                <small>{p.label}</small>
                <strong>{p.number}</strong>
                {p.note && <em>{p.note}</em>}
              </span>
              <span className="contact-card-action">Qoʻngʻiroq qilish <ArrowRight size={16} /></span>
            </a>
          ))}
          {contact.address && (
            <div className="contact-card">
              <span className="contact-icon"><MapPin size={21} /></span>
              <span className="contact-card-copy">
                <small>Manzil</small>
                <strong>{contact.address}</strong>
                {contact.addressNote && <em>{contact.addressNote}</em>}
              </span>
            </div>
          )}
          {contact.socials.map((s) => {
            const Icon = SOCIAL_ICON[s.platform] ?? Globe;
            return (
              <a key={s.id} className="contact-card" href={s.url} target="_blank" rel="noreferrer">
                <span className="contact-icon"><Icon size={21} /></span>
                <span className="contact-card-copy">
                  <small>{s.label}</small>
                  <strong>{s.handle}</strong>
                  {s.note && <em>{s.note}</em>}
                </span>
              </a>
            );
          })}
        </div>
        <ClinicMap />
      </div>
    </section>
  );
}

export default App;

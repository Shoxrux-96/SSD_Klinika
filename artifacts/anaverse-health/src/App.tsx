import { useState, type FormEvent } from 'react';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  ChevronRight,
  Clock3,
  HeartPulse,
  Hospital,
  Menu,
  Phone,
  ShieldCheck,
  Stethoscope,
  X,
} from 'lucide-react';

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
  ['Maqolalar', '#articles'],
  ['Aloqa', '#contact'],
];

const doctors = [
  { name: 'Dr. Andika Pratama', specialty: 'Kardiolog, oliy toifali shifokor', position: '23% 40%' },
  { name: 'Dr. Salibala Putri', specialty: 'Pediatr, bolalar salomatligi', position: '53% 42%' },
  { name: 'Dr. Budi Santoso', specialty: 'Nevrolog, tibbiyot fanlari doktori', position: '78% 40%' },
];

const articles = [
  {
    tag: 'Yurak salomatligi',
    title: 'Yurakni asrashning kundalik odatlari',
    text: 'Kichik va muntazam qadamlar yurak salomatligini mustahkamlashga yordam beradi.',
    image: '/assets/organ-heart.jpg',
    date: '6 daqiqa o‘qish',
  },
  {
    tag: 'Oila salomatligi',
    title: 'Bolalar uchun sog‘lom ovqatlanish',
    text: 'Rang-barang taomlar va oilaviy odatlar bolaning o‘sishiga qanday ta’sir qiladi?',
    image: '/assets/article-family.jpg',
    date: '5 daqiqa o‘qish',
  },
  {
    tag: 'Profilaktika',
    title: 'Yillik tibbiy ko‘rik nega muhim?',
    text: 'O‘z vaqtida tekshiruvdan o‘tish xotirjamlik va salomatlik uchun muhim qadam.',
    image: '/assets/facility-imaging.jpg',
    date: '4 daqiqa o‘qish',
  },
];

function Logo() {
  return (
    <a className="brand" href="#top" aria-label="Anaverse bosh sahifasi">
      <span className="brand-mark"><Hospital size={21} strokeWidth={2.4} /></span>
      <span className="brand-name"><strong>ANAVERSE</strong><small>OILA SALOMATLIGI</small></span>
    </a>
  );
}

const anatomyItems = [
  { id: 'tish', label: 'Tish', image: '/assets/tooth-model.png', detail: 'Tish tuzilishi', note: 'Og‘iz bo‘shlig‘i salomatligi bo‘yicha ko‘rik va maslahat.', position: 'tooth' },
  { id: 'yurak', label: 'Yurak', image: '/assets/organ-heart.jpg', detail: 'Yurak faoliyati', note: 'Yurak-qon tomir salomatligi bo‘yicha mutaxassis ko‘rigi.', position: 'heart' },
  { id: 'opka', label: 'O‘pka', image: '/assets/organ-lungs.jpg', detail: 'Nafas tizimi', note: 'Nafas olish va o‘pka salomatligi bo‘yicha ko‘rik.', position: 'lungs' },
  { id: 'ekg', label: 'EKG', image: '', detail: 'EKG tekshiruvi', note: 'Yurak elektr faolligini qayd etuvchi tekshiruv turi.', position: 'ekg' },
  { id: 'laboratoriya', label: 'Laboratoriya', image: '/assets/organ-body.jpg', detail: 'Laboratoriya', note: 'Tahlil turi shifokor tavsiyasiga ko‘ra belgilanadi.', position: 'lab' },
  { id: 'rentgen', label: 'Rentgen', image: '/assets/organ-spine.jpg', detail: 'Rentgen tasviri', note: 'Tasviriy tekshiruv zarurati shifokor bilan aniqlanadi.', position: 'xray' },
];

function AnatomyExperience() {
  const [active, setActive] = useState(anatomyItems[1]);
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
            onClick={() => setActive(item)}
            aria-label={`${item.label} bo‘yicha ma’lumotni ko‘rsatish`}
            aria-pressed={active.id === item.id}
            data-testid={`button-anatomy-${item.id}`}
          >
            {item.id === 'ekg' ? (
              <svg className="ekg-wave" viewBox="0 0 120 44" role="img" aria-label="EKG to‘lqinining namuna chizig‘i">
                <path d="M2 23h23l7-1 6-12 9 26 9-19 7 6h11l7-1 7-12 9 25 7-12h9" />
              </svg>
            ) : <img src={item.image} alt="" />}
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
          <button key={item.id} type="button" onClick={() => setActive(item)} aria-pressed={active.id === item.id} data-testid={`button-select-${item.id}`}>
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    event.currentTarget.reset();
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
            {navLinks.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <div className="nav-actions">
            <a className="nav-phone" href="tel:+998712345678"><Phone size={15} /> +998 71 234 56 78</a>
            <a className="button button-primary" href="#contact"><Clock3 size={15} /> Qabulga yozilish</a>
            <button className="menu-toggle" aria-label={menuOpen ? 'Menyuni yopish' : 'Menyuni ochish'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="mobile-nav" aria-label="Mobil navigatsiya">
            {navLinks.map(([label, href]) => <a key={href} href={href} onClick={closeMenu}>{label}</a>)}
            <a href="#contact" onClick={closeMenu}>Qabulga yozilish</a>
          </nav>
        )}
      </header>

      <main>
        <section className="site-shell hero" aria-labelledby="hero-title">
          <div className="hero-copy reveal">
            <span className="eyebrow"><span className="eyebrow-dot" /> Siz va oilangiz uchun g‘amxo‘rlik</span>
            <h1 id="hero-title">Sog‘lig‘ingiz —<br />bizning <em>e’tiborimiz.</em></h1>
            <p>ANAVERSE — tajribali mutaxassislar va zamonaviy tibbiyot birlashgan, har bir insonni tinglaydigan shifoxona.</p>
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
        </section>

        <section className="site-shell trust-strip" aria-label="ANAVERSE ko‘rsatkichlari">
          <div className="trust-item"><span className="trust-icon"><Stethoscope size={20} /></span><span><strong>15+</strong><span>yillik tajriba</span></span></div>
          <div className="trust-item"><span className="trust-icon"><HeartPulse size={20} /></span><span><strong>25 000+</strong><span>mamnun bemor</span></span></div>
          <div className="trust-item"><span className="trust-icon"><Hospital size={20} /></span><span><strong>120+</strong><span>tibbiy mutaxassis</span></span></div>
          <div className="trust-item"><span className="trust-icon"><ShieldCheck size={20} /></span><span><strong>98%</strong><span>tavsiya etadi</span></span></div>
        </section>

        <section className="site-shell section about-grid" id="about">
          <div className="about-image-wrap reveal">
            <div className="about-image"><img src="/assets/hospital-building.jpg" alt="ANAVERSE zamonaviy shifoxonasi" /></div>
            <div className="about-image-badge"><strong>ANAVERSE</strong><span>Salomatlik sari ishonchli qadam</span></div>
          </div>
          <div className="about-copy reveal delay-1">
            <span className="kicker">Biz haqimizda</span>
            <h2>Mehr bilan davolash,<br />ishonch bilan yashash.</h2>
            <p>Bizning markazimizda zamonaviy tibbiy bilim insoniy munosabat bilan uyg‘unlashadi. Sizni tinglaydigan shifokorlar, puxta diagnostika va qulay muhit — barchasi salomatlik yo‘lingizni yengillashtirish uchun.</p>
            <div className="about-points">
              <div className="about-point"><span className="check"><Check size={14} /></span>Malakali shifokorlar</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Zamonaviy diagnostika</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Har bir bemorga e’tibor</div>
              <div className="about-point"><span className="check"><Check size={14} /></span>Oila uchun qulay muhit</div>
            </div>
            <a className="button button-primary" href="#facilities">Markazimiz bilan tanishing <ArrowRight size={15} /></a>
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
          <div className="doctor-grid">
            {doctors.map((doctor) => (
              <article className="doctor-card" key={doctor.name}>
                <img src="/assets/doctors-team.jpg" alt={`${doctor.name}, shifokor`} style={{ objectPosition: doctor.position }} />
                <div className="doctor-card-copy"><strong>{doctor.name}</strong><span>{doctor.specialty}</span></div>
              </article>
            ))}
          </div>
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

        <section className="site-shell section" id="articles">
          <div className="section-heading">
            <div><span className="kicker">Salomatlik kundaligi</span><h2>Yaxshi yashash haqida.</h2></div>
            <p>Mutaxassislarimizdan foydali maslahatlar va oilangiz uchun sog‘lom odatlar.</p>
          </div>
          <div className="articles-grid">
            {articles.map((article) => (
              <article className="article-card" key={article.title}>
                <img src={article.image} alt="" />
                <div className="article-copy"><span className="article-tag">{article.tag}</span><h3>{article.title}</h3><p>{article.text}</p><div className="article-meta">{article.date}</div></div>
              </article>
            ))}
          </div>
        </section>

        <section className="site-shell section contact-section" id="contact">
          <div className="contact-copy">
            <span className="kicker">Biz bilan bog‘laning</span>
            <h2>Sizga yordam berishga tayyormiz.</h2>
            <p>Savolingiz bormi yoki mutaxassis bilan maslahatlashmoqchimisiz? Ma’lumotlaringizni qoldiring — jamoamiz siz bilan bog‘lanish uchun aloqaga chiqadi.</p>
            <div className="contact-list">
              <a className="contact-line" href="tel:+998712345678"><span className="check"><Phone size={15} /></span>+998 71 234 56 78</a>
              <div className="contact-line"><span className="check"><Clock3 size={15} /></span>Har kuni, 24 soat</div>
              <div className="contact-line"><span className="check"><Hospital size={15} /></span>Toshkent shahri, O‘zbekiston</div>
            </div>
          </div>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-heading">Qayta qo‘ng‘iroq so‘rovi</div>
            <div className="form-grid">
              <div className="field"><label htmlFor="name">Ismingiz</label><input id="name" name="name" autoComplete="name" placeholder="Ismingizni kiriting" required /></div>
              <div className="field"><label htmlFor="phone">Telefon raqamingiz</label><input id="phone" name="phone" autoComplete="tel" type="tel" placeholder="+998 __ ___ __ __" required /></div>
              <div className="field full"><label htmlFor="service">Qaysi xizmat kerak?</label><select id="service" name="service" defaultValue=""><option value="" disabled>Yo‘nalishni tanlang</option>{services.map((service) => <option key={service.key}>{service.title}</option>)}</select></div>
              <div className="field full"><label htmlFor="message">Izoh <span>(ixtiyoriy)</span></label><textarea id="message" name="message" placeholder="Sizga qanday yordam bera olamiz?" /></div>
            </div>
            <button className="button button-primary form-submit" type="submit">So‘rov qoldirish <ArrowRight size={15} /></button>
            {submitted && <div className="form-message" role="status"><Check size={16} /> So‘rovingiz ushbu sahifada qayd etildi. Bu demo shakl bo‘lib, ma’lumotlar shifoxonaga yuborilmadi.</div>}
          </form>
        </section>
      </main>

      <footer className="site-shell footer">
        <div className="footer-inner">
          <Logo />
          <span className="footer-note">© 2025 ANAVERSE. Sog‘lig‘ingiz — bizning e’tiborimiz.</span>
          <nav className="footer-links" aria-label="Pastki navigatsiya">
            <a href="#about">Markaz haqida</a><a href="#services">Xizmatlar</a><a href="#contact">Bog‘lanish</a>
          </nav>
          <a className="back-top" href="#top" aria-label="Sahifa boshiga"><ArrowUp size={17} /></a>
        </div>
      </footer>
    </div>
  );
}

export default App;

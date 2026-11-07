import { EmployeeList } from './EmployeeList';

const DOCTOR_POSITIONS = [
  // Rahbariyat
  'Bosh shifokor',
  "Bo'lim mudiri",
  'Shifokor-maslahatchi',
  'Umumiy amaliyot shifokori',
  'Oilaviy shifokor',

  // Terapiya va ichki kasalliklar
  'Terapevt',
  'Kardiolog',
  'Pulmonolog',
  'Gastroenterolog',
  'Nefrolog',
  'Endokrinolog',
  'Gematolog',
  'Revmatolog',
  'Allergolog-immunolog',
  'Infeksionist',
  'Ftiziatr',

  // Nevrologiya va psixiatriya
  'Nevropatolog',
  'Neyroxirurg',
  'Psixiatr',
  'Narkolog',
  'Psixoterapevt',

  // Jarrohlik
  'Umumiy jarroh',
  'Travmatolog-ortoped',
  'Jarroh-onkolog',
  'Qon tomir jarrohi',
  'Yurak-qon tomir jarrohi',
  'Torakal jarroh',
  'Abdominal jarroh',
  'Mikrojarroh',
  'Plastik jarroh',
  'Kombustiolog',

  // Pediatriya
  'Pediatr',
  'Neonatolog',
  'Bolalar jarrohi',
  'Bolalar kardiologi',
  'Bolalar nevropatologi',
  'Bolalar endokrinologi',
  'Bolalar stomatologi',

  // Akusher-ginekologiya va reproduktiv tibbiyot
  'Akusher-ginekolog',
  'Reproduktolog',
  'Mammolog',

  // Urologiya va erkaklar salomatligi
  'Urolog',
  'Androlog',

  // LOR, ko‘z va teri
  'LOR shifokor (otorinolaringolog)',
  'Oftalmolog',
  'Dermatolog',
  'Dermatovenerolog',
  'Kosmetolog',

  // Diagnostika va laboratoriya
  'Radiolog',
  'UZI shifokori',
  'KT/MRT shifokori',
  'Funksional diagnostika shifokori',
  'Endoskopist',
  'Laboratoriya shifokori',
  'Patolog-anatom',
  'Sitolog',
  'Mikrobiolog',
  'Genetik',

  // Onkologiya va radioterapiya
  'Onkolog',
  'Ximioterapevt',
  'Radioterapevt',

  // Anesteziologiya va reanimatsiya
  'Anesteziolog',
  'Reanimatolog',
  'Shoshilinch yordam shifokori',

  // Reabilitatsiya va sport tibbiyoti
  'Fizioterapevt',
  'Reabilitolog',
  'Massajchi-shifokor',
  'Manual terapevt',
  'Sport shifokori',

  // Oziqlanish va profilaktika
  'Dietolog',
  'Nutritsiolog',
  'Gigienist-epidemiolog',
  'Profpatolog',

  // Stomatologiya
  'Stomatolog-terapevt',
  'Stomatolog-jarroh',
  'Ortodont',
  'Ortoped stomatolog',
  'Pedodont',
  'Endodontist',
  'Implantolog',
  'Parodontolog',
  'Gigienist-stomatolog',

  // O'rta tibbiy xodimlar
  'Katta hamshira',
  'Hamshira',
  'Protsedura hamshirasi',
  'Operatsion hamshira',
  'Anesteziolog hamshira',
  'Patronaj hamshirasi',
  'Yordamchi hamshira',
  'Felsher',
  'Akusherka',
  'Stomatologik hamshira',

  // Laboratoriya
  'Laboratoriya mudiri',
  'Laborant',
  'Laborant yordamchisi',
  'Rentgen laboranti',

  // Boshqa
  'Boshqa',
];

export function AdminStaff() {
  return (
    <EmployeeList
      category="medical"
      title="Shifokorlar"
      subtitle="Klinikaning shifokorlar bazasi — mutaxassislik, tajriba va diplom ma’lumotlari bilan."
      positions={DOCTOR_POSITIONS}
    />
  );
}

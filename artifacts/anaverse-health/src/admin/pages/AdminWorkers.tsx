import { EmployeeList } from './EmployeeList';

const STAFF_POSITIONS = [
  'Hamshira',
  'Yordamchi hamshira',
  'Laborant',
  'Laborant yordamchisi',
  'Registrator',
  'Administrator',
  'Farrosh',
  'Qarovul',
  'Haydovchi',
  'Oshpaz',
  'Texnik xodim',
  'IT xodim',
  'Buxgalter',
  'Boshqa',
];

export function AdminWorkers() {
  return (
    <EmployeeList
      category="service"
      title="Hodimlar"
      subtitle="Klinikaning yordamchi hodimlari — hamshiralar, laborantlar, registratorlar va boshqa xodimlar."
      positions={STAFF_POSITIONS}
    />
  );
}

export type ClinicLocation = {
  id: string;
  name: string;
  address: string;
  position: [number, number];
};

export const clinicLocations: ClinicLocation[] = [
  {
    id: 'ssd-shovot',
    name: 'SSD Klinika — Sirius Stoma Dent Diagnostika markazi',
    address: 'Shovot tumani, J. Manguberdi ko‘chasi, 28-A uy',
    position: [41.654459, 60.290992],
  },
];

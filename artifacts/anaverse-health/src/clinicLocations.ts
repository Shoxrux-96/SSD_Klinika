export type ClinicLocation = {
  id: string;
  name: string;
  address: string;
  position: [number, number];
};

// Add verified branch addresses and coordinates here when the clinic provides them.
export const clinicLocations: ClinicLocation[] = [];

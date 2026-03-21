import type { Clinic } from '@clinic/shared';

export interface FindClinicParams {
  clinicId: string;
}

export async function findClinicById(_params: FindClinicParams): Promise<Clinic | null> {
  return null;
}
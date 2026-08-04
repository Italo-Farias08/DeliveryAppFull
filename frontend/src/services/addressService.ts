import { api } from './api';

export interface Address {
  id: string;
  label?: string | null;
  street: string;
  number?: string | null;
  complement?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  zip?: string | null;
  lat?: number | null;
  lng?: number | null;
}

export interface CreateAddressPayload {
  label?: string;
  street: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city: string;
  state: string;
  zip?: string;
  lat?: number;
  lng?: number;
}

export async function listAddresses(): Promise<Address[]> {
  const { data } = await api.get('/addresses');
  return data;
}

export async function createAddress(payload: CreateAddressPayload): Promise<Address> {
  const { data } = await api.post('/addresses', payload);
  return data;
}

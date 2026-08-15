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
  isDefault?: boolean;
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

export async function deleteAddress(id: string): Promise<void> {
  await api.delete(`/addresses/${id}`);
}

// Fixa este endereço como o principal do cliente — ele passa a aparecer
// no topo da lista e é usado como referência na conferência de localização
// na hora de fechar o pedido.
export async function setDefaultAddress(id: string): Promise<Address> {
  const { data } = await api.patch(`/addresses/${id}/default`);
  return data;
}

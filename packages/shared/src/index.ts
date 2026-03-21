export type PlanTier = 'starter' | 'growth' | 'enterprise';

export type AppointmentStatus = 'scheduled' | 'completed' | 'cancelled' | 'no_show';

export type MessageStatus = 'queued' | 'sent' | 'delivered' | 'read' | 'failed';

export type TriggerType =
  | 'appointment.created'
  | 'appointment.completed'
  | 'no_response'
  | 'time_based';

export interface Clinic {
  id: string;
  name: string;
  plan: PlanTier;
  status: 'active' | 'suspended';
  createdAt: Date;
}

export interface User {
  id: string;
  clinicId: string;
  email: string;
  role: 'admin' | 'provider' | 'receptionist';
  active: boolean;
}

export interface Customer {
  id: string;
  clinicId: string;
  phone: string;
  name?: string;
  tags: string[];
  createdAt: Date;
}

export interface Appointment {
  id: string;
  clinicId: string;
  customerId: string;
  serviceId: string;
  staffId: string;
  startsAt: Date;
  endsAt: Date;
  status: AppointmentStatus;
}

export interface Message {
  id: string;
  clinicId: string;
  conversationId: string;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'audio';
  content: string;
  transcribed: boolean;
  waMessageId: string;
  status: MessageStatus;
  createdAt: Date;
}

export interface Workflow {
  id: string;
  clinicId: string;
  trigger: TriggerType;
  conditions: Condition[];
  actions: Action[];
  active: boolean;
}

export interface Condition {
  field: string;
  operator: 'eq' | 'neq' | 'contains' | 'gt' | 'lt';
  value: unknown;
}

export interface Action {
  type: 'send_whatsapp' | 'add_tag' | 'assign_staff' | 'trigger_workflow';
  params: Record<string, unknown>;
}
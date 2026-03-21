// AUTO-GENERATED — do not edit manually.
// Regenerate with: supabase gen types typescript --local > packages/db/src/types/database.types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string
          name: string
          tier: Database['public']['Enums']['plan_tier']
          max_users: number
          max_appointments_per_month: number
          price_monthly: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          tier: Database['public']['Enums']['plan_tier']
          max_users?: number
          max_appointments_per_month?: number
          price_monthly?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          tier?: Database['public']['Enums']['plan_tier']
          max_users?: number
          max_appointments_per_month?: number
          price_monthly?: number
          created_at?: string
        }
        Relationships: []
      }
      clinics: {
        Row: {
          id: string
          name: string
          plan_id: string
          status: 'active' | 'suspended'
          whatsapp_phone_number_id: string | null
          timezone: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          plan_id: string
          status?: 'active' | 'suspended'
          whatsapp_phone_number_id?: string | null
          timezone?: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          plan_id?: string
          status?: 'active' | 'suspended'
          whatsapp_phone_number_id?: string | null
          timezone?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'clinics_plan_id_fkey'
            columns: ['plan_id']
            referencedRelation: 'subscription_plans'
            referencedColumns: ['id']
          }
        ]
      }
      users: {
        Row: {
          id: string
          clinic_id: string
          email: string
          role: Database['public']['Enums']['user_role']
          active: boolean
          created_at: string
        }
        Insert: {
          id: string
          clinic_id: string
          email: string
          role?: Database['public']['Enums']['user_role']
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          email?: string
          role?: Database['public']['Enums']['user_role']
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'users_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
      customers: {
        Row: {
          id: string
          clinic_id: string
          phone: string
          name: string | null
          tags: string[]
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          phone: string
          name?: string | null
          tags?: string[]
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          phone?: string
          name?: string | null
          tags?: string[]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'customers_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
      services: {
        Row: {
          id: string
          clinic_id: string
          name: string
          duration_minutes: number
          price: number
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          duration_minutes?: number
          price?: number
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          duration_minutes?: number
          price?: number
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'services_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
      staff_services: {
        Row: {
          id: string
          clinic_id: string
          user_id: string
          service_id: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          user_id: string
          service_id: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          user_id?: string
          service_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'staff_services_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_services_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_services_service_id_fkey'
            columns: ['service_id']
            referencedRelation: 'services'
            referencedColumns: ['id']
          }
        ]
      }
      working_hours: {
        Row: {
          id: string
          clinic_id: string
          user_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          user_id: string
          day_of_week: number
          start_time: string
          end_time: string
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          user_id?: string
          day_of_week?: number
          start_time?: string
          end_time?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'working_hours_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'working_hours_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      appointments: {
        Row: {
          id: string
          clinic_id: string
          customer_id: string
          service_id: string
          staff_id: string
          starts_at: string
          ends_at: string
          status: Database['public']['Enums']['appointment_status']
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          customer_id: string
          service_id: string
          staff_id: string
          starts_at: string
          ends_at: string
          status?: Database['public']['Enums']['appointment_status']
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          customer_id?: string
          service_id?: string
          staff_id?: string
          starts_at?: string
          ends_at?: string
          status?: Database['public']['Enums']['appointment_status']
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'appointments_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_service_id_fkey'
            columns: ['service_id']
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'appointments_staff_id_fkey'
            columns: ['staff_id']
            referencedRelation: 'users'
            referencedColumns: ['id']
          }
        ]
      }
      conversations: {
        Row: {
          id: string
          clinic_id: string
          customer_id: string
          last_message_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          customer_id: string
          last_message_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          customer_id?: string
          last_message_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'conversations_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'conversations_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      messages: {
        Row: {
          id: string
          clinic_id: string
          conversation_id: string
          direction: Database['public']['Enums']['message_direction']
          type: Database['public']['Enums']['message_type']
          content: string
          transcribed: boolean
          wa_message_id: string | null
          status: Database['public']['Enums']['message_status']
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          conversation_id: string
          direction: Database['public']['Enums']['message_direction']
          type?: Database['public']['Enums']['message_type']
          content: string
          transcribed?: boolean
          wa_message_id?: string | null
          status?: Database['public']['Enums']['message_status']
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          conversation_id?: string
          direction?: Database['public']['Enums']['message_direction']
          type?: Database['public']['Enums']['message_type']
          content?: string
          transcribed?: boolean
          wa_message_id?: string | null
          status?: Database['public']['Enums']['message_status']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'messages_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'messages_conversation_id_fkey'
            columns: ['conversation_id']
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
      workflows: {
        Row: {
          id: string
          clinic_id: string
          name: string
          trigger: Database['public']['Enums']['workflow_trigger']
          conditions: Json
          actions: Json
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          trigger: Database['public']['Enums']['workflow_trigger']
          conditions?: Json
          actions?: Json
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          trigger?: Database['public']['Enums']['workflow_trigger']
          conditions?: Json
          actions?: Json
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workflows_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
      workflow_runs: {
        Row: {
          id: string
          clinic_id: string
          workflow_id: string
          trigger_payload: Json | null
          status: Database['public']['Enums']['workflow_run_status']
          error: string | null
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          clinic_id: string
          workflow_id: string
          trigger_payload?: Json | null
          status?: Database['public']['Enums']['workflow_run_status']
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          clinic_id?: string
          workflow_id?: string
          trigger_payload?: Json | null
          status?: Database['public']['Enums']['workflow_run_status']
          error?: string | null
          created_at?: string
          completed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'workflow_runs_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workflow_runs_workflow_id_fkey'
            columns: ['workflow_id']
            referencedRelation: 'workflows'
            referencedColumns: ['id']
          }
        ]
      }
      forms: {
        Row: {
          id: string
          clinic_id: string
          name: string
          schema: Json
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          name: string
          schema?: Json
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          name?: string
          schema?: Json
          active?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'forms_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
      form_responses: {
        Row: {
          id: string
          clinic_id: string
          form_id: string
          customer_id: string | null
          responses: Json
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          form_id: string
          customer_id?: string | null
          responses?: Json
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          form_id?: string
          customer_id?: string | null
          responses?: Json
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'form_responses_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'form_responses_form_id_fkey'
            columns: ['form_id']
            referencedRelation: 'forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'form_responses_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      notification_schedules: {
        Row: {
          id: string
          clinic_id: string
          appointment_id: string | null
          customer_id: string | null
          workflow_id: string | null
          type: Database['public']['Enums']['notification_type']
          scheduled_at: string
          sent_at: string | null
          bull_job_id: string | null
          status: Database['public']['Enums']['notification_status']
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          appointment_id?: string | null
          customer_id?: string | null
          workflow_id?: string | null
          type?: Database['public']['Enums']['notification_type']
          scheduled_at: string
          sent_at?: string | null
          bull_job_id?: string | null
          status?: Database['public']['Enums']['notification_status']
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          appointment_id?: string | null
          customer_id?: string | null
          workflow_id?: string | null
          type?: Database['public']['Enums']['notification_type']
          scheduled_at?: string
          sent_at?: string | null
          bull_job_id?: string | null
          status?: Database['public']['Enums']['notification_status']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'notification_schedules_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_schedules_appointment_id_fkey'
            columns: ['appointment_id']
            referencedRelation: 'appointments'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_schedules_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'notification_schedules_workflow_id_fkey'
            columns: ['workflow_id']
            referencedRelation: 'workflows'
            referencedColumns: ['id']
          }
        ]
      }
      audit_logs: {
        Row: {
          id: string
          clinic_id: string
          actor_id: string | null
          actor_type: 'user' | 'system'
          action: string
          resource_type: string
          resource_id: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          clinic_id: string
          actor_id?: string | null
          actor_type?: 'user' | 'system'
          action: string
          resource_type: string
          resource_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          clinic_id?: string
          actor_id?: string | null
          actor_type?: 'user' | 'system'
          action?: string
          resource_type?: string
          resource_id?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_clinic_id_fkey'
            columns: ['clinic_id']
            referencedRelation: 'clinics'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      plan_tier: 'starter' | 'growth' | 'enterprise'
      user_role: 'admin' | 'provider' | 'receptionist'
      appointment_status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
      message_direction: 'inbound' | 'outbound'
      message_type: 'text' | 'audio'
      message_status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
      workflow_trigger: 'appointment.created' | 'appointment.completed' | 'no_response' | 'time_based'
      workflow_run_status: 'pending' | 'running' | 'completed' | 'failed'
      notification_type: 'reminder' | 'follow_up' | 'custom'
      notification_status: 'pending' | 'sent' | 'cancelled' | 'failed'
    }
    CompositeTypes: Record<string, never>
  }
}

type PublicSchema = Database[Extract<keyof Database, 'public'>]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions['schema']]['Tables'] &
        Database[PublicTableNameOrOptions['schema']]['Views'])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions['schema']]['Tables'] &
      Database[PublicTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])
    ? (PublicSchema['Tables'] & PublicSchema['Views'])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema['Tables']
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema['Tables']
    ? PublicSchema['Tables'][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema['Enums']
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions['schema']]['Enums'][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema['Enums']
    ? PublicSchema['Enums'][PublicEnumNameOrOptions]
    : never

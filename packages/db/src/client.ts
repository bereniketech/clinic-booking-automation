import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database.types'

export const createDbClient = (supabaseUrl: string, serviceRoleKey: string) =>
  createClient<Database>(supabaseUrl, serviceRoleKey)

export type DbClient = ReturnType<typeof createDbClient>

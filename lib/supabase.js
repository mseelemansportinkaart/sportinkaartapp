import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://pbcshmfqtncdvupsfdjq.supabase.co'
const supabaseAnonKey = 'sb_publishable_1DD9bAfCTcWXspywngNVgA_TuIJDMaL'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://ytyljpykccckvzitwcpo.supabase.co'
const supabaseAnonKey = 'sb_publishable_GypXMpnAuLb9yNzZ3uhHDA_8WqPiY2i'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
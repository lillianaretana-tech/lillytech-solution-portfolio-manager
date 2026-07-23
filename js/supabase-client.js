// =====================================================================
// LillyTech Solution Portfolio Manager — Cliente Supabase compartido
// Un único cliente para toda la app, importado por cada página.
// =====================================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { CONFIG } from './config.js';

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

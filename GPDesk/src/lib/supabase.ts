import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spb.tbema.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNjcwMDAwLCJleHAiOjE5MTg0MzY0MDB9.eE4x5nop2S1tnH-v8Z5XYL_OWCqxMb8sOtHjnbyThNM';

export const supabase = createClient(supabaseUrl, supabaseKey);

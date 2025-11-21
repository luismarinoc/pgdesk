
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spb.tbema.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNjcwMDAwLCJleHAiOjE5MTg0MzY0MDB9.eE4x5nop2S1tnH-v8Z5XYL_OWCqxMb8sOtHjnbyThNM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectView() {
    console.log('Testing specific columns in assignee view...');
    const { data, error } = await supabase
        .from('v_tickets_mes_proyecto_assignee')
        .select('porcentaje_issues, porcentaje_horas')
        .limit(1);

    if (error) {
        console.error('Error fetching specific columns:', error);
    } else {
        console.log('Data with specific columns:', data);
    }

    console.log('Testing v_horas_mes_proyecto...');
    const { data: data2, error: error2 } = await supabase
        .from('v_horas_mes_proyecto')
        .select('*')
        .limit(1);

    if (error2) console.log('v_horas_mes_proyecto error:', error2.message);
    else console.log('v_horas_mes_proyecto data:', data2);
}

inspectView();

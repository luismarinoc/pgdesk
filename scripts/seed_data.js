import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spb.tbema.net';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzYwNjcwMDAwLCJleHAiOjE5MTg0MzY0MDB9.eE4x5nop2S1tnH-v8Z5XYL_OWCqxMb8sOtHjnbyThNM';
const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
    console.log('Seeding data...');

    // 1. Create User
    const userEmail = 'test@example.com';
    const { data: user, error: userError } = await supabase
        .from('usuarios')
        .upsert({
            correo: userEmail,
            nombre: 'Usuario Test',
            clave: '123456',
            rol: 'admin',
            activo: true
        })
        .select()
        .single();

    if (userError) {
        console.error('Error creating user:', userError);
        return;
    }
    console.log('User created/updated:', user.correo);

    // 2. Create Project
    const { data: project, error: projectError } = await supabase
        .from('proyectos')
        .insert({
            nombre: 'Proyecto Demo',
            descripcion: 'Un proyecto de prueba para el dashboard',
            estado: 'activo',
            fecha_inicio: new Date().toISOString(),
            jira_id: 'DEMO-1'
        })
        .select()
        .single();

    if (projectError) {
        console.error('Error creating project:', projectError);
        // Try to fetch if it failed (maybe duplicate, though ID is UUID usually)
    } else {
        console.log('Project created:', project.id);

        // 3. Assign Project to User
        const { error: assignError } = await supabase
            .from('usuarios_proyectos')
            .insert({
                usuario_correo: userEmail,
                proyecto_id: project.id,
                activo: true
            });

        if (assignError) {
            console.error('Error assigning project:', assignError);
        } else {
            console.log('Project assigned to user');
        }
    }
}

seed();

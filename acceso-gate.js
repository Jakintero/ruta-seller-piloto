(() => {
  'use strict';
  // Barrera de interfaz para usuarios sin aprobación.
  // No sustituye la protección de archivos de un servidor ni las políticas RLS.
  function backToLogin(){
    const login = new URL('./index.html', window.location.href);
    window.location.replace(login.href);
  }
  (async () => {
    try {
      const configured = window.RUTA_SUPABASE_URL?.startsWith('https://') &&
        window.RUTA_SUPABASE_KEY && !window.RUTA_SUPABASE_KEY.includes('PEGA_') &&
        window.supabase?.createClient;
      if (!configured) return backToLogin();
      const db = window.supabase.createClient(window.RUTA_SUPABASE_URL, window.RUTA_SUPABASE_KEY);
      const { data: { user } } = await db.auth.getUser();
      if (!user) return backToLogin();
      const { data: profile, error } = await db.from('ruta_profiles')
        .select('role,access_status').eq('id',user.id).single();
      if (error || !profile) return backToLogin();
      if (profile.role === 'teacher' ||
          (profile.role === 'student' && profile.access_status === 'approved')) {
        document.documentElement.setAttribute('data-ruta-access','ok');
        return;
      }
      backToLogin();
    } catch (error) {
      backToLogin();
    }
  })();
})();

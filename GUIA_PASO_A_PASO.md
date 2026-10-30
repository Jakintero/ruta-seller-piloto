# Ruta Seller · PILOTO SEGURO de revisión de tareas

## Qué incluye y qué NO hace todavía

Este proyecto es una copia de pruebas **independiente**. NO sustituye ni modifica
https://jakintero.github.io/ruta-seller-herramientas/

Funciones que tendrás **después de configurar Supabase**:
- Registro/inicio de sesión mediante correo y contraseña.
- Un estudiante guarda hasta 5 productos y una foto por producto.
- Evaluación automática con los 7 criterios de la plantilla Excel, hasta 100 puntos.
- Guardado automático después de escribir (y botón «Guardar ahora»).
- Botón «Entregar tarea»; bloquea edición mientras esperas la revisión.
- Panel /profesor.html: ver alumnos, productos, fotos, puntuaciones y estado.
- Aprobar o solicitar correcciones mediante comentario.
- Los permisos se verifican en Supabase (RLS + funciones), no solo ocultando botones.

Todavía NO incluye:
- Correos automáticos al profesor: una entrega nueva aparece en «Por revisar».
- Historial de varias tareas ni historial de rentabilidad/PPC.
- Conexión con las calculadoras del sitio oficial.
- Inscripción restringida automáticamente a estudiantes que compraron el curso.
- Supabase configurado: lo debes crear en TU cuenta para que funcionen las cuentas.

## PASO 1 · Crear el repositorio independiente

1. Ve a https://github.com/new
2. Repository name: `ruta-seller-piloto`
3. Visibility: `Public` (los HTML son públicos; la información de alumnos es privada en Supabase).
4. Crea el repositorio.
5. Descomprime el ZIP y sube a la raíz todos los archivos del paquete,
   **NO el ZIP cerrado**. Confirma con «Commit changes».
6. Settings > Pages > Source «Deploy from a branch», branch «main», folder «/(root)».
7. El sitio de pruebas tendrá una URL similar a:
   `https://jakintero.github.io/ruta-seller-piloto/`

IMPORTANTE: no subas estos archivos al repositorio oficial `ruta-seller-herramientas`.
La versión pública existente permanece intacta.

## PASO 2 · Crear un proyecto NUEVO en Supabase

1. Ve a https://supabase.com/dashboard y entra/crea cuenta.
2. «New project» > nombre sugerido `ruta-seller-piloto`.
3. Selecciona una contraseña de base de datos fuerte (guárdala solo tú).
4. Una vez creado el proyecto, abre SQL Editor > «New query».
5. Abre `supabase-setup.sql` y pega **todo su contenido**.
6. Ejecuta con «Run». Comprueba que no muestra errores.

Este SQL crea tres tablas privadas, funciones seguras y un bucket privado
de fotografías. La seguridad permite al estudiante leer solo sus datos, y al
profesor autorizado ver y revisar las entregas.

NO uses el SQL en una base de datos donde ya tengas sistemas importantes.

## PASO 3 · Conectar GitHub con Supabase

1. En Supabase entra a «Project Settings > API Keys» (o «Connect» según interfaz).
2. Copia la **Project URL** y la clave **publishable** (`sb_publishable_...`) o
   la clave heredada `anon` pública.
3. En el archivo `supabase-config.js`, reemplaza:

   window.RUTA_SUPABASE_URL = 'PEGA_AQUI_URL_SUPABASE';
   window.RUTA_SUPABASE_KEY = 'PEGA_AQUI_CLAVE_PUBLICABLE';

4. Guarda el archivo y actualízalo en el repositorio `ruta-seller-piloto`.
5. ¡NUNCA pongas `service_role`, `secret`, la contraseña de la base de datos
   ni contraseñas personales en archivos de GitHub!

Es correcto que la clave PUBLICABLE de Supabase esté en el código del navegador;
la privacidad se aplica mediante las políticas RLS instaladas en la base de datos.

## PASO 4 · Configurar URLs y correo

En Supabase: Authentication > URL Configuration:
- Site URL: `https://jakintero.github.io/ruta-seller-piloto/`
- Agrega Redirect URL: `https://jakintero.github.io/ruta-seller-piloto/`

Authentication > Providers > Email:
- Para pruebas reales **se recomienda Confirm email activado**.
- El correo integrado de Supabase está limitado a correos del equipo autorizado
  y a un ritmo bajo. Para invitar a estudiantes con correos reales, configura
  tu proveedor SMTP o un proveedor compatible.

Si vas a probar únicamente con correos de TU equipo y quieres verificar el
flujo inicial, empieza con una cuenta tuya.
No desactives verificación de correo al abrir el sistema a estudiantes.

## PASO 5 · Darte acceso de profesor

1. En el sitio piloto, crea una cuenta con TU correo.
2. Confirma el correo cuando el proveedor de email esté configurado.
3. En Supabase > SQL Editor, ejecuta esta instrucción POR SEPARADO
   cambiando el correo de ejemplo por el tuyo:

   UPDATE public.ruta_profiles
   SET role = 'teacher'
   WHERE lower(email) = lower('TU-CORREO@EJEMPLO.COM');

4. Cierra sesión e inicia sesión otra vez.
5. La web te llevará a `https://jakintero.github.io/ruta-seller-piloto/profesor.html`.

NUNCA concedas el rol docente desde el formulario público.
Solo asigna el rol desde tu panel privado de Supabase.

## PASO 6 · Prueba con dos estudiantes

1. Crea dos cuentas de prueba desde el sitio piloto (correos diferentes).
2. Con el estudiante A, registra 1 producto, completa sus 7 criterios y sube
   una fotografía. Comprueba que el guardado dice «Guardado en la nube».
3. Cierra sesión e inicia en otro navegador. Verifica que los datos reaparezcan.
4. Pulsa «Entregar tarea para revisión».
5. Entra como profesor a `profesor.html`. Filtra «Por revisar».
6. Abre el estudiante A, revisa datos y foto, escribe una observación
   y selecciona «Solicitar correcciones».
7. Entra como estudiante A: debe ver tu comentario y poder editar.
8. Vuelve a entregar; como profesor, aprueba.
9. Comprueba que el alumno B NO puede ver las fotos ni datos del A.
10. Comprueba que el alumno A NO puede abrir el panel de profesor.

Nota: el botón de entregar exige al menos un producto completo.
Los restantes cuatro son opcionales, pero si comenzaste a llenar uno,
debes terminar sus criterios antes de entregar.

## Reglas de puntuación

La hoja Excel original contempla:
Precio $20–50: 10, otros 0;
Competencia china <50%: 10 y >50%: 0;
Diferenciación sí: 20/no: 0;
Marcas dominantes 0: 10, 1–3: 0;
Reseñas <500: 10, >500: 0;
Demanda <25 keywords de 300+ búsquedas: 0, >25: 20;
Rentabilidad <25%: 0, >25%: 20.

La plantilla NO define exactamente 50% de competencia china,
500 reseñas, 25 keywords, 25% de rentabilidad, ni más de 3 marcas.
El piloto muestra «Revisar» y NO inventa puntos para esos valores.

## Lo que hay que vigilar antes de abrirlo al público

- Probar RLS con 2 cuentas separadas y verificar los permisos reales.
- Configurar SMTP, confirmación de correo y recuperación de contraseña.
- Decidir cómo autorizar solo alumnos matriculados.
- Añadir política de privacidad y controles de eliminación de cuenta/datos.
- Programar copias de seguridad de la base de datos y de Storage.
- Realizar pruebas de seguridad y revisar límites, costos y logs.

## Archivos

- index.html: registro/inicio de sesión y herramienta del alumno.
- profesor.html: panel docente privado.
- estilos.css: diseño adaptable a móvil.
- reglas.js: los 7 criterios originales y su puntuación.
- alumno.js: registro, guardado, fotos y entrega.
- profesor.js: consulta y revisión de tareas.
- supabase-config.js: dónde pegar tu URL y clave pública.
- supabase-setup.sql: esquema, RLS, funciones y fotos privadas.
- logo-ruta-seller.png: logo de Ruta Seller.

### Enlaces oficiales de referencia

https://supabase.com/docs/guides/auth/managing-user-data
https://supabase.com/docs/guides/database/postgres/row-level-security
https://supabase.com/docs/guides/storage/security/access-control
https://supabase.com/docs/guides/auth/auth-smtp
https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site

Diseñado como PILOTO. El código no ha sido desplegado ni probado contra
tu proyecto Supabase real porque aún no se conocen sus credenciales públicas.

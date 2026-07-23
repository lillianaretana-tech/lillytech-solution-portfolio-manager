# LillyTech Solution Portfolio Manager — Instalación (Etapa 2)

## Qué incluye esta entrega

```
lillytech-portfolio-manager/
├── sql/
│   ├── 01_tables.sql              (12 tablas + funciones + triggers de updated_at)
│   ├── 02_indexes_constraints.sql (índices de búsqueda/filtro)
│   ├── 03_rls_policies.sql        (Row Level Security: admin/editor/viewer — SE EJECUTA AL FINAL)
│   ├── 04_seed_questions.sql      (17 secciones + 136 preguntas del catálogo maestro)
│   └── 05_admin_bootstrap.sql     (promueve tu usuario a admin — SE EJECUTA ANTES QUE 03)
└── docs/
    └── INSTALACION.md             (este archivo)
```

**Nota:** el nombre de cada archivo (`01`, `02`...) refleja su rol lógico
dentro del modelo, no necesariamente el orden real de ejecución. El
orden real de ejecución es el que se detalla en la siguiente sección —
`03_rls_policies.sql` se ejecuta después de `05_admin_bootstrap.sql`,
por la razón explicada más abajo. No se renombraron los archivos para
mantener consistencia con la entrega anterior.

El frontend (Etapa 3 en adelante) todavía no está incluido en esta entrega,
tal como se acordó.

## Orden exacto de ejecución (CORREGIDO)

1. Crear el proyecto nuevo en Supabase (exclusivo para esta app).
2. `01_tables.sql`
3. `02_indexes_constraints.sql`
4. `04_seed_questions.sql`
5. Crear tu usuario (ver paso "Crear tu usuario administrador" abajo).
6. `05_admin_bootstrap.sql` (con tu correo real editado en el archivo).
7. `03_rls_policies.sql`

**`03_rls_policies.sql` ahora es el último archivo, no el tercero.** El
motivo es que ese archivo instala el trigger `trg_profiles_role_guard`,
que bloquea cualquier cambio a `profiles.role` si quien ejecuta la
operación no es ya admin. Ese trigger se ejecuta siempre — incluso para
el superusuario del SQL Editor — porque los triggers de base de datos
no se saltan por privilegios de rol (a diferencia de RLS, que sí se
salta para el propietario de las tablas). Si `03` se ejecutara antes de
tener un admin, `05_admin_bootstrap.sql` fallaría, porque dentro del
SQL Editor `auth.uid()` es `null` y por lo tanto `is_admin()` siempre
devuelve `false`. Ejecutar `05` antes de `03` evita el bloqueo sin
necesidad de desactivar ninguna protección.

## Dependencias definitivas entre archivos

| Archivo | Depende de | Notas |
|---|---|---|
| `01_tables.sql` | Nada (primer archivo) | Crea las 12 tablas, `set_updated_at()` y `handle_new_user()`. |
| `02_indexes_constraints.sql` | `01_tables.sql` | Necesita que las tablas ya existan. |
| `04_seed_questions.sql` | `01_tables.sql` + `02_indexes_constraints.sql` | Necesita las tablas del catálogo y el índice único `uq_questions_section_order` para el `ON CONFLICT`. **No depende de `03`**: se ejecuta como propietario de las tablas, que por defecto omite RLS. |
| (crear usuario) | `01_tables.sql` | El trigger `handle_new_user()` (creado en `01`) debe existir antes de crear el usuario, para que se genere automáticamente su fila en `profiles`. |
| `05_admin_bootstrap.sql` | `01_tables.sql` + usuario ya creado en `auth.users` | **No depende de `03`** — de hecho debe ejecutarse *antes* de `03`, precisamente porque el trigger de protección de roles que crea `03` bloquearía este paso si ya estuviera activo. |
| `03_rls_policies.sql` | `01_tables.sql` + admin ya existente (creado por `05`) | Se ejecuta al final. No depende de `02` ni de `04` técnicamente, pero debe ejecutarse después de `05` por la razón explicada arriba. |

## Por qué este orden es seguro (explicación de la corrección)

El problema detectado no era de datos ni de permisos de usuario: era una
dependencia de secuencia entre dos archivos que, individualmente,
estaban bien escritos. `03_rls_policies.sql` asume que ya existe un
admin para poder proteger el campo `role`; `05_admin_bootstrap.sql`
necesita crear ese primer admin. Si `03` se ejecuta primero, se crea una
situación de "candado sin llave": nadie puede cambiar ningún rol,
porque para cambiar un rol hace falta ya ser admin, y no hay ningún
admin todavía.

La corrección no relaja ninguna protección — el trigger
`trg_profiles_role_guard` se mantiene exactamente igual. Solo se cambia
el momento en que se instala: después de que ya existe un admin
legítimo, en vez de antes. Es el mismo principio que crear la primera
llave maestra de un edificio antes de instalar la cerradura que exige
esa llave.

`04_seed_questions.sql` no se ve afectado por este cambio de orden: es
un conjunto de `INSERT` ejecutados por el propietario de las tablas
(que omite RLS por diseño de Postgres), así que es indiferente si se
ejecuta antes o después de `03` o `05` — el resultado del catálogo es
exactamente el mismo en cualquier caso.

## Cómo ejecutar el SQL

1. Entra a tu proyecto en [supabase.com](https://supabase.com) → **SQL Editor**.
2. Abre `01_tables.sql`, copia todo el contenido, pégalo en una consulta nueva y ejecuta (`Run`).
3. Repite el mismo proceso para `02_indexes_constraints.sql` y `04_seed_questions.sql`, en ese orden.
4. Crea tu usuario (ver paso siguiente).
5. Ejecuta `05_admin_bootstrap.sql` (con tu correo ya editado en el archivo, una sola vez, en `v_email`).
6. Ejecuta `03_rls_policies.sql` al final.
7. Revisa que cada ejecución termine sin errores antes de pasar al siguiente archivo. `05` en particular imprime un único `NOTICE` con correo, UUID y rol confirmado si todo salió bien, o una excepción explícita si algo falló — no continúes al paso 6 sin ver ese `NOTICE` final.

No hay necesidad de usar la CLI de Supabase para esta primera versión;
el SQL Editor del dashboard es suficiente.

## Crear tu usuario administrador

1. Ejecuta primero `01_tables.sql`, `02_indexes_constraints.sql` y `04_seed_questions.sql`.
2. Ve a **Authentication → Users → Add user** en el dashboard de Supabase.
3. Crea tu usuario con tu correo y una contraseña.
4. Verifica en **Table Editor → profiles** que se creó automáticamente una fila para tu usuario con `role = 'viewer'` (esto lo hace el trigger `handle_new_user`, ya activo desde `01`).
5. Abre `05_admin_bootstrap.sql`, reemplaza `'tu-correo@ejemplo.com'` por tu correo real. El correo se edita **una sola vez** en todo el archivo, en la línea `v_email text := '...'` dentro del bloque `DO`; toda la verificación (incluida la final) se resuelve a partir de esa misma variable y del `v_user_id` que se obtiene de ella — ya no hay una consulta `SELECT` separada al final que repita el correo por su cuenta.
6. Ejecuta el archivo en el SQL Editor. El bloque `DO` hace, en este orden:
   - Confirma que el correo existe en `auth.users` y es único.
   - Confirma que existe exactamente un perfil asociado en `profiles`.
   - Actualiza `role = 'admin'` y confirma que se afectó exactamente una fila.
   - Vuelve a leer el perfil por `v_user_id` y confirma expresamente que existe una sola fila y que su `role` quedó en `'admin'`.
   - Si todo lo anterior es correcto, termina con un único mensaje `NOTICE` que muestra correo, UUID y rol confirmado, por ejemplo: `NOTICE: Correo: nombre@dominio.com | UUID: 6f2e... | Rol confirmado: admin`.
   - Si cualquier paso falla, se detiene con una excepción explícita en vez de continuar en silencio o dejar un resultado ambiguo.
7. Solo después de ver ese `NOTICE` final, ejecuta `03_rls_policies.sql`.

## Variables de entorno (para cuando llegue el frontend en Etapa 3)

Vas a necesitar del dashboard de Supabase (**Project Settings → API**):

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Estas son las únicas dos claves que se usarán en el frontend. La
`service_role key` **nunca** se coloca en el navegador ni en el repositorio.

## Checklist para revisar el SQL antes de ejecutarlo

- [ ] Confirmaste que el proyecto de Supabase es nuevo y exclusivo para esta app (no OnboardFlow, Safety Academy, ni proyectos de clientes SBM).
- [ ] Confirmaste el orden correcto: `01 → 02 → 04 → (crear usuario) → 05 → 03`. **`03` va al final, no de tercero.**
- [ ] Revisaste `01_tables.sql` y no encontraste ningún `DROP TABLE`.
- [ ] Revisaste que ningún archivo contiene claves, contraseñas ni `service_role key`.
- [ ] Confirmaste que las 12 tablas están presentes: `profiles`, `documentation_sections`, `documentation_questions`, `solutions`, `solution_answers`, `solution_features`, `solution_roles`, `solution_reports`, `solution_metrics`, `solution_use_cases`, `solution_integrations`, `solution_activity_log`.
- [ ] Confirmaste que las 12 tablas tienen RLS habilitado (`alter table ... enable row level security`) en `03_rls_policies.sql`.
- [ ] Confirmaste que no existe ninguna política de `DELETE` sobre `solutions`, `solution_answers`, `documentation_sections` ni `documentation_questions` (solo desactivación lógica).
- [ ] Confirmaste que sí existen políticas de `DELETE` sobre las 6 listas dinámicas (`solution_features`, `solution_roles`, `solution_reports`, `solution_metrics`, `solution_use_cases`, `solution_integrations`), tal como pediste para poder eliminarlas con confirmación desde la interfaz.
- [ ] Revisaste el conteo del seed: 17 secciones y 136 preguntas (puedes verificarlo después de ejecutar `04` con `select count(*) from documentation_sections;` y `select count(*) from documentation_questions;`).
- [ ] Entiendes que el `answer_type` asignado a cada pregunta en el seed es una primera clasificación razonable (texto corto/largo/booleano), y que la puedes ajustar libremente después desde la pantalla de administración del catálogo (Etapa 3) sin tocar SQL.
- [ ] Entiendes que archivar una solución (`is_archived = true`) no borra ninguna de sus respuestas, funcionalidades, roles, reportes, métricas, casos de uso ni integraciones — todo permanece en la base de datos.
- [ ] Confirmaste que `05_admin_bootstrap.sql` se ejecuta **antes** de `03_rls_policies.sql`, y que solo debes avanzar a `03` después de ver el `NOTICE` final con correo, UUID y rol confirmado.
- [ ] Revisaste que `05_admin_bootstrap.sql` falla con un mensaje explícito (no en silencio) en los cinco casos de error contemplados: correo inexistente en `auth.users`, resultados ambiguos, perfil inexistente en `profiles`, cero filas actualizadas o más de una, y verificación final donde el `role` no quedó en `'admin'`.
- [ ] Confirmaste que el correo se edita una sola vez en todo el archivo (en `v_email`) y que ninguna otra consulta, incluida la verificación final, repite ese literal por su cuenta.
- [ ] Confirmaste que el trigger `trg_profiles_role_guard` sigue exactamente igual — no se eliminó ni se debilitó, solo se movió el momento en que se instala.

## Confirmación expresa de seguridad

- No se utilizó `DROP TABLE` en ningún archivo.
- No se utilizó `DROP DATABASE`, `TRUNCATE` ni `DELETE` masivo en ningún archivo.
- No se incluyó ninguna credencial, clave, token ni `service_role key` en ningún archivo.
- No se insertó ninguna solución ni respuesta de ejemplo/ficticia — solo el catálogo estructural de secciones y preguntas, tal como se pidió.

## Qué falta (fases futuras, sin tocar en esta entrega)

- Etapa 4: formulario documental completo (17 secciones, 136 preguntas), guardado por sección, marcar "No aplica" / "Pendiente de confirmar", las 6 listas dinámicas (funcionalidades, roles, reportes, métricas, casos de uso, integraciones).
- Etapa 5: reporte individual, reporte consolidado, exportación JSON/Markdown, vista imprimible.
- Etapa 6: validación final, checklist de aceptación completo, documentación de despliegue.
- Facturación, pagos, firma digital, notificaciones, IA integrada, integraciones externas reales — explícitamente fuera de alcance para esta primera versión.

---

# Etapa 3 — Autenticación, panel principal y administración de soluciones

## Archivos nuevos

```
lillytech-portfolio-manager/
├── index.html                  (login)
├── dashboard.html               (panel principal)
├── solution-edit.html           (alta/edición de información general)
├── css/
│   └── styles.css               (sistema de diseño compartido)
├── js/
│   ├── config.js                (SUPABASE_URL + SUPABASE_ANON_KEY — ya con tus valores reales)
│   ├── supabase-client.js       (cliente único de Supabase)
│   ├── auth.js                  (guarda de sesión, perfil/rol, logout)
│   ├── constants.js             (estados de desarrollo/documental, helpers de formato)
│   ├── activity-log.js          (helper de trazabilidad)
│   ├── progress.js              (cálculo de avance contra el catálogo maestro vigente)
│   ├── dashboard.js             (lógica del panel principal)
│   └── solution-edit.js         (lógica de alta/edición)
└── .env.example                 (documental — la app real usa js/config.js)
```

## Qué quedó funcionando

- **Login** con Supabase Auth (`index.html`). Si ya hay sesión activa, salta directo al panel. Traduce los errores más comunes ("credenciales inválidas") a español simple.
- **Guarda de sesión** en todas las páginas protegidas: si no hay sesión, redirige al login sin mostrar nada de la app.
- **Panel principal** (`dashboard.html`):
  - Tarjetas de resumen: total de soluciones activas, completas, en proceso, pendientes de revisión, avance general promedio.
  - Tabla con nombre, categoría, estado de desarrollo, estado documental, avance (barra + %), última actualización, acciones.
  - Búsqueda por nombre/nombre corto/descripción y filtros por categoría, estado de desarrollo, estado documental, área y rango de avance.
  - Checkbox "Ver archivadas" para alternar entre listado activo y archivado.
  - Aviso automático cuando una solución marcada como "Completa" tiene preguntas nuevas del catálogo sin responder (comportamiento acordado en la decisión #5: el avance se recalcula siempre contra el catálogo vigente).
- **Administración de soluciones** (`solution-edit.html`):
  - Crear solución nueva y editar información general (todos los campos de la Sección 1: nombre, nombre corto, descripción breve, categoría, versión, estados, área principal, áreas adicionales, responsable, observaciones).
  - Sugerencias de autocompletado para categoría y área, basadas en lo ya registrado (evita categorías duplicadas por error de tipeo).
  - Validación mínima: el nombre es obligatorio: el resto de campos puede quedar vacío y guardarse igual, tal como pide la sección 6 del documento original ("no exigir que todas las preguntas estén completas para guardar").
- **Archivar / Restaurar** con modal de confirmación explícito. Nunca borra información — solo cambia `is_archived` y `archived_at`. El modal dice explícitamente que las respuestas, funcionalidades, roles, etc. permanecen intactos.
- **Registro de actividad**: cada creación, edición, archivo y restauración queda en `solution_activity_log`.
- **Roles aplicados en la interfaz**: un `viewer` ve el botón como "Abrir" en vez de "Editar", el formulario se muestra deshabilitado con un aviso, y no ve los botones de "Nueva solución" ni "Archivar/Restaurar". Esto es una capa de UX — la protección real ya está en las políticas RLS de `03_rls_policies.sql`, así que aunque alguien manipule el HTML, Supabase rechazará cualquier escritura no autorizada.

## Decisión de diseño: cálculo de avance ya funcional

Aunque el formulario documental completo es la Etapa 4, ya implementé `js/progress.js` con la lógica real de cálculo (sección 7 del documento): cuenta preguntas activas del catálogo, cruza con `solution_answers`, y calcula el % en base a respuestas completas (con texto o marcadas "No aplica", y no marcadas como "pendiente de confirmar"). Ahora mismo mostrará 0% para todo porque todavía no existe la pantalla para responder preguntas — es el comportamiento esperado, no un error. Lo hice ahora porque el panel principal necesita ese número para las tarjetas de resumen y la columna de avance, y así evito tener que tocar esta lógica de nuevo en la Etapa 4.

## Qué NO se incluyó todavía (a propósito)

- El botón "Continuar documentación" del panel original (sección 8) no aparece todavía: apunta al formulario completo por secciones, que es la Etapa 4. Prefería no dejar un enlace que no lleva a ningún lado ("no dejar acciones ambiguas", sección 15) — cuando esté lista la Etapa 4, este botón se agrega junto con "Vista previa", "Generar reporte" y "Exportar".
- No hay pantalla de administración del catálogo maestro todavía (la que confirmaste en el punto 3 de tus decisiones). La agrego en la Etapa 4, junto con el formulario que la consume, para que tenga sentido probarlas juntas.

## Cómo probarlo

1. Abre `index.html` en un navegador (puedes simplemente abrirlo como archivo local, o servirlo con cualquier servidor estático — no necesita build).
2. Ingresa con tu correo (`iretana@yahoo.com`) y la contraseña que definiste al crear el usuario.
3. Deberías caer en `dashboard.html`, vacío, con el mensaje "Todavía no hay soluciones registradas".
4. Crea una solución de prueba con "+ Nueva solución", guarda, y confirma que aparece en la tabla con 0% de avance.
5. Prueba archivar esa solución de prueba y confirma que desaparece del listado activo pero aparece al marcar "Ver archivadas". Restáurala.
6. Cierra sesión y confirma que te regresa al login.

## Riesgo a revisar

`js/config.js` contiene tu `SUPABASE_URL` y `SUPABASE_ANON_KEY` reales en texto plano dentro del repositorio. Esto es seguro porque la anon key está diseñada para ser pública (así funciona cualquier frontend de Supabase), pero si en algún momento este repo se vuelve público en GitHub, alguien podría ver esos valores — no es un problema de seguridad por sí mismo (RLS protege los datos igual), pero si prefieres no exponerlos así, dime y lo cambiamos a un patrón donde `config.js` no se versiona (`.gitignore`) y se sube manualmente al servidor de despliegue.

---

# Etapa 4 — Formulario documental, progreso, catálogo maestro

## Archivos nuevos

```
lillytech-portfolio-manager/
├── solution-form.html          (formulario documental por secciones)
├── catalog-admin.html          (administración del catálogo — solo admin)
└── js/
    ├── dynamic-lists.js        (CRUD genérico para las 6 listas dinámicas)
    ├── solution-form.js        (navegación de secciones, preguntas, guardado, progreso)
    └── catalog-admin.js        (alta/edición/activación de secciones y preguntas)
```

`js/constants.js` se amplió con `ANSWER_TYPES`, `FEATURE_STATUS`, `INTEGRATION_STATUS` y `DYNAMIC_LIST_CONFIGS` (la configuración declarativa de las 6 listas dinámicas — un solo lugar que describe tabla, campos y etiquetas de cada una).

`dashboard.html`/`dashboard.js` se actualizaron: el botón "Documentar" / "Ver documentación" ya lleva a `solution-form.html`, y aparece un enlace "Catálogo maestro" en el encabezado, visible solo para tu rol de admin.

## Qué quedó funcionando

- **Formulario documental completo**: las 17 secciones y sus 136 preguntas se leen en vivo desde `documentation_sections` y `documentation_questions` — cero preguntas escritas en el código, tal como era el objetivo central del proyecto.
- **Navegación lateral por secciones**, con un punto de color por sección (gris = sin empezar, ámbar = parcial, verde = completa) y el conteo "completadas / total".
- **Guardado confiable por sección** (no autosave por tecla, para no saturar la base con escrituras constantes): un botón "Guardar sección" guarda todas las respuestas de la sección activa de una sola vez, muestra la hora del último guardado, y avisa con un `confirm()` si intentas cambiar de sección o cerrar la pestaña con cambios sin guardar.
- **"No aplica" y "Pendiente de confirmar"** como casillas independientes por pregunta (solo se ofrece "No aplica" en las preguntas que el catálogo marcó como `allow_not_applicable`).
- **Tipos de respuesta según el catálogo**: texto corto, texto largo, número, fecha, sí/no, selección de opciones — el formulario elige el control correcto automáticamente según `answer_type`.
- **Las 6 listas dinámicas** (funcionalidades, roles, reportes, métricas, casos de uso, integraciones) aparecen dentro de su sección correspondiente, con alta, edición y eliminación con confirmación — como pediste en la sección 5 del documento original.
- **Progreso real**: la barra superior y los puntos de navegación se recalculan en el momento contra el catálogo activo vigente, con el mismo criterio ya usado en el panel principal (respuesta con texto o "No aplica", y sin estar marcada "pendiente de confirmar", cuenta como completa).
- **Administración del catálogo maestro** (`catalog-admin.html`, solo visible/accesible para admin): crear, editar (nombre/descripción), reordenar y activar/desactivar secciones; crear, editar (redacción, tipo de respuesta, ayuda, orden, obligatoriedad, si admite "No aplica"), reordenar y activar/desactivar preguntas. Nunca se ofrece borrado físico — ni de secciones ni de preguntas — solo desactivación lógica, tal como confirmaste.

## Cómo probar que el catálogo maestro es realmente flexible

Esta es la prueba que justifica toda la arquitectura:

1. Entra a "Catálogo maestro" (solo visible como admin).
2. Selecciona cualquier sección, por ejemplo "Valor para la Organización".
3. Agrega una pregunta nueva, por ejemplo "¿Qué indicadores KPI genera esta solución?".
4. Ve a `solution-form.html` de tu solución de prueba — la pregunta nueva ya aparece ahí, sin haber tocado una sola línea de código.
5. Si esa solución ya estaba marcada como "Completa", su % de avance en el panel principal debería bajar, y debería aparecer el aviso "Se agregaron nuevas preguntas al catálogo documental" — es el comportamiento acordado en la decisión #5, ahora demostrable de punta a punta.

## Decisiones tomadas dentro del alcance ya acordado

- **Reordenar preguntas dentro de una sección** usa un swap de 3 pasos (valor temporal `-1` antes de intercambiar) porque `(section_id, order_index)` tiene una restricción única — evita que el intercambio choque consigo mismo a mitad de camino. Las secciones no tienen esa restricción, así que su reordenamiento es un swap directo de 2 pasos.
- **Eliminar filas de las listas dinámicas** usa `window.confirm()` del navegador en vez de un modal propio (como el de archivar soluciones) — es una confirmación real igualmente, solo más liviana, ya que aplicarla 6 veces con un modal completo habría sido sobreingeniería para esta primera versión.
- **Los campos de las 6 listas dinámicas** son exactamente los que especificaste en cada sección del documento original (funcionalidades: nombre/descripción/estado/orden/observaciones; roles: nombre/descripción/responsabilidades/nivel de acceso/observaciones; etc.) — ninguno inventado, ninguno omitido.

## Qué falta (fases futuras)

- Etapa 5: reporte individual, reporte consolidado, exportación JSON/Markdown, vista imprimible.
- Etapa 6: validación final, checklist de aceptación completo, documentación de despliegue.

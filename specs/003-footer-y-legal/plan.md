# Plan 003: pie de página y páginas legales

Borrador para aprobar. La spec es `spec.md` (el qué); este archivo es el cómo.

Rama confirmada por Luis: **`testing`**. El `CLAUDE.md` del proyecto sigue diciendo `rediseno-v2` y se deja así por decisión suya.

Pruebas: todo se prueba con `npm run dev` en la terminal, en el teléfono y en la laptop. No se sube a Netlify para probar, porque cada despliegue gasta créditos del plan gratis.

## Contexto técnico

- Portada: `frontend/src/pages/Landing.tsx`. El pie actual son dos líneas al final del archivo.
- Contacto público: viene del backend en `InfoPublica` (`frontend/src/lib/tipos.ts`) desde `PublicoService` y se edita en el panel (`/panel/admin`). Campos actuales: `whatsapp`, `correo`, `direccion`, `instagram`, `facebook`, `tiktok`.
- Rutas: `frontend/src/App.tsx` con `react-router-dom`. Ya hay una página 404 propia (`NoEncontrada`).
- Componentes y clases: `frontend/src/components/ui.tsx` e `index.css` (`.btn`, `.tarjeta`, `.contenedor`, colores `marino`, `oro`, `rojo`). No se inventan colores ni radios nuevos.
- Anclas de la portada: `#tarifas`, `#calculadora`, `#rastreo`, `#contacto` y `#como-funciona` (nueva).

## Decisiones (y opciones descartadas)

| Tema | Decisión | Descartado y por qué |
| --- | --- | --- |
| Pie | Un componente `Pie` en `frontend/src/components/Pie.tsx`, usado por la portada, las páginas legales y la 404 | Copiar el pie en cada página (se desactualiza y contradice RF-12) |
| Datos de la empresa | Se agrega `correo` al bloque `contacto` que ya edita el administrador. Nada más | Razón social, RIF y domicilio fiscal (Luis decidió no publicarlos) |
| Correo | `contacto@venviosexpress.com` como valor inicial, editable desde el panel | Inventar un Gmail personal que no se sabe si existe |
| Rutas legales | `/terminos` y `/privacidad`, nada más | Agregar páginas que Luis no pidió o cuyo contenido no está confirmado |
| Contenido legal | Un archivo `contenido.ts` con secciones y fecha, y una pantalla común que lo muestra | Markdown con una librería nueva (dependencia extra para texto que cambia poco); HTML suelto dentro del componente (difícil de probar y de mantener) |
| Aviso de borrador | Bloque visible arriba del texto, con color de aviso, no una nota al pie | Nota pequeña al final (se pasa por alto y da falsa sensación de texto aprobado) |
| Enlaces externos | Componente `EnlaceExterno` que fija `target="_blank"` y `rel="noopener noreferrer"` | Repetir los atributos a mano en cada enlace (se olvida uno y queda un enlace inseguro) |
| Año del copyright | `new Date().getFullYear()` al mostrar | Escribir el año (se vence cada enero) |
| Enlaces a secciones desde otras páginas | `<a href="/#ancla">` cuando no se está en la portada, y `#ancla` cuando sí. La portada hace scroll al ancla al cargar | `<Link>` con hash (React Router no hace scroll solo) |
| Cookies y medición | No se tocan. Queda la spec 016 para cuando exista la cuenta de Google Analytics | Instalar un aviso para algo que todavía no se mide (molesta sin motivo) |

## Cambios por capa

**Backend**
- `backend/src/config/predeterminados.ts`: `correo` en `Contacto`, con el valor genérico.
- `backend/src/services/ConfigService.ts`: valida el correo solo cuando tiene contenido y completa el valor cuando la configuración guardada es vieja.
- `backend/src/services/PublicoService.ts`: ya entrega `contacto`; se confirma que el correo viaja.
- `backend/tests/contacto.test.ts`: valores iniciales, guardar y ver en público, correo vacío permitido, correo inválido rechazado y configuración vieja completada.

**Frontend**
- `frontend/src/components/Pie.tsx`: marca, descripción, redes, cuatro columnas, botón principal y franja inferior.
- `frontend/src/components/EnlaceExterno.tsx`: enlace seguro para pestaña nueva.
- `frontend/src/components/LayoutPublico.tsx`: trae el contacto una vez y arma la columna con el contenido y el pie.
- `frontend/src/pages/legal/contenido.ts` y `PaginaLegal.tsx`: texto y pantalla de Términos y de Privacidad.
- `frontend/src/App.tsx`: rutas nuevas y la 404 con pie.
- `frontend/src/pages/Landing.tsx`: usa `Pie`, quita el pie viejo y el `@venviosexpress` escrito a mano, agrega `id="como-funciona"` y hace scroll al ancla al cargar.
- `frontend/src/pages/panel/Administracion.tsx` y `frontend/src/lib/tipos.ts`: campo de correo.

**Pruebas**
- `frontend/tests/pie.test.tsx`: columnas, año, crédito, WhatsApp desde la configuración, enlaces solo a destinos existentes, enlaces externos seguros, enlaces con ruta completa desde una página legal y pie sin datos.
- `frontend/tests/legal.test.tsx`: título, fecha, aviso de borrador, secciones, privacidad, ausencia de temas no confirmados, ruta `/terminos` y 404.

## Orden de construcción

1. Correo en la configuración (backend y tipos).
2. Componente de pie con las columnas y la franja inferior.
3. Crédito, año, CTA y enlaces solo a destinos existentes.
4. Responsive y revisión visual de 375 px a 1280 px.
5. Pantalla común de páginas legales y rutas.
6. Redacción de Términos y condiciones y de Política de privacidad con los datos disponibles.
7. Pie en portada, legales y 404; revisión de enlaces.
8. Prueba manual final en teléfono y laptop con `npm run dev`.

## Riesgos y cuidados

- **El pie no puede prometer páginas que no existen.** Solo se enlazan Términos y Privacidad cuando ya están escritas.
- **Los enlaces del pie deben apuntar a algo real:** anclas de la portada o rutas registradas. La prueba automática lo verifica.
- **No se toca el historial de Git** en esta spec. Cualquier limpieza de secretos va en la spec 004 y con autorización expresa.
- **No se despliega a Netlify para probar.** Todo con `npm run dev`.

## Lo que no entra aquí

La lista de seguridad y SEO se reparte en specs separadas (004 a 016, detalladas en `spec.md`). Esta spec no cambia autenticación, base de datos, cabeceras, formularios, cookies ni el resto de enlaces del sitio.

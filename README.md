# DiTareas

Gestor de tareas diarias con almacenamiento en base de datos SQLite.

## Cómo ejecutar

1. Abre una terminal en la carpeta `ReDiario`.
2. Instala dependencias con Bun o npm:
   ```bash
   bun install
   # o si no funciona:
   npm install
   ```
3. Inicia el servidor:
   ```bash
   bun run start
   # o con npm:
   npm start
   ```
4. Abre en tu navegador:
   ```
   http://localhost:3000
   ```

## Qué incluye

- `index.html`: panel principal con resumen y accesos rápidos.
- `tareas.html`: listado de tareas con acciones para completar, agregar evidencia y eliminar.
- `nueva-tarea.html`: formulario para crear tareas nuevas.
- `css/styles.css`: diseño visual moderno y profesional.
- `js/app.js`: frontend que usa la API para guardar tareas, incluyendo evidencia en imagen.
- `server.js`: servidor Express con SQLite.
- `database/Ditarea.sqlite`: base de datos donde se almacenan las tareas.

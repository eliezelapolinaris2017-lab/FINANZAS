# Finanzas Web App (HTML/CSS/JS)

App web de finanzas 100% front-end (sin frameworks) lista para desplegar en **GitHub Pages**. Incluye:

- SPA con panel lateral, vistas ocultables.  
- Login por PIN (hash con Web Crypto, 5 intentos máximo).  
- CRUD de Gastos Diarios, Ingresos, Pagos, Gastos Recurrentes, Gastos Personales y Presupuestos.  
- Reportes (totales día/semana/mes/año, ingresos vs gastos).  
- Exportación/Importación de **JSON** completo.  
- Generación de **PDF** limpio con `window.print()` (sidebar oculto en `@media print`).  
- Persistencia en **localStorage**.  
- Tema corporativo negro/dorado, bordes definidos y diseño responsive.

---

## 📊 Estructura de datos
```json
{
  "settings": {
    "businessName": "Mi Negocio",
    "logoBase64": "",
    "theme": { "primary": "#0b0b0e", "accent": "#C7A24B", "text": "#fff" },
    "pinHash": "",
    "currency": "USD"
  },
  "expensesDaily": [],
  "incomesDaily": [],
  "payments": [],
  "ordinary": [],
  "budgets": [],
  "personal": []
}
💻 Uso local
Clona el repositorio o descarga los archivos.
Abre index.html en tu navegador.
En la primera ejecución, crea tu PIN (4–8 dígitos). Luego deberás introducirlo para acceder.
🚀 Despliegue en GitHub Pages
Crea un repositorio nuevo.
Sube index.html, styles.css, app.js, README.md y la carpeta assets/.
En tu repo, ve a Settings → Pages.
Selecciona Deploy from a branch → main → / (root).
Guarda los cambios. Tu app estará disponible en una URL pública.
🔁 Exportar/Importar datos
Exportar: en la vista Configuración, haz clic en Exportar JSON.
Importar: selecciona un archivo .json.
Si confirmas “Reemplazar”, sobrescribe todo.
Si cancelas, fusiona (añade datos y actualiza configuración).
🧾 PDF
Usa el botón Imprimir / PDF en la barra superior o desde Exportaciones en PDF.
El CSS de impresión oculta el panel lateral y los botones para generar un documento limpio.
🎨 Personalización
Cambia nombre, colores y moneda desde Configuración.
Sube un logo (se guarda como Base64 en localStorage).
🔐 Seguridad
El PIN se guarda en hash SHA-256 usando Web Crypto (crypto.subtle.digest).
Tras 5 intentos fallidos, se bloquea temporalmente.
🪪 Licencia
MIT License
¿Quieres que te genere también el texto para la descripción del repositorio de GitHub (README corto + badges)?
Así se verá más profesional cuando lo publiques.

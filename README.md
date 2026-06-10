[README.md](https://github.com/user-attachments/files/28803810/README.md)
# FitRecord

FitRecord es una app web local para registrar entrenamiento, comidas keto, medidas corporales y progreso semanal.

## Abrir la app

Abre `index.html` en el navegador o levanta un servidor local desde esta carpeta:

```powershell
python -m http.server 4173
```

Luego entra a `http://127.0.0.1:4173/index.html`.

## Que guarda

- Perfiles por usuario.
- Peso en lb.
- Altura y medidas corporales en in.
- Masa muscular estimada en lb.
- Entrenamientos diarios: series, reps, peso en lb, RPE y notas.
- Comidas diarias: receta, porciones y notas.
- Resumen semanal: cambio de peso, masa muscular, volumen levantado, comidas y carbohidratos netos.

Los datos se guardan en `localStorage` del navegador.

## Contenido importado

La app genera `generated-data.js` desde los PDFs locales:

- 149 ejercicios base de la enciclopedia de musculacion.
- 131 recetas del libro keto.
- Imagenes locales de paginas del libro para ver postura, recorrido, ingredientes, pasos y comentarios en detalle.

Estas imagenes salen de tus PDFs y estan pensadas para uso local/privado. No publiques ni redistribuyas la app con esas imagenes sin revisar permisos del titular de derechos.

Para regenerar la biblioteca:

```powershell
python scripts\import_books.py
```

Para ampliar manualmente la biblioteca adicional, agrega nuevos objetos en `data.js` siguiendo la misma estructura detallada:

- Preparacion.
- Ejecucion paso a paso.
- Consejos para novatos.
- Consejos para expertos.
- Errores comunes.
- Advertencias.
- Variantes.

Las recetas siguen el mismo criterio: ingredientes, preparacion previa, pasos completos, consejos, sustituciones, conservacion, advertencias y macros.

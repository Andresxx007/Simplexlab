# SimplexLab

Aplicación web educativa para resolver problemas de programación lineal con el **método Simplex** (M grande), explicando cada paso.

Todo corre en el navegador: HTML, CSS y JavaScript puro. Sin dependencias externas ni servidor de backend.

## Cómo ejecutarlo en local

Los módulos ES no funcionan abriendo `index.html` con doble clic (`file://`). Use un servidor estático:

```bash
# Con Node 18+
npx --yes serve .

# O con Python
python -m http.server 8080
```

Luego abra la URL que indique el servidor (por ejemplo `http://localhost:3000`).

En VS Code / Cursor: extensión **Live Server**.

## Pruebas

```bash
node --test tests/engine.test.js
```

Los nueve ejemplos de la especificación se verifican automáticamente (estado, variables y Z).

## Estructura

```
index.html
css/main.css
css/print.css
js/fractions.js   # aritmética exacta + coeficientes Big-M
js/engine.js      # motor Simplex (sin DOM)
js/validator.js
js/explainer.js
js/graph.js       # región factible SVG (2 variables)
js/examples.js
js/storage.js     # historial LocalStorage
js/ui.js          # interfaz
js/app.js
tests/engine.test.js
```

## Convenciones del curso

| Decisión | Elección |
|----------|----------|
| Artificiales | Método de la M grande |
| Fila Z | Coeficientes con signo invertido (−cⱼ) |
| Minimización | Se convierte a maximización |
| Notación | X, S (holgura), E (exceso), A (artificial) |
| Desempates | Menor índice de columna/variable |
| Números | Fracciones por defecto (interruptor a decimal) |

## Despliegue (GitHub Pages)

Publique la rama principal. Todos los enlaces del proyecto son **relativos**, adecuados para sitios en subruta.

## Alcance

- Maximizar / minimizar; ≤, ≥, =
- Hasta 10 variables y 10 restricciones
- Modo automático y paso a paso
- Casos: óptimo, no acotado, infactible, óptimos alternativos, degeneración
- Gráfico 2D, precios sombra, holguras, historial local, impresión

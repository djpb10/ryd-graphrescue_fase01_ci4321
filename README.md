# Simulador de Cañón Parabólico 3D

Proyecto para la materia de Computación Gráfica. Consiste en un entorno gráfico 3D interactivo creado desde cero con WebGL2 y TypeScript, enfocado en la simulación de física parabólica, detección de colisiones 3D y transformaciones matriciales jerárquicas sin usar motores de juego comerciales

## Integrantes

* David Pereira
* Rossana Ilardo

## Controles

* Flechas Izquierda / Derecha: Mover la torreta lateralmente dentro del campo
* Flechas Arriba / Abajo: Ajustar la inclinación del cañón (restringido entre 5° y 90°)
* Teclas 1, 2, 3 / F: Seleccionar el nivel de potencia del disparo (Nivel 1, 2 o 3)
* Barra Espaciadora: Disparar el proyectil
* Tecla R: Reiniciar el juego (restablece objetivos, torreta y proyectil)

## Lo que hace el proyecto

* Simulación de trayectoria parabólica en tiempo real con gravedad e integración por delta time para mantener la velocidad independiente de los FPS
* Torreta manejada mediante matrices de transformación con límites de rotación
* Cálculo de distancia euclidiana en ejes para los impactos con los objetivos flotantes
* Geometrías (esferas, cilindros, planos y prismas) calculando vértices y normales
* Barras de estado integradas en la propia torreta 3D que indican el nivel de potencia activo

## Cómo correr el proyecto

1. Instalar las dependencias del proyecto:
   npm install

2. Iniciar el servidor local de desarrollo:
   npm run dev   

3. Abrir en el navegador la dirección indicada: http://localhost:5173   

## Tecnologías
Lenguaje: TypeScript
Gráficos: WebGL2 / Matemáticas de Proyección 3D
Herramienta de compilación: Vite
Entorno: Node.js 
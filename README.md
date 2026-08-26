# Mapa La Pampa

Starter de producción para gestionar puntos territoriales de La Pampa.

## Desarrollo

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

cd ..\frontend
npm install
npm run dev
```

El frontend usa React, TypeScript, Vite, Material UI y React-Leaflet con OpenStreetMap, centrado inicialmente en La Pampa. Intenta usar la API en `http://localhost:8000/api`; si no está disponible conserva un fallback local para desarrollo. Los marcadores antiguos con coordenadas X/Y de la imagen se ubican mediante la localidad asociada como capa de compatibilidad; los nuevos usan latitud y longitud.

API: CRUD en `/api/markers` (alias `/marcadores`), importación en `/api/markers/import` o `/importar-excel`, y exportación backend en `/exportar.json` y `/exportar.csv`. Excel/CSV acepta `Nombre, Localidad, Agencia, Codigo, Estado, X, Y, Observaciones` y nombres equivalentes en inglés. Documentación interactiva: `/docs`.

## Despliegue en Render

El archivo `render.yaml` define dos servicios: una API Python y un frontend estático.

1. Sube este proyecto a un repositorio GitHub.
2. En Render selecciona **New > Blueprint** y elige el repositorio.
3. En el servicio API configura `CORS_ORIGINS` con la URL pública del frontend, por ejemplo `https://mapa-la-pampa-web.onrender.com`.
4. En el frontend configura `VITE_API_URL` con la URL pública de la API más `/api`, por ejemplo `https://mapa-la-pampa-api.onrender.com/api`.
5. Ejecuta el despliegue. La API quedará documentada en `/docs`.

Si el servicio ya existía antes de agregar `render.yaml`, revisa en Render
**Settings > Build & Deploy > Start Command** y establece:
`python -m uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.

SQLite funciona para una instalación inicial, pero en Render el disco del servicio es efímero. Para conservar datos después de reinicios, agrega un disco persistente o migra la base a PostgreSQL.

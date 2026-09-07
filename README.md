# Document de Treball Compartit: Remodelació Web ACAB

Aplicació web senzilla, robusta i sense dependències externes concebuda com un **document de treball col·laboratiu en temps real** per compartir i omplir conjuntament el document de preguntes de remodelació del web d'ACAB.

## Característiques principals

- **Document de treball comú (no és una enquesta):** Totes les persones accedeixen a un **únic document central**. Qualsevol resposta, modificació o aportació queda integrada directament al document de treball comú.
- **Sincronització automàtica en temps real:**
  - Desat automàtic continu en escriure.
  - Sincronització en segon pla (cada 3 segons) per rebre els canvis introduïts per altres companys sense haver de recarregar la pàgina i sense interrompre el camp que s'està redactant.
  - Indicador visual: *"🟢 Sincronitzat en temps real"*.
- **Font única de veritat:** Les 31 preguntes originals extretes literalment del document Word oficial (`preguntes-remodelacio-web01.doc`).
- **Disposició corporativa:** Logotip de **SUMEM** a l'esquerra i logotip d'**ACAB** a la dreta.
- **Zona d'administració (`/admin`):** Protegida per contrasenya (per defecte: `acab2026`).

---

## Com executar l'aplicació en local

```bash
# Iniciar el servidor (al port 3001 per defecte)
npm start

# O directament:
node server.js
```

- **Document de treball compartit:** `http://localhost:3001/`
- **Zona d'administració:** `http://localhost:3001/admin` (Contrasenya: `acab2026`).

---

## Com desplegar a Vercel

El projecte ja està preparat per a Vercel amb `vercel.json` i la Serverless Function a `api/index.js`.

### Pas 1: Pujar el projecte a GitHub
Obre la terminal a la carpeta del projecte:
```bash
git init
git add .
git commit -m "Document de treball ACAB preparat per a Vercel"
git branch -M main
git remote add origin https://github.com/EL_TEU_USUARI/EL_TEU_REPOSITORI.git
git push -u origin main
```

### Pas 2: Importar a Vercel
1. Entra a [vercel.com/new](https://vercel.com/new).
2. Tria el teu repositori de GitHub i fes clic a **Import**.
3. A la configuració del projecte, Vercel detectarà automàticament la configuració (`vercel.json`). Fes clic a **Deploy**.

### Pas 3: Persistència permanent amb Vercel KV (1 sol clic)
Perquè les dades no es perdin mai en reiniciar les funcions serverless de Vercel:
1. Al tauler del teu projecte a Vercel, ves a la pestanya **Storage**.
2. Fes clic a **Connect Database** i selecciona **KV** (Vercel KV / Upstash Redis, gratuït).
3. Fes clic a **Create & Connect**. Vercel configurarà automàticament les variables d'entorn (`KV_REST_API_URL` i `KV_REST_API_TOKEN`).
4. Fes un **Redeploy** ràpid des del menú de desplegaments perquè s'apliquin les variables.

Llestos! El teu document de treball col·laboratiu estarà 100% actiu al núvol.

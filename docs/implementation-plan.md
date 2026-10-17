# Family Night, implementation plan (source document)

Pasted by Sebastian on 2026-10-17.
Source for `setup` (PRD, TRD, ARD, modules) and for the phase 1 tasks.
Decisions marked as taken are agreed and must not change without asking.
Kept verbatim in Spanish; the docs derived from it are written in English.

---

## Resumen y alcance

Family Night es una web app de juegos de fiesta para jugar en familia (edades 20 a 60), donde cada jugador usa su propio celular dentro de una sala compartida.
Se publica en family-night.fless.dev sobre AWS serverless.
Lo marcado como decisión ya está acordado y no se debe cambiar sin preguntar.

Fase 1 (este plan, completo): plataforma común (identidad, salas, lobby, presencia, invitaciones) + juego Impostor.
Fase 2 (solo esbozado al final): Just One y Wavelength. Sus reglas detalladas se definirán antes de implementarlos.

## Decisiones tomadas

| Tema | Decisión |
| --- | --- |
| Modo de juego | Cada jugador en su propio celular, en tiempo real |
| Dominio | Un solo subdominio para todo: family-night.fless.dev |
| Sala vs juego | La sala persiste toda la noche; dentro se juegan varias partidas (matches) de distintos juegos |
| Frontend | Vite + React + TypeScript + TanStack Router (file-based) + TanStack Query |
| Backend | Lambdas en TypeScript detrás de API Gateway HTTP API (REST) |
| Tiempo real | AppSync Events (pub/sub por WebSocket). Solo el servidor publica |
| Base de datos | DynamoDB, multi-table (una tabla por entidad) |
| Hosting | S3 privado + CloudFront (OAC), API detrás del mismo CloudFront en /api/* |
| IaC | AWS CDK en TypeScript |
| Identidad | playerId UUID permanente en localStorage, nombre random único y permanente (animal + adjetivo, masculinos) |
| TTL | Salas y partidas expiran a las 24 h; jugadores nunca expiran |
| Invitación | Link compartido por WhatsApp: botones Copiar y Compartir |

Fuera de alcance: cuentas con login, cambio de nombre por el usuario (el nombre es permanente), chat de texto, voz o video (el debate ocurre en persona), monetización, i18n (todo en español).

## Stack y estructura del monorepo

Un monorepo con pnpm workspaces y tres paquetes de código más la infraestructura; el paquete shared es la única fuente de verdad del contrato entre front y back.

```
family-night/
  package.json              # workspaces, scripts raíz (build, test, deploy)
  pnpm-workspace.yaml
  tsconfig.base.json        # strict: true, noUncheckedIndexedAccess: true
  packages/
    shared/                 # tipos y lógica pura, sin dependencias de AWS
      src/
        api.ts              # tipos de request/response de cada endpoint
        events.ts           # tipos de los eventos de AppSync Events
        domain.ts           # Room, Player, Match, ImpostorState, etc.
        impostor/rules.ts   # lógica pura del juego (asignar roles, contar votos, victoria)
        constants.ts        # límites (min jugadores, tabla de impostores, TTL)
    api/                    # Lambdas
      src/
        handlers/           # un archivo por ruta o un router único (ver Arquitectura)
        repos/              # acceso a DynamoDB, una clase por tabla
        services/           # rooms, players, presence, matches, impostor
        realtime/publish.ts # cliente HTTP firmado con SigV4 hacia AppSync Events
        data/names.json     # animales + adjetivos (generado por prompt)
        data/impostor-words.json  # palabras (generado por prompt)
        lib/                # errores, validación (zod), auth por header
    web/                    # Vite + React
      src/
        routes/             # TanStack Router file-based
        api/                # cliente fetch tipado + hooks de TanStack Query
        realtime/           # conexión WebSocket a AppSync Events
        identity/           # playerId en localStorage
        components/
        games/impostor/
      public/og.png
  infra/                    # AWS CDK app
    bin/app.ts
    lib/family-night-stack.ts
```

### Versiones y librerías

- Node.js 22 en Lambda (NODEJS_22_X), ARM64.
- TypeScript 5.x en todo el repo, strict.
- Backend: @aws-sdk/client-dynamodb + @aws-sdk/lib-dynamodb, zod para validar bodies, aws4fetch o @smithy/signature-v4 para firmar los POST a AppSync Events. No empaquetar @aws-sdk/* (ya viene en el runtime).
- Frontend: React 19, Vite, @tanstack/react-router + @tanstack/router-plugin, @tanstack/react-query, qrcode (opcional, para mostrar QR de la sala). Estilos con Tailwind CSS.
- Tests: Vitest en shared, api y web.
- Lint/format: ESLint + Prettier.

Regla del contrato: cualquier cambio en un payload se hace primero en shared.
Front y Lambdas importan de ahí, así que un cambio incompatible rompe la compilación, no la partida.

## Arquitectura AWS

Todo comando pasa por REST (CloudFront → API Gateway → una Lambda) y todo aviso en tiempo real sale de esa Lambda hacia AppSync Events; los clientes nunca publican en el canal.

### Componentes

| Componente | Rol | Notas |
| --- | --- | --- |
| Route 53 | DNS de family-night.fless.dev | Alias A/AAAA hacia CloudFront |
| ACM | Certificado TLS | En us-east-1 (requisito de CloudFront) |
| CloudFront | Punto de entrada único | Default behavior → S3; /api/* → API Gateway |
| CloudFront Function | Rewrite de la SPA | Todo lo que no tiene extensión y no es /api/ → /index.html |
| S3 | Assets estáticos del build de Vite | Privado, acceso solo vía OAC |
| API Gateway HTTP API | REST | Rutas con prefijo /api, integración Lambda proxy v2 |
| Lambda api | Toda la lógica | Una sola función con router interno (Hono). Node 22, ARM64, 512 MB, timeout 10 s |
| DynamoDB | Persistencia | 7 tablas on-demand (ver Modelo de datos) |
| AppSync Events | Broadcast en tiempo real | Namespace rooms, canal /rooms/{roomCode} |
| CloudWatch | Logs y alarmas | Retención de logs 14 días |

Por qué una sola Lambda: el tráfico es mínimo (una familia), una función tiene menos cold starts que veinte y el router interno mantiene el código ordenado.
Si algún día crece, se separa por prefijo de ruta sin tocar el contrato.

### Flujo de un comando (ejemplo: votar)

1. El celular hace POST /api/matches/{matchId}/votes con el header x-player-id.
2. CloudFront lo reenvía a API Gateway (sin caché, con x-origin-secret).
3. La Lambda valida el secreto de origen, el playerId, el body (zod) y que el jugador pertenezca a la sala.
4. Escribe en DynamoDB con escrituras condicionales e incrementa version de la sala o del match.
5. Construye el snapshot público de la sala (sin secretos) y lo publica con un POST firmado (SigV4) al endpoint HTTP de AppSync Events, canal /rooms/{roomCode}.
6. Responde 200 al cliente con el mismo snapshot.
7. Todos los celulares suscritos reciben el evento y reemplazan su estado local si version es mayor que la que tienen.

### Reglas de tiempo real

- El evento lleva el snapshot público completo de la sala (es pequeño: menos de 10 KB). Así los clientes no necesitan refetch tras cada evento.
- Cada snapshot lleva version (entero monotónico de la sala). El cliente descarta eventos con versión menor o igual a la que ya tiene: protege contra eventos desordenados.
- Al conectar o reconectar el WebSocket, y al volver de segundo plano, el cliente hace GET /api/rooms/{code} para resincronizar; los eventos perdidos no se recuperan del canal.
- Ningún secreto (palabra, rol, pista) viaja jamás por el canal.

### Autorización en AppSync Events

- Auth por defecto del API: API key (para connect y subscribe desde el navegador).
- Namespace rooms: subscribe con API key; publish solo IAM, otorgado únicamente al rol de la Lambda.
- La API key se rota antes de expirar (máximo 365 días); su valor se inyecta en el build del front como variable de entorno.

Concurrencia: dos jugadores pueden votar en el mismo milisegundo.
Toda transición de fase usa ConditionExpression sobre version (optimistic locking); si falla por conflicto, la Lambda relee y reintenta hasta 3 veces.
Detectar "todos votaron" y cerrar la ronda debe ser idempotente: solo la escritura que gana la condición publica el resultado.

## Modelo de datos (DynamoDB multi-table)

Siete tablas on-demand: dos de identidad permanente sin TTL y cinco de juego que expiran 24 h después de la última actividad de la sala.

| Tabla | PK | SK | TTL | Contenido |
| --- | --- | --- | --- | --- |
| Players | playerId (UUID v4) | (none) | No | name, tokenHash, createdAt, lastSeenAt |
| PlayerNames | name | (none) | No | playerId, createdAt. Garantiza unicidad global del nombre |
| Rooms | roomCode | (none) | Sí | hostId, currentMatchId, version, usedWordIds (string set), createdAt, updatedAt, ttl |
| RoomMembers | roomCode | playerId | Sí | name (copia), joinedAt, lastSeenAt, totalScore, ttl |
| Matches | roomCode | matchId (ULID) | Sí | gameType, status, config, publicState, createdAt, endedAt, ttl |
| MatchSecrets | matchId | playerId o #MATCH | Sí | Por jugador: role, word o clue, category. En #MATCH: la palabra, su id, categoría, pista y opciones de adivinanza |
| Votes | matchId | {ronda 2 dígitos}#{voterId} | Sí | targetId, createdAt, ttl |

### Reglas

- ttl = epoch en segundos de ahora + 24 h. Se recalcula en cada escritura sobre la sala (Rooms, RoomMembers del que escribe, Match actual). Activar TTL en las cinco tablas de juego con el atributo ttl.
- matchId es un ULID: ordena por tiempo, así Query sobre Matches por roomCode devuelve el historial de la noche en orden.
- La SK de Votes (03#playerId) hace que cada jugador tenga como máximo un voto por ronda. Cambiar el voto = PutItem que sobrescribe.
- "Todos votaron" = Query con begins_with(SK, "03#") y comparar contra los jugadores vivos del publicState.
- MatchSecrets no se lee nunca para construir el snapshot público. Solo lo leen GET /api/matches/{id}/me (filtrado por playerId del caller) y la lógica interna del servidor.
- Rooms.version se incrementa en toda escritura que cambie el snapshot público; es la base del optimistic locking y del descarte de eventos viejos en el cliente.
- Todas las tablas con point-in-time recovery desactivado (datos efímeros) excepto Players y PlayerNames. RemovalPolicy.RETAIN en esas dos.

### Código de sala

- 4 caracteres del alfabeto ABCDEFGHJKMNPQRSTUVWXYZ (sin I, L, O para evitar confusiones): 23⁴ ≈ 280 mil combinaciones.
- Se crea con PutItem + attribute_not_exists(roomCode); si choca, se genera otro (máx. 10 intentos).
- La URL de la sala es https://family-night.fless.dev/{CODE}. El código se normaliza a mayúsculas al leerlo de la URL.

### Snapshot público de la sala

Lo que devuelve GET /api/rooms/{code} y lo que viaja en cada evento:

```ts
type RoomSnapshot = {
  roomCode: string;
  version: number;
  hostId: string;
  members: Array<{
    playerId: string;
    name: string;
    online: boolean;      // calculado por el servidor al construir el snapshot
    lastSeenAt: string;   // el cliente recalcula online cada 5 s
    totalScore: number;
    joinedAt: string;
  }>;
  currentMatch: MatchPublic | null;   // null = la sala está en el lobby
  serverTime: string;                 // para que el cliente calcule online/offline sin desfase
};
```

## Funcionalidad común

Identidad permanente, salas con host, lobby con presencia e invitación por link; todo juego se monta sobre esta capa.

### Identidad

Cada dispositivo tiene un jugador permanente con dos valores en localStorage: playerId (público) y playerToken (secreto).

- Por qué dos valores: el playerId aparece en el snapshot público (lo ven todos), así que no puede servir de credencial. Si lo fuera, el impostor podría pedir GET /me con el id de otro y leer su palabra. El playerToken (32 bytes aleatorios, base64url) nunca sale del dispositivo salvo en el header x-player-token.
- El servidor guarda solo tokenHash = SHA-256 del token en Players. Toda request autenticada busca el jugador por playerId (header x-player-id) y compara el hash del token en tiempo constante.
- Primera visita: no hay playerId en localStorage → POST /api/players → el servidor genera UUID, token y nombre único, y responde { playerId, playerToken, name }. El front guarda los tres.
- Visitas siguientes: GET /api/players/me con los headers → devuelve { playerId, name }. Si responde 401 (token inválido o jugador inexistente), el front borra localStorage y crea un jugador nuevo.
- El nombre es permanente. No hay endpoint para cambiarlo. Si el usuario borra datos del navegador o cambia de dispositivo, será un jugador nuevo con otro nombre; es aceptado.

### Nombre random único

- Fuente: api/src/data/names.json con 100 animales y 100 adjetivos, todos en masculino singular (ver el prompt al final). 10 000 combinaciones.
- Formato: "{Animal} {Adjetivo}", por ejemplo "Cóndor Veloz".
- Algoritmo: elegir animal y adjetivo al azar → TransactWriteItems con Put PlayerNames (attribute_not_exists(#name)) + Put Players. Si la transacción falla por la condición, reintentar con otra combinación hasta 20 veces. Si las 20 fallan, usar "{Animal} {Adjetivo} {n}" con n de 2 en adelante.
- La unicidad es global (no solo por sala). Se compara tal cual, con tildes y mayúsculas.

### Salas

- Crear: POST /api/rooms. El caller queda como host y primer miembro. El front navega a /{CODE}.
- Unirse: al abrir /{CODE}, el front llama POST /api/rooms/{code}/join. Es idempotente: si ya era miembro, solo actualiza lastSeenAt (esto es también el rejoin al recargar). Sala inexistente o expirada → 404 y la UI muestra "Esta sala no existe o ya expiró" con un botón para crear una nueva.
- Máximo 20 miembros por sala. El 21 recibe 409 ROOM_FULL.
- Entrar con una partida en curso: se une a la sala y ve la partida como espectador; juega desde la siguiente.
- Salir: POST /api/rooms/{code}/leave borra la membresía. Si estaba vivo en una partida de Impostor, cuenta como eliminado: se revela si era impostor y se evalúa la victoria (ver Impostor).
- Expulsar (solo host): POST /api/rooms/{code}/kick con { playerId }, mismo efecto que salir. Sirve para "fantasmas" que cerraron el celular.
- Host: el creador. Puede ceder el rol (POST /api/rooms/{code}/host). Traspaso automático: si el host lleva más de 60 s offline, la siguiente request de cualquier miembro online transfiere el rol al miembro online más antiguo y publica el cambio.
- Solo el host elige juego, configura, inicia partidas, cierra votaciones forzadamente, termina partidas y expulsa.

### Presencia

- Mientras la pestaña está visible, el front hace POST /api/rooms/{code}/ping cada 20 s. El servidor actualiza lastSeenAt y el ttl.
- Un miembro está online si serverTime - lastSeenAt < 45 s. El snapshot incluye lastSeenAt y serverTime; el cliente recalcula online cada 5 s con su desfase de reloj, así que pasar a offline no requiere evento.
- El ping solo publica un evento cuando el miembro vuelve a estar online (su lastSeenAt anterior tenía más de 45 s). Así no se inunda el canal cada 20 s.
- Al ocultarse la pestaña (visibilitychange → hidden), el front envía navigator.sendBeacon('/api/rooms/{code}/away'): el servidor retrasa lastSeenAt 60 s y publica, para que se vea en gris al instante. Los beacons no permiten headers custom: este endpoint recibe playerId y playerToken en el body.
- Al volver (visible): join (rejoin) + GET del snapshot + re-suscripción si el WebSocket se cayó.
- Un miembro offline nunca se saca de la sala automáticamente. En la UI aparece en gris con la etiqueta "ausente".

### Invitación

- En el lobby: el código de sala en grande (ABCD), botón Copiar link y botón Compartir.
- Copiar: navigator.clipboard.writeText(url) con fallback a textarea + execCommand('copy'), y un toast "¡Link copiado!".
- Compartir: navigator.share({ title: 'Noche de juegos', text: '¡Únete a la sala!', url }). Ignorar AbortError (el usuario canceló). Si navigator.share no existe (desktop), abrir https://wa.me/?text= con el mensaje y la URL codificados.
- Opcional: QR de la URL debajo del código, para quien esté en la misma habitación.
- Meta tags Open Graph estáticos en index.html (WhatsApp no ejecuta JS): og:title "Noche de juegos", og:description "Únete a la sala y juguemos", og:image con URL absoluta a /og.png (1200×630, menos de 300 KB).

## Juego: Impostor

Todos reciben la misma palabra salvo los impostores, que solo reciben una pista; el debate ocurre en persona y la app solo muestra la carta, el orden de turno y la votación.

### Configuración (la elige el host en el lobby)

| Opción | Valores | Por defecto |
| --- | --- | --- |
| impostorCount | 1 hasta el máximo según jugadores (tabla abajo) | 1 |
| randomOrder | true = orden aleatorio; false = orden de llegada a la sala | true |
| tieRule | SKIP = nadie sale; RANDOM = sale uno de los empatados al azar | RANDOM |
| showCategoryToImpostor | true / false | false |
| categories | Subconjunto de categorías activas (mínimo 1) | Todas |
| impostorLastGuess | true = el último impostor atrapado puede adivinar la palabra | true |

Máximo de impostores por cantidad de jugadores:

| Jugadores | Máx. impostores |
| --- | --- |
| 3 a 5 | 1 |
| 6 a 8 | 2 |
| 9 o más | 3 |

- Mínimo 3 jugadores para iniciar. Con menos, el botón Iniciar está deshabilitado con el texto "Faltan N jugadores".
- Juegan los miembros online al momento de iniciar. El host ve la lista de quiénes entrarán antes de confirmar.
- El servidor revalida todo al iniciar (cantidad de jugadores, máximo de impostores, categorías) y responde 422 si no se cumple; la UI nunca es la única validación.
- La configuración se recuerda en la sala para "Jugar otra vez".

### Preparación (al iniciar)

1. Palabra: elegir al azar de las categorías activas, excluyendo Rooms.usedWordIds. Si no quedan palabras disponibles en esas categorías, vaciar los ids usados de esas categorías y volver a elegir. Agregar el id elegido a usedWordIds.
2. Impostores: elegir impostorCount participantes al azar con crypto.randomInt. Cualquiera puede ser impostor, incluido el host.
3. Orden de turno: si randomOrder, barajar con Fisher–Yates usando crypto; si no, por joinedAt. No se evita que un impostor hable primero: si se evitara, el primero quedaría limpio automáticamente.
4. Secretos en MatchSecrets: civiles → { role: 'CIVILIAN', word, category }; impostores → { role: 'IMPOSTOR', clue } y category solo si showCategoryToImpostor. Los impostores no saben quiénes son los otros impostores.
5. Opciones de adivinanza (ítem #MATCH): la palabra real + 4 palabras distintas de la misma categoría, en orden aleatorio.
6. Estado público inicial: round = 1, phase = 'VOTING', order, participants, sin eliminados. Publicar el snapshot.

### Rondas

Lo que ve cada jugador vivo: su carta (palabra y categoría si es civil; "Eres el impostor" + pista, y categoría si está activada, si es impostor), el orden de turno de la ronda con el primero resaltado, y la lista de jugadores vivos para votar.

- La carta se puede ocultar y mostrar con un toque (por si alguien mira el celular ajeno). Empieza oculta.
- El orden se genera una vez por partida; en cada ronda se quitan los eliminados y se mantiene el resto.
- Votación abierta desde el inicio de la ronda. Mientras hablan en persona, cada uno puede marcar su voto cuando quiera.
- Se vota a un jugador vivo, no a uno mismo. El voto se puede cambiar hasta que la votación se cierre.
- Todos ven quién ya votó (un check junto al nombre), nunca a quién.
- La votación se cierra sola cuando votaron todos los vivos. El host puede cerrar la votación antes: los que no votaron cuentan como abstención.

### Resultado de la votación

1. Contar votos y mostrar a todos la lista ordenada de más a menos votado, con el número de votos.
2. Si no hubo ningún voto: nadie sale.
3. Si hay un único más votado: sale ese.
4. Si hay empate en el primer lugar: con tieRule = SKIP nadie sale ("Empate: nadie es eliminado"); con RANDOM sale uno de los empatados al azar y la UI lo indica ("Empate: eliminado por sorteo").
5. Se revela si el eliminado era o no impostor.
6. Evaluar fin de partida (abajo). Si sigue, el host toca Siguiente ronda: round + 1, se limpian los votos de la ronda y vuelve a VOTING.

### Fin de partida

Se evalúa después de cada eliminación, salida o expulsión de un jugador vivo:

- Ganan los civiles si no quedan impostores vivos. Si impostorLastGuess está activo y el último impostor fue eliminado por votación (no por salir de la sala), antes pasa a la fase IMPOSTOR_GUESS.
- Ganan los impostores si los impostores vivos son igual o más que los civiles vivos.
- En cualquier otro caso, la partida sigue.

Última oportunidad (IMPOSTOR_GUESS): el impostor atrapado ve 5 opciones (la palabra real + 4 de la misma categoría) y elige una.
Si acierta, ganan los impostores ("¡Robó la victoria!"); si falla, ganan los civiles.
Los demás ven "X está intentando adivinar la palabra...".
Si el impostor está offline, el host puede saltar la adivinanza y ganan los civiles.

Pantalla final (todos): ganador, la palabra, quiénes eran los impostores y el historial de eliminaciones por ronda.
El host tiene Jugar otra vez (misma config, nueva palabra) y Volver al lobby; el resto ve "Esperando al host...".
Al volver al lobby, currentMatchId pasa a null y todos los celulares navegan al lobby.

Puntaje acumulado de la noche (en RoomMembers.totalScore): si ganan los civiles, +1 a cada civil participante (vivo o eliminado); si ganan los impostores, +2 a cada impostor.
El host puede terminar la partida en cualquier momento sin puntaje.

### Espectadores

- Los eliminados siguen viendo su carta y el estado de la partida, pero no votan ni pueden ser votados.
- Quien entra a la sala con una partida en curso ve "Partida en curso, juegas en la siguiente" y el estado público.

### Tipos (en shared/src/domain.ts)

```ts
type ImpostorConfig = {
  impostorCount: number;
  randomOrder: boolean;
  tieRule: 'SKIP' | 'RANDOM';
  showCategoryToImpostor: boolean;
  categories: string[];
  impostorLastGuess: boolean;
};

type ImpostorPhase = 'VOTING' | 'REVEAL' | 'IMPOSTOR_GUESS' | 'FINISHED';

type ImpostorPublic = {
  gameType: 'IMPOSTOR';
  matchId: string;
  status: 'PLAYING' | 'FINISHED' | 'ABORTED';
  phase: ImpostorPhase;
  config: ImpostorConfig;
  round: number;
  participants: string[];              // playerIds al iniciar
  order: string[];                     // vivos, en orden de turno
  eliminated: Array<{
    playerId: string;
    round: number;
    wasImpostor: boolean;
    reason: 'VOTE' | 'TIE_RANDOM' | 'LEFT' | 'KICKED';
  }>;
  votedPlayerIds: string[];            // quién ya votó en la ronda actual
  lastResult: {
    round: number;
    tally: Array<{ playerId: string; votes: number }>;  // ordenado desc
    tie: boolean;
    eliminatedId: string | null;
  } | null;
  guess: {
    guesserId: string;
    options: string[];
    chosen: string | null;
    correct: boolean | null;
  } | null;
  winner: 'CIVILIANS' | 'IMPOSTORS' | null;
  reveal: { word: string; category: string; impostorIds: string[] } | null;  // solo en FINISHED
};

type ImpostorSecret =
  | { role: 'CIVILIAN'; word: string; category: string }
  | { role: 'IMPOSTOR'; clue: string; category: string | null };
```

La lógica de reglas va en shared/src/impostor/rules.ts como funciones puras (asignar roles, resolver votación, evaluar victoria), sin I/O, para testearlas con Vitest sin AWS.

## API REST y eventos

Veintiún endpoints JSON bajo /api, autenticados con x-player-id + x-player-token; cada uno que cambia la sala publica un evento room.updated con el snapshot público.

### Convenciones

- Base: https://family-night.fless.dev/api. JSON en request y response, Content-Type: application/json.
- Auth (todas salvo POST /players): headers x-player-id y x-player-token. Falta o inválido → 401.
- Pertenencia: los endpoints bajo /rooms/{code} y /matches/{id} exigen que el caller sea miembro de la sala → si no, 403.
- Host: marcados con Host → si el caller no es host, 403 NOT_HOST.
- Errores: { "error": { "code": "ROOM_NOT_FOUND", "message": "Esta sala no existe o ya expiró" } }. El message viene en español y la UI puede mostrarlo tal cual.
- Toda respuesta que cambia la sala devuelve { room: RoomSnapshot }.

### Jugadores

| Método | Ruta | Quién | Body | Respuesta |
| --- | --- | --- | --- | --- |
| POST | /players | Cualquiera (sin auth) | (none) | { playerId, playerToken, name } |
| GET | /players/me | Jugador | (none) | { playerId, name } |

### Salas

| Método | Ruta | Quién | Body | Respuesta |
| --- | --- | --- | --- | --- |
| POST | /rooms | Jugador | (none) | { room } (201) |
| GET | /rooms/{code} | Miembro | (none) | { room } |
| POST | /rooms/{code}/join | Jugador | (none) | { room } |
| POST | /rooms/{code}/leave | Miembro | (none) | { ok: true } |
| POST | /rooms/{code}/ping | Miembro | (none) | { serverTime } |
| POST | /rooms/{code}/away | Miembro (beacon) | { playerId, playerToken } | 204 |
| POST | /rooms/{code}/kick | Host | { playerId } | { room } |
| POST | /rooms/{code}/host | Host | { playerId } | { room } |

### Partidas (comunes a todos los juegos)

| Método | Ruta | Quién | Body | Respuesta |
| --- | --- | --- | --- | --- |
| POST | /rooms/{code}/matches | Host | { gameType: 'IMPOSTOR', config } | { room } (201) |
| GET | /matches/{matchId}/me | Miembro | (none) | { secret: ImpostorSecret \| null } |
| POST | /matches/{matchId}/abort | Host | (none) | { room } |
| POST | /rooms/{code}/lobby | Host | (none) | { room } (pone currentMatchId = null) |
| POST | /matches/{matchId}/rematch | Host | (none) | { room } (nueva partida, misma config) |

### Impostor

| Método | Ruta | Quién | Body | Respuesta |
| --- | --- | --- | --- | --- |
| PUT | /matches/{matchId}/votes | Jugador vivo | { round, targetId } | { room } |
| POST | /matches/{matchId}/close-voting | Host | { round } | { room } |
| POST | /matches/{matchId}/next-round | Host | { round } | { room } |
| POST | /matches/{matchId}/guess | Impostor adivinador | { option } | { room } |
| POST | /matches/{matchId}/skip-guess | Host | (none) | { room } |
| GET | /words/categories | Miembro | (none) | { categories: Array<{ id, name, count }> } |

Los bodies con round hacen las operaciones idempotentes: un voto o un "siguiente ronda" de una ronda ya cerrada responde 409 STALE_ROUND sin cambiar nada (protege contra doble toque y reintentos).

### Códigos de error

| Código | HTTP | Cuándo |
| --- | --- | --- |
| UNAUTHORIZED | 401 | Headers faltantes o token inválido |
| NOT_MEMBER | 403 | El caller no está en la sala |
| NOT_HOST | 403 | Acción exclusiva del host |
| ROOM_NOT_FOUND | 404 | Código inexistente o expirado |
| MATCH_NOT_FOUND | 404 | Partida inexistente |
| ROOM_FULL | 409 | Ya hay 20 miembros |
| MATCH_IN_PROGRESS | 409 | Iniciar partida con otra en curso |
| STALE_ROUND | 409 | Acción sobre una ronda o fase ya cerrada |
| CONFLICT | 409 | Optimistic locking falló tras 3 reintentos |
| NOT_ENOUGH_PLAYERS | 422 | Menos de 3 jugadores online |
| INVALID_CONFIG | 422 | Impostores fuera de rango, sin categorías, etc. |
| INVALID_VOTE | 422 | Votarse a sí mismo, a un eliminado o estar eliminado |
| VALIDATION_ERROR | 400 | Body inválido (detalle de zod en details) |

### Eventos de AppSync Events

- Namespace: rooms. Canal: /rooms/{ROOMCODE}.
- Un solo tipo de evento para cambios de estado, más dos avisos efímeros:

```ts
type RoomEvent =
  | { type: 'room.updated'; room: RoomSnapshot }           // cualquier cambio de estado
  | { type: 'member.kicked'; playerId: string }            // el expulsado vuelve a la home
  | { type: 'room.closed' };                               // reservado (sala expirada o cerrada)
```

- La Lambda publica con POST https://{http-domain}/event, body { "channel": "/rooms/ABCD", "events": ["<JSON string del evento>"] }, firmado con SigV4 (servicio appsync).
- Si el publish falla, la Lambda lo registra y no falla la request: el estado ya está en Dynamo y los clientes se resincronizan con el siguiente evento o al reconectar.
- El front se conecta al endpoint realtime (wss://{realtime-domain}/event/realtime) con el subprotocolo aws-appsync-event-ws y la API key, y se suscribe al canal de su sala. Usar la librería oficial (aws-amplify/data → events) o un cliente WebSocket propio de ~100 líneas; se prefiere el cliente propio para no cargar Amplify completo.

## Frontend

Una SPA mobile-first en Vite + React donde el snapshot de la sala, guardado en TanStack Query y alimentado por el WebSocket, decide en qué pantalla está cada celular.

### Rutas (TanStack Router, file-based)

```
src/routes/
  __root.tsx          # layout, QueryClientProvider, toasts, bootstrap de identidad
  index.tsx           # home: "Crear sala" y "Unirme con código"
  $code/
    route.tsx         # loader: join + snapshot; suscripción al canal; ping; visibilitychange
    index.tsx         # lobby
    impostor.tsx      # partida de Impostor
```

- $code se valida con un params.parse que normaliza a mayúsculas y exige 4 caracteres del alfabeto de salas; si no cumple, redirige a la home.
- Navegación dirigida por el estado: un efecto en $code/route.tsx observa room.currentMatch. Si es null, navega a /$code; si es un Impostor, navega a /$code/impostor. Así, cuando el host inicia o termina una partida, todos los celulares cambian solos. El usuario no navega manualmente entre lobby y juego.
- Los juegos futuros se agregan como $code/just-one.tsx y $code/wavelength.tsx.

### Estado

- Identidad (src/identity/): lee y escribe playerId, playerToken y name en localStorage (envuelto en try/catch). En __root.tsx, antes de renderizar rutas, asegura que exista un jugador (crea uno o valida con GET /players/me).
- Snapshot de la sala: useQuery(['room', code]) con GET /rooms/{code}. Los eventos room.updated hacen queryClient.setQueryData(['room', code], room) solo si room.version es mayor que la versión en caché.
- Secreto del jugador: useQuery(['match-secret', matchId]) con GET /matches/{id}/me, staleTime: Infinity. Se pide una vez por partida.
- Mutations: useMutation para cada comando; en onSuccess aplicar el room devuelto con la misma regla de versión. No hacer updates optimistas en votos: la respuesta llega en menos de 300 ms y evita estados inconsistentes.
- Cliente HTTP (src/api/client.ts): fetch tipado con los tipos de shared, agrega los headers de identidad, parsea el formato de error y lanza ApiError con code y message.
- Realtime (src/realtime/): una conexión WebSocket por pestaña a AppSync Events. Reconexión con backoff exponencial (1 s, 2 s, 4 s, hasta 30 s). En cada reconexión exitosa: re-suscribir y invalidateQueries(['room', code]).

### Pantallas

Home

- Saludo con el nombre del jugador ("Hola, Cóndor Veloz").
- Botón grande Crear sala.
- Campo Código de sala (4 letras, mayúsculas automáticas) + botón Unirme.

Lobby (/$code)

- Código de sala grande, botones Copiar link y Compartir, QR opcional.
- Lista de miembros: nombre, corona para el host, punto verde (online) o gris ("ausente"), puntaje acumulado de la noche. El propio jugador marcado con "(tú)".
- Menú del host sobre cada miembro: Hacer host, Sacar de la sala.
- Selector de juego (tarjetas). En fase 1 solo Impostor está activo; Just One y Wavelength aparecen como "Próximamente".
- Panel de configuración de Impostor (solo editable por el host; los demás lo ven en solo lectura): cantidad de impostores (stepper limitado por la tabla), orden aleatorio, regla de empate, mostrar categoría al impostor, última oportunidad, categorías (chips seleccionables).
- Botón Iniciar (host): deshabilitado con "Faltan N jugadores" si hay menos de 3 online. Los demás ven "Esperando a que el host inicie...".
- Botón Salir de la sala (con confirmación).

Impostor (/$code/impostor)

- Cabecera: "Ronda N" y la cantidad de impostores de la partida (dato de la config, no una pista).
- Carta: oculta por defecto, se revela manteniendo presionado o con un toque (toggle). Civil: la palabra grande y la categoría. Impostor: "Eres el impostor" en rojo, la pista, y la categoría si está activada.
- Orden de turno: lista horizontal con el primero resaltado ("Empieza: Zorro Elegante").
- Votación: lista de jugadores vivos (excepto uno mismo) como botones grandes; el seleccionado queda marcado. Junto a cada nombre, un check si esa persona ya votó. Texto "Votaron 4 de 6".
- Host: botón Cerrar votación (con confirmación si faltan votos).
- Revelación: lista ordenada por votos con barras o números, el eliminado destacado y un banner "Era impostor" (rojo) o "No era impostor" (gris). Si hubo empate, el texto correspondiente. Host: Siguiente ronda.
- Última oportunidad: el impostor ve 5 botones con opciones; el resto ve "X está intentando adivinar...".
- Final: "Ganaron los civiles" o "Ganaron los impostores", la palabra, los impostores, el historial de rondas y los puntos ganados. Host: Jugar otra vez y Volver al lobby.
- Eliminados y espectadores: misma pantalla sin controles de voto, con etiqueta "Eliminado" o "Espectador".
- Host en cualquier momento: menú con Terminar partida.

### Diseño y accesibilidad

- Mobile-first, pensado para un celular en vertical a 360 px de ancho; en desktop se centra en una columna de máximo 480 px.
- Botones de al menos 48 px de alto y texto base de 18 px: hay jugadores de 60 años.
- Contraste AA, soporte de modo oscuro con prefers-color-scheme.
- Feedback inmediato en cada toque (estado de carga en el botón) y toasts para errores con el message del servidor.
- Vibración corta (navigator.vibrate(50)) al revelar la carta y al cambiar de fase, si está disponible.
- Sin dependencias pesadas de UI: Tailwind + componentes propios.

## Infraestructura (CDK) y despliegue

Dos stacks de CDK en TypeScript: uno pequeño en us-east-1 solo para el certificado y el principal en la región de trabajo; un solo comando construye y despliega todo.

### Stacks

CertStack (us-east-1)

- acm.Certificate para family-night.fless.dev, validación DNS contra la hosted zone de fless.dev (route53.HostedZone.fromLookup).
- Exporta el ARN vía crossRegionReferences: true.

FamilyNightStack (región principal, por ejemplo us-east-1 o sa-east-1)

1. DynamoDB: las 7 tablas, BillingMode.PAY_PER_REQUEST, TTL ttl en Rooms, RoomMembers, Matches, MatchSecrets y Votes. RemovalPolicy.RETAIN y PITR en Players y PlayerNames; DESTROY en el resto.
2. AppSync Events: appsync.EventApi con proveedores de auth API key + IAM; ChannelNamespace rooms con subscribe API key y publish IAM. API key con expiración de 365 días.
3. Lambda api: NodejsFunction con entry packages/api/src/index.ts, Runtime.NODEJS_22_X, Architecture.ARM_64, 512 MB, timeout 10 s, bundling: { externalModules: ['@aws-sdk/*'], minify: true, sourceMap: true }. Variables de entorno: nombres de tablas, EVENTS_HTTP_DOMAIN, ORIGIN_SECRET, NODE_OPTIONS=--enable-source-maps. Permisos: grantReadWriteData en cada tabla y eventApi.grantPublish(fn). Log retention 14 días.
4. API Gateway: apigwv2.HttpApi con una ruta ANY /api/{proxy+} → integración Lambda. Throttling por defecto: 50 rps, burst 100.
5. S3: bucket privado, BlockPublicAccess.BLOCK_ALL, enforceSSL, sin website hosting.
6. CloudFront Function (viewer request) para el default behavior:

```js
function handler(event) {
  var req = event.request;
  if (!req.uri.includes('.') && !req.uri.startsWith('/api/')) req.uri = '/index.html';
  return req;
}
```

7. CloudFront Distribution:
    - Default behavior → S3 con S3BucketOrigin.withOriginAccessControl, la función anterior, CachePolicy.CACHING_OPTIMIZED, REDIRECT_TO_HTTPS, compresión activada.
    - Behavior /api/* → HttpOrigin del execute-api con custom header x-origin-secret, AllowedMethods.ALLOW_ALL, CachePolicy.CACHING_DISABLED, OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER.
    - domainNames: ['family-night.fless.dev'], certificado del CertStack, minimumProtocolVersion: TLS_V1_2_2021, PriceClass.PRICE_CLASS_ALL (o 100 si se prioriza costo).
8. Route 53: ARecord y AaaaRecord alias a la distribución.
9. Despliegue del front: s3deploy.BucketDeployment en dos pasadas para controlar caché: assets/* con Cache-Control: public, max-age=31536000, immutable; index.html y archivos en la raíz con Cache-Control: no-cache. distribution + distributionPaths: ['/index.html'] para invalidar solo el HTML.
10. Outputs: URL del sitio, endpoint HTTP y realtime de AppSync Events, API key (marcado como sensible; no imprimir en logs de CI).

Secreto de origen: ORIGIN_SECRET se genera una vez y se guarda en SSM Parameter Store (SecureString, /family-night/origin-secret).
CDK lo lee con ssm.StringParameter.valueForStringParameter.
La Lambda rechaza con 403 cualquier request sin el header correcto (excepto si se ejecuta localmente con NODE_ENV=development).

### Configuración del front

El build de Vite necesita tres variables, que se leen de los outputs del stack y se escriben en packages/web/.env.production antes de vite build:

| Variable | Valor |
| --- | --- |
| VITE_EVENTS_HTTP_DOMAIN | Dominio HTTP de AppSync Events (para el header host del handshake) |
| VITE_EVENTS_REALTIME_DOMAIN | Dominio realtime de AppSync Events |
| VITE_EVENTS_API_KEY | API key de AppSync Events |

El API se llama con ruta relativa (/api/...), así que no necesita variable.

### Flujo de despliegue

1. pnpm install
2. pnpm -r test (Vitest en shared, api y web)
3. pnpm -r typecheck
4. Primera vez: cdk deploy CertStack FamilyNightStack con el front vacío para obtener los outputs.
5. Script scripts/write-web-env.ts lee los outputs (aws cloudformation describe-stacks) y escribe .env.production.
6. pnpm --filter web build
7. cdk deploy FamilyNightStack (sube el build y invalida /index.html).

Script raíz (no llamarlo `deploy`, que choca con el comando nativo de pnpm): pasos 2 a 7.
Opcional: GitHub Actions con OIDC hacia un rol de despliegue, ejecutando lo mismo en cada push a main.

### Desarrollo local

- pnpm --filter web dev: Vite con proxy /api hacia la API desplegada en un stage dev, o hacia un servidor local.
- Servidor local del API: el router Hono se exporta también como app de Node (@hono/node-server) apuntando a las tablas del stage dev. El publish a AppSync Events funciona igual con credenciales locales.
- Stage por parámetro de contexto (cdk deploy -c stage=dev): prefija nombres de tablas y usa dev.family-night.fless.dev.

### Costo esperado

Con uso familiar (algunas noches al mes), todo cae dentro o muy cerca del free tier: Lambda, API Gateway, DynamoDB on-demand y AppSync Events cobran por request; CloudFront y S3 son centavos.
El único fijo es la hosted zone de Route 53 (ya existente para fless.dev).

## Seguridad, testing y criterios de aceptación

La fase 1 está terminada cuando una familia de 3 a 10 personas puede jugar varias partidas seguidas de Impostor desde sus celulares sin que nadie pueda ver un secreto ajeno, y todos los criterios de abajo pasan.

### Seguridad

- Secretos: ningún campo de MatchSecrets aparece en RoomSnapshot, en eventos ni en logs. Test automático: serializar el snapshot de una partida en curso y verificar que no contiene la palabra ni la pista.
- Credenciales: playerToken nunca se loguea; en logs solo playerId. Comparación del hash en tiempo constante (crypto.timingSafeEqual).
- Canal: los clientes no pueden publicar (namespace con publish solo IAM). Verificar en un test manual que un publish con API key es rechazado.
- Origen: la Lambda rechaza requests sin x-origin-secret.
- Validación: todo body pasa por zod; IDs con formato UUID; roomCode con el alfabeto definido.
- Abuso: throttling de API Gateway (50 rps) y límite de 20 miembros por sala. No se necesita más para uso familiar.
- Headers de seguridad en CloudFront (ResponseHeadersPolicy.SECURITY_HEADERS) y CSP que permita solo el propio dominio y los dominios de AppSync Events.

### Testing

- Unit (Vitest, shared): reglas del Impostor como funciones puras. Casos mínimos: tabla de impostores por cantidad de jugadores; asignación de roles con semilla; voto único gana; empate con SKIP y con RANDOM; cero votos; victoria de civiles; victoria de impostores por paridad; última oportunidad acertada y fallida; salida de un impostor vivo; varios impostores eliminados en rondas distintas.
- Integración (api): handlers contra DynamoDB Local (Docker) o contra el stage dev, con el publisher de eventos mockeado. Casos: crear jugador con nombre único bajo colisión forzada; crear y unirse a sala; rejoin idempotente; traspaso automático de host; votos concurrentes (20 votos en paralelo cierran la ronda exactamente una vez); STALE_ROUND.
- Frontend: tests de componentes de las pantallas críticas (carta, votación, revelación) con Testing Library.
- E2E manual antes de dar por terminado: 4 navegadores (3 celulares reales + 1 desktop), una partida completa con 1 impostor y otra con 2, recargando un celular en medio de la votación y minimizando otro.

### Criterios de aceptación

- [ ] Al abrir la app por primera vez se asigna un nombre "Animal Adjetivo" en masculino, que se mantiene al recargar y en visitas futuras.
- [ ] Crear una sala muestra un código de 4 letras; el link /{CODE} abierto desde WhatsApp entra directo al lobby.
- [ ] La vista previa en WhatsApp muestra título e imagen.
- [ ] Copiar link y Compartir funcionan en Android, iOS y desktop.
- [ ] Todos ven en tiempo real (menos de 1 s) quién entra, quién está ausente y quién es host.
- [ ] Recargar el navegador en cualquier momento vuelve al mismo estado sin perder el lugar en la partida.
- [ ] Minimizar el celular marca "ausente" y volver lo marca online y resincroniza.
- [ ] El host no puede iniciar Impostor con menos de 3 jugadores online ni con más impostores de los permitidos.
- [ ] Cada jugador ve solo su carta; inspeccionar la red no revela la palabra a un impostor ni el rol de otros.
- [ ] La votación muestra quién votó, se cierra sola al votar todos y el host puede cerrarla antes.
- [ ] La revelación muestra el ranking de votos y si el eliminado era impostor; los empates siguen la regla configurada.
- [ ] La partida termina correctamente en los tres casos: civiles ganan, impostores ganan por paridad, impostor roba la victoria adivinando.
- [ ] "Jugar otra vez" usa una palabra no repetida en la noche; "Volver al lobby" lleva a todos al lobby.
- [ ] El puntaje acumulado se actualiza en el lobby después de cada partida.
- [ ] Salas y partidas desaparecen de DynamoDB en 24 h sin actividad (TTL); jugadores y nombres permanecen.
- [ ] Todo el texto de la UI está en español.

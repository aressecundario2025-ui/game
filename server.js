const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

// ===============================
// SERVIDOR WEB
// ===============================

const server = http.createServer((req, res) => {
    let filePath;

    if (req.url === "/" || req.url === "/index.html") {
        filePath = path.join(__dirname, "index.html");
    } else if (req.url === "/game.js") {
        filePath = path.join(__dirname, "game.js");
    } else if (req.url === "/style.css") {
        filePath = path.join(__dirname, "style.css");
    } else {
        res.writeHead(404, {
            "Content-Type": "text/plain"
        });

        res.end("404 - Archivo no encontrado");
        return;
    }

    const extension = path.extname(filePath);

    const contentTypes = {
        ".html": "text/html; charset=utf-8",
        ".js": "application/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8"
    };

    fs.readFile(filePath, (error, content) => {
        if (error) {
            console.error(error);

            res.writeHead(500, {
                "Content-Type": "text/plain"
            });

            res.end("Error del servidor");
            return;
        }

        res.writeHead(200, {
            "Content-Type":
                contentTypes[extension] ||
                "text/plain"
        });

        res.end(content);
    });
});

// ===============================
// WEBSOCKET
// ===============================

const wss = new WebSocket.Server({
    server
});

// ===============================
// JUGADORES
// ===============================

const players = new Map();

let nextPlayerId = 1;

// ===============================
// MUNDO
// ===============================

// Guardamos los bloques en un Map.
// Ejemplo:
// "10,1,5" -> { x: 10, y: 1, z: 5, type: 2 }

const worldBlocks = new Map();

function blockKey(x, y, z) {
    return `${x},${y},${z}`;
}

// ===============================
// CREAR MUNDO INICIAL
// ===============================

function generateWorld() {

    if (worldBlocks.size > 0) {
        return;
    }

    console.log("Generando mundo...");

    // Suelo
    for (let x = -30; x <= 30; x++) {

        for (let z = -30; z <= 30; z++) {

            addBlock(
                x,
                0,
                z,
                3
            );

            addBlock(
                x,
                -1,
                z,
                0
            );

            addBlock(
                x,
                -2,
                z,
                1
            );
        }
    }

    // Árboles
    const trees = [
        [-10, -5],
        [-5, 8],
        [4, -8],
        [9, 6],
        [-15, 12],
        [15, -10],
        [12, 14],
        [-18, -12]
    ];

    for (const [x, z] of trees) {

        // Tronco
        for (let y = 1; y <= 3; y++) {

            addBlock(
                x,
                y,
                z,
                2
            );
        }

        // Hojas
        for (
            let xx = x - 1;
            xx <= x + 1;
            xx++
        ) {

            for (
                let zz = z - 1;
                zz <= z + 1;
                zz++
            ) {

                addBlock(
                    xx,
                    4,
                    zz,
                    3
                );
            }
        }

        addBlock(
            x,
            5,
            z,
            3
        );
    }

    console.log(
        `Mundo generado: ${worldBlocks.size} bloques`
    );
}

// ===============================
// AÑADIR BLOQUE
// ===============================

function addBlock(
    x,
    y,
    z,
    type = 0
) {

    x = Math.round(Number(x));
    y = Math.round(Number(y));
    z = Math.round(Number(z));

    const key =
        blockKey(x, y, z);

    // No duplicar
    if (worldBlocks.has(key)) {
        return false;
    }

    worldBlocks.set(
        key,
        {
            x,
            y,
            z,
            type: Number(type) || 0
        }
    );

    return true;
}

// ===============================
// ELIMINAR BLOQUE
// ===============================

function removeBlock(
    x,
    y,
    z
) {

    x = Math.round(Number(x));
    y = Math.round(Number(y));
    z = Math.round(Number(z));

    const key =
        blockKey(x, y, z);

    return worldBlocks.delete(key);
}

// ===============================
// ENVIAR A TODOS
// ===============================

function broadcast(
    message,
    excluded = null
) {

    const data =
        JSON.stringify(message);

    for (
        const playerData
        of players.values()
    ) {

        const ws =
            playerData.ws;

        if (
            ws !== excluded &&
            ws.readyState ===
            WebSocket.OPEN
        ) {

            ws.send(data);
        }
    }
}

// ===============================
// ACTUALIZAR Nº JUGADORES
// ===============================

function broadcastPlayerCount() {

    broadcast({
        type: "players",
        count: players.size
    });
}

// ===============================
// CONEXIÓN DE JUGADOR
// ===============================

wss.on(
    "connection",
    ws => {

        const id =
            String(nextPlayerId++);

        const player = {

            id,

            name: "Jugador",

            x: 0,

            y: 3,

            z: 5
        };

        players.set(
            id,
            {
                ws,
                player
            }
        );

        console.log(
            `Jugador conectado: ${id}`
        );

        // Enviar al jugador su ID,
        // jugadores existentes
        // y mundo completo.
        ws.send(
            JSON.stringify({
                type: "welcome",

                id,

                players:
                    [...players.values()]
                        .filter(
                            item =>
                                item.player.id !== id
                        )
                        .map(
                            item =>
                                item.player
                        ),

                blocks:
                    [...worldBlocks.values()]
            })
        );

        // Avisar a los demás
        broadcast(
            {
                type: "playerJoined",
                player
            },
            ws
        );

        broadcastPlayerCount();

        // ===============================
        // MENSAJES
        // ===============================

        ws.on(
            "message",
            raw => {

                let data;

                try {

                    data =
                        JSON.parse(
                            raw.toString()
                        );

                } catch (error) {

                    console.log(
                        "Mensaje JSON inválido"
                    );

                    return;
                }

                const current =
                    players.get(id);

                if (!current) {
                    return;
                }

                // ===============================
                // ENTRAR
                // ===============================

                if (
                    data.type === "join"
                ) {

                    let name =
                        String(
                            data.name ||
                            "Jugador"
                        );

                    // Limitar nombre
                    name =
                        name
                            .replace(
                                /[<>]/g,
                                ""
                            )
                            .slice(
                                0,
                                16
                            );

                    if (
                        name.length === 0
                    ) {
                        name =
                            "Jugador";
                    }

                    current.player.name =
                        name;

                    // Mandar actualización
                    // a los demás
                    broadcast(
                        {
                            type:
                                "playerJoined",
                            player:
                                current.player
                        },
                        ws
                    );

                    return;
                }

                // ===============================
                // MOVIMIENTO
                // ===============================

                if (
                    data.type === "move"
                ) {

                    const x =
                        Number(data.x);

                    const y =
                        Number(data.y);

                    const z =
                        Number(data.z);

                    if (
                        !Number.isFinite(x) ||
                        !Number.isFinite(y) ||
                        !Number.isFinite(z)
                    ) {
                        return;
                    }

                    // Evitar valores absurdos
                    if (
                        Math.abs(x) > 10000 ||
                        Math.abs(y) > 10000 ||
                        Math.abs(z) > 10000
                    ) {
                        return;
                    }

                    current.player.x = x;
                    current.player.y = y;
                    current.player.z = z;

                    broadcast(
                        {
                            type:
                                "playerMoved",

                            id,

                            x,

                            y,

                            z
                        },
                        ws
                    );

                    return;
                }

                // ===============================
                // ROMPER BLOQUE
                // ===============================

                if (
                    data.type ===
                    "blockBreak"
                ) {

                    const x =
                        Number(data.x);

                    const y =
                        Number(data.y);

                    const z =
                        Number(data.z);

                    if (
                        !Number.isFinite(x) ||
                        !Number.isFinite(y) ||
                        !Number.isFinite(z)
                    ) {
                        return;
                    }

                    const removed =
                        removeBlock(
                            x,
                            y,
                            z
                        );

                    if (!removed) {
                        return;
                    }

                    console.log(
                        `${current.player.name} rompió ${x},${y},${z}`
                    );

                    // Avisar a TODOS,
                    // incluido el jugador
                    broadcast({
                        type:
                            "blockBreak",

                        x:
                            Math.round(x),

                        y:
                            Math.round(y),

                        z:
                            Math.round(z)
                    });

                    return;
                }

                // ===============================
                // COLOCAR BLOQUE
                // ===============================

                if (
                    data.type ===
                    "blockPlace"
                ) {

                    const x =
                        Number(data.x);

                    const y =
                        Number(data.y);

                    const z =
                        Number(data.z);

                    const type =
                        Number(
                            data.blockType
                        );

                    if (
                        !Number.isFinite(x) ||
                        !Number.isFinite(y) ||
                        !Number.isFinite(z)
                    ) {
                        return;
                    }

                    if (
                        !Number.isInteger(type) ||
                        type < 0 ||
                        type > 4
                    ) {
                        return;
                    }

                    const blockX =
                        Math.round(x);

                    const blockY =
                        Math.round(y);

                    const blockZ =
                        Math.round(z);

                    // Evitar duplicados
                    if (
                        worldBlocks.has(
                            blockKey(
                                blockX,
                                blockY,
                                blockZ
                            )
                        )
                    ) {
                        return;
                    }

                    const added =
                        addBlock(
                            blockX,
                            blockY,
                            blockZ,
                            type
                        );

                    if (!added) {
                        return;
                    }

                    console.log(
                        `${current.player.name} colocó ${blockX},${blockY},${blockZ}`
                    );

                    // Sincronizar con todos
                    broadcast({
                        type:
                            "blockPlace",

                        x:
                            blockX,

                        y:
                            blockY,

                        z:
                            blockZ,

                        blockType:
                            type
                    });

                    return;
                }
            }
        );

        // ===============================
        // DESCONECTAR
        // ===============================

        ws.on(
            "close",
            () => {

                const current =
                    players.get(id);

                const name =
                    current
                        ? current.player.name
                        : "Jugador";

                players.delete(id);

                console.log(
                    `${name} se desconectó`
                );

                broadcast({
                    type:
                        "playerLeft",

                    id
                });

                broadcastPlayerCount();
            }
        );

        ws.on(
            "error",
            error => {

                console.error(
                    `Error WebSocket ${id}:`,
                    error.message
                );
            }
        );
    }
);

// ===============================
// GENERAR MUNDO
// ===============================

generateWorld();

// ===============================
// INICIAR SERVIDOR
// ===============================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🎮 Game Interactive iniciado`
        );

        console.log(
            `Puerto: ${PORT}`
        );

        console.log(
            `Bloques: ${worldBlocks.size}`
        );
    }
);
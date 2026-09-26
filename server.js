const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {

    let filePath;

    if (req.url === "/" || req.url === "/index.html") {
        filePath = path.join(__dirname, "index.html");
    } else if (req.url === "/game.js") {
        filePath = path.join(__dirname, "game.js");
    } else if (req.url === "/style.css") {
        filePath = path.join(__dirname, "style.css");
    } else {
        res.writeHead(404);
        res.end("404");
        return;
    }

    const extension =
        path.extname(filePath);

    const contentTypes = {
        ".html": "text/html",
        ".js": "application/javascript",
        ".css": "text/css"
    };

    fs.readFile(
        filePath,
        (error, content) => {

            if (error) {

                res.writeHead(500);
                res.end("Error");

                return;
            }

            res.writeHead(
                200,
                {
                    "Content-Type":
                        contentTypes[extension] ||
                        "text/plain"
                }
            );

            res.end(content);
        }
    );
});

const wss =
    new WebSocket.Server({
        server
    });

const players = new Map();

let nextId = 1;

wss.on("connection", ws => {

    const id =
        String(nextId++);

    const player = {
        id,
        name: "Jugador",
        x: 0,
        y: 1.8,
        z: 5
    };

    players.set(id, {
        ws,
        player
    });

    ws.send(
        JSON.stringify({
            type: "welcome",
            id,
            players: [...players.values()]
                .filter(item => item.player.id !== id)
                .map(item => item.player)
        })
    );

    broadcast(
        {
            type: "playerJoined",
            player
        },
        ws
    );

    broadcastPlayers();

    ws.on("message", raw => {

        let data;

        try {
            data = JSON.parse(raw.toString());
        } catch {
            return;
        }

        const current =
            players.get(id);

        if (!current) {
            return;
        }

        if (data.type === "join") {

            current.player.name =
                String(data.name || "Jugador")
                    .slice(0, 16);
        }

        if (data.type === "move") {

            current.player.x =
                Number(data.x) || 0;

            current.player.y =
                Number(data.y) || 1.8;

            current.player.z =
                Number(data.z) || 0;

            broadcast(
                {
                    type: "playerMoved",
                    id,
                    x: current.player.x,
                    y: current.player.y,
                    z: current.player.z
                },
                ws
            );
        }

        if (data.type === "blockBreak") {

            broadcast(
                {
                    type: "blockBreak",
                    x: data.x,
                    y: data.y,
                    z: data.z
                },
                ws
            );
        }

        if (data.type === "blockPlace") {

            broadcast(
                {
                    type: "blockPlace",
                    x: data.x,
                    y: data.y,
                    z: data.z
                },
                ws
            );
        }
    });

    ws.on("close", () => {

        players.delete(id);

        broadcast({
            type: "playerLeft",
            id
        });

        broadcastPlayers();
    });
});

function broadcast(message, excluded = null) {

    const data =
        JSON.stringify(message);

    for (const item of players.values()) {

        if (
            item.ws !== excluded &&
            item.ws.readyState === WebSocket.OPEN
        ) {

            item.ws.send(data);
        }
    }
}

function broadcastPlayers() {

    broadcast({
        type: "players",
        count: players.size
    });
}

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Game Interactive iniciado en puerto ${PORT}`
        );
    }
);
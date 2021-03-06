import e from 'express';
import express, { Express, Request, Response } from 'express';
import * as http from 'http';
import * as socketio from 'socket.io';

const port: number = parseInt(process.env.PORT || '3000', 10);
const dev: boolean = process.env.NODE_ENV !== 'production';

const app: Express = express();
const server: http.Server = http.createServer(app);
const io: socketio.Server = new socketio.Server();

//Game stuff
class Player {
    public socket!: socketio.Socket;

    constructor(socket: socketio.Socket) {
        this.socket = socket;
    }
}

class PlayerState {
    public id = ""
    public x = 0;
    public z = 0;

    constructor(id: string) {
        this.id = id;
    }
}

class GameState {
    public playersStates = new Array<PlayerState>();
}

class GameServer {
    public players = new Map<string, Player>();
    public gameState = new GameState();

    addPlayer(socket: socketio.Socket) {
        this.players.forEach(p => {
            socket.emit("player-connect", p.socket.id);
        });
        socket.emit("game-state-update", this.gameState);
        this.players.set(socket.id, new Player(socket));
        console.log(`adding player ${socket.id}`);

        let playerState = new PlayerState(socket.id);
        this.gameState.playersStates.push(playerState);

        socket.on('disconnect', () => {
            console.log('client disconnected');
            this.players.delete(socket.id);
            let player = this.gameState.playersStates.find((ps) => { return ps.id == socket.id });
            if (player != undefined) {
                let playerIndex = this.gameState.playersStates.indexOf(player)
                this.gameState.playersStates.splice(playerIndex, 1);
                this.broadCastEmit("player-disconnect", socket.id);
            }
        });

        socket.on("player-input", (arg) => {
            console.log(arg); // world
            console.log(JSON.stringify(this.gameState));
            let player = this.gameState.playersStates.find((ps) => { return ps.id == socket.id });
            if (player != undefined) {
                player.x += arg.horizontal;
                player.z += arg.vertical;
                this.broadCastEmit("game-state-update", this.gameState);
            }
            else {
                console.log(`Could not find player for socket: ${socket.id}`);
            }
        });

        this.broadCastEmit("player-connect", socket.id);
    }

    broadCastEmit(ev: string, ...args: any[]) {
        this.players.forEach(player => {
            player.socket.emit(ev, args);
        });
    }
}

var gameServer = new GameServer();

io.attach(server, {
    cors: {
        origin: `http://localhost:${port}`,
        methods: ["GET", "POST"],
        allowedHeaders: ["my-custom-header", "Access-Control-Allow-Origin"],
        credentials: true
    }
});
//https://socket.io/docs/v3/handling-cors/

app.get('/', async (_: Request, res: Response) => {
    res.send('Server is running...')
});

app.get('/hello', async (_: Request, res: Response) => {
    res.send('Hello World')
});

io.on('connection', (socket: socketio.Socket) => {
    console.log('connection');
    gameServer.addPlayer(socket);
});

server.listen(port, () => {
    console.log(`> Ready on http://localhost:${port}`);
});

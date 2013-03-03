package main

import (
	"io"
	"os"
	"log"
	"fmt"
	"time"
	"strings"
	"net/http"
// 	mrand "math/rand"
// 	"math"
	"crypto/rand"
	"runtime/pprof"
	"code.google.com/p/go.net/websocket"
)

var globalWorld = newWorld()

func handler(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "." + r.URL.Path)
}

type Message struct {
	Kind string
	Payload map[string]interface{}
}

func newMessage(kind string) *Message {
	ms := new(Message)
	ms.Kind = kind
	ms.Payload = make(map[string]interface{})
	return ms
}

func (m *Message) String() string {
	return fmt.Sprintf("{kind: %s, payload: %v}", m.Kind, m.Payload)
}

// http://stackoverflow.com/questions/12771930/what-is-the-fastest-way-to-generate-a-long-random-string-in-go
func randString(n int) string {
	const alphanum = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	var bytes = make([]byte, n)
	rand.Read(bytes)
	for i, b := range bytes {
		bytes[i] = alphanum[b % byte(len(alphanum))]
	}
	return string(bytes)
}

type Player struct {
	w *World
	ws *websocket.Conn
	in chan *Message
	out chan *Message
	name string
	inBroadcast chan *Message
	cm *ChunkManager
}

func newPlayer(ws *websocket.Conn) *Player {
	p := new(Player)
	p.w = globalWorld
	p.ws = ws
	p.in = make(chan *Message, 10)
	p.out = make(chan *Message, 10)
	p.name = "player-" + randString(10)
	p.inBroadcast = make(chan *Message, 10)
	p.cm = newChunkManager()
	return p
}

func (p *Player) handleIncoming() {
	for {
		ms := new(Message)
		err := websocket.JSON.Receive(p.ws, ms)
		if err != nil {
			if err != io.EOF {
				log.Print("Reading websocket message (", p.name, "): ", err)
			}
			close(p.in)
			return
		}
		p.in <- ms
	}
}

func (p *Player) handleOutgoing() {
	for {
		ms := <-p.out
		err := websocket.JSON.Send(p.ws, ms)
		if err != nil {
			log.Print("Sending websocket message (", p.name, "): ", err)
			return
		}
	}
}

func (p *Player) queueChunk(cc ChunkCoords) {
	p.cm.queue(cc)
}

func (p *Player) sendShowChunk(cc ChunkCoords) {
	p.cm.show(cc)
}

func (p *Player) sendHideChunk(cc ChunkCoords) {
	p.cm.hide(cc)
}

func (p *Player) sendPlayerPos(wc WorldCoords) {
	ms := newMessage("player-position")
	ms.Payload["pos"] = wc.toMap()
	p.out <- ms
}

// func (p *Player) sendUnloadChunk(cc ChunkCoords) {
// 	ms := newMessage("unload-chunk")
// 	ms.Payload["ccpos"] = cc.toMap()
//
// 	delete(p.loadedChunks, cc)
// 	delete(p.visibleChunks, cc)
// 	p.chunkOut <- ms
// }

func (p *Player) handleBlock(ms *Message) {
	pl := ms.Payload
	wc := readWorldCoords(pl)
	typ := Block(pl["type"].(float64))

	p.w.changeBlock(wc, typ)
	p.w.broadcast <- ms
}

func (p *Player) handlePlayerPosition(ms *Message) {
	pl := ms.Payload
	// TODO: Verify position is valid
	// (they didn't move too much in the last
	// couple frames, and they are not currently
	// in the ground).
	wc := readWorldCoords(pl["pos"].(map[string]interface{}))

	pl["id"] = p.name
	ms.Kind = "entity-position"
	p.w.broadcast <- ms

	MAX_LOAD_DIST := 1
// 	MIN_HIDE_DIST := 2
// 	MAX_HIDE_DIST := 3

	eachBetween := func (cc ChunkCoords, min, max int, cb func (newCC ChunkCoords, dist int)) {
		occ := func (x, y, z int) ChunkCoords {
			return ChunkCoords{
				x: cc.x + x,
				y: cc.y + y,
				z: cc.z + z,
			}
		}
		cb(cc, 0)
		for i := min; i <= max; i++ {
			for x := -i; x <= i; x++ {
				for y := -i; y <= i; y++ {
					cb(occ(x, y, i), i)
					cb(occ(x, y, -i), i)
				}
			}
			for y := -i; y <= i; y++ {
				for z := 1 - i; z <= i - 1; z++ {
					cb(occ(i, y, z), i)
					cb(occ(-i, y, z), i)
				}
			}
			for x := 1 - i; x <= i - 1; x++ {
				for z := 1 - i; z <= i - 1; z++ {
					cb(occ(x, i, z), i)
					cb(occ(x, -i, z), i)
				}
			}
		}
	}
	cc := wc.Chunk()
	eachBetween(cc, 0, MAX_LOAD_DIST, func (newCC ChunkCoords, dist int) {
		p.cm.display(newCC)
	});
}

func wsHandler(ws *websocket.Conn) {
	config := ws.Config()
	fmt.Println(config, config.Location, config.Origin)
	p := newPlayer(ws)
	globalWorld.register <- p
	defer func () {
		globalWorld.unregister <- p
	}()
	go p.handleIncoming()
	go p.handleOutgoing()

	m := newMessage("player-id")
	m.Payload["id"] = p.name
	p.out <- m

	for {
		select {
		case m := <-p.in:
			if m == nil {
				return
			}
			switch m.Kind {
			case "block":
				p.handleBlock(m)
			case "player-position":
				p.handlePlayerPosition(m)
			default:
				log.Print("Unknown message recieved from client of kind ", m.Kind)
				continue
			}
		case m := <-p.inBroadcast:
			if m.Kind == "entity-position" && p.name == m.Payload["id"] {
				continue
			}
			p.out <- m
		}
	}
}

func chunkHandler(ws *websocket.Conn) {
	config := ws.Config();
	path := config.Location.Path
	name := strings.Split(path, "/")[3]

	p := globalWorld.findPlayer(name)
	log.Print("Chunk handler:", name, p)

	for {
		var ms *Message
		select {
		case ms = <-p.cm.messages:
		case <-time.After(100*time.Millisecond):
			cc, valid := p.cm.top()
			if !valid {
				continue
			}
			ms = newMessage("chunk")
			ms.Payload["ccpos"] = cc.toMap()
			ms.Payload["size"] = map[string]interface{}{
				"w": CHUNK_WIDTH,
				"h": CHUNK_HEIGHT,
				"d": CHUNK_DEPTH,
			}

			chunk := p.w.requestChunk(cc)
			ms.Payload["data"] = chunk.Flatten()
		}
		log.Print("Sending chunk message of kind ", ms.Kind, " at ", ms.Payload["ccpos"])
		err := websocket.JSON.Send(ws, ms)
		if err != nil {
			log.Print("Sending chunk websocket message (", p.name, "): ", err)
			return
		}
	}
}

func doProfile() {
	f, err := os.Create("cpuprofile")
	if err != nil {
		log.Fatal(err)
	}
	pprof.StartCPUProfile(f)

	go func () {
		for i := 1; i < 5; i++ {
			<-time.After(30*time.Second)
			log.Print(i * 30, " seconds past")
		}
		pprof.StopCPUProfile()
		os.Exit(1)
	}()
}

func main() {
	go globalWorld.run()
	http.HandleFunc("/", handler)
	http.Handle("/ws/new", websocket.Handler(wsHandler))
	http.Handle("/ws/chunks/", websocket.Handler(chunkHandler))
	err := http.ListenAndServe(":8080", nil)
	if err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}

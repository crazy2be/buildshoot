package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"runtime/pprof"
	"strings"
	"time"
	"crypto/tls"
	"io/ioutil"
	"encoding/json"

	"code.google.com/p/go.net/websocket"
	"github.com/sbinet/liner"

	"buildblast/lib/game"
)

var globalGame = NewGame()

func handler(w http.ResponseWriter, r *http.Request) {
	// Workaround for Quentin's system configuration.
	// For some reason, css files are getting served
	// without a content-type...
	if strings.HasSuffix(r.URL.Path, ".css") {
		w.Header().Set("Content-Type", "text/css")
	}
	http.ServeFile(w, r, "."+r.URL.Path)
}

func getClientName(config *websocket.Config) string {
	path := config.Location.Path
	bits := strings.Split(path, "/")
	if len(bits) < 4 {
		return ""
	}
	return bits[3]
}

type ApiUserResponse struct {
	Id int
	Email string
	Name string
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
	Error string
}

func authenticate(ws *websocket.Conn) (*ApiUserResponse, string, error) {
	errMessage := "An internal error occured while authenticating: "

	// Read the seesion cookie
        cookie, err := ws.Request().Cookie("session_token")
	if err != nil {
		return nil, "Not signed in.", err
	}

	// Submit the cookie to the auth server, for verification
        token := cookie.Value
        tr := &http.Transport{
                TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
        }
        cli := &http.Client{ Transport: tr }
        req, err := http.NewRequest("GET", "https://www.buildblast.com/api/users/" + token, nil)
	if err != nil {
                log.Println(errMessage, err)
                return nil, errMessage + "Can't connect to auth server.", err
	}
        req.SetBasicAuth("name", "password")
        res, err := cli.Do(req)
	if err != nil {
                log.Println(errMessage, err)
                return nil, errMessage + "Auth server connection issue.", err
	}

	// Parse the response
        defer res.Body.Close()
        body, err := ioutil.ReadAll(res.Body)
	if err != nil {
                log.Println(errMessage, err)
                return nil, errMessage + "Could not read auth response.", err
	}
        var data ApiUserResponse
        err = json.Unmarshal(body, &data)
	if err != nil {
                log.Println(errMessage, err)
                return nil, errMessage + "Could not parse auth response.", err
	}

	return &data, "", nil
}

func mainSocketHandler(ws *websocket.Conn) {
	conn := NewConn(ws)

	_, err := conn.Recv()
	if err != nil {
		log.Println("Error connecting client, unable to read handshake message: ", err)
		return
	}

	user, message, err := authenticate(ws)
	var authed bool
	var authMessage string

	if err != nil {
		authed = false
		authMessage = message
	} else if user.Error != "" {
		authed = false
		authMessage = "Not signed in"
	} else {
		authed = true
		authMessage = "Welcome " + user.Name + "!"
	}

	var baseName string
	if authed {
		baseName = user.Name
	} else {
		baseName = "guest"
	}

	name := baseName
	nameNumber := 1
	var client *Client
	for {
		var isNew bool
		client, isNew = globalGame.clientWithID(name)
		if isNew {
			break
		}
		name = fmt.Sprintf("%s-%d", baseName, nameNumber)
		nameNumber++
	}

	// FIXME: We could give the client their entity's
	// actual initial state as part of the handshake,
	// but it's currently impossible since the entity
	// isn't yet created at the handshake stage.
	info := makePlayerEntityCreatedMessage(game.EntityID(name), game.EntityState{})

	conn.Send(&MsgHandshakeReply{
		ServerTime:       float64(time.Now().UnixNano()) / 1e6,
		ClientID:         name,
		PlayerEntityInfo: *info,
		Authenticated:    authed,
		AuthMessage:      authMessage,
	})

	client.Run(conn)
}

func chunkSocketHandler(ws *websocket.Conn) {
	name := getClientName(ws.Config())

	client, isNew := globalGame.clientWithID(name)
	if isNew {
		log.Println("Warning: Attempt to connect to chunk socket for client '" + name + "' who is not connected on main socket!")
		globalGame.Disconnect(name, "invalid connection")
		return
	}
	client.RunChunks(NewConn(ws))
}

func doProfile() {
	f, err := os.Create("cpuprofile")
	if err != nil {
		log.Fatal(err)
	}
	pprof.StartCPUProfile(f)

	go func() {
		cycles := 4
		for i := 0; i < cycles; i++ {
			log.Print((cycles-i)*30, " seconds left")
			<-time.After(30 * time.Second)
		}
		pprof.StopCPUProfile()
		log.Print("Done! Exiting...")
		os.Exit(1)
	}()
}

func setupPrompt() {
	quit := make(chan bool)

	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt)

	state := liner.NewLiner()
	go promptLoop(quit, state)

	go func() {
		<-c
		fmt.Println()
		quit <- true
	}()

	go func() {
		<-quit
		state.Close()
		os.Exit(0)
	}()
}

func promptLoop(quit chan bool, state *liner.State) {
	for {
		cmd, err := state.Prompt(" >>> ")
		state.AppendHistory(cmd)
		if err != nil {
			fmt.Println()
			log.Println("ERROR:", err)
			quit <- true
			return
		}
		if cmd == "exit" {
			quit <- true
			return
		}
	}
}

func main() {
	// 	setupPrompt()
	host := flag.String("host", ":8080", "Sets the host the server listens on for both http requests and websocket connections. Ex: \":8080\", \"localhost\", \"foobar.com\"")
	flag.Parse()

	runtime.GOMAXPROCS(runtime.NumCPU())
	go globalGame.Run()
	// 	go doProfile()

	http.HandleFunc("/", handler)
	http.Handle("/sockets/main/", websocket.Handler(mainSocketHandler))
	http.Handle("/sockets/chunk/", websocket.Handler(chunkSocketHandler))

	err := http.ListenAndServe(*host, nil)
	if err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}

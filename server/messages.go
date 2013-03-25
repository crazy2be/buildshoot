package main

import (
	"encoding/json"
)

type MessageKind string

const (
	MSG_ENTITY_CREATE   = MessageKind("entity-create")
	MSG_ENTITY_POSITION = MessageKind("entity-position")
	MSG_ENTITY_REMOVE   = MessageKind("entity-remove")
	MSG_CHUNK           = MessageKind("chunk")
	MSG_BLOCK           = MessageKind("block")
	MSG_PLAYER_POSITION = MessageKind("player-position")
)

type MsgEntityCreate struct {
	ID string
}

type MsgEntityPosition struct {
	Pos   WorldCoords
	Rot   Vec3
	ID    string
}

type MsgEntityRemove struct {
	ID string
}

type MsgChunk struct {
	CCPos ChunkCoords
	Size  Vec3
	// Go is really slow at encoding arrays. This
	// is much faster (and more space efficient)
	Data  string
}

type MsgBlock struct {
	Pos  WorldCoords
	Type Block
}

type MsgPlayerPosition struct {
	Pos      WorldCoords
	Rot      Vec3
	Controls ControlState
}

type ClientMessage struct {
	Kind MessageKind
	Payload json.RawMessage
}

type Message interface{}

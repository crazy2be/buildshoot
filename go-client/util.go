package main

import (
	"github.com/go-gl/gl"
	"image"
	"image/png"
	"io"
	"os"
	"log"
	"io/ioutil"
	"errors"
)

// from go-gl/gl example w/ spinning gopher cube
func loadTexture(path string) gl.Texture {
	goph, err := os.Open("../client/img/block_textures/atlas.png")
	if err != nil {
		log.Fatal("Error loading texture:", err)
	}
	defer goph.Close()

	texture, err := createTexture(goph)
	if err != nil {
		log.Fatal("Error creating texture:", err)
	}
	return texture
}

func createTexture(r io.Reader) (gl.Texture, error) {
	img, err := png.Decode(r)
	if err != nil {
		return gl.Texture(0), err
	}

	rgbaImg, ok := img.(*image.NRGBA)
	if !ok {
		return gl.Texture(0), errors.New("texture must be an NRGBA image")
	}

	textureId := gl.GenTexture()
	textureId.Bind(gl.TEXTURE_2D)
	gl.TexParameterf(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
	gl.TexParameterf(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)

	// flip image: first pixel is lower left corner
	imgWidth, imgHeight := img.Bounds().Dx(), img.Bounds().Dy()
	data := make([]byte, imgWidth*imgHeight*4)
	lineLen := imgWidth * 4
	dest := len(data) - lineLen
	for src := 0; src < len(rgbaImg.Pix); src += rgbaImg.Stride {
		copy(data[dest:dest+lineLen], rgbaImg.Pix[src:src+rgbaImg.Stride])
		dest -= lineLen
	}
	gl.TexImage2D(gl.TEXTURE_2D, 0, 4, imgWidth, imgHeight, 0, gl.RGBA, gl.UNSIGNED_BYTE, data)

	return textureId, nil
}


// Ported from Craft source
func make_shader(type_ gl.GLenum, source []byte) gl.Shader {
    shader := gl.CreateShader(type_)
    shader.Source(string(source))
    shader.Compile()
	status := shader.Get(gl.COMPILE_STATUS)
    if (status == gl.FALSE) {
		log.Fatal("Error compiling shader! ", shader.GetInfoLog())
    }
    return shader;
}

func load_shader(type_ gl.GLenum, path string) gl.Shader {
    data, err := ioutil.ReadFile(path)
	if err != nil {panic(err)}
    return make_shader(type_, data)
}

func make_program(shader1 gl.Shader, shader2 gl.Shader) gl.Program {
    program := gl.CreateProgram()
    program.AttachShader(shader1)
    program.AttachShader(shader2)
	program.Link()
	status := program.Get(gl.LINK_STATUS)
    if (status == gl.FALSE) {
		log.Fatal("Error linking program! ", program.GetInfoLog())
    }
    // ???? Why detach the shaders?
//     glDetachShader(program, shader1);
//     glDetachShader(program, shader2);
//     glDeleteShader(shader1);
//     glDeleteShader(shader2);
    return program;
}

func loadProgram(path1, path2 string) gl.Program {
    shader1 := load_shader(gl.VERTEX_SHADER, path1);
    shader2 := load_shader(gl.FRAGMENT_SHADER, path2);
    program := make_program(shader1, shader2);
    return program;
}

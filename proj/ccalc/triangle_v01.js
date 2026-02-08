const canvas = document.getElementById('mainCanvas');
// const gl = canvas.getContext('webgl');

const gl = canvas.getContext('webgl2', { 
    antialias: false,
});

gl.viewport(0, 0, canvas.width, canvas.height);


if (!gl) {
    alert("Unable to initialize WebGL. Your browser or machine may not support it.");
}

class Caster {
    // virtCoords: {xMin: number, xMax: number, yMin: number, yMax: number};
    constructor(canvas, virtCoords) {
        this.canvas = {
            xMin: 0,
            xMax: canvas.width,
            yMin: 0,
            yMax: canvas.height
        }
        this.virtCoords = {
            xMin: virtCoords.xMin,
            xMax: virtCoords.xMax,
            yMin: virtCoords.yMin,
            yMax: virtCoords.yMax
        }
        this.gl = {
            xMin: -1.0,
            xMax: 1.0,
            yMin: -1.0,
            yMax: 1.0
        }
    }
    interpolate(xy, srcQuad, dstQuad) {
        let [x, y] = xy;
        let tx = (x - srcQuad.xMin) / (srcQuad.xMax - srcQuad.xMin);
        let ty = (y - srcQuad.yMin) / (srcQuad.yMax - srcQuad.yMin);
        let dstX = dstQuad.xMin + tx * (dstQuad.xMax - dstQuad.xMin);
        let dstY = dstQuad.yMin + ty * (dstQuad.yMax - dstQuad.yMin);
        return [dstX, dstY];
    }
    canvas2gl(xy) {
        return this.interpolate(xy, this.canvas, this.gl);
    }
    canvas2virt(xy) {
        return this.interpolate(xy, this.canvas, this.virtCoords);
    }
    virt2gl(xy) {
        return this.interpolate(xy, this.virtCoords, this.gl);
    }
    virt2canvas(xy) {
        return this.interpolate(xy, this.virtCoords, this.canvas);
    }
    gl2canvas(xy) {
        return this.interpolate(xy, this.gl, this.canvas);
    }
    gl2virt(xy) {
        return this.interpolate(xy, this.gl, this.virtCoords);
    }
}

// let's say virt coords are -10, 10 in x and proportionally in y
let aspect = canvas.height / canvas.width;
let virtCoords = {
    xMin: -10.0,
    xMax: 10.0,
    yMin: -10.0 * aspect,
    yMax: 10.0 * aspect
};

console.log('virtCoords:', virtCoords);

// let virtCoords = {
//     xMin: -10.0,
//     xMax: 10.0,
//     yMin: -20,
//     yMax: 20
// };


const caster = new Caster(canvas, virtCoords);    


function loadShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vshader, fshader) {
    var vertexShader = loadShader(gl, gl.VERTEX_SHADER, vshader);
    var fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fshader);
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error('Unable to initialize the shader program: ' + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function initShaders(gl, vshader, fshader) {
    var program = createProgram(gl, vshader, fshader);
    if (!program) return null;
    gl.useProgram(program);
    return program;
}

class TriangleRenderer {
    constructor(gl, program) {
        this.gl = gl;
        this.program = program;

        this.positions = [];
        this.colors = [];
        this.vertexCount = 0;

        this.positionBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();

        this.a_Position = gl.getAttribLocation(program, 'a_Position');
        this.a_Color = gl.getAttribLocation(program, 'a_Color');
    }

    addTriangle(v1, v2, v3, c1, c2, c3) {
        this.positions.push(...v1, ...v2, ...v3);
        this.colors.push(...c1, ...c2, ...c3);
        this.vertexCount += 3;
    }

    clearTriangles() {
        this.positions = [];
        this.colors = [];
        this.vertexCount = 0;
    }

    updateBuffers() {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colors), gl.STATIC_DRAW);
    }

    render() {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.a_Position, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_Position);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(this.a_Color, 4, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_Color);

        if (this.vertexCount > 0) {
            gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
        }
    }
}


var VSHADER_SOURCE = `
attribute vec4 a_Position;
attribute vec4 a_Color;
varying vec4 v_Color;

void main() {
   gl_Position = a_Position;
   v_Color = a_Color;
    gl_PointSize = 10.0;
}
`

var FSHADER_SOURCE =  `
precision highp float;
varying vec4 v_Color;
void main() {
   gl_FragColor = v_Color;
}
`


const program = initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);
const renderer = new TriangleRenderer(gl, program);


// simple triangle 

let red = [1.0, 0.0, 0.0, 1.0];
let green = [0.0, 1.0, 0.0, 1.0];
let blue = [0.0, 0.0, 1.0, 1.0];

// renderer.addTriangle(
//     caster.virt2gl([-10, 20]), 
//     caster.virt2gl([10, 20]), 
//     caster.virt2gl([10, -20]),
//     red,
//     red,
//     red
// );


// renderer.addTriangle(
//     [-0.9, 1.0], 
//     [-1.0, -1.0], 
//     [1.0, -1.0],
//     green, 
//     green, 
//     green
// )


// create a red circle 


// DEPENDS ON: renderer and caster 
let add_circle = function(cx, cy, r, segments, color) {
    for (let i = 0; i < segments; i++) {
        let theta1 = (2.0 * Math.PI * i) / segments;
        let theta2 = (2.0 * Math.PI * (i + 1)) / segments;
        
        let x1 = cx + r * Math.cos(theta1);
        let y1 = cy + r * Math.sin(theta1);
        let x2 = cx + r * Math.cos(theta2);
        let y2 = cy + r * Math.sin(theta2);
        renderer.addTriangle(
            caster.virt2gl([cx, cy]),
            caster.virt2gl([x1, y1]),
            caster.virt2gl([x2, y2]),
            color,
            color,
            color
        );
    }
}

let ort_vec = function(dx, dy) {
    let len = Math.sqrt(dx * dx + dy * dy);
    return [-dy / len, dx / len];
}

let add_line = function(x1, y1, x2, y2, thickness, color) {
    // compute direction vector
    let dx = x2 - x1;
    let dy = y2 - y1;
    let [ox, oy] = ort_vec(dx, dy);
    ox *= thickness / 2.0;
    oy *= thickness / 2.0;
    
    // compute 4 corners
    let v1 = [x1 + ox, y1 + oy];
    let v2 = [x2 + ox, y2 + oy];
    let v3 = [x2 - ox, y2 - oy];
    let v4 = [x1 - ox, y1 - oy];
    
    // add two triangles
    renderer.addTriangle(
        caster.virt2gl(v1),
        caster.virt2gl(v2),
        caster.virt2gl(v3),
        color,
        color,
        color
    );
    renderer.addTriangle(
        caster.virt2gl(v1),
        caster.virt2gl(v3),
        caster.virt2gl(v4),
        color,
        color,
        color
    );
}

// add_circle(0, 0, 5.0, 50, green);


for (let x = -10; x <= 10; x += 0.5) {
    for (let y = -10 * aspect; y <= 10 * aspect; y += 0.5) {
        add_line(x, y, x, y + 0.5, 0.04, red);
        add_line(x, y, x + 0.5, y, 0.04, red);
    }
}

for (let x = -10; x <= 10; x += 0.5) {
    for (let y = -10 * aspect; y <= 10 * aspect; y += 0.5) {
        add_circle(x, y, 0.08, 10, blue);
    }
}



// renderer.addTriangle(
    
// )



renderer.updateBuffers();
renderer.render();
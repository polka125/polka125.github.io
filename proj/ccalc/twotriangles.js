const canvas = document.getElementById('mainCanvas');
const gl = canvas.getContext('webgl2');

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
    return program;
}

function initShaders(gl, vshader, fshader) {
    var program = createProgram(gl, vshader, fshader);
    if (!program) return null;
    gl.useProgram(program);
    return program;
}


var VSHADER_SOURCE = `
// js -> vertex shader
attribute vec4 a_Position;
attribute vec4 a_Color;

// vertex shader -> fragment shader
varying vec4 v_Color;
varying vec2 v_Position;

void main() {
    gl_Position = a_Position;
    v_Color = a_Color;
    v_Position = a_Position.xy;
}
`

var FSHADER_SOURCE =  `
precision highp float;
uniform vec4 bounds; // xMin, xMax, yMin, yMax
uniform float radius;
uniform vec4 circleColor;

varying vec2 v_Position;
varying vec4 v_Color;

void main() {
    vec2 pos = vec2(
        (v_Position.x + 1.0) / 2.0 * (bounds.y - bounds.x) + bounds.x,
        (v_Position.y + 1.0) / 2.0 * (bounds.w - bounds.z) + bounds.z
    );
    float norm = length(pos);  
    if (norm < radius) {
        gl_FragColor = circleColor;
    } else {
        discard;
    }
}
`

const program = initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);


let triangleVertices = new Float32Array([
    // First triangle
    -1.0, 1.0, 
    1.0, 1.0, 
    1.0, -1.0,
    // Second triangle
    -1.0, 1.0, 
    1.0, -1.0,
    -1.0, -1.0,
]);

let triangleColors = new Float32Array([
    // First triangle colors (red)
    1.0, 0.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,
    1.0, 0.0, 0.0, 1.0,
    // Second triangle colors (green)
    0.0, 1.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
    0.0, 1.0, 0.0, 1.0,
]);

// Create a buffer object
let vertexBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

let a_Position = gl.getAttribLocation(program, 'a_Position');
gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_Position);

// Create color buffer
let colorBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
gl.bufferData(gl.ARRAY_BUFFER, triangleColors, gl.STATIC_DRAW);

let a_Color = gl.getAttribLocation(program, 'a_Color');
gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
gl.enableVertexAttribArray(a_Color);

var bounds = 10.0;
var displacementX = 10.0;
var displacementY = 0.0;



function animate(timestamp) {

    let u_Bounds = gl.getUniformLocation(program, 'bounds');
    gl.uniform4f(
        u_Bounds, 
        -bounds + displacementX, 
        bounds + displacementX, 
        -bounds + displacementY, 
        bounds + displacementY
    );


    gl.clearColor(0.0, 0.0, 0.0, 0.0);
    gl.clear(gl.COLOR_BUFFER_BIT);


    var radius = 10.0;

    let u_CircleColor = gl.getUniformLocation(program, 'circleColor');
    gl.uniform4f(u_CircleColor, 0.0, 0.0, 1.0, 1.0); 
    let u_Radius = gl.getUniformLocation(program, 'radius');    
    gl.uniform1f(u_Radius, radius);
    gl.uniform4f(u_CircleColor, 0.0, 0.0, 1.0, 1.0); 
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    window.requestAnimationFrame(animate);
}


let scrollZoom = 1.05;

canvas.addEventListener('wheel', function(event) {
    event.preventDefault();
    if (event.deltaY < 0) {
        bounds /= scrollZoom;
    } else {
        bounds *= scrollZoom;
    }
});


let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener('mousedown', function(event) {
    isDragging = true;
    lastMouseX = event.clientX;
    lastMouseY = event.clientY;
});

canvas.addEventListener('mousemove', function(event) {
    if (!isDragging) return;

    const dx = event.clientX - lastMouseX;
    const dy = event.clientY - lastMouseY;

    lastMouseX = event.clientX;
    lastMouseY = event.clientY;

    const viewWidth = bounds * 2;
    const viewHeight = bounds * 2;

    const worldDx = (dx / canvas.clientWidth) * viewWidth;
    const worldDy = (dy / canvas.clientHeight) * viewHeight;

    displacementX -= worldDx;    
    displacementY += worldDy;
});

window.addEventListener('mouseup', function() {
    isDragging = false;
});


window.requestAnimationFrame(animate);


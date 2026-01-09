




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
    if (!program) return false;
    gl.useProgram(program);
    gl.program = program;
    return true;
}

const canvas = document.getElementById('presentationCanvas');
var mouse_x = -1000;
var mouse_y = -1000;


canvas.addEventListener('mousemove', function(ev) {
    mouse_x = ev.clientX;
    mouse_y = ev.clientY;
});


// const gl: WebGLRenderingContext | null = canvas.getContext('webgl');
const gl = canvas.getContext('webgl') || null;


if (!gl) {
    console.log("ERROR: could not initialize gl context.")
}

var VSHADER_SOURCE = 
'attribute vec4 a_Position;\n' +
'void main() {\n' + 
'   gl_Position = a_Position;\n' + 
'   gl_PointSize = 10.0;\n' + 
'}\n';

var FSHADER_SOURCE =  
'precision mediump float;\n' + 
'uniform vec4 u_FragColor;\n' + 
'void main() {\n' + 
'   gl_FragColor = u_FragColor;\n' + 
'}\n';

if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("failed to initialize shaders");
}

var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
if (a_Position < 0) {
    console.log('could not get a_Position');
}

var u_FragColor = gl.getUniformLocation(gl.program, 'u_FragColor');
if (!u_FragColor) {
    console.log('could not get u_FragColor');
}

gl.uniform4f(u_FragColor, 1.0, 0.0, 0.0, 1.0);

var g_points = [];


function get_cursor_clipspace(canvas) {
    var canvas = canvas;
    var rect = canvas.getBoundingClientRect();
    var x = mouse_x;
    var y = mouse_y;

    var canvas_width = canvas.getBoundingClientRect().width;
    var canvas_height = canvas.getBoundingClientRect().height;

    x = ((x - rect.left) - canvas_width / 2) / (canvas_width / 2);
    y = (canvas_height / 2 - (y - rect.top)) / (canvas_height / 2);
    return [x, y];
}


function handle_click(ev, gl, canvas, a_Position) {
    let coords = get_cursor_clipspace(canvas);
    let x = coords[0];
    let y = coords[1];
    g_points.push(x);
    g_points.push(y);            
}

function render(gl, canvas, a_Position, u_FragColor) {

    let coords = get_cursor_clipspace(canvas);
    let x = coords[0];
    let y = coords[1];

    // check if we need to add point
    var x_in_range = (-1 <= x && x <= 1.0);
    var y_in_range = (-1 <= y && y <= 1.0);
    
    var len = g_points.length;
    gl.clear(gl.COLOR_BUFFER_BIT);
    // setup the red color 

    gl.uniform4f(u_FragColor, 1.0, 0.0, 0.0, 1.0);
    for(var i = 0; i < len; i += 2) {
        gl.vertexAttrib3f(a_Position, g_points[i], g_points[i+1], 0.0);
        gl.drawArrays(gl.POINTS, 0, 1);
    }


    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);


    // draw a triangle 
    let triangle_array = [
        0.0, 0.5,
        -0.5, -0.5,
        0.5, -0.5, 
        x, y
    ];
    var positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(triangle_array), gl.STATIC_DRAW);


    var a_Position = gl.getAttribLocation(gl.program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    var size = 2; // 2 components per iteration
    var type = gl.FLOAT;
    var normalize = false;
    var stride = 0;
    var offset = 0;
    gl.vertexAttribPointer(a_Position, size, type, normalize, stride, offset);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (x_in_range && y_in_range) {
        // 

        gl.uniform4f(u_FragColor, 0.0, 1.0, 0.0, 1.0);
        gl.vertexAttrib3f(a_Position, x, y, 0.0);
        gl.drawArrays(gl.POINTS, 3, 1);        
    }


    //reset to red
    gl.uniform4f(u_FragColor, 1.0, 0.0, 0.0, 1.0);
}




canvas.onmousedown = function(ev) {
    handle_click(ev, gl, canvas, a_Position);
}


gl.clearColor(0.0, 0.0, 0.0, 1.0);
gl.clear(gl.COLOR_BUFFER_BIT);


function tick(timestamp) {
    render(gl, canvas, a_Position, u_FragColor);


    window.requestAnimationFrame(tick);
}


window.requestAnimationFrame(tick);

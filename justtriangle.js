var scale = 1; // zoom scale
var old_scase = scale;

var is_mouse_down = false;
var mouse_updated = false;
var screen_dx = 0;
var screen_dy = 0;
var total_dx = 0.0;
var total_dy = 0.0;
var last_mouse_x = 0;
var last_mouse_y = 0;



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
        this.barycentrics = [];
        this.vertexCount = 0;

        this.positionBuffer = gl.createBuffer();
        this.colorBuffer = gl.createBuffer();
        this.baryBuffer = gl.createBuffer();

        this.a_Position = gl.getAttribLocation(program, 'a_Position');
        this.a_Color = gl.getAttribLocation(program, 'a_Color');
        this.a_Barycentric = gl.getAttribLocation(program, 'a_Barycentric');
    }

    addTriangle(v1, v2, v3, c1, c2, c3) {
        this.positions.push(...v1, ...v2, ...v3);
        this.colors.push(...c1, ...c2, ...c3);
        this.barycentrics.push(
            1.0, 0.0, 0.0, 
            0.0, 1.0, 0.0, 
            0.0, 0.0, 1.0
        );
        this.vertexCount += 3;
    }

    clearTriangles() {
        this.positions = [];
        this.colors = [];
        this.barycentrics = [];
        this.vertexCount = 0;
    }

    updateBuffers() {
        const gl = this.gl;

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.positions), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.colors), gl.STATIC_DRAW);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.baryBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(this.barycentrics), gl.STATIC_DRAW);
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

        gl.bindBuffer(gl.ARRAY_BUFFER, this.baryBuffer);
        gl.vertexAttribPointer(this.a_Barycentric, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(this.a_Barycentric);

        if (this.vertexCount > 0) {
            gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
        }
    }
}


const canvas = document.getElementById('presentationCanvas');








var last_canvas_width = canvas.width;
var last_canvas_height = canvas.height;


window.addEventListener('resize', function() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
    mouse_updated = true; // Trigger re-calculation
});

// register mouse wheel for zooming
canvas.addEventListener('wheel', function(event) {
    event.preventDefault();
    const zoomFactor = 1.1;
    if (event.deltaY < 0) {
        // zoom in
        scale *= zoomFactor;
    } else {
        // zoom out
        scale /= zoomFactor;
    }
    console.log("Zoom scale:", scale);
}, { passive: false });


canvas.addEventListener('mousedown', function(e) {
    is_mouse_down = true;
    last_mouse_x = e.clientX;
    last_mouse_y = e.clientY;
});

canvas.addEventListener('mouseup', function(e) {
    is_mouse_down = false;
});

canvas.addEventListener('mousemove', function(e) {
    if (!is_mouse_down) return;

    screen_dx = e.clientX - last_mouse_x;
    screen_dy = e.clientY - last_mouse_y;

    last_mouse_x = e.clientX;
    last_mouse_y = e.clientY;
    total_dx -= screen_dx; 
    total_dy += screen_dy; 

    console.log("total_dx:", total_dx, "total_dy:", total_dy);
    mouse_updated = true;
});

const gl = canvas.getContext('webgl');

if (!gl) {
    console.log("ERROR: could not initialize gl context.");
}

var VSHADER_SOURCE = 
'attribute vec4 a_Position;\n' +
'attribute vec4 a_Color;\n' +
'attribute vec3 a_Barycentric;\n' + 
'varying vec4 v_Color;\n' +
'varying vec3 v_Barycentric;\n' + 
'vec3 rgb2hsv(vec3 c) {' + 
'    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);' + 
'    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));' + 
'    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));' + 
'' + 
'    float d = q.x - min(q.w, q.y);' + 
'    float e = 1.0e-10;' + 
'    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);' + 
'}' + 
'' + 
'vec3 hsv2rgb(vec3 c)' + 
'{' + 
'    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);' + 
'    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);' + 
'    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);' + 
'}' + 
'void main() {\n' + 
'   gl_Position = a_Position;\n' + 
'   gl_PointSize = 10.0;\n' + 
'   v_Color = a_Color;\n' +
'   v_Barycentric = a_Barycentric;\n' + 
'}\n';

var FSHADER_SOURCE =  
'precision highp float;\n' + 
'varying vec4 v_Color;\n' + 
'varying vec3 v_Barycentric;\n' + 
'float computeSpan(vec3 bc) {\n' +
'   float min_bc = min(min(bc.x, bc.y), bc.z);\n' +
'   float max_bc = max(max(bc.x, bc.y), bc.z);\n' +
'   return max_bc - min_bc;\n' +
'}\n' +
'void main() {\n' + 
'   float span = computeSpan(v_Barycentric);\n' + 
'   gl_FragColor = v_Color;\n' + 
'}\n';



function rgb2hsv(r, g, b) {
    let max = Math.max(r, g, b);
    let min = Math.min(r, g, b);
    let d = max - min;
    let h;
    let s = (max === 0 ? 0 : d / max);
    let v = max;
    if (max === min) {
        h = 0; // achromatic
    } else {
        switch (max) {
            case r: 
                h = (g - b) / d + (g < b ? 6 : 0); 
                break;
            case g: 
                h = (b - r) / d + 2; 
                break;
            case b: 
                h = (r - g) / d + 4; 
                break;
        }
        h /= 6;
    }
    return { h, s, v };
}


function hsv2rgb(h, s, v) {
    let r, g, b;

    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);

    // This switch handles the 6 sectors of the color wheel
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }

    return { r, g, b };
}


function complex2rgb(re, im) {
    // we will use 
    abs = Math.sqrt(re * re + im * im)
    angle = Math.atan2(im, re)
    
    // map angle to hue
    h = (angle + Math.PI) / (2 * Math.PI)
    // map abs to value
    v = Math.min(1.0, Math.log(1 + 3 * abs) / 1.5)
    s = 1.0

    let rgb = hsv2rgb(h, s, v);
    return [rgb.r, rgb.g, rgb.b];
}

function complex2rgb_2(re, im) {
    let abs = Math.sqrt(re * re + im * im);
    let angle = Math.atan2(im, re);
    let h = (angle + Math.PI) / (2 * Math.PI);
    let scale = 6.0; 
    let t = Math.log(1 + abs) / scale; 
    let s, v;
    
    if (t < 0.5) {
        s = 1.0;
        v = t * 2.0; // Maps 0.0-0.5 to 0.0-1.0
    } else {
        v = 1.0;
        s = 1.0 - (t - 0.5) * 2.0; // Maps 0.5-1.0 to 1.0-0.0
        if (s < 0) s = 0; 
    }
    let rgb = hsv2rgb(h, s, v);
    return [rgb.r, rgb.g, rgb.b];
}


function complex_mul(a, b) {
    return {
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re
    };
}
function complex_add(a, b) {
    return {
        re: a.re + b.re,
        im: a.im + b.im
    };
}

function complex_div(a, b) {
    let denom = b.re * b.re + b.im * b.im;
    return {
        re: (a.re * b.re + a.im * b.im) / denom,
        im: (a.im * b.re - a.re * b.im) / denom
    };
}

function complex_sub(a, b) {
    return {
        re: a.re - b.re,
        im: a.im - b.im
    };
}

function complex_sin(z) {
    return {
        re: Math.sin(z.re) * Math.cosh(z.im),
        im: Math.cos(z.re) * Math.sinh(z.im)
    };
}

function complex_cos(z) {
    return {
        re: Math.cos(z.re) * Math.cosh(z.im),
        im: -Math.sin(z.re) * Math.sinh(z.im)
    };
}

function complex_pow(base, exponent) {
    // z^w = exp(w * log(z))
    if (base.re === 0 && base.im === 0) return { re: 0, im: 0 };
    let log_base = complex_log(base);
    let product = complex_mul(exponent, log_base);
    return exp_complex(product);
}

// x^5 + x^4 + 1


class ComplexParser {
    constructor(expression) {
        this.tokens = this.tokenize(expression);
        this.pos = 0;
        try {
            this.compiledFunc = this.parseExpression();
        } catch (e) {
            console.error("Parse error:", e);
            this.compiledFunc = (z) => z; 
        }
    }
    eval(z) {
        return this.compiledFunc(z);
    }
    tokenize(expr) {
        const regex = /[a-zA-Z_]\w*|[0-9]+(\.[0-9]+)?|[+\-*/^()]/g;
        return expr.match(regex) || [];
    }
    peek() {
        return this.tokens[this.pos];
    }
    consume() {
        return this.tokens[this.pos++];
    }

    // Grammar: Expression -> Term { +|- Term }
    parseExpression() {
        let left = this.parseTerm();
        while (this.peek() === '+' || this.peek() === '-') {
            let op = this.consume();
            let right = this.parseTerm();
            let prevLeft = left; // capture closure
            if (op === '+') left = (z) => complex_add(prevLeft(z), right(z));
            else left = (z) => complex_sub(prevLeft(z), right(z));
        }
        return left;
    }

    // Term -> Factor { *|/ Factor }
    parseTerm() {
        let left = this.parseFactor();
        while (this.peek() === '*' || this.peek() === '/') {
            let op = this.consume();
            let right = this.parseFactor();
            let prevLeft = left;
            if (op === '*') left = (z) => complex_mul(prevLeft(z), right(z));
            else left = (z) => complex_div(prevLeft(z), right(z));
        }
        return left;
    }

    // Factor -> Base { ^ Base }
    parseFactor() {
        let left = this.parseBase();
        if (this.peek() === '^') {
            this.consume();
            let right = this.parseFactor(); // Right associative for power? or left? doing recursive for chain
            let prevLeft = left;
            left = (z) => complex_pow(prevLeft(z), right(z));
        }
        return left;
    }

    parseBase() {
        let token = this.consume();
        
        // Handle Numbers
        if (!isNaN(parseFloat(token))) {
            let val = parseFloat(token);
            let c = { re: val, im: 0 };
            return () => c;
        }

        // Handle Variables
        if (token === 'z') return (z) => z;
        if (token === 'i') return () => ({ re: 0, im: 1 });

        // Handle Functions
        if (token === 'sin') return this.parseFunction(complex_sin);
        if (token === 'cos') return this.parseFunction(complex_cos);
        if (token === 'exp') return this.parseFunction(exp_complex);
        if (token === 'log') return this.parseFunction(complex_log);

        // Handle Parentheses
        if (token === '(') {
            let expr = this.parseExpression();
            if (this.consume() !== ')') throw new Error("Expected ')'");
            return expr;
        }
        throw new Error("Unexpected token: " + token);
    }
    parseFunction(funcImpl) {
        if (this.consume() !== '(') throw new Error("Expected '(' after function name");
        let arg = this.parseExpression();
        if (this.consume() !== ')') throw new Error("Expected ')' after function arguments");
        return (z) => funcImpl(arg(z));
    }
}

var currentParser = new ComplexParser("z");


const userInput = document.getElementById('userInput');// it is a textarea
var userExpression = "z";
userInput.addEventListener('keydown', function(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault(); 
        userExpression = userInput.value;
        console.log("Compiling:", userExpression);
        currentParser = new ComplexParser(userExpression);
        mouse_updated = true; 
    }
});


function unsolvable(z) {
    let z2 = complex_mul(z, z);
    let z4 = complex_mul(z2, z2);
    let z5 = complex_mul(z4, z);
    return complex_add(z5, complex_add(z4, { re: 1.0, im: 0.0 }));
}


var f = function(z) {
    // return 1/(z^2 + 300)
    let one = { re: 300.0, im: 0.0 };
    return complex_add(complex_mul(z, complex_mul(z, z)), one);
}

var exp_complex = function(z) {
    let exp_re = Math.exp(z.re);
    return {
        re: exp_re * Math.cos(z.im),
        im: exp_re * Math.sin(z.im)
    };
}


var complex_log = function(z) {
    let modulus = Math.sqrt(z.re * z.re + z.im * z.im);
    let angle = Math.atan2(z.im, z.re);
    return {
        re: Math.log(modulus),
        im: angle 
    };
}

let inv = function(z) {
    let denom = z.re * z.re + z.im * z.im;
    return {
        re: z.re / denom,
        im: -z.im / denom
    };
}


f = exp_complex;


const program = initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);
const renderer = new TriangleRenderer(gl, program);
const unit = 4.0; // unit size in pixels

function render_setup() {
    const width = canvas.width;
    const height = canvas.height;

    renderer.clearTriangles();
    var meshx = [];
    var meshy = [];
    for (let x = 0; x <= width; x += unit) {
        // transfrorm to clip space
        let clip_x = (x / width) * 2.0 - 1.0;
        meshx.push(clip_x);
    }
    for (let y = 0; y <= height; y += unit) {
        // transform to clip space
        let clip_y = 1.0 - (y / height) * 2.0;
        meshy.push(clip_y);
    }

    var calc_begin = performance.now();

    for (let i = 0; i < meshx.length - 1; i++) {
        for (let j = 0; j < meshy.length - 1; j++) {
            let x1 = meshx[i];
            let x2 = meshx[i + 1];
            let y1 = meshy[j];
            let y2 = meshy[j + 1];
            
            // triangle vertices
            let v1 = [x1, y1];
            let v2 = [x1, y2];
            let v3 = [x2, y1];
            let v4 = [x2, y2];

            function vertex2complex(v) {
                let re = ((v[0] + 0) * (width / 2) + total_dx) * scale;
                let im = ((v[1] + 0) * (height / 2) + total_dy) * scale;
                return { re, im };
            }
            
            if (i == 0 && j == 0) {
                console.log("width:", width, "height:", height);
                console.log("v1:", v1, "->", vertex2complex(v1));
            }
            if (i == meshx.length - 2 && j == meshy.length - 2) {
                console.log("v1:", v1, "->", vertex2complex(v1));
            }

            // now convert vertices to complex numbers
            var c1 = vertex2complex(v1);
            var c2 = vertex2complex(v2);
            var c3 = vertex2complex(v3);
            var c4 = vertex2complex(v4);

            // apply function f to each complex vertex
            // c1 = f(c1);
            // c2 = f(c2);
            // c3 = f(c3);
            // c4 = f(c4);

            c1 = currentParser.eval(c1);
            c2 = currentParser.eval(c2);
            c3 = currentParser.eval(c3);
            c4 = currentParser.eval(c4);

            // compute colors
            let col1 = complex2rgb(c1.re, c1.im);
            let col2 = complex2rgb(c2.re, c2.im);
            let col3 = complex2rgb(c3.re, c3.im);
            let col4 = complex2rgb(c4.re, c4.im);

            let color1 = [col1[0], col1[1], col1[2], 1.0];
            let color2 = [col2[0], col2[1], col2[2], 1.0];
            let color3 = [col3[0], col3[1], col3[2], 1.0];
            let color4 = [col4[0], col4[1], col4[2], 1.0];


            // add two triangles for the square
            renderer.addTriangle(v1, v2, v3, color1, color2, color3);
            renderer.addTriangle(v3, v2, v4, color3, color2, color4);
        }
    }
    var calc_end = performance.now();
    console.log("Calculation time (ms):", calc_end - calc_begin);
    renderer.updateBuffers();
}

render_setup()

function tick() {
    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // decide if we need to recalculate
    if (old_scase != scale || mouse_updated) {
        mouse_updated = false;
        old_scase = scale;
        render_setup();
    }

    renderer.render();
    
    window.requestAnimationFrame(tick);
}

scale = 0.1;
tick();


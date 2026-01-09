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

const program = initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE);

if (program) {
    const renderer = new TriangleRenderer(gl, program);

    var red = [1.0, 0.0, 0.0, 1.0];
    var green = [0.0, 1.0, 0.0, 1.0];
    var blue = [0.0, 0.0, 1.0, 1.0];

    // get canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    const unit = 5.0; // unit size in pixels

    var meshx = [];
    var meshy = [];

    // fill meshx and meshy
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
    // let's create only up-left triangles for simplicity
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
            renderer.addTriangle(v1, v2, v3, red, green, blue);
            renderer.addTriangle(v3, v2, v4, blue, green, red);
        }
    }

    renderer.updateBuffers();

    function tick() {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        renderer.render();
        
        window.requestAnimationFrame(tick);
    }

    tick();
}

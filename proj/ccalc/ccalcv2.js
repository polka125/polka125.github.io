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

    // UPDATED: Added version 300 es, changed attribute->in, varying->out
    var VSHADER_SOURCE = `#version 300 es
    in vec4 a_Position;
    in vec4 a_Color;

    out vec4 v_Color;
    out vec2 v_Position;

    void main() {
        gl_Position = a_Position;
        v_Color = a_Color;
        v_Position = a_Position.xy;
    }
    `;

    var FSHADER_SOURCE = `#version 300 es
    precision highp float;

    out vec4 fragColor;

    #define product(a, b) vec2(a.x*b.x-a.y*b.y, a.x*b.y+a.y*b.x)
    #define conjugate(a) vec2(a.x,-a.y)
    #define divide(a, b) vec2(((a.x*b.x+a.y*b.y)/(b.x*b.x+b.y*b.y)),((a.y*b.x-a.x*b.y)/(b.x*b.x+b.y*b.y)))

    uniform vec4 bounds; // xMin, xMax, yMin, yMax
    uniform float radius;
    uniform vec4 circleColor;

    #define depth 100

    #define pushC 1
    #define pushZ 2
    #define pop 3
    #define dup 4
    #define add 5
    #define sub 6
    #define mul 7
    #define divi 8
    #define done 100

    // stack with complex constants
    uniform vec2 constants[depth];

    // program to be executed 
    uniform int program[depth];

    // number of instructions in the program
    uniform int programLength;

    vec2 stack[depth];
    int sp = 0; 
    int pc = 0; 
    int cp = 0; // constant pointer

    vec2 calc(vec2 z) {
        sp = 0;
        pc = 0;
        cp = 0;

        while (pc < programLength) {
            int instr = program[pc];
            pc += 1;
            
            if (instr == pushC) {
                stack[sp] = constants[cp];
                sp += 1;
                cp += 1;
            } else if (instr == pushZ) {
                stack[sp] = z;
                sp += 1;
            } else if (instr == pop) {
                sp -= 1;
            } else if (instr == dup) {
                stack[sp] = stack[sp - 1];
                sp += 1;
            } else if (instr == add) {
                sp -= 1;
                stack[sp - 1] = stack[sp - 1] + stack[sp];
            } else if (instr == sub) {
                sp -= 1;
                stack[sp - 1] = stack[sp - 1] - stack[sp];
            } else if (instr == mul) {
                sp -= 1;
                stack[sp - 1] = product(stack[sp - 1], stack[sp]);
            } else if (instr == divi) {
                sp -= 1;
                stack[sp - 1] = divide(stack[sp - 1], stack[sp]);
            } else if (instr == done) {
                break;
            }
        }

        return stack[sp - 1];
    }

    in vec2 v_Position;
    in vec4 v_Color;

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    vec3 complex2rgb(float re, float im) {
        float absVal = length(vec2(re, im));
        if (absVal > 1e6) {
            return vec3(1.0, 1.0, 1.0);
        } 
        float angle = atan(im, re);
        float h = (angle + 3.14159265) / (2.0 * 3.14159265);
        float v = 1.0 - exp(-4.0 * absVal); 
        float s = 1.0;
        return hsv2rgb(vec3(h, s, v));
    }

    void main() {
        vec2 pos = vec2(
            (v_Position.x + 1.0) / 2.0 * (bounds.y - bounds.x) + bounds.x,
            (v_Position.y + 1.0) / 2.0 * (bounds.w - bounds.z) + bounds.z
        );

        // Execute the stack calculator
        pos = calc(pos);

        fragColor = vec4(complex2rgb(pos.x, pos.y), 1.0);
    }
    `;

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
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        1.0, 0.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
        0.0, 1.0, 0.0, 1.0,
    ]);

    let vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, triangleVertices, gl.STATIC_DRAW);

    let a_Position = gl.getAttribLocation(program, 'a_Position');
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Position);

    let colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, triangleColors, gl.STATIC_DRAW);

    let a_Color = gl.getAttribLocation(program, 'a_Color');
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(a_Color);

    var bounds = 10.0;
    var displacementX = 0.0;
    var displacementY = 0.0;

    const opcodes = {
        pushC: 1, 
        pushZ: 2,
        pop: 3,
        dup: 4,
        add: 5,
        sub: 6,
        mul: 7,
        divi: 8,
        done: 100
    }

    function animate(timestamp) {
        // create program for z^2 + 1
        let programArray = new Int32Array([
            opcodes.pushZ, 
            opcodes.dup,
            opcodes.mul,
            opcodes.pushC,
            opcodes.add,
            opcodes.done
        ]);
        
        // Pad the rest of the array with 0 or 'done' to match 'depth' size if necessary,
        // though uniform1iv handles shorter arrays by just filling the first N elements.
        // For safety in some drivers, we ensure we don't read garbage, but your loop checks programLength.
        
        let programLength = programArray.length;

        let constantsArray = new Float32Array([
            1.0, 0.0 // constant "1"
        ]);

        let u_Program = gl.getUniformLocation(program, 'program');
        gl.uniform1iv(u_Program, programArray);

        let u_ProgramLength = gl.getUniformLocation(program, 'programLength');
        gl.uniform1i(u_ProgramLength, programLength);

        let u_Constants = gl.getUniformLocation(program, 'constants');
        gl.uniform2fv(u_Constants, constantsArray);

        let u_Bounds = gl.getUniformLocation(program, 'bounds');
        gl.uniform4f(
            u_Bounds, 
            -bounds + displacementX, 
            bounds + displacementX, 
            -bounds + displacementY, 
            bounds + displacementY
        );

        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        var radius = 10.0;

        let u_CircleColor = gl.getUniformLocation(program, 'circleColor');
        gl.uniform4f(u_CircleColor, 0.0, 0.0, 1.0, 1.0); 
        let u_Radius = gl.getUniformLocation(program, 'radius');    
        gl.uniform1f(u_Radius, radius);
        
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

    window.addEventListener('resize', () => {
        gl.viewport(0, 0, canvas.width, canvas.height);
    });

    window.requestAnimationFrame(animate);
// Canvas and WebGL setup
var canvas;
var gl;

// Vertex and color data
var points = [];
var colors = [];
var vertices;

// Gasket Properties
var NumTimesToSubdivide = 3;

// Color-related variables
// add colors and vertices for one triangle
var baseColors = [
    vec4(0.796, 0.282, 0.471, 1.0),
    vec4(0.929, 0.471, 0.325, 1.0),
    vec4(0.987, 0.710, 0.188, 1.0),
    vec4(0.937, 0.981, 0.129, 1.0)
];

var initialBaseColors = [
    vec4(0.796, 0.282, 0.471, 1.0),
    vec4(0.929, 0.471, 0.325, 1.0),
    vec4(0.987, 0.710, 0.188, 1.0),
    vec4(0.937, 0.981, 0.129, 1.0)
];

// Color mode selection
var colorMode = 'custom'; 

// Animation settings
var AnimateSpeed = 1.0;
var start = false;

// Rotation variables
var deg = [0, 0, 0];  
var degLoc;           
var axis = 0;         
var xAxis = 0, yAxis = 1, zAxis = 2; 
var end1 = false, end2 = false; 

// Scaling variables
var size = 1.0;       
var sizeUniform;      
var sizeStatus = false;

// Translation variables
var transVec = [0.0, 0.0, 0.0];  
var transVecLoc;               
var xTranspeed = 0.01, yTranspeed = 0.01, zTranspeed = 0.01;
var transMode = 3;

//Global variable for Stop or Pause Functionality
var animationStage = 0;  // 0: rotation, 1: scaling, 2: translation
var pausedState = {
    deg: [0, 0, 0],
    size: 1.0,
    transVec: [0.0, 0.0, 0.0],
    end1: false,
    end2: false
};

window.onload = function init() {
    canvas = document.getElementById("gl-canvas");

    gl = WebGLUtils.setupWebGL(canvas);
    if (!gl) { alert("WebGL isn't available"); }
    // Initialize our data for the Sierpinski Gasket
    // First, initialize the vertices of our 3D gasket
    vertices = [
        // Four vertices on unit circle
        // Intial tetrahedron with equal length sides
        vec3(  0.0000,  0.0000, -0.2500 ),  // Apex
        vec3(  0.0000,  0.2236,  0.1118 ),  // Top-center
        vec3( -0.2165, -0.1118,  0.1118 ),  // Bottom-left
        vec3(  0.2165, -0.1118,  0.1118 )   // Bottom-right
    ];

    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], NumTimesToSubdivide);

    //  Configure WebGL
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(1.0, 1.0, 1.0, 1.0);

    // enable hidden-surface removal
    gl.enable(gl.DEPTH_TEST);

    //  Load shaders and initialize attribute buffers
    var program = initShaders(gl, "vertex-shader", "fragment-shader");
    gl.useProgram(program);

    // Setup event listeners
    setupEventListeners(program);

    // Create a buffer object, initialize it, and associate it with the
    //  associated attribute variable in our vertex shader
    SetupUI(program);

    render();
};

function SetupUI(program) {
    points = [];
    colors = [];

    // Subdivide the tetrahedron vertices into smaller triangles
    divideTetra(vertices[0], vertices[1], vertices[2], vertices[3], NumTimesToSubdivide);           

    // Create and bind the color buffer
    var cBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(colors), gl.STATIC_DRAW);

    // Specify the layout of the color attribute in the shader
    var vColor = gl.getAttribLocation(program, "vColor");
    gl.vertexAttribPointer(vColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vColor);

    // Create and bind the vertex position buffer
    var vBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, flatten(points), gl.STATIC_DRAW);

    // Specify the layout of the vertex position attribute in the shader
    var vPosition = gl.getAttribLocation(program, "vPosition");
    gl.vertexAttribPointer(vPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(vPosition);

    // Update uniform locations for transformations (rotation, scaling, translation)
    degLoc = gl.getUniformLocation(program, "deg");
    sizeUniform = gl.getUniformLocation(program, "size");
    transVecLoc = gl.getUniformLocation(program, "transVec");

    // Pass the current transformation values to the shader
    gl.uniform1f(sizeUniform, size);
    gl.uniform3fv(transVecLoc, transVec);
    gl.uniform3fv(degLoc, deg);
}

function setupEventListeners(program) {
    // Subdivision slider
    const subdivisionInput = document.getElementById("subdivisions");
    subdivisionInput.addEventListener('input', function() {
        NumTimesToSubdivide = parseInt(this.value);
        SetupUI(program);
    });

    // Animation Speed
    const speedSlider = document.getElementById("animationSpeed");
    speedSlider.addEventListener('input', function() {
        AnimateSpeed = parseFloat(this.value);
    });

    // Color Mode Selection
    const colorModeSelect = document.getElementById("colorSelect");
    colorModeSelect.addEventListener('change', function() {
        colorMode = this.value;
        updateColorMode(program);
    });

    // Color Pickers
    const colorPickers = document.querySelectorAll(".colorpicker");
    colorPickers.forEach((picker, index) => {
        picker.addEventListener("change", function() {
            baseColors[index] = hexTorgb(this.value);
            SetupUI(program); 
        });
    });

    // Scale Size
    const scaleSizeInput = document.getElementById("scaleSize");
    scaleSizeInput.addEventListener('input', function() {
        size = parseFloat(this.value);
        gl.uniform1f(sizeUniform, size);
    });

    // Translation Mode
    const translationModeSelect = document.getElementById("translationMode");
    translationModeSelect.addEventListener('change', function() {
        transMode = parseInt(this.value);
    });

    // Single Start/Stop Button with Pause and Resume Functionality
    // - Maintains current animation stage when paused
    // - Allows user to pause and continue animation across different stages
    const startBtn = document.getElementById("StartBtn");
    startBtn.addEventListener('click', function() {
    start = !start;  // Toggle state
    this.innerText = start ? "Stop" : "Start"; 
    this.classList.toggle("stop", start);

    if (start) {
        // Resume from the current stage
        switch(animationStage) {
            case 0: rotation(program); break;
            case 1: scaling(program); break;
            case 2: translation(program); break;
            }
        }   
    });


    // Reset Button
    const resetBtn = document.getElementById("ResetBtn");
    resetBtn.addEventListener('click', function() {
        // Reset subdivisions
        const subdivisionInput = document.getElementById("subdivisions");
        subdivisionInput.value = 3;
        NumTimesToSubdivide = 3;

        // Reset animation speed
        const speedSlider = document.getElementById("animationSpeed");
        speedSlider.value = 0.9;
        AnimateSpeed = 0.9;

        // Reset scale
        const scaleSizeInput = document.getElementById("scaleSize");
        scaleSizeInput.value = 1.0;  // Match initial scale value
        size = 1.0;
        gl.uniform1f(sizeUniform, size);

        // Reset colors to initial base colors
        baseColors = [...initialBaseColors];
        const colorPickers = document.querySelectorAll(".colorpicker");
        colorPickers.forEach((picker, index) => {
            picker.value = rgbToHex(initialBaseColors[index]);
        });

        // Reset color mode to custom
        const colorModeSelect = document.getElementById("colorSelect");
        colorModeSelect.value = 'custom';
        colorMode = 'custom';

        // Reset translation mode to default
        const translationModeSelect = document.getElementById("translationMode");
        translationModeSelect.value = 3;
        transMode = 3;

        // Stop animation if running
        if (start) {
            startBtn.click();
        }

        // Perform complete reset
        resetAnimation(program);
    });
}

// Converts a hexadecimal color code to an RGBA vector
function hexTorgb(hex) {
    let bigInt = parseInt(hex.substring(1), 16);
    let R = ((bigInt >> 16) & 255) / 255;
    let G = ((bigInt >> 8) & 255) / 255;
    let B = (bigInt & 255) / 255;
    return vec4(R, G, B, 1.0);
}

// Converts an RGBA vector (vec4) to a hexadecimal color code
function rgbToHex(vec4Color) {
    const r = Math.round(vec4Color[0] * 255);
    const g = Math.round(vec4Color[1] * 255);
    const b = Math.round(vec4Color[2] * 255);
    return '#' + [r, g, b].map(x => {
        const hex = x.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

// Generates a set of monochrome colors (shades of gray)
function generateMonochromeColors() {
    // Generate shades of a single color
    const baseColor = vec4(0.5, 0.5, 0.5, 1.0); // Medium gray
    return [
        vec4(baseColor[0] * 0.6, baseColor[1] * 0.6, baseColor[2] * 0.6, 1.0),
        vec4(baseColor[0] * 0.8, baseColor[1] * 0.8, baseColor[2] * 0.8, 1.0),
        vec4(baseColor[0], baseColor[1], baseColor[2], 1.0),
        vec4(baseColor[0] * 1.2, baseColor[1] * 1.2, baseColor[2] * 1.2, 1.0)
    ];
}

function generatePastelColors() {
    // Predefined pastel colors
    return [
        vec4(0.96, 0.80, 0.84, 1.0), // Pastel Pink
        vec4(0.87, 0.94, 0.75, 1.0), // Pastel Green
        vec4(0.76, 0.86, 0.96, 1.0), // Pastel Blue
        vec4(0.96, 0.93, 0.75, 1.0)  // Pastel Yellow
    ];
}

function updateColorMode(program) {
    // Update base colors based on selected color mode
    switch(colorMode) {
        case 'monochrome':
            baseColors = generateMonochromeColors();
            break;
        case 'pastel':
            baseColors = generatePastelColors();
            break;
        case 'custom':
        default:
            // Reset to initial colors via color pickers
            baseColors = [...initialBaseColors];
            break;
    }

    // Update color pickers to reflect new colors
    const colorPickers = document.querySelectorAll(".colorpicker");
    colorPickers.forEach((picker, index) => {
        picker.value = rgbToHex(baseColors[index]);
    });

    // Redraw the object with new colors
    SetupUI(program); 
}

function triangle(a, b, c, color) {
    colors.push(baseColors[color]);
    points.push(a);
    colors.push(baseColors[color]);
    points.push(b);
    colors.push(baseColors[color]);
    points.push(c);
}

function tetra(a, b, c, d) {
    // tetrahedron with each side using
    // a different color
    triangle(a, c, b, 0);
    triangle(a, c, d, 1);
    triangle(a, b, d, 2);
    triangle(b, c, d, 3);
}

function divideTetra(a, b, c, d, count) {
    // check for end of recursion
    if (count === 0) {
        tetra(a, b, c, d);
    } 
    
    // find midpoints of sides
    // divide four smaller tetrahedra
    else {
        var ab = mix(a, b, 0.5);
        var ac = mix(a, c, 0.5);
        var ad = mix(a, d, 0.5);
        var bc = mix(b, c, 0.5);
        var bd = mix(b, d, 0.5);
        var cd = mix(c, d, 0.5);

        --count;

        divideTetra(a, ab, ac, ad, count);
        divideTetra(ab, b, bc, bd, count);
        divideTetra(ac, bc, c, cd, count);
        divideTetra(ad, bd, cd, d, count);
    }
}

// Render Function: continuously drawing the 3D Sierpinski Gasket on the WebGL canvas
function render() {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, points.length);

    requestAnimationFrame(render);
}

// Rotation Function (Requirement 1): Rotation of gasket about 180° to right and 180° to left
function rotation(program) {
    if (start) {
        if ((deg[zAxis] >= 0 && deg[zAxis] <= 180) && !end1) {
            // Increase the z-axis rotation angle if it's between 0° and 180° degrees
            deg[zAxis] += 2.0 * AnimateSpeed;
            gl.uniform3fv(degLoc, flatten(deg));
        }
        
        if (deg[zAxis] > 180 || end1) {
            // Decrease the z-axis rotation angle after it exceeds 180° degrees
            deg[zAxis] -= 2.0 * AnimateSpeed;
            gl.uniform3fv(degLoc, flatten(deg));
            end1 = true;
        }
    
        if (deg[zAxis] < -180 || end2) {
            // Reverse rotation direction if the angle goes below -180°
            deg[zAxis] += 2.0 * AnimateSpeed;
            gl.uniform3fv(degLoc, flatten(deg));
            end1 = false;
            end2 = true;
    
            if (deg[zAxis] >= 0) {  
                // Reset rotation-specific flags
                end1 = false;
                end2 = false;
                
                // Explicitly move to scaling
                start = true;  
                animationStage = 1;
                scaling(program);
                return;
            }
        }
        
        // Continue rotation animation
        requestAnimationFrame(() => rotation(program));
    }
}

// Scaling Function (Requirement 2): Gasket Enlargement
function scaling(program) {
    if (start) {
        const originalSize = parseFloat(document.getElementById("scaleSize").value);
        
        // Increase size until it reaches a limit (3.0)
        if (size <= 3.0 && !sizeStatus) {   
            size += 0.1 * AnimateSpeed;
            gl.uniform1f(sizeUniform, size); 
        } 
        
        if (size > 3.0 || sizeStatus) {
            // Decrease size if it exceeds the maximum size
            size -= 0.1 * AnimateSpeed;
            gl.uniform1f(sizeUniform, size);
            sizeStatus = true;

            if (Math.abs(size - originalSize) < 0.1) {
                size = originalSize;
                sizeStatus = false;
                
                // Explicitly move to translation
                start = true; 
                animationStage = 2;
                translation(program);
                return;
            }
        }
    
        requestAnimationFrame(() => scaling(program));
    }
}

// Translation Function (Requirement 3): Continuously move the gasket within canvas in a loop unless stopped
function translation(program) {
    if (start) {
        // Restore previous state when resuming
        if (animationStage !== 2) {
            transVec = pausedState.transVec;
            deg = [0, 0, 0];  
            animationStage = 2;
        }

        // Rotation based on translation mode
        switch(transMode) {
            // X-axis rotation
            case 0:
                deg[0] -= 3.0 * AnimateSpeed;  
                break;
            
            // Y-axis rotation
            case 1:
                deg[1] -= 3.0 * AnimateSpeed;  
                break;

            // Z-axis rotation
            case 2:
                deg[2] -= 3.0 * AnimateSpeed; 
                break;

            // Default (No Rotation)
            case 3:
                deg = [0, 0, 0];                 
                break;  
        }
        gl.uniform3fv(degLoc, flatten(deg));

        // Update translation vector
        transVec[0] += xTranspeed * AnimateSpeed;
        transVec[1] += yTranspeed * AnimateSpeed;
        gl.uniform3fv(transVecLoc, transVec);

        // Track x-axis boundary
        let xBoundaryHit = vertices.some(v => Math.abs(v[0] + transVec[0] / size) > 0.96 / size);
        if (xBoundaryHit) {
            xTranspeed = xTranspeed * -1;
        }

        // Track y-axis boundary
        let yBoundaryHit = vertices.some(v => Math.abs(v[1] + transVec[1] / size) > 0.96 / size);
        if (yBoundaryHit) {
            yTranspeed = yTranspeed * -1;
        }

        // Recursively call translation to continue moving the object (looping)
        requestAnimationFrame(() => translation(program));
    } else {
        // When paused, save the current state
        pausedState.transVec = transVec;
    }
}

// Resetting all parameters to default values/initial state
function resetAnimation(program) {
    deg = [0, 0, 0];
    end1 = false;
    end2 = false;
    
    // Reset scale to initial value
    size = 1.0;  
    gl.uniform1f(sizeUniform, size);
    sizeStatus = false;
    
    // Reset translation
    transVec = [0.0, 0.0, 0.0];
    xTranspeed = 0.01;
    yTranspeed = 0.01;
    
    // Stop the animation completely
    start = false;
    
    // Reset animation stage to start from rotation
    animationStage = 0;
    
    // Update uniform locations with reset values
    gl.uniform3fv(degLoc, deg);
    gl.uniform3fv(transVecLoc, transVec);
    
    // Redisplay the object with initial properties
    SetupUI(program);
}
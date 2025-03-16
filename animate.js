import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import GUI from 'lil-gui';

let craziness_level = 0.5;

// Add this function to set up the GUI
function setupGUI() {
    const gui = new GUI();
    
    const params = {
        craziness: craziness_level
    };
    
    gui.add(params, 'craziness', 0, 1, 0.01)
        .name('Craziness Level')
        .onChange(function(value) {
            craziness_level = value;
            console.log('Craziness level updated:', craziness_level);
        });
        
    // Position the GUI in the top-right corner
    gui.domElement.style.position = 'absolute';
    gui.domElement.style.top = '10px';
    gui.domElement.style.right = '10px';
}

// Setup basic scene
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x333333); // Dark gray background

// Camera setup
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 5);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Basic lighting for better visibility
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 5, 5);
scene.add(directionalLight);

// Simple orbit controls for viewing
const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// Add helpers to visualize 3D space
const axesHelper = new THREE.AxesHelper(5);
scene.add(axesHelper);

const gridHelper = new THREE.GridHelper(10, 10);
scene.add(gridHelper);

// Store all cubies and the target cubie
let targetCubie = null;
const allCubies = [];

// JUST LOAD THE MODEL - nothing else
console.log("Loading model...");
const loader = new GLTFLoader();

// Add this after the model is loaded and the hierarchy is printed
let wrbGroup = null;

// Global variables
let nameToCubie = {};
let cubiePositions = [];
let cubieGrid = new Array(27).fill(null);
let cubeCenterPoint = null;
let cubeSize = 0; // Will store the size of a single cubie

// Function to initialize cubies organization with correct bounding box
function initCubieOrganization() {
    console.log("Initializing cubie organization...");
    
    // Step 1: Get all cubies
    cubiePositions = [];
    const allCubies = [];
    
    for (const sortedName in nameToCubie) {
        const cubie = nameToCubie[sortedName];
        cubiePositions.push({
            name: sortedName,
            cubie: cubie
        });
        allCubies.push(cubie);
    }
    
    console.log(`Found ${allCubies.length} cubies`);
    
    // Step 2: Calculate the center using ONLY the cubies
    if (allCubies.length === 0) {
        console.error("No cubies found!");
        return;
    }
    
    // Create a new bounding box
    const totalBoundingBox = new THREE.Box3();
    
    // Only expand by the cubies
    allCubies.forEach(cubie => {
        // Create a box for this cubie
        const cubieBox = new THREE.Box3().setFromObject(cubie);
        // Expand the total box
        totalBoundingBox.union(cubieBox);
    });
    
    // Get center and size
    cubeCenterPoint = new THREE.Vector3();
    totalBoundingBox.getCenter(cubeCenterPoint);
    
    const totalSize = new THREE.Vector3();
    totalBoundingBox.getSize(totalSize);
    cubeSize = Math.min(totalSize.x, totalSize.y, totalSize.z) / 3; // Divide by 3 to get single cubie size
    
    console.log("Cube center:", cubeCenterPoint.toArray());
    console.log("Cube total size:", totalSize.toArray());
    console.log("Estimated cubie size:", cubeSize);
    
    // Add a visual marker for the cube center
    const centerMarker = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xff00ff })
    );
    centerMarker.position.copy(cubeCenterPoint);
    centerMarker.name = "CubeCenterMarker";
    
    // Remove existing marker if present
    const existingMarker = scene.getObjectByName("CubeCenterMarker");
    if (existingMarker) {
        scene.remove(existingMarker);
    }
    
    scene.add(centerMarker);
    
    // Add outline box to show the total bounding box
    const boxHelper = new THREE.Box3Helper(totalBoundingBox, 0xffff00);
    boxHelper.name = "CubeBoundingBox";
    
    const existingBox = scene.getObjectByName("CubeBoundingBox");
    if (existingBox) {
        scene.remove(existingBox);
    }
    
    scene.add(boxHelper);
    
    // Step 3: Now calculate grid positions for each cubie based on distance from center
    cubiePositions.forEach(item => {
        const cubie = item.cubie;
        
        // Calculate center of this cubie
        const boundingBox = new THREE.Box3().setFromObject(cubie);
        const center = new THREE.Vector3();
        boundingBox.getCenter(center);
        
        // Store center
        item.center = center;
        
        // Calculate normalized direction vector from cube center to cubie
        const directionFromCenter = center.clone().sub(cubeCenterPoint);
        
        // Calculate grid indices (0, 1, 2) for each axis
        // For each axis, we want -1->0, 0->1, 1->2
        const xRaw = directionFromCenter.x / (cubeSize * 0.8);
        const yRaw = directionFromCenter.y / (cubeSize * 0.8);
        const zRaw = directionFromCenter.z / (cubeSize * 0.8);
        
        // Round to nearest integer and add 1 to get 0,1,2 range
        const xIndex = Math.round(xRaw) + 1;
        const yIndex = Math.round(yRaw) + 1;
        const zIndex = Math.round(zRaw) + 1;
        
        // Clamp to ensure indices are in valid range
        const validX = Math.max(0, Math.min(2, xIndex));
        const validY = Math.max(0, Math.min(2, yIndex));
        const validZ = Math.max(0, Math.min(2, zIndex));
        
        // Store indices
        item.indices = [validX, validY, validZ];
        
        console.log(`Cubie ${item.name}: Raw: [${xRaw.toFixed(2)},${yRaw.toFixed(2)},${zRaw.toFixed(2)}] -> Grid: [${validX},${validY},${validZ}]`);
    });
    
    // Step 4: Create the grid
    cubieGrid = new Array(27).fill(null);
    
    cubiePositions.forEach(item => {
        const [x, y, z] = item.indices;
        const index = x + y * 3 + z * 9;
        
        // Store in grid
        if (index >= 0 && index < 27) {
            if (cubieGrid[index]) {
                console.warn(`Grid collision at [${x},${y},${z}] (index ${index})!`);
                console.warn(`  Existing: ${cubieGrid[index].name}, New: ${item.name}`);
            }
            cubieGrid[index] = item;
        } else {
            console.error(`Invalid grid index ${index} for cubie ${item.name}`);
        }
    });
    
    // Step 5: Visualize the grid positions to verify they're correct
    cubieGrid.forEach((item, index) => {
        if (!item) {
            console.warn(`Empty cell at index ${index}`);
            return;
        }
        
        // Create a small sphere at each grid position
        const [x, y, z] = item.indices;
        
        // Calculate the expected position based on grid coordinates
        const expectedPosition = new THREE.Vector3(
            (x - 1) * cubeSize,
            (y - 1) * cubeSize,
            (z - 1) * cubeSize
        ).add(cubeCenterPoint);
        
        // Create indicator
        const indicator = new THREE.Mesh(
            new THREE.SphereGeometry(0.03, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0x00ff00 })
        );
        indicator.position.copy(expectedPosition);
        indicator.name = `GridMarker_${index}`;
        
        // Remove existing marker if present
        const existingMarker = scene.getObjectByName(`GridMarker_${index}`);
        if (existingMarker) {
            scene.remove(existingMarker);
        }
        
        scene.add(indicator);
        
        // Draw a line from the expected position to the actual cubie center
        const line = new THREE.Line(
            new THREE.BufferGeometry().setFromPoints([
                expectedPosition,
                item.center
            ]),
            new THREE.LineBasicMaterial({ color: 0xffff00 })
        );
        line.name = `GridLine_${index}`;
        
        // Remove existing line if present
        const existingLine = scene.getObjectByName(`GridLine_${index}`);
        if (existingLine) {
            scene.remove(existingLine);
        }
        
        scene.add(line);
    });
    
    // Count how many grid cells are filled
    let filledCount = 0;
    cubieGrid.forEach((item) => {
        if (item) filledCount++;
    });
    
    console.log(`Grid filled with ${filledCount} cubies out of 27`);
}


// Rewritten rotateSlice function - each cubie rotates individually around cube center
function rotateSlice(axis, sliceIndex, clockwise = true) {
    console.log(`Rotating ${axis}-slice at index ${sliceIndex} ${clockwise ? 'clockwise' : 'counterclockwise'}`);
    
    // Ensure the grid is initialized
    if (!cubieGrid[0] || !cubeCenterPoint) {
        // initCubieOrganization();
        return; // Return early if this was the initialization
    }
    
    // Validate slice index
    if (sliceIndex < 0 || sliceIndex > 2) {
        console.error(`Invalid slice index: ${sliceIndex}. Must be 0, 1, or 2.`);
        return;
    }
    
    // Step 1: Get axis vector and collect cubies in the slice
    let axisVector;
    if (axis === 'x') axisVector = new THREE.Vector3(1, 0, 0);
    else if (axis === 'y') axisVector = new THREE.Vector3(0, 1, 0);
    else if (axis === 'z') axisVector = new THREE.Vector3(0, 0, 1);
    else {
        console.error(`Invalid axis: ${axis}. Must be 'x', 'y', or 'z'.`);
        return;
    }
    
    // Find cubies in the slice
    const cubiesInSlice = [];
    const sliceIndicators = [];
    
    for (let i = 0; i < 27; i++) {
        const gridItem = cubieGrid[i];
        if (!gridItem) continue;
        
        const [x, y, z] = gridItem.indices;
        
        if ((axis === 'x' && x === sliceIndex) || 
            (axis === 'y' && y === sliceIndex) || 
            (axis === 'z' && z === sliceIndex)) {
            cubiesInSlice.push(gridItem);
            
            // Add indicator for this cubie
            const indicator = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x00ffff })
            );
            indicator.position.copy(gridItem.center);
            scene.add(indicator);
            sliceIndicators.push(indicator);
        }
    }
    
    console.log(`Found ${cubiesInSlice.length} cubies in the slice`);
    
    // Validation: If we didn't find any cubies, something is wrong
    if (cubiesInSlice.length === 0) {
        console.error(`No cubies found in ${axis}-slice at index ${sliceIndex}`);
        return;
    }
    
    // Remove indicators after 2 seconds
    setTimeout(() => {
        sliceIndicators.forEach(indicator => {
            scene.remove(indicator);
        });
    }, 2000);
    
    // Step 2: Define the rotation quaternion
    const angle = (clockwise ? 1 : -1) * Math.PI/2;
    const rotationQuaternion = new THREE.Quaternion();
    rotationQuaternion.setFromAxisAngle(axisVector, angle);
    
    // Step 3: Create rotation matrix from quaternion
    const rotationMatrix = new THREE.Matrix4();
    rotationMatrix.makeRotationFromQuaternion(rotationQuaternion);
    
    // Step 4: Rotate each cubie individually around the cube center
    cubiesInSlice.forEach(item => {
        const cubie = item.cubie;
        
        // Get current world position of the cubie
        const worldPosition = new THREE.Vector3();
        cubie.updateWorldMatrix(true, false);
        worldPosition.setFromMatrixPosition(cubie.matrixWorld);
        
        // Calculate position relative to cube center
        const relativePosition = worldPosition.clone().sub(cubeCenterPoint);
        
        // Apply rotation to this relative position
        relativePosition.applyMatrix4(rotationMatrix);
        
        // Calculate new world position
        const newWorldPosition = relativePosition.add(cubeCenterPoint);
        
        // Convert world position to local position relative to parent
        const parent = cubie.parent;
        if (!parent) {
            console.error("Cubie has no parent!");
            return;
        }
        
        parent.updateWorldMatrix(true, false);
        const parentInverseMatrix = new THREE.Matrix4().copy(parent.matrixWorld).invert();
        const newLocalPosition = newWorldPosition.clone().applyMatrix4(parentInverseMatrix);
        
        // Update cubie position
        cubie.position.copy(newLocalPosition);
        
        // Also rotate the cubie itself
        cubie.quaternion.premultiply(rotationQuaternion);
    });
    
    
    console.log("Slice rotation complete");
}


// Function to clean up all visual debugging elements
function cleanupDebugVisuals() {
    // Remove all grid markers
    for (let i = 0; i < 27; i++) {
        const marker = scene.getObjectByName(`GridMarker_${i}`);
        if (marker) scene.remove(marker);
        
        const line = scene.getObjectByName(`GridLine_${i}`);
        if (line) scene.remove(line);
    }
}

// Add a toggle for debug visuals
let debugVisualsVisible = true;
function toggleDebugVisuals() {
    debugVisualsVisible = !debugVisualsVisible;
    
    // Show/hide all debug elements
    for (let i = 0; i < 27; i++) {
        const marker = scene.getObjectByName(`GridMarker_${i}`);
        if (marker) marker.visible = debugVisualsVisible;
        
        const line = scene.getObjectByName(`GridLine_${i}`);
        if (line) line.visible = debugVisualsVisible;
    }
    
    const centerMarker = scene.getObjectByName("CubeCenterMarker");
    if (centerMarker) centerMarker.visible = debugVisualsVisible;
    
    const boundingBox = scene.getObjectByName("CubeBoundingBox");
    if (boundingBox) boundingBox.visible = debugVisualsVisible;
    
    console.log(`Debug visuals ${debugVisualsVisible ? 'shown' : 'hidden'}`);
}





loader.load(
  'cube-model.glb', // Make sure this matches your actual file name
  (gltf) => {
    console.log('Model loaded successfully!');
    
    // Get the model
    const model = gltf.scene;
    
    // Log all objects in the model
    console.log("Model hierarchy:");

    console.log("Full hierarchy of all objects in the model:");
    model.traverse((object) => {
      // Print object name, type, and parent-child relationships
      const parentName = object.parent ? object.parent.name : "none";
      console.log(`Object: ${object.name || "unnamed"} (${object.type}), Parent: ${parentName}`);
      
      // For meshes, show additional details
      if (object.isMesh) {
        console.log(`  - Position: (${object.position.x.toFixed(2)}, ${object.position.y.toFixed(2)}, ${object.position.z.toFixed(2)})`);
        console.log(`  - Geometry: ${object.geometry.type}, Vertices: ${object.geometry.attributes.position.count}`);
        console.log(`  - Material: ${object.material.type}`);
      }
    });


    model.traverse((object) => {
      console.log(`- Object: ${object.name}, Type: ${object.type}`);
      if (object.isMesh) {
        console.log(`  Mesh geometry vertices: ${object.geometry.attributes.position.count}`);
        console.log(`  Mesh position: (${object.position.x}, ${object.position.y}, ${object.position.z})`);
        
        // Store all meshes (cubies)
        allCubies.push(object);
        
        // If this is the first mesh, make it our target
        if (!targetCubie) {
          targetCubie = object;
        }
      }
    });
    
    // Get model size
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    console.log("Model size:", size);
    console.log("Model center:", center);
    
    // Center the model
    model.position.x = -center.x;
    model.position.y = -center.y;
    model.position.z = -center.z;
    
    // Add to scene
    scene.add(model);




    // Find all cubies with specific names
    model.traverse((object) => {
        if (object.name && object.name.split('').every(letter => ['W', 'R', 'B', 'G', 'Y', 'O', 'M', ''].includes(letter))) {
            
            const sortedName = object.name.split('').sort().join('');
            if (!nameToCubie[sortedName]) {
                nameToCubie[sortedName] = object;
            }

            wrbGroup = object;
            console.log("Found WRB group:", object);
            
        }
    });    
    
    // Highlight the target cubie if found
    if (targetCubie) {
      console.log("Found target cubie:", targetCubie.name);
      console.log("Position:", targetCubie.position);
      
      // Create a visible outline for the target cubie
      const outlineGeometry = targetCubie.geometry.clone();
      const outlineMaterial = new THREE.MeshBasicMaterial({
        color: 0xff0000,
        wireframe: true,
        wireframeLinewidth: 2
      });
      const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
      outlineMesh.position.copy(targetCubie.position);
      outlineMesh.quaternion.copy(targetCubie.quaternion);
      outlineMesh.scale.copy(targetCubie.scale);
      outlineMesh.scale.multiplyScalar(1.05); // Slightly larger
      targetCubie.add(outlineMesh);
      
      console.log("Added wireframe highlight to target cubie");
    } else {
      console.warn("No cubies found in the model!");
    }
    
    // Set camera to view the whole model
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    let cameraDistance = maxDim / (2 * Math.tan(fov / 2));
    
    // Ensure we're not too close or too far
    cameraDistance = Math.max(2, Math.min(cameraDistance * 1.5, 50));
    camera.position.z = cameraDistance;
    
    // Update camera
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    controls.update();
    
    console.log("Model added to scene - camera at distance:", cameraDistance);
    console.log(`Found ${allCubies.length} cubies in the model`);


    // First initialization attempt
    // initCubieOrganization();

    // Set up a delayed second initialization after the scene has had time to update
    setTimeout(() => {
        console.log("Performing delayed initialization...");
        initCubieOrganization();
        setupGUI();
        
        // Verify the grid is correctly populated
        let filledCount = 0;
        cubieGrid.forEach((item) => {
            if (item) filledCount++;
        });
        console.log(`After delayed init: Grid filled with ${filledCount} cubies out of 27`);
        }, 5); // 500ms delay should be sufficient
      

  },
  (progress) => {
    const percent = (progress.loaded / progress.total * 100).toFixed(2);
    console.log(`Loading progress: ${percent}%`);
  },
  (error) => {
    console.error('Error loading model:', error);
    console.log("Please check that your file exists and is named correctly");
  }
);




// Get the center of a group (min/max X, Y, Z and finding the middle)
function getGroupCenter(group) {
    // Create a bounding box for the group
    const boundingBox = new THREE.Box3().setFromObject(group);
    
    // Get the center of the bounding box
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);
    
    return center;
}

function moveGroup(name) {
    // 1. sort the name 
    const sortedName = name.split('').sort().join('');
    // 2. get the cubie
    const cubie = nameToCubie[sortedName];
    if (!cubie) {
        console.warn("Cubie not found for name:", name);
        return;
    }
    // 3. move the cubie
    console.log("Moving cubie:", name);
    console.log("Original position:", cubie.position.toArray());
    cubie.position.y += 0.5;
    console.log("New position:", cubie.position.toArray());
}

function showBoundingBox(object, color = 0xff0000, duration = 3000) {
    // Create a bounding box for the object
    const boundingBox = new THREE.Box3().setFromObject(object);
    
    // Create a box helper to visualize the bounding box
    const boxHelper = new THREE.Box3Helper(boundingBox, color);
    scene.add(boxHelper);
    
    // Log the dimensions
    const size = new THREE.Vector3();
    boundingBox.getSize(size);
    const center = new THREE.Vector3();
    boundingBox.getCenter(center);

    // display center as a sphere
    const sphereGeometry = new THREE.SphereGeometry(0.1);
    const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphere.position.copy(center);
    scene.add(sphere);
    
    console.log(`Bounding box for ${object.name || 'unnamed object'}:`);
    console.log(`- Size: ${size.toArray()}`);
    console.log(`- Center: ${center.toArray()}`);
    console.log(`- Min: ${boundingBox.min.toArray()}`);
    console.log(`- Max: ${boundingBox.max.toArray()}`);
    

    
    return { 
        helper: boxHelper, 
        box: boundingBox,
        size: size,
        center: center
    };
}


// Add some visual verification
function highlightSlice(axis, sliceIndex) {
    // Remove any existing highlights
    const existingHighlights = scene.children.filter(child => 
        child.name && child.name.startsWith("SliceHighlight"));
    existingHighlights.forEach(highlight => scene.remove(highlight));
    
    // Create new highlights
    for (let i = 0; i < 27; i++) {
        const item = cubieGrid[i];
        if (!item) continue;
        
        const [x, y, z] = item.indices;
        
        if ((axis === 'x' && x === sliceIndex) || 
            (axis === 'y' && y === sliceIndex) || 
            (axis === 'z' && z === sliceIndex)) {
            
            const highlight = new THREE.Mesh(
                new THREE.SphereGeometry(0.03, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x00ffff })
            );
            highlight.position.copy(item.center);
            highlight.name = `SliceHighlight_${i}`;
            scene.add(highlight);
        }
    }
}


function testRotate(name) {
    // 1. sort the name
    const sortedName = name.split('').sort().join('');
    
    // 2. get the cubie
    const cubie = nameToCubie[sortedName];
    if (!cubie) {
        console.warn("Cubie not found for name:", name);
        return;
    }
    
    // 3. show bounding box and get center
    const { center } = showBoundingBox(cubie, 0xff0000);
    console.log(`Cubie ${name} center:`, center.toArray());
    
    // 4. choose a random axis (0=X, 1=Y, 2=Z)
    const axisIndex = Math.floor(Math.random() * 3);
    const axisName = ['X', 'Y', 'Z'][axisIndex];
    console.log(`Rotating cubie ${name} around ${axisName} axis`);
    
    // Store the original world matrix before any changes
    cubie.updateWorldMatrix(true, false);
    const originalMatrix = cubie.matrixWorld.clone();
    
    // 5. Create a matrix for the rotation around the center
    const rotationMatrix = new THREE.Matrix4();
    const rotationAngle = Math.PI/2; // 90 degrees
    
    if (axisIndex === 0) {
        rotationMatrix.makeRotationX(rotationAngle);
    } else if (axisIndex === 1) {
        rotationMatrix.makeRotationY(rotationAngle);
    } else {
        rotationMatrix.makeRotationZ(rotationAngle);
    }
    
    // 6. Create translation matrices to and from the center
    const toCenterMatrix = new THREE.Matrix4().makeTranslation(
        -center.x, -center.y, -center.z
    );
    
    const fromCenterMatrix = new THREE.Matrix4().makeTranslation(
        center.x, center.y, center.z
    );
    
    // 7. Combine the matrices: translate to center, rotate, translate back
    const transformMatrix = new THREE.Matrix4()
        .multiply(fromCenterMatrix)
        .multiply(rotationMatrix)
        .multiply(toCenterMatrix);
    
    // 8. Get parent's world matrix inverse for converting world matrix back to local
    const parentWorldMatrixInverse = new THREE.Matrix4();
    if (cubie.parent) {
        cubie.parent.updateWorldMatrix(true, false);
        parentWorldMatrixInverse.copy(cubie.parent.matrixWorld).invert();
    }
    
    // 9. Apply the rotation in world space
    const newWorldMatrix = new THREE.Matrix4()
        .copy(originalMatrix)
        .premultiply(transformMatrix);
    
    // 10. Convert back to local space
    const newLocalMatrix = new THREE.Matrix4()
        .copy(newWorldMatrix)
        .premultiply(parentWorldMatrixInverse);
    
    // 11. Apply the new transformation
    cubie.matrix.copy(newLocalMatrix);
    cubie.matrix.decompose(cubie.position, cubie.quaternion, cubie.scale);
    
    // Set matrix auto-update back on
    cubie.matrixAutoUpdate = true;
    
    // 12. Show the new bounding box
    showBoundingBox(cubie, 0x00ff00);
    
    console.log("Rotation complete");
}



// Function to move the target cubie
function moveTargetCubie() {
  if (!targetCubie) {
    console.warn("No target cubie to move!");
    return;
  }
  
  console.log("Moving target cubie");
  console.log("Current position:", targetCubie.position);
  
  // Get the current matrix state
  const originalMatrix = targetCubie.matrix.clone();
  
  // Simple direct position change - move up by 1 unit
  targetCubie.position.y += 1;
  targetCubie.updateMatrix();
  
  console.log("New position:", targetCubie.position);
  
  // Create a visual indicator of the movement (a line)
  const lineGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(
      originalMatrix.elements[12], 
      originalMatrix.elements[13], 
      originalMatrix.elements[14]
    ),
    new THREE.Vector3(
      targetCubie.matrix.elements[12], 
      targetCubie.matrix.elements[13], 
      targetCubie.matrix.elements[14]
    )
  ]);
  
  const lineMaterial = new THREE.LineBasicMaterial({ color: 0xffff00 });
  const line = new THREE.Line(lineGeometry, lineMaterial);
  scene.add(line);
  
  console.log("Added movement indicator line");
  

}


// Function to select a different cubie
let currentCubieIndex = 0;
function selectNextCubie() {
  if (allCubies.length === 0) {
    console.warn("No cubies to select!");
    return;
  }
  
  // Reset current cubie outline
  if (targetCubie) {
    // Find and remove any wireframe children
    targetCubie.children.forEach(child => {
      if (child.material && child.material.wireframe) {
        targetCubie.remove(child);
      }
    });
  }
  
  // Select next cubie in the array
  currentCubieIndex = (currentCubieIndex + 1) % allCubies.length;
  targetCubie = allCubies[currentCubieIndex];
  
  // Highlight the new target
  console.log("Selected new cubie:", targetCubie.name);
  console.log("Position:", targetCubie.position);
  
  // Create a visible outline for the target cubie
  const outlineGeometry = targetCubie.geometry.clone();
  const outlineMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    wireframe: true,
    wireframeLinewidth: 2
  });
  const outlineMesh = new THREE.Mesh(outlineGeometry, outlineMaterial);
  outlineMesh.scale.multiplyScalar(1.05); // Slightly larger
  targetCubie.add(outlineMesh);
}




// Function to move the WRB group
function moveWRBGroup() {
  if (!wrbGroup) {
    console.warn("WRB group not found!");
    return;
  }
  
  console.log("Moving WRB group");
  console.log("Original position:", wrbGroup.position.toArray());
  
  // Move it upward by 0.5 units
  wrbGroup.position.y += 0.5;
  
  console.log("New position:", wrbGroup.position.toArray());
}




console.log("Press 'w' to move the WRB group");

// Create a basic yellow cube if no model loads
function createDebugCube() {
  console.log("Creating debug cube");
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xffff00 });
  const cube = new THREE.Mesh(geometry, material);
  scene.add(cube);
  targetCubie = cube;
  allCubies.push(cube);
}

// Simple animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();

// Simple keyboard controls for debugging and testing


// initCubieOrganization();

function UHandler() {
    highlightSlice('y', 2);
    rotateSlice('y', 2, true);
}
function uHandler() {
    highlightSlice('y', 2);
    rotateSlice('y', 2, false);
}

function DHandler() {
    highlightSlice('y', 0);
    rotateSlice('y', 0, false); // Note: Reversed by convention
}

function dHandler() {
    highlightSlice('y', 0);
    rotateSlice('y', 0, true); // Note: Reversed by convention
}

function RHandler() {
    highlightSlice('x', 2);
    rotateSlice('x', 2, true);
}

function rHandler() {
    highlightSlice('x', 2);
    rotateSlice('x', 2, false);
}

function LHandler() {
    highlightSlice('x', 0);
    rotateSlice('x', 0, false); // Note: Reversed by convention
}

function lHandler() {
    highlightSlice('x', 0);
    rotateSlice('x', 0, true); // Note: Reversed by convention
}

function FHandler() {
    highlightSlice('z', 2);
    rotateSlice('z', 2, true);
}

function fHandler() {
    highlightSlice('z', 2);
    rotateSlice('z', 2, false);
}

function BHandler() {
    highlightSlice('z', 0);
    rotateSlice('z', 0, false); // Note: Reversed by convention
}

function bHandler() {
    highlightSlice('z', 0);
    rotateSlice('z', 0, true); // Note: Reversed by convention
}

// Middle slice handlers
function MHandler() {
    highlightSlice('x', 1);
    rotateSlice('x', 1, false); // Follows L convention
}

function mHandler() {
    highlightSlice('x', 1);
    rotateSlice('x', 1, true); // Follows L convention
}

function EHandler() {
    highlightSlice('y', 1);
    rotateSlice('y', 1, false); // Follows D convention
}

function eHandler() {
    highlightSlice('y', 1);
    rotateSlice('y', 1, true); // Follows D convention
}

function SHandler() {
    highlightSlice('z', 1);
    rotateSlice('z', 1, true); // Follows F convention
}

function sHandler() {
    highlightSlice('z', 1);
    rotateSlice('z', 1, false); // Follows F convention
}

// Other utility handlers
function initHandler() {
    initCubieOrganization();
}

function toggleDebugHandler() {
    toggleDebugVisuals();
}

// Map keys to handlers
const keyToHandler = {
    'u': uHandler,
    'U': UHandler,
    'd': dHandler,
    'D': DHandler,
    'r': rHandler,
    'R': RHandler,
    'l': lHandler,
    'L': LHandler,
    'f': fHandler,
    'F': FHandler,
    'b': bHandler,
    'B': BHandler,
    // 'm': mHandler,
    // 'M': MHandler,
    // 'e': eHandler,
    // 'E': EHandler,
    // 's': sHandler,
    // 'S': SHandler,
    // 'i': initHandler,
    // 'c': toggleDebugHandler
};

// initCubieOrganization();


document.addEventListener('keydown', (event) => {
    let key = event.key;
    let isUpperCase = key === key.toUpperCase() && key !== key.toLowerCase();
    let lowerKey = key.toLowerCase();
    
    // Direction is reversed for uppercase letters
    let clockwise = !isUpperCase;
    
    // call the handler function
    if (keyToHandler[key]) {
        // sample a bernoulli variable with crazyness_level
        let is_move_crazy = Math.random() < craziness_level;
        // is_move_crazy = false; // for debugging
        if (!is_move_crazy) {
            keyToHandler[key]();
        } else {
            // do a random move, but exclude the move we attempte to do
            // get the keys
            let keys = Object.keys(keyToHandler);
            // remove the current key
            let index = keys.indexOf(key);
            if (index > -1) {
                keys.splice(index, 1);
            }
            // get a random key
            let random_key = keys[Math.floor(Math.random() * keys.length)];
            // call the handler
            keyToHandler[random_key]();

        }

    }
    initCubieOrganization();



});
console.log("Basic scene initialized");
console.log("Press 'm' to move the target cubie");
console.log("Press 'n' to select the next cubie");
console.log("Press 'r' to reset camera view");
console.log("Press 'h' to toggle helpers");
console.log("Press 'd' to create a debug cube");

// initCubieOrganization();
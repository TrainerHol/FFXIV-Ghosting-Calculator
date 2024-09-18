// Wrap the initialization code in a function
function init() {
  // Set up the scene, camera, and renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById("container").appendChild(renderer.domElement);

  // Create the wireframe sphere
  const sphereGeometry = new THREE.SphereGeometry(50, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x002e07, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  scene.add(sphere);

  // Add this at the beginning of the init function
  let pairs = [
    {
      red: new THREE.Vector3(50, 0, 0),
      blue: new THREE.Vector3(-50, 0, 0),
      redSphere: null,
      blueSphere: null,
      locked: false,
      pathingType: "none",
      itemCount: 5,
      pathingSpheres: [], // Added pathingSpheres for each pair
    },
  ];
  let selectedPairIndex = 0;

  // Modify the sphere creation part
  function createPairSpheres(pair) {
    const redSphereGeometry = new THREE.SphereGeometry(2);
    const redSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    pair.redSphere = new THREE.Mesh(redSphereGeometry, redSphereMaterial);
    pair.redSphere.position.copy(pair.red);
    scene.add(pair.redSphere);

    const blueSphereGeometry = new THREE.SphereGeometry(2);
    const blueSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
    pair.blueSphere = new THREE.Mesh(blueSphereGeometry, blueSphereMaterial);
    pair.blueSphere.position.copy(pair.blue);
    scene.add(pair.blueSphere);
  }

  pairs.forEach(createPairSpheres);

  // Set up the camera position and controls
  camera.position.set(0, 0, 100);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  // Set up the dragging functionality
  let isDragging = false;
  const mouse = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();

  function onMouseDown(event) {
    isDragging = true;
    updateMousePosition(event);
  }

  function onMouseMove(event) {
    if (isDragging) {
      updateMousePosition(event);
      updateSpherePosition();
    }
  }

  function onMouseUp(event) {
    isDragging = false;
  }

  function updateMousePosition(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function updateSpherePosition() {
    raycaster.setFromCamera(mouse, camera);
    const intersection = raycaster.intersectObject(sphere);
    if (intersection.length > 0) {
      const point = intersection[0].point;
      const direction = point.clone().normalize();
      const redPosition = direction.clone().multiplyScalar(50);
      const bluePosition = direction.clone().multiplyScalar(-50);
      if (!pairs[selectedPairIndex].locked) {
        pairs[selectedPairIndex].red.copy(redPosition);
        pairs[selectedPairIndex].blue.copy(bluePosition);
        pairs[selectedPairIndex].redSphere.position.copy(redPosition);
        pairs[selectedPairIndex].blueSphere.position.copy(bluePosition);
        updateInputFields();
        updateDistance();
        updatePathing();
        updatePairList(); // Added to update the pairs list
      }
    }
  }

  renderer.domElement.addEventListener("mousedown", onMouseDown, false);
  renderer.domElement.addEventListener("mousemove", onMouseMove, false);
  renderer.domElement.addEventListener("mouseup", onMouseUp, false);

  // Update the input fields with the sphere coordinates
  function updateInputFields() {
    const pair = pairs[selectedPairIndex];
    document.getElementById("redX").value = pair.red.x.toFixed(6);
    document.getElementById("redY").value = pair.red.y.toFixed(6);
    document.getElementById("redZ").value = pair.red.z.toFixed(6);
    updateBlueSphereCoords();
  }

  // Update the blue sphere coordinates based on the red sphere
  function updateBlueSphereCoords() {
    const pair = pairs[selectedPairIndex];
    document.getElementById("blueX").textContent = pair.blue.x.toFixed(6);
    document.getElementById("blueY").textContent = pair.blue.y.toFixed(6);
    document.getElementById("blueZ").textContent = pair.blue.z.toFixed(6);
  }

  // Update the distance between the red and blue spheres
  function updateDistance() {
    const pair = pairs[selectedPairIndex];
    const distance = pair.red.distanceTo(pair.blue);
    document.getElementById("distance").textContent = distance.toFixed(6);
  }

  // Add North arrow
  const arrowLength = 60;
  const arrowColor = 0xffff00;
  const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), arrowLength, arrowColor);
  arrowHelper.position.set(0, 0, -50);
  scene.add(arrowHelper);

  // Update pathing to be per pair
  function updatePathing() {
    const pair = pairs[selectedPairIndex];
    const pathingType = pair.pathingType || document.getElementById("pathing").value;
    const itemCount = pair.itemCount || parseInt(document.getElementById("itemCount").value);

    // Clear existing pathing spheres for this pair
    pair.pathingSpheres.forEach((sphere) => {
      scene.remove(sphere);
    });
    pair.pathingSpheres.length = 0;

    if (pathingType === "lowest") {
      const lowestPoint = new THREE.Vector3(pair.red.x, Math.abs(pair.red.y), pair.red.z);
      createLowestPathing(pair, itemCount, lowestPoint);
    } else if (pathingType === "shortest") {
      const lowestPoint = new THREE.Vector3(pair.red.x, -pair.red.y, pair.red.z);
      createShortestPathing(pair, itemCount, lowestPoint);
    }

    updateCoordinateList();
    updateSpacingDelta();
  }

  // Add this new function to calculate and update the spacing delta
  function updateSpacingDelta() {
    const spacingDeltaElement = document.getElementById("spacingDelta");
    const pair = pairs[selectedPairIndex];
    if (pair.pathingSpheres.length < 2) {
      spacingDeltaElement.textContent = "";
      return;
    }

    let totalHorizontalDistance = 0;
    for (let i = 1; i < pair.pathingSpheres.length; i++) {
      const prev = pair.pathingSpheres[i - 1].position;
      const current = pair.pathingSpheres[i].position;
      const horizontalDistance = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.z - prev.z, 2));
      totalHorizontalDistance += horizontalDistance;
    }
    const averageHorizontalSpacing = totalHorizontalDistance / (pair.pathingSpheres.length - 1);
    spacingDeltaElement.textContent = `(Spacing Delta: ${averageHorizontalSpacing.toFixed(2)})`;
  }

  // Create lowest pathing
  function createLowestPathing(pair, itemCount, lowestPoint) {
    const startPoint = new THREE.Vector3(0, -50, 0);
    const endPoint = new THREE.Vector3(lowestPoint.x, -50, lowestPoint.z);
    const horizontalDistance = endPoint.distanceTo(startPoint);
    const stepSize = horizontalDistance / (itemCount - 1);

    for (let i = 0; i < itemCount; i++) {
      const t = i / (itemCount - 1);
      const x = startPoint.x + (endPoint.x - startPoint.x) * t;
      const z = startPoint.z + (endPoint.z - startPoint.z) * t;
      const horizontalMagnitude = Math.sqrt(x * x + z * z);
      // Use Math.abs to ensure we always use the lower hemisphere of the sphere
      const y = -Math.sqrt(2500 - horizontalMagnitude * horizontalMagnitude);

      const point = new THREE.Vector3(x, y, z);
      createPathingSphere(pair, point);
    }
  }

  // Create shortest pathing
  function createShortestPathing(pair, itemCount, lowestPoint) {
    const height = -Math.abs(pair.red.y); // Ensure height is always negative
    const startPoint = new THREE.Vector3(0, height, 0); // Start at (0, height, 0)
    const endPoint = new THREE.Vector3(pair.red.x, height, pair.red.z); // Path to (red.x, height, red.z)

    for (let i = 0; i < itemCount; i++) {
      const t = i / (itemCount - 1);
      const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
      createPathingSphere(pair, point);
    }
  }

  // Create pathing sphere
  function createPathingSphere(pair, point) {
    const geometry = new THREE.SphereGeometry(0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0x8b2bff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point);
    scene.add(sphere);
    pair.pathingSpheres.push(sphere);
    return sphere;
  }

  // Update coordinate list
  function updateCoordinateList() {
    const coordinateList = document.getElementById("coordinateList");
    coordinateList.innerHTML = "";

    pairs.forEach((pair) => {
      pair.pathingSpheres.forEach((sphere, index) => {
        const coords = sphere.position;
        const item = document.createElement("div");
        item.innerHTML = `${index + 1}: (<span id="pathX${index}">${coords.x.toFixed(6)}</span><span class="copy-btn" data-target="pathX${index}">C</span>, <span id="pathY${index}">${coords.y.toFixed(6)}</span><span class="copy-btn" data-target="pathY${index}">C</span>, <span id="pathZ${index}">${coords.z.toFixed(6)}</span><span class="copy-btn" data-target="pathZ${index}">C</span>)`;
        coordinateList.appendChild(item);
      });
    });
  }

  // Copy button functionality
  document.addEventListener("click", function (event) {
    if (event.target.classList.contains("copy-btn")) {
      const targetId = event.target.getAttribute("data-target");
      const targetElement = document.getElementById(targetId);
      const value = targetElement ? targetElement.value || targetElement.textContent : "";

      const tempInput = document.createElement("input");
      tempInput.value = value;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
    }
  });

  // Add event listeners for pathing type and item count changes
  document.getElementById("pathing").addEventListener("change", () => {
    pairs[selectedPairIndex].pathingType = document.getElementById("pathing").value;
    updatePathing();
  });
  document.getElementById("itemCount").addEventListener("change", () => {
    pairs[selectedPairIndex].itemCount = parseInt(document.getElementById("itemCount").value);
    updatePathing();
  });

  // Set initial position of red sphere and update scene
  pairs[selectedPairIndex].redSphere.position.set(50, 0, 0);
  pairs[selectedPairIndex].blueSphere.position.set(-50, 0, 0);
  updateInputFields();
  updateDistance();
  updatePathing();
  updateSpacingDelta();

  // Add event listener for Makeplace export button
  document.getElementById("exportMakeplace").addEventListener("click", exportMakeplace);

  // Update exportMakeplace to export a single file with all pairs
  function exportMakeplace() {
    const makeplaceData = {
      itemId: 39386,
      name: "Darkest Hourglass",
      transform: {
        location: [0, 0, 0],
        rotation: [0, 0, 0, 1],
        scale: [1, 1, 1],
      },
      properties: {
        designName: "GhostingTemplate",
        scale: 100,
      },
      attachments: [],
    };

    pairs.forEach((pair, index) => {
      const rounded = (vec) => `${Math.round(vec.x)},${Math.round(vec.y)},${Math.round(vec.z)}`;
      const filenameSuffix = `${rounded(pair.red)}-${pair.pathingSpheres.length}p`;

      makeplaceData.attachments.push(
        {
          itemId: 24511,
          name: `Wooden Loft (Red ${index + 1})`,
          transform: {
            location: [pair.red.x * 100, pair.red.z * 100, pair.red.y * 100], // Swapped Y and Z
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {
            color: "E40011FF",
          },
        },
        {
          itemId: 24511,
          name: `Wooden Loft (Blue ${index + 1})`,
          transform: {
            location: [pair.blue.x * 100, pair.blue.z * 100, pair.blue.y * 100], // Swapped Y and Z
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {
            color: "000EA2FF",
          },
        }
      );

      // Add pathing points for this pair
      makeplaceData.attachments.push(
        ...pair.pathingSpheres.map((sphere) => ({
          itemId: 15971,
          name: "Knightly Round Table",
          transform: {
            location: [sphere.position.x * 100, sphere.position.z * 100, sphere.position.y * 100], // Swapped Y and Z
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {},
        }))
      );
    });

    const jsonString = JSON.stringify(makeplaceData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    const mainPair = pairs[0];
    const roundedRed = `${Math.round(mainPair.red.x)}`;
    const roundedY = `${Math.round(mainPair.red.z)}`; // Swapped Y and Z
    const roundedZ = `${Math.round(mainPair.red.y)}`; // Swapped Y and Z
    const pointsCount = mainPair.pathingSpheres.length;
    a.download = `GhostingTemplate-${roundedRed}-${roundedY}-${roundedZ}-${pointsCount}p.json`; // Updated filename
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Update functions to handle pathing per pair
  function addPair() {
    const newPair = {
      red: new THREE.Vector3(50, 0, 0),
      blue: new THREE.Vector3(-50, 0, 0),
      redSphere: null,
      blueSphere: null,
      locked: false,
      pathingType: "none",
      itemCount: 5,
      pathingSpheres: [], // Initialize pathingSpheres for the new pair
    };
    createPairSpheres(newPair);
    pairs.push(newPair);
    updatePairList();
    selectPair(pairs.length - 1);
  }

  function removePair(index) {
    if (pairs.length > 1) {
      scene.remove(pairs[index].redSphere);
      scene.remove(pairs[index].blueSphere);
      pairs.splice(index, 1);
      updatePairList();
      selectPair(Math.min(index, pairs.length - 1));
    }
  }

  function selectPair(index) {
    selectedPairIndex = index;
    const pair = pairs[index];
    // Update UI with pair-specific pathing
    document.getElementById("pathing").value = pair.pathingType;
    document.getElementById("itemCount").value = pair.itemCount;
    updateInputFields();
    updateDistance();
    updatePathing();
    updateSpacingDelta();
    updatePairList();

    // Temporarily change sphere colors
    const originalRedColor = pair.redSphere.material.color.clone();
    const originalBlueColor = pair.blueSphere.material.color.clone();
    pair.redSphere.material.color.set(0xffff00); // Highlight color
    pair.blueSphere.material.color.set(0xffff00); // Highlight color

    setTimeout(() => {
      pair.redSphere.material.color.copy(originalRedColor);
      pair.blueSphere.material.color.copy(originalBlueColor);
    }, 1000); // 1 second
  }

  function updatePairList() {
    const pairList = document.getElementById("pairList");
    pairList.innerHTML = "";

    pairs.forEach((pair, index) => {
      const item = document.createElement("div");
      item.classList.add("pair-item");
      if (index === selectedPairIndex) {
        item.classList.add("selected-pair");
      }
      const coords = `(${pair.red.x.toFixed(2)}, ${pair.red.y.toFixed(2)}, ${pair.red.z.toFixed(2)})`;
      const lockEmoji = pair.locked ? "🔒" : "🔓";
      item.innerHTML = `
        Pair ${index + 1}: ${coords}
        <button onclick="removePair(${index})">🗑️</button>
        <span class="lock-btn" onclick="toggleLock(${index})">${lockEmoji}</span>
      `;
      item.addEventListener("click", () => selectPair(index));
      pairList.appendChild(item);
    });
  }

  function toggleLock(index) {
    pairs[index].locked = !pairs[index].locked;
    updatePairList();
  }

  // Add these new functions to the global scope
  window.selectPair = selectPair;
  window.removePair = removePair;
  window.toggleLock = toggleLock;

  // Move the event listener assignments into a separate function
  function addEventListeners() {
    const addPairBtn = document.getElementById("addPairBtn");
    const pathingSelect = document.getElementById("pathing");
    const itemCountInput = document.getElementById("itemCount");
    const validateBtn = document.getElementById("validateBtn");
    const exportMakeplaceBtn = document.getElementById("exportMakeplace");

    if (addPairBtn) addPairBtn.addEventListener("click", addPair);
    if (pathingSelect) pathingSelect.addEventListener("change", updatePathing);
    if (itemCountInput) itemCountInput.addEventListener("change", updatePathing);
    if (validateBtn) validateBtn.addEventListener("click", validateCoordinates);
    if (exportMakeplaceBtn) exportMakeplaceBtn.addEventListener("click", exportMakeplace);
  }

  // Call updatePairList and addEventListeners after a short delay
  setTimeout(() => {
    updatePairList();
    addEventListeners();
  }, 0);

  // Move the animate function inside init
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();

  function validateCoordinates() {
    const pair = pairs[selectedPairIndex];
    // Read input field values
    const redX = parseFloat(document.getElementById("redX").value);
    const redY = parseFloat(document.getElementById("redY").value);
    const redZ = parseFloat(document.getElementById("redZ").value);

    // Validate input values
    if (isNaN(redX) || isNaN(redY) || isNaN(redZ)) {
      alert("Please enter valid numerical values for Red Sphere coordinates.");
      return;
    }

    // Create a vector from input
    const inputVector = new THREE.Vector3(redX, redY, redZ);

    // Clamp to exactly 50 units
    const clampedVector = inputVector.clone().setLength(50);

    // Update pair's red position to clamped vector
    pair.red.copy(clampedVector);
    pair.redSphere.position.copy(pair.red);

    // Update blue sphere's position
    pair.blue.copy(pair.red.clone().multiplyScalar(-1));
    pair.blueSphere.position.copy(pair.blue);

    // Update input fields with clamped values
    document.getElementById("redX").value = pair.red.x.toFixed(6);
    document.getElementById("redY").value = pair.red.y.toFixed(6);
    document.getElementById("redZ").value = pair.red.z.toFixed(6);

    // Update related UI elements
    updateBlueSphereCoords();
    updateDistance();
    updatePathing();
    updatePairList(); // Refresh the pairs list
  }

  window.validateCoordinates = validateCoordinates; // Ensure it's exposed globally
}

// Use DOMContentLoaded event to ensure the DOM is fully loaded before running init
document.addEventListener("DOMContentLoaded", () => {
  // Ensure Three.js and OrbitControls are loaded before initializing
  if (typeof THREE !== "undefined" && typeof THREE.OrbitControls !== "undefined") {
    init();
  } else {
    console.error("Three.js or OrbitControls not loaded");
  }
});

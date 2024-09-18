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

  // Create the red sphere
  const redSphereGeometry = new THREE.SphereGeometry(2);
  const redSphereMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const redSphere = new THREE.Mesh(redSphereGeometry, redSphereMaterial);
  redSphere.position.set(50, 0, 0);
  scene.add(redSphere);

  // Create the blue sphere
  const blueSphereGeometry = new THREE.SphereGeometry(2);
  const blueSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const blueSphere = new THREE.Mesh(blueSphereGeometry, blueSphereMaterial);
  blueSphere.position.copy(redSphere.position).multiplyScalar(-1);
  scene.add(blueSphere);

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
      redSphere.position.copy(redPosition);
      blueSphere.position.copy(bluePosition);
      updateInputFields();
      updateDistance();
      updatePathing();
    }
  }

  renderer.domElement.addEventListener("mousedown", onMouseDown, false);
  renderer.domElement.addEventListener("mousemove", onMouseMove, false);
  renderer.domElement.addEventListener("mouseup", onMouseUp, false);

  // Update the input fields with the sphere coordinates
  function updateInputFields() {
    const redCoords = redSphere.position;
    document.getElementById("redX").value = redCoords.x.toFixed(6);
    document.getElementById("redY").value = redCoords.y.toFixed(6);
    document.getElementById("redZ").value = redCoords.z.toFixed(6);
    updateBlueSphereCoords();
  }

  // Update the blue sphere coordinates based on the red sphere
  function updateBlueSphereCoords() {
    const blueCoords = blueSphere.position;
    document.getElementById("blueX").textContent = blueCoords.x.toFixed(6);
    document.getElementById("blueY").textContent = blueCoords.y.toFixed(6);
    document.getElementById("blueZ").textContent = blueCoords.z.toFixed(6);
  }

  // Update the distance between the red and blue spheres
  function updateDistance() {
    const distance = redSphere.position.distanceTo(blueSphere.position);
    document.getElementById("distance").textContent = distance.toFixed(6);
  }

  // Add event listener to the validate button
  document.getElementById("validateBtn").addEventListener("click", validateCoordinates);

  function validateCoordinates() {
    const x = parseFloat(document.getElementById("redX").value);
    const y = parseFloat(document.getElementById("redY").value);
    const z = parseFloat(document.getElementById("redZ").value);
    const newPosition = new THREE.Vector3(x, y, z);
    const direction = newPosition.clone().normalize();
    const redPosition = direction.clone().multiplyScalar(50);
    const bluePosition = direction.clone().multiplyScalar(-50);
    redSphere.position.copy(redPosition);
    blueSphere.position.copy(bluePosition);
    updateInputFields();
    updateDistance();
    updatePathing();
  }

  // Add North arrow
  const arrowLength = 60;
  const arrowColor = 0xffff00;
  const arrowHelper = new THREE.ArrowHelper(new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, 0), arrowLength, arrowColor);
  arrowHelper.position.set(0, 0, -50);
  scene.add(arrowHelper);

  // Pathing variables
  const pathingSpheres = [];

  // Update pathing
  function updatePathing() {
    const pathingType = document.getElementById("pathing").value;
    const itemCount = parseInt(document.getElementById("itemCount").value);

    // Clear existing pathing spheres
    pathingSpheres.forEach((sphere) => {
      scene.remove(sphere);
    });
    pathingSpheres.length = 0;

    if (pathingType === "lowest") {
      const lowestPoint = new THREE.Vector3(redSphere.position.x, Math.abs(redSphere.position.y), redSphere.position.z);
      createLowestPathing(itemCount, lowestPoint);
    } else if (pathingType === "shortest") {
      const lowestPoint = new THREE.Vector3(redSphere.position.x, -redSphere.position.y, redSphere.position.z);
      createShortestPathing(itemCount, lowestPoint);
    }

    updateCoordinateList();
    updateSpacingDelta();
  }

  // Add this new function to calculate and update the spacing delta
  function updateSpacingDelta() {
    const spacingDeltaElement = document.getElementById("spacingDelta");
    if (pathingSpheres.length < 2) {
      spacingDeltaElement.textContent = "";
      return;
    }

    let totalHorizontalDistance = 0;
    for (let i = 1; i < pathingSpheres.length; i++) {
      const prev = pathingSpheres[i - 1].position;
      const current = pathingSpheres[i].position;
      const horizontalDistance = Math.sqrt(Math.pow(current.x - prev.x, 2) + Math.pow(current.z - prev.z, 2));
      totalHorizontalDistance += horizontalDistance;
    }
    const averageHorizontalSpacing = totalHorizontalDistance / (pathingSpheres.length - 1);
    spacingDeltaElement.textContent = `(Spacing Delta: ${averageHorizontalSpacing.toFixed(2)})`;
  }

  // Update the event listeners to include the new updateSpacingDelta function
  document.getElementById("pathing").addEventListener("change", () => {
    updatePathing();
    updateSpacingDelta();
  });
  document.getElementById("itemCount").addEventListener("change", () => {
    updatePathing();
    updateSpacingDelta();
  });

  // Create lowest pathing
  function createLowestPathing(itemCount, lowestPoint) {
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
      const sphere = createPathingSphere(point);
      pathingSpheres.push(sphere);
    }
  }

  // Create shortest pathing
  function createShortestPathing(itemCount, lowestPoint) {
    const startPoint = new THREE.Vector3(0, 0, 0);
    const endPoint = lowestPoint;

    for (let i = 0; i < itemCount; i++) {
      const t = i / (itemCount - 1);
      const point = new THREE.Vector3().lerpVectors(startPoint, endPoint, t);
      const sphere = createPathingSphere(point);
      pathingSpheres.push(sphere);
    }
  }

  // Create pathing sphere
  function createPathingSphere(point) {
    const geometry = new THREE.SphereGeometry(0.5);
    const material = new THREE.MeshBasicMaterial({ color: 0x8b2bff });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(point);
    scene.add(sphere);
    return sphere;
  }

  // Update coordinate list
  function updateCoordinateList() {
    const coordinateList = document.getElementById("coordinateList");
    coordinateList.innerHTML = "";

    pathingSpheres.forEach((sphere, index) => {
      const coords = sphere.position;
      const item = document.createElement("div");
      item.innerHTML = `${index + 1}: (<span id="pathX${index}">${coords.x.toFixed(6)}</span><span class="copy-btn" data-target="pathX${index}">C</span>, <span id="pathY${index}">${coords.y.toFixed(6)}</span><span class="copy-btn" data-target="pathY${index}">C</span>, <span id="pathZ${index}">${coords.z.toFixed(6)}</span><span class="copy-btn" data-target="pathZ${index}">C</span>)`;
      coordinateList.appendChild(item);
    });
  }

  // Collapsible list functionality
  const collapsible = document.getElementsByClassName("collapsible")[0];
  collapsible.addEventListener("click", function () {
    this.classList.toggle("active");
    const content = this.nextElementSibling;
    if (content.style.display === "block") {
      content.style.display = "none";
    } else {
      content.style.display = "block";
    }
  });

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
  document.getElementById("pathing").addEventListener("change", updatePathing);
  document.getElementById("itemCount").addEventListener("change", updatePathing);

  // Set initial position of red sphere and update scene
  redSphere.position.set(50, 0, 0);
  blueSphere.position.set(-50, 0, 0);
  updateInputFields();
  updateDistance();
  updatePathing();
  updateSpacingDelta();

  // Add event listener for Makeplace export button
  document.getElementById("exportMakeplace").addEventListener("click", exportMakeplace);

  function exportMakeplace() {
    const redCoords = redSphere.position;
    const blueCoords = blueSphere.position;
    const pathingPoints = pathingSpheres.map((sphere) => sphere.position);

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
      attachments: [
        {
          itemId: 24511,
          name: "Wooden Loft",
          transform: {
            location: [redCoords.x * 100, redCoords.z * 100, redCoords.y * -100],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {
            color: "E40011FF",
          },
        },
        {
          itemId: 24511,
          name: "Wooden Loft",
          transform: {
            location: [blueCoords.x * 100, blueCoords.z * 100, blueCoords.y * -100],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {
            color: "000EA2FF",
          },
        },
        ...pathingPoints.map((point) => ({
          itemId: 15971,
          name: "Knightly Round Table",
          transform: {
            location: [point.x * 100, point.z * 100, -Math.abs(point.y) * 100],
            rotation: [0, 0, 0, 1],
            scale: [1, 1, 1],
          },
          properties: {},
        })),
      ],
    };

    const jsonString = JSON.stringify(makeplaceData, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `GhostingTemplate-${Math.round(redCoords.x)}-${Math.round(redCoords.y)}-${Math.round(redCoords.z)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Move the animate function inside init
  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

// Add an event listener to run the init function after the DOM has loaded
document.addEventListener("DOMContentLoaded", init);

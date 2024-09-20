// Define blueSpheresMap at the global scope
const blueSpheresMap = new Map();

// Define blueSpheresArray at the global scope
const blueSpheresArray = [];

// At the top of your file, add this line to store colors persistently
let persistentColorMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  const clearListBtn = document.getElementById("clearListBtn"); // New button
  const furnitureItems = document.getElementById("furnitureItems");

  // Define pairs list
  let pairs = [];

  uploadBtn.addEventListener("click", () => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.addEventListener("change", handleFileUpload);
    fileInput.click();
  });

  function handleFileUpload(event) {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonData = JSON.parse(e.target.result);
          processMakeplaceFile(jsonData);
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          alert("Error parsing JSON file. Please make sure it's a valid Makeplace file.");
        }
      };
      reader.readAsText(file);
    }
  }

  function processMakeplaceFile(data) {
    furnitureItems.innerHTML = ""; // Clear existing items
    const items = [];

    // Process interiorFurniture
    if (data.interiorFurniture) {
      data.interiorFurniture.forEach((item) => {
        items.push(createItemFromMakeplaceData(item));
        if (item.attachments) {
          item.attachments.forEach((attachment) => {
            items.push(createItemFromMakeplaceData(attachment));
          });
        }
      });
    }

    // Display and save the processed items
    items.forEach((item) => addFurnitureItem(item));
    saveFurnitureItems();
  }

  function createItemFromMakeplaceData(item) {
    const x = (item.transform.location[0] / 100).toFixed(2);
    const y = (item.transform.location[2] / 100).toFixed(2);
    const z = (item.transform.location[1] / 100).toFixed(2);
    const name = `${item.name} (${x}, ${y}, ${z})`;
    const color = item.properties && item.properties.color ? item.properties.color : "";
    const colorSpan = color ? `<span style="display:inline-block;width:0.5em;height:0.5em;background-color:#${color};"></span>` : "";
    return {
      name: `${name} ${colorSpan}`,
      info: "",
      coordinates: { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) }, // Added coordinates
    };
  }

  addItemBtn.addEventListener("click", () => {
    addFurnitureItem();
  });

  clearListBtn.addEventListener("click", () => {
    furnitureItems.innerHTML = "";
    saveFurnitureItems();
    computeGhostingPairs();
    updateNotesContent();
  });

  function addFurnitureItem(item = { name: "", info: "", coordinates: { x: 0, y: 0, z: 0 } }) {
    // Ensure coordinates exist
    item.coordinates = item.coordinates || { x: 0, y: 0, z: 0 };

    const itemElement = document.createElement("div");
    itemElement.className = "furniture-item";
    itemElement.draggable = true;
    itemElement.innerHTML = `
      <div class="furniture-item-content">
        <div class="editable" contenteditable="true">${item.name || "Edit Name"}</div>
      </div>
      <div class="info-label-container">
        <div class="info-label editable" contenteditable="true">${item.info || ""}</div>
      </div>
    `;
    addDragAndDropHandlers(itemElement);

    // Set dataset attributes for coordinates
    itemElement.dataset.x = item.coordinates.x;
    itemElement.dataset.y = item.coordinates.y;
    itemElement.dataset.z = item.coordinates.z;

    // Save changes and update colors on blur
    itemElement.querySelectorAll(".editable").forEach((element) => {
      element.addEventListener("blur", () => {
        saveFurnitureItems();
        updateLabelColors();
      });
    });

    itemElement.addEventListener("mouseenter", () => {
      const index = Array.from(furnitureItems.children).indexOf(itemElement);
      highlightSphere(index, true);
    });
    itemElement.addEventListener("mouseleave", () => {
      const index = Array.from(furnitureItems.children).indexOf(itemElement);
      highlightSphere(index, false);
    });

    furnitureItems.appendChild(itemElement);
    saveFurnitureItems(); // Save when a new item is added
    computeGhostingPairs();
    updateNotesContent();

    // Reinitialize Three.js scene to update blue spheres
    initializeThreeJS();

    updateLabelColors();

    return itemElement;
  }

  function displayFurnitureItems(items) {
    furnitureItems.innerHTML = "";
    items.forEach((item) => {
      const itemElement = addFurnitureItem(item);
      // Preserve the custom info when displaying items
      itemElement.querySelector(".info-label").textContent = item.info || "";
    });
    computeGhostingPairs();
    updateNotesContent();
  }

  function addDragAndDropHandlers(element) {
    element.addEventListener("dragstart", handleDragStart);
    element.addEventListener("dragover", handleDragOver);
    element.addEventListener("drop", handleDrop);
    element.addEventListener("dragend", handleDragEnd);
  }

  let dragSrcEl = null;
  let dragSrcIndex = null;

  function handleDragStart(e) {
    dragSrcEl = this;
    dragSrcIndex = Array.from(furnitureItems.children).indexOf(this);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
    this.classList.add("dragging");
    this.dataset.originalIndex = Array.from(furnitureItems.children).indexOf(this);
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    const targetItem = e.target.closest(".furniture-item");
    if (targetItem && targetItem !== dragSrcEl) {
      const targetRect = targetItem.getBoundingClientRect();
      const afterMiddle = e.clientY > targetRect.top + targetRect.height / 2;

      furnitureItems.querySelectorAll(".furniture-item").forEach((item) => item.classList.remove("drag-over", "drag-over-top", "drag-over-bottom"));

      targetItem.classList.add("drag-over", afterMiddle ? "drag-over-bottom" : "drag-over-top");
    }
    return false;
  }

  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();

    if (dragSrcEl === this) return false;

    const targetItem = e.target.closest(".furniture-item");
    if (!targetItem) return false;

    const allItems = Array.from(furnitureItems.children);
    const fromIndex = allItems.indexOf(dragSrcEl);
    const toIndex = allItems.indexOf(targetItem);

    const targetRect = targetItem.getBoundingClientRect();
    const afterMiddle = e.clientY > targetRect.top + targetRect.height / 2;

    // Store the initial positions of all items
    const initialPositions = allItems.map((item) => item.getBoundingClientRect().top);

    // Preserve the custom info before removing the dragged item
    const draggedItemInfo = dragSrcEl.querySelector(".info-label").textContent;

    // Remove the dragged item from its original position
    dragSrcEl.remove();

    // Insert the dragged item at its new position
    if (afterMiddle) {
      furnitureItems.insertBefore(dragSrcEl, targetItem.nextSibling);
    } else {
      furnitureItems.insertBefore(dragSrcEl, targetItem);
    }

    // Restore the custom info
    dragSrcEl.querySelector(".info-label").textContent = draggedItemInfo;

    // Animate the movement
    requestAnimationFrame(() => {
      const items = furnitureItems.querySelectorAll(".furniture-item");
      items.forEach((item, index) => {
        const itemRect = item.getBoundingClientRect();
        const furnitureRect = furnitureItems.getBoundingClientRect();
        const newTop = itemRect.top - furnitureRect.top;
        const oldTop = initialPositions[index] - furnitureRect.top;
        const deltaY = newTop - oldTop;

        // Only animate items that have changed position
        if (Math.abs(deltaY) > 1) {
          item.style.transform = `translateY(${-deltaY}px)`;
          item.style.transition = "none";

          requestAnimationFrame(() => {
            item.style.transform = "";
            item.style.transition = "transform 0.3s ease-out";
          });
        }
      });

      // Reset styles after animation
      setTimeout(() => {
        items.forEach((item) => {
          item.style.transform = "";
          item.style.transition = "";
        });
      }, 300);
    });

    saveFurnitureItems();
    computeGhostingPairs();
    updateNotesContent();

    // Reinitialize Three.js scene to update blue spheres
    initializeThreeJS();

    // Remove all group lines after reordering
    removeSeparators();

    // Update colors after reordering
    updateLabelColors();
  }

  function handleDragEnd() {
    this.classList.remove("dragging");
    furnitureItems.querySelectorAll(".furniture-item").forEach((item) => {
      item.classList.remove("drag-over", "drag-over-top", "drag-over-bottom");
    });
  }

  function saveFurnitureItems() {
    const items = [];
    furnitureItems.querySelectorAll(".furniture-item").forEach((item) => {
      const nameElement = item.querySelector(".furniture-item-content .editable");
      const name = nameElement.innerHTML.trim();
      const info = item.querySelector(".info-label").textContent.trim();
      const x = parseFloat(item.dataset.x) || 0;
      const y = parseFloat(item.dataset.y) || 0;
      const z = parseFloat(item.dataset.z) || 0;
      items.push({ name, info, coordinates: { x, y, z } });
    });
    localStorage.setItem("furnitureItems", JSON.stringify(items));

    // Save the persistent color map
    localStorage.setItem("persistentColorMap", JSON.stringify(Array.from(persistentColorMap.entries())));

    // Reinitialize Three.js scene to update blue spheres
    initializeThreeJS();

    // Update colors after saving
    updateLabelColors();
  }

  function loadFurnitureItems() {
    const items = JSON.parse(localStorage.getItem("furnitureItems")) || [];
    // All items have coordinates
    const updatedItems = items.map((item) => ({
      ...item,
      coordinates: item.coordinates || { x: 0, y: 0, z: 0 },
    }));
    displayFurnitureItems(updatedItems);
    updateNotesContent();
    updateLabelColors();

    // Load the persistent color map
    const savedColorMap = localStorage.getItem("persistentColorMap");
    if (savedColorMap) {
      persistentColorMap = new Map(JSON.parse(savedColorMap));
    }
  }

  // Function to update notes content
  function updateNotesContent() {
    const notesContainer = document.getElementById("notesContent");
    if (!notesContainer) return;

    notesContainer.innerHTML = "";

    if (pairs.length > 0) {
      // Bullet point for items before the first trigger
      const firstPair = pairs[0];
      const firstItem = firstPair.a;
      const bullet1 = document.createElement("li");
      bullet1.textContent = `Any items before `;

      const triggerLink = document.createElement("button");
      triggerLink.className = "trigger-link";
      triggerLink.textContent = firstItem.trigger;
      triggerLink.addEventListener("click", () => scrollToTrigger(firstItem.trigger));

      bullet1.appendChild(triggerLink);
      bullet1.innerHTML += `, ${firstItem.name} at (${firstItem.coordinates.x.toFixed(2)}, ${firstItem.coordinates.y.toFixed(2)}, ${firstItem.coordinates.z.toFixed(2)}), will not be affected by ghosting.`;
      notesContainer.appendChild(bullet1);

      // Bullet points for each item in each pair
      pairs.forEach((pair) => {
        const a = pair.a;
        const b = pair.b;

        // Bullet for Trigger A
        const bulletA = document.createElement("li");

        const triggerALink = document.createElement("button");
        triggerALink.className = "trigger-link";
        triggerALink.textContent = a.trigger;
        triggerALink.addEventListener("click", () => scrollToTrigger(a.trigger));

        bulletA.appendChild(document.createTextNode(`When the player gets to `));
        bulletA.appendChild(triggerALink);
        bulletA.innerHTML += `, ${a.name} at (${a.coordinates.x.toFixed(2)}, ${a.coordinates.y.toFixed(2)}, ${a.coordinates.z.toFixed(2)}), any items placed after `;

        const triggerBLink = document.createElement("button");
        triggerBLink.className = "trigger-link";
        triggerBLink.textContent = b.trigger;
        triggerBLink.addEventListener("click", () => scrollToTrigger(b.trigger));

        bulletA.appendChild(triggerBLink);
        bulletA.innerHTML += ` including itself will disappear in groups of 5 every tick. <button class="visualize-btn" onclick="visualizeDisappearance('${pair.a.trigger}', '${pair.b.trigger}')">Visualize</button>`;
        notesContainer.appendChild(bulletA);

        // Bullet for Trigger B
        const bulletB = document.createElement("li");

        const triggerBLink2 = document.createElement("button");
        triggerBLink2.className = "trigger-link";
        triggerBLink2.textContent = b.trigger;
        triggerBLink2.addEventListener("click", () => scrollToTrigger(b.trigger));

        bulletB.appendChild(document.createTextNode(`When the player gets to `));
        bulletB.appendChild(triggerBLink2);
        bulletB.innerHTML += `, ${b.name} at (${b.coordinates.x.toFixed(2)}, ${b.coordinates.y.toFixed(2)}, ${b.coordinates.z.toFixed(2)}), any items placed after `;

        const triggerALink2 = document.createElement("button");
        triggerALink2.className = "trigger-link";
        triggerALink2.textContent = a.trigger;
        triggerALink2.addEventListener("click", () => scrollToTrigger(a.trigger));

        bulletB.appendChild(triggerALink2);
        bulletB.innerHTML += ` including itself will disappear in groups of 5 every tick. <button class="visualize-btn" onclick="visualizeDisappearance('${pair.b.trigger}', '${pair.a.trigger}')">Visualize</button>`;
        notesContainer.appendChild(bulletB);
      });
    }

    // Add event listeners after content is added to the DOM
    addTriggerLinkListeners();

    // Update colors in notes content
    updateLabelColors();
  }

  // New function to add event listeners to trigger links
  function addTriggerLinkListeners() {
    const triggerLinks = document.querySelectorAll(".trigger-link");
    triggerLinks.forEach((link) => {
      link.addEventListener("click", function () {
        scrollToTrigger(this.textContent);
      });
    });
  }

  // scrollToTrigger function
  function scrollToTrigger(triggerText) {
    const item = Array.from(furnitureItems.children).find((item) => item.querySelector(".info-label").textContent === triggerText);
    if (item) {
      const container = document.querySelector(".furniture-list");
      item.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });

      item.classList.add("highlighted");
      setTimeout(() => {
        item.classList.remove("highlighted");
      }, 1000);

      // Highlight the corresponding sphere
      const sphere = blueSpheresMap.get(triggerText);
      if (sphere) {
        const originalColor = sphere.material.color.getHex();
        sphere.material.color.setHex(0xff0000); // Set to red
        setTimeout(() => {
          sphere.material.color.setHex(originalColor); // Revert to original color
        }, 1000);
      }
    }
  }

  // Visualize disappearance animation
  function visualizeDisappearance(startTrigger, pairTrigger) {
    const startItem = Array.from(furnitureItems.children).find((item) => item.querySelector(".info-label").textContent === pairTrigger);
    if (!startItem) return;

    const allItems = Array.from(furnitureItems.children);
    const startIndex = allItems.indexOf(startItem);
    const total = allItems.length;

    // Remove existing group classes
    removeSeparators();

    // Calculate group boundaries
    const groupBoundaries = calculateGroupBoundaries(startIndex, total);

    let currentGroupIndex = 0;

    function highlightGroup() {
      if (currentGroupIndex >= groupBoundaries.length) {
        return;
      }

      const { start, end } = groupBoundaries[currentGroupIndex];

      // Add top border to the first item in the group
      allItems[start].classList.add("ghosting-group-start");

      for (let i = start; i <= end; i++) {
        allItems[i].classList.add("highlighted", "ghosting-group-item");

        // Highlight the corresponding blue sphere
        if (i < blueSpheresArray.length) {
          blueSpheresArray[i].material.color.set(0xffff00); // Change to yellow
        }

        // Add bottom border to the last item in the group
        if (i === end) {
          allItems[i].classList.add("ghosting-group-end");
        }
      }

      // Scroll to the first item in the current group
      allItems[start].scrollIntoView({ behavior: "smooth", block: "center" });

      setTimeout(() => {
        for (let i = start; i <= end; i++) {
          allItems[i].classList.remove("highlighted");

          // Revert blue sphere color
          if (i < blueSpheresArray.length) {
            blueSpheresArray[i].material.color.set(0x0000ff); // Revert to blue
          }
        }

        currentGroupIndex++;
        if (currentGroupIndex < groupBoundaries.length) {
          highlightGroup();
        } else {
          // Animation finished, remove ghosting-group-item classes
          allItems.forEach((item) => item.classList.remove("ghosting-group-item"));
        }
      }, 1000);
    }

    highlightGroup();
  }

  function removeSeparators() {
    furnitureItems.querySelectorAll(".furniture-item").forEach((item) => {
      item.classList.remove("ghosting-group-start", "ghosting-group-end", "ghosting-group-item");
    });
  }

  function computeGhostingPairs() {
    pairs = [];
    const items = Array.from(furnitureItems.children)
      .map((item) => {
        const nameText = item.querySelector(".furniture-item-content .editable").textContent;
        const infoLabel = item.querySelector(".info-label");
        const coordsMatch = nameText.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
        if (coordsMatch) {
          return {
            element: item,
            coordinates: {
              x: parseFloat(coordsMatch[1]),
              y: parseFloat(coordsMatch[2]),
              z: parseFloat(coordsMatch[3]),
            },
            customInfo: infoLabel.textContent
              .trim()
              .replace(/Trigger #\d+ [AB]/, "")
              .trim(), // Remove existing trigger and store custom info
          };
        }
        return null;
      })
      .filter((item) => item !== null);

    let triggerNumber = 1;

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const distance = Math.sqrt(Math.pow(items[i].coordinates.x - items[j].coordinates.x, 2) + Math.pow(items[i].coordinates.y - items[j].coordinates.y, 2) + Math.pow(items[i].coordinates.z - items[j].coordinates.z, 2));
        if (distance >= 99.9) {
          const triggerA = `Trigger #${triggerNumber} A`;
          const triggerB = `Trigger #${triggerNumber} B`;
          const nameA = items[i].element.querySelector(".furniture-item-content .editable").textContent.trim();
          const nameB = items[j].element.querySelector(".furniture-item-content .editable").textContent.trim();

          pairs.push({
            a: {
              ...items[i],
              trigger: triggerA,
              name: nameA,
            },
            b: {
              ...items[j],
              trigger: triggerB,
              name: nameB,
            },
          });

          // Assign Trigger labels while preserving custom info
          items[i].element.querySelector(".info-label").textContent = items[i].customInfo ? `${items[i].customInfo} ${triggerA}` : triggerA;
          items[j].element.querySelector(".info-label").textContent = items[j].customInfo ? `${items[j].customInfo} ${triggerB}` : triggerB;

          triggerNumber++;
        }
      }
    }

    updateNotesContent(); // Ensure notes are updated after computing pairs
  }

  loadFurnitureItems();

  // Initialize Three.js
  initializeThreeJS();

  // Expose visualizeDisappearance and scrollToTrigger to the global scope after their definitions
  window.visualizeDisappearance = visualizeDisappearance; // Ensure this is after the function is defined
  window.scrollToTrigger = scrollToTrigger;
});

// Function to initialize Three.js in the threejsCanvas
function initializeThreeJS() {
  const canvas = document.getElementById("threejsCanvas");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 100);

  const controls = new THREE.OrbitControls(camera, renderer.domElement);

  // Add XYZ axes with labels
  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  const loader = new THREE.FontLoader();
  loader.load("https://threejs.org/examples/fonts/helvetiker_regular.typeface.json", function (font) {
    const createLabel = (text, position) => {
      const textGeometry = new THREE.TextGeometry(text, {
        font: font,
        size: 2,
        height: 0.5,
      });
      const textMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const textMesh = new THREE.Mesh(textGeometry, textMaterial);
      textMesh.position.copy(position);
      scene.add(textMesh);
    };

    createLabel("X", new THREE.Vector3(55, 0, 0));
    createLabel("Y", new THREE.Vector3(0, 55, 0));
    createLabel("Z", new THREE.Vector3(0, 0, 55));
  });

  // Add main mesh grid sphere
  const sphereGeometry = new THREE.SphereGeometry(50, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x002e07, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  scene.add(sphere);

  // Clear existing blue spheres
  blueSpheresArray.forEach((sphere) => scene.remove(sphere));
  blueSpheresArray.length = 0;
  blueSpheresMap.clear();

  // Add blue spheres for furniture coordinates
  const furnitureItems = document.querySelectorAll(".furniture-item");
  furnitureItems.forEach((item, index) => {
    const nameElement = item.querySelector(".furniture-item-content .editable");
    const infoElement = item.querySelector(".info-label");
    const name = nameElement.textContent.trim();
    const info = infoElement.textContent.trim();
    const coordsMatch = name.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);

    if (coordsMatch) {
      const x = parseFloat(coordsMatch[1]);
      const y = parseFloat(coordsMatch[2]);
      const z = parseFloat(coordsMatch[3]);

      const vector = new THREE.Vector3(x, y, z);
      vector.clampLength(0, 50); // Scale down if necessary

      const blueSphereGeometry = new THREE.SphereGeometry(1, 16, 16);
      const blueSphereMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
      const blueSphere = new THREE.Mesh(blueSphereGeometry, blueSphereMaterial);
      blueSphere.position.copy(vector);
      scene.add(blueSphere);

      blueSpheresArray.push(blueSphere);
      blueSpheresMap.set(info, blueSphere);
    }
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  });

  // Animation loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }

  // Function inside initializeThreeJS
  function highlightSphere(index, highlight) {
    if (index >= 0 && index < blueSpheresArray.length) {
      const sphere = blueSpheresArray[index];
      sphere.material.color.setHex(highlight ? 0xff0000 : 0x0000ff);
    }
  }

  // Expose the highlightSphere function to the global scope
  window.highlightSphere = highlightSphere;

  animate();
}

// Helper function to normalize vectors (if needed)
function normalizeVector(vector, maxRadius) {
  const length = vector.length();
  if (length === 0) return vector;
  return vector.multiplyScalar(maxRadius / length);
}

// Function to calculate group boundaries
function calculateGroupBoundaries(startIndex, totalItems) {
  const boundaries = [];
  for (let i = startIndex; i < totalItems; i += 5) {
    boundaries.push({
      start: i,
      end: Math.min(i + 4, totalItems - 1),
    });
  }
  return boundaries;
}

// Add this new function to update colors
function updateLabelColors() {
  const items = Array.from(furnitureItems.children);
  const colorMap = new Map();

  items.forEach((item) => {
    const infoLabel = item.querySelector(".info-label");
    const labelText = infoLabel.textContent.trim();
    const match = labelText.match(/(.+?)\s+#(\d+)\s+([AB])/);

    if (match) {
      const [, prefix, number] = match;
      const key = `${prefix}#${number}`;

      if (!colorMap.has(key)) {
        // Check if we already have a color for this key
        if (persistentColorMap.has(key)) {
          colorMap.set(key, persistentColorMap.get(key));
        } else {
          // If not, generate a new color and store it
          const newColor = getRandomColor();
          colorMap.set(key, newColor);
          persistentColorMap.set(key, newColor);
        }
      }

      const color = colorMap.get(key);
      infoLabel.style.borderBottom = `2px solid ${color}`;
    } else {
      infoLabel.style.borderBottom = "none";
    }
  });

  // Update colors in notes content
  const notesContainer = document.getElementById("notesContent");
  if (notesContainer) {
    notesContainer.querySelectorAll(".trigger-link").forEach((link) => {
      const labelText = link.textContent.trim();
      const match = labelText.match(/(.+?)\s+#(\d+)\s+([AB])/);

      if (match) {
        const [, prefix, number] = match;
        const key = `${prefix}#${number}`;
        const color = colorMap.get(key);

        if (color) {
          link.style.borderBottom = `2px solid ${color}`;
        }
      }
    });
  }
}

function getRandomColor() {
  return "#" + Math.floor(Math.random() * 16777215).toString(16);
}

// Add a debounce function to limit the frequency of updates
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

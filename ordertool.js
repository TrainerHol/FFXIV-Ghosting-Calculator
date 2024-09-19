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
  });

  function addFurnitureItem(item = { name: "", info: "" }) {
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

    // Save changes on blur
    itemElement.querySelectorAll(".editable").forEach((element) => {
      element.addEventListener("blur", saveFurnitureItems);
    });

    furnitureItems.appendChild(itemElement);
    saveFurnitureItems(); // Add this line to save when a new item is added
    computeGhostingPairs(); // Added
    updateNotesContent(); // Added
    return itemElement;
  }

  function displayFurnitureItems(items) {
    furnitureItems.innerHTML = "";
    items.forEach((item) => addFurnitureItem(item));
    computeGhostingPairs(); // Added
    updateNotesContent(); // Added
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

    // Remove the dragged item from its original position
    dragSrcEl.remove();

    // Insert the dragged item at its new position
    if (afterMiddle) {
      furnitureItems.insertBefore(dragSrcEl, targetItem.nextSibling);
    } else {
      furnitureItems.insertBefore(dragSrcEl, targetItem);
    }

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
    computeGhostingPairs(); // Added
    updateNotesContent(); // Added
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
      const name = nameElement.innerHTML.trim(); // Use innerHTML instead of textContent
      const info = item.querySelector(".info-label").textContent.trim();
      items.push({ name, info });
    });
    localStorage.setItem("furnitureItems", JSON.stringify(items));
  }

  function loadFurnitureItems() {
    const items = JSON.parse(localStorage.getItem("furnitureItems")) || [];
    displayFurnitureItems(items);
    updateNotesContent(); // Added
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
      bullet1.textContent = `Any items before ${firstItem.trigger}, ${firstItem.name} at (${firstItem.coordinates.x.toFixed(2)}, ${firstItem.coordinates.y.toFixed(2)}, ${firstItem.coordinates.z.toFixed(2)}), will not be affected by ghosting.`;
      notesContainer.appendChild(bullet1);

      // Bullet points for each item in each pair
      pairs.forEach((pair) => {
        const a = pair.a;
        const b = pair.b;

        // Bullet for Trigger A
        const bulletA = document.createElement("li");
        bulletA.innerHTML = `When the player gets to ${a.trigger}, ${a.name} at (${a.coordinates.x.toFixed(2)}, ${a.coordinates.y.toFixed(2)}, ${a.coordinates.z.toFixed(2)}), any items placed after ${b.trigger} including itself will disappear in groups of 5 every tick. <button onclick="console.log('Visualize')">Visualize</button>`;
        notesContainer.appendChild(bulletA);

        // Bullet for Trigger B
        const bulletB = document.createElement("li");
        bulletB.innerHTML = `When the player gets to ${b.trigger}, ${b.name} at (${b.coordinates.x.toFixed(2)}, ${b.coordinates.y.toFixed(2)}, ${b.coordinates.z.toFixed(2)}), any items placed after ${a.trigger} including itself will disappear in groups of 5 every tick. <button onclick="console.log('Visualize')">Visualize</button>`;
        notesContainer.appendChild(bulletB);
      });
    }
  }

  function computeGhostingPairs() {
    pairs = [];
    const items = Array.from(furnitureItems.children)
      .map((item) => {
        const nameText = item.querySelector(".furniture-item-content .editable").textContent;
        const coordsMatch = nameText.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
        if (coordsMatch) {
          return {
            element: item,
            coordinates: {
              x: parseFloat(coordsMatch[1]),
              y: parseFloat(coordsMatch[2]),
              z: parseFloat(coordsMatch[3]),
            },
          };
        }
        return null;
      })
      .filter((item) => item !== null);

    let triggerNumber = 1;
    // Reset existing info labels in each furniture item
    items.forEach((item) => {
      item.element.querySelector(".info-label").textContent = "";
    });

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

          // Assign Trigger labels
          items[i].element.querySelector(".info-label").textContent = triggerA;
          items[j].element.querySelector(".info-label").textContent = triggerB;

          triggerNumber++;
        }
      }
    }

    updateNotesContent(); // Ensure notes are updated after computing pairs
  }

  loadFurnitureItems();

  // Initialize Three.js
  initializeThreeJS();
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

  // Add XYZ axes
  const axesHelper = new THREE.AxesHelper(50);
  scene.add(axesHelper);

  // Add a mesh grid sphere
  const sphereGeometry = new THREE.SphereGeometry(50, 32, 32);
  const sphereMaterial = new THREE.MeshBasicMaterial({ color: 0x002e07, wireframe: true });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  scene.add(sphere);

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

  animate();
}

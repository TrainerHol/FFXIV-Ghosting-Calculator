// Define blueSpheresMap at the global scope
const blueSpheresMap = new Map();

// Define blueSpheresArray at the global scope
const blueSpheresArray = [];

// At the top of your file, add this line to store colors persistently
let persistentColorMap = new Map();

document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const downloadReorderedBtn = document.getElementById("downloadReorderedBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  const clearListBtn = document.getElementById("clearListBtn"); // New button
  const furnitureItems = document.getElementById("furnitureItems");

  const STORAGE_KEYS = {
    furnitureItems: "furnitureItems",
    persistentColorMap: "persistentColorMap",
    makeplaceOriginal: "makeplaceOriginal",
    makeplaceOriginalName: "makeplaceOriginalName",
  };

  // Define pairs list
  let pairs = [];

  function refreshDownloadReorderedButtonState() {
    if (!downloadReorderedBtn) return;
    const rawOriginal = localStorage.getItem(STORAGE_KEYS.makeplaceOriginal);
    const hasOriginal = typeof rawOriginal === "string" && rawOriginal.trim().length > 0;
    downloadReorderedBtn.classList.toggle("is-hidden", !hasOriginal);
    if (!hasOriginal) {
      downloadReorderedBtn.disabled = true;
      return;
    }
    if (!furnitureItems) {
      downloadReorderedBtn.disabled = true;
      return;
    }

    const listItems = Array.from(furnitureItems.querySelectorAll(".furniture-item"));
    const hasItems = listItems.length > 0;
    const allHaveKeys = listItems.every((item) => typeof item.dataset.makeplaceKey === "string" && /^mp-\d+$/.test(item.dataset.makeplaceKey));
    downloadReorderedBtn.disabled = !(hasItems && allHaveKeys);
  }

  function downloadReorderedMakeplace() {
    const rawOriginal = localStorage.getItem(STORAGE_KEYS.makeplaceOriginal);
    if (typeof rawOriginal !== "string" || rawOriginal.trim().length === 0) {
      refreshDownloadReorderedButtonState();
      return;
    }
    if (!furnitureItems) return;

    const listItems = Array.from(furnitureItems.querySelectorAll(".furniture-item"));
    const keys = listItems.map((item) => item.dataset.makeplaceKey);
    const hasInvalidKey = keys.some((key) => typeof key !== "string" || !/^mp-\d+$/.test(key));
    if (hasInvalidKey) {
      alert("Download reordered is only available for lists created from a Makeplace upload. Clear the list and re-upload your Makeplace file.");
      refreshDownloadReorderedButtonState();
      return;
    }

    let original;
    try {
      original = JSON.parse(rawOriginal);
    } catch {
      alert("Saved Makeplace data is invalid. Please re-upload your Makeplace file.");
      localStorage.removeItem(STORAGE_KEYS.makeplaceOriginal);
      localStorage.removeItem(STORAGE_KEYS.makeplaceOriginalName);
      refreshDownloadReorderedButtonState();
      return;
    }

    if (!original || !Array.isArray(original.interiorFurniture)) {
      alert("This does not look like a Makeplace file (missing interiorFurniture). Please re-upload a valid Makeplace JSON.");
      return;
    }

    const originalInterior = original.interiorFurniture;
    if (keys.length !== originalInterior.length) {
      alert("The current list does not match the uploaded Makeplace interiorFurniture count. Clear the list and re-upload your Makeplace file.");
      refreshDownloadReorderedButtonState();
      return;
    }

    const used = new Set();
    const reorderedInterior = [];
    for (const key of keys) {
      const index = Number.parseInt(key.slice("mp-".length), 10);
      if (!Number.isFinite(index) || index < 0 || index >= originalInterior.length) {
        alert("Reorder mapping is invalid. Clear the list and re-upload your Makeplace file.");
        refreshDownloadReorderedButtonState();
        return;
      }
      if (used.has(index)) {
        alert("Reorder mapping contains duplicates. Clear the list and re-upload your Makeplace file.");
        refreshDownloadReorderedButtonState();
        return;
      }
      used.add(index);
      reorderedInterior.push(originalInterior[index]);
    }

    const output = { ...original, interiorFurniture: reorderedInterior };
    const jsonString = JSON.stringify(output, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const originalName = localStorage.getItem(STORAGE_KEYS.makeplaceOriginalName);
    const baseName = typeof originalName === "string" && originalName.trim().length > 0 ? originalName.trim() : "makeplace.json";
    const downloadName = baseName.replace(/\.json$/i, "") + "-reordered.json";

    const a = document.createElement("a");
    a.href = url;
    a.download = downloadName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (downloadReorderedBtn) {
    downloadReorderedBtn.addEventListener("click", downloadReorderedMakeplace);
  }

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
      const fileName = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const rawText = typeof e.target.result === "string" ? e.target.result : "";
          const jsonData = JSON.parse(rawText);
          processMakeplaceFile(jsonData, { rawText, fileName });
        } catch (error) {
          console.error("Error parsing JSON file:", error);
          alert("Error parsing JSON file. Please make sure it's a valid Makeplace file.");
        }
      };
      reader.readAsText(file);
    }
  }

  function processMakeplaceFile(data, { rawText, fileName } = {}) {
    if (typeof rawText === "string" && rawText.trim().length > 0) {
      localStorage.setItem(STORAGE_KEYS.makeplaceOriginal, rawText);
    }
    if (typeof fileName === "string" && fileName.trim().length > 0) {
      localStorage.setItem(STORAGE_KEYS.makeplaceOriginalName, fileName);
    }
    refreshDownloadReorderedButtonState();

    furnitureItems.innerHTML = ""; // Clear existing items
    const items = [];

    // Process interiorFurniture
    if (data.interiorFurniture) {
      data.interiorFurniture.forEach((item, index) => {
        items.push({ ...createItemFromMakeplaceData(item), makeplaceKey: `mp-${index}` });
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
    localStorage.removeItem(STORAGE_KEYS.makeplaceOriginal);
    localStorage.removeItem(STORAGE_KEYS.makeplaceOriginalName);
    refreshDownloadReorderedButtonState();
    saveFurnitureItems();
    computeGhostingPairs();
    updateNotesContent();
  });

  function addFurnitureItem(item = { name: "", info: "", coordinates: { x: 0, y: 0, z: 0 }, makeplaceKey: undefined }) {
    // Ensure coordinates exist
    item.coordinates = item.coordinates || { x: 0, y: 0, z: 0 };

    const itemElement = document.createElement("div");
    itemElement.className = "furniture-item";
    itemElement.innerHTML = `
      <div class="furniture-item-content">
        <div class="editable" contenteditable="true">${item.name || "Edit Name"}</div>
      </div>
      <div class="info-label-container">
        <div class="info-label editable" contenteditable="true">${item.info || ""}</div>
      </div>
    `;

    // Set dataset attributes for coordinates
    itemElement.dataset.x = item.coordinates.x;
    itemElement.dataset.y = item.coordinates.y;
    itemElement.dataset.z = item.coordinates.z;
    if (typeof item.makeplaceKey === "string" && item.makeplaceKey.trim().length > 0) {
      itemElement.dataset.makeplaceKey = item.makeplaceKey;
    }

    // Save changes and update colors on blur
    itemElement.querySelectorAll(".editable").forEach((element) => {
      element.setAttribute("draggable", "false");
      element.addEventListener("dragstart", (event) => event.preventDefault());
      element.addEventListener("dragover", (event) => event.preventDefault());
      element.addEventListener("drop", (event) => event.preventDefault());
      element.addEventListener("blur", () => {
        saveFurnitureItems();
        updateLabelColors();
        computeGhostingPairs(); // Add this line to update pairs and notes
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

  function initFurnitureReorder() {
    const state = {
      pointerId: null,
      startX: 0,
      startY: 0,
      offsetX: 0,
      offsetY: 0,
      dragging: false,
      dragItem: null,
      placeholder: null,
      startedInEditable: false,
    };

    const thresholdPx = 8;

    function clearSelection() {
      const selection = window.getSelection && window.getSelection();
      if (selection && typeof selection.removeAllRanges === "function") {
        selection.removeAllRanges();
      }
    }

    function stopReorder() {
      furnitureItems.classList.remove("is-reordering");

      if (state.dragItem) {
        state.dragItem.classList.remove("is-dragging");
        state.dragItem.style.position = "";
        state.dragItem.style.left = "";
        state.dragItem.style.top = "";
        state.dragItem.style.width = "";
        state.dragItem.style.zIndex = "";
        state.dragItem.style.pointerEvents = "";
      }

      if (state.placeholder && state.dragItem) {
        state.placeholder.replaceWith(state.dragItem);
      }

      state.pointerId = null;
      state.dragging = false;
      state.dragItem = null;
      state.placeholder = null;
    }

    function finalizeDrop() {
      stopReorder();
      saveFurnitureItems();
      computeGhostingPairs();
      updateNotesContent();
      initializeThreeJS();
      removeSeparators();
      updateLabelColors();
    }

    function movePlaceholder(clientY) {
      const items = Array.from(furnitureItems.querySelectorAll(".furniture-item")).filter((item) => item !== state.dragItem);
      const beforeItem = items.find((item) => {
        const rect = item.getBoundingClientRect();
        return clientY < rect.top + rect.height / 2;
      });

      if (beforeItem) {
        if (state.placeholder.nextSibling !== beforeItem) {
          furnitureItems.insertBefore(state.placeholder, beforeItem);
        }
        return;
      }

      if (state.placeholder.parentElement === furnitureItems && state.placeholder.nextSibling !== null) {
        furnitureItems.appendChild(state.placeholder);
      }
    }

    function beginDrag(item, pointerEvent) {
      state.dragItem = item;
      state.dragging = true;

      const active = document.activeElement;
      if (active && typeof active.blur === "function") {
        active.blur();
      }
      clearSelection();

      const rect = item.getBoundingClientRect();
      state.offsetX = pointerEvent.clientX - rect.left;
      state.offsetY = pointerEvent.clientY - rect.top;

      const placeholder = document.createElement("div");
      placeholder.className = "reorder-placeholder";
      placeholder.style.height = `${rect.height}px`;
      const computed = window.getComputedStyle(item);
      placeholder.style.marginBottom = computed.marginBottom;

      state.placeholder = placeholder;
      furnitureItems.classList.add("is-reordering");
      furnitureItems.insertBefore(placeholder, item.nextSibling);

      item.classList.add("is-dragging");
      item.style.position = "fixed";
      item.style.left = `${rect.left}px`;
      item.style.top = `${rect.top}px`;
      item.style.width = `${rect.width}px`;
      item.style.zIndex = "1000";
      item.style.pointerEvents = "none";

      if (typeof furnitureItems.setPointerCapture === "function") {
        furnitureItems.setPointerCapture(pointerEvent.pointerId);
      }
    }

    furnitureItems.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const item = e.target.closest(".furniture-item");
      if (!item) return;

      state.pointerId = e.pointerId;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.dragItem = item;
      state.dragging = false;
      state.startedInEditable = Boolean(e.target.closest(".editable"));

      if (!state.startedInEditable) {
        e.preventDefault();
      }
    });

    furnitureItems.addEventListener("pointermove", (e) => {
      if (state.pointerId === null || e.pointerId !== state.pointerId) return;
      if (!state.dragItem) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (!state.dragging) {
        if (Math.hypot(dx, dy) < thresholdPx) return;
        beginDrag(state.dragItem, e);
      }

      e.preventDefault();
      state.dragItem.style.left = `${e.clientX - state.offsetX}px`;
      state.dragItem.style.top = `${e.clientY - state.offsetY}px`;
      movePlaceholder(e.clientY);
    });

    function endPointer(e) {
      if (state.pointerId === null || e.pointerId !== state.pointerId) return;
      if (!state.dragging) {
        state.pointerId = null;
        state.dragItem = null;
        return;
      }

      e.preventDefault();
      finalizeDrop();
    }

    furnitureItems.addEventListener("pointerup", endPointer);
    furnitureItems.addEventListener("pointercancel", (e) => {
      if (state.pointerId === null || e.pointerId !== state.pointerId) return;
      e.preventDefault();
      stopReorder();
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
      const makeplaceKey = typeof item.dataset.makeplaceKey === "string" ? item.dataset.makeplaceKey : undefined;
      items.push({ name, info, coordinates: { x, y, z }, makeplaceKey });
    });
    localStorage.setItem(STORAGE_KEYS.furnitureItems, JSON.stringify(items));

    // Save the persistent color map
    localStorage.setItem(STORAGE_KEYS.persistentColorMap, JSON.stringify(Array.from(persistentColorMap.entries())));

    // Reinitialize Three.js scene to update blue spheres
    initializeThreeJS();

    // Update colors after saving
    updateLabelColors();
    refreshDownloadReorderedButtonState();
  }

  function loadFurnitureItems() {
    const items = JSON.parse(localStorage.getItem(STORAGE_KEYS.furnitureItems)) || [];
    // All items have coordinates
    const updatedItems = items.map((item) => ({
      ...item,
      coordinates: item.coordinates || { x: 0, y: 0, z: 0 },
    }));
    displayFurnitureItems(updatedItems);
    updateNotesContent();
    updateLabelColors();

    // Load the persistent color map
    const savedColorMap = localStorage.getItem(STORAGE_KEYS.persistentColorMap);
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
      bullet1.innerHTML += `, ${firstItem.name} , will not be affected by ghosting.`;
      notesContainer.appendChild(bullet1);

      // Bullet points for each item in each pair
      pairs.forEach((pair) => {
        const a = pair.a;
        const b = pair.b;

        // Bullet for Trigger A
        const bulletA = createTriggerBullet(a, b);
        notesContainer.appendChild(bulletA);

        // Bullet for Trigger B
        const bulletB = createTriggerBullet(b, a);
        notesContainer.appendChild(bulletB);
      });
    }

    // Add event listeners after content is added to the DOM
    addTriggerLinkListeners();

    // Update colors in notes content
    updateLabelColors();
  }

  function createTriggerBullet(trigger, otherTrigger) {
    const bullet = document.createElement("li");

    const triggerLink = createTriggerLink(trigger.trigger);

    bullet.appendChild(document.createTextNode(`When the player gets to `));
    bullet.appendChild(triggerLink);
    bullet.innerHTML += `, ${trigger.name} , any items placed after `;

    const otherTriggerLink = createTriggerLink(otherTrigger.trigger);

    bullet.appendChild(otherTriggerLink);
    bullet.innerHTML += ` including itself will disappear in groups of 5 every tick. <button class="visualize-btn" onclick="visualizeDisappearance('${trigger.trigger}', '${otherTrigger.trigger}')">Visualize</button>`;

    return bullet;
  }

  function createTriggerLink(triggerText) {
    const triggerLink = document.createElement("button");
    triggerLink.className = "trigger-link";
    triggerLink.textContent = triggerText;
    triggerLink.addEventListener("click", () => scrollToTrigger(triggerText));
    return triggerLink;
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

    // Add user-defined trigger logic
    const userTriggers = new Map();
    items.forEach((item) => {
      if (/trigger/i.test(item.customInfo)) {
        const match = item.customInfo.match(/(.+?)\s*#(\d+)\s*([AB])/i);
        if (match) {
          const [, prefix, number, suffix] = match;
          const key = `${prefix.trim()} #${number}`;
          if (!userTriggers.has(key)) {
            userTriggers.set(key, { A: null, B: null });
          }
          if (!userTriggers.get(key)[suffix]) {
            userTriggers.get(key)[suffix] = item;
          }
        }
      }
    });

    // Add user-defined trigger pairs
    userTriggers.forEach((pair, key) => {
      if (pair.A && pair.B) {
        pairs.push({
          a: {
            ...pair.A,
            trigger: `${key} A`,
            name: pair.A.element.querySelector(".furniture-item-content .editable").textContent.trim(),
          },
          b: {
            ...pair.B,
            trigger: `${key} B`,
            name: pair.B.element.querySelector(".furniture-item-content .editable").textContent.trim(),
          },
        });
      }
    });

    updateNotesContent(); // Ensure notes are updated after computing pairs
  }

  loadFurnitureItems();
  refreshDownloadReorderedButtonState();
  initFurnitureReorder();

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

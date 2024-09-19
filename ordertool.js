document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  const clearListBtn = document.getElementById("clearListBtn"); // New button
  const furnitureItems = document.getElementById("furnitureItems");
  const infoLabels = document.getElementById("infoLabels");

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
    const colorSpan = color ? `<span style="display:inline-block;width:1em;height:1em;background-color:#${color};"></span>` : "";
    return { name: `${name} ${colorSpan}`, info: "" };
  }

  addItemBtn.addEventListener("click", () => {
    addFurnitureItem();
  });

  clearListBtn.addEventListener("click", () => {
    furnitureItems.innerHTML = "";
    saveFurnitureItems(); // This line is correct, but let's make sure it's working
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
    return itemElement;
  }

  function updateInfoLabels() {
    infoLabels.innerHTML = "";
    furnitureItems.querySelectorAll(".furniture-item").forEach((item, index) => {
      const infoLabelContainer = document.createElement("div");
      infoLabelContainer.className = "info-label-container";
      infoLabelContainer.innerHTML = `
        <div class="arrow"></div>
        <div class="info-label editable" contenteditable="true">${item.querySelector(".furniture-item-content .editable").textContent}</div>
      `;
      infoLabels.appendChild(infoLabelContainer);

      // Save changes on blur
      infoLabelContainer.querySelector(".editable").addEventListener("blur", saveFurnitureItems);
    });
  }

  function displayFurnitureItems(items) {
    furnitureItems.innerHTML = "";
    items.forEach((item) => addFurnitureItem(item));
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

    saveFurnitureItems(); // This line is correct, but let's make sure it's working
    return false;
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
    updateInfoLabels();
  }

  function updateInfoLabelsOrder(fromIndex, toIndex) {
    const infoLabelContainers = Array.from(infoLabels.querySelectorAll(".info-label-container"));
    const movedLabel = infoLabelContainers[fromIndex];

    if (fromIndex < toIndex) {
      infoLabels.insertBefore(movedLabel, infoLabelContainers[toIndex + 1]);
    } else {
      infoLabels.insertBefore(movedLabel, infoLabelContainers[toIndex]);
    }
  }

  loadFurnitureItems();
});

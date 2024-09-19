document.addEventListener("DOMContentLoaded", () => {
  const uploadBtn = document.getElementById("uploadBtn");
  const addItemBtn = document.getElementById("addItemBtn");
  const clearListBtn = document.getElementById("clearListBtn"); // New button
  const furnitureItems = document.getElementById("furnitureItems");
  const infoLabels = document.getElementById("infoLabels");

  uploadBtn.addEventListener("click", () => {
    // Simulating file upload and processing
    setTimeout(() => {
      // ... existing code ...
      loadFurnitureItems();
    }, 1000);
  });

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
        <div class="arrow"></div>
        <div class="info-label editable" contenteditable="true">${item.info || "Edit Info"}</div>
      </div>
    `;
    addDragAndDropHandlers(itemElement);

    // Save changes on blur
    itemElement.querySelectorAll(".editable").forEach((element) => {
      element.addEventListener("blur", saveFurnitureItems);
    });

    furnitureItems.appendChild(itemElement);
  }

  function updateInfoLabels() {
    infoLabels.innerHTML = "";
    furnitureItems.querySelectorAll(".furniture-item").forEach((item, index) => {
      const infoLabelContainer = document.createElement("div");
      infoLabelContainer.className = "info-label-container";
      infoLabelContainer.innerHTML = `
        <div class="arrow"></div>
        <div class="info-label editable" contenteditable="true">${item.querySelector(".editable").textContent}</div>
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

  function handleDragStart(e) {
    dragSrcEl = this;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", this.innerHTML);
    this.classList.add("dragging");
  }

  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault();
    }
    e.dataTransfer.dropEffect = "move";
    return false;
  }

  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }
    if (dragSrcEl !== this) {
      const allItems = Array.from(furnitureItems.querySelectorAll(".furniture-item"));
      const fromIndex = allItems.indexOf(dragSrcEl);
      const toIndex = allItems.indexOf(this);

      // Swap the HTML content
      dragSrcEl.innerHTML = this.innerHTML;
      this.innerHTML = e.dataTransfer.getData("text/html");

      // Reattach event listeners after swapping
      addDragAndDropHandlers(dragSrcEl);
      addDragAndDropHandlers(this);

      // Update info labels order
      updateInfoLabelsOrder(fromIndex, toIndex);

      // Save the updated order
      saveFurnitureItems();
    }
    return false;
  }

  function handleDragEnd() {
    // Optional: add visual feedback
    this.classList.remove("dragging");
  }

  function saveFurnitureItems() {
    const items = [];
    furnitureItems.querySelectorAll(".furniture-item").forEach((item, index) => {
      const name = item.querySelector(".furniture-item-content .editable").textContent.trim();
      const info = item.querySelector(".info-label").textContent.trim();
      if (name && info) {
        // Ensure both fields are filled
        items.push({ name, info });
      }
    });
    sessionStorage.setItem("furnitureItems", JSON.stringify(items));
  }

  function loadFurnitureItems() {
    const items = JSON.parse(sessionStorage.getItem("furnitureItems")) || [];
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

// Global variable definitions
let modelIndex = 0;
let videoEntity = null;
let frameEntity = null;
let lookImages = [];
let mediaEntity = null;
let fixedAngleDegrees = 0;
let currentZoom = 25; // Initial distance from the user
let currentY = 0; // Initial Y position
let initialMediaState = {
    position: null,
    rotation: null
};
let hasPopupShown = false; // congrats popup
let hasPopupClosed = false;
let currentLocationIndex = 0;
let locations = []; // This will be filled with the keys from mediaConfig.json
let mediaArray = []; // Current media array for the location

// User's current geographical location
const userCoordinates = {
    latitude: 51.514610192480845,
    longitude: -0.08297110217948206
};

const minZoom = 10; // Minimum distance from the user
const maxZoom = 100; // Maximum distance from the user
const minY = -15; // Set minimum Y value
const maxY = 20; // Set maximum Y value
const zoomSpeed = 0.01; // Adjust the zoom speed as needed
const dragSpeedX = 0.07; // Adjust the drag speed for the x-axis
const dragSpeedY = 0.005; // Adjust the drag speed for the y-axis

// Pinch-to-zoom variables
let initialPinchDistance = null;
let isPinching = false; // Flag to indicate if a pinch-to-zoom gesture is in progress

// Drag functionality variables
let isDragging = false;
let initialTouchX = null;
let initialTouchY = null;
let initialFixedAngle = 0;
let dragAxis = null; // 'x' for rotation, 'y' for vertical movement

let currentAudio = null; // Keep track of the current playing audio
let isChangingMedia = false; // Flag to prevent repeated calls
let isFirstLoad = true; // Global flag to check if it's the first load

let currentFixedAngleDisplay;
let currentYPositionDisplay;
let currentZDepthDisplay;

function saveAngle(location, angle) {
    const savedAngles = JSON.parse(localStorage.getItem('savedAngles')) || {};
    savedAngles[location] = angle;
    localStorage.setItem('savedAngles', JSON.stringify(savedAngles));
}

function refreshMediaPosition() {
    if (mediaEntity) {
        const mediaItem = mediaArray[modelIndex];
        const fixedAngleDegrees = mediaItem.fixedAngleDegrees || 0;

        const radians = (fixedAngleDegrees * Math.PI) / 180;
        currentZoom = 25;  // Reset zoom
        currentY = 0;      // Reset Y position

        const position = {
            x: -currentZoom * Math.sin(radians),
            y: currentY,
            z: -currentZoom * Math.cos(radians)
        };
        const rotation = { x: 0, y: fixedAngleDegrees, z: 0 };

        initialMediaState.position = { ...position };
        initialMediaState.rotation = { ...rotation };

        mediaEntity.setAttribute("position", position);
        mediaEntity.setAttribute("rotation", rotation);

        if (frameEntity) {
            frameEntity.setAttribute("position", position);
            frameEntity.setAttribute("rotation", rotation);
        }

        removeAllMedia();
        loadLocationMedia();

        updateCurrentValues();
    }
}

// Haversine formula for calculating distance between two coordinates
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance;
}

// Function to convert bearing and distance into Cartesian coordinates
function toCartesianCoordinates(distance, bearing) {
    const bearingRad = bearing * Math.PI / 180;
    // Flip the x-coordinate to make the image positions consistent
    const x = -distance * Math.sin(bearingRad); // Flip x
    const z = distance * Math.cos(bearingRad);  // Keep z as is
    return { x, z };
}


// Function to calculate the bearing
function calculateBearing(lat1, lon1, lat2, lon2) {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return (bearing + 360) % 360;
}

function updateLookImages() {
    lookImages.forEach((lookImage, index) => {
        const angle = (index + 1) * 90;
        const lookRadians = ((fixedAngleDegrees + angle) * Math.PI) / 180;
        const lookX = -currentZoom * Math.sin(lookRadians);
        const lookZ = -currentZoom * Math.cos(lookRadians);

        lookImage.setAttribute("position", { x: lookX, y: 0, z: lookZ });
        lookImage.setAttribute("rotation", { x: 0, y: angle + fixedAngleDegrees, z: 0 });
    });
}

function toggleMuteButton(isMuted) {
    const buttonText = isMuted ? "Unmute" : "Mute";
    const buttonIcon = isMuted ? "./assets/images/UI/unmute-icon.svg" : "./assets/images/UI/mute-icon.svg";
    const muteButton = document.getElementById("mute");

    muteButton.innerHTML = `<img src="${buttonIcon}" alt="${buttonText} button" class="button-icon"> ${buttonText}`;
}

// Congrats page pop up
function showCongratulationsPopup() {
    if (!hasPopupShown && !hasPopupClosed) {
        const popup = document.getElementById('congratulations-overlay');
        popup.style.display = 'flex';
        hasPopupShown = true;
    }
}

function closeCongratsPopup() {
    const popup = document.getElementById('congratulations-overlay');
    popup.style.display = 'none';
    hasPopupClosed = true;
}

function loadNextLocation() {
    modelIndex = 0;
    currentLocationIndex = (currentLocationIndex + 1) % locations.length;
    loadLocationMedia();
}

function loadPreviousLocation() {
    modelIndex = 0;
    currentLocationIndex = (currentLocationIndex - 1 + locations.length) % locations.length;
    loadLocationMedia();
}

function loadLocationMedia() {
    fetch("./Scripts/mediaConfig.json")
        .then((response) => response.json())
        .then((data) => {
            hasPopupShown = false;
            const locationData = data[locations[currentLocationIndex]];
            const commonValues = locationData.common;
            mediaArray = locationData.media;
            modelIndex = 0;
            fixedAngleDegrees = commonValues.fixedAngleDegrees || 0;
            const radians = (fixedAngleDegrees * Math.PI) / 180;
            initialMediaState.position = { x: -currentZoom * Math.sin(radians), y: commonValues.initialY, z: commonValues.initialZ };
            initialMediaState.rotation = { x: 0, y: fixedAngleDegrees, z: 0 };

            initializeMedia(mediaArray, commonValues);
        })
        .catch((error) => console.error("Error loading media config:", error));
}

function navigateToLocation(locationId) {
    currentLocationIndex = locations.indexOf(locationId);
    if (currentLocationIndex === -1) {
        console.error("Invalid location specified");
        return;
    }
    loadLocationMedia();
}

// Initialize AR
function initializeAR() {
    fetch("./Scripts/mediaConfig.json")
        .then((response) => response.json())
        .then((data) => {
            locations = Object.keys(data); // Get all location keys (location1, location2, etc.)
            locations.forEach((locationId) => {
                const locationData = data[locationId];
                const commonValues = locationData.common;
                const targetLat = commonValues.latitude;
                const targetLon = commonValues.longitude;

                // Loop through each media item and position it based on latitude and longitude
                locationData.media.forEach((mediaItem) => {
                    // Load only image type media
                    if (mediaItem.type === "image") {
                        // Calculate distance and bearing
                        const distance = haversineDistance(userCoordinates.latitude, userCoordinates.longitude, targetLat, targetLon);
                        const bearing = calculateBearing(userCoordinates.latitude, userCoordinates.longitude, targetLat, targetLon);

                        // Adjust the bearing by adding 180 degrees to flip the orientation
                        const adjustedBearing = bearing + 90; // Flip the bearing

                        const { x, z } = toCartesianCoordinates(distance * 100, adjustedBearing); // Convert km to meters if needed

                        // Position the media based on calculated coordinates
                        const position = { x: x, y: commonValues.initialY || 0, z: z };
                        
                        // Set the rotation to ensure the image faces the camera
                        const rotation = { x: 0, y: 0, z: 0 }; // Keep the rotation aligned with the camera

                        console.log(`Placing ${mediaItem.url} at position:`, position); // Log for debugging
                        displayMedia(mediaItem, 0, commonValues, position, rotation); // Use 0 for index as you are not tracking individual media
                    }
                });
            });
        })
        .catch((error) => console.error("Error loading media config:", error));
}







function updateFixedAngleDegrees(newAngle) {
    fixedAngleDegrees = newAngle;
    saveAngle(locations[currentLocationIndex], newAngle);

    const radians = (fixedAngleDegrees * Math.PI) / 180;
    const x = -currentZoom * Math.sin(radians);
    const z = -currentZoom * Math.cos(radians);

    if (mediaEntity) {
        mediaEntity.setAttribute('position', { x, y: currentY, z });
        mediaEntity.setAttribute('rotation', `0 ${fixedAngleDegrees} 0`);
    }

    if (frameEntity) {
        frameEntity.setAttribute('position', { x, y: currentY, z });
        frameEntity.setAttribute('rotation', `0 ${fixedAngleDegrees} 0`);
    }

    updateLookImages();
    updateCurrentValues();
}

document.addEventListener("DOMContentLoaded", function() {
    const urlParams = new URLSearchParams(window.location.search);
    const isSetupMode = urlParams.get("setup") === "true";
    const fixedAngleInput = document.getElementById('fixed-angle');
    const updateAngleButton = document.getElementById('update-angle');
    const controlsDiv = document.getElementById('controls');

    currentFixedAngleDisplay = document.getElementById('current-fixed-angle');
    currentYPositionDisplay = document.getElementById('current-y-position');
    currentZDepthDisplay = document.getElementById('current-z-depth');

    if (isSetupMode) {
        controlsDiv.style.display = 'block';
    }

    updateAngleButton.addEventListener('click', () => {
        const newAngle = parseInt(fixedAngleInput.value, 10);
        if (!isNaN(newAngle)) {
            updateFixedAngleDegrees(newAngle);
        }
    });

    const arScene = document.getElementById('ar-scene');
    initializeAR();

    const closePopupButton = document.getElementById('close-congrats-overlay');
    if (closePopupButton) {
        closePopupButton.addEventListener('click', closeCongratsPopup);
    }

    const viewMapButton = document.getElementById("view-map");
    const helpButton = document.getElementById("help");
    const refreshButton = document.getElementById("refresh");

    if (viewMapButton) {
        viewMapButton.addEventListener("click", () => {
        });
    }

    if (helpButton) {
        helpButton.addEventListener("click", () => {
            const helpOverlay = document.getElementById("help-overlay");
            if (helpOverlay) {
                helpOverlay.style.display = "flex";
            }
        });
    }

    if (refreshButton) {
        refreshButton.addEventListener("click", () => {
            refreshMediaPosition();
        });
    }

    const mapOverlay = document.getElementById('map-overlay');
    const closeMapOverlayButton = document.getElementById('close-map-overlay');

    if (viewMapButton && closeMapOverlayButton) {
        viewMapButton.addEventListener('click', () => {
            if (mapOverlay) {
                mapOverlay.style.display = 'flex';
            }
        });

        closeMapOverlayButton.addEventListener('click', () => {
            if (mapOverlay) {
                mapOverlay.style.display = 'none';
            }
        });
    }

    const closeHelpOverlayButton = document.getElementById("close-help-overlay");

    if (helpButton && closeHelpOverlayButton) {
        helpButton.addEventListener("click", () => {
            const helpOverlay = document.getElementById("help-overlay");
            if (helpOverlay) {
                helpOverlay.style.display = "flex";
            }
        });

        closeHelpOverlayButton.addEventListener("click", () => {
            const helpOverlay = document.getElementById("help-overlay");
            if (helpOverlay) {
                helpOverlay.style.display = 'none';
            }
        });
    }

    const continueButton = document.getElementById('continue-button');
    const backButton = document.getElementById('back-button');

    if (continueButton) {
        continueButton.addEventListener('click', () => {
            loadNextLocation();
            document.getElementById('congratulations-overlay').style.display = 'none';
        });
    }

    if (backButton) {
        backButton.addEventListener('click', () => {
            loadPreviousLocation();
            document.getElementById('congratulations-overlay').style.display = 'none';
        });
    }

    document
        .querySelectorAll(".button-text, h1-1, h1-2, h2, p, button")
        .forEach((el) => el.classList.add("unselectable"));
});

function removeAllMedia() {
    let scene = document.querySelector("a-scene");

    let mediaElements = scene.querySelectorAll('a-image, a-video, a-audio');
    mediaElements.forEach(element => {
        if (element.tagName === 'A-VIDEO') {
            element.pause();
            element.currentTime = 0;
        }
        element.parentNode.removeChild(element);
    });

    if (currentAudio) {
        currentAudio.pause();
        document.body.removeChild(currentAudio);
        currentAudio = null;
    }

    mediaEntity = null;
    videoEntity = null;
}

function checkOrientation() {
    const orientationOverlay = document.getElementById('orientation-overlay');
    if (window.innerHeight < window.innerWidth) {
        orientationOverlay.style.display = 'flex';
    } else {
        orientationOverlay.style.display = 'none';
    }
}

window.addEventListener('resize', checkOrientation);
window.addEventListener('orientationchange', checkOrientation);
window.addEventListener('DOMContentLoaded', checkOrientation);

function initializeMedia(mediaArray, commonValues) {
    const button = document.querySelector('button[data-action="change"]');

    // Clear previous button text
    const existingButtonText = document.querySelector('.button-text');
    if (existingButtonText) {
        existingButtonText.remove();
    }

    const buttonText = document.createElement("div");
    buttonText.className = "button-text";
    button.insertAdjacentElement("beforebegin", buttonText);

    // Remove old event listeners
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);

    // Add new event listener for changing media
    newButton.addEventListener("click", () => {
        changeMedia(mediaArray, commonValues); // Pass the mediaArray to changeMedia function
    });

    // Loop through the mediaArray to display all media items
    mediaArray.forEach((mediaItem, index) => {
        displayMedia(mediaArray, index, commonValues); // Pass mediaArray, index, and commonValues to displayMedia
    });
}

// Function to display media
function displayMedia(mediaItem, index, commonValues, currentPosition, currentRotation) {
    let scene = document.querySelector("a-scene");

    // Create the entity for the image
    let entity = document.createElement("a-image");

    // Set the media URL for the image
    entity.setAttribute("src", mediaItem.url);

    // Add the 'clickable' class to make the image detectable by the raycaster
    entity.classList.add('clickable');

    // Set the scale exactly as defined in the mediaConfig.json
    let scaleComponents = commonValues.scale.split(' ').map(Number);
    entity.setAttribute("scale", `${scaleComponents[0]} ${scaleComponents[1]} ${scaleComponents[2]}`);

    // Set the position and rotation of the entity based on the mediaConfig.json values
    entity.setAttribute("position", currentPosition);
    entity.setAttribute("rotation", currentRotation);
    entity.setAttribute("visible", "true");

    // Add the entity to the scene
    scene.appendChild(entity);

    // Change color on hover
    entity.addEventListener('raycaster-intersected', function () {
        console.log('Image intersected:', mediaItem.url);
        entity.setAttribute('material', 'color', 'green');  // Change color on hover

        // Show the modal with the CTA link
        const modal = document.getElementById('cta-modal');
        const ctaLink = document.getElementById('cta-link');

        // Set the link URL
        if (mediaItem.link) {
            ctaLink.href = mediaItem.link;
            ctaLink.textContent = mediaItem.link; // Optionally display the link text
        } else {
            ctaLink.href = '#';
            ctaLink.textContent = 'No link available';
        }

        // Display the modal
        modal.style.display = 'flex';
    });

    // Reset color on exit
    entity.addEventListener('raycaster-intersected-cleared', function () {
        console.log('Image no longer intersected:', mediaItem.url);
        entity.setAttribute('material', 'color', 'white');  // Reset color
    });
}





function updateImagesFacingCamera() {
    const images = document.querySelectorAll('a-image');
    const camera = document.getElementById('camera');

    images.forEach(image => {
        const imagePosition = image.getAttribute('position');
        const cameraPosition = camera.getAttribute('position');

        // Calculate the direction vector from the image to the camera
        const direction = {
            x: cameraPosition.x - imagePosition.x,
            y: cameraPosition.y - imagePosition.y,
            z: cameraPosition.z - imagePosition.z
        };

        // Normalize the direction vector and convert it to rotation
        const rotation = Math.atan2(direction.x, direction.z) * (180 / Math.PI);
        image.setAttribute('rotation', { x: 0, y: rotation, z: 0 });
    });
}

// Call this function in your animation loop or on a tick event
setInterval(updateImagesFacingCamera, 100); // Update every 100ms


// Close modal when clicking on the 'X' button
document.getElementById('close-cta-modal').addEventListener('click', function() {
    document.getElementById('cta-modal').style.display = 'none';
});

// Optional: Close modal when clicking outside of the modal content
window.addEventListener('click', function(event) {
    const modal = document.getElementById('cta-modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
});

function fadeOutElement(element) {
    element.setAttribute("animation", {
        property: "opacity",
        to: 0,
        dur: 2000,
        easing: "easeInOutQuad",
        startEvents: "startFadeOut",
    });

    element.addEventListener("animationcomplete", () => {
        element.parentNode.removeChild(element);
    });

    element.emit("startFadeOut");
}

function changeMedia(mediaArray, commonValues) {
    if (isChangingMedia) {
        return;
    }
    isChangingMedia = true;

    // Preserve current position and rotation
    const currentPosition = mediaEntity.getAttribute("position");
    const currentRotation = mediaEntity.getAttribute("rotation");

    // Update modelIndex to the next media element in the array
    modelIndex = (modelIndex + 1) % mediaArray.length;

    // Display the new media element while preserving the position and rotation
    displayMedia(mediaArray, modelIndex, commonValues, currentPosition, currentRotation);

    // Ensure any audio is handled correctly
    if (currentAudio) {
        if (currentAudio.paused) {
            currentAudio.muted = false; // Ensure the audio is unmuted
            currentAudio.play().catch(error => {
            });
        } else {
            currentAudio.pause();
        }
    }

    // Reset the flag after a delay to allow further media changes
    setTimeout(() => {
        isChangingMedia = false;
    }, 1000); // Adjust the timeout as needed

    // Show the congratulations pop-up after a short delay for testing
    setTimeout(showCongratulationsPopup, 60000); // Set to 0 for immediate testing
}

function createLookImages() {
    let scene = document.querySelector("a-scene");

    lookImages.forEach((lookImage) => {
        if (lookImage.parentNode) {
            lookImage.parentNode.removeChild(lookImage);
        }
    });
    lookImages = [];

    const angles = [90, 180, 270];
    angles.forEach((angle) => {
        const radians = ((fixedAngleDegrees + angle) * Math.PI) / 180;
        const lookX = -currentZoom * Math.sin(radians);
        const lookZ = -currentZoom * Math.cos(radians);

        const lookImage = document.createElement("a-image");
        lookImage.setAttribute("src", "./assets/images/UI/look-for1.png");
        lookImage.setAttribute("position", { x: lookX, y: 0, z: lookZ });
        lookImage.setAttribute("rotation", {
            x: 0,
            y: angle + fixedAngleDegrees,
            z: 0,
        });
        lookImage.setAttribute("scale", "14 4 1");
        lookImage.setAttribute("visible", "true");
        scene.appendChild(lookImage);
        lookImages.push(lookImage);
    });
}

function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

function isAndroid() {
    return /Android/.test(navigator.userAgent);
}

document.addEventListener("touchstart", function (e) {
    e.preventDefault(); // Prevent default touch actions
    if (e.touches.length === 2) {
        initialPinchDistance = getPinchDistance(e);
        isPinching = true; // Set the flag to indicate a pinch gesture
    } else if (e.touches.length === 1) {
        isDragging = true;
        initialTouchX = e.touches[0].pageX;
        initialTouchY = e.touches[0].pageY;
        initialFixedAngle = fixedAngleDegrees;
        currentY = mediaEntity.getAttribute("position").y;
        dragAxis = null; // Reset drag axis
    }
});

document.addEventListener("touchmove", function (e) {
    if (e.touches.length === 2 && initialPinchDistance !== null) {
        e.preventDefault();
        const currentPinchDistance = getPinchDistance(e);
        updateZoom(currentPinchDistance);
    } else if (isDragging && e.touches.length === 1 && !isPinching) {
        e.preventDefault();
        const currentTouchX = e.touches[0].pageX;
        const currentTouchY = e.touches[0].pageY;
        const deltaX = currentTouchX - initialTouchX;
        const deltaY = currentTouchY - initialTouchY;

        if (dragAxis === null) {
            dragAxis = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
        }

        let position = mediaEntity.getAttribute("position");

        if (dragAxis === "x") {
            fixedAngleDegrees = initialFixedAngle - deltaX * dragSpeedX;

            const radians = (fixedAngleDegrees * Math.PI) / 180;
            const x = -currentZoom * Math.sin(radians);
            const z = -currentZoom * Math.cos(radians);

            mediaEntity.setAttribute("position", { x, y: position.y, z });
            mediaEntity.setAttribute("rotation", `0 ${fixedAngleDegrees} 0`);

            if (frameEntity) {
                frameEntity.setAttribute("position", { x, y: position.y, z });
                frameEntity.setAttribute("rotation", `0 ${fixedAngleDegrees} 0`);
            }

            lookImages.forEach((lookImage, index) => {
                const angle = (index + 1) * 90;
                const lookRadians = ((fixedAngleDegrees + angle) * Math.PI) / 180;
                const lookX = -currentZoom * Math.sin(lookRadians);
                const lookZ = -currentZoom * Math.cos(lookRadians);
                lookImage.setAttribute("position", { x: lookX, y: 0, z: lookZ });
                lookImage.setAttribute("rotation", { x: 0, y: angle + fixedAngleDegrees, z: 0 });
            });
        } else if (dragAxis === "y") {
            const adjustedDragSpeedY = dragSpeedY * (currentZoom / 45);
            const newY = position.y - deltaY * adjustedDragSpeedY;
            const clampedY = Math.max(minY, Math.min(maxY, newY));

            mediaEntity.setAttribute("position", { x: position.x, y: clampedY, z: position.z });

            if (frameEntity) {
                frameEntity.setAttribute("position", { x: position.x, y: clampedY, z: position.z });
            }
        }

        initialMediaState.position = { ...mediaEntity.getAttribute("position") };
        initialMediaState.rotation = { ...mediaEntity.getAttribute("rotation") };

        updateCurrentValues();
    }
}, { passive: false });

document.addEventListener("touchend", function () {
    initialPinchDistance = null;
    isDragging = false;
    isPinching = false;
    dragAxis = null;
});

function getPinchDistance(e) {
    const dx = e.touches[0].pageX - e.touches[1].pageX;
    const dy = e.touches[0].pageY - e.touches[1].pageY;
    return Math.sqrt(dx * dx + dy * dy);
}

function updateZoom(currentPinchDistance) {
    if (mediaEntity) {
        const directionX = -Math.sin((fixedAngleDegrees * Math.PI) / 180);
        const directionZ = -Math.cos((fixedAngleDegrees * Math.PI) / 180);
        let distanceChange =
            -(currentPinchDistance - initialPinchDistance) * zoomSpeed;
        let newZoom = currentZoom + distanceChange;

        newZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

        const x = newZoom * directionX;
        const z = newZoom * directionZ;

        mediaEntity.setAttribute("position", { x, y: currentY, z });
        if (frameEntity) {
            frameEntity.setAttribute("position", { x, y: currentY, z });
        }
        currentZoom = newZoom;

        initialMediaState.position = { x, y: currentY, z };

        updateCurrentValues();
    }
}

document.querySelectorAll('a-entity, a-image, a-video').forEach(el => {
    const position = el.getAttribute('position');
    if (position.x === 0 && position.y === 0 && position.z === 0) {
    }
});

function updateCurrentValues() {
    currentFixedAngleDisplay.textContent = fixedAngleDegrees.toFixed(2);
    currentYPositionDisplay.textContent = currentY.toFixed(2);
    currentZDepthDisplay.textContent = mediaEntity.getAttribute('position').z.toFixed(2);
}

let map;
let markers = [];
let routePolyline;
let currentIndex = 0;
let completedJobs = [];

const apiUrl = 'http://localhost:3000';

function initMap() {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat: 28.5195044, lng: 77.3626324 },
    zoom: 8,
  });

  const addressAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("addressInput")
  );
  const technicianAutocomplete = new google.maps.places.Autocomplete(
    document.getElementById("technicianInput")
  );
}

function addAddress() {
  const addressInput = document.getElementById("addressInput");
  const address = addressInput.value;

  if (address.trim() !== "") {
    // Geocode the address and add a marker to the map
    geocodeAddress(address);

    // Optional: Center the map on the new marker
    const location = markers.length > 0 ? markers[markers.length - 1].getPosition() : { lat: 28.5195044, lng: 77.3626324 };
    map.setCenter(location);
  }

  addressInput.value = "";
}

function addTechnicianLocation() {
  const technicianInput = document.getElementById("technicianInput");
  const technicianLocation = technicianInput.value;

  if (technicianLocation.trim() !== "") {
    // Geocode the technician's location and add a marker to the map
    geocodeTechnicianLocation(technicianLocation);

    // Optional: Center the map on the technician's marker
    const location = markers.length > 0 ? markers[markers.length - 1].getPosition() : { lat: 0, lng: 0 };
    map.setCenter(location);
  }

  technicianInput.value = "";
}

function geocodeAddress(address) {
  // Make an API request to geocode the address and add a marker to the map
  fetch(`${apiUrl}/geocode-address`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ address }),
  })
    .then(response => response.json())
    .then(data => {
      const coordinates = data.coordinates;

      // Check if coordinates are valid numbers
      if (
        !isNaN(coordinates.latitude) &&
        !isNaN(coordinates.longitude)
      ) {
        // Add a marker to the map for the address
        const marker = new google.maps.Marker({
          position: { lat: coordinates.latitude, lng: coordinates.longitude },
          map: map,
          title: `Geocoded Location: ${coordinates.latitude}, ${coordinates.longitude}`,
        });

        markers.push(marker);

        // Optional: Center the map on the new marker
        map.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude });
      } else {
        console.error('Invalid coordinates received:', coordinates);
      }
    })
    .catch(error => console.error('Error geocoding address:', error));
}

function geocodeTechnicianLocation(technicianLocation) {
  // Make an API request to geocode the technician's location and add a marker to the map
  fetch(`${apiUrl}/geocode-technician-location`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ technicianLocation }),
  })
    .then(response => response.json())
    .then(data => {

      const coordinates = data.coordinates;

      if (!isNaN(coordinates.latitude) && !isNaN(coordinates.longitude)) {
        // Check if coordinates are valid numbers

        // Add a marker to the map for the technician
        const marker = new google.maps.Marker({
          position: { lat: coordinates.latitude, lng: coordinates.longitude },
          map: map,
          icon: 'http://maps.google.com/mapfiles/ms/icons/green-dot.png',
          title: "Technician Location",
        });

        markers.push(marker);
        map.setCenter({ lat: coordinates.latitude, lng: coordinates.longitude });

      } else {
        console.error('Invalid coordinates received for technician location:', data);
      }
    })
    .catch(error => console.error('Error geocoding technician location:', error));
}


function planRoute() {
  // Check if there are enough locations for route planning
  if (markers.length < 2) {
    alert("Please add at least two locations before planning a route.");
    return;
  }

  // Get the locations (LatLng objects) from the markers
  const locations = markers.map(marker => marker.getPosition());

  // Make an API request to calculate the optimized route
  fetch(`${apiUrl}/optimize-route`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ jobLocations: locations }),
  })
    .then(response => response.json())
    .then(data => {
      // Check if the received data is valid
      if (data && data.route && Array.isArray(data.route) && data.route.length > 0) {
        // Clear existing route polyline
        if (routePolyline) {
          routePolyline.setMap(null);
        }

        // Draw a polyline to represent the optimized route
        routePolyline = new google.maps.Polyline({
          path: data.route.map(location => new google.maps.LatLng(location.lat, location.lng)),
          geodesic: true,
          strokeColor: "#0000FF",
          strokeOpacity: 1.0,
          strokeWeight: 2,
          map: map,
        });

        // Optional: Fit the map to show the entire route
        const bounds = new google.maps.LatLngBounds();
        data.route.forEach(location => bounds.extend(location));
        map.fitBounds(bounds);

        console.log('Optimized Route:', data.route);
        console.log('Total Distance:', data.totalDistance);
      } else {
        console.error('Invalid route data received:', data);

        // Additional logging for specific issues
        if (!data || !data.route) {
          console.error('Invalid or missing route data');
        } else if (data.route.length < 2) {
          console.error('Not enough points in the route data');
        }
      }
    })
    .catch(error => console.error('Error planning route:', error));
}


function markJobCompleted(jobType) {
  // Check if there are any jobs left to mark as completed
  if (currentIndex < markers.length) {
    // Make an API request to mark the job as completed
    fetch(`${apiUrl}/mark-completed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobId: currentIndex, jobType }), // Include jobType in the request
    })
      .then(response => {
        if (response.ok) {
          // Mark the current job as completed based on jobType
          const completedMarker = markers[currentIndex];
          completedJobs.push(completedMarker);

          // Update marker icon based on jobType
          const iconUrl = jobType === 'address' ? 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png' :
            'http://maps.google.com/mapfiles/ms/icons/green-dot.png';
          updateMarkerIcon(completedMarker, iconUrl);

          currentIndex++;

          // Check if there are more jobs
          if (currentIndex < markers.length) {
            // Update the route polyline to skip the completed job
            updateRoutePolyline();
          } else {
            // All jobs completed
            alert("All jobs completed!");
          }
        } else {
          console.error('Error marking job as completed:', response.statusText);
        }
      })
      .catch(error => console.error('Error marking job as completed:', error));
  } else {
    alert("No more jobs to mark as completed.");
  }
}

function updateMarkerIcon(marker, iconUrl) {
  marker.setIcon({
    url: iconUrl,
    scaledSize: new google.maps.Size(30, 30), // Adjust size if needed
  });
}



function updateMarkerIcon(marker, iconUrl) {
  marker.setIcon({
    url: iconUrl,
    scaledSize: new google.maps.Size(30, 30), // Adjust size if needed
  });
}

function updateRoutePolyline() {
  if (routePolyline) {
    // Get the remaining locations from the current index to the end
    const remainingLocations = markers.slice(currentIndex).map(marker => marker.getPosition());

    // Update the route polyline to represent the remaining route
    routePolyline.setPath(remainingLocations);
  }
}

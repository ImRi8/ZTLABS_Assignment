const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const NodeGeocoder = require('node-geocoder');

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

// Create or open the SQLite database
const db = new sqlite3.Database('route_planning.db');

// Create a table for job locations
db.run(`
  CREATE TABLE IF NOT EXISTS job_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    x REAL,
    y REAL,
    completed BOOLEAN DEFAULT 0
  )
`);

db.run(`
  CREATE TABLE IF NOT EXISTS technician_locations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  completed BOOLEAN DEFAULT 0
  )
`);


// Function to calculate distance between two points using Haversine formula
function calculateDistance(point1, point2) {
  const earthRadius = 6371; // Radius of the Earth in kilometers
  const lat1 = point1.lat;
  const lon1 = point1.lng;
  const lat2 = point2.lat;
  const lon2 = point2.lng;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = earthRadius * c;

  return distance;
}

// Function to convert degrees to radians
function toRadians(degrees) {
  return degrees * (Math.PI / 180);
}

// function calculateNearestNeighborRoute(jobLocations) {
//   if (!jobLocations || jobLocations.length === 0) {
//     console.error('Invalid jobLocations array:', jobLocations);
//     return { route: [], totalDistance: 0 };
//   }
//
//   const n = jobLocations.length;
//   const visited = new Array(n).fill(false);
//   const route = [];
//   let totalDistance = 0;
//
//   // Start from the first location
//   let currentLocationIndex = 0;
//
//   for (let i = 0; i < n - 1; i++) {
//     visited[currentLocationIndex] = true;
//     route.push(currentLocationIndex);
//
//     let minDistance = Infinity;
//     let nearestLocationIndex = -1;
//
//     // Find the nearest unvisited location
//     for (let j = 0; j < n; j++) {
//       if (!visited[j]) {
//         const locationA = jobLocations[currentLocationIndex];
//         const locationB = jobLocations[j];
//
//         // Check if locations have 'x' and 'y' properties
//         if (locationA && locationB && locationA.x !== undefined && locationA.y !== undefined &&
//             locationB.x !== undefined && locationB.y !== undefined) {
//           const distance = calculateDistance(locationA, locationB);
//
//           if (distance < minDistance) {
//             minDistance = distance;
//             nearestLocationIndex = j;
//           }
//         } else {
//           console.error('Invalid location data at indices', currentLocationIndex, j);
//         }
//       }
//     }
//
//     totalDistance += minDistance;
//     currentLocationIndex = nearestLocationIndex;
//   }
//
//   // Return to the starting location to complete the route
//   route.push(route[0]);
//
//   // Check if locations have 'x' and 'y' properties before calculating distance
//   const startingLocation = jobLocations[currentLocationIndex];
//   const endingLocation = jobLocations[route[0]];
//
//   if (startingLocation && endingLocation && startingLocation.x !== undefined && startingLocation.y !== undefined &&
//       endingLocation.x !== undefined && endingLocation.y !== undefined) {
//     totalDistance += calculateDistance(startingLocation, endingLocation);
//   } else {
//     console.error('Invalid starting or ending location data');
//   }
//
//   // Update the route to use actual indices
//   const actualRoute = route.map(index => jobLocations[index]);
//
//   return { route: actualRoute, totalDistance };
// }

// Greedy algorithm to calculate the shortest route
function calculateGreedyRoute(jobLocations) {
  // Ensure there are locations to visit
  if (!jobLocations || jobLocations.length < 2) {
    console.error('Invalid jobLocations array:', jobLocations);
    return { route: [], totalDistance: 0 };
  }

  const n = jobLocations.length;
  const unvisitedLocations = [...jobLocations];
  const initialLocation = unvisitedLocations.shift(); // Start at the first location
  const greedyRoute = [initialLocation];
  let totalDistance = 0;

  while (unvisitedLocations.length > 0) {
    const currentLocation = greedyRoute[greedyRoute.length - 1];
    let nearestNeighborIndex = 0;
    let nearestNeighborDistance = Number.MAX_VALUE;

    // Find the nearest unvisited location
    for (let i = 0; i < unvisitedLocations.length; i++) {
      const distance = calculateDistance(currentLocation, unvisitedLocations[i]);

      if (distance < nearestNeighborDistance) {
        nearestNeighborIndex = i;
        nearestNeighborDistance = distance;
      }
    }

    // Move to the nearest unvisited location
    greedyRoute.push(unvisitedLocations.splice(nearestNeighborIndex, 1)[0]);
    totalDistance += nearestNeighborDistance;
  }

  // Return to the starting location to complete the route
  greedyRoute.push(greedyRoute[0]);

  return { route: greedyRoute, totalDistance };
}



const geocoderOptions = {
  provider: 'google',
  apiKey: 'AIzaSyC3FqeaNMevABlI83EbJodYxsnmpoxi1Ls', // Replace with your actual API key
};
const geocoder = NodeGeocoder(geocoderOptions);

app.post('/geocode-address', async (req, res) => {
  const { address } = req.body;

  try {
    // Perform geocoding using the configured geocoder
    const geocodeResult = await geocoder.geocode(address);

    // Check if there is a result
    if (geocodeResult.length > 0) {
      const { latitude, longitude } = geocodeResult[0];
      res.json({ coordinates: { latitude, longitude } });
    } else {
      res.status(404).json({ error: 'Geocoding not successful. No results found.' });
    }
  } catch (error) {
    console.error('Error during geocoding:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/geocode-technician-location', async (req, res) => {
  const { technicianLocation } = req.body;

  try {
    // Perform geocoding using the configured geocoder
    const geocodeResult = await geocoder.geocode(technicianLocation);

    // Check if there is a result
    if (geocodeResult && geocodeResult.length > 0) {
      const { latitude, longitude } = geocodeResult[0];
      res.json({ coordinates: { latitude, longitude } });
    } else {
      res.status(404).json({ error: 'Geocoding not successful. No results found.' });
    }
  } catch (error) {
    console.error('Error during geocoding technician location:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});



// API endpoint to receive job locations, return optimized route, and store data
app.post('/optimize-route', express.json(), (req, res) => {
  const { jobLocations } = req.body;

  console.log('Received job locations:', jobLocations);

  // Calculate optimized route
  const { route, totalDistance } = calculateGreedyRoute(jobLocations);

  console.log('Optimized Route:', route);
  console.log('Total Distance:', totalDistance);

  // Store job locations and optimized route in the database
  jobLocations.forEach(location => {
    db.run('INSERT INTO job_locations (name, x, y) VALUES (?, ?, ?)',
      location.name, location.x, location.y, (err) => {
        if (err) {
          console.error('Error inserting job location into the database:', err);
          res.status(500).send('Internal Server Error');
          return;
        }
      });
  });

  // Return optimized route and total distance to the client
  res.json({ route, totalDistance });
});


app.post('/mark-completed', express.json(), (req, res) => {
  const { jobId, jobType } = req.body;

  console.log('Received request to mark job completed. Job ID:', jobId, 'Job Type:', jobType);

  // Update job completion status in the database based on jobType
  const tableName = jobType === 'address' ? 'job_locations' : 'technician_locations';

  db.run(`UPDATE ${tableName} SET completed = 1 WHERE id = ?`,
    jobId, (err) => {
      if (err) {
        console.error('Error marking job as completed:', err);
        res.status(500).send('Internal Server Error');
        return;
      }

      res.status(200).send('Job marked as completed successfully');
    });
});



app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

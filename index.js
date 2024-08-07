const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const ARCHIVE_BASE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "München";

// Get the city name from the widget parameter or default to London
const city = args.widgetParameter || DEFAULT_CITY;

// Function to fetch latitude and longitude of the city
async function fetchCoordinates(city) {
  const url = `${GEOCODING_URL}?name=${encodeURIComponent(city)}`;
  const response = await new Request(url).loadJSON();
  if (response.results && response.results.length > 0) {
    const { latitude, longitude } = response.results[0];
    return { latitude, longitude };
  } else {
    throw new Error(`No coordinates found for city: ${city}`);
  }
}

// Function to fetch historical weather data
async function fetchHistoricalWeatherData(latitude, longitude, year) {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = date.getHours();

  // Correctly format the date as YYYY-MM-DD
  const formattedDate = `${year}-${month}-${day}`;

  try {
    const url = `${ARCHIVE_BASE_URL}?latitude=${latitude}&longitude=${longitude}&start_date=${formattedDate}&end_date=${formattedDate}&hourly=temperature_2m`;
    const response = await new Request(url).loadJSON();
    const temperature = response.hourly.temperature_2m[hour];

    if (temperature === undefined) {
      throw new Error(`Temperature data for ${formattedDate} ${hour}:00 is not available`);
    }

    return {
      year,
      temperature,
    };
  } catch (error) {
    console.error(`Failed to fetch historical weather data for ${year}: ${error.message}`);
    return {
      year,
      temperature: null,
    };
  }
}

// Function to fetch current year's forecast data
async function fetchCurrentWeatherData(latitude, longitude) {
  const date = new Date();
  const hour = date.getHours() - 1; // Adjusting to avoid the issue of current hour data not being available
  const formattedDate = date.toISOString().split('T')[0];

  try {
    const url = `${FORECAST_BASE_URL}?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m&forecast_days=1`;
    const response = await new Request(url).loadJSON();
    const temperature = response.hourly.temperature_2m[hour];

    if (temperature === undefined) {
      throw new Error(`Temperature data for ${formattedDate} ${hour}:00 is not available`);
    }

    return {
      year: date.getFullYear(),
      temperature,
    };
  } catch (error) {
    console.error(`Failed to fetch current weather data: ${error.message}`);
    return {
      year: date.getFullYear(),
      temperature: null,
    };
  }
}

// Function to get the temperature data for the past 9 years (excluding the current year) and current year
async function getTemperatureData(latitude, longitude) {
  const historicalPromises = [];
  const currentYear = new Date().getFullYear();

  for (let i = 1; i <= 9; i++) {
    historicalPromises.push(fetchHistoricalWeatherData(latitude, longitude, currentYear - i));
  }

  const historicalData = await Promise.all(historicalPromises);
  const currentData = await fetchCurrentWeatherData(latitude, longitude);
  return { historicalData, currentData };
}

function getColorForTemperature(temp) {
  const colorScale = [
    { temp: -20, color: [0, 255, 255] },   // Cyan
    { temp: -18, color: [56, 199, 255] },
    { temp: -16, color: [112, 143, 255] },
    { temp: -14, color: [168, 87, 255] },
    { temp: -12, color: [224, 31, 255] },
    { temp: -10, color: [128, 0, 128] }, // Violett
    { temp: -8, color: [144, 0, 144] },
    { temp: -6, color: [160, 0, 160] },
    { temp: -4, color: [176, 0, 176] },
    { temp: -2, color: [192, 0, 192] },
    { temp: 0, color: [0, 0, 139] },       // Dunkelblau
    { temp: 2, color: [0, 47, 175] },
    { temp: 4, color: [0, 94, 211] },
    { temp: 6, color: [0, 141, 247] },
    { temp: 8, color: [0, 188, 255] },
    { temp: 10, color: [0, 255, 0] },    // Grünlich
    { temp: 12, color: [51, 255, 0] },
    { temp: 14, color: [102, 255, 0] },
    { temp: 16, color: [153, 255, 0] },
    { temp: 18, color: [204, 255, 0] },
    { temp: 20, color: [255, 255, 0] },    // Gelb
    { temp: 22, color: [255, 204, 0] },
    { temp: 24, color: [255, 153, 0] },
    { temp: 26, color: [255, 102, 0] },
    { temp: 28, color: [255, 51, 0] },
    { temp: 30, color: [255, 128, 0] },      // Orange
    { temp: 32, color: [255, 96, 0] },
    { temp: 34, color: [255, 64, 0] },
    { temp: 36, color: [255, 32, 0] },
    { temp: 38, color: [255, 0, 0] },
    { temp: 40, color: [204, 0, 0] },      // Dunkelrot
    { temp: 42, color: [153, 0, 0] },
    { temp: 44, color: [102, 0, 0] },
    { temp: 46, color: [0, 255, 255] }     // Cyan
  ];

  if (temp === null) {
    return new Color('#888888'); // Grau für fehlende Daten
  }

  let lower = colorScale[0];
  let upper = colorScale[colorScale.length - 1];

  for (let i = 0; i < colorScale.length - 1; i++) {
    if (temp >= colorScale[i].temp && temp <= colorScale[i + 1].temp) {
      lower = colorScale[i];
      upper = colorScale[i + 1];
      break;
    }
  }

  const range = upper.temp - lower.temp;
  const factor = (range === 0) ? 0 : (temp - lower.temp) / range;
  const interpolatedColor = interpolateColor(lower.color, upper.color, factor);
  const hexColor = rgbToHex(interpolatedColor);

  return new Color(hexColor);
}

function interpolateColor(color1, color2, factor) {
  const result = color1.slice();
  for (let i = 0; i < 3; i++) {
    result[i] = Math.round(result[i] + factor * (color2[i] - result[i]));
  }
  return result;
}

function rgbToHex(rgb) {
  return `#${rgb.map(value => {
    const hex = value.toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('')}`;
}



async function createWidget(historicalData, currentData) {
  const widget = new ListWidget();
  widget.setPadding(10, 10, 10, 10); // Add padding
  widget.backgroundColor = new Color('#1c1c1c'); // Dark background for contrast

let topBar = widget.addStack();
  topBar.layoutVertically();
  let gradient1 = new LinearGradient();
  gradient1.colors = [new Color("#B22222", 1), new Color("#8B0000", 1)];
  gradient1.locations = [0, 1];
  topBar.backgroundGradient = gradient1;
  topBar.size = new Size(160, 30);
  topBar.setPadding(10, 14, 5, 5)

let topBarText = topBar.addText(`${city}`);
  topBarText.textColor = Color.white();
  topBarText.font = Font.boldSystemFont(14);
  widget.addSpacer(1)
  const currentStack = widget.addStack();
  currentStack.size = new Size(0, 11); // Adjust height as needed
  currentStack.layoutHorizontally(); // Layout horizontal

  const currentColorView = currentStack.addStack();
  currentColorView.size = new Size(160, 10); // Size of color block
  currentColorView.backgroundColor = getColorForTemperature(currentData.temperature);
  currentStack.addSpacer(2)


  historicalData.forEach((entry, index) => {
    widget.addSpacer(1); // Add some breathing space between stripes

    const stack = widget.addStack();

    stack.size = new Size(0, 12); // Adjust height as needed
    stack.layoutHorizontally(); 


    // Layout horizontally
    const colorView = stack.addStack();
    colorView.size = new Size(160, 11); 
    colorView.useDefaultPadding()
    // Size of color block

    colorView.backgroundColor = getColorForTemperature(entry.temperature);

    stack.addSpacer(5); // Add spacing between color and text



  });

  widget.addSpacer(0); // Add some breathing space before the current year

  return widget;
}

// Main function to execute
async function main() {
  try {
    const { latitude, longitude } = await fetchCoordinates(city);
    const { historicalData, currentData } = await getTemperatureData(latitude, longitude);
    const widget = await createWidget(historicalData, currentData);
    if (config.runsInWidget) {
      Script.setWidget(widget);
    } else {
      widget.presentSmall();
    }
    Script.complete();
  } catch (error) {
    const widget = new ListWidget();
    widget.addText(`Error: ${error.message}`);
    Script.setWidget(widget);
    console.error(`Error: ${error.message}`);
  }
}

main();
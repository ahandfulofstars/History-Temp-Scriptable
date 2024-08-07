const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_BASE_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "London";

const city = args.widgetParameter || DEFAULT_CITY;

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

async function fetchCurrentWeatherData(latitude, longitude) {
  const date = new Date();

  try {
    const url = `${FORECAST_BASE_URL}?latitude=${latitude}&longitude=${longitude}&hourly=cloudcover&forecast_days=2`;
    const response = await new Request(url).loadJSON();
    const clouds = response.hourly.cloudcover;

    return {
      year: date.getFullYear(),
      clouds,
    };
  } catch (error) {
    console.error(`Failed to fetch current weather data: ${error.message}`);
    return {
      year: date.getFullYear(),
      temperature: null,
    };
  }
}

async function getTemperatureData(latitude, longitude) {
  return await fetchCurrentWeatherData(latitude, longitude);
}

function getColorForTemperature(cloudCover) {
  const cloudCoverScale = [
    { coverage: 0, color: [0, 0, 255] }, // Blau (0% Wolkenbedeckung)
    { coverage: 25, color: [200, 200, 255] },
    { coverage: 50, color: [150, 150, 255] },
    { coverage: 75, color: [100, 100, 255] },
    { coverage: 100, color: [255, 255, 255] }, // Weiß (100% Wolkenbedeckung)
  ];

  if (cloudCover === null) {
    return new Color("#888888");
    l;
  }

  let lower = cloudCoverScale[0];
  let upper = cloudCoverScale[cloudCoverScale.length - 1];

  for (let i = 0; i < cloudCoverScale.length - 1; i++) {
    if (
      cloudCover >= cloudCoverScale[i].coverage &&
      cloudCover <= cloudCoverScale[i + 1].coverage
    ) {
      lower = cloudCoverScale[i];
      upper = cloudCoverScale[i + 1];
      break;
    }
  }

  const range = upper.coverage - lower.coverage;
  const factor = range === 0 ? 0 : (cloudCover - lower.coverage) / range;
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
  return `#${rgb
    .map((value) => {
      const hex = value.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("")}`;
}

const hours = new Date().getHours() + 23;
async function createWidget(clouds) {
  const widget = new ListWidget();
  widget.setPadding(10, 10, 10, 10);

  log(clouds);
  widget.backgroundColor = new Color("#1c1c1c");

  let topBar = widget.addStack();
  topBar.layoutVertically();
  let gradient1 = new LinearGradient();
  gradient1.colors = [new Color("#00008B", 1), new Color("#191970", 1)];
  gradient1.locations = [0, 1];
  topBar.backgroundGradient = gradient1;
  topBar.size = new Size(160, 30);
  topBar.setPadding(10, 14, 5, 5);

  let topBarText = topBar.addText(`${city}`);
  topBarText.textColor = Color.white();
  topBarText.font = Font.boldSystemFont(14);
  widget.addSpacer(1);

  for (let i = 0; i < clouds.length; i++) {
    widget.addSpacer(1);

    const stack = widget.addStack();

    stack.layoutHorizontally();

    const colorView = stack.addStack();

    colorView.useDefaultPadding();
    log(hours);

    colorView.backgroundColor = getColorForTemperature(clouds[i]);
    if (i === 0) {
      colorView.size = new Size(160, 11);
    } else {
      colorView.size = new Size(160, 1.6);
    }
    stack.addSpacer(5);
  }

  widget.addSpacer(0);

  return widget;
}

async function main() {
  try {
    const { latitude, longitude } = await fetchCoordinates(city);
    const { clouds } = await getTemperatureData(latitude, longitude);

    const widget = await createWidget(clouds);
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

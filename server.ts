import dotenv from "dotenv";
import LGTV from "lgtv2";
import { readFileSync, writeFileSync } from "fs";
import express from "express";
dotenv.config();

const HOST = process.env.TV_HOST || "lgwebostv";
const INTERVAL_SECONDS = 5;
const MAX_TIME_PER_DAY_SECONDS = 60 * 60; // 1 hour
const ALLOW_AFTER_TIME = (19 * 60 + 30) * 60; // 7:30 PM
const DISALLOW_BEFORE_TIME = 8 * 60 * 60; // 8:00 AM

// Add Express setup
const app = express();
const PORT = process.env.PORT || 3001;

// Add state interface
interface TVState {
  date: string;
  secondsOn: number;
  isOn: boolean;
  lastChecked: string;
  enabled: boolean;
}

let globalState: TVState = {
  date: new Date().toISOString(),
  secondsOn: 0,
  isOn: false,
  lastChecked: new Date().toISOString(),
  enabled: true, // default to enabled
};

// Add routes
app.get("/", (req, res) => {
  const currentTime = new Date();
  const secondsSinceMidnight =
    currentTime.getHours() * 3600 +
    currentTime.getMinutes() * 60 +
    currentTime.getSeconds();

  res.send(`
    <html>
      <head>
        <title>TV Status</title>
        <meta http-equiv="refresh" content="${INTERVAL_SECONDS}">
        <style>
          body { font-family: Arial, sans-serif; margin: 2em; }
          .status { padding: 1em; margin: 1em 0; border-radius: 4px; }
          .on { background: #e6ffe6; }
          .off { background: #ffe6e6; }
          .switch {
            position: relative;
            display: inline-block;
            width: 60px;
            height: 34px;
            margin-right: 10px;
            vertical-align: middle;
          }
          .switch input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #ccc;
            transition: .4s;
            border-radius: 34px;
          }
          .slider:before {
            position: absolute;
            content: "";
            height: 26px;
            width: 26px;
            left: 4px;
            bottom: 4px;
            background-color: white;
            transition: .4s;
            border-radius: 50%;
          }
          input:checked + .slider {
            background-color: #2196F3;
          }
          input:checked + .slider:before {
            transform: translateX(26px);
          }
        </style>
      </head>
      <body>
        <h1>TV Status Monitor</h1>
        <form action="/toggle" method="post" style="margin-bottom: 1em;">
          <label class="switch">
            <input type="checkbox" ${globalState.enabled ? "checked" : ""} onclick="this.form.submit()">
            <span class="slider"></span>
          </label>
          <span>Time limits ${globalState.enabled ? "enabled" : "disabled"}</span>
        </form>
        <div class="status ${globalState.isOn ? "on" : "off"}">
          <p>TV is currently: <strong>${globalState.isOn ? "ON" : "OFF"}</strong></p>
          <p>Time watched today: ${Math.floor(globalState.secondsOn / 60)} minutes</p>
          <p>Time remaining: ${Math.floor((MAX_TIME_PER_DAY_SECONDS - globalState.secondsOn) / 60)} minutes</p>
          <p>Current time: ${currentTime.toLocaleTimeString()}</p>
          <p>Allowed between: ${new Date(DISALLOW_BEFORE_TIME * 1000).toLocaleTimeString()} and ${new Date(ALLOW_AFTER_TIME * 1000).toLocaleTimeString()}</p>
          <p>Last checked: ${new Date(globalState.lastChecked).toLocaleTimeString()}</p>
        </div>
      </body>
    </html>
  `);
});

app.post("/toggle", (req, res) => {
  try {
    const state = JSON.parse(readFileSync("state.json", "utf8"));
    state.enabled = !state.enabled;
    writeFileSync("state.json", JSON.stringify(state));
    globalState.enabled = state.enabled;
    res.redirect("/");
  } catch (e) {
    res.status(500).send("Error toggling state");
  }
});

// Add after the express setup
app.use(express.urlencoded({ extended: true }));

const check = async () => {
  console.log("Checking...", new Date().toISOString());
  globalState.lastChecked = new Date().toISOString();

  const lgtv = LGTV({
    url: `ws://${HOST}:3000`,
    timeout: 1000,
    reconnect: 0,
  });

  lgtv.on("error", function (err) {
    console.log("TV is off");
    globalState.isOn = false;
    lgtv.disconnect();
  });

  lgtv.on("connect", function () {
    // TV is on
    console.log("Connected");
    globalState.isOn = true;

    // Read state.json. If it doesn't exist, create it with the current time
    let state: any;
    try {
      state = JSON.parse(readFileSync("state.json", "utf8"));
      if (typeof state.enabled === "undefined") {
        state.enabled = true; // default to enabled for existing state files
      }
    } catch (e) {
      console.log("No state found, creating new state");
      state = {
        date: new Date().toISOString(),
        secondsOn: 0,
        enabled: true,
      };
    }

    // If it's a new day, reset secondsOn
    if (new Date(state.date).getDate() !== new Date().getDate()) {
      console.log("New day, resetting secondsOn");
      state.secondsOn = 0;
      state.date = new Date().toISOString();
    }

    // Increment secondsOn by INTERVAL
    state.secondsOn += INTERVAL_SECONDS;

    // Write state.json
    writeFileSync("state.json", JSON.stringify(state));

    // Update global state
    globalState = {
      ...globalState,
      date: state.date,
      secondsOn: state.secondsOn,
      enabled: state.enabled,
    };

    // Only enforce limits if enabled
    if (state.enabled) {
      // Are we before the allowed time?
      const currentTime = new Date();
      const secondsSinceMidnight =
        currentTime.getHours() * 3600 +
        currentTime.getMinutes() * 60 +
        currentTime.getSeconds();
      const isBeforeAllowedTime = secondsSinceMidnight < DISALLOW_BEFORE_TIME;
      console.log("isBeforeAllowedTime", isBeforeAllowedTime);

      // Are we past the limit?
      const isPastLimit = state.secondsOn > MAX_TIME_PER_DAY_SECONDS;
      console.log("isPastLimit", isPastLimit);

      // Are we past the always allowed time?
      const isPastAlwaysAllowedTime = secondsSinceMidnight > ALLOW_AFTER_TIME;
      console.log("isPastAlwaysAllowedTime", isPastAlwaysAllowedTime);

      // If we're past the limit, turn off the TV
      if (isPastLimit && !isPastAlwaysAllowedTime) {
        console.log("TV is on past the limit, turning off");
        lgtv.request("ssap://system/turnOff", function (err, res) {
          console.log(res);
          lgtv.disconnect();
        });
      } else if (isBeforeAllowedTime) {
        console.log("TV is on before the allowed time, turning off");
        lgtv.request("ssap://system/turnOff", function (err, res) {
          console.log(res);
          lgtv.disconnect();
        });
      } else {
        console.log("TV is on, but no limits were hit");
        lgtv.disconnect();
      }
    } else {
      console.log("Limits are disabled");
      lgtv.disconnect();
    }
  });
};

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});

// Start the TV checking
check();
setInterval(check, INTERVAL_SECONDS * 1000);

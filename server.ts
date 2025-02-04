import dotenv from "dotenv";
import LGTV from "lgtv2";
import { readFileSync, writeFileSync } from "fs";
dotenv.config();

const HOST = process.env.TV_HOST || "lgwebostv";
const INTERVAL_SECONDS = 5;
const MAX_TIME_PER_DAY_SECONDS = 60 * 60; // 1 hour
const ALLOW_AFTER_TIME = (19 * 60 + 30) * 60; // 7:30 PM
const DISALLOW_BEFORE_TIME = 8 * 60 * 60; // 8:00 AM

const check = async () => {
  console.log("Checking...", new Date().toISOString());

  const lgtv = LGTV({
    url: `ws://${HOST}:3000`,
    timeout: 1000,
    reconnect: 0,
  });

  lgtv.on("error", function (err) {
    console.log("TV is off");
    lgtv.disconnect();
  });

  lgtv.on("connect", function () {
    // TV is on
    console.log("Connected");

    // Read state.json. If it doesn't exist, create it with the current time
    let state: any;
    try {
      state = JSON.parse(readFileSync("state.json", "utf8"));
    } catch (e) {
      console.log("No state found, creating new state");
      state = {
        date: new Date().toISOString(),
        secondsOn: 0,
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
  });
};

check();
setInterval(check, INTERVAL_SECONDS * 1000);

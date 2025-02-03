import dotenv from "dotenv";
import LGTV from "lgtv2";
import { readFileSync, writeFileSync } from "fs";
dotenv.config();

const HOST = process.env.TV_HOST || "lgwebostv";
const INTERVAL = 3000;
const MAX_SECONDS_PER_DAY = 60 * 60; // 1 hour
const ALLOW_UNLIMITED_TIME_AFTER = 19 * 60 + 30; // 7:30 PM

const check = async () => {
  console.log("Checking...");

  const lgtv = LGTV({
    url: `ws://${HOST}:3000`,
    timeout: 1000,
  });

  lgtv.on("error", function (err) {
    console.log("TV is off");
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
    state.secondsOn += INTERVAL;

    // Write state.json
    writeFileSync("state.json", JSON.stringify(state));

    // Are we past the limit?
    const isPastLimit = state.secondsOn > MAX_SECONDS_PER_DAY;
    console.log("isPastLimit", isPastLimit);

    // Are we past the always allowed time?
    const currentTime = new Date();
    const secondsSinceMidnight =
      currentTime.getHours() * 3600 +
      currentTime.getMinutes() * 60 +
      currentTime.getSeconds();
    const isPastAlwaysAllowedTime =
      secondsSinceMidnight > ALLOW_UNLIMITED_TIME_AFTER;
    console.log("isPastAlwaysAllowedTime", isPastAlwaysAllowedTime);

    // If we're past the limit, turn off the TV
    if (isPastLimit && !isPastAlwaysAllowedTime) {
      console.log("TV is on past the limit, turning off");

      // TEMPORARY: Don't turn off the TV
      lgtv.disconnect();

      // lgtv.request('ssap://system/turnOff', function (err, res) {
      // 	console.log(res);
      // 	lgtv.disconnect();
      // });
    } else {
      console.log("TV is on, but not past the limit");
      lgtv.disconnect();
    }
  });
};

check();
setInterval(check, INTERVAL);

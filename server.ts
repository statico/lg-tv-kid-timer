import dotenv from "dotenv";
import LGTV from "lgtv2";

dotenv.config();

const HOST = process.env.TV_HOST || "lgwebostv";

const lgtv = LGTV({
    url: `ws://${HOST}:3000`
});

lgtv.on('error', function (err) {
    console.log(err);
});

lgtv.on('connect', function () {
    console.log('connected');
    lgtv.request('ssap://audio/getStatus', function (err, res) {
        console.log(res);
        lgtv.disconnect();
    });
});

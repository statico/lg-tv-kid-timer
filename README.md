# lg-tv-kid-timer

Control LG TV usage because it has no parental control for time limit.

<img src="https://github.com/user-attachments/assets/d2743bdd-8747-46e0-bb84-3f353bebb6c9" width="300"/>

This Node.js application connects to an LG WebOS TV via websocket to enforce daily screen time limits. Features:

- Monitors TV usage and tracks total time per day
- Automatically turns off TV after 1 hour of daily usage
- Allows unlimited viewing after 7:30 PM
- Persists state between restarts using state.json

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file with your TV's host:

```bash
TV_HOST=lgwebostv
```

3. Run the script:

```bash
node server.js
```

## State File

The `state.json` file is automatically created when the script runs. It persists the TV's current state between restarts. It includes:

- `date`: ISO timestamp of when the state was last updated
- `secondsOn`: Total seconds the TV has been on for the current day (resets at midnight)

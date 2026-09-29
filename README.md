# RapidJAM Web Direct Probe (experimental)

This isolated, static page tests whether a browser page served from a real HTTPS origin can directly reach the controller's WebConfig HTTP API. It is a diagnostic spike, not the configurator, not a supported distribution, and not evidence that browser-only product delivery is viable.

## Safety and scope

- The page only calls the fixed host `http://192.168.7.1` and the two paths `/api/getFirmwareVersion` and `/api/getHETriggerVoltage`.
- Firmware version is a GET. The optional voltage request is a single JSON POST with `targetId: 0`; inspected firmware code reads the ADC and selects the MUX channel using GPIO outputs. It does not persist settings, but it can change the live selector/ADC state while measuring. Run it only when the operator has confirmed this is safe for the connected hardware, and stop using the controller during the request.
- It never calls reboot, configuration setters, calibration setup, or any other endpoint. There are no retries, polling, external scripts, analytics, storage, or log upload.
- The voltage POST remains disabled until the operator checks the explicit confirmation box.
- Do not treat localhost, `file://`, the existing Vite proxy, or the legacy Node proxy as a pass. They do not represent a browser-only HTTPS deployment.

## Run the experiment

1. Record the controller model/revision, firmware version/hash if known, Windows version, and browser/version. Coordinate use of the shared physical controller.
2. Put the controller in WebConfig/RNDIS mode and confirm it is reachable at `http://192.168.7.1` using the normal supported path.
3. Publish the contents of this directory as a temporary static site on an HTTPS origin. Do not add it to the production app or release archive. The HTTPS origin is important for testing mixed-content and Local Network Access behavior.
4. Open the HTTPS page in the current stable Chrome or Edge. Open DevTools **Network** and **Console**, preserve the log, then run the firmware GET.
5. Record whether the browser showed a local-network permission prompt, the user's choice, the request/response status visible in DevTools, and the page result. The JavaScript `fetch()` API intentionally cannot inspect blocked CORS response details; use DevTools for the browser's blocked reason and whether an `OPTIONS` preflight occurred.
6. If safe for this hardware, acknowledge the warning and run the voltage POST once. Confirm whether DevTools shows OPTIONS followed by POST, and whether the voltage JSON response is readable. Do not retry automatically.
7. Repeat in the other browser and with permission denied (reset the site permission between runs). Do not alter browser security flags for the pass/fail run.
8. Save a short result summary and sanitized screenshots. Do not upload a raw HAR without reviewing it for device/network details.

## Decision criteria

- **No-Go for pure WebApp on current firmware:** either the firmware GET or the JSON POST is blocked by mixed-content, local-network-access, CORS, missing/failed preflight, routing, or firmware behavior in a supported target browser. If uncertain, mark inconclusive and inspect firmware/browser evidence; do not infer success from localhost/proxy tests.
- **Conditional follow-up only:** both requests work on the intended browser(s), after any required user permission, from the actual HTTPS origin. This only establishes that these two probes are readable; it does not prove production security, writes, calibration, offline behavior, browser compatibility, firmware-wide compatibility, or safe recovery.
- If the probe fails on shipped firmware, further work requires a separately scoped firmware change (CORS/OPTIONS and origin/security review) or a new device protocol such as a dedicated USB interface. Do not work around browser security restrictions with insecure flags or a public CORS proxy.

## Implementation files

- `index.html`: UI and restrictive page CSP.
- `app.js`: explicit, one-shot requests with a five-second timeout and no retries.
- `styles.css`: self-contained responsive presentation.

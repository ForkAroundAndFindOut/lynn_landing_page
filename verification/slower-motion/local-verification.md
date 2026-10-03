# Slower motion local verification

Unit suite: 58 passed, 0 failed.

Initial full Chromium run: {"PASS":53,"FAIL":1,"UNVERIFIED":1}. Its only failure was the new attenuation fixture selecting a 390x650 viewport where the existing content-fit guard intentionally chooses reading flow. All other application checks passed, with zero browser/asset errors. Full results and five recordings are in local/.

The corrected attenuation fixture uses 390x844, 390x932 and 800x900; all nine trusted CDP 60px touches passed. Measured progress follows Crisp 2x, Balanced 2.5x and Gentle 3x attenuation versus the frozen previous geometry on the same measured stage height. Browser deck-position output has 0.001 resolution; the assertion allows only the corresponding 0.0005 rounding bound. Separate corrected results are in local-corrected-attenuation/.

Crisp, Balanced and Gentle native-dispatched touch flick settlement measurements were 613-622ms, 920-923ms and 1315-1321ms. Slow release/reversal and slow midpoint commit checks also passed, as did equal duration for 16px/2000px wheel commands with wider preset timing gaps.

WebKit was skipped per the requested existing-engine limitation and remains unverified. Physical devices, native Safari/Android and actual on-screen keyboard behavior remain unverified.

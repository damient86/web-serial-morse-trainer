Web Serial Morse Trainer
===

JS-based web application to send Koch training lessons to serial attached hardware sounders.

Experimental practice transmit trainer using a key with local sounder loopback functionality.

**Important: Requires a Chromium based browser (Chrome/Edge/Brave) in order to leverage the web serial API**

* This trainer is for *International* Morse
* Toggle invert serial pins if your sounder outputs are crossed *--you will know this is true if the sounder coil stays energised as soon as the serial device is connected.*
* This was designed to work with the simple [MorseKOB sounder driver circuit](https://sites.google.com/site/morsekob/morsekob25/interface#h.p_BVV-h37Wxtzn) although any sounder circuit which uses RTS to trigger a sounder should work.

Serial wiring must currently be as below:
Line|Pin|Function
|---|---|---
DTR|4|Manual key common
DSR|6|Manual key
RTS|7|Sounder output
SG|5|Sounder ground

I may add provision to dynamically change however this arrangement seems to be fairly standard.
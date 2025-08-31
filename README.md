Web Serial Morse Trainer
===

JS-based web application to send Koch training lessons to serial attached hardware sounders.

**Important: Requires a Chromium based browser (Chrome/Edge/Brave) in order to leverage the web serial API**

* This trainer is for International Morse
* Toggle invert serial pins if your sounder outputs are crossed *--you will know this is true if the sounder coil stays energised as soon as the serial device is connected.*
* This is designed to work with the [MorseKOB sounder driver circuit](https://github.com/damient86/web-serial-morse-trainer) where the sounder is activated using pins 7 and 5
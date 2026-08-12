# Privacy

## What the app stores

Rae's Big Ride does not ask for an account, name, email address, age, photo,
contacts, or location.

The app stores one preference in this browser's local storage: `rbr_last`.
It contains the last selected vehicle, colour, pace, and companion setting so
the “Same as last time” option can work. It is not sent by the app to a Rae's
Big Ride server. Clear this site's browser data to remove it.

## Microphone and speech recognition

Voice play needs browser microphone permission. The app uses the browser's Web
Speech API with Singapore English (`en-SG`) and uses the recognition result to
control the game.

The desktop microphone check also starts a separate browser `getUserMedia()`
stream and routes it through an in-page Web Audio analyser for level feedback
and voice activity. The app code does not record, persist, or send that
analyser audio. On mobile, the app reuses Web Speech activity instead of
opening this second stream.

The app code does not record or persist voice audio or transcripts, and does
not send them to a Rae's Big Ride backend or analytics service. Browser speech
recognition and its provider may process microphone audio and recognition
results under their own policies. That processing is separate from the app and
is not controlled by this project.

You can deny microphone permission and use the adult-assist, keyboard, and
touch fallbacks instead.

## Children and guardians

This game is designed for young children. A parent or guardian should set it up
and supervise voice use. Do not speak or enter names, addresses, school
details, health information, or other sensitive information while playing.

The project does not provide accounts, parental-consent collection, or a
child-data portal. This policy does not claim compliance with COPPA, the
Singapore PDPA, or other privacy laws. Obtain appropriate advice before wider
distribution.

## Hosting and questions

The hosting provider may process normal web-request data, such as IP address,
browser information, and request logs, under its own terms. The app has no
application analytics or telemetry code.

For non-sensitive project questions, use a GitHub issue. Do not include a
child's or anyone else's personal information in a public issue.

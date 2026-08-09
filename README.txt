JEE MAIN 2026 - PHYSICS PRACTICE APP
=====================================

An offline, browser-based practice app for JEE Main 2026 Physics.
It contains 475 previous-year questions across 24 chapters from the
Eduniti "JEE Main 2026 Jan & April Attempt Physics Questions" source PDF.


FEATURES
--------

- 475 Physics questions across 24 chapters.
- Separate January and April attempt question sets, with an option to
  practice both together.
- Test Mode for timed, exam-style practice without immediate feedback.
- Quiz Mode for instant correct/wrong feedback, sounds, and streaks.
- A YouTube solution icon in Quiz Mode. It opens the matching chapter
  solution video from the source PDF:
    - January selection: January chapter solution video.
    - April selection: April chapter solution video.
    - Both selection: January chapter solution video.
- Actual cropped question images from the source PDF, including diagrams,
  tables, and matrix-match questions.
- Objective and numerical-answer question support.
- Question palette, mark-for-review, zoom controls, calculator, sound
  settings, saved progress, and question-image correction tools.


HOW TO RUN
----------

Do not open index.html by double-clicking it. Browsers block local data and
image loading in that case. Start a small local web server inside this app
folder, then open the address it gives you.

Option 1 - Python:

    python -m http.server 8000

Open http://localhost:8000 in your browser.

Option 2 - Node.js:

    npx serve .

Open the local address shown in the terminal.

Option 3 - VS Code:

Install the Live Server extension, right-click index.html, and choose
"Open with Live Server".

Your name, scores, sound preference, progress, and any image corrections are
stored only in your browser using localStorage. Keep using the same browser
and local address to retain them.


HOW TO USE
----------

1. Enter your name on the welcome screen.
2. Choose a Physics chapter.
3. Select January, April, or Both attempts.
4. Select Test Mode or Quiz Mode.
5. Answer questions using the options or numerical input field.
6. In Quiz Mode, click the red YouTube icon in the top-right corner to open
   the chapter's solution video in a new tab.

Test Mode shows the result and review after submission. Quiz Mode evaluates
each answer immediately and keeps a correct-answer streak.


PROJECT STRUCTURE
-----------------

    index.html                         App layout
    css/style.css                      Visual styling
    js/app.js                          App behavior and quiz logic
    js/calculator.js                   On-screen calculator
    data/chapters.json                 Chapters, counts, and YouTube links
    data/manifest.json                 Question metadata and answer keys
    questions/<chapter>/<jan|april>/   Question image files
    songs/                             Optional custom sound files


CUSTOM SOUNDS
-------------

Add your own MP3 files to the songs folder using these names:

    song1.mp3 through song6.mp3

The app uses songs 1, 5, and 6 for correct answers, and songs 2 and 3 for
wrong answers. Sound can be muted using the speaker icon or Settings.


QUESTION IMAGE CORRECTIONS
--------------------------

Open Settings, select a chapter, attempt, and question, then either crop the
existing image or upload a replacement. Changes are saved only in your
browser and do not modify the original question files.


SOURCE NOTES
------------

Questions and answer keys were prepared from the Eduniti source PDF. Questions
marked "Dropped by NTA" remain flagged in the app and are excluded from normal
right/wrong scoring. The video links in data/chapters.json were extracted from
the chapter-wise YouTube links in that same PDF.

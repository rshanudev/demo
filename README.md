# Cricket Six Quiz 3D

Kids' 3D cricket quiz: every correct answer is a SIX (+6 runs), every wrong answer is a wicket. Reach **60 runs** before you lose **10 wickets**.
Four fixed rounds: 5 multiple choice, 5 fill in the blanks, 5 true/false, 1 matching round (5 pairs). Reaching 60 does not end the match: play continues until the last question or the last wicket. At that point the result is decided: 60+ runs is a win; otherwise all ten wickets lost is a loss, and finishing the questions short of 60 is "not won".

## Run it
```bash
npm install
npm run dev        # open the URL it prints (Node 18+)
npm run build      # production build in /dist
npm run test:logic # checks scoring, wickets, win/lose priority, matching and restart
```

## Where things are
- `src/data/questions.js`  all questions (editable arrays), round names and batsmen names
- `src/game/gameLogic.js`  all rules (score, wickets, rounds, win/lose, restart), no React or 3D
- `src/game/sound.js`      synthesised sound effects (no audio files), mute supported
- `src/components/`        Scene, CricketStadium, CricketPitch, Batsman, Bowler, CricketBall, AnimatedCrowd, Scoreboard,
                           QuizManager, MCQRound, FillBlanksRound, TrueFalseRound, MatchingRound, MatchResult, GameControls, ReviewPanel
- `src/styles.css`         responsive HUD (all sizes scale from one unit, with a portrait layout for phones)

## External assets
None are required. Players, stadium, crowd, ball and sounds are generated in code.
Optional:
- Answer card pictures: `public/assets/<label with dashes>.png` (e.g. `mobile-phone.png`, `fax-machine.png`), square about 512x512, transparent. The emoji is shown until the file exists.
- Characters: stylised players built from sculpted, skinned geometry (`Humanoid.jsx`, `characterGeometry.js`). Rigged GLB characters can replace them without code changes: see `public/models/README.md` (manifest `public/models/characters.json`, loader `ModelCharacter.jsx`, IK and bone mapping `src/game/modelRig.js`). `npm test` runs the game-logic and rig tests.

## What you see in play
- Every six uses a different shot (straight drive, cover drive, pull, helicopter, lofted on-drive, sweep, hook) and the replay camera shows the hit from the side, then follows the ball to where it lands. Edit shots in `src/game/shots.js`.
- Every wicket is shown in slow motion with a close-up on the stumps (four different dismissals), then the batsman walks off and the next one jogs in.
- Round 2 is typed: letter boxes + keyboard (a Hint button reveals the first letter). In round 4 the camera re-frames so the cricket sits in the free strip between the scoreboard and the (compact) matching panel.

## Controls
Drag to look around the whole ground, wheel or pinch to zoom, double-click to reset the view, speaker mutes, the top-right buttons are sound and restart. Phones automatically use the lighter graphics mode (no shadows, smaller crowd, 1x pixel ratio).
Keys are not needed; sound starts after your first tap (browser rule).

# ⚽ VAR Control Room & Match Review Workstation v3.0

An elite, IFAB-certified **Video Assistant Referee (VAR) Suite** featuring:
1. **Full-Stack Interactive VAR Control Room Web Application** (React 19, TypeScript, Tailwind CSS, HTML5 Canvas 3D Perspective Projection, Web Audio API).
2. **Modular Computer Vision VAR Pipeline & FastAPI Telemetry Bridge** (Python, YOLOv8-Pose 17-keypoint estimation, ByteTrack, Planar Homography, SAOT Offside Engine, Penalty Incident Detector, WebSocket Bridge).

---

## 🌟 1. Web Application: Interactive VAR Control Room

### Core Modules:
- **Multi-Angle Synchronized Video Playback Deck**:
  - 4-camera synchronized array: `CAM-01: Main Wide`, `CAM-02: 16-Yard Offside Line`, `CAM-03: Behind Goal Low`, `CAM-04: High Tactical Spidercam`.
  - 3 view layouts: **`Primary + PIP`**, **`2x2 Quad Grid`**, and **`Split-Screen Dual Compare`** (synchronized side-by-side angle review).
  - Broadcast playback controls: Frame-by-frame stepping (`-1f` / `+1f` at 60fps), Jog/Shuttle slider (`10%`, `25%`, `50%`, `100%`, `200%`), Loop Point A-to-B, and "Freeze at Kick Point".
  - **Attacking Possession Phase (APP) Rewind Scrubber**: Visual phase markers (`Possession Regained` &rarr; `Buildup Challenge` &rarr; `Kick Point` &rarr; `Incident`) to audit attacking fouls in the buildup.
  - **Broadcast Telestrator & Tactical Drawing Suite**: Freehand tactical pen, directional vector arrows, player spotlight halo ring, angle/distance protractor, and a **2x–4x Picture-in-Picture Zoom Loupe (Magnifier)** over contact points.
  - **Referee Review Area (RRA) Pitch-Side Monitor Mode**: High-contrast simplified layout for the center referee looping incident contact frames at 25% slow-mo then automatically transitioning to 100% normal speed.
  - **Goal-Line Technology (GLT) Hawkeye Sensor Suite**: Interactive top-down and turf cross-section Hawkeye visualizer with `12.0cm` line width, `22.0cm` ball, millimeter overhang calculation, and referee watch vibration alert (`GLT SIGNAL: GOAL / NO GOAL`).
  - **AI VAR Co-Pilot Assistant**: Neural frame telemetry analyzer providing instant confidence scores, IFAB Law clause citations, and 1-click decision synchronization.
  - **Hardware Keyboard Shortcuts (EVS Controller mapping)**: `Space` (Play/Pause), `← / →` (`-1f / +1f`), `Shift + ← / →` (`-10f / +10f`), `K` (Kick Point), `I` (Incident Point), `1`–`4` (Switch Cams), `[` / `]` (Loop In/Out), `L` (Toggle Loop).

### Quick Start (Web App):
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Or build for production
npm run build
```

---

## 🐍 2. Python Computer Vision VAR Pipeline & Backend Bridge

Located in the [`cv_pipeline/`](cv_pipeline/) directory:

- `detector.py`: YOLOv8 object detection (`person`, `sports ball`) + ByteTrack multi-object tracking + **Circular unit-circle HSV jersey color clustering** (resolving red-jersey wrap-around) with centroid outlier rejection for Referees and Goalkeepers.
- `homography.py`: Planar homography matrix $H$ with RANSAC, converting camera screen coordinates $(u, v)$ to metric FIFA pitch coordinates $(X, Y)$ ($105\text{m} \times 68\text{m}$). Includes **automatic white-line pitch detection** via Top-Hat morphological filtering, probabilistic Hough Line Transform (`cv2.HoughLinesP`), and Exponential Moving Average (EMA) smoothing for camera panning.
- `pose_analyzer.py`: **YOLOv8-Pose 17-keypoint skeletal estimation**:
  - *Law 11 SAOT*: Isolates playable body extremities (head, shoulders, hips, knees, feet) while strictly excluding arms/hands (wrists and elbows).
  - *Law 12 Handball*: Measures arm abduction angle relative to vertical torso axis ($> 45^\circ$ = unnatural silhouette) and detects ball intersection.
- `offside_engine.py`: Kick point detection ($t_{\text{pass}}$) via ball acceleration spike and player proximity ($< 1.2\text{m}$), with a **3-second (180-frame) locked offside line hold** and subsequent pass cooldown reset.
- `incident_detector.py`: Detects high-IoU collisions inside the 16.5m penalty box accompanied by aspect ratio changes (player falling), clips a 6-second slow-motion buffer, and outputs JSON event payloads.
- `server.py`: **FastAPI + WebSocket Live Bridge**:
  - `POST /api/analyze-video`: Accepts an uploaded match clip and returns frame-by-frame JSON telemetry matching the React `ScenarioFrameState` TypeScript interface.
  - `WS /ws/telemetry`: Streams live 60fps telemetry and synthesized broadcast frames to the React web app.
- `main.py`: Command-line runner supporting match clips, synthetic pitch simulation, and server startup (`--server`).

### Quick Start (Python Pipeline & Server):
```bash
# 1. Install requirements
pip install -r cv_pipeline/requirements.txt

# 2. Run test suite
pytest tests/

# 3. Launch the FastAPI + WebSocket backend bridge
uvicorn cv_pipeline.server:app --port 8000

# 4. Or run the CV pipeline CLI directly
python -m cv_pipeline.main --synthetic --frames 180 --output var_output.mp4
```

---

## 📜 3. IFAB Laws of the Game Adherence
- **Law 9 & 10**: The Ball In and Out of Play & Determining the Outcome of the Match (GLT 100% outer edge overhang rule).
- **Law 11**: Offside (First point of contact, 2nd-last defender line, excluding hands/arms, own-half and behind-the-ball exemptions).
- **Law 12**: Fouls & Misconduct (Serious Foul Play excessive force criteria, DOGSO double jeopardy inside-the-box downgrade, and handball unnatural silhouette $> 45^\circ$).
- **VAR Protocol**: Interventions strictly restricted to Clear and Obvious Errors or Serious Missed Incidents.

# ⚽ VAR Control Room & Match Review Workstation

An elite, IFAB-certified **Video Assistant Referee (VAR) Suite** featuring:
1. **Full-Stack Interactive VAR Control Room Web Application** (React 19, TypeScript, Tailwind CSS, HTML5 Canvas 3D Perspective Projection, Web Audio API).
2. **Modular Computer Vision VAR Pipeline** (Python, YOLOv8, ByteTrack, Planar Homography, SAOT Offside Engine, Penalty Incident Detector).

---

## 🌟 1. Web Application: Interactive VAR Control Room

### Core Modules:
- **Multi-Angle Synchronized Video Playback Deck**:
  - 4-camera synchronized array: `CAM-01: Main Wide`, `CAM-02: 16-Yard Offside Line`, `CAM-03: Behind Goal Low`, `CAM-04: High Tactical Spidercam`.
  - Primary maximized monitor + 3 synchronized picture-in-picture thumbnails, or 2x2 Quad Grid mode.
  - Broadcast playback controls: Frame-by-frame stepping (`-1f` / `+1f` at 60fps), Jog/Shuttle slider (`10%`, `25%`, `50%`, `100%`, `200%`), Loop Point A-to-B, and "Freeze at Kick Point".
  - Built-in Interactive Pitch Simulator mode (HTML5 Canvas) with 3 pre-loaded animated match scenarios + support for custom `.mp4` video uploads.
- **Semi-Automated Offside Technology (SAOT) Calibration Tool**:
  - Interactive 2D/3D pitch perspective overlay.
  - Pass Frame Lock (moment of kick contact per IFAB Law 11).
  - Dual crosshairs for 2nd-last defender and leading attacker with anatomical body part selection and millimeter micro-nudge controls.
  - Real-time parallax-adjusted 3D offside lines across the pitch turf with high-contrast distance delta badge (`OFFSIDE: +14.2 cm` in crimson or `ONSIDE: -8.5 cm` in emerald).
  - 2D radar minimap in bottom corner.
- **IFAB Decision Tree & Guided Checklist Wizard**:
  - Covers all 4 reviewable categories: Goal/No Goal, Penalty/No Penalty, Direct Red Card, Mistaken Identity.
  - Dynamic *DOGSO 4-Criteria Calculator* with Double Jeopardy inside-the-box downgrade logic (Red -> Yellow).
  - Dynamic *Serious Foul Play (SFP) Matrix* assessing speed, exposed studs, contact point, and endangerment.
  - Dynamic *Handball Evaluator* assessing unnatural silhouette, deliberate movement, and immediate goalscorer contact.
- **Referee Communication & Broadcast Graphics**:
  - Live Status Banner with 1-click state transitions: `MONITORING` ➔ `VAR CHECK IN PROGRESS` ➔ `ON-FIELD REVIEW (OFR)` ➔ `CHECK COMPLETE`.
  - Auto-generated IFAB-standard radio transmission script.
  - Push-to-Talk (PTT) with Web Audio API radio chirp and squelch synthesis.
  - Stadium Giant Screen Jumbotron & TV Broadcast Lower Thirds preview modal.
- **Incident Log & Audit Export**:
  - Match timeline with review duration timers, original vs final decisions, and export to JSON / Print formatted report.

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

## 🐍 2. Python Computer Vision VAR Pipeline

Located in the `cv_pipeline/` directory:

- `detector.py`: YOLOv8 object detection (`person`, `sports ball`) + ByteTrack multi-object tracking + K-Means HSV jersey color clustering for `Team A`, `Team B`, `Goalkeeper`, and `Referee`.
- `homography.py`: Computes 4-point planar homography matrix $H$ with RANSAC, converting camera screen coordinates $(u, v)$ to metric FIFA pitch coordinates $(X, Y)$ in meters ($105\text{m} \times 68\text{m}$) and inverse projection.
- `offside_engine.py`: Ball acceleration & foot proximity pass release detection ($t_{\text{pass}}$), 2nd-last defender identification, leading attacker comparison, and 3D perspective offside line drawing on grass with 2D radar minimap overlay.
- `incident_detector.py`: Detects high-IoU collisions inside the 16.5m penalty box accompanied by rapid aspect ratio changes (player falling), clips a 6-second video buffer ($t - 3\text{s}$ to $t + 3\text{s}$), and outputs structured JSON event payloads.
- `main.py`: Command-line runner supporting both real match clips and synthetic simulation mode.

### Quick Start (Python Pipeline):
```bash
# Install requirements
pip install -r cv_pipeline/requirements.txt

# Run on custom match footage
python -m cv_pipeline.main --source match_clip.mp4 --output var_annotated_output.mp4

# Or run synthetic simulation mode (no external footage needed)
python -m cv_pipeline.main --synthetic --frames 180 --output var_synthetic_output.mp4
```

---

## 📜 3. IFAB Laws of the Game Adherence
- **Law 10**: Determining the Outcome of the Match (Goal / No Goal)
- **Law 11**: Offside (First point of contact, 2nd-last defender line, interfering with play)
- **Law 12**: Fouls & Misconduct (Serious Foul Play, DOGSO double-jeopardy inside penalty box, Handball unnatural silhouette)
- **VAR Protocol**: Interventions strictly restricted to Clear and Obvious Errors or Serious Missed Incidents.

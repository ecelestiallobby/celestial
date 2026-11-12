# CELESTIAL LOBBY | Venus Poster Engine V2

A modular Python compositor committed to the CELESTIAL LOBBY repository. No Google Drive connection is required.

## Run in Google Colab (free tier, subject to availability)
1. Open https://colab.research.google.com/
2. Create a notebook.
3. Clone the public repository and install dependencies:

```python
!git clone https://github.com/ecelestiallobby/celestial.git
%cd celestial/tools/venus-poster-engine-v2
!pip install -r requirements.txt
```

4. Upload your separate image assets into the `assets` folder in the Colab file panel:
   - `background.png`: full-frame Venusian sky/world.
   - `architecture.png`: transparent overlay of palaces/citadels/bridges.
   - `character.png`: Vaelith cutout with transparent background (RGBA).
   - `foreground.png`: optional foreground silhouette/structure overlay.
   - `particles.png`: optional transparent light/particle overlay.
5. Run `!python venus_poster_v2.py`.
6. Download `output/CELESTIAL_LOBBY_VENUS_V2.png`.

## Layer stack
Background → architecture → atmospheric tint → character glow/shadow/character → foreground → particles → vignette/bottom fade → metallic typography → color grade.

The compositor keeps layers independently replaceable. It does not generate the actual character or environment artwork. Those source assets must be created separately with an image generator or supplied artwork. For best results, character/foreground/architecture/particle overlays should be transparent PNGs.

## Editable controls
Change `venus_config.json` to reposition the character, change scale, alter the palette, edit lore text, move typography, adjust glow and grading, and change canvas dimensions.

Default canvas is 2160 × 4320 (1:2, matching the Mars reference poster's portrait proportion). 300-DPI metadata is included; DPI metadata does not itself increase pixel detail.

## Cost controls
Python, Pillow and NumPy are open source. Google Colab free GPU access is limited and not guaranteed. No paid API or Drive connector is required. If GPU is unavailable, this compositor itself can run on CPU; the image assets are generated separately.

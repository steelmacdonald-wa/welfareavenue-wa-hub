# Archived build scripts

- `w117_gen.py` and `w118_gen.py` generated `src/117_wave117.seg` and `src/118_wave118.seg` once. Both segments have been edited by hand since (waves 132 and 133 changed 118), so the segments are the source now. Re-running a generator would silently undo those edits. Kept for history only.

The remap scripts (`brand_remap.py`, `teams_remap.py`) stay in `build/`: their changes are baked into the sources (`bake_remaps.py`, 26/09/26) and `check_remaps.py` uses them to fail the build if a legacy colour or an old team label comes back.

# Reproducing the synthetic tour

The [MP4](media/passage-demo.mp4) and [GIF](media/passage-demo.gif) are a silent, edited 60-second tour: twelve real browser captures held for five seconds each, not a real-time input recording. Captions are burned into the captured pixels. The [contact sheet](images/demo-contact-sheet.png) shows all twelve frames. Screenshots contain bundled synthetic content only.

## Tools and isolation

Use Node 22+, the locked dev-only Playwright package (`npm ci --ignore-scripts`), installed Chrome and installed ffmpeg/ffprobe with libx264. No browser download or runtime dependency is added. Generation is explicit, not run in CI:

```sh
tools/make-demo
```

`BROWSER_EXECUTABLE` overrides Chrome's location; `PYTHON` overrides `python3`. On Windows, run `node tools/make-demo.mjs` with those executable overrides if required; generation itself was tested only on macOS. Optional `READER_EVIDENCE` points to an existing directory for probe results.

The script copies examples into an OS-temp root, starts an ephemeral loopback server with separate temporary settings, and uses a fresh browser context. Outbound requests and page errors fail generation. Screenshots are captured through the existing Playwright setup and section helpers. Captions are a temporary DOM overlay created by the capture script, not reader code; no new font/encoding dependency is needed. The temporary workspace is removed after generation, including on failure.

## Exact encoding commands

From the temporary frame directory, the script writes `frames.txt` with twelve `file 'frame-NN.png'` records, each followed by `duration 5`, repeating the final file once. These are the commands (output paths shown relative to the checkout):

```sh
ffmpeg -hide_banner -loglevel error -y -f concat -safe 0 -i frames.txt -t 60 -vf 'fps=12,scale=1200:-2' -c:v libx264 -preset slow -crf 29 -pix_fmt yuv420p -movflags +faststart -an docs/media/passage-demo.mp4
ffmpeg -hide_banner -loglevel error -y -i docs/media/passage-demo.mp4 -filter_complex 'fps=12,scale=900:-1:flags=lanczos,split[frames][colors];[colors]palettegen=max_colors=64:stats_mode=diff[palette];[frames][palette]paletteuse=dither=none:diff_mode=rectangle' -loop 0 docs/media/passage-demo.gif
ffmpeg -hide_banner -loglevel error -y -framerate 1 -i frame-%02d.png -vf 'scale=300:200,tile=3x4' -frames:v 1 docs/images/demo-contact-sheet.png
```

The wrapper passes absolute output paths because encoding runs inside the temporary directory. H.264/yuv420p and faststart are used for the MP4; the GIF is 900px wide at 12fps with a 64-color palette and no dithering. Static holds and palette restriction keep sizes modest, at the expense of smooth interaction motion and color fidelity. The script refuses MP4 ≥6,000,000 bytes or GIF ≥5,000,000 bytes.

## Verification

```sh
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of json docs/media/passage-demo.mp4
ffprobe -v error -show_entries format=duration,size:stream=codec_name,width,height,r_frame_rate -of json docs/media/passage-demo.gif
ffmpeg -v error -i docs/media/passage-demo.mp4 -f null -
ffmpeg -v error -i docs/media/passage-demo.gif -f null -
```

Generation executes those probes and full decodes, then writes the contact sheet for visual inspection. Docs checks verify signatures and byte limits without needing ffmpeg in CI. Private-data scanning of compressed pixels is not reliable: inspect every screenshot/contact frame before committing. The release scan still scans media bytes for textual matches in the working tree and history, decoding invalid UTF-8 with replacement rather than crashing. No new media exemption is added.
